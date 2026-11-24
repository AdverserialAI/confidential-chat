# Adverserial confidential chat

> **This repository is not the chat that is deployed.**
> <https://chat.adverserial.ai> is built from
> **[confidential-open-webui](https://github.com/AdverserialAI/confidential-open-webui)**.
> This repository is the earlier lightweight static client. It was last changed
> on 2026-10-15, is not deployed, and is kept for reference. What is out of
> date here:
>
> - It defaults to the model `lordx64/cyberglm`. Production serves
>   `adverserial/cyberseek`.
> - It sends ciphertext through a same-origin relay (`server.mjs`). The
>   deployed chat sends ciphertext from the browser directly to
>   `api.adverserial.ai`.
> - No release has ever been tagged, so the release workflow has never run and
>   there is no published archive, provenance attestation or signature for
>   this client.

> This project is based on [Open WebUI](https://github.com/open-webui/open-webui). It is an independent Adverserial AI derivative and is not affiliated with or endorsed by Open WebUI.

A static, externally hosted chat client for Adverserial confidential inference.
It is intentionally **not** served by the inference CVM and has no model
volume, dstack socket, billing secret, or server-side prompt handling.

## Security contract

- Model IDs must be canonical `publisher/model` values. The code and example
  configuration here use `lordx64/cyberglm`; the model in production is
  `adverserial/cyberseek`.
- The client fails closed: it disables prompt submission until an independent
  browser hardware verifier accepts fresh evidence and policy.
- `window.AdverserialHardwareVerifier` is an explicit integration point for a
  reviewed browser verifier or signed extension. It must verify the raw TDX/GPU
  evidence, published policy, TLS binding, and endpoint before returning the
  attested receipt P-256 public JWK, TLS SPKI hash, attestation-state digest,
  expiry, and `{ verified: true, verifier }`.
- A user credential stays in memory only and is sent directly to billing for a
  one-use, model-scoped entitlement. The chat sends the entitlement—not the
  raw credential—to a same-origin ciphertext relay. The relay permits only an
  EHBP-encrypted completion request to the configured attested endpoint and
  never has an EHBP private key, so it cannot decrypt prompts or completions.
  Every non-streaming response must carry a signed
  `X-Adverserial-Receipt`; the UI verifies its signature plus request hash,
  response hash, nonce, model, TLS SPKI, and attestation-state binding before
  showing the completion.
- `npm run build` creates a content manifest for every emitted asset;
  `npm run verify-dist` verifies it. The release workflow would attach GitHub
  build provenance to a tagged archive; no tag has been pushed, so none
  exists.
- Static delivery is separate from `api.adverserial.ai`, whose TLS endpoint
  and attest-proxy remain inside the CVM.

This repository is not a claim that browser JavaScript alone provides a
hardware root of trust. For stronger assurance, bootstrap from a locally
installed client such as
[ACK](https://github.com/AdverserialAI/adverserial-confidential-kit). There is
no signed browser extension.

## Build

```sh
npm run build
npm run verify-dist
```

Copy `src/config.example.json` to `src/config.json` for a deployment. The
static host supplies endpoints and limits only; it must not contain API keys,
model weights, private addresses, credentials, or an entitlement signing key.
The browser must be allowed to reach billing, `api`, `verify`,
`https://pccs.phala.network` (Intel TDX collateral), and
`https://nras.attestation.nvidia.com` (NVIDIA EAT signing keys) by CSP and
CORS. These are explicit, pinned trust-chain origins—not general network
access. Set `CC_MODELS_JSON` to the canonical model IDs contained in the active
endpoint policy; the default exposes only `lordx64/cyberglm`.

## Proving a deployed bundle

Each build emits `build-info.json`, also served at
`/.well-known/adverserial-build.json`. It names the public source commit and
the SHA-256 of the full asset-integrity manifest. The release workflow is
written to publish the matching archive with GitHub artifact attestation on a
version tag; it has not been used. A native client could fetch this record,
validate the provenance, then hash every loaded asset before it trusts the UI. A normal browser page cannot
establish this bootstrap trust by itself; it has already executed its first
JavaScript before it can perform the check.

## Security

Please report security vulnerabilities privately to [security@adverserial.ai](mailto:security@adverserial.ai). Do not open a public issue for a suspected vulnerability.

Build provenance is generated from the immutable deployment commit supplied at build time; the browser verifies the bundled SDK against its committed source hash.

## Licensing

This repository retains the upstream Open WebUI license and attribution in
[`LICENSE`](./LICENSE). Adverserial does not grant rights beyond the rights
already supplied by that upstream license. Third-party material, where present,
remains under its own terms.
