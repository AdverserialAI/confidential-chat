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
	$: posture = verified
		? 'ATTESTED'
		: failed
			? 'REVIEW REQUIRED'
			: simulation
				? 'LOCAL UI'
				: verificationConfig
					? 'AWAITING PROOF'
					: 'NOT CONFIGURED';

	onMount(() => {
		localPreview = ['127.0.0.1', 'localhost'].includes(window.location.hostname);
		const openCenter = () => (open = true);
		window.addEventListener('adverserial:open-verification', openCenter);
		return () => window.removeEventListener('adverserial:open-verification', openCenter);
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
	class="verification-trigger fixed bottom-5 right-5 z-[60] inline-flex min-h-12 items-center gap-3 overflow-hidden rounded-xl border border-cyan-300/30 bg-[#070b12]/95 px-3.5 py-2.5 text-left text-cyan-50 shadow-2xl shadow-cyan-950/30 backdrop-blur-xl transition hover:border-cyan-200/65 hover:bg-[#0a111b]/95 focus:outline-none focus:ring-2 focus:ring-cyan-300/80"
	on:click={() => (open = true)}
	aria-haspopup="dialog"
	aria-expanded={open}
	aria-label="Open Verification Center"
>
	<span class="verification-trigger__scan" aria-hidden="true"></span>
	<span class="relative flex size-7 items-center justify-center rounded-lg border border-cyan-300/30 bg-cyan-300/[0.08] text-cyan-200">
		<LockClosed className="size-4" strokeWidth="1.8" />
	</span>
	<span class="relative flex flex-col leading-none">
		<span class="text-[0.5625rem] font-semibold tracking-[0.2em] text-cyan-200/60">TRUST LAYER</span>
		<span class="mt-1 text-[0.6875rem] font-semibold tracking-[0.12em]">VERIFY RUNTIME</span>
	</span>
	<span class="relative ml-1 size-1.5 rounded-full {verified ? 'bg-emerald-300' : simulation ? 'bg-amber-300' : 'bg-cyan-300'} shadow-[0_0_12px_currentColor]" aria-hidden="true"></span>
</button>

{#if open}
	<div class="fixed inset-0 z-[70]" aria-live="polite">
		<button
			type="button"
			class="absolute inset-0 h-full w-full bg-[#02050a]/70 backdrop-blur-sm"
			on:click={() => (open = false)}
			aria-label="Close Verification Center"
		></button>

		<aside
			class="verification-panel absolute bottom-0 right-0 top-0 flex w-full max-w-[440px] flex-col overflow-y-auto border-l border-cyan-200/15 bg-[#070b12] text-[#edf9fb] shadow-2xl shadow-black/80"
			role="dialog"
			aria-modal="true"
			aria-labelledby="verification-center-title"
		>
			<header class="relative overflow-hidden border-b border-cyan-100/10 px-5 pb-5 pt-5">
				<div class="header-glow" aria-hidden="true"></div>
				<div class="relative flex items-start justify-between gap-4">
					<div class="flex items-center gap-3">
						<div class="verification-mark flex size-11 items-center justify-center rounded-xl border border-cyan-200/35 bg-cyan-300/[0.08] text-cyan-100">
							<DocumentCheck className="size-5" strokeWidth="1.65" />
						</div>
						<div>
							<p class="text-[0.6rem] font-semibold tracking-[0.22em] text-cyan-200/65">ADVERSERIAL // TRUST</p>
							<h2 id="verification-center-title" class="mt-1 text-lg font-semibold tracking-tight text-white">Verification Center</h2>
						</div>
					</div>
					<button
						type="button"
						class="relative flex size-9 items-center justify-center rounded-lg border border-white/10 bg-white/[0.04] text-xl leading-none text-[#b6c5ca] transition hover:border-cyan-100/30 hover:bg-cyan-100/[0.08] hover:text-white"
						on:click={() => (open = false)}
						aria-label="Close Verification Center"
					>
						×
					</button>
				</div>
				<div class="relative mt-5 flex items-center justify-between gap-3 rounded-lg border border-cyan-100/10 bg-[#05080e]/70 px-3 py-2 font-mono text-[0.625rem] tracking-[0.13em]">
					<span class="text-[#8197a0]">POSTURE</span>
					<span class="flex items-center gap-2 font-semibold {verified ? 'text-emerald-200' : failed ? 'text-rose-200' : simulation ? 'text-amber-200' : 'text-cyan-200'}"><span class="size-1.5 rounded-full bg-current shadow-[0_0_10px_currentColor]"></span>{posture}</span>
				</div>
			</header>

			<div class="verification-grid flex-1 p-4 sm:p-5">
				<section class="signal-hero relative overflow-hidden rounded-2xl border border-cyan-100/15 bg-[#09111a]/95 p-4">
					<div class="signal-hero__beam" aria-hidden="true"></div>
					<div class="relative">
						<p class="text-[0.625rem] font-semibold tracking-[0.19em] text-cyan-200/70">CONFIDENTIAL INFERENCE TRACE</p>
						<h3 class="mt-2 max-w-sm text-[1.35rem] font-semibold leading-7 tracking-tight text-white">
							{#if verified}
								Runtime receipt validated in this browser.
							{:else if failed}
								Verification did not establish trust.
							{:else if simulation}
								Review the trust interface before a runtime is connected.
							{:else if verificationConfig}
								Request a fresh receipt from the selected runtime.
							{:else}
								No confidential runtime is available for verification.
							{/if}
						</h3>
						<p class="mt-3 max-w-sm text-xs leading-5 text-[#a9bcc2]">
							{#if verified}
								The signed receipt is nonce-bound and checked against the selected model and runtime policy.
							{:else if simulation}
								This is a local visual simulation only. It does not assert encryption, an enclave, hardware attestation, or a secure endpoint.
							{:else if failed}
								{result?.reason}
							{:else}
								A verified state appears only after a live endpoint returns fresh evidence and a signed receipt that passes browser-side checks.
							{/if}
						</p>

						<div class="trace-line mt-5 grid grid-cols-[1fr_auto_1fr_auto_1fr] items-center gap-2" aria-label="Verification trace">
							<div class="trace-node"><span class="trace-node__icon">01</span><span>Browser</span></div>
							<span class="trace-link"></span>
							<div class="trace-node"><span class="trace-node__icon">02</span><span>Evidence</span></div>
							<span class="trace-link"></span>
							<div class="trace-node"><span class="trace-node__icon">03</span><span>Policy</span></div>
						</div>
					</div>
				</section>

				{#if simulation}
					<div class="mt-3 flex items-center justify-between gap-3 rounded-xl border border-amber-200/20 bg-amber-200/[0.06] px-3.5 py-3">
						<div>
							<p class="text-[0.625rem] font-semibold tracking-[0.16em] text-amber-200">LOCAL UI SIMULATION</p>
							<p class="mt-1 text-xs text-amber-50/70">Preview the interactions; no proof is created.</p>
						</div>
						<button
							type="button"
							class="rounded-lg border border-amber-100/20 bg-[#120f08]/50 px-3 py-2 text-xs font-semibold text-amber-100 transition hover:bg-amber-100/10"
							on:click={() => (showSimulatedResult = !showSimulatedResult)}
						>
							{showSimulatedResult ? 'Reset preview' : 'Preview checks'}
						</button>
					</div>
				{/if}

				<div class="mt-3 space-y-2.5">
					<section class="verification-card overflow-hidden rounded-xl border border-cyan-100/10 bg-[#0a1018]/95">
						<button class="flex w-full items-center gap-3 px-3.5 py-3.5 text-left" type="button" on:click={() => toggle('runtime')} aria-expanded={expanded === 'runtime'}>
							<div class="verification-card__icon flex size-8 shrink-0 items-center justify-center rounded-lg"><LockClosed className="size-4" strokeWidth="1.7" /></div>
							<span class="min-w-0 flex-1"><span class="block text-sm font-semibold text-[#e6fcff]">Runtime attestation</span><span class="mt-0.5 block text-[0.625rem] font-medium tracking-[0.12em] text-[#6e8992]">HARDWARE EVIDENCE + RECEIPT</span></span>
							{#if verified}<span class="state-chip state-chip--verified">VALID</span>{:else if simulation && showSimulatedResult}<span class="state-chip state-chip--preview">PREVIEW</span>{:else}<span class="state-chip">PENDING</span>{/if}
							<span class="text-sm text-[#7d969e]">{expanded === 'runtime' ? '⌃' : '⌄'}</span>
						</button>
						{#if expanded === 'runtime'}
							<div class="border-t border-cyan-100/10 px-3.5 pb-4 pt-3 text-sm leading-5 text-[#b8c9ce]">
								{#if verified}
									The browser validated the signature, nonce, audience, model binding, endpoint binding, and evidence digest. Receipt issued: {result?.status === 'verified' ? result.proof.issuedAt : '—'}.
								{:else if simulation && showSimulatedResult}
									Preview state only. A real result requires a current TEE quote and a signed receipt from the actual inference endpoint.
								{:else}
									The runtime is not considered attested until the browser receives and validates a fresh signed receipt.
								{/if}
							</div>
						{/if}
					</section>

					<section class="verification-card overflow-hidden rounded-xl border border-cyan-100/10 bg-[#0a1018]/95">
						<button class="flex w-full items-center gap-3 px-3.5 py-3.5 text-left" type="button" on:click={() => toggle('transport')} aria-expanded={expanded === 'transport'}>
							<div class="verification-card__icon flex size-8 shrink-0 items-center justify-center rounded-lg"><span class="font-mono text-xs">↗</span></div>
							<span class="min-w-0 flex-1"><span class="block text-sm font-semibold text-[#e6fcff]">Transport boundary</span><span class="mt-0.5 block text-[0.625rem] font-medium tracking-[0.12em] text-[#6e8992]">MINIMUM-DATA VERIFICATION REQUEST</span></span>
							<span class="state-chip state-chip--info">INFO</span>
							<span class="text-sm text-[#7d969e]">{expanded === 'transport' ? '⌃' : '⌄'}</span>
						</button>
						{#if expanded === 'transport'}
							<div class="border-t border-cyan-100/10 px-3.5 pb-4 pt-3 text-sm leading-5 text-[#b8c9ce]">
								A live verification request contains only a one-time browser nonce. It does not include chat content, identity, API keys, cookies, account data, prompts, or responses.
							</div>
						{/if}
					</section>

					<section class="verification-card overflow-hidden rounded-xl border border-cyan-100/10 bg-[#0a1018]/95">
						<button class="flex w-full items-center gap-3 px-3.5 py-3.5 text-left" type="button" on:click={() => toggle('build')} aria-expanded={expanded === 'build'}>
							<div class="verification-card__icon flex size-8 shrink-0 items-center justify-center rounded-lg"><DocumentCheck className="size-4" strokeWidth="1.7" /></div>
							<span class="min-w-0 flex-1"><span class="block text-sm font-semibold text-[#e6fcff]">Model policy binding</span><span class="mt-0.5 block text-[0.625rem] font-medium tracking-[0.12em] text-[#6e8992]">MODEL, ENDPOINT + ARTIFACT POLICY</span></span>
							{#if verified}<span class="state-chip state-chip--verified">BOUND</span>{:else if simulation && showSimulatedResult}<span class="state-chip state-chip--preview">PREVIEW</span>{:else}<span class="state-chip">PENDING</span>{/if}
							<span class="text-sm text-[#7d969e]">{expanded === 'build' ? '⌃' : '⌄'}</span>
						</button>
						{#if expanded === 'build'}
							<div class="border-t border-cyan-100/10 px-3.5 pb-4 pt-3 text-sm leading-5 text-[#b8c9ce]">
								A valid receipt must bind the configured model and inference endpoint. Published model-artifact and runtime-policy digests can be checked independently when present.
							</div>
						{/if}
					</section>
				</div>

				{#if verificationConfig}
					<div class="mt-4 flex gap-2">
						<button type="button" class="verify-now inline-flex flex-1 items-center justify-center gap-2 rounded-xl px-3 py-3 text-sm font-semibold disabled:cursor-not-allowed disabled:opacity-60" disabled={verifying} on:click={verify}>
							{#if verifying}<Spinner className="size-4" />{:else}<DocumentCheck className="size-4" strokeWidth="1.75" />{/if}
							{verifying ? 'Checking proof…' : 'Verify live runtime'}
						</button>
						<a href={verificationConfig.verificationUrl} target="_blank" rel="noopener noreferrer" class="inline-flex items-center justify-center rounded-xl border border-cyan-100/20 px-3 py-2.5 text-sm font-medium text-cyan-50 transition hover:bg-cyan-100/[0.08]">Details</a>
					</div>
				{:else}
					<a href="https://verify.adverserial.ai" target="_blank" rel="noopener noreferrer" class="mt-4 inline-flex w-full items-center justify-center rounded-xl border border-cyan-100/20 bg-cyan-100/[0.03] px-3 py-3 text-sm font-semibold text-cyan-50 transition hover:border-cyan-100/35 hover:bg-cyan-100/[0.08]">Open verification center</a>
				{/if}
			</div>
		</aside>
	</div>
{/if}

<style>
	.verification-panel {
		background-image:
			linear-gradient(180deg, rgb(6 10 18 / 0.9), rgb(7 11 18 / 1) 22%),
			radial-gradient(circle at 100% 0%, rgb(34 211 238 / 0.09), transparent 33%);
	}

	.verification-grid {
		background-image:
			linear-gradient(rgb(77 116 129 / 0.08) 1px, transparent 1px),
			linear-gradient(90deg, rgb(77 116 129 / 0.08) 1px, transparent 1px);
		background-size: 18px 18px;
	}

	.verification-trigger__scan {
		position: absolute;
		inset: 0;
		opacity: 0.42;
		background: linear-gradient(115deg, transparent 12%, rgb(103 232 249 / 0.16) 46%, transparent 62%);
		transform: translateX(-130%);
		animation: verification-scan 4.5s ease-in-out infinite;
	}

	.header-glow {
		position: absolute;
		right: -60px;
		top: -85px;
		size: 230px;
		border-radius: 999px;
		background: radial-gradient(circle, rgb(34 211 238 / 0.2), transparent 66%);
		filter: blur(8px);
	}

	.verification-mark,
	.verification-card__icon {
		box-shadow: inset 0 0 18px rgb(34 211 238 / 0.08), 0 0 20px rgb(34 211 238 / 0.05);
	}

	.signal-hero {
		box-shadow: inset 0 1px rgb(207 250 254 / 0.05), 0 20px 45px rgb(0 0 0 / 0.18);
	}

	.signal-hero__beam {
		position: absolute;
		inset: 0;
		background:
			linear-gradient(102deg, transparent 28%, rgb(34 211 238 / 0.11) 50%, transparent 72%),
			radial-gradient(circle at 80% 35%, rgb(45 212 191 / 0.1), transparent 30%);
		pointer-events: none;
	}

	.trace-node {
		display: flex;
		min-width: 0;
		flex-direction: column;
		align-items: center;
		gap: 0.35rem;
		color: rgb(144 177 186);
		font-family: ui-monospace, SFMono-Regular, Menlo, monospace;
		font-size: 0.56rem;
		letter-spacing: 0.08em;
		text-transform: uppercase;
	}

	.trace-node__icon {
		display: flex;
		size: 1.75rem;
		align-items: center;
		justify-content: center;
		border: 1px solid rgb(103 232 249 / 0.32);
		border-radius: 0.45rem;
		background: rgb(8 47 73 / 0.26);
		color: rgb(207 250 254);
		font-size: 0.58rem;
	}

	.trace-link {
		height: 1px;
		background: linear-gradient(90deg, rgb(34 211 238 / 0.12), rgb(103 232 249 / 0.76), rgb(34 211 238 / 0.12));
		box-shadow: 0 0 9px rgb(34 211 238 / 0.28);
	}

	.verification-card {
		box-shadow: inset 0 1px rgb(255 255 255 / 0.025);
	}

	.verification-card__icon {
		border: 1px solid rgb(103 232 249 / 0.2);
		background: rgb(14 116 144 / 0.13);
		color: rgb(165 243 252);
	}

	.state-chip {
		border: 1px solid rgb(148 163 184 / 0.25);
		border-radius: 999px;
		padding: 0.22rem 0.42rem;
		color: rgb(148 163 184);
		font-size: 0.56rem;
		font-weight: 700;
		letter-spacing: 0.12em;
	}

	.state-chip--verified {
		border-color: rgb(110 231 183 / 0.35);
		background: rgb(16 185 129 / 0.08);
		color: rgb(167 243 208);
	}

	.state-chip--preview {
		border-color: rgb(253 230 138 / 0.3);
		background: rgb(245 158 11 / 0.08);
		color: rgb(253 230 138);
	}

	.state-chip--info {
		border-color: rgb(103 232 249 / 0.24);
		color: rgb(165 243 252);
	}

	.verify-now {
		background: linear-gradient(135deg, rgb(165 243 252), rgb(45 212 191));
		color: rgb(6 32 40);
		box-shadow: 0 8px 24px rgb(34 211 238 / 0.16);
	}

	.verify-now:hover {
		filter: brightness(1.06);
	}

	@keyframes verification-scan {
		0%, 46% { transform: translateX(-130%); }
		74%, 100% { transform: translateX(140%); }
	}

	@media (prefers-reduced-motion: reduce) {
		.verification-trigger__scan { animation: none; }
	}
</style>
