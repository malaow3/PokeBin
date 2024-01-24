import "./app.css";
import App from "./About.svelte";

const element = document.getElementById("app");
if (element == null) {
	throw "Element with id 'app' not found";
}

const app = new App({
	target: element,
});

export default app;
