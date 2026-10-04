# Adverserial confidential chat

A static, externally hosted chat client for Adverserial confidential inference.
It is intentionally **not** served by the inference CVM and has no model
volume, dstack socket, billing secret, or server-side prompt handling.

## Security contract

- Model IDs must be canonical `publisher/model` values, such as
  `lordx64/cyberglm` and `lordx64/cyberkimi`.
- The client fails closed: it disables prompt submission until an independent
  browser hardware verifier accepts fresh evidence and policy.
- `window.AdverserialHardwareVerifier` is an explicit integration point for a
  reviewed browser verifier. It must verify the raw TDX/GPU evidence, policy,
  TLS binding, and endpoint before returning `{ verified: true, verifier, receipt }`.
- `npm run build` creates a content manifest for every emitted asset;
  `npm run verify-dist` verifies it. Release provenance and signatures are
  published by the release workflow.
- Static delivery is separate from `cc-api.adverserial.ai`, whose TLS endpoint
  and attest-proxy remain inside the CVM.

This repository is not a claim that browser JavaScript alone provides a
hardware root of trust. For strongest assurance, use the independently
verifying official SDK or a signed browser extension as the bootstrap.

## Build

```sh
npm run build
npm run verify-dist
```

Copy `src/config.example.json` to `src/config.json` for a deployment. Do not
put API keys, model weights, private addresses, or credentials in this
repository or static configuration.

## Proving a deployed bundle

Each build emits `build-info.json`, also served at
`/.well-known/adverserial-build.json`. It names the public source commit and
the SHA-256 of the full asset-integrity manifest. A release workflow publishes
the matching archive with GitHub artifact attestation. A native SDK or signed
browser extension can fetch this record, validate the GitHub provenance, then
hash every loaded asset before it trusts the UI. A normal browser page cannot
establish this bootstrap trust by itself; it has already executed its first
JavaScript before it can perform the check.

## Security

Please report security vulnerabilities privately to [security@adverserial.ai](mailto:security@adverserial.ai). Do not open a public issue for a suspected vulnerability.
