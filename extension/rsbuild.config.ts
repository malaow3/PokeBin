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

  output: {
    filenameHash: false,
    filename: {
      js: "[name].js",
    },
  },
  source: {
    entry: {
      main: "./src/main.tsx",
      inject_chrome: "./src/inject_chrome.ts",
      inject_firefox: "./src/inject_firefox.ts",
    },
  },
  tools: {
    htmlPlugin: false,
  },

  performance: {
    chunkSplit: {
      strategy: "all-in-one",
    },
  },
});
