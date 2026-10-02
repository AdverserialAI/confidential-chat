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

	type Section = 'runtime' | 'transport' | 'build';
	type VerifiableModel = { id?: string; name?: string; info?: { meta?: Record<string, unknown> } };

	let open = false;
	let expanded: Section | null = 'runtime';
	let localPreview = false;
	let showSimulatedResult = false;
	let verifying = false;
	let result: VerificationResult | null = null;

	$: model = (($models ?? []).find((candidate) =>
		confidentialVerificationConfig(candidate as VerifiableModel)
	) ?? null) as VerifiableModel | null;
	$: verificationConfig = confidentialVerificationConfig(model);
	$: simulation = localPreview && !verificationConfig;
	$: verified = result?.status === 'verified';
	$: failed = result?.status === 'failed';

	onMount(() => {
		localPreview = ['127.0.0.1', 'localhost'].includes(window.location.hostname);
	});

	const toggle = (section: Section) => {
		expanded = expanded === section ? null : section;
	};

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
	class="fixed bottom-4 right-4 z-[60] inline-flex min-h-11 items-center gap-2 rounded-xl border border-emerald-400/25 bg-[#15191a] px-3.5 py-2.5 text-sm font-medium text-emerald-200 shadow-xl shadow-black/30 transition hover:border-emerald-300/60 hover:bg-[#1b2021] focus:outline-none focus:ring-2 focus:ring-emerald-300/80 dark:text-emerald-200"
	on:click={() => (open = true)}
	aria-haspopup="dialog"
	aria-expanded={open}
	aria-label="Open Verification Center"
>
	<LockClosed className="size-4" strokeWidth="1.75" />
	<span>Verification</span>
</button>

{#if open}
	<div class="fixed inset-0 z-[70]" aria-live="polite">
		<button
			type="button"
			class="absolute inset-0 h-full w-full bg-black/55 backdrop-blur-[1px]"
			on:click={() => (open = false)}
			aria-label="Close Verification Center"
		></button>

		<aside
			class="verification-panel absolute bottom-0 right-0 top-0 flex w-full max-w-[395px] flex-col overflow-y-auto border-l border-white/10 bg-[#121516] text-[#eff3f1] shadow-2xl shadow-black/60"
			role="dialog"
			aria-modal="true"
			aria-labelledby="verification-center-title"
		>
			<header class="flex items-center justify-between border-b border-white/10 px-5 py-4">
				<div class="flex items-center gap-3">
					<div class="flex size-10 items-center justify-center rounded-xl border border-emerald-300/30 bg-emerald-400/10 text-emerald-200">
						<DocumentCheck className="size-5" strokeWidth="1.7" />
					</div>
					<div>
						<h2 id="verification-center-title" class="text-base font-semibold tracking-tight">Verification Center</h2>
						<p class="mt-0.5 text-xs text-[#9da9a5]">Adverserial AI</p>
					</div>
				</div>
				<button
					type="button"
					class="flex size-9 items-center justify-center rounded-xl border border-white/10 bg-white/[0.06] text-xl leading-none text-[#b8c2bf] transition hover:bg-white/[0.12] hover:text-white"
					on:click={() => (open = false)}
					aria-label="Close Verification Center"
				>
					×
				</button>
			</header>

			<div class="verification-grid flex-1 p-4">
				<section
					class="rounded-2xl border px-4 py-4 {verified
						? 'border-emerald-300/45 bg-emerald-400/[0.08]'
						: failed
							? 'border-rose-300/45 bg-rose-400/[0.08]'
							: 'border-emerald-300/25 bg-emerald-400/[0.05]'}"
				>
					<p class="text-sm font-medium leading-5 {failed ? 'text-rose-200' : 'text-emerald-200'}">
						{#if verified}
							A fresh attestation receipt was verified in this browser.
						{:else if failed}
							The latest attestation check did not verify.
						{:else if simulation}
							Local simulation — this panel does not make a security claim.
						{:else if verificationConfig}
							Ready to request a fresh hardware-attestation receipt.
						{:else}
							No confidential runtime is configured for an active model.
						{/if}
					</p>
					<p class="mt-2 text-xs leading-5 text-[#b7c2be]">
						{#if verified}
							The receipt binds a one-time browser nonce, the evidence returned by the endpoint, and the expected model and runtime policy.
						{:else if simulation}
							Use this preview to review the interface. It never sends prompts, responses, API keys, cookies, or account data.
						{:else if failed}
							{result?.reason}
						{:else}
							This center will show a verified result only after the configured endpoint returns valid signed attestation evidence.
						{/if}
					</p>
				</section>

				{#if simulation}
					<div class="mt-3 flex items-center justify-between rounded-xl border border-sky-300/20 bg-sky-300/[0.06] px-3 py-2.5">
						<span class="text-xs font-medium text-sky-100">LOCAL UI SIMULATION</span>
						<button
							type="button"
							class="rounded-lg border border-sky-200/25 px-2.5 py-1 text-xs font-medium text-sky-100 transition hover:bg-sky-200/10"
							on:click={() => (showSimulatedResult = !showSimulatedResult)}
						>
							{showSimulatedResult ? 'Reset preview' : 'Preview checks'}
						</button>
					</div>
				{/if}

				<div class="mt-3 space-y-2">
					<section class="overflow-hidden rounded-2xl border border-white/10 bg-[#171b1c]/90">
						<button class="flex w-full items-center gap-3 px-4 py-3.5 text-left" type="button" on:click={() => toggle('runtime')} aria-expanded={expanded === 'runtime'}>
							<div class="flex size-8 shrink-0 items-center justify-center rounded-lg bg-emerald-400/10 text-emerald-200"><LockClosed className="size-4" strokeWidth="1.7" /></div>
							<span class="min-w-0 flex-1 text-sm font-medium text-emerald-200">Runtime attestation</span>
							{#if verified || (simulation && showSimulatedResult)}<CheckCircle className="size-5 text-emerald-200" strokeWidth="1.8" />{:else}<span class="rounded-full border border-white/15 px-2 py-0.5 text-[0.625rem] font-medium text-[#aeb9b5]">{verificationConfig ? 'READY' : 'PENDING'}</span>{/if}
							<span class="ml-1 text-sm text-[#9da9a5]">{expanded === 'runtime' ? '⌃' : '⌄'}</span>
						</button>
						{#if expanded === 'runtime'}
							<div class="border-t border-white/10 px-4 pb-4 pt-3 text-sm leading-5 text-[#cbd4d0]">
								{#if verified}
									This browser validated the signed receipt against the configured public key and policy. Receipt issued: {result?.status === 'verified' ? result.proof.issuedAt : '—'}.
								{:else if simulation && showSimulatedResult}
									Preview state only. A production check needs a fresh TEE quote and a signed receipt from the actual inference endpoint.
								{:else}
									A hardware runtime is not treated as isolated until a fresh signed receipt validates in this browser.
								{/if}
							</div>
						{/if}
					</section>

					<section class="overflow-hidden rounded-2xl border border-white/10 bg-[#171b1c]/90">
						<button class="flex w-full items-center gap-3 px-4 py-3.5 text-left" type="button" on:click={() => toggle('transport')} aria-expanded={expanded === 'transport'}>
							<div class="flex size-8 shrink-0 items-center justify-center rounded-lg bg-emerald-400/10 text-emerald-200"><span class="text-sm">⌁</span></div>
							<span class="min-w-0 flex-1 text-sm font-medium text-emerald-200">Transport and data boundary</span>
							{#if simulation && showSimulatedResult}<CheckCircle className="size-5 text-emerald-200" strokeWidth="1.8" />{:else}<span class="rounded-full border border-white/15 px-2 py-0.5 text-[0.625rem] font-medium text-[#aeb9b5]">INFO</span>{/if}
							<span class="ml-1 text-sm text-[#9da9a5]">{expanded === 'transport' ? '⌃' : '⌄'}</span>
						</button>
						{#if expanded === 'transport'}
							<div class="border-t border-white/10 px-4 pb-4 pt-3 text-sm leading-5 text-[#cbd4d0]">
								This verification panel sends only a fresh nonce when you run a live check. It does not send the chat, user identity, API key, cookies, or account data.
							</div>
						{/if}
					</section>

					<section class="overflow-hidden rounded-2xl border border-white/10 bg-[#171b1c]/90">
						<button class="flex w-full items-center gap-3 px-4 py-3.5 text-left" type="button" on:click={() => toggle('build')} aria-expanded={expanded === 'build'}>
							<div class="flex size-8 shrink-0 items-center justify-center rounded-lg bg-emerald-400/10 text-emerald-200"><DocumentCheck className="size-4" strokeWidth="1.7" /></div>
							<span class="min-w-0 flex-1 text-sm font-medium text-emerald-200">Model and runtime policy</span>
							{#if verified || (simulation && showSimulatedResult)}<CheckCircle className="size-5 text-emerald-200" strokeWidth="1.8" />{:else}<span class="rounded-full border border-white/15 px-2 py-0.5 text-[0.625rem] font-medium text-[#aeb9b5]">PENDING</span>{/if}
							<span class="ml-1 text-sm text-[#9da9a5]">{expanded === 'build' ? '⌃' : '⌄'}</span>
						</button>
						{#if expanded === 'build'}
							<div class="border-t border-white/10 px-4 pb-4 pt-3 text-sm leading-5 text-[#cbd4d0]">
								A verified receipt must bind the expected model ID and endpoint. When published, it can also bind model-artifact and runtime-policy digests for independent inspection.
							</div>
						{/if}
					</section>
				</div>

				{#if verificationConfig}
					<div class="mt-4 flex gap-2">
						<button type="button" class="inline-flex flex-1 items-center justify-center gap-2 rounded-xl bg-emerald-300 px-3 py-2.5 text-sm font-semibold text-[#10201b] transition hover:bg-emerald-200 disabled:cursor-not-allowed disabled:opacity-60" disabled={verifying} on:click={verify}>
							{#if verifying}<Spinner className="size-4" />{:else}<DocumentCheck className="size-4" strokeWidth="1.75" />{/if}
							{verifying ? 'Checking proof…' : 'Verify now'}
						</button>
						<a href={verificationConfig.verificationUrl} target="_blank" rel="noopener noreferrer" class="inline-flex items-center justify-center rounded-xl border border-white/15 px-3 py-2.5 text-sm font-medium text-white transition hover:bg-white/[0.08]">Details</a>
					</div>
				{:else}
					<a href="https://verify.adverserial.ai" target="_blank" rel="noopener noreferrer" class="mt-4 inline-flex w-full items-center justify-center rounded-xl border border-white/15 px-3 py-2.5 text-sm font-medium text-white transition hover:bg-white/[0.08]">Open verification center</a>
				{/if}
			</div>
		</aside>
	</div>
{/if}

<style>
	.verification-grid {
		background-image: radial-gradient(circle at 1px 1px, rgb(94 112 105 / 20%) 1px, transparent 0);
		background-size: 5px 5px;
	}
</style>
