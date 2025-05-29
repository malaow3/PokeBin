import "./app.css";
import { onMount, createSignal, Show, createEffect } from "solid-js";
import { encrypt, initWasm } from "./wasm_helpers.ts";
import {
  initWasm as initWebWasm,
  validatePaste,
  utf8ToBase64,
} from "./web_wasm_helpers.ts";
import PatreonButton from "./patreon.tsx";
import logo from "../public/logo/large_logo_cropped.webp";

function updateThemeColor(dark: boolean) {
  let meta = document.querySelector('meta[name="theme-color"]');
  if (!meta) {
    meta = document.createElement("meta");
    meta.setAttribute("name", "theme-color");
    document.head.appendChild(meta);
  }
  meta.setAttribute("content", dark ? "#000000" : "#f9f9f9");
}

const App = () => {
  // Initialize refs with createSignal to track when they're defined
  const [form, setForm] = createSignal<HTMLFormElement | undefined>();
  const [paste, setPaste] = createSignal<HTMLTextAreaElement | undefined>();
  const [password, setPassword] = createSignal<HTMLInputElement | undefined>();
  const [title, setTitle] = createSignal<HTMLInputElement | undefined>();
  const [author, setAuthor] = createSignal<HTMLInputElement | undefined>();
  const [notes, setNotes] = createSignal<HTMLTextAreaElement | undefined>();
  const [format, setFormat] = createSignal<HTMLInputElement | undefined>();
  const [rental, setRental] = createSignal<HTMLInputElement | undefined>();
  const [data, setData] = createSignal<HTMLInputElement | undefined>();
  const [notesLabel, setNotesLabel] = createSignal<
    HTMLLabelElement | undefined
  >();
  const [footer, setFooter] = createSignal<HTMLDivElement | undefined>();
  const [top, setTop] = createSignal<HTMLDivElement | undefined>();
  const [belowNotes, setBelowNotes] = createSignal<
    HTMLDivElement | undefined
  >();
  const [total, setTotal] = createSignal<string>("");
  const [live, setLive] = createSignal<string>("");
  const [isReady, setIsReady] = createSignal(false);

  const darkModeString = localStorage.getItem("darkMode");
  let darkMode = true;
  if (darkModeString !== null) {
    darkMode = JSON.parse(darkModeString);
  }

  const [sett, _] = createSignal({
    darkMode: darkMode,
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

  function handleNotesDoubleClick() {
    const notesEl = notes();
    if (notesEl) {
      notesEl.style.height = "auto";
    }
  }

  function resizeNotes() {
    const notesEl = notes();
    const footerEl = footer();
    const topEl = top();
    const belowNotesEl = belowNotes();
    const notesLabelEl = notesLabel();

    if (notesEl && footerEl && topEl && belowNotesEl && notesLabelEl) {
      const labelHeight = notesLabelEl.clientHeight;
      const availableHeight =
        window.innerHeight -
        topEl.clientHeight -
        belowNotesEl.clientHeight -
        footerEl.clientHeight -
        labelHeight -
        16;
      notesEl.style.maxHeight = `${availableHeight}px`;
    }
  }

  onMount(async () => {
    darkModeToggle();
    const wsUrl = "/ws";
    const socket = new WebSocket(wsUrl);
    socket.onopen = async () => {
      console.log("WebSocket connected to:", wsUrl);
      setLive(await fetch("/live").then((r) => r.text()));
    };

    setTotal(await fetch("/total").then((r) => r.text()));

    await initWebWasm();
    await initWasm();
    setIsReady(true);

    const version = await fetch("/version");
    const versionText = await version.text();
    console.log(versionText);
  });

  createEffect(() => {
    if (isReady() && total() !== "" && live() !== "") {
      resizeNotes();
    }
  });

  async function handleForm(e: Event) {
    e.preventDefault();

    const start = Date.now();
    const pasteEl = paste();

    if (!pasteEl) return false;

    if (pasteEl.value === "") {
      alert("Paste cannot be empty!");
      return false;
    }

    const valid = validatePaste(pasteEl.value);
    console.log(valid);
    if (valid !== 0) {
      if (valid === -1) {
        alert("PokeBin encountered an issue! Please refresh and try again!");
        return false;
      }
      if (valid === 6) {
        alert("PokeBin contains too many Pokemon!");
        return false;
      }
      alert(
        "Not a valid PokeBin! If you believe this is incorrect, try re-copying from Showdown and please file an issue on GitHub.",
      );
      return false;
    }

    const passwordEl = password();
    const titleEl = title();
    const authorEl = author();
    const notesEl = notes();
    const formatEl = format();
    const rentalEl = rental();
    const dataEl = data();
    const formEl = form();

    if (
      !passwordEl ||
      !titleEl ||
      !authorEl ||
      !notesEl ||
      !formatEl ||
      !rentalEl ||
      !dataEl ||
      !formEl
    )
      return false;

    interface BaseDataJson {
      title: string;
      author: string;
      notes: string;
      format: string;
      rental: string;
      content: string;
    }

    interface FormData {
      encrypted: boolean;
      data: BaseDataJson | string;
    }

    let paste_string: string = pasteEl.value;
    paste_string = paste_string.trim();

    const base_data = {
      title: titleEl.value,
      author: authorEl.value,
      notes: notesEl.value,
      format: formatEl.value,
      rental: rentalEl.value,
      content: paste_string,
    };

    const form_data: FormData = {
      encrypted: false,
      data: base_data,
    };

    if (passwordEl.value === "") {
      const jsonString = JSON.stringify(form_data);
      const encoded = utf8ToBase64(jsonString);
      dataEl.value = encoded;
      const end = Date.now();
      console.log(`Processing took ${end - start}ms`);
      formEl.submit();
      return true;
    }

    const password_value = passwordEl.value;
    const form_content = JSON.stringify(base_data);
    const encrypted = encrypt(form_content, password_value);

    if (encrypted) {
      form_data.encrypted = true;
      form_data.data = encrypted;
    } else {
      throw new Error("Encryption failed");
    }

    const jsonString = JSON.stringify(form_data);
    const encoded = utf8ToBase64(jsonString);
    dataEl.value = encoded;
    passwordEl.disabled = true;
    const end = Date.now();
    console.log(`Processing took ${end - start}ms`);
    formEl.submit();
    return true;
  }

  return (
    <Show when={total() !== "" && live() !== ""}>
      <main class="min-h-screen flex flex-col overflow-auto bg-[#f9f9f9] dark:bg-zinc-950 text-black dark:text-white">
        <form
          ref={setForm}
          onSubmit={(e) => handleForm(e)}
          action="/create"
          method="post"
          id="form"
          class="flex-1 flex md:flex-row flex-col overflow-auto"
        >
          <textarea
            ref={setPaste}
            id="paste"
            name="paste"
            placeholder="Paste your tournament winning team here!"
            class="bg-white dark:bg-zinc-950 m-0 p-3 box-border text-black dark:text-white font-mono
        resize-none outline-none border-none md:flex-1 h-[40vh] md:h-auto"
          />
          <div class="md:w-[28rem] w-full bg-[#f9f9f9] dark:bg-zinc-900 text-black dark:text-white flex flex-col p-4 overflow-y-auto">
            <div class="flex-1 flex flex-col">
              <div ref={setTop}>
                <div class="flex justify-center items-center mb-2">
                  <div class="w-[300px] aspect-[2/1]">
                    <img
                      src={logo}
                      style={{
                        height: "125px",
                        width: "290px",
                      }}
                      class="border-none outline-none shadow-none"
                      alt="PokeBin Logo"
                    />
                  </div>
                </div>

                <div class="flex-1 flex flex-col gap-4">
                  <div class="flex flex-row items-center gap-3">
                    <label for="title" class="w-20 text-right font-medium">
                      Title
                    </label>
                    <input
                      ref={setTitle}
                      type="text"
                      name="title"
                      id="title"
                      autocomplete="off"
                      class="flex-1 text-sm rounded border border-zinc-300 dark:border-zinc-600 bg-white dark:bg-zinc-700
                  text-black dark:text-white outline-none focus:border-zinc-500 px-2 py-1"
                    />
                  </div>

                  <div class="flex flex-row items-center gap-3">
                    <label for="author" class="w-20 text-right font-medium">
                      Author
                    </label>
                    <input
                      ref={setAuthor}
                      type="text"
                      name="author"
                      id="author"
                      autocomplete="off"
                      class="flex-1 text-sm rounded border border-zinc-300 dark:border-zinc-600 bg-white dark:bg-zinc-700
                  text-black dark:text-white outline-none focus:border-zinc-500 px-2 py-1"
                    />
                  </div>

                  <div class="flex flex-row items-center gap-3">
                    <label for="rental" class="w-20 text-right  font-medium">
                      Rental
                    </label>
                    <input
                      ref={setRental}
                      type="text"
                      name="rental"
                      id="rental"
                      autocomplete="off"
                      class="flex-1 rounded border border-zinc-300 dark:border-zinc-600 bg-white dark:bg-zinc-700
                        text-black dark:text-white outline-none focus:border-zinc-500 px-2 py-1"
                      minLength="6"
                      maxLength="6"
                    />
                  </div>

                  <div class="flex flex-row items-center gap-3">
                    <label for="format" class="w-20 text-right font-medium">
                      Format
                    </label>
                    <input
                      ref={setFormat}
                      type="text"
                      name="format"
                      id="format"
                      autocomplete="off"
                      class="flex-1 rounded border border-zinc-300 dark:border-zinc-600 bg-white dark:bg-zinc-700
                        text-black dark:text-white outline-none focus:border-zinc-500 px-2 py-1"
                    />
                  </div>

                  <div class="flex flex-row items-start gap-3">
                    <label
                      ref={setNotesLabel}
                      for="notes"
                      class="w-20 text-right font-medium pt-1"
                    >
                      Notes
                    </label>
                    <textarea
                      ref={setNotes}
                      id="notes"
                      name="notes"
                      rows="4"
                      onDblClick={handleNotesDoubleClick}
                      autocomplete="off"
                      class="flex-1 text-sm rounded border border-zinc-300 dark:border-zinc-600 bg-white dark:bg-zinc-700
                  text-black dark:text-white outline-none focus:border-zinc-500 px-2 py-1 resize-y
                  min-h-[100px] max-h-[200px] md:max-h-none"
                    />
                  </div>

                  <div
                    class="flex flex-row items-center gap-3"
                    ref={setBelowNotes}
                  >
                    <label for="password" class="w-20 text-right  font-medium">
                      Password
                    </label>
                    <input
                      ref={setPassword}
                      type="text"
                      name="password"
                      id="password"
                      autocomplete="off"
                      class="flex-1 rounded border border-zinc-300 dark:border-zinc-600 bg-white dark:bg-zinc-700
                        text-black dark:text-white outline-none focus:border-zinc-500 px-2 py-1"
                    />
                  </div>

                  <div class="mt-4">
                    <button
                      type="submit"
                      class="w-full bg-[#c2a8d4] hover:bg-[#9770b6] text-black font-bold
                         py-2 px-4 rounded"
                    >
                      Submit Paste!
                    </button>
                  </div>

                  <input
                    ref={setData}
                    type="text"
                    hidden
                    name="data"
                    id="data"
                  />
                </div>
              </div>
            </div>

            <div
              ref={setFooter}
              class="mt-8 pt-6 flex flex-col items-center space-y-1"
            >
              <Show when={live() !== ""}>
                <h1 class="text-sm font-bold text-[#c2a8d4]">
                  {live()} active PokeBin users!
                </h1>
              </Show>
              <Show when={total() !== ""}>
                <h1 class="text-sm font-bold text-[#c2a8d4]">
                  {total()} total PokeBins created!
                </h1>
              </Show>
              <div>
                <PatreonButton />
              </div>
              <a
                href="/about"
                class="text-[#c2a8d4] hover:text-[#9770b6] text-base"
              >
                About PokeBin
              </a>
              <a
                href="/settings"
                class="text-[#c2a8d4] hover:text-[#9770b6] text-base"
              >
                Settings
              </a>
              <span class="text-gray-600 opacity-20 text-xs">
                © Nelvana LLC
              </span>
            </div>
          </div>
        </form>
      </main>
    </Show>
  );
};

export default App;
