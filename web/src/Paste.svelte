<script lang="ts">
    import { match } from "ts-pattern";
    import { onMount } from "svelte";
    import DOMPurify from "dompurify";
    import {
        decryptMessage,
        search_like,
        get_item_image,
        get_image,
    } from "./helpers";
    import Toast from "./toast.svelte";

    // PASTE_ID prop
    let pasteId: string;

    let showNotes = false;

    let loaded = false;

    let showToast = false;

    function toggleNotes() {
        showNotes = !showNotes;
    }

    let selectable = false; // Initially, the title is selectable
    function setSelectable(value: boolean, id: string) {
        selectable = value;

        const element = document.getElementById(id);
        if (element === null) {
            return;
        }

        // First update the style
        if (value) {
            element.setAttribute("style", "user-select: text !important");
        } else {
            element.setAttribute("style", "user-select: auto !important");
        }

        // Set the style to be selectable for ALL children recursively
        const children = element.children;

        const children_list = [];

        for (let i = 0; i < children.length; i++) {
            // if (children[i].tagName === "PRE") {
            // 	continue;
            // }
            children_list.push(children[i]);
        }
        while (children_list.length > 0) {
            const child = children_list.pop();
            if (child === null || child === undefined) {
                break;
            }

            // Add all children to the list
            for (let i = 0; i < child.children.length; i++) {
                children_list.push(child.children[i]);
            }
            if (value) {
                // Set the style to be unselectable
                for (let i = 0; i < children.length; i++) {
                    child.setAttribute("style", "user-select: auto !important");
                }
            } else {
                for (let i = 0; i < children.length; i++) {
                    child.setAttribute("style", "user-select: none !important");
                }
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
        nickname: string;
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

    function newMon(): Mon {
        return {
            nickname: "",
            name: "",
            type1: "",
            item: "",
            other: [],
            hp: 0,
            atk: 0,
            def: 0,
            spa: 0,
            spd: 0,
            spe: 0,
            last_stat: "",
            image: "",
            item_img: "",
            hp_iv: null,
            atk_iv: null,
            def_iv: null,
            spa_iv: null,
            spd_iv: null,
            spe_iv: null,
            last_stat_iv: null,
            moves: [],
            gender: "",
        };
    }

    type PasteData = {
        title: string;
        author: string;
        notes: string;
        rental: string;
        format: string;
        paste: string;
        sets: Set[];
        encrypted_data: string;
        // biome-ignore lint/complexity/noBannedTypes: object is ok.
        mons: Object;
        // biome-ignore lint/complexity/noBannedTypes: object is ok.
        items: Object;
        // biome-ignore lint/complexity/noBannedTypes: object is ok.
        moves: Object;
    };

    let paste_data: PasteData | null = null;

    onMount(async () => {
        // @ts-ignore
        pasteId = window.PASTE_ID;

        // make a http request to get the paste
        try {
            const other_data_response = await fetch("/other-data-info");
            const other_data = await other_data_response.json();
            const response = await fetch(`/detailed/${pasteId}`);
            paste_data = await response.json();
            if (paste_data !== null) {
                if (
                    paste_data.encrypted_data !== null &&
                    paste_data.encrypted_data !== undefined
                ) {
                    // HANDLE ENCRYPTED DATA

                    // Get user input via popup.
                    let done = false;
                    let data = "";
                    let promptMsg = "Enter password";
                    while (!done) {
                        let passkey = prompt(promptMsg, "");

                        while (passkey == null || passkey === "") {
                            promptMsg = "Enter password";
                            passkey = prompt(promptMsg, "");
                        }
                        const decrypted = await decryptMessage(
                            passkey as string,
                            paste_data.encrypted_data,
                        );
                        match(decrypted)
                            .with({ type: "error" }, async () => {
                                promptMsg = "Invalid password";
                            })
                            .with({ type: "ok" }, ({ unwrap }) => {
                                data = unwrap();
                                done = true;
                            });
                    }

                    const content = data.split("\n-----\n");
                    const metadata = JSON.parse(content[0]);
                    paste_data.paste = content[1];

                    paste_data.title = metadata.title;
                    paste_data.author = metadata.author;
                    paste_data.notes = metadata.notes;
                    paste_data.rental = metadata.rental;
                    paste_data.format = metadata.format;
                }

                // This section is essentially the same logic in main.rs ported over to be handled on the client side.
                const sets = paste_data.paste
                    .split("\n\n")
                    .map((x) => x.trim())
                    .filter((x) => x !== "");
                paste_data.sets = [];

                const mons: Map<string, Mon> = new Map(
                    Object.entries(other_data.mons),
                );
                // biome-ignore lint/complexity/noBannedTypes: object is ok.
                const items: Map<string, Object> = new Map(
                    Object.entries(other_data.items),
                );
                const moves: Map<string, Move> = new Map(
                    Object.entries(other_data.moves),
                );

                const RE_HEAD =
                    /^(?:(.* \()([A-Z][a-z0-9:']+\.?(?:[- ][A-Za-z][a-z0-9:']*\.?)*)(\))|([A-Z][a-z0-9:']+\.?(?:[- ][A-Za-z][a-z0-9:']*\.?)*))(?:( \()([MF])(\)))?(?:( @ )([A-Z][a-z0-9:']*(?:[- ][A-Z][a-z0-9:']*)*))?( *)$/;
                const RE_MOVE =
                    /^(-)( ([A-Z][a-z\']*(?:[- ][A-Za-z][a-z\']*)*)(?: \[([A-Z][a-z]+)\])?(?: \/ [A-Z][a-z\']*(?:[- ][A-Za-z][a-z\']*)*)* *)$/;
                const RE_STAT =
                    /^(\d+ HP)?( \/ )?(\d+ Atk)?( \/ )?(\d+ Def)?( \/ )?(\d+ SpA)?( \/ )?(\d+ SpD)?( \/ )?(\d+ Spe)?( *)$/;

                for (let i = 0; i < sets.length; i++) {
                    const set = sets[i].trim();
                    const lines = set.split("\n");
                    const captures = lines[0].match(RE_HEAD);

                    if (captures === null) {
                        paste_data.sets.push({
                            mon: null,
                            text: set,
                        });
                        continue;
                    }

                    const set_mon = newMon();
                    let search_name = "";

                    if (captures[2]) {
                        const name = captures[2];
                        search_name = name.toLowerCase().replaceAll(" ", "-");
                        const mon = search_like(mons, search_name);
                        set_mon.name = name;
                        if (mon.isSome()) {
                            const result = mon.unwrap();
                            search_name = result[0];
                            set_mon.type1 = result[1].type1;
                            set_mon.nickname = captures[1];
                            // Remove the last two characters from the nickname.
                            set_mon.nickname = set_mon.nickname.slice(0, -2);
                        }
                    } else if (captures[4]) {
                        search_name = captures[4]
                            .toLowerCase()
                            .replaceAll(" ", "-");
                        const mon = search_like(mons, search_name);
                        set_mon.name = captures[4];
                        if (mon.isSome()) {
                            const result = mon.unwrap();
                            search_name = result[0];
                            set_mon.type1 = result[1].type1;
                        }
                    }

                    if (captures[6]) {
                        const gender = captures[6];
                        switch (gender) {
                            case "M":
                                set_mon.gender = "m";
                                break;
                            case "F":
                                set_mon.gender = "f";
                                break;
                            default:
                                break;
                        }
                    }

                    if (captures[9]) {
                        set_mon.item = captures[9];
                        set_mon.item_img = get_item_image(items, captures[9]);
                    }

                    const is_female = set_mon.gender === "f";
                    const is_shiny = set.match("Shiny: Yes") != null;
                    // Time the image request.
                    const image = get_image(
                        mons,
                        search_name,
                        is_shiny,
                        is_female,
                    );
                    set_mon.image = image;

                    for (let i = 1; i < lines.length; i++) {
                        const line = lines[i];
                        const moves_captures = line.trim().match(RE_MOVE);
                        if (moves_captures) {
                            if (moves_captures[3]) {
                                const move_name = moves_captures[3];
                                const move_search = move_name
                                    .replace(" ", "-")
                                    .toLowerCase();
                                const move_result = search_like(
                                    moves,
                                    move_search,
                                );

                                if (move_result.isSome()) {
                                    const result = move_result.unwrap();
                                    const move_object: Move = result[1];
                                    set_mon.moves.push({
                                        type1: move_object.type1,
                                        name: move_name,
                                    });
                                } else {
                                    set_mon.moves.push({
                                        type1: "",
                                        name: move_name,
                                    });
                                }
                            }
                        } else if (line.startsWith("EVs: ")) {
                            const evs = line.split(":");
                            const captures = evs[1].trim().match(RE_STAT);
                            if (captures) {
                                if (captures[1]) {
                                    set_mon.hp = Number.parseInt(
                                        captures[1].split(" ")[0],
                                    );
                                }
                                if (captures[3]) {
                                    set_mon.atk = Number.parseInt(
                                        captures[3].split(" ")[0],
                                    );
                                }
                                if (captures[5]) {
                                    set_mon.def = Number.parseInt(
                                        captures[5].split(" ")[0],
                                    );
                                }
                                if (captures[7]) {
                                    set_mon.spa = Number.parseInt(
                                        captures[7].split(" ")[0],
                                    );
                                }
                                if (captures[9]) {
                                    set_mon.spd = Number.parseInt(
                                        captures[9].split(" ")[0],
                                    );
                                }
                                if (captures[11]) {
                                    set_mon.spe = Number.parseInt(
                                        captures[11].split(" ")[0],
                                    );
                                }
                            } else {
                                set_mon.other.push(line);
                            }
                        } else if (line.startsWith("IVs: ")) {
                            const ivs = line.split(":");
                            const captures = ivs[1].trim().match(RE_STAT);
                            if (captures) {
                                if (captures[1]) {
                                    set_mon.hp_iv = Number.parseInt(
                                        captures[1].split(" ")[0],
                                    );
                                }
                                if (captures[3]) {
                                    set_mon.atk_iv = Number.parseInt(
                                        captures[3].split(" ")[0],
                                    );
                                }
                                if (captures[5]) {
                                    set_mon.def_iv = Number.parseInt(
                                        captures[5].split(" ")[0],
                                    );
                                }
                                if (captures[7]) {
                                    set_mon.spa_iv = Number.parseInt(
                                        captures[7].split(" ")[0],
                                    );
                                }
                                if (captures[9]) {
                                    set_mon.spd_iv = Number.parseInt(
                                        captures[9].split(" ")[0],
                                    );
                                }
                                if (captures[11]) {
                                    set_mon.spe_iv = Number.parseInt(
                                        captures[11].split(" ")[0],
                                    );
                                }
                            } else {
                                set_mon.other.push(line);
                            }
                        } else {
                            set_mon.other.push(line);
                        }
                    }
                    paste_data.sets.push({
                        mon: set_mon,
                        text: null,
                    });
                }
                paste_data.title = DOMPurify.sanitize(paste_data.title);
                paste_data.author = DOMPurify.sanitize(paste_data.author);
                paste_data.notes = DOMPurify.sanitize(paste_data.notes);
                paste_data.rental = DOMPurify.sanitize(paste_data.rental);
                paste_data.format = DOMPurify.sanitize(paste_data.format);

                for (const poke in paste_data.sets) {
                    const mon = paste_data.sets[poke].mon;

                    if (mon !== null) {
                        mon.nickname = DOMPurify.sanitize(mon.nickname);
                        mon.name = DOMPurify.sanitize(mon.name);
                        mon.type1 = DOMPurify.sanitize(mon.type1);
                        mon.item = DOMPurify.sanitize(mon.item);
                        mon.other = mon.other.map((x) => DOMPurify.sanitize(x));

                        if (mon.hp !== 0) {
                            mon.last_stat = "hp";
                        }
                        if (mon.atk !== 0) {
                            mon.last_stat = "atk";
                        }
                        if (mon.def !== 0) {
                            mon.last_stat = "def";
                        }
                        if (mon.spa !== 0) {
                            mon.last_stat = "spa";
                        }
                        if (mon.spd !== 0) {
                            mon.last_stat = "spd";
                        }
                        if (mon.spe !== 0) {
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
                    } else if (paste_data.sets[poke].text !== null) {
                        // Make sure paste_data.sets[poke].text is not null
                        paste_data.sets[poke].text = DOMPurify.sanitize(
                            // @ts-ignore
                            paste_data.sets[poke].text,
                        );
                    }
                }
            }
        } catch (e) {
            console.error(e);
        }
        loaded = true;
    });

    async function copyPaste() {
        const main = document.getElementsByTagName("main")[0];

        // Get the paste data.
        const data = main.innerText;
        // Copy the data to the clipboard.
        await navigator.clipboard.writeText(data);

        showToast = true;

        // Reset showToast after 3 seconds.
        setTimeout(() => {
            showToast = false;
        }, 3000);
    }
</script>

<head>
    {#if paste_data === null || !loaded}
        <title>Untitled</title>
    {:else if paste_data?.title == ""}
        <title>Untitled</title>
    {:else}
        <title>{paste_data?.title}</title>
    {/if}
</head>

<!--Wait for paste_data.sets to exist-->
{#if loaded}
    <div class="content-container">
        <div
            class="side-content"
            id="sidebar"
            on:mouseover={() => setSelectable(true, "sidebar")}
            on:focus={() => setSelectable(true, "sidebar")}
            on:mouseout={() => setSelectable(false, "sidebar")}
            on:blur={() => setSelectable(false, "sidebar")}
            role="note"
            style="user-select: none"
        >
            <div id="metadata">
                {#if paste_data !== null}
                    <div class="metadata">
                        {#if paste_data.title != "" && paste_data.title !== null && paste_data.title != undefined}
                            <h1 class="mx-10 text-pink-500 text-2xl" id="title">
                                {paste_data.title}
                            </h1>
                        {/if}
                        {#if paste_data.author != "" && paste_data.author !== null && paste_data.author != undefined}
                            <p class="mx-10 text-base" id="author">
                                By: {paste_data.author}
                            </p>
                        {/if}
                        {#if paste_data.format != "" && paste_data.format !== null && paste_data.format != undefined}
                            <p class="mx-10 text-base" id="format">
                                Format: {paste_data.format}
                            </p>
                        {/if}
                        {#if paste_data.rental != "" && paste_data.rental !== null && paste_data.rental != undefined}
                            <p class="mx-10 text-base" id="rental">
                                Rental: {paste_data.rental}
                            </p>
                        {/if}
                        {#if paste_data.notes != "" && paste_data.notes !== null && paste_data.notes != undefined}
                            <button
                                on:click={toggleNotes}
                                class="mx-10 toggle-notes"
                            >
                                {showNotes ? "Hide notes" : "Show notes"}
                            </button>
                            {#if showNotes}
                                <p
                                    class="mx-10 text-base"
                                    style="user-select:none"
                                    id="notes"
                                >
                                    {@html paste_data.notes.replace(
                                        /\n/g,
                                        "<br>",
                                    )}
                                </p>
                            {/if}
                        {/if}
                    </div>
                {/if}
            </div>
            <div class="extra mx-10">
                <p>placeholder content</p>
                <br />
                <button
                    type="submit"
                    on:click={copyPaste}
                    class="bg-pink-600 hover:bg-pink-800 text-white font-bold text-sm py-1 px-4 rounded"
                    >Copy paste</button
                >
            </div>
        </div>
        <br />
        <main>
            {#if paste_data !== undefined && paste_data !== null}
                {#each paste_data.sets as set_item}
                    {#if set_item.mon !== null}
                        <article>
                            <div class="img">
                                {#if set_item.mon.image !== null && set_item.mon.item !== ""}
                                    {#if set_item.mon.item_img.includes("img.pokemondb.net")}
                                        <span
                                            class="img-item"
                                            style={set_item.mon.item_img +
                                                "; height: 128px !important; width: 120px !important; background-position: 30px 40px; background-repeat: no-repeat"}
                                        />
                                    {:else}
                                        <span
                                            class="img-item"
                                            style={set_item.mon.item_img}
                                        />
                                    {/if}
                                {/if}
                                <img
                                    class="img-pokemon"
                                    src={set_item.mon.image}
                                    alt={set_item.mon.name}
                                />
                            </div>

                            <div class="paste">
                                {#if set_item.mon !== null}
                                    {#if set_item.mon.nickname !== null && set_item.mon.nickname !== ""}
                                        <span>{set_item.mon.nickname} (</span
                                        ><span class="type-{set_item.mon.type1}"
                                            >{set_item.mon.name}</span
                                        ><span>)</span>
                                    {:else}
                                        <span class="type-{set_item.mon.type1}"
                                            >{set_item.mon.name}</span
                                        >
                                    {/if}
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
                                                .replace(
                                                    "Ability:",
                                                    "",
                                                )}`}</span
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
                                                .replace(
                                                    "Tera Type:",
                                                    "",
                                                )}`}</span
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
                                                >{set_item.mon.spa} SpA</span
                                            >
                                            {#if set_item.mon.last_stat != "spa"}
                                                <span> / </span>
                                            {/if}
                                        {/if}
                                        {#if set_item.mon.spd != 0}
                                            <span class="stat-spd"
                                                >{set_item.mon.spd} SpD</span
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
                                                >{set_item.mon.spa_iv} SpA</span
                                            >
                                            {#if set_item.mon.last_stat_iv != "spa"}
                                                <span> / </span>
                                            {/if}
                                        {/if}
                                        {#if set_item.mon.spd_iv !== null}
                                            <span class="stat-spd"
                                                >{set_item.mon.spd_iv} SpD</span
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
                                            >-
                                        </span><span>{move.name}</span>
                                        <br />
                                    {/each}
                                    <br />
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
    </div>
{/if}
<Toast message="Paste copied!" show={showToast} />

<style lang="postcss">
    .toggle-notes {
        background: #333;
        color: white;
        border: none;
        padding: 10px;
        cursor: pointer;
        user-select: none !important;
        border-radius: 3px;
    }
</style>
