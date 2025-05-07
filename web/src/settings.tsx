import { createEffect, createSignal, onMount } from "solid-js";
import { render } from "solid-js/web";
import "./app.css";

const getLocal = (key: string, fallback: boolean) => {
  const str = localStorage.getItem(key);
  return str !== null ? JSON.parse(str) : fallback;
};

function updateThemeColor(dark: boolean) {
  let meta = document.querySelector('meta[name="theme-color"]');
  if (!meta) {
    meta = document.createElement("meta");
    meta.setAttribute("name", "theme-color");
    document.head.appendChild(meta);
  }
  meta.setAttribute("content", dark ? "#000000" : "#f9f9f9");
}

const SettingsPage = () => {
  const [moveColors, setMoveColors] = createSignal(
    getLocal("moveColors", true),
  );
  const [twoDImages, setTwoDImages] = createSignal(
    getLocal("twoDImages", false),
  );
  const [darkMode, setDarkMode] = createSignal(getLocal("darkMode", true));

  // Set theme on mount
  onMount(() => {
    const dark = darkMode();
    const body = document.body;
    if (dark) {
      body.classList.add("dark");
      body.classList.remove("light");
    } else {
      body.classList.add("light");
      body.classList.remove("dark");
    }
    updateThemeColor(dark);
  });

  // Update theme when darkMode changes
  createEffect(() => {
    const dark = darkMode();
    const body = document.body;
    if (dark) {
      body.classList.add("dark");
      body.classList.remove("light");
    } else {
      body.classList.add("light");
      body.classList.remove("dark");
    }
    updateThemeColor(dark);
  });

  // Handler for dark mode toggle
  const handleDarkMode = (checked: boolean) => {
    setDarkMode(checked);
    localStorage.setItem("darkMode", JSON.stringify(checked));
    // The effect above will update the body class and theme color
  };

  return (
    <main class="min-h-screen flex items-center justify-center bg-[#f9f9f9] dark:bg-zinc-950 transition-colors">
      <div class="relative bg-white dark:bg-zinc-800 rounded-lg p-6 max-w-lg w-full max-h-[90vh] overflow-y-auto shadow-lg text-black dark:text-white">
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
              checked={moveColors()}
              onChange={(e) => {
                setMoveColors(e.target.checked);
                localStorage.setItem(
                  "moveColors",
                  JSON.stringify(e.target.checked),
                );
              }}
            />
          </div>
          <div class="flex flex-row items-center gap-4">
            <label for="twoDImages" class="font-medium cursor-pointer w-32">
              2D images
            </label>
            <input
              id="twoDImages"
              name="twoDImages"
              type="checkbox"
              class="align-middle"
              checked={twoDImages()}
              onChange={(e) => {
                setTwoDImages(e.target.checked);
                localStorage.setItem(
                  "twoDImages",
                  JSON.stringify(e.target.checked),
                );
              }}
            />
          </div>
          <div class="flex flex-row items-center gap-4">
            <label for="darkMode" class="font-medium cursor-pointer w-32">
              Dark Mode
            </label>
            <input
              id="darkMode"
              name="darkMode"
              type="checkbox"
              class="align-middle"
              checked={darkMode()}
              onChange={(e) => handleDarkMode(e.target.checked)}
            />
          </div>
        </div>
        <div class="mt-8 text-center text-xs text-gray-400 dark:text-gray-500">
          Settings are saved in your browser.
        </div>
      </div>
    </main>
  );
};

const root = document.getElementById("root");
if (root) {
  render(() => <SettingsPage />, root);
}
