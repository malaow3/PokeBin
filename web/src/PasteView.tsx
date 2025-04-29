import {
  createSignal,
  createEffect,
  onCleanup,
  onMount,
  For,
  Show,
} from "solid-js";
import "./app.css";
import "./paste.css";
import Watermark from "./watermark";
import { decrypt, initWasm, parsePaste, type Paste } from "./helpers";

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
    const encoded = btoa(
      decodeURIComponent(encodeURIComponent(JSON.stringify(pasteObj))),
    );
    addField("data", encoded);

    document.body.appendChild(form);
    form.submit();
  }

  const moveColorsString = localStorage.getItem("moveColors");
  let moveColors = true;
  if (moveColorsString !== null) {
    moveColors = JSON.parse(moveColorsString);
  }

  const twoDImagesString = localStorage.getItem("twoDImages");
  let twoDImages = false;
  if (twoDImagesString !== null) {
    twoDImages = JSON.parse(twoDImagesString);
  }

  const darkModeString = localStorage.getItem("darkMode");
  let darkMode = true;
  if (darkModeString !== null) {
    darkMode = JSON.parse(darkModeString);
  }

  const [sett, setSett] = createSignal({
    moveColors: moveColors,
    twoDImages: twoDImages,
    darkMode: darkMode,
  });

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

  async function copyPaste() {
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
    await navigator.clipboard.writeText(text.trim());
    console.log(text.trim());
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
  }

  createEffect(() => {
    darkModeToggle();
  });

  onMount(async () => {
    const url = window.location.href;
    const items = url.split("/");
    const id = items[items.length - 1];
    const response = await fetch(`/${id}/json`);
    const json = await response.json();

    await initWasm();
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
  });

  return (
    <Show when={paste()}>
      {(currentPaste) => (
        <div class="content-wrapper">
          <div class="side-content" id="sidebar">
            <div class="sidebar-inner md:ml-10 md:mr-2">
              <Show
                when={
                  currentPaste().title !== "" ||
                  currentPaste().author !== "" ||
                  currentPaste().format !== "" ||
                  currentPaste().rental !== ""
                }
              >
                <div
                  role="note"
                  class="metadata"
                  id="metadata"
                  style={{ "user-select": "none" }}
                  onMouseOver={() => setSelectable(true, "metadata")}
                  onFocus={() => setSelectable(true, "metadata")}
                  onMouseOut={() => setSelectable(false, "metadata")}
                  onBlur={() => setSelectable(false, "metadata")}
                >
                  <Show when={currentPaste().title !== ""}>
                    <h1
                      class="text-[#c2a8d4] text-2xl font-semibold"
                      id="title"
                      style={{ "user-select": "none" }}
                      aria-label={currentPaste().title}
                      innerHTML={currentPaste().title}
                    />
                  </Show>
                  <Show when={currentPaste().author !== ""}>
                    <p
                      class="text-base"
                      id="author"
                      style={{ "user-select": "none" }}
                      innerHTML={`By: ${currentPaste().author}`}
                    />
                  </Show>
                  <Show when={currentPaste().format !== ""}>
                    <p
                      class="text-base"
                      id="format"
                      style={{ "user-select": "none" }}
                    >
                      Format: {currentPaste().format}
                    </p>
                  </Show>
                  <Show when={currentPaste().rental !== ""}>
                    <p
                      class="text-base"
                      id="rental"
                      style={{ "user-select": "none" }}
                    >
                      Rental: {currentPaste().rental}
                    </p>
                  </Show>
                </div>
              </Show>
              <div class="notes-section my-1">
                <Show when={currentPaste().notes !== ""}>
                  <button
                    class="cursor-pointer h-[30px] font-bold bg-[#c2a8d4] hover:bg-[#9770b6] text-black w-[175px] mt-1 py-1 border-none rounded"
                    type="button"
                    onClick={() => {
                      setShowNotes(!showNotes());
                      const notes =
                        document.getElementsByClassName("notes-content");
                      if (notes.length > 0) {
                        const notes_obj = notes[0] as HTMLElement;
                        if (notes_obj.getBoundingClientRect().top < 0) {
                          notes_obj.style.top = "0px";
                        }
                      }

                      if (showNotes()) {
                        setNotesOpacity(1.0);
                      }
                    }}
                  >
                    {showNotes() ? "Hide notes" : "Show notes"}
                  </button>
                  <Show when={showNotes()}>
                    <div
                      role="note"
                      class="notes-content bg-zinc-600 border border-ccc p-5 rounded shadow-lg z-20"
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
                        class="!text-white"
                        innerHTML={currentPaste().notes.replace(
                          /\n/g,
                          "<br />",
                        )}
                      />
                    </div>
                  </Show>
                </Show>
              </div>
            </div>
            <div id="buttons">
              <button
                style={{ "user-select": "none" }}
                type="submit"
                onClick={copyPaste}
                class="w-[175px] h-[30px] copy-button font-bold bg-[#c2a8d4] hover:bg-[#9770b6] text-black py-1 rounded mb-1"
              >
                Copy
              </button>
              <br />
              <button
                class="cursor-pointer h-[30px] font-bold bg-[#c2a8d4] hover:bg-[#9770b6] text-black w-[175px] mt-1 py-1 border-none rounded"
                style={{ "user-select": "none" }}
                type="button"
                onClick={() => setShowModal(true)}
              >
                Settings
              </button>
            </div>
          </div>
          <div class="main">
            <For each={currentPaste().pokemon}>
              {(pokemon) => {
                return (
                  <article>
                    <div class="img mr-2">
                      <Show when={pokemon.item_image !== ""}>
                        <span class="img-item" style={pokemon.item_image} />
                      </Show>
                      <img
                        class="img-pokemon"
                        src={pokemon.pokemon_image}
                        alt={pokemon.name}
                      />
                    </div>

                    <div class="paste">
                      <div id="mon_title">
                        <Show
                          when={pokemon.nickname !== ""}
                          fallback={
                            <>
                              <span
                                class={`type-${pokemon.type1} inline-element`}
                              >
                                {pokemon.name}
                              </span>
                              <Show when={pokemon.gender !== ""}>
                                <span
                                  innerHTML={` (<span class="inline-element gender-${pokemon.gender}">${pokemon.gender}</span>)`}
                                />
                              </Show>
                            </>
                          }
                        >
                          {pokemon.nickname} (
                          <span class={`type-${pokemon.type1} inline-element`}>
                            {pokemon.name}
                          </span>
                          )
                          <Show when={pokemon.gender !== ""}>
                            <span
                              innerHTML={` (<span class="inline-element gender-${pokemon.gender}">${pokemon.gender}</span>)`}
                            />
                          </Show>
                        </Show>
                        <Show when={pokemon.item !== ""}>
                          <span> @ </span>
                          <span
                            class="inline-element"
                            innerHTML={`${pokemon.item.trim()}`}
                          />
                        </Show>
                      </div>

                      <Show when={pokemon.ability !== ""}>
                        <div class="attribute-line">
                          <span class="attr">Ability:</span> {pokemon.ability}
                        </div>
                      </Show>
                      <Show when={pokemon.level !== 100}>
                        <div class="attribute-line">
                          <span class="attr">Level:</span> {pokemon.level}
                        </div>
                      </Show>
                      <Show when={pokemon.shiny !== ""}>
                        <div class="attribute-line">
                          <span class="attr">Shiny:</span> {pokemon.shiny}
                        </div>
                      </Show>
                      <Show when={pokemon.hidden_power !== ""}>
                        <div class="attribute-line">
                          <span class="attr">Hidden Power:</span>{" "}
                          <span class={`type-${pokemon.hidden_power}`}>
                            {pokemon.hidden_power}
                          </span>
                        </div>
                      </Show>
                      <Show when={pokemon.tera_type !== ""}>
                        <div class="attribute-line">
                          <span class="attr">Tera Type:</span>{" "}
                          <span class={`type-${pokemon.tera_type}`}>
                            {pokemon.tera_type}
                          </span>
                        </div>
                      </Show>
                      <Show when={pokemon.last_stat_ev !== ""}>
                        <div class="attribute-line">
                          EVs:&nbsp;
                          <Show when={pokemon.evs[0] !== 0}>
                            <span class="stat-hp">{pokemon.evs[0]} HP</span>
                            <Show when={pokemon.last_stat_ev !== "hp"}>/</Show>
                          </Show>
                          <Show when={pokemon.evs[1] !== 0}>
                            <span class="stat-atk">{pokemon.evs[1]} Atk</span>
                            <Show when={pokemon.last_stat_ev !== "atk"}>/</Show>
                          </Show>
                          <Show when={pokemon.evs[2] !== 0}>
                            <span class="stat-def">{pokemon.evs[2]} Def</span>
                            <Show when={pokemon.last_stat_ev !== "def"}>/</Show>
                          </Show>
                          <Show when={pokemon.evs[3] !== 0}>
                            <span class="stat-spa">{pokemon.evs[3]} SpA</span>
                            <Show when={pokemon.last_stat_ev !== "spa"}>/</Show>
                          </Show>
                          <Show when={pokemon.evs[4] !== 0}>
                            <span class="stat-spd">{pokemon.evs[4]} SpD</span>
                            <Show when={pokemon.last_stat_ev !== "spd"}>/</Show>
                          </Show>
                          <Show when={pokemon.evs[5] !== 0}>
                            <span class="stat-spe">{pokemon.evs[5]} Spe</span>
                          </Show>
                        </div>
                      </Show>

                      <Show when={pokemon.nature !== ""}>
                        <div class="attribute-line">{pokemon.nature}</div>
                      </Show>

                      <Show when={pokemon.last_stat_iv !== ""}>
                        <div class="attribute-line">
                          IVs:&nbsp;
                          <Show when={pokemon.ivs[0] !== 31}>
                            {pokemon.ivs[0]} HP
                            <Show when={pokemon.last_stat_iv !== "hp"}>
                              &nbsp;/&nbsp;
                            </Show>
                          </Show>
                          <Show when={pokemon.ivs[1] !== 31}>
                            {pokemon.ivs[1]} Atk
                            <Show when={pokemon.last_stat_iv !== "atk"}>
                              &nbsp;/&nbsp;
                            </Show>
                          </Show>
                          <Show when={pokemon.ivs[2] !== 31}>
                            {pokemon.ivs[2]} Def
                            <Show when={pokemon.last_stat_iv !== "def"}>
                              &nbsp;/&nbsp;
                            </Show>
                          </Show>
                          <Show when={pokemon.ivs[3] !== 31}>
                            {pokemon.ivs[3]} SpA
                            <Show when={pokemon.last_stat_iv !== "spa"}>
                              &nbsp;/&nbsp;
                            </Show>
                          </Show>
                          <Show when={pokemon.ivs[4] !== 31}>
                            {pokemon.ivs[4]} SpD
                            <Show when={pokemon.last_stat_iv !== "spd"}>
                              &nbsp;/&nbsp;
                            </Show>
                          </Show>
                          <Show when={pokemon.ivs[5] !== 31}>
                            {pokemon.ivs[5]} Spe
                          </Show>
                        </div>
                      </Show>

                      <For each={pokemon.moves}>
                        {(move) => (
                          <div class="move-line">
                            <Show
                              when={sett().moveColors}
                              fallback={
                                <>
                                  <span class={`type-${move.type1}`}>-</span>
                                  <span style={{ color: "white" }}>
                                    {" "}
                                    {move.name}
                                  </span>
                                </>
                              }
                            >
                              <span class={`type-${move.type1}`}>
                                - {move.name}
                              </span>
                            </Show>
                          </div>
                        )}
                      </For>
                      <br
                        class="display-none"
                        style={{ "line-height": "0px" }}
                      />
                      <br
                        class="display-none"
                        style={{ "line-height": "0px" }}
                      />
                    </div>
                  </article>
                );
              }}
            </For>
          </div>
          <Watermark />
          <Show when={showModal()}>
            <div
              class="fixed inset-0 bg-black/20 backdrop-blur-sm flex items-center justify-center z-100 !text-white"
              onClick={() => setShowModal(false)}
              onKeyDown={(e) => e.stopPropagation()}
              tabindex="-1"
            >
              <div
                class="relative bg-white dark:bg-zinc-800 rounded-lg p-6 max-w-lg w-full max-h-[90vh] overflow-y-auto shadow-lg"
                onClick={(e) => e.stopPropagation()}
                onKeyDown={() => {}}
                tabindex="0"
              >
                <button
                  type="button"
                  class="absolute top-2 right-2 text-gray-500 hover:text-gray-700 dark:hover:text-gray-300"
                  onClick={() => setShowModal(false)}
                  aria-label="Close modal"
                >
                  ✕
                </button>
                <h2 class="text-xl font-semibold mb-4">Settings</h2>
                <div class="flex flex-col gap-2 w-60">
                  <div class="flex flex-row items-center gap-4">
                    <label for="colors" class="font-medium cursor-pointer w-32">
                      Move colors
                    </label>
                    <input
                      id="colors"
                      name="colors"
                      type="checkbox"
                      class="align-middle"
                      checked={sett().moveColors}
                      onChange={(e) => {
                        const value = JSON.stringify(e.target.checked);
                        localStorage.setItem("moveColors", value);
                        setSett({
                          ...sett(),
                          moveColors: e.target.checked,
                        });
                      }}
                    />
                  </div>
                  <div class="flex flex-row items-center gap-4">
                    <label
                      for="twoDImages"
                      class="font-medium cursor-pointer w-32"
                    >
                      2D images
                    </label>
                    <input
                      id="twoDImages"
                      name="twoDImages"
                      type="checkbox"
                      class="align-middle"
                      checked={sett().twoDImages}
                      onChange={(e) => {
                        const value = JSON.stringify(e.target.checked);
                        localStorage.setItem("twoDImages", value);
                        setSett({
                          ...sett(),
                          twoDImages: e.target.checked,
                        });
                      }}
                    />
                  </div>
                  <div class="flex flex-row items-center gap-4">
                    <label
                      for="darkMode"
                      class="font-medium cursor-pointer w-32"
                    >
                      Dark Mode
                    </label>
                    <input
                      id="darkMode"
                      name="darkMode"
                      type="checkbox"
                      class="align-middle"
                      checked={sett().darkMode}
                      onChange={(e) => {
                        const value = JSON.stringify(e.target.checked);
                        localStorage.setItem("darkMode", value);
                        setSett({
                          ...sett(),
                          darkMode: e.target.checked,
                        });
                      }}
                    />
                  </div>
                </div>
                <Show when={!currentPaste().isOts && !isEncrypted()}>
                  <div class="flex flex-row gap-4 align-middle mt-2">
                    <button
                      type="button"
                      onClick={handleCreateOts}
                      class="bg-[#c2a8d4] hover:bg-[#9770b6] text-black px-4 py-0 rounded text-base font-bold"
                    >
                      Create OTS
                    </button>
                  </div>
                </Show>
              </div>
            </div>
          </Show>
        </div>
      )}
    </Show>
  );
};

export default PasteView;
