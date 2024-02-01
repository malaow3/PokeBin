<script lang="ts">
	import axios from "axios";
	import { onMount } from "svelte";
	import Newline from "./newline.svelte";

	// PASTE_ID prop
	let pasteId: string;

	let selectable = false; // Initially, the title is selectable
	function setSelectable(value: boolean, id: string) {
		selectable = value;

		let element = document.getElementById(id);
		if (element === null) {
			return;
		}

		let children = element.children;

		if (value) {
			// Set the style to be unselectable

			for (let i = 0; i < children.length; i++) {
				if (children[i].tagName === "PRE") {
					continue;
				}
				children[i].setAttribute(
					"style",
					"user-select: auto !important",
				);
			}
		} else {
			for (let i = 0; i < children.length; i++) {
				if (children[i].tagName === "PRE") {
					continue;
				}
				children[i].setAttribute(
					"style",
					"user-select: none !important",
				);
			}
		}
	}

	// Define custom paste data type
	type Set = {
		mon: Mon | null;
		text: string | null;
	};
	type Move = {
		name: string;
		type1: string;
	};
	type Mon = {
		name: string;
		type1: string;
		item: string;
		other: string[];
		hp: number;
		atk: number;
		def: number;
		spa: number;
		spd: number;
		spe: number;
		last_stat: string;
		image: string;
		item_img: string;
		hp_iv: number | null;
		atk_iv: number | null;
		def_iv: number | null;
		spa_iv: number | null;
		spd_iv: number | null;
		spe_iv: number | null;
		last_stat_iv: string | null;
		moves: Move[];
		gender: string;
	};
	type PasteData = {
		title: string;
		author: string;
		notes: string;
		rental: string;
		format: string;
		sets: Set[];
	};

	let paste_data: PasteData | null = null;

	onMount(async () => {
		// @ts-ignore
		pasteId = window.PASTE_ID;

		// make a http request to get the paste
		try {
			let response = await axios.get("/detailed/" + pasteId);
			paste_data = response.data;
			console.log(paste_data);
			if (paste_data !== null) {
				for (let poke in paste_data.sets) {
					let mon = paste_data.sets[poke].mon;

					if (mon !== null) {
						if (mon.hp != 0) {
							mon.last_stat = "hp";
						}
						if (mon.atk != 0) {
							mon.last_stat = "atk";
						}
						if (mon.def != 0) {
							mon.last_stat = "def";
						}
						if (mon.spa != 0) {
							mon.last_stat = "spa";
						}
						if (mon.spd != 0) {
							mon.last_stat = "spd";
						}
						if (mon.spe != 0) {
							mon.last_stat = "spe";
						}

						mon.last_stat_iv = null;
						if (mon.hp_iv != null) {
							mon.last_stat_iv = "hp";
						}
						if (mon.atk_iv != null) {
							mon.last_stat_iv = "atk";
						}
						if (mon.def_iv != null) {
							mon.last_stat_iv = "def";
						}
						if (mon.spa_iv != null) {
							mon.last_stat_iv = "spa";
						}
						if (mon.spd_iv != null) {
							mon.last_stat_iv = "spd";
						}
						if (mon.spe_iv != null) {
							mon.last_stat_iv = "spe";
						}
					}
				}
			}
		} catch (e) {
			console.log(e);
		}
	});
</script>

<head>
	{#if paste_data !== null && paste_data.title !== null}
		<title>{paste_data?.title}</title>
	{:else}
		<title>Untitled</title>
	{/if}
</head>

<!--Wait for paste_data.sets to exist-->
<div class="content-container">
	<main>
		{#if paste_data !== undefined && paste_data !== null}
			{#each paste_data.sets as set_item}
				{#if set_item.mon !== null}
					<article>
						<div class="img">
							{#if set_item.mon.image !== null && set_item.mon.item !== ""}
								<span
									class="img-item"
									style={set_item.mon.item_img}
								/>
							{/if}
							<img
								class="img-pokemon"
								src="/{set_item.mon.image}"
								alt={set_item.mon.name}
							/>
						</div>

						<div class="paste">
							{#if set_item.mon !== null}
								<span class="type-{set_item.mon.type1}"
									>{set_item.mon.name}</span
								>
								{#if set_item.mon.gender !== null && set_item.mon.gender !== ""}
									<span>(</span><span
										class="gender-{set_item.mon.gender}"
									>
										{set_item.mon.gender.toUpperCase()}</span
									><span>)</span>
								{/if}
								{#if set_item.mon.item !== null && set_item.mon.item !== ""}
									<span
										>{@html `@ ${set_item.mon.item.trim()}`}</span
									>
								{/if}
								<br />

								<!-- Ability -->
								{#each set_item.mon.other.filter( (x) => x.startsWith("Ability:"), ) as ability}
									<span class="attr">Ability:</span>
									<span
										>{@html `${ability
											.trim()
											.replace("Ability:", "")}`}</span
									>
									<br />
								{/each}

								<!-- Level -->
								{#each set_item.mon.other.filter( (x) => x.startsWith("Level:"), ) as level}
									<span class="attr">Level:</span>
									<span
										>{@html `${level
											.trim()
											.replace("Level:", "")}`}</span
									>
									<br />
								{/each}

								<!-- Shiny -->
								{#each set_item.mon.other.filter( (x) => x.startsWith("Shiny:"), ) as shiny}
									<span class="attr">Shiny:</span>
									<span
										>{@html `${shiny
											.trim()
											.replace("Shiny:", "")}`}</span
									>
									<br />
								{/each}

								<!-- Hidden Power Type -->
								{#each set_item.mon.other.filter( (x) => x.startsWith("Hidden Power:"), ) as hidden_power}
									<span class="attr">Hidden Power:</span>
									<span
										class="type-{hidden_power
											.trim()
											.replace('Hidden Power: ', '')
											.toLowerCase()}"
										>{@html `${hidden_power
											.trim()
											.replace(
												"Hidden Power:",
												"",
											)}`}</span
									>
									<br />
								{/each}

								<!-- Tera type -->
								{#each set_item.mon.other.filter( (x) => x.startsWith("Tera Type:"), ) as tera_type}
									<span class="attr">Tera Type:</span>
									<span
										class="type-{tera_type
											.trim()
											.replace('Tera Type: ', '')
											.toLowerCase()}"
										>{@html `${tera_type
											.trim()
											.replace("Tera Type:", "")}`}</span
									>
									<br />
								{/each}

								<!-- EVs -->
								{#if set_item.mon !== null && (set_item.mon.hp != 0 || set_item.mon.atk != 0 || set_item.mon.def != 0 || set_item.mon.spa != 0 || set_item.mon.spd != 0 || set_item.mon.spe != 0)}
									<span class="attr">EVs:</span>
									{#if set_item.mon.hp != 0}
										<span class="stat-hp"
											>{set_item.mon.hp} HP</span
										>
										{#if set_item.mon.last_stat != "hp"}
											<span> / </span>
										{/if}
									{/if}
									{#if set_item.mon.atk != 0}
										<span class="stat-atk"
											>{set_item.mon.atk} Atk</span
										>
										{#if set_item.mon.last_stat != "atk"}
											<span> / </span>
										{/if}
									{/if}
									{#if set_item.mon.def != 0}
										<span class="stat-def"
											>{set_item.mon.def} Def</span
										>
										{#if set_item.mon.last_stat != "def"}
											<span> / </span>
										{/if}
									{/if}
									{#if set_item.mon.spa != 0}
										<span class="stat-spa"
											>{set_item.mon.spa} Spa</span
										>
										{#if set_item.mon.last_stat != "spa"}
											<span> / </span>
										{/if}
									{/if}
									{#if set_item.mon.spd != 0}
										<span class="stat-spd"
											>{set_item.mon.spd} Spd</span
										>
										{#if set_item.mon.last_stat != "spd"}
											<span> / </span>
										{/if}
									{/if}
									{#if set_item.mon.spe != 0}
										<span class="stat-spe"
											>{set_item.mon.spe} Spe</span
										>
									{/if}
									<br />
								{/if}

								<!-- Nature -->
								{#each set_item.mon.other.filter( (x) => x.includes("Nature"), ) as nature}
									<span>{@html `${nature}`}</span>
									<br />
								{/each}

								<!-- IVs-->
								{#if set_item.mon !== null && set_item.mon.last_stat_iv !== null}
									<span class="attr">IVs:</span>
									{#if set_item.mon.hp_iv !== null}
										<span class="stat-hp"
											>{set_item.mon.hp_iv} HP</span
										>
										{#if set_item.mon.last_stat_iv != "hp"}
											<span> / </span>
										{/if}
									{/if}
									{#if set_item.mon.atk_iv !== null}
										<span class="stat-atk"
											>{set_item.mon.atk_iv} Atk</span
										>
										{#if set_item.mon.last_stat_iv != "atk"}
											<span> / </span>
										{/if}
									{/if}
									{#if set_item.mon.def_iv !== null}
										<span class="stat-def"
											>{set_item.mon.def_iv} Def</span
										>
										{#if set_item.mon.last_stat_iv != "def"}
											<span> / </span>
										{/if}
									{/if}
									{#if set_item.mon.spa_iv !== null}
										<span class="stat-spa"
											>{set_item.mon.spa_iv} Spa</span
										>
										{#if set_item.mon.last_stat_iv != "spa"}
											<span> / </span>
										{/if}
									{/if}
									{#if set_item.mon.spd_iv !== null}
										<span class="stat-spd"
											>{set_item.mon.spd_iv} Spd</span
										>
										{#if set_item.mon.last_stat_iv != "spd"}
											<span> / </span>
										{/if}
									{/if}
									{#if set_item.mon.spe_iv !== null}
										<span class="stat-spe"
											>{set_item.mon.spe_iv} Spe</span
										>
									{/if}
									<br />
								{/if}

								<!-- Moves -->
								{#each set_item.mon.moves as move}
									<span class="type-{move.type1}"
										>—
									</span><span>{move.name}</span>
									<br />
								{/each}
							{/if}
						</div>
					</article>
				{:else}
					<article>
						<pre>
					{set_item.text}
				</pre>
					</article>
				{/if}
			{/each}
		{/if}
	</main>
	<Newline />

	<div
		id="title"
		on:mouseover={() => setSelectable(true, "title")}
		on:focus={() => setSelectable(true, "title")}
		on:mouseout={() => setSelectable(false, "title")}
		on:blur={() => setSelectable(false, "title")}
		role="note"
	>
		{#if paste_data}
			{#if paste_data.title != "" && paste_data.title !== null && paste_data.title != undefined}
				<h1
					class="mx-10 text-pink-500 text-4xl"
					style="user-select:none"
					id="title"
				>
					{paste_data.title}
				</h1>
			{/if}
			{#if paste_data.author != "" && paste_data.author !== null && paste_data.author != undefined}
				<p class="mx-10 text-base" style="user-select:none" id="author">
					By: {paste_data.author}
				</p>
			{/if}
			{#if paste_data.format != "" && paste_data.format !== null && paste_data.format != undefined}
				<p class="mx-10 text-base" style="user-select:none" id="author">
					Format: {paste_data.format}
				</p>
			{/if}
			{#if paste_data.rental != "" && paste_data.rental !== null && paste_data.rental != undefined}
				<p class="mx-10 text-base" style="user-select:none" id="author">
					Rental: {paste_data.rental}
				</p>
			{/if}
			{#if paste_data.notes != "" && paste_data.notes !== null && paste_data.notes != undefined}
				<p class="mx-10 text-base" style="user-select:none" id="author">
					{paste_data.notes}
				</p>
			{/if}
		{/if}
		<Newline />
	</div>
</div>
