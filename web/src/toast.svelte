<script lang="ts">
	import { fade } from "svelte/transition";
	export let message = "";
	export let show = false;

	// Logic to automatically hide the toast after a duration
	$: if (show) {
		setTimeout(() => {
			show = false;
		}, 3000); // Adjust the time as needed
	}
</script>

{#if show}
	<div
		transition:fade={{ duration: 300 }}
		class="fixed top-4 right-4 p-2 bg-blue-500 text-white font-black rounded-lg shadow-lg"
	>
		{message}
	</div>
{/if}
