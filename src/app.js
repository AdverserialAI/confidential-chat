/*
 * No message, API key, or conversation is persisted by this client. The browser
 * obtains a one-use entitlement from billing, then the quote-bound EHBP
 * receiver encrypts every request directly to the attested CVM.
 */
const state = { config: null, policy: null, proof: null, client: null, verificationOptions: null };
const $ = (id) => document.getElementById(id);
const trust = $('trust'); const summary = $('summary'); const prompt = $('prompt'); const send = $('send'); const token = $('access-token');
const canonicalModelID = (value) => /^[a-z0-9][a-z0-9._-]{0,127}\/[a-z0-9][a-z0-9._-]{0,127}$/.test(value);
const base64UrlNonce = () => { const bytes = crypto.getRandomValues(new Uint8Array(32)); let out = ''; for (const byte of bytes) out += String.fromCharCode(byte); return btoa(out).replaceAll('+', '-').replaceAll('/', '_').replace(/=+$/u, ''); };
const isRecord = (value) => typeof value === 'object' && value !== null && !Array.isArray(value);
function setTrust(kind, text) { trust.className = `state ${kind}`; trust.textContent = text; }
function addMessage(role, text) { const item=document.createElement('article'); item.className='message'; const who=document.createElement('b'); who.textContent=role; item.append(who, document.createElement('br'), document.createTextNode(text)); $('messages').append(item); }
function disablePrompt(reason) { state.proof = null; state.client = null; state.verificationOptions = null; prompt.disabled = true; send.disabled = true; setTrust('failed', 'Verification required'); summary.textContent = reason; }
function sdk() {
  const value = window.AdverserialConfidentialSDK;
  if (!value || typeof value.createVerifiedOpenAI !== 'function' || typeof value.createPhalaNVIDIAVerifier !== 'function' || typeof value.verifyInferenceReceipt !== 'function') throw new Error('The pinned browser verification SDK is unavailable. Prompts remain disabled.');
  return value;
}
function endpointOrigin(value) { const url = new URL(value); if (url.protocol !== 'https:') throw new Error('The confidential endpoint must use HTTPS.'); return url.origin; }
async function loadPolicy(model) {
  const response = await fetch(state.config.policy_url, { cache: 'no-store', credentials: 'omit', headers: { accept: 'application/json' } });
  if (!response.ok) throw new Error(`The public runtime policy returned ${response.status}.`);
  const policy = await response.json();
  if (!isRecord(policy) || policy.status !== 'active' || policy.model_id !== model) throw new Error('No active public policy matches the selected model. Prompts remain disabled.');
  if (!isRecord(policy.receipt_keys) || !Object.keys(policy.receipt_keys).length) throw new Error('The active policy has no attestation receipt keys.');
  const runtime = isRecord(policy.allowed_runtime) ? policy.allowed_runtime : null;
  const gpuCount = runtime?.minimum_gpu_count;
  if (!Number.isInteger(gpuCount) || gpuCount < 1) throw new Error('The active policy has no valid minimum GPU count.');
  return { policy, trustedReceiptKeys: policy.receipt_keys, minimumGPUCount: gpuCount };
}
async function loadConfig() {
  const response = await fetch('./config.json', {cache:'no-store'}); if (!response.ok) throw new Error('Configuration unavailable.');
  const config=await response.json();
  if (!Array.isArray(config.models) || config.models.some((m)=>!canonicalModelID(m.id)) || !/^https:\/\//.test(config.api_base_url || '') || !/^https:\/\//.test(config.billing_base_url || '') || !/^https:\/\//.test(config.policy_url || '')) throw new Error('Configuration contains an invalid model or endpoint.');
  endpointOrigin(config.api_base_url); endpointOrigin(config.billing_base_url);
  if (!Number.isInteger(config.max_output_tokens) || config.max_output_tokens < 1) throw new Error('Configuration contains an invalid output limit.');
  state.config=config; $('evidence').href=config.policy_url;
  for (const model of config.models) { const option=document.createElement('option'); option.value=model.id; option.textContent=model.label || model.id; $('model').append(option); }
}
async function verify() {
  setTrust('pending','Verifying runtime…'); summary.textContent='Checking the active policy, Intel TDX quote, NVIDIA evidence, signed attestation receipt, and quote-bound encryption key.';
  try {
    const model=$('model').value;
    const { policy, trustedReceiptKeys, minimumGPUCount } = await loadPolicy(model);
    const library = sdk();
    const verificationOptions = {
      baseURL: state.config.api_base_url,
      expectedModelId: model,
      trustedReceiptKeys,
      issuer: state.config.receipt_issuer,
      audience: state.config.receipt_audience,
      expectedEndpoint: endpointOrigin(state.config.api_base_url),
      expectedModelDigest: typeof policy.model_artifact_digest === 'string' ? policy.model_artifact_digest : undefined,
      expectedRuntimeDigest: typeof policy.runtime_image_digest === 'string' ? policy.runtime_image_digest : undefined,
      attestationUrl: state.config.attestation_url,
      verifyHardwareEvidence: library.createPhalaNVIDIAVerifier({ minimumGPUCount })
    };
    const client = await library.createVerifiedOpenAI(verificationOptions);
    if (!client.verified || !client.proof) throw new Error(client.reason || 'The independent hardware verifier did not accept the runtime evidence.');
    state.client = client; state.proof = client.proof; state.policy = policy; state.verificationOptions = verificationOptions;
    setTrust('verified', `Verified: ${client.proof.hardwareVerifier}`);
    summary.textContent=`Verified ${model}: ${client.proof.tee ?? 'TEE'}, ${client.proof.gpu ?? 'GPU evidence'}, signed policy, and an attested EHBP key. This session stores no prompt history.`;
    prompt.disabled=false; send.disabled=false;
  } catch (error) { disablePrompt(error instanceof Error ? error.message : 'Verification failed.'); }
}
async function credential() {
  if (window.AdverserialIdentityProvider?.getAccessToken) { const supplied = await window.AdverserialIdentityProvider.getAccessToken(); if (typeof supplied === 'string' && supplied) return supplied; }
  const supplied = token.value.trim(); if (!supplied) throw new Error('Enter an Adverserial API key. It remains in this browser and is sent only to billing for a one-use entitlement.'); return supplied;
}
async function entitlement(accessToken, model, requestBody) {
  const maximumInput = new TextEncoder().encode(requestBody).byteLength;
  const response = await fetch(`${state.config.billing_base_url}/cc/entitlements`, { method:'POST', credentials:'omit', headers:{authorization:`Bearer ${accessToken}`, 'content-type':'application/json', accept:'application/json'}, body:JSON.stringify({model,max_input_tokens:maximumInput,max_output_tokens:state.config.max_output_tokens,endpoint_spki_sha256:state.proof.tlsSpkiSha256}) });
  const payload = await response.json().catch(() => ({}));
  if (!response.ok || typeof payload.entitlement !== 'string' || !Number.isInteger(payload.max_output_tokens)) throw new Error(payload.detail || payload.error?.message || `Billing entitlement failed (${response.status}).`);
  return payload;
}
$('verify').addEventListener('click',verify);
$('model').addEventListener('change', () => disablePrompt('The selected model changed. Verify the runtime again.'));
$('composer').addEventListener('submit', async (event) => {
  event.preventDefault(); if (!state.proof || !state.client || state.proof.expiresEpoch <= Date.now() / 1000) { disablePrompt('The verification proof expired. Verify the runtime again.'); return; }
  const text=prompt.value.trim(); if (!text) return; const model = $('model').value; if (state.proof.modelId !== model) { disablePrompt('The selected model changed. Verify the runtime again.'); return; }
  send.disabled=true;
  try {
    const nonce = base64UrlNonce(); const draft = {model,messages:[{role:'user',content:text}],stream:false,max_tokens:state.config.max_output_tokens};
    const accessToken = await credential(); const encodedDraft = JSON.stringify(draft); const grant = await entitlement(accessToken, model, encodedDraft);
    const library = sdk();
    const client = await library.createVerifiedOpenAI({ ...state.verificationOptions, entitlement: grant.entitlement });
    if (!client.verified || !client.proof) throw new Error(client.reason || 'The verification proof could not be refreshed.');
    const body = JSON.stringify({...draft,max_tokens:grant.max_output_tokens});
    const response=await client.fetchImpl(`${state.config.api_base_url}/chat/completions`, {method:'POST',credentials:'omit',headers:{'content-type':'application/json','x-adverserial-nonce':nonce},body});
    const responseBody=await response.text(); if (!response.ok) throw new Error(`Confidential API request failed (${response.status}).`);
    const receipt=response.headers.get('x-adverserial-receipt');
    await library.verifyInferenceReceipt({receipt,receiptPublicKey:client.proof.receiptPublicKey,issuer:state.config.receipt_issuer,audience:state.config.receipt_audience,modelId:model,requestNonce:nonce,requestBody:body,responseBody,tlsSpkiSha256:client.proof.tlsSpkiSha256,attestationStateDigest:client.proof.attestationStateDigest});
    addMessage('YOU',text); prompt.value=''; token.value=''; addMessage('MODEL',JSON.parse(responseBody).choices?.[0]?.message?.content || 'No completion returned.');
  } catch(error) { addMessage('SYSTEM',error instanceof Error ? error.message : 'Request failed.'); }
  finally { send.disabled = !state.proof || state.proof.expiresEpoch <= Date.now()/1000; }
});
loadConfig().catch((error)=>disablePrompt(error instanceof Error?error.message:'Configuration failed.'));
