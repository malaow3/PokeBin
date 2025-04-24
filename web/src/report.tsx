import { createSignal, onMount, Show } from "solid-js";
import { render } from "solid-js/web";
import "./app.css";

const ReportPage = () => {
  const [pasteLink, setPasteLink] = createSignal("");
  const [password, setPassword] = createSignal("");
  const [isValidLink, setIsValidLink] = createSignal(true);
  const [done, setDone] = createSignal(false);
  const [errorMessage, setErrorMessage] = createSignal("");

  onMount(() => {
    const wsUrl = "/ws";
    const socket = new WebSocket(wsUrl);
    socket.onopen = async () => {
      console.log("WebSocket connected to:", wsUrl);
    };
  });

  const handleSubmit = async (e: { preventDefault: () => void }) => {
    e.preventDefault();

    setIsValidLink(true); // Reset validation status on each submit
    setErrorMessage(""); // Reset error message on each submit

    // Basic validation
    if (!pasteLink()) {
      alert("Please enter the PokeBin link.");
      return;
    }

    // Validate the link format against the full link
    try {
      const linkURL = new URL(pasteLink());
      if (linkURL.hostname !== new URL("https://pokebin.com").hostname) {
        throw new Error("Not a PokeBin link");
      }
      if (!/[a-zA-Z0-9-]+$/.test(linkURL.pathname.slice(1))) {
        throw new Error("Paste ID is invalid");
      }
    } catch (e) {
      setIsValidLink(false);
      setErrorMessage(
        "Please enter a valid PokeBin link in the format " +
          "https://pokebin.com/your-paste-id.",
      );
      return;
    }

    // Construct the report data
    interface ReportData {
      paste: string;
      password: string | null;
    }

    const reportData: ReportData = {
      paste: pasteLink(),
      password: password(),
    };

    if (password() === "") {
      reportData.password = null;
    }

    try {
      const response = await fetch("/report", {
        method: "POST",
        headers: {
          "Content-Type": "application/json", // Add content type header
        },
        body: JSON.stringify(reportData),
      });

      if (!response.ok) {
        const errorBody = await response.text();
        throw new Error(
          `Report submission failed: ${response.status} ${response.statusText} - ${errorBody}`,
        );
      }

      // Clear the form
      setPasteLink("");
      setPassword("");
      setDone(true);
    } catch (error) {
      console.error("Error during report submission:", error);
      setErrorMessage("Failed to submit report. Please try again.");
      setDone(false);
    }
  };

  return (
    <div class="text-white min-h-screen flex">
      <div class="container mx-auto px-4 py-8 max-w-xl">
        <Show
          when={!done()}
          fallback={
            <h1 class="text-2xl font-bold mb-2 text-center text-green-300">
              Report Submitted!
            </h1>
          }
        >
          <h1 class="text-3xl font-bold mb-2 text-center">Report a Paste</h1>
          <p class="mb-4 text-center">
            If you believe a paste violates our Terms of Service, please submit
            a report.
          </p>

          <form onSubmit={handleSubmit} class="max-w-xl mx-auto">
            <div class="mb-4">
              <label
                for="pasteLink"
                class="block text-gray-300 text-sm font-bold mb-2"
              >
                PokeBin Link:
              </label>
              <input
                type="text"
                id="pasteLink"
                value={pasteLink()}
                onInput={(e) => setPasteLink(e.target.value)}
                placeholder="https://pokebin.com/your-paste-id"
                class={`shadow appearance-none border rounded w-full py-2 px-3
                       leading-tight focus:outline-none
                       focus:shadow-outline bg-zinc-800 text-white border-zinc-600
                       ${isValidLink() ? "" : "border-red-500"}`}
              />
              <Show when={!isValidLink()}>
                <p class="text-red-500 text-xs italic">
                  Please enter a valid PokeBin link in the format
                  https://pokebin.com/your-paste-id.
                </p>
              </Show>
            </div>

            <div class="mb-6">
              <label
                for="password"
                class="block text-gray-300 text-sm font-bold mb-2"
              >
                Password (if applicable):
              </label>
              <input
                type="password"
                id="password"
                value={password()}
                onInput={(e) => setPassword(e.target.value)}
                placeholder="Enter password if the paste is protected"
                class="shadow appearance-none border rounded w-full py-2 px-3
                     leading-tight focus:outline-none
                     focus:shadow-outline bg-zinc-800 text-white border-zinc-600"
              />
            </div>

            <Show when={errorMessage()}>
              <div class="text-red-500 text-sm mb-4">{errorMessage()}</div>
            </Show>

            <div class="flex items-center justify-center">
              <button
                type="submit"
                class="bg-[#c2a8d4] hover:bg-[#9770b6] text-black font-bold py-2 px-4
                     rounded focus:outline-none focus:shadow-outline"
              >
                Submit Report
              </button>
            </div>
          </form>
        </Show>
      </div>
    </div>
  );
};

const root = document.getElementById("root");
if (root) {
  render(() => <ReportPage />, root);
}
