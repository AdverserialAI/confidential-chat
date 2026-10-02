<script lang="ts">
	import LockClosed from '$lib/components/icons/LockClosed.svelte';
	import CheckCircle from '$lib/components/icons/CheckCircle.svelte';
	import DocumentCheck from '$lib/components/icons/DocumentCheck.svelte';
	import Spinner from '$lib/components/common/Spinner.svelte';
	import {
		confidentialVerificationConfig,
		verifyConfidentialEndpoint,
		type VerificationResult
	} from '$lib/confidential/verification';

	export let model: { id?: string; name?: string; info?: { meta?: Record<string, unknown> } } | null = null;

	let result: VerificationResult | null = null;
	let verifying = false;
	let previousModelId = '';

	$: verificationConfig = confidentialVerificationConfig(model);
	$: if (model?.id !== previousModelId) {
		previousModelId = model?.id ?? '';
		result = null;
		verifying = false;
	}

	const verify = async () => {
		if (!verificationConfig || verifying) return;
		verifying = true;
		result = await verifyConfidentialEndpoint(verificationConfig);
		verifying = false;
	};
</script>

{#if verificationConfig}
	<section class="px-3 pb-5 pt-3 text-sm" aria-live="polite" aria-label="Confidential inference proof">
		<div class="rounded-xl border border-gray-200 bg-gray-50/50 p-4 dark:border-gray-800 dark:bg-gray-850/60">
			<div class="flex items-start gap-3">
				<div
					class="mt-0.5 flex size-8 shrink-0 items-center justify-center rounded-lg {result?.status ===
					'verified'
						? 'bg-emerald-500/10 text-emerald-700 dark:text-emerald-400'
						: result?.status === 'failed'
							? 'bg-rose-500/10 text-rose-700 dark:text-rose-400'
							: 'bg-gray-200/60 text-gray-600 dark:bg-gray-800 dark:text-gray-300'}"
				>
					{#if result?.status === 'verified'}
						<CheckCircle className="size-4" strokeWidth="1.75" />
					{:else}
						<LockClosed className="size-4" strokeWidth="1.75" />
					{/if}
				</div>

				<div class="min-w-0 flex-1">
					<p class="text-[0.6875rem] font-medium tracking-[0.12em] text-gray-500 dark:text-gray-400">
						CONFIDENTIAL INFERENCE
					</p>
					<h2 class="mt-1 text-base font-medium text-gray-800 dark:text-gray-100">
						{model?.name ?? verificationConfig.expected.modelId}
					</h2>

					{#if result?.status === 'verified'}
						<p class="mt-2 text-sm leading-5 text-emerald-800 dark:text-emerald-300">
							Verified in this browser. The signed receipt matches this model, endpoint, fresh nonce,
							and returned evidence.
						</p>
					{:else if result?.status === 'failed'}
						<p class="mt-2 text-sm leading-5 text-rose-800 dark:text-rose-300">
							Not verified. {result.reason}
						</p>
					{:else}
						<p class="mt-2 text-sm leading-5 text-gray-600 dark:text-gray-300">
							No verification has been completed in this browser session.
						</p>
					{/if}
				</div>
			</div>

			<div class="mt-4 flex flex-wrap items-center gap-2">
				<button
					type="button"
					class="inline-flex min-h-9 items-center gap-2 rounded-lg bg-gray-900 px-3 py-2 text-xs font-medium text-white transition hover:bg-gray-700 disabled:cursor-not-allowed disabled:opacity-60 dark:bg-gray-100 dark:text-gray-900 dark:hover:bg-white"
					disabled={verifying}
					on:click={verify}
				>
					{#if verifying}<Spinner className="size-3.5" />{:else}<DocumentCheck className="size-3.5" strokeWidth="1.75" />{/if}
					{verifying ? 'Checking proof…' : 'Verify endpoint'}
				</button>
				<a
					href={verificationConfig.verificationUrl}
					target="_blank"
					rel="noopener noreferrer"
					class="inline-flex min-h-9 items-center rounded-lg border border-gray-300 px-3 py-2 text-xs font-medium text-gray-700 transition hover:bg-white dark:border-gray-700 dark:text-gray-200 dark:hover:bg-gray-800"
				>
					Open verification center
				</a>
			</div>

			{#if result?.status === 'verified'}
				<dl class="mt-4 space-y-2 border-t border-gray-200 pt-3 text-xs dark:border-gray-800">
					<div class="flex items-start justify-between gap-3">
						<dt class="text-gray-500 dark:text-gray-400">Receipt issued</dt>
						<dd class="text-right text-gray-700 dark:text-gray-200">{result.proof.issuedAt}</dd>
					</div>
					<div class="flex items-start justify-between gap-3">
						<dt class="text-gray-500 dark:text-gray-400">Evidence binding</dt>
						<dd class="max-w-48 break-all text-right font-mono text-[0.6875rem] text-gray-700 dark:text-gray-200">
							{result.proof.evidenceDigest}
						</dd>
					</div>
					{#if result.proof.modelDigest}
						<div class="flex items-start justify-between gap-3">
							<dt class="text-gray-500 dark:text-gray-400">Model artifact</dt>
							<dd class="max-w-48 break-all text-right font-mono text-[0.6875rem] text-gray-700 dark:text-gray-200">
								{result.proof.modelDigest}
							</dd>
						</div>
					{/if}
				</dl>
			{/if}

			<p class="mt-4 text-xs leading-5 text-gray-500 dark:text-gray-400">
				Verification sends a one-time nonce only. It does not send this chat’s prompts, responses,
				API key, cookies, or account identifier.
			</p>
		</div>
	</section>
{/if}
