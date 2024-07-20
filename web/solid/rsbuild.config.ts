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
        template({ entryName }) {
            const templates = {
                index: "./index.html",
                about: "./about.html",
                paste: "./paste.html",
            };
            return templates[entryName] || templates.index;
        },
    },
    source: {
        entry: {
            index: "./src/index.tsx",
            about: "./src/about.tsx",
            paste: "./src/paste.tsx",
        },
    },

    output: {
        sourceMap: {
            js: "source-map",
            css: true,
        },
        //filename: {
        //js: (pathData, _assetInfo) => {
        //    if (pathData.chunk?.name === "paste") {
        //        return "paste.js";
        //    }
        //
        //    return "[name]_script.[contenthash:8].js";
        //},
        //},
    },
});
