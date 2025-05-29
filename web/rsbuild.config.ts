import { defineConfig } from "@rsbuild/core";
import { pluginBabel } from "@rsbuild/plugin-babel";
import { pluginSolid } from "@rsbuild/plugin-solid";

export default defineConfig({
  plugins: [
    pluginBabel({
      include: /\.(?:jsx|tsx)$/,
    }),
    pluginSolid(),
  ],

  html: {
    template() {
      return "./template.html";
    },
    title({ entryName }) {
      const titles = {
        index: "PokeBin",
        about: "About PokeBin",
        tos: "Terms of Service",
        report: "Report a PokeBin",
        paste: "PokeBin",
        settings: "PokeBin Settings",
        recent: "Recent PokeBins",
      };

      return titles[entryName] || "PokeBin";
    },
  },
  source: {
    entry: {
      index: "./src/index.tsx",
      about: "./src/about.tsx",
      tos: "./src/tos.tsx",
      report: "./src/report.tsx",
      paste: "./src/paste.tsx",
      replay: "./src/replay.tsx",
      settings: "./src/settingsPage.tsx",
      recent: "./src/recent.tsx",
    },
  },
  output: {
    sourceMap: true,
  },
  tools: {
    cssLoader: {
      url: {
        filter: (url) => {
          if (/\/assets\/pokemonicons-sheet.png/.test(url)) {
            return false;
          }
          return true;
        },
      },
    },
  },
});
