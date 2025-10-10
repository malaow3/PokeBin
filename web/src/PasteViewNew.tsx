import { type Paste, createQRCode } from "./web_wasm_helpers";
import Watermark from "./watermark";
import { type Accessor, createSignal, For, Show } from "solid-js";
import { updateSetting, type Settings } from "./settings";
import { SettingsForm } from "./settingsForm";
import { getId } from "./utils";

type Props = {
  paste: Accessor<Paste | null>;
  setSelectable: (value: boolean, id: string) => void;
  setShowNotes: (value: boolean) => void;
  showNotes: () => boolean;
  makeOpaqueOnFocus: () => void;
  makeTransparentOnMouseover: () => void;
  notesWidth: () => string;
  setNotesOpacity: (value: number) => void;
  notesOpacity: () => number;
  copyPaste: () => Promise<void>;
  setShowModal: (value: boolean) => void;
  showModal: () => boolean;
  sett: () => Settings;
  setSett: (value: Settings) => void;
  isEncrypted: () => boolean;
  handleCreateOts: () => void;
};

export default function PasteViewNew(props: Props) {
  const paste = props.paste;
  const setSelectable = props.setSelectable;
  const setShowNotes = props.setShowNotes;
  const showNotes = props.showNotes;
  const setNotesOpacity = props.setNotesOpacity;
  const makeOpaqueOnFocus = props.makeOpaqueOnFocus;
  const makeTransparentOnMouseover = props.makeTransparentOnMouseover;
  const notesWidth = props.notesWidth;
  const notesOpacity = props.notesOpacity;
  const copyPaste = props.copyPaste;
  const setShowModal = props.setShowModal;
  const showModal = props.showModal;
  const sett = props.sett;
  const setSett = props.setSett;
  const isEncrypted = props.isEncrypted;
  const handleCreateOts = props.handleCreateOts;

  const [working, setWorkingValue] = createSignal(false);

  const [showQrModal, setShowQrModal] = createSignal(false);
  const [qrImageUrl, setQrImageUrl] = createSignal("");
  const [copyStatus, setCopyStatus] = createSignal("Copy");
  const [screenshotStatus, setScreenshotStatusValue] =
    createSignal("Screenshot");

  function setWorking(working: boolean) {
    setWorkingValue(working);
  }

  function setScreenshotStatus(status: string) {
    setScreenshotStatusValue(status);
  }

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
                  style={{
                    "user-select": "none",
                    "min-width": "125px",
                  }}
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
              <div class="button-col">
                <button
                  style={{ "user-select": "none" }}
                  type="submit"
                  disabled={working()}
                  onClick={async () => {
                    console.log("Fetching screenshot...");
                    while (true) {
                      if (working()) return;
                      setWorking(true);
                      setScreenshotStatus("Generating...");

                      const id = getId();
                      const evtSource = new EventSource(
                        `/api/screenshot?id=${id}`,
                      );

                      evtSource.onmessage = (event) => {
                        const data = JSON.parse(event.data);
                        console.log(data);

                        if (data.status === "done") {
                          // Convert array to bytes →  blob
                          const byteArray = new Uint8Array(data.data);
                          const blob = new Blob([byteArray], {
                            type: "image/png",
                          });
                          const url = URL.createObjectURL(blob);

                          // Trigger download
                          const a = document.createElement("a");
                          a.href = url;
                          a.download = "screenshot.png";
                          document.body.appendChild(a);
                          a.click();
                          document.body.removeChild(a);

                          // Cleanup
                          URL.revokeObjectURL(url);
                          evtSource.close();
                          setWorking(false);
                          setScreenshotStatus("Screenshot");
                          return;
                        }

                        if (data.status === "waiting") {
                          alert(
                            "Your screenshot is queued, don't refresh the page! Your screenshot will be automatically downloaded once ready.",
                          );
                          setScreenshotStatus("Waiting...");
                        }
                      };

                      evtSource.onerror = (err) => {
                        console.error("SSE error:", err);
                        evtSource.close();
                        setWorking(false);
                        setScreenshotStatus("Screenshot");
                        return;
                      };
                    }
                  }}
                  class="cursor-pointer w-[175px] h-[30px] copy-button font-bold bg-[#c2a8d4] hover:bg-[#9770b6] text-black py-1 rounded"
                >
                  {screenshotStatus()}
                </button>

                <button
                  style={{ "user-select": "none" }}
                  type="submit"
                  onClick={async () => {
                    await copyPaste();
                    setCopyStatus("Copied!");
                    setTimeout(() => {
                      setCopyStatus("Copy");
                    }, 2000);
                  }}
                  class="cursor-pointer w-[175px] h-[30px] copy-button font-bold bg-[#c2a8d4] hover:bg-[#9770b6] text-black py-1 rounded"
                >
                  {copyStatus()}
                </button>
              </div>
              <div class="button-col">
                <button
                  class="cursor-pointer h-[30px] font-bold bg-[#c2a8d4] hover:bg-[#9770b6] text-black w-[175px] py-1 rounded"
                  style={{ "user-select": "none" }}
                  type="button"
                  onClick={() => setShowModal(true)}
                >
                  Settings
                </button>
                <button
                  class="cursor-pointer h-[30px] font-bold bg-[#c2a8d4] hover:bg-[#9770b6] text-black w-[175px] py-1 rounded"
                  style={{ "user-select": "none" }}
                  type="button"
                  onClick={async () => {
                    const location = window.location.href;
                    const id = location.substring(
                      location.lastIndexOf("/") + 1,
                    );
                    const url = `https://pokebin.com/${id}`;
                    const imgUrl = createQRCode(url);
                    if (imgUrl === undefined) {
                      return;
                    }
                    setQrImageUrl(imgUrl);
                    setShowQrModal(true);
                  }}
                >
                  QR
                </button>
              </div>
            </div>
          </div>
          <div class="main">
            <For each={currentPaste().pokemon}>
              {(pokemon) => {
                const stats: string[] = pokemon.evs.map((x) =>
                  x !== 0 ? x.toString() : "",
                );
                let allEmpty = true;
                for (const stat of stats) {
                  if (stat !== "") {
                    allEmpty = false;
                  }
                }
                // const nature = pokemon.nature;
                // if (natureMap[nature] !== null) {
                //   const indicies = natureMap[nature];
                //   const increasingIdx = indicies[0];
                //   const decreasingIdx = indicies[1];
                //   stats[increasingIdx] = `${stats[increasingIdx]}+`;
                //   stats[decreasingIdx] = `${stats[decreasingIdx]}-`;
                //   let last_stat_idx = 0;
                //   for (let i = 0; i < stats.length; i++) {
                //     const stat = stats[i];
                //     if (stat !== "") {
                //       last_stat_idx = i;
                //     }
                //   }
                //   switch (last_stat_idx) {
                //     case 0:
                //       pokemon.last_stat_ev = "hp";
                //       break;
                //     case 1:
                //       pokemon.last_stat_ev = "atk";
                //       break;
                //     case 2:
                //       pokemon.last_stat_ev = "def";
                //       break;
                //     case 3:
                //       pokemon.last_stat_ev = "spa";
                //       break;
                //     case 4:
                //       pokemon.last_stat_ev = "spd";
                //       break;
                //     case 5:
                //       pokemon.last_stat_ev = "spe";
                //       break;
                //     default:
                //       pokemon.last_stat_ev = "";
                //       break;
                //   }
                // }
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
                      </div>
                      <Show
                        when={pokemon.ability !== "" || pokemon.item !== ""}
                      >
                        <div class="attribute-line">
                          <Show when={pokemon.ability !== ""}>
                            <span>[{pokemon.ability}]</span>
                          </Show>
                          <Show when={pokemon.item !== ""}>
                            <span> @ </span>
                            <span
                              class="inline-element"
                              innerHTML={`${pokemon.item.trim()}`}
                            />
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
                      <Show when={!currentPaste().isOts && !allEmpty}>
                        <div class="attribute-line">
                          <span>EVs: </span>
                          <Show when={stats[0] !== ""}>
                            <span class="stat-hp">{stats[0]} HP</span>
                            <Show when={pokemon.last_stat_ev !== "hp"}>/</Show>
                          </Show>
                          <Show when={stats[1] !== ""}>
                            <span class="stat-atk">{stats[1]} Atk</span>
                            <Show when={pokemon.last_stat_ev !== "atk"}>/</Show>
                          </Show>
                          <Show when={stats[2] !== ""}>
                            <span class="stat-def">{stats[2]} Def</span>
                            <Show when={pokemon.last_stat_ev !== "def"}>/</Show>
                          </Show>
                          <Show when={stats[3] !== ""}>
                            <span class="stat-spa">{stats[3]} SpA</span>
                            <Show when={pokemon.last_stat_ev !== "spa"}>/</Show>
                          </Show>
                          <Show when={stats[4] !== ""}>
                            <span class="stat-spd">{stats[4]} SpD</span>
                            <Show when={pokemon.last_stat_ev !== "spd"}>/</Show>
                          </Show>
                          <Show when={stats[5] !== ""}>
                            <span class="stat-spe">{stats[5]} Spe</span>
                          </Show>
                        </div>
                        <Show when={pokemon.nature !== ""}>
                          <Show when={pokemon.nature.endsWith("Nature")}>
                            <div class="attribute-line">
                              <span>{pokemon.nature}</span>
                            </div>
                          </Show>
                          <Show when={!pokemon.nature.endsWith("Nature")}>
                            <div class="attribute-line">
                              <span>{pokemon.nature} Nature</span>
                            </div>
                          </Show>
                        </Show>
                        <Show when={pokemon.last_stat_iv !== ""}>
                          <div class="attribute-line">
                            <span>IVs: </span>
                            <Show when={pokemon.ivs[0] !== 31}>
                              <span>{pokemon.ivs[0]} HP</span>
                              <Show when={pokemon.last_stat_iv !== "hp"}>
                                <span style="font-size: 1px;"> </span>
                                <span>/</span>
                                <span style="font-size: 1px;"> </span>
                              </Show>
                            </Show>
                            <Show when={pokemon.ivs[1] !== 31}>
                              <span>{pokemon.ivs[1]} Atk</span>
                              <Show when={pokemon.last_stat_iv !== "atk"}>
                                <span style="font-size: 1px;"> </span>
                                <span>/</span>
                                <span style="font-size: 1px;"> </span>
                              </Show>
                            </Show>
                            <Show when={pokemon.ivs[2] !== 31}>
                              <span>{pokemon.ivs[2]} Def</span>
                              <Show when={pokemon.last_stat_iv !== "def"}>
                                <span style="font-size: 1px;"> </span>
                                <span>/</span>
                                <span style="font-size: 1px;"> </span>
                              </Show>
                            </Show>
                            <Show when={pokemon.ivs[3] !== 31}>
                              <span>{pokemon.ivs[3]} SpA</span>
                              <Show when={pokemon.last_stat_iv !== "spa"}>
                                <span style="font-size: 1px;"> </span>
                                <span>/</span>
                                <span style="font-size: 1px;"> </span>
                              </Show>
                            </Show>
                            <Show when={pokemon.ivs[4] !== 31}>
                              <span>{pokemon.ivs[4]} SpD</span>
                              <Show when={pokemon.last_stat_iv !== "spd"}>
                                <span style="font-size: 1px;"> </span>
                                <span>/</span>
                                <span style="font-size: 1px;"> </span>
                              </Show>
                            </Show>
                            <Show when={pokemon.ivs[5] !== 31}>
                              <span>{pokemon.ivs[5]} Spe</span>
                            </Show>
                          </div>
                        </Show>
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
                      <br
                        class="display-none"
                        style={{ "line-height": "-10px" }}
                      />
                    </div>
                  </article>
                );
              }}
            </For>
          </div>
          <br />
          <Watermark />
          <Show when={showModal()}>
            <div
              class="fixed inset-0 bg-black/20 backdrop-blur-sm flex items-center justify-center z-100 !text-white"
              onClick={() => setShowModal(false)}
              onKeyDown={(e) => e.stopPropagation()}
              tabindex="-1"
            >
              <div
                class="relative bg-zinc-800 rounded-lg p-6 max-w-lg w-full max-h-[90vh] overflow-y-auto shadow-lg"
                onClick={(e) => e.stopPropagation()}
                onKeyDown={(e) => e.stopPropagation()}
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
                <SettingsForm
                  settings={sett()}
                  onChange={(key, value) => {
                    updateSetting(key, value, sett, setSett);
                  }}
                >
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
                </SettingsForm>
              </div>
            </div>
          </Show>
          <Show when={showQrModal()}>
            <div
              class="fixed inset-0 bg-black/40 flex items-center justify-center z-200"
              onKeyDown={(e) => e.stopPropagation()}
              onClick={() => {
                setShowQrModal(false);
                // Clean up the object URL
                URL.revokeObjectURL(qrImageUrl());
                setQrImageUrl("");
              }}
              tabindex="-1"
            >
              <div
                class="bg-white rounded-lg p-6 shadow-lg relative"
                onClick={(e) => e.stopPropagation()}
                onKeyDown={(e) => e.stopPropagation()}
                tabindex="0"
              >
                <button
                  type="button"
                  class="absolute top-2 right-2 text-gray-500 hover:text-gray-700"
                  onClick={() => {
                    setShowQrModal(false);
                    URL.revokeObjectURL(qrImageUrl());
                    setQrImageUrl("");
                  }}
                  aria-label="Close QR modal"
                >
                  ✕
                </button>
                <img
                  id="qr-code"
                  src={qrImageUrl()}
                  alt="QR Code"
                  class="max-w-full max-h-[60vh] mx-auto"
                />
              </div>
            </div>
          </Show>
        </div>
      )}
    </Show>
  );
}
