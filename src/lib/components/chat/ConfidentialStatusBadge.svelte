<script lang="ts">
	import LockClosed from '$lib/components/icons/LockClosed.svelte';
	import { confidentialVerificationConfig } from '$lib/confidential/verification';

	export let model: { id?: string; info?: { meta?: Record<string, unknown> } } | null = null;

	$: verificationConfig = confidentialVerificationConfig(model);
</script>

{#if verificationConfig}
	<a
		href={verificationConfig.verificationUrl}
		target="_blank"
		rel="noopener noreferrer"
		aria-label="Open confidential inference verification center"
		class="inline-flex h-[1.875rem] shrink-0 items-center gap-1 rounded-lg px-2 text-[0.6875rem] font-medium tracking-[0.08em] text-gray-500 transition hover:bg-gray-50 hover:text-gray-800 dark:text-gray-400 dark:hover:bg-gray-800 dark:hover:text-gray-100"
	>
		<LockClosed className="size-3.5" strokeWidth="1.75" />
		<span class="hidden sm:inline">PROOF</span>
	</a>
{/if}
