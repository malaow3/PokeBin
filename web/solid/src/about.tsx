import { render } from "solid-js/web";
import "./about.css";

function App() {
    return (
        <>
            <div class="container mx-auto px-4" style="color: white">
                <div class="max-w-3xl mx-auto py-2">
                    <h1 class="text-4xl font-bold mb-4">
                        About
                        <span class="text-pink-600">Poke</span>
                        <span style="color: #f7cae2">Bin</span>
                    </h1>
                    <p class="text-lg mb-4">
                        PokeBin was created as an alternative to PokePaste. As a
                        developer, I did this for three reasons
                        <br />
                    </p>
                    <ul class="ml-10">
                        <li>I wanted to publish an actual web app</li>
                        <li>
                            To me, it seemed like the PokePaste project is in an
                            archived state
                        </li>
                        <li>
                            I felt like there were some changes I could make
                            that would be beneficial
                        </li>
                    </ul>
                    <br />
                    <p class="text-lg mb-4">
                        If you come across any bugs, feel free to make an issue
                        on{" "}
                        <a
                            href="https://github.com/malaow3/PokeBin/issues"
                            rel="noreferrer"
                            target="_blank"
                        >
                            GitHub
                        </a>
                    </p>
                    <br />
                    This is entirely a passion-project, but once again I want to
                    thank you for checking out
                    <span class="text-pink-600">Poke</span>
                    <span style="color: #f7cae2">Bin</span>
                    💖
                    <br />
                    <br />
                    <a href="/">Return to PokeBin</a>
                </div>
            </div>
        </>
    );
}

const root = document.getElementById("app");

if (!root) throw new Error("root element not found");

render(() => <App />, root);
