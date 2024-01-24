import { defineConfig } from "vite";
import { svelte } from "@sveltejs/vite-plugin-svelte";

// https://vitejs.dev/config/
export default defineConfig({
	build: {
		rollupOptions: {
			input: {
				index: "index.html",
				about: "about.html",
				paste: "src/paste.ts",
			},
			output: {
				// Configure the output file names
				entryFileNames: (chunkInfo) => {
					// Check if the chunk is 'paste.ts'
					if (chunkInfo.name === "paste") {
						// Always compile to 'paste.js'
						return "assets/paste.js";
					}
					// For all other entries, use the default naming scheme
					return "assets/[name]-[hash].js";
				},
				assetFileNames: (assetInfo) => {
					if (assetInfo.name === "paste.css") {
						return "assets/paste.css";
					}
					return "assets/[name]-[hash][extname]";
				},
			},
		},
	},
	plugins: [svelte()],
});
