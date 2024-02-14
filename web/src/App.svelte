<script lang="ts">
	import { onMount } from "svelte";

	// On mount!
	onMount(() => {
		let notes = document.getElementById("notes");

		if (notes !== null) {
			notes.addEventListener("mouseup", function () {
				// Set maximum height to 65% of the window height

				// Make sure there is at least 200px of space at the bottom.
				let maxHeight = window.innerHeight * 0.6;
				const footerspace = 400;
				if (maxHeight > window.innerHeight - footerspace) {
					maxHeight = window.innerHeight - footerspace;
				}

				if (this.clientHeight > maxHeight) {
					this.style.height = maxHeight + "px";
				}
			});
		}
	});
</script>

<main>
	<form action="/create" method="post">
		<textarea
			id="paste"
			name="paste"
			placeholder="Paste your tournament winning team here!"
			style="resize: none"
		></textarea>
		<img style="display:none" id="img" src="" alt="" />
		<div id="sidebar">
			<br />
			<div class="text-4xl mt-2" style="padding: 0 !important;">
				<span class="text-pink-600">Poke</span><span
					class="text-pink-50">Bin</span
				>
			</div>
			<br />
			<br />
			<label class="text-base"
				>Title<input type="text" name="title" id="title" /></label
			>
			<label class="text-base"
				>Author<input type="text" name="author" id="author" /></label
			>
			<label class="text-base"
				>Rental<input
					type="text"
					name="rental"
					minlength="6"
					maxlength="6"
					id="rental"
				/></label
			>
			<label class="text-base"
				>Format<input type="text" name="format" id="format" /></label
			>
			<label class="text-base"
				>Notes<textarea id="notes" name="notes" rows="10"
				></textarea></label
			>
			<button
				type="submit"
				class="bg-blue-500 hover:bg-blue-700 text-white font-black text-base py-2 px-4 rounded mt-2"
			>
				Submit Paste!
			</button>
			<br />
			<br />

			<!-- Footer pinned to the bottom -->
			<div class="text-center mt-auto py-4">
				<!-- Stylized about button link -->
				<a href="/about"
					>About <span class="text-pink-700">Poke</span><span
						class="text-pink-50">Bin</span
					></a
				>
				<br />
				<p>Made with ❤️</p>
			</div>
		</div>
	</form>
	<img alt="" style="display: none" id="img" src="" />
</main>

<style>
	form {
		display: flex;
		flex-flow: row wrap;
	}

	form > textarea[name="paste"] {
		flex: 1 1 auto;
		/* width: 600px; */
		width: 50vw;
		height: 100vh;
		margin: 0;
		border: 0;
		padding: 12px;
		box-sizing: border-box;
		background-color: black;
		color: white;
		font:
			12px "M+ 1m",
			monospace;
	}

	form > div#sidebar {
		flex: 0 1 auto;
		/* width: 325px; */
		width: 50vw;
		padding: 0 12px;
		box-sizing: border-box;
		font:
			12px "M+ 1c",
			sans-serif;
		display: flex;
		flex-direction: column;
		background: #222;
		color: white;
	}

	form div label {
		display: block;
		text-align: right;
		margin: 3px 0;
		width: 100%;
	}

	form div input[type="text"],
	form div textarea {
		width: 85%;
		margin: 0 0 0 6px;
		border: 0;
		padding: 3px;
		background-color: #ccc;
		font: inherit;
		border-radius: 2px;
		color: black;
	}

	form div textarea {
		vertical-align: middle;
	}

	form div button[type="submit"] {
		margin-left: 15%;
		width: 85%;
		border: 0;
		padding: 6px;
		text-align: center;
	}
</style>
