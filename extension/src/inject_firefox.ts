import { initWasm } from "./wasm.ts";

async function start() {
  await initWasm();
  const s = document.createElement("script");
  // @ts-ignore
  s.src = browser.runtime.getURL("dist/main.js");
  s.onload = () => s.remove();
  (document.head || document.documentElement).append(s);
}

if (
  document.readyState === "complete" ||
  document.readyState === "interactive"
) {
  // Document is already ready
  start();
} else {
  // Wait for DOMContentLoaded
  window.addEventListener("DOMContentLoaded", start, { once: true });
}
