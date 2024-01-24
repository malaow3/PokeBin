import { vitePreprocess } from "@sveltejs/vite-plugin-svelte";
import tailwindcss from "tailwindcss";
import autoprefixer from "autoprefixer";

/** @type {import('@sveltejs/kit').Config} */

const config = {
	kit: {},
	preprocess: [
		vitePreprocess({
			postcss: {
				plugins: [tailwindcss(), autoprefixer],
			},
		}),
	],
};
export default config;
