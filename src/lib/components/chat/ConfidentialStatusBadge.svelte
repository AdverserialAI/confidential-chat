<script lang="ts">
	import { onMount } from 'svelte';
	import LockClosed from '$lib/components/icons/LockClosed.svelte';
	import { confidentialVerificationConfig } from '$lib/confidential/verification';

	export let model: { id?: string; info?: { meta?: Record<string, unknown> } } | null = null;

	let localPreview = false;
	$: verificationConfig = confidentialVerificationConfig(model);
	$: visible = verificationConfig !== null || localPreview;

	onMount(() => {
		localPreview = ['127.0.0.1', 'localhost'].includes(window.location.hostname);
	});

	const openVerificationCenter = () => {
		window.dispatchEvent(new Event('adverserial:open-verification'));
	};
</script>

{#if visible}
	<button
		type="button"
		on:click={openVerificationCenter}
		aria-label="Open confidential inference verification center"
		class="proof-channel group relative inline-flex h-[1.875rem] shrink-0 items-center gap-1.5 overflow-hidden rounded-lg border border-cyan-300/20 bg-cyan-400/[0.04] px-2 text-[0.625rem] font-semibold tracking-[0.12em] text-cyan-700 transition hover:border-cyan-400/45 hover:bg-cyan-400/[0.1] dark:text-cyan-200"
	>
		<span class="proof-channel__scan" aria-hidden="true"></span>
		<span class="relative flex size-4 items-center justify-center rounded border border-cyan-400/30 bg-cyan-300/[0.08]">
			<LockClosed className="size-2.5" strokeWidth="2" />
		</span>
		<span class="relative hidden sm:inline">{verificationConfig ? 'ATTEST' : 'VERIFY'}</span>
		<span class="relative size-1 rounded-full {verificationConfig ? 'bg-cyan-400' : 'bg-amber-400'} shadow-[0_0_7px_currentColor]" aria-hidden="true"></span>
	</button>
{/if}

<style>
	.proof-channel__scan {
		position: absolute;
		inset: 0;
		background: linear-gradient(110deg, transparent 25%, rgb(103 232 249 / 0.24) 52%, transparent 72%);
		transform: translateX(-130%);
		transition: transform 450ms ease;
	}
	.proof-channel:hover .proof-channel__scan { transform: translateX(130%); }
</style>
