import { createEffect, onMount } from "solid-js";
import { render } from "solid-js/web";
import { SettingsForm } from "./settingsForm";
import { initSettings, updateSetting } from "./settings";
import "./app.css";

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
  const { sett: settings, setSett: setSettings } = initSettings();
  // Set theme on mount and when darkMode changes
  onMount(() => {
    const dark = settings().darkMode;
    document.body.classList.toggle("dark", dark);
    document.body.classList.toggle("light", !dark);
    updateThemeColor(dark);
  });

  createEffect(() => {
    const dark = settings().darkMode;
    document.body.classList.toggle("dark", dark);
    document.body.classList.toggle("light", !dark);
    updateThemeColor(dark);
  });

  return (
    <main class="min-h-screen flex items-center justify-center bg-[#f9f9f9] dark:bg-zinc-950 transition-colors">
      <div class="relative bg-white dark:bg-zinc-800 rounded-lg p-6 max-w-xl w-full max-h-[90vh] overflow-y-auto shadow-lg text-black dark:text-white">
        <h2 class="text-xl font-semibold mb-4">Settings</h2>
        <SettingsForm
          settings={settings()}
          onChange={(key, value) =>
            updateSetting(key, value, settings, setSettings)
          }
        />
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
