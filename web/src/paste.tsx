import {
    createResource,
    createSignal,
    For,
    Index,
    Match,
    onCleanup,
    onMount,
    Show,
    Switch,
} from "solid-js";
import "./paste.css";
import PatreonButton from "./buttons";
import { render } from "solid-js/web";
import {
    decryptMessage,
    get_image,
    get_item_image,
    search_like,
} from "./helpers";
import { match } from "ts-pattern";
import {
    newMon,
    type PasteData,
    type Mon,
    type Move,
    newPasteData,
} from "./types";
import DOMPurify from "dompurify";

async function copyPaste() {
    const main = document.getElementsByTagName("main")[0];

    // Get the paste data.
    const data = main.innerText;
    // Copy the data to the clipboard.
    await navigator.clipboard.writeText(data);
}

async function fetchPasteData() {
    // Get the paste ID from the URL
    const url = new URL(window.location.href);
    const pasteId = url.href.split("/").pop();
    let paste_data: PasteData = newPasteData();

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
                .map((x: string) => x.trim())
                .filter((x: string) => x !== "");
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
                /^(\d+\s*HP)?(\s*\/\s*)?(\d+\s*Atk)?(\s*\/\s*)?(\d+\s*Def)?(\s*\/\s*)?(\d+\s*SpA)?(\s*\/\s*)?(\d+\s*SpD)?(\s*\/\s*)?(\d+\s*Spe)?(\s*)$/;

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
                    search_name = name.toLowerCase().replace(/ /g, "-");

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
                    search_name = captures[4].toLowerCase().replace(/ /g, "-");
                    const mon = search_like(mons, search_name);
                    set_mon.name = captures[4];
                    if (mon.isSome()) {
                        const result = mon.unwrap();
                        search_name = result[0];
                        set_mon.type1 = result[1].type1;
                    }
                }
                // Special case for Calyrex-Shadow and Calyrex-Ice when importing from Limitless.
                if (set_mon.name.toLowerCase() === "calyrex-shadow-rider") {
                    set_mon.name = "Calyrex-Shadow";
                    search_name = "calyrex-shadow";
                } else if (set_mon.name.toLowerCase() === "calyrex-ice-rider") {
                    set_mon.name = "Calyrex-Ice";
                    search_name = "calyrex-ice";
                }
                // Special case for Vivillon-Pokeball -- All the other forms are fine.
                else if (set_mon.name.toLowerCase() === "vivillon-pokeball") {
                    set_mon.name = "Vivillon-Pokeball";
                    search_name = "vivillon-poke-ball";
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
                const image = get_image(mons, search_name, is_shiny, is_female);
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
                            const move_result = search_like(moves, move_search);

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
                    mon.other = mon.other.map((x: string | Node) =>
                        DOMPurify.sanitize(x),
                    );

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
        document.title = "Untitled";
        if (window.top !== null) {
            window.top.document.title = "Untitled";
        }
        throw e;
    }

    if (paste_data === null) {
        document.title = "Untitled";
        if (window.top !== null) {
            window.top.document.title = "Untitled";
        }
    } else {
        if (paste_data.title === "") {
            document.title = "Untitled";
            if (window.top !== null) {
                window.top.document.title = "Untitled";
            }
        } else {
            document.title = paste_data.title;
            if (window.top !== null) {
                window.top.document.title = paste_data.title;
            }
        }
    }

    return paste_data;
}

function App() {
    const [data, { refetch }] = createResource(fetchPasteData);
    const [showNotes, setShowNotes] = createSignal(false);
    const [notesWidth, setNotesWidth] = createSignal("300px");
    const [notesOpacity, setNotesOpacity] = createSignal(1.0);

    function makeTransparentOnMouseover() {
        setNotesOpacity(0.2);
    }

    function makeOpaqueOnFocus() {
        setNotesOpacity(1.0);
    }

    function updateWidths() {
        const main = document.getElementsByTagName("main")[0];
        const sidebar = document.getElementById("sidebar");
        const notes = document.getElementById("notes");

        if (!main && !sidebar && !notes) return;

        let articles = document.getElementsByTagName("article");
        let end = articles.length;
        if (articles.length > 4) {
            end = 4;
        }

        const windowWidth = window.innerWidth;
        for (let i = 0; i < end; i++) {

            if (windowWidth > 1024) {
                let margin_bottom = Math.floor(window.innerHeight * 0.02);
                articles[i].style.marginBottom = `${margin_bottom}px`;
            }
        }

        if (windowWidth <= 1024) {
            // Mobile layout
            setNotesWidth("300px");
        } else {
            // Desktop layout
            const width = windowWidth - 420;
            setNotesWidth(`${width}px`);
        }
    }

    function setSelectable(value: boolean, id: string) {
        const element = document.getElementById(id);
        if (element === null) {
            return;
        }

        // First update the style
        if (value) {
            element.style.userSelect = "text";
        } else {
            element.style.userSelect = "auto";
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
            const child = children_list.pop() as HTMLElement;
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
                    child.style.userSelect = "auto";
                }
            } else {
                for (let i = 0; i < children.length; i++) {
                    child.style.userSelect = "none";
                }
            }
        }
    }

    onMount(async () => {
        window.addEventListener("resize", updateWidths);
        refetch();
        while (data.loading) {
            await new Promise((resolve) => setTimeout(resolve, 10));
        }
        updateWidths();
        console.log(data());
    });


    // @ts-ignore: This is a debugging function
    const debug = () => {
        // Print the window width, the main width, the sidebar width, and each article's width
        console.log("---------------------");
        console.log("Window width:", window.innerWidth);
        const main = document.getElementsByTagName("main")![0] as HTMLElement;
        console.log("Main width:", main.clientWidth);
        const sidebar = document.getElementById("sidebar")! as HTMLElement;
        console.log("Sidebar width:", sidebar.clientWidth);
        const articles = document.getElementsByTagName("article");
        for (let i = 0; i < articles.length; i++) {
            const article = articles[i] as HTMLElement;
            console.log(`Article ${i} width:`, article.clientWidth);
        }
        console.log("---------------------");
    };

    onCleanup(() => {
        window.removeEventListener("resize", updateWidths);
    });
    return (
        <>
            <Show when={data.error}>
                <h1>Error: {data.error.message}</h1>
            </Show>
            <Show
                when={!data.loading && data() !== null && data() !== undefined}
            >
                <div class="content-wrapper">
                    <div class="side-content" id="sidebar">
                        <div class="sidebar-inner">
                            <Show when={data()?.title !== "" || data()?.author !== "" || data()?.format !== "" || data()?.rental !== ""}>
                                <div class="metadata"
                                    id="metadata"
                                    style={{
                                        "user-select": "none",
                                    }}
                                    onMouseOver={() => {
                                        setSelectable(true, "metadata");
                                    }}
                                    onFocus={() => {
                                        setSelectable(true, "metadata");
                                    }}
                                    onMouseOut={() => {
                                        setSelectable(false, "metadata");
                                    }}
                                    onBlur={() => {
                                        setSelectable(false, "metadata");
                                    }}
                                >
                                    <Show when={data()?.title !== ""}>
                                        <h1
                                            class="text-pink-300 text-2xl"
                                            id="title"
                                            style={{
                                                "user-select": "none",
                                            }}
                                        >
                                            {data()?.title}
                                        </h1>
                                    </Show>
                                    <Show when={data()?.author !== ""}>
                                        <p class="text-base" id="author"
                                            style={{
                                                "user-select": "none",
                                            }}
                                        >
                                            By: {data()?.author}
                                        </p>
                                    </Show>
                                    <Show when={data()?.format !== ""}>
                                        <p class="text-base" id="format"
                                            style={{
                                                "user-select": "none",
                                            }}
                                        >
                                            Format: {data()?.format}
                                        </p>
                                    </Show>
                                    <Show when={data()?.rental !== ""}>
                                        <p class="text-base" id="rental"
                                            style={{
                                                "user-select": "none",
                                            }}
                                        >
                                            Rental: {data()?.rental}
                                        </p>
                                    </Show>
                                </div>
                            </Show>
                            <div class="notes-section my-1">
                                <Show when={data()?.notes !== ""}>
                                    <button
                                        class="notes-toggle"
                                        type="button"
                                        onClick={() => {
                                            setShowNotes(!showNotes());
                                            let notes = document.getElementsByClassName("notes-content");
                                            if (notes.length > 0) {
                                                let notes_obj = notes[0] as HTMLElement;
                                                if (notes_obj.getBoundingClientRect().top < 0) {
                                                    notes_obj.style.top = "0px";
                                                }
                                            }

                                            if (showNotes()) {
                                                setNotesOpacity(1.0);
                                            }
                                        }}
                                    >
                                        <Show when={showNotes()}>
                                            Hide notes
                                        </Show>
                                        <Show when={!showNotes()}>
                                            Show notes
                                        </Show>
                                    </button>
                                    <Show when={showNotes()}>
                                        <div
                                            class="notes-content"
                                            onMouseOver={() => {
                                                makeOpaqueOnFocus();
                                                setSelectable(true, "notes");
                                            }}
                                            onFocus={() => {
                                                makeOpaqueOnFocus();
                                                setSelectable(true, "notes");
                                            }}
                                            onMouseOut={() => {
                                                makeTransparentOnMouseover();
                                                setSelectable(false, "notes");
                                            }}
                                            onBlur={() => {
                                                makeTransparentOnMouseover();
                                                setSelectable(false, "notes");
                                            }}
                                            style={{
                                                width: notesWidth(),
                                                opacity: notesOpacity(),
                                                "user-select": "none",
                                                "z-index": 2,
                                            }}
                                        >
                                            <p
                                                id="notes"
                                                innerHTML={data()?.notes.replace(
                                                    /\n/g,
                                                    "<br>",
                                                )}
                                            />
                                        </div>
                                    </Show>
                                </Show>
                            </div>
                        </div>
                        <div id="buttons">

                            <div class="extra">
                                <PatreonButton />
                            </div>
                            <button
                                style={{
                                    "user-select": "none",
                                }}
                                type="submit"
                                onClick={copyPaste}
                                class="copy-button"
                            >
                                Copy
                            </button>
                        </div>
                    </div>
                    <main class="my-6">
                        <For each={data()?.sets}>
                            {(set_item) => (
                                <Show when={set_item.mon !== null}>
                                    <article>
                                        <div class="img">
                                            <Show
                                                when={
                                                    set_item.mon?.item_img !==
                                                    ""
                                                }
                                            >
                                                <span
                                                    class="img-item"
                                                    style={
                                                        set_item.mon?.item_img
                                                    }
                                                />
                                            </Show>
                                            <img
                                                class="img-pokemon"
                                                src={set_item.mon?.image}
                                                alt={set_item.mon?.name}
                                            />
                                        </div>

                                        <div class="paste">
                                            <div id="mon_title">
                                                <Switch>
                                                    <Match
                                                        when={
                                                            set_item.mon
                                                                ?.nickname !==
                                                            ""
                                                        }
                                                    >
                                                        <span>
                                                            {
                                                                set_item.mon
                                                                    ?.nickname
                                                            }{" "}
                                                            (
                                                        </span>
                                                        <span
                                                            class={`type-${set_item.mon?.type1}`}
                                                        >
                                                            {set_item.mon?.name}
                                                        </span>
                                                        <span>)</span>
                                                    </Match>
                                                    <Match
                                                        when={
                                                            set_item.mon
                                                                ?.nickname ===
                                                            ""
                                                        }
                                                    >
                                                        <span
                                                            class={`type-${set_item.mon?.type1}`}
                                                        >
                                                            {set_item.mon?.name}
                                                        </span>
                                                    </Match>
                                                </Switch>
                                                <Show
                                                    when={
                                                        set_item.mon?.gender !==
                                                        ""
                                                    }
                                                >
                                                    <span> (</span>
                                                    <span
                                                        class={`gender-${set_item.mon?.gender}`}
                                                    >
                                                        {set_item.mon?.gender.toUpperCase()}
                                                    </span>
                                                    <span>)</span>
                                                </Show>

                                                <Show
                                                    when={
                                                        set_item.mon?.item !==
                                                        ""
                                                    }
                                                >
                                                    <span style={{ "font-size": "7px" }}>{" "}</span>
                                                    <span>@</span>
                                                    <span style={{ "font-size": "7px" }}>{" "}</span>
                                                    <span
                                                        innerHTML={`${set_item.mon?.item.trim()}`}
                                                    />
                                                </Show>
                                            </div>
                                            {/* Ability */}
                                            <For
                                                each={set_item.mon?.other.filter(
                                                    (x: string) =>
                                                        x.startsWith(
                                                            "Ability:",
                                                        ),
                                                )}
                                            >
                                                {(ability) => (
                                                    <>
                                                        <span class="attr">
                                                            Ability:
                                                        </span>
                                                        <span
                                                            innerHTML={`${ability
                                                                .trim()
                                                                .replace(
                                                                    "Ability:",
                                                                    " ",
                                                                )}`}
                                                        />
                                                        <br />
                                                    </>
                                                )}
                                            </For>
                                            {/* Level */}
                                            <For
                                                each={set_item.mon?.other.filter(
                                                    (x) =>
                                                        x.startsWith("Level:"),
                                                )}
                                            >
                                                {(level) => (
                                                    <>
                                                        <span class="attr">
                                                            Level:
                                                        </span>
                                                        <span
                                                            innerHTML={`${level
                                                                .trim()
                                                                .replace(
                                                                    "Level:",
                                                                    " ",
                                                                )}`}
                                                        />
                                                        <br />
                                                    </>
                                                )}
                                            </For>
                                            {/* Shiny */}
                                            <For
                                                each={set_item.mon?.other.filter(
                                                    (x) =>
                                                        x.startsWith("Shiny:"),
                                                )}
                                            >
                                                {(shiny) => (
                                                    <>
                                                        <span class="attr">
                                                            Shiny:
                                                        </span>
                                                        <span
                                                            innerHTML={`${shiny
                                                                .trim()
                                                                .replace(
                                                                    "Shiny:",
                                                                    " ",
                                                                )}`}
                                                        />
                                                        <br />
                                                    </>
                                                )}
                                            </For>
                                            {/* Hidden Power Type */}
                                            <For
                                                each={set_item.mon?.other.filter(
                                                    (x) =>
                                                        x.startsWith(
                                                            "Hidden Power:",
                                                        ),
                                                )}
                                            >
                                                {(hidden_power) => (
                                                    <>
                                                        <span class="attr">
                                                            Hidden Power:
                                                        </span>
                                                        <span
                                                            class={`type-${hidden_power
                                                                .trim()
                                                                .replace(
                                                                    "Hidden Power: ",
                                                                    "",
                                                                )}`}
                                                        >
                                                            {hidden_power
                                                                .trim()
                                                                .replace(
                                                                    "Hidden Power: ",
                                                                    "",
                                                                )}
                                                        </span>
                                                        <br />
                                                    </>
                                                )}
                                            </For>
                                            {/* Tera Type */}
                                            <For
                                                each={set_item.mon?.other.filter(
                                                    (x) =>
                                                        x.startsWith(
                                                            "Tera Type:",
                                                        ),
                                                )}
                                            >
                                                {(tera_type) => (
                                                    <>
                                                        <span class="attr">
                                                            Tera Type:{" "}
                                                        </span>
                                                        <span
                                                            class={`type-${tera_type
                                                                .trim()
                                                                .replace(
                                                                    "Tera Type: ",
                                                                    "",
                                                                )
                                                                .toLowerCase()}`}
                                                        >
                                                            {tera_type
                                                                .trim()
                                                                .replace(
                                                                    "Tera Type: ",
                                                                    "",
                                                                )}
                                                        </span>
                                                        <br />
                                                    </>
                                                )}
                                            </For>
                                            {/* EVs */}
                                            <Show
                                                when={
                                                    set_item.mon?.hp !== 0 ||
                                                    set_item.mon?.atk !== 0 ||
                                                    set_item.mon?.def !== 0 ||
                                                    set_item.mon?.spa !== 0 ||
                                                    set_item.mon?.spd !== 0 ||
                                                    set_item.mon?.spe !== 0
                                                }
                                            >
                                                <span class="attr">EVs: </span>
                                                <Show
                                                    when={
                                                        set_item.mon?.hp !== 0
                                                    }
                                                >
                                                    <span class="stat-hp">
                                                        {set_item.mon?.hp} HP
                                                    </span>
                                                    <Show
                                                        when={
                                                            set_item.mon
                                                                ?.last_stat !==
                                                            "hp"
                                                        }
                                                    >
                                                        <span>/</span>
                                                    </Show>
                                                </Show>

                                                <Show
                                                    when={
                                                        set_item.mon?.atk !== 0
                                                    }
                                                >
                                                    <span class="stat-atk">
                                                        {set_item.mon?.atk} Atk
                                                    </span>
                                                    <Show
                                                        when={
                                                            set_item.mon
                                                                ?.last_stat !==
                                                            "atk"
                                                        }
                                                    >
                                                        <span>/</span>
                                                    </Show>
                                                </Show>
                                                <Show
                                                    when={
                                                        set_item.mon?.def !== 0
                                                    }
                                                >
                                                    <span class="stat-def">
                                                        {set_item.mon?.def} Def
                                                    </span>
                                                    <Show
                                                        when={
                                                            set_item.mon
                                                                ?.last_stat !==
                                                            "def"
                                                        }
                                                    >
                                                        <span>/</span>
                                                    </Show>
                                                </Show>
                                                <Show
                                                    when={
                                                        set_item.mon?.spa !== 0
                                                    }
                                                >
                                                    <span class="stat-spa">
                                                        {set_item.mon?.spa} SpA
                                                    </span>
                                                    <Show
                                                        when={
                                                            set_item.mon
                                                                ?.last_stat !==
                                                            "spa"
                                                        }
                                                    >
                                                        <span>/</span>
                                                    </Show>
                                                </Show>
                                                <Show
                                                    when={
                                                        set_item.mon?.spd !== 0
                                                    }
                                                >
                                                    <span class="stat-spd">
                                                        {set_item.mon?.spd} SpD
                                                    </span>
                                                    <Show
                                                        when={
                                                            set_item.mon
                                                                ?.last_stat !==
                                                            "spd"
                                                        }
                                                    >
                                                        <span>/</span>
                                                    </Show>
                                                </Show>
                                                <Show
                                                    when={
                                                        set_item.mon?.spe !== 0
                                                    }
                                                >
                                                    <span class="stat-spe">
                                                        {set_item.mon?.spe} Spe
                                                    </span>
                                                </Show>
                                                <br />
                                            </Show>
                                            {/* Nature */}
                                            <For
                                                each={set_item.mon?.other.filter(
                                                    (x) => x.includes("Nature"),
                                                )}
                                            >
                                                {(nature) => (
                                                    <>
                                                        <span>{nature}</span>
                                                        <br />
                                                    </>
                                                )}
                                            </For>
                                            {/* IVs */}
                                            <Show
                                                when={
                                                    set_item.mon
                                                        ?.last_stat_iv != null
                                                }
                                            >
                                                <span class="attr">IVs: </span>

                                                <Show
                                                    when={
                                                        set_item.mon?.hp_iv !==
                                                        null
                                                    }
                                                >
                                                    <span class="stat-hp">
                                                        {set_item.mon?.hp_iv} HP
                                                    </span>
                                                    <Show
                                                        when={
                                                            set_item.mon
                                                                ?.last_stat_iv !==
                                                            "hp"
                                                        }
                                                    >
                                                        <span>/</span>
                                                    </Show>
                                                </Show>

                                                <Show
                                                    when={
                                                        set_item.mon?.atk_iv !==
                                                        null
                                                    }
                                                >
                                                    <span class="stat-atk">
                                                        {set_item.mon?.atk_iv}{" "}
                                                        Atk
                                                    </span>
                                                    <Show
                                                        when={
                                                            set_item.mon
                                                                ?.last_stat_iv !==
                                                            "atk"
                                                        }
                                                    >
                                                        <span>/</span>
                                                    </Show>
                                                </Show>
                                                <Show
                                                    when={
                                                        set_item.mon?.def_iv !==
                                                        null
                                                    }
                                                >
                                                    <span class="stat-def">
                                                        {set_item.mon?.def_iv}{" "}
                                                        Def
                                                    </span>
                                                    <Show
                                                        when={
                                                            set_item.mon
                                                                ?.last_stat_iv !==
                                                            "def"
                                                        }
                                                    >
                                                        <span>/</span>
                                                    </Show>
                                                </Show>
                                                <Show
                                                    when={
                                                        set_item.mon?.spa_iv !==
                                                        null
                                                    }
                                                >
                                                    <span class="stat-spa">
                                                        {set_item.mon?.spa_iv}{" "}
                                                        SpA
                                                    </span>
                                                    <Show
                                                        when={
                                                            set_item.mon
                                                                ?.last_stat_iv !==
                                                            "spa"
                                                        }
                                                    >
                                                        <span>/</span>
                                                    </Show>
                                                </Show>
                                                <Show
                                                    when={
                                                        set_item.mon?.spd_iv !==
                                                        null
                                                    }
                                                >
                                                    <span class="stat-spd">
                                                        {set_item.mon?.spd_iv}{" "}
                                                        SpD
                                                    </span>
                                                    <Show
                                                        when={
                                                            set_item.mon
                                                                ?.last_stat_iv !==
                                                            "spd"
                                                        }
                                                    >
                                                        <span>/</span>
                                                    </Show>
                                                </Show>
                                                <Show
                                                    when={
                                                        set_item.mon?.spe_iv !==
                                                        null
                                                    }
                                                >
                                                    <span class="stat-spe">
                                                        {set_item.mon?.spe_iv}{" "}
                                                        Spe
                                                    </span>
                                                </Show>
                                                <br />
                                            </Show>
                                            {/* Moves */}
                                            <Index each={set_item.mon?.moves}>
                                                {(move, idx) => (
                                                    <>
                                                        <Show when={idx > 0}>
                                                            <br />
                                                        </Show>
                                                        <span
                                                            class={`type-${move().type1} font-extrabold`}
                                                            style={{
                                                                "font-size":
                                                                    "1.3rem",
                                                                "line-height":
                                                                    "1rem",
                                                            }}
                                                        >
                                                            -{" "}
                                                        </span>
                                                        <span>{move().name}</span>
                                                    </>
                                                )}
                                            </Index>
                                            <br class="display-none" style={{ "line-height": "0px" }} />
                                            <br class="display-none" style={{ "line-height": "0px" }} />
                                        </div>
                                    </article>
                                </Show>
                            )}
                        </For>
                    </main>

                </div>
            </Show >
        </>
    );
}

const root = document.getElementById("app");

if (!root) throw new Error("root element not found");

render(() => <App />, root);
