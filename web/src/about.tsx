import { render } from "solid-js/web";
import "./about.css";
import "./base.css";
import PatreonButton from "./buttons";

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
                    thank you for checking out{" "}
                    <span class="text-pink-600">Poke</span>
                    <span style="color: #f7cae2">Bin</span>
                    💖
                    <br />
                    <br />
                    <p>
                        Unfortunately, hosting a site isn't free! If you can, please
                        consider supporting financially. If we garner enough support to
                        offset the website costs, I intend to host a community tournament
                        with a prize pool as a thank you!
                        <br />
                        <br />

                        Additionally, if you'd like to advertise on PokeBin, feel free to
                        reach out via email to at{" "}
                        <a href="mailto:malaow3@yahoo.com">malaow3@yahoo.com</a>
                    </p>
                    <br />
                    <PatreonButton />
                    <br />
                    <p>
                        I've also been working on a new project, PlotBot! Feel free to check
                        out the details <a
                            href="https://www.patreon.com/posts/introducing-104234417"
                        >here</a
                        >! If you subscribe to my Patreon, you not only support PokeBin's
                        continued development and hosting but you also get access to
                        PlotBot!
                    </p>
                    <a
                        href="https://www.patreon.com/posts/introducing-104234417"
                        target="_blank"
                    >Check out my latest project, PlotBot!
                    </a>
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
