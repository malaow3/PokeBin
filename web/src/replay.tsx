import { createSignal, For, onMount } from "solid-js";
import { render } from "solid-js/web";
import "./app.css";

type Replay = {
  id: string;
  password?: string;
  format: string;
  players: string[];
  private: number;
  uploadtime: number;
};

export default function ReplayFetcher() {
  const [name, setName] = createSignal("");
  const [pass, setPass] = createSignal("");
  const [loading, setLoading] = createSignal(false);
  const [error, setError] = createSignal<string | null>(null);
  const [replays, setReplays] = createSignal<Replay[]>([]);

  function getChallstr() {
    return new Promise((resolve, reject) => {
      const ws = new WebSocket("wss://sim3.psim.us/showdown/websocket");
      ws.onmessage = (event) => {
        const lines = event.data.split("\n");
        for (const line of lines) {
          if (line.startsWith("|challstr|")) {
            // The challstr is everything after "|challstr|"
            const challstr = line.slice(10);
            ws.close();
            resolve(challstr);
          }
        }
      };
      ws.onerror = (_err) => {
        reject(new Error("WebSocket error"));
      };
      ws.onclose = () => {
        // Optionally handle close
      };
    });
  }

  async function fetchReplays() {
    setLoading(true);
    setError(null);
    setReplays([]);
    try {
      const challstr = await getChallstr();
      const resp = await fetch("/api/fetch-replays", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: name(),
          pass: pass(),
          challstr: challstr,
        }),
      });
      if (!resp.ok) {
        alert(
          "Unable to fetch replays, please double check your username & password!",
        );
        throw new Error(await resp.text());
      }
      const data = await resp.json();
      setReplays(data);
    } catch (e) {
      if (e instanceof Error) {
        console.error(e.message);
      } else {
        console.error(String(e));
      }
    } finally {
      setLoading(false);
    }
  }

  function copyAll() {
    const urls = replays().map((replay) => {
      let url = `https://replay.pokemonshowdown.com/${replay.id}`;
      if (replay.password) url += `-${replay.password}pw`;
      return url;
    });
    navigator.clipboard.writeText(urls.join("\n"));
  }

  onMount(() => {
    const wsUrl = "/ws";
    const socket = new WebSocket(wsUrl);
    socket.onopen = async () => {
      console.log("WebSocket connected to:", wsUrl);
    };
  });

  return (
    <div class="container mx-auto px-4" style={{ color: "white" }}>
      <div class="max-w-3xl mx-auto py-8">
        <h1 class="text-4xl font-bold mb-4">
          Fetch <span class="text-[#c2a8d4]">Showdown</span> Private Replays
        </h1>
        <div class="mb-6 bg-[#c2a8d4] border rounded-lg p-4 text-black">
          <strong>Privacy Notice:</strong> Your Showdown username and password
          are <span class="font-semibold">never stored</span> on this site. To
          fetch your private replays, your credentials must be securely sent to
          our server, which acts as a proxy to bypass Showdown’s CORS
          restrictions. All data is transmitted over{" "}
          <span class="font-semibold">encrypted HTTPS</span> and is used only
          for this request.
        </div>
        <form
          class="bg-gray-800 rounded-lg p-6 mb-6 shadow"
          onSubmit={(e) => {
            e.preventDefault();
            fetchReplays();
          }}
        >
          <div class="mb-4">
            <label class="block mb-1 font-semibold" for="username">
              Username
            </label>
            <input
              id="username"
              class="w-full px-3 py-2 rounded bg-gray-700 text-white"
              value={name()}
              onInput={(e) => setName(e.currentTarget.value)}
              required
              autocomplete="username"
            />
          </div>
          <div class="mb-4">
            <label class="block mb-1 font-semibold" for="password">
              Password
            </label>
            <input
              id="password"
              type="password"
              class="w-full px-3 py-2 rounded bg-gray-700 text-white"
              value={pass()}
              onInput={(e) => setPass(e.currentTarget.value)}
              required
              autocomplete="current-password"
            />
          </div>
          <button
            type="submit"
            class="bg-[#c2a8d4] hover:bg-[#9770b6] text-black font-bold py-2 px-4 rounded"
            disabled={loading()}
          >
            {loading() ? "Loading..." : "Fetch Replays"}
          </button>
        </form>
        {error() && (
          <div class="bg-red-700 text-white p-3 rounded mb-4">{error()}</div>
        )}
        {replays().length > 0 && (
          <div>
            <button
              type="submit"
              class="mb-4 bg-sky-600 hover:bg-sky-700 text-white font-bold py-2 px-4 rounded"
              onClick={copyAll}
            >
              Copy All URLs
            </button>
            <div class="overflow-x-auto">
              <table class="min-w-full bg-gray-900 rounded-lg">
                <thead>
                  <tr>
                    <th class="px-4 py-2 text-left">URL</th>
                    <th class="px-4 py-2 text-left">Format</th>
                    <th class="px-4 py-2 text-left">Player 1</th>
                    <th class="px-4 py-2 text-left">Player 2</th>
                    <th class="px-4 py-2 text-left">Upload Time</th>
                  </tr>
                </thead>
                <tbody>
                  <For each={replays()} fallback={null}>
                    {(replay) => {
                      let url = `https://replay.pokemonshowdown.com/${replay.id}`;
                      if (replay.password) url += `-${replay.password}pw`;
                      return (
                        <tr>
                          <td class="px-4 py-2 break-all">
                            <a
                              href={url}
                              target="_blank"
                              rel="noopener noreferrer"
                            >
                              Link
                            </a>
                          </td>
                          <td class="px-4 py-2">{replay.format}</td>
                          <For each={replay.players} fallback={null}>
                            {(player) => {
                              return <td class="px-4 py-2">{player}</td>;
                            }}
                          </For>
                          <td class="px-4 py-2">
                            {new Date(
                              replay.uploadtime * 1000,
                            ).toLocaleString()}
                          </td>
                        </tr>
                      );
                    }}
                  </For>
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

const root = document.getElementById("root");
if (root) {
  render(() => <ReplayFetcher />, root);
}
