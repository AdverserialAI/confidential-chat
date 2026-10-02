<script lang="ts">
	import { onMount } from 'svelte';
	import { models } from '$lib/stores';
	import LockClosed from '$lib/components/icons/LockClosed.svelte';
	import CheckCircle from '$lib/components/icons/CheckCircle.svelte';
	import DocumentCheck from '$lib/components/icons/DocumentCheck.svelte';
	import Spinner from '$lib/components/common/Spinner.svelte';
	import {
		confidentialVerificationConfig,
		verifyConfidentialEndpoint,
		type VerificationResult
	} from '$lib/confidential/verification';

	type VerifiableModel = { id?: string; name?: string; info?: { meta?: Record<string, unknown> } };

	let open = false;
	let localPreview = false;
	let showPreviewProof = false;
	let verifying = false;
	let result: VerificationResult | null = null;

	$: model = (($models ?? []).find((candidate) =>
		confidentialVerificationConfig(candidate as VerifiableModel)
	) ?? null) as VerifiableModel | null;
	$: verificationConfig = confidentialVerificationConfig(model);
	$: simulation = localPreview && !verificationConfig;
	$: verified = result?.status === 'verified';
	$: failed = result?.status === 'failed';
	$: statusLabel = verified ? 'Verified' : failed ? 'Check failed' : simulation ? 'Local preview' : verificationConfig ? 'Ready to verify' : 'Not configured';

	onMount(() => {
		localPreview = ['127.0.0.1', 'localhost'].includes(window.location.hostname);
		const openCenter = () => (open = true);
		window.addEventListener('adverserial:open-verification', openCenter);
		return () => window.removeEventListener('adverserial:open-verification', openCenter);
	});

	const verify = async () => {
		if (!verificationConfig || verifying) return;
		verifying = true;
		result = await verifyConfidentialEndpoint(verificationConfig);
		verifying = false;
	};
</script>

<svelte:window
	on:keydown={(event) => {
		if (event.key === 'Escape') open = false;
	}}
/>

<button
	type="button"
	class="verify-fab fixed bottom-5 right-5 z-[60] inline-flex items-center gap-2 rounded-full border border-[#3a424e] bg-[#202224]/95 px-3 py-2 text-xs font-medium text-[#edf0f5] shadow-2xl shadow-black/40 transition hover:border-[#91b5a4]/50 hover:bg-[#282e38] focus:outline-none focus:ring-2 focus:ring-[#91b5a4]/60"
	on:click={() => (open = true)}
	aria-haspopup="dialog"
	aria-expanded={open}
	aria-label="Open Verification Center"
>
	<span class="relative flex size-5 items-center justify-center rounded-full border border-[#91b5a4]/35 bg-[#91b5a4]/10 text-[#b9d5c8]"><LockClosed className="size-3" strokeWidth="2" /></span>
	<span class="tracking-[0.08em]">VERIFY</span>
	<span class="size-1.5 rounded-full {verified ? 'bg-[#91b5a4]' : simulation ? 'bg-[#aaaeb3]' : 'bg-[#91b5a4]'}" aria-hidden="true"></span>
</button>

{#if open}
	<div class="fixed inset-0 z-[70] flex items-center justify-center p-4 sm:p-8" aria-live="polite">
		<button
			type="button"
			class="absolute inset-0 h-full w-full bg-black/75"
			on:click={() => (open = false)}
			aria-label="Close Verification Center"
		></button>

		<aside
			class="verification-modal relative max-h-full w-full max-w-[700px] overflow-y-auto rounded-2xl border border-[#3a424e] bg-[#202224] text-[#edf0f5] shadow-2xl shadow-black/70"
			role="dialog"
			aria-modal="true"
			aria-labelledby="verification-center-title"
		>
			<header class="flex items-start justify-between gap-5 border-b border-[#343a44] px-6 py-5 sm:px-7">
				<div>
					<p class="text-[0.625rem] font-medium tracking-[0.15em] text-[#b9d5c8]">ADVERSERIAL AI · RUNTIME VERIFICATION</p>
					<h2 id="verification-center-title" class="mt-2 text-xl font-semibold tracking-tight text-white">Privacy should be verifiable.</h2>
				</div>
				<button
					type="button"
					class="flex size-8 shrink-0 items-center justify-center rounded-md text-lg text-[#a7b1c0] transition hover:bg-white/[0.06] hover:text-white"
					on:click={() => (open = false)}
					aria-label="Close Verification Center"
				>
					×
				</button>
			</header>

			<div class="verification-grid px-6 pb-6 pt-5 sm:px-7 sm:pb-7">
				<section class="max-w-[580px]">
					<p class="text-[0.95rem] leading-7 text-[#cbd2dd]">
						{#if verified}
							This browser verified a fresh signed attestation receipt for the configured model and runtime policy.
						{:else if failed}
							The latest verification attempt did not establish a trusted runtime. Review the result before sending sensitive work.
						{:else if simulation}
							This local preview shows how users will inspect runtime evidence once a confidential inference endpoint is connected.
						{:else if verificationConfig}
							A browser-side check can request fresh hardware evidence and verify that its signed receipt matches this model and endpoint.
						{:else}
							No active model currently publishes confidential-runtime verification metadata.
						{/if}
					</p>
					{#if simulation}
						<p class="mt-3 rounded-lg border border-[#3a424e] bg-[#1b1d1f] px-3 py-2.5 text-xs leading-5 text-[#a7b1c0]">
							<strong class="font-semibold text-[#edf0f5]">Local UI simulation.</strong> This page does not make a claim about encryption, an enclave, hardware attestation, or a secure inference endpoint.
						</p>
					{:else if failed}
						<p class="mt-3 rounded-lg border border-[#6e4e4e] bg-[#2a1c1d] px-3 py-2.5 text-xs leading-5 text-[#f0c4c4]">{result?.reason}</p>
					{/if}
				</section>

				<section class="proof-map mt-6 rounded-xl border border-dashed border-[#626870] bg-[#1b1d1f]/70 p-4 sm:p-5" aria-label="Runtime verification path">
					<div class="proof-map__label"><span><CheckCircle className="size-3.5" strokeWidth="1.9" /></span> ATTESTATION PATH</div>
					<div class="proof-map__stage relative mt-5 min-h-[225px] sm:min-h-[205px]">
						<div class="proof-card proof-card--browser">
							<div class="proof-card__title"><span class="proof-card__icon">⌁</span> Browser verifier</div>
							<p>Creates a one-time nonce and checks the signed receipt locally.</p>
						</div>

						<div class="proof-card proof-card--receipt">
							<div class="proof-card__title"><span class="proof-card__icon">▣</span> Attestation receipt</div>
							<p>Must bind fresh evidence, the expected model, endpoint, and runtime policy.</p>
						</div>

						<div class="proof-card proof-card--runtime">
							<div class="proof-card__title"><LockClosed className="size-3.5 text-[#a1c4b3]" strokeWidth="2" /> Configured runtime</div>
							<p>{verified ? 'Receipt verified in this browser.' : simulation ? 'No live endpoint in this preview.' : 'Waiting for a live verification response.'}</p>
						</div>

						<span class="proof-line proof-line--one" aria-hidden="true"></span>
						<span class="proof-line proof-line--two" aria-hidden="true"></span>
						<span class="proof-line proof-line--three" aria-hidden="true"></span>
					</div>
				</section>

				<div class="mt-5 grid gap-2 sm:grid-cols-3">
					<div class="assurance-card"><LockClosed className="size-4 text-[#a1c4b3]" strokeWidth="1.8" /><div><strong>Runtime isolation</strong><span>{verified ? 'Receipt validated' : 'Evidence required'}</span></div></div>
					<div class="assurance-card"><span class="text-sm text-[#a1c4b3]">↗</span><div><strong>Data boundary</strong><span>Nonce-only check</span></div></div>
					<div class="assurance-card"><DocumentCheck className="size-4 text-[#a1c4b3]" strokeWidth="1.8" /><div><strong>Code identity</strong><span>Policy-bound receipt</span></div></div>
				</div>

				<div class="mt-6 flex flex-wrap items-center justify-between gap-3 border-t border-[#343a44] pt-5">
					<div class="flex items-center gap-2 text-xs text-[#a7b1c0]">
						<span class="size-1.5 rounded-full {verified ? 'bg-[#91b5a4]' : failed ? 'bg-[#dd8888]' : 'bg-[#8a8d92]'}"></span>
						<span>{statusLabel}</span>
					</div>
					{#if simulation}
						<button type="button" class="verify-action" on:click={() => (showPreviewProof = !showPreviewProof)}>{showPreviewProof ? 'Reset preview' : 'Preview proof state'}</button>
					{:else if verificationConfig}
						<div class="flex gap-2">
							<button type="button" class="verify-action" disabled={verifying} on:click={verify}>{#if verifying}<Spinner className="size-3.5" />{/if}{verifying ? 'Checking…' : 'Verify runtime'}</button>
							<a href={verificationConfig.verificationUrl} target="_blank" rel="noopener noreferrer" class="verify-secondary">Details</a>
						</div>
					{:else}
						<a href="https://verify.adverserial.ai" target="_blank" rel="noopener noreferrer" class="verify-secondary">Open verification center</a>
					{/if}
				</div>

				{#if simulation && showPreviewProof}
					<div class="mt-3 rounded-lg border border-[#668775] bg-[#303640] px-3 py-2.5 text-xs leading-5 text-[#e5ebf2]">
						<strong class="font-semibold">Preview state only.</strong> A production result appears only after this browser validates a fresh hardware-attestation receipt; this button does not create one.
					</div>
				{/if}
			</div>
		</aside>
	</div>
{/if}

<style>
	.verification-modal { background-image: linear-gradient(rgb(255 255 255 / 0.012) 1px, transparent 1px), linear-gradient(90deg, rgb(255 255 255 / 0.012) 1px, transparent 1px); background-size: 18px 18px; }
	.verification-grid { background: linear-gradient(180deg, rgb(255 255 255 / 0.012), transparent 55%); }
	.proof-map { position: relative; }
	.proof-map__label { position: absolute; display: inline-flex; align-items: center; gap: 0.4rem; margin-top: -1.75rem; margin-left: 0.55rem; border: 1px solid #668775; border-radius: 0.35rem; background: #303640; padding: 0.35rem 0.55rem; color: #b9d5c8; font-size: 0.7rem; font-weight: 600; letter-spacing: 0.05em; }
	.proof-map__stage { display: grid; grid-template-columns: minmax(0, 0.78fr) minmax(0, 1.15fr); grid-template-rows: 1fr 1fr; gap: 1rem; align-items: center; }
	.proof-card { position: relative; z-index: 1; border: 1px solid #3a424e; border-radius: 0.5rem; background: #282e38; padding: 0.85rem; box-shadow: 0 10px 25px rgb(0 0 0 / 0.15); }
	.proof-card p { margin: 0.4rem 0 0; color: #a7b1c0; font-size: 0.75rem; line-height: 1.35rem; }
	.proof-card__title { display: flex; align-items: center; gap: 0.45rem; color: #f1f2f3; font-size: 0.82rem; font-weight: 600; }
	.proof-card__icon { color: #a1c4b3; }
	.proof-card--browser { grid-row: 2; }
	.proof-card--receipt { grid-column: 2; grid-row: 1 / span 2; align-self: center; }
	.proof-card--runtime { grid-column: 2; grid-row: 2; width: 82%; justify-self: end; border-color: #668775; background: #282e38; }
	.proof-line { position: absolute; z-index: 0; border-color: #758090; border-style: dashed; opacity: 0.75; }
	.proof-line--one { left: 20%; top: 27%; width: 51%; border-top-width: 1px; }
	.proof-line--two { left: 20%; top: 28%; height: 45%; width: 50%; border-bottom-width: 1px; border-left-width: 1px; }
	.proof-line--three { left: 20%; bottom: 23%; width: 56%; border-top-width: 1px; }
	.assurance-card { display: flex; min-height: 4.75rem; align-items: flex-start; gap: 0.65rem; border: 1px solid #343a44; border-radius: 0.6rem; background: #282e38; padding: 0.85rem; }
	.assurance-card strong { display: block; color: #edf0f5; font-size: 0.75rem; font-weight: 600; }
	.assurance-card span { display: block; margin-top: 0.25rem; color: #a7b1c0; font-size: 0.68rem; }
	.verify-action, .verify-secondary { display: inline-flex; min-height: 2.25rem; align-items: center; justify-content: center; gap: 0.4rem; border-radius: 0.5rem; padding: 0.5rem 0.85rem; font-size: 0.78rem; font-weight: 600; transition: background-color 150ms ease, border-color 150ms ease; }
	.verify-action { border: 1px solid #668775; background: #475f53; color: #e5ebf2; }
	.verify-action:hover { background: #496d5c; }
	.verify-action:disabled { cursor: not-allowed; opacity: 0.6; }
	.verify-secondary { border: 1px solid #3a424e; color: #edf0f5; }
	.verify-secondary:hover { border-color: #626870; background: rgb(255 255 255 / 0.05); }
	@media (max-width: 520px) { .proof-map__stage { grid-template-columns: 1fr; grid-template-rows: auto; } .proof-card--browser, .proof-card--receipt, .proof-card--runtime { grid-column: auto; grid-row: auto; width: auto; justify-self: auto; } .proof-line { display: none; } }
</style>
