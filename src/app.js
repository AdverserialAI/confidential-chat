import { verifyInferenceReceipt } from './receipt.js';

const state = { config: null, proof: null };
const $ = (id) => document.getElementById(id);
const trust = $('trust'); const summary = $('summary'); const prompt = $('prompt'); const send = $('send'); const token = $('access-token');
const canonicalModelID = (value) => /^[a-z0-9][a-z0-9._-]{0,127}\/[a-z0-9][a-z0-9._-]{0,127}$/.test(value);
const base64UrlNonce = () => { const bytes = crypto.getRandomValues(new Uint8Array(32)); let out = ''; for (const byte of bytes) out += String.fromCharCode(byte); return btoa(out).replaceAll('+', '-').replaceAll('/', '_').replace(/=+$/u, ''); };
function setTrust(kind, text) { trust.className = `state ${kind}`; trust.textContent = text; }
function addMessage(role, text) { const item=document.createElement('article'); item.className='message'; const who=document.createElement('b'); who.textContent=role; item.append(who, document.createElement('br'), document.createTextNode(text)); $('messages').append(item); }
function disablePrompt(reason) { state.proof = null; prompt.disabled = true; send.disabled = true; setTrust('failed', 'Verification required'); summary.textContent = reason; }
function normalizeProof(value, model) {
  if (!value || value.verified !== true || typeof value.verifier !== 'string') throw new Error('The independent hardware verifier did not accept the runtime evidence.');
  if (typeof value.tlsSpkiSha256 !== 'string' || !value.tlsSpkiSha256.startsWith('sha256:')) throw new Error('The verifier did not return the attested TLS key binding.');
  if (typeof value.attestationStateDigest !== 'string' || !value.attestationStateDigest.startsWith('sha256:')) throw new Error('The verifier did not return the attestation state binding.');
  const key = value.receiptPublicKey;
  if (!key || key.kty !== 'EC' || key.crv !== 'P-256' || typeof key.kid !== 'string') throw new Error('The verifier did not return the attested receipt verification key.');
  const expiresAt = typeof value.expiresAt === 'number' ? value.expiresAt : Date.parse(value.expiresAt || '') / 1000;
  if (!Number.isFinite(expiresAt) || expiresAt <= Date.now() / 1000) throw new Error('The verifier returned an expired proof.');
  return { ...value, model, expiresAt, receiptPublicKey: key };
}
async function loadConfig() {
  const response = await fetch('./config.json', {cache:'no-store'}); if (!response.ok) throw new Error('Configuration unavailable.');
  const config=await response.json();
  if (!Array.isArray(config.models) || config.models.some((m)=>!canonicalModelID(m.id)) || !/^https:\/\//.test(config.api_base_url || '') || !/^https:\/\//.test(config.billing_base_url || '')) throw new Error('Configuration contains an invalid model or endpoint.');
  if (!Number.isInteger(config.max_output_tokens) || config.max_output_tokens < 1) throw new Error('Configuration contains an invalid output limit.');
  state.config=config; $('evidence').href=config.policy_url;
  for (const model of config.models) { const option=document.createElement('option'); option.value=model.id; option.textContent=model.label || model.id; $('model').append(option); }
}
async function verify() {
  setTrust('pending','Verifying runtime…'); summary.textContent='Fetching fresh evidence and validating it before this chat can send a prompt.';
  try {
    if (typeof window.AdverserialHardwareVerifier !== 'function') throw new Error('No independent browser hardware verifier is installed. Prompts remain disabled.');
    const model=$('model').value;
    const raw=await window.AdverserialHardwareVerifier({attestationUrl:state.config.attestation_url, policyUrl:state.config.policy_url, modelId:model, apiBaseUrl:state.config.api_base_url, issuer:state.config.receipt_issuer, audience:state.config.receipt_audience});
    state.proof=normalizeProof(raw, model); setTrust('verified',`Verified: ${state.proof.verifier}`); summary.textContent=`Verified ${model}. Each response will require a signed receipt bound to this attestation state.`; prompt.disabled=false; send.disabled=false;
  } catch (error) { disablePrompt(error instanceof Error ? error.message : 'Verification failed.'); }
}
async function credential() {
  if (window.AdverserialIdentityProvider?.getAccessToken) {
    const supplied = await window.AdverserialIdentityProvider.getAccessToken();
    if (typeof supplied === 'string' && supplied) return supplied;
  }
  const supplied = token.value.trim(); if (!supplied) throw new Error('Enter an Adverserial API key or connect a signed identity provider. The key remains only in this browser and billing.'); return supplied;
}
async function entitlement(accessToken, model, requestBody) {
  const maximumInput = new TextEncoder().encode(requestBody).byteLength;
  const response = await fetch(`${state.config.billing_base_url}/cc/entitlements`, { method:'POST', credentials:'omit', headers:{authorization:`Bearer ${accessToken}`, 'content-type':'application/json', accept:'application/json'}, body:JSON.stringify({model,max_input_tokens:maximumInput,max_output_tokens:state.config.max_output_tokens,endpoint_spki_sha256:state.proof.tlsSpkiSha256}) });
  const payload = await response.json().catch(() => ({}));
  if (!response.ok || typeof payload.entitlement !== 'string' || !Number.isInteger(payload.max_output_tokens)) throw new Error(payload.detail || payload.error?.message || `Billing entitlement failed (${response.status}).`);
  return payload;
}
$('verify').addEventListener('click',verify);
$('composer').addEventListener('submit', async (event) => {
  event.preventDefault(); if (!state.proof || state.proof.expiresAt <= Date.now() / 1000) { disablePrompt('The verification proof expired. Verify the runtime again.'); return; }
  const text=prompt.value.trim(); if (!text) return; const model = $('model').value; if (state.proof.model !== model) { disablePrompt('The selected model changed. Verify the runtime again.'); return; }
  send.disabled=true;
  try {
    const nonce = base64UrlNonce(); const draft = {model,messages:[{role:'user',content:text}],stream:false,max_tokens:state.config.max_output_tokens};
    const accessToken = await credential(); const encodedDraft = JSON.stringify(draft); const grant = await entitlement(accessToken, model, encodedDraft);
    const body = JSON.stringify({...draft,max_tokens:grant.max_output_tokens});
    const response=await fetch(`${state.config.api_base_url}/chat/completions`, {method:'POST',credentials:'omit',headers:{authorization:`Bearer ${grant.entitlement}`, 'content-type':'application/json','x-adverserial-nonce':nonce},body});
    const responseBody=await response.text(); if (!response.ok) throw new Error(`Confidential API request failed (${response.status}).`);
    const receipt=response.headers.get('x-adverserial-receipt');
    await verifyInferenceReceipt({receipt,receiptPublicKey:state.proof.receiptPublicKey,issuer:state.config.receipt_issuer,audience:state.config.receipt_audience,modelId:model,requestNonce:nonce,requestBody:body,responseBody,tlsSpkiSha256:state.proof.tlsSpkiSha256,attestationStateDigest:state.proof.attestationStateDigest});
    const payload=JSON.parse(responseBody); addMessage('YOU',text); prompt.value=''; addMessage('MODEL',payload.choices?.[0]?.message?.content || 'No completion returned.');
  } catch(error) { addMessage('SYSTEM',error instanceof Error ? error.message : 'Request failed.'); }
  finally { send.disabled = !state.proof || state.proof.expiresAt <= Date.now()/1000; }
});
loadConfig().catch((error)=>disablePrompt(error instanceof Error?error.message:'Configuration failed.'));
