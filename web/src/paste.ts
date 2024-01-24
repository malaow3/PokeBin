import "./paste.css";
import App from "./Paste.svelte";

const element = document.getElementById("app");
if (element == null) {
	throw "Element with id 'app' not found";
}

const app = new App({
	target: element,
});

export default app;
