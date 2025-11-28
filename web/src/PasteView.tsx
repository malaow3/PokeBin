import PasteViewBase from "./PasteViewBase";
import "./app.css";
import "./paste.css";
import PasteViewNew from "./PasteViewNew";
import { initSettings } from "./settings";
import { getId } from "./utils";
import { decrypt, initWasm } from "./wasm_helpers";
import {
    initWasm as initWebWasm,
    parsePaste,
    type Paste,
    utf8ToBase64,
    SavePasteToLastVisited,
} from "./web_wasm_helpers";
import {
    createSignal,
    createEffect,
    onCleanup,
    onMount,
    Switch,
    Match,
} from "solid-js";

function stripIvsEvs(pasteText: string): string {
    // Remove lines that start with "IVs:" or "EVs:" (case-insensitive, optional whitespace)
    return pasteText
        .split("\n")
        .filter((line) => !/^\s*(IVs:|EVs:)/i.test(line))
        .join("\n");
}

const PasteView = () => {
    const [paste, setPaste] = createSignal<Paste | null>(null);
    const [isEncrypted, setIsEncrypted] = createSignal(false);
    const [data, setData] = createSignal("");
    const [title, setTitle] = createSignal<string | null>(null);
    const [showNotes, setShowNotes] = createSignal(false);
    const [notesOpacity, setNotesOpacity] = createSignal(1.0);
    const [notesWidth, setNotesWidth] = createSignal("300px");
    const [showModal, setShowModal] = createSignal(false);

    const aspect_ratio = window.innerWidth / window.innerHeight;
    console.log("Aspect ratio:", aspect_ratio);
    console.log("Window width:", window.innerWidth);

    function updateThemeColor(darkMode: boolean) {
        const meta = document.getElementById("theme-color-meta");
        if (meta) {
            meta.setAttribute("content", darkMode ? "#000000" : "#f9f9f9");
        }
    }

    type PasteUpload = {
        title: string;
        author: string;
        notes: string;
        format: string;
        rental: string;
        content: string;
    };
    type FormUpload = {
        data: PasteUpload;
        encrypted: boolean;
    };

    async function handleCreateOts() {
        if (isEncrypted()) return;
        // Get the original paste text (from your `data` signal)
        const originalPaste = data();
        if (!originalPaste) return;

        // If the paste is encrypted, you may need to handle that separately.
        // For now, assume it's plain text or JSON string.
        let pasteObj: FormUpload;
        try {
            pasteObj = { encrypted: false, data: JSON.parse(originalPaste) };
        } catch {
            return;
        }

        // Remove IVs/EVs from the content
        pasteObj.data.content = stripIvsEvs(pasteObj.data.content);

        // Prepare form data
        const form = document.createElement("form");
        form.method = "POST";
        form.action = "/create";
        form.style.display = "none";

        // Helper to add a field
        function addField(name: string, value: string) {
            const input = document.createElement("input");
            input.type = "hidden";
            input.name = name;
            input.value = value;
            form.appendChild(input);
        }

        // Add all relevant fields
        const encoded = utf8ToBase64(JSON.stringify(pasteObj));
        addField("data", encoded);

        document.body.appendChild(form);
        form.submit();
    }

    const { sett, setSett } = initSettings();

    function makeTransparentOnMouseover() {
        setNotesOpacity(0.2);
    }

    function makeOpaqueOnFocus() {
        setNotesOpacity(1.0);
    }

    function decodeHtmlEntities(str: string): string {
        const txt = document.createElement("textarea");
        txt.innerHTML = str;
        const decoded = txt.value;
        txt.remove(); // remove from DOM (if it was ever attached)
        return decoded;
    }

    function updateWidths() {
        const main = document.getElementsByTagName("main")[0];
        const sidebar = document.getElementById("sidebar");
        const notes = document.getElementById("notes");

        if (!main && !sidebar && !notes) return;

        const articles = document.getElementsByTagName("article");
        let end = articles.length;
        if (articles.length > 4) {
            end = 4;
        }

        const windowWidth = window.innerWidth;
        for (let i = 0; i < end; i++) {
            if (windowWidth > 1024) {
                const margin_bottom = Math.floor(window.innerHeight * 0.02);
                articles[i].style.marginBottom = `${margin_bottom}px`;
            }
        }

        if (windowWidth <= 1024) {
            // Mobile layout
            setNotesWidth("300px");
        } else {
            // Desktop layout
            const calculatedWidth = windowWidth - 420;
            const width = Math.min(Math.max(calculatedWidth, 300), 600);
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

    async function copyPasteBase() {
        console.log("Copying paste to clipboard...");
        const main = document.getElementsByClassName("main")[0];

        if (!main) {
            return;
        }

        let text = "";
        const articles = main.querySelectorAll("article");

        articles.forEach((article, _) => {
            const monTitle = article.querySelector("#mon_title");
            if (monTitle) {
                text += `${monTitle.textContent?.trim()}\n`;
            }

            // Extract ability, level, shiny, tera type, etc.
            const attributeDivs = article.querySelectorAll(".attribute-line");
            attributeDivs.forEach((div, _) => {
                text += `${div.textContent?.trim()}\n`;
            });

            const moves = article.querySelectorAll(".move-line");
            moves.forEach((move, _) => {
                text += `${move.textContent?.trim()}\n`;
            });

            text += "\n"; // Add a newline between Pokemon entries
        });

        // Copy the data to the clipboard.
        console.log(text.trim());
        await navigator.clipboard.writeText(text.trim());
        console.log("Paste copied to clipboard.");
    }

    async function copyPasteNew() {
        console.log("Copying paste to clipboard...");
        const main = document.getElementsByClassName("main")[0];

        if (!main) {
            return;
        }

        let text = "";
        const articles = main.querySelectorAll("article");

        articles.forEach((article, _) => {
            const monTitle = article.querySelector("#mon_title");
            if (monTitle) {
                text += `${monTitle.textContent?.trim()}\n`;
            }

            const abilityItem = article.querySelector("#ability-item");
            if (abilityItem) {
                text += `${abilityItem.textContent?.trim()}\n`;
            }

            const moves = article.querySelectorAll(".move-line");
            moves.forEach((move, _) => {
                text += `${move.textContent?.trim()}\n`;
            });

            // Extract ability, level, shiny, tera type, etc.
            const attributeDivs = article.querySelectorAll(".attribute-line");
            attributeDivs.forEach((div, _) => {
                text += `${div.textContent?.trim()}\n`;
            });

            text += "\n"; // Add a newline between Pokemon entries
        });

        // Copy the data to the clipboard.
        console.log(text.trim());
        await navigator.clipboard.writeText(text.trim());
        console.log("Paste copied to clipboard.");
    }

    // Update document title when title changes
    createEffect(() => {
        const currentTitle = title();
        if (currentTitle) {
            document.title = decodeHtmlEntities(currentTitle);
        }

        window.addEventListener("resize", updateWidths);
    });

    createEffect(() => {
        // Only run if data is loaded
        if (!data()) return;
        // Re-parse with the current twoDImages setting
        const parsedPaste = parsePaste(data(), sett().twoDImages);
        setPaste(parsedPaste);
        if (parsedPaste) {
            setTitle(parsedPaste.title);
        }
    });

    function darkModeToggle() {
        const body = document.getElementsByTagName("body")[0];
        if (sett().darkMode) {
            body.classList.add("dark");
            body.classList.remove("light");
        } else {
            body.classList.add("light");
            body.classList.remove("dark");
        }
        updateThemeColor(sett().darkMode);
    }

    createEffect(() => {
        darkModeToggle();
    });

    onMount(async () => {
        const id = getId();
        const response = await fetch(`/${id}/json`);
        const json = await response.json();

        await initWasm();
        await initWebWasm();
        const wsUrl = "/ws";
        const socket = new WebSocket(wsUrl);
        socket.onopen = async () => {
            console.log("WebSocket connected to:", wsUrl);
        };

        if (json.encrypted) {
            setIsEncrypted(true);
            // Get user input via popup.
            let done = false;
            let promptMsg = "Enter password";
            while (!done) {
                let passkey = prompt(promptMsg, "");
                while (passkey === "" || passkey === null) {
                    promptMsg = "Enter password";
                    passkey = prompt(promptMsg, "");
                }
                const decrypted = decrypt(json.data, passkey as string);
                if (decrypted == null) {
                    promptMsg = "Invalid password";
                } else {
                    setData(decrypted);
                    done = true;
                }
            }
        } else {
            setData(JSON.stringify(json.data));
        }

        darkModeToggle();

        window.addEventListener("resize", updateWidths);
        updateWidths();

        onCleanup(() => {
            window.removeEventListener("resize", updateWidths);
        });

        const handleKeyDown = (e: KeyboardEvent) => {
            if (e.key === "Escape") {
                setShowModal(false);
            }
        };
        window.addEventListener("keydown", handleKeyDown);
        onCleanup(() => window.removeEventListener("keydown", handleKeyDown));

        const root = document.getElementById("root");
        if (root) {
            if (root.clientHeight <= window.innerHeight) {
                root.style.overflowY = "hidden";
            }
        }

        const paste_value = paste();
        if (paste_value !== null) {
            SavePasteToLastVisited(sett, setSett, paste_value);
        }
    });

    return (
        <Switch>
            <Match when={sett().newFormat}>
                <PasteViewNew
                    paste={paste}
                    setShowModal={setShowModal}
                    setSelectable={setSelectable}
                    setShowNotes={setShowNotes}
                    showNotes={showNotes}
                    makeOpaqueOnFocus={makeOpaqueOnFocus}
                    makeTransparentOnMouseover={makeTransparentOnMouseover}
                    notesWidth={notesWidth}
                    setNotesOpacity={setNotesOpacity}
                    notesOpacity={notesOpacity}
                    copyPaste={copyPasteNew}
                    showModal={showModal}
                    sett={sett}
                    setSett={setSett}
                    isEncrypted={isEncrypted}
                    handleCreateOts={handleCreateOts}
                />
            </Match>
            <Match when={!sett().newFormat}>
                <PasteViewBase
                    paste={paste}
                    setShowModal={setShowModal}
                    setSelectable={setSelectable}
                    setShowNotes={setShowNotes}
                    showNotes={showNotes}
                    makeOpaqueOnFocus={makeOpaqueOnFocus}
                    makeTransparentOnMouseover={makeTransparentOnMouseover}
                    notesWidth={notesWidth}
                    setNotesOpacity={setNotesOpacity}
                    notesOpacity={notesOpacity}
                    copyPaste={copyPasteBase}
                    showModal={showModal}
                    sett={sett}
                    setSett={setSett}
                    isEncrypted={isEncrypted}
                    handleCreateOts={handleCreateOts}
                />
            </Match>
        </Switch>
    );
};

export default PasteView;
