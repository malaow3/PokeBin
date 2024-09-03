/* @refresh reload */
import { render } from "solid-js/web";

import "./index.css";
import App from "./Upload";

const root = document.getElementById("app");

if (!root) throw new Error("root element not found");

render(() => <App />, root);
