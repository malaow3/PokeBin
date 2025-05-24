import { createSignal, onCleanup, createEffect } from "solid-js";
import { render } from "solid-js/web";
import Upload from "./Upload";
import PokebinImport from "./Import";
import OtsBattleUpload from "./OtsBattleUpload";

export const pokebin_url = "https://pokebin.com";
console.info(`POKEBIN: ${pokebin_url}`);

function processDetails(detailsElement: Element | ChildNode) {
  let textContent = "";
  const children = detailsElement.childNodes;
  for (let i = 0; i < children.length; i++) {
    const node = children[i];
    // Skip if the node is a <summary> element
    if (node.nodeName.toLowerCase() === "summary") {
      continue;
    }

    // If the node is a text node, add its text
    if (node.nodeType === Node.TEXT_NODE) {
      textContent += node.nodeValue;
    }

    // If the node is a <br>, add a newline
    if (node.nodeName.toLowerCase() === "br") {
      textContent += "\n";
    }
  }

  return textContent;
}

function waitForRoom() {
  return new Promise((resolve) => {
    function check() {
      // @ts-ignore
      if (window.room?.curTeam) {
        // @ts-ignore
        resolve(window.room);
        // @ts-ignore
      } else if (window.PS.room?.team) {
        // @ts-ignore
        resolve(window.PS.room);
        // @ts-ignore
        console.log("POKEBIN: ", window.PS.room);
      } else {
        setTimeout(check, 100);
      }
    }
    check();
  });
}

function App() {
  const [mutations, setMutations] = createSignal<MutationRecord[]>([]);

  const observer = new MutationObserver((mutationsList) => {
    setMutations(mutationsList);
  });

  const config: MutationObserverInit = { childList: true, subtree: true };
  observer.observe(document.body, config);

  onCleanup(() => {
    observer.disconnect();
  });

  createEffect(() => {
    (async () => {
      for (const mutation of mutations()) {
        if (mutation.type === "childList") {
          const addedNodes = mutation.addedNodes;
          for (let i = 0; i < addedNodes.length; i++) {
            const node = addedNodes[i];
            if (node.nodeType === Node.ELEMENT_NODE) {
              let uploadAndImportNotFound = true;

              // Classic UI: Upload button
              const targetButton = (node as Element).querySelector(
                'button[name="validate"]',
              );
              if (
                targetButton &&
                !targetButton.nextElementSibling?.id?.includes("pokebin-upload")
              ) {
                const pokebinUpload = document.createElement("div");
                pokebinUpload.id = "pokebin-upload";
                await waitForRoom();
                render(
                  () => <Upload pokebin_url={pokebin_url} />,
                  pokebinUpload,
                );
                targetButton.insertAdjacentElement("afterend", pokebinUpload);
                uploadAndImportNotFound = false;
              }

              // Classic UI: Import button
              const targetItem = (node as Element).querySelector(
                'li[class="format-select"]',
              );
              if (
                targetItem &&
                !targetItem.previousElementSibling?.id?.includes(
                  "pokebin-import",
                )
              ) {
                const pokebinImport = document.createElement("div");
                pokebinImport.id = "pokebin-import";
                render(() => <PokebinImport />, pokebinImport);
                targetItem.insertAdjacentElement("beforebegin", pokebinImport);
                uploadAndImportNotFound = false;
              }

              // New UI update
              if (uploadAndImportNotFound) {
                const target = (node as Element).querySelector(
                  'ul[class="tabbar"]',
                );

                if (target) {
                  console.log("POKEBIN: ", target);
                  // Insert PokebinImport if not present
                  if (document.getElementById("pokebin-import") === null) {
                    const pokebinImport = document.createElement("div");
                    pokebinImport.id = "pokebin-import";
                    render(() => <PokebinImport newUI={true} />, pokebinImport);
                    target.insertAdjacentElement("beforebegin", pokebinImport);
                  }
                  // Insert PokebinUpload if not present
                  if (document.getElementById("pokebin-upload") === null) {
                    const pokebinUpload = document.createElement("div");
                    pokebinUpload.id = "pokebin-upload";
                    console.log("POKEBIN: Waiting for room");
                    await waitForRoom();
                    render(
                      () => <Upload pokebin_url={pokebin_url} newUI={true} />,
                      pokebinUpload,
                    );
                    target.insertAdjacentElement("beforebegin", pokebinUpload);
                    // const br = document.createElement("br");
                    // pokebinUpload.insertAdjacentElement("afterend", br);
                  }
                }
              }

              // OTS Battle Upload logic
              let format = "";
              const details = (node as Element).querySelectorAll(
                "div.battle-log details",
              );
              // @ts-ignore
              // biome-ignore lint/complexity/noBannedTypes: window.BattleFormats is a global JSON object
              const battleFormats: Object = window.BattleFormats;
              type FormatItem = {
                id: string;
                name: string;
              };

              for (let j = 0; j < details.length; j++) {
                const child = details[j];
                console.log("POKEBIN: ", child);
                const textContent = processDetails(child);

                const summary = child.querySelector("summary");
                if (summary) {
                  const user = summary.textContent?.slice(
                    "Open Team Sheet for ".length,
                  );
                  let id: string;
                  // @ts-ignore
                  if (window.PS.room) {
                    // @ts-ignore
                    id = window.PS.room.id;
                  } else {
                    // @ts-ignore
                    id = window.room.id;
                  }
                  const button_id = `${user}-${id}`;
                  const existing_button = child.querySelector(`#${button_id}`);
                  if (!existing_button) {
                    const items = document.querySelectorAll(
                      "div.battle-log small",
                    );

                    for (let j = 0; j < items.length; j++) {
                      const item = items[j];
                      if (item.textContent?.includes("Format:")) {
                        const parent = item.parentElement;
                        const formatText =
                          parent?.querySelector("strong")?.textContent;

                        for (const [_, value] of Object.entries(
                          battleFormats,
                        )) {
                          const formatItemObject =
                            value as unknown as FormatItem;
                          if (formatItemObject.name === formatText) {
                            format = formatItemObject.id;
                            if (format.endsWith("bo3")) {
                              format = format.slice(0, -3);
                            }
                            break;
                          }
                        }
                        if (format !== "") {
                          break;
                        }
                      }
                    }
                    const otsUpload = document.createElement("div");
                    otsUpload.id = button_id;
                    if (user && textContent) {
                      render(
                        () => (
                          <OtsBattleUpload
                            author={user}
                            text={textContent}
                            pokebin_url={pokebin_url}
                            format={format}
                            id={button_id}
                          />
                        ),
                        otsUpload,
                      );
                      summary.insertAdjacentElement("afterend", otsUpload);
                    }
                  }
                } else {
                  console.log("POKEBIN: NO SUMMARY");
                }
              }
            }
          }
        }
      }
    })();
  });

  return null;
}

render(() => <App />, document.body);
