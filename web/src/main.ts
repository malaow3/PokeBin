import "./app.css";
import App from "./App.svelte";

const element = document.getElementById("app");
if (element == null) {
	throw "Element with id 'app' not found";
}

const app = new App({
	target: element,
});

export default app;
