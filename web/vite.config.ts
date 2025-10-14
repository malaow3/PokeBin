import { defineConfig } from "vite";
import solid from "vite-plugin-solid";

export default defineConfig({
  plugins: [solid()],
  build: {
    rollupOptions: {
      input: {
        index: "./html/index.html",
        about: "./html/about.html",
        tos: "./html/tos.html",
        report: "./html/report.html",
        paste: "./html/paste.html",
        replay: "./html/replay.html",
        settings: "./html/settings.html",
        recent: "./html/recent.html",
      },
    },
    assetsInlineLimit: 0,
    sourcemap: false,
  },
});
