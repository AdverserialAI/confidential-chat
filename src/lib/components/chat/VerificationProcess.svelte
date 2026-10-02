<script lang="ts">
	import { onMount } from 'svelte';
	import LockClosed from '$lib/components/icons/LockClosed.svelte';
	import CheckCircle from '$lib/components/icons/CheckCircle.svelte';
	import DocumentCheck from '$lib/components/icons/DocumentCheck.svelte';

	let open = false;
	let localPreview = false;

	onMount(() => {
		localPreview = ['127.0.0.1', 'localhost'].includes(window.location.hostname);
		const openProcess = () => (open = true);
		window.addEventListener('adverserial:open-verification-process', openProcess);
		return () => window.removeEventListener('adverserial:open-verification-process', openProcess);
	});

	const openCenter = () => {
		open = false;
		window.dispatchEvent(new Event('adverserial:open-verification-center'));
	};
</script>

<svelte:window on:keydown={(event) => event.key === 'Escape' && (open = false)} />

{#if open}
	<div class="fixed inset-0 z-[70] flex items-center justify-center p-4" aria-live="polite">
		<button type="button" class="absolute inset-0 h-full w-full bg-black/70" on:click={() => (open = false)} aria-label="Close verification process"></button>
		<section class="relative w-full max-w-[520px] overflow-hidden rounded-2xl border border-[#3a424e] bg-[#202224] text-[#edf0f5] shadow-2xl shadow-black/70" role="dialog" aria-modal="true" aria-labelledby="verification-process-title">
			<header class="flex items-start justify-between gap-4 border-b border-[#343a44] px-6 py-5">
				<div>
					<p class="text-[0.625rem] font-medium tracking-[0.14em] text-[#b9d5c8]">ADVERSERIAL AI · REQUEST VERIFICATION</p>
					<h2 id="verification-process-title" class="mt-2 text-xl font-semibold tracking-tight text-white">Verification process</h2>
				</div>
				<button type="button" class="flex size-8 items-center justify-center rounded-md text-lg text-[#a7b1c0] transition hover:bg-white/[0.06] hover:text-white" on:click={() => (open = false)} aria-label="Close verification process">×</button>
			</header>

			<div class="px-6 py-5">
				<p class="text-sm leading-6 text-[#cbd2dd]">Before a runtime can be trusted, the browser validates a fresh, signed receipt. Your prompt is never included in that verification request.</p>
				{#if localPreview}
					<p class="mt-3 rounded-lg border border-[#3a424e] bg-[#1b1d1f] px-3 py-2.5 text-xs leading-5 text-[#a7b1c0]"><strong class="text-[#edf0f5]">Local UI simulation.</strong> A production runtime must supply fresh signed evidence before any module can be marked verified.</p>
				{/if}

				<ol class="mt-5 space-y-3" aria-label="Verification process steps">
					<li class="process-step"><span><LockClosed className="size-3.5" strokeWidth="1.8" /></span><div><strong>Browser challenge</strong><p>Creates a one-time nonce. The check sends no prompt, response, API key, cookie, or account identifier.</p></div></li>
					<li class="process-step"><span><DocumentCheck className="size-3.5" strokeWidth="1.8" /></span><div><strong>Signed runtime receipt</strong><p>The verifier must bind that nonce to hardware evidence, the model, the endpoint, and the expected runtime policy.</p></div></li>
					<li class="process-step"><span><CheckCircle className="size-3.5" strokeWidth="1.8" /></span><div><strong>Independent module checks</strong><p>The Verification Center exposes every check and its fingerprint. A missing proof remains pending; it is never represented as verified.</p></div></li>
				</ol>

				<div class="mt-6 flex justify-end border-t border-[#343a44] pt-4">
					<button type="button" class="process-action" on:click={openCenter}>Open Verification Center</button>
				</div>
			</div>
		</section>
	</div>
{/if}

<style>
	.process-step { display: flex; gap: 0.8rem; border: 1px solid #343a44; border-radius: 0.7rem; background: #282e38; padding: 0.9rem; }
	.process-step > span { display: flex; width: 1.85rem; height: 1.85rem; flex: 0 0 auto; align-items: center; justify-content: center; border: 1px solid rgb(145 181 164 / 0.3); border-radius: 0.5rem; background: rgb(145 181 164 / 0.07); color: #a1c4b3; }
	.process-step strong { display: block; color: #edf0f5; font-size: 0.82rem; font-weight: 600; }
	.process-step p { margin: 0.3rem 0 0; color: #a7b1c0; font-size: 0.76rem; line-height: 1.3rem; }
	.process-action { display: inline-flex; min-height: 2.3rem; align-items: center; justify-content: center; border: 1px solid #668775; border-radius: 0.5rem; background: #475f53; padding: 0.5rem 0.9rem; color: #edf0f5; font-size: 0.8rem; font-weight: 600; transition: background-color 150ms ease; }
	.process-action:hover { background: #496d5c; }
</style>
