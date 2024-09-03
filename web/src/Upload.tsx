import { onMount } from "solid-js";
import { encryptMessage } from "./helpers";
import "./Upload.css";
import PatreonButton from "./buttons";

function App() {
    //const [count, setCount] = createSignal(0);

    const handleForm = async (e: { preventDefault: () => void }) => {
        e.preventDefault();
        const paste = document.getElementById("paste") as HTMLTextAreaElement;
        if (paste === null) {
            return;
        }

        const form = document.getElementById("form") as HTMLFormElement;

        if (paste.value === "") {
            alert("Paste cannot be empty!");
            return;
        }

        const password = document.getElementById(
            "password",
        ) as HTMLInputElement;
        if (password === null) {
            return;
        }

        if (password.value === "") {
            form.submit();
            return;
        }

        const password_value = password.value;
        // AES encrypt the paste
        let content = paste.value;

        const title = document.getElementById("title") as HTMLInputElement;
        const author = document.getElementById("author") as HTMLInputElement;
        const notes = document.getElementById("notes") as HTMLTextAreaElement;
        const format = document.getElementById("format") as HTMLInputElement;
        const rental = document.getElementById("rental") as HTMLInputElement;

        const jsondata = {
            title: title.value,
            author: author.value,
            notes: notes.value,
            format: format.value,
            rental: rental.value,
        };

        content = `${JSON.stringify(jsondata)}\n-----\n${content}`;

        // AES encrypt the paste
        const data = await encryptMessage(password_value, content);
        // Submit the form removing the password
        paste.value = "";

        // Add a new input.
        const hidden_input = document.getElementById(
            "encryptedData",
        ) as HTMLInputElement;
        if (hidden_input === null) {
            return;
        }
        hidden_input.value = data;

        form.submit();
    };

    onMount(() => {
        const notes = document.getElementById("notes");
        const footer = document.getElementById("footer");
        const topOb = document.getElementById("top");
        const belowNotes = document.getElementById("belowNotes");
        const notesLabel = document.getElementById("notesLabel");

        if (
            notes === null ||
            footer === null ||
            topOb === null ||
            belowNotes === null ||
            notesLabel === null
        ) {
            return;
        }

        const labelHeight = notesLabel.clientHeight;

        const availableHeight =
            window.innerHeight -
            topOb.clientHeight -
            belowNotes.clientHeight -
            footer.clientHeight -
            labelHeight -
            10;

        notes.style.maxHeight = `${availableHeight}px`;
    });

    return (
        <>
            <main>
                <form
                    onsubmit={handleForm}
                    action="/create"
                    method="post"
                    id="form"
                    class="flex flex-wrap"
                >
                    <textarea
                        id="paste"
                        name="paste"
                        placeholder="Paste your tournament winning team here!"
                        class="bg-black"
                        style="width: 50vw; height: 100vh; resize: none"
                    />

                    <div
                        id="right"
                        class="flex flex-wrap"
                        style="width: 50vw; height: 100vh;"
                    >
                        <div id="sidebar" class="w-full">
                            <div id="top" class="w-full">
                                <div
                                    class="text-4xl mt-2 mb-2 flex flex-row"
                                    style="padding: 0 !important;"
                                >
                                    <span class="text-pink-600">Poke</span>
                                    <span style="color: #f7cae2">Bin</span>
                                    <img
                                        class="ml-1"
                                        src="/assets/favicon/android-chrome-192x192.png"
                                        style="height: 50px; width: 50px; scale: 1.0"
                                        alt="It's Spheal!"
                                    />
                                    <br />
                                </div>

                                <div class="form-field">
                                    <label for="title" class="form-label">
                                        Title
                                    </label>
                                    <input
                                        type="text"
                                        name="title"
                                        id="title"
                                        autocomplete="off"
                                        class="form-input"
                                    />
                                </div>

                                <div class="form-field">
                                    <label for="author" class="form-label">
                                        Author
                                    </label>
                                    <input
                                        type="text"
                                        name="author"
                                        id="author"
                                        autocomplete="off"
                                        class="form-input"
                                    />
                                </div>

                                <div class="form-field">
                                    <label for="rental" class="form-label">
                                        Rental
                                    </label>
                                    <input
                                        type="text"
                                        name="rental"
                                        id="rental"
                                        autocomplete="off"
                                        class="form-input"
                                        minlength="6"
                                        maxlength="6"
                                    />
                                </div>

                                <div class="form-field">
                                    <label for="format" class="form-label">
                                        Format
                                    </label>
                                    <input
                                        type="text"
                                        name="format"
                                        id="format"
                                        autocomplete="off"
                                        class="form-input"
                                    />
                                </div>
                            </div>

                            <div class="form-field">
                                <label
                                    for="notes"
                                    class="form-label"
                                    id="notesLabel"
                                >
                                    Notes
                                </label>
                                <textarea
                                    id="notes"
                                    name="notes"
                                    autocomplete="off"
                                    class="form-input"
                                    rows="3"
                                //onDragEnd={resizeNotes}
                                //onTouchEnd={resizeNotes}
                                //onMouseUp={resizeNotes}
                                />
                            </div>
                            <div id="belowNotes">
                                <div class="form-field">
                                    <label for="password" class="form-label">
                                        Password
                                    </label>
                                    <input
                                        type="text"
                                        name="password"
                                        id="password"
                                        autocomplete="off"
                                        class="form-input"
                                    />
                                </div>
                                <input
                                    type="text"
                                    hidden
                                    name="encrypted_data"
                                    id="encryptedData"
                                />
                                <div class="w-full">
                                    <button
                                        type="submit"
                                        class="bg-indigo-700 hover:bg-indigo-800 text-white font-black text-base py-2 px-4 rounded mt-2"
                                        style="margin-left: 20%; width: 80%"
                                    >
                                        Submit Paste!
                                    </button>
                                </div>
                            </div>
                        </div>
                        <div
                            class="text-center mt-auto py-8 w-full flex-col justify-center items-center"
                            id="footer"
                        >
                            <div class="my-4">
                                <PatreonButton />
                            </div>
                            <br />
                            <div>
                                <a
                                    href="/about"
                                    class="text-pink-700 hover:text-pink-500"
                                >
                                    About PokeBin
                                </a>
                                <br />
                                <p>Made with 🩷</p>
                            </div>
                        </div>
                    </div>
                </form>
            </main>
        </>
    );
}

export default App;
