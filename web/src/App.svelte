<script lang="ts">
    import { onMount } from "svelte";
    import { encryptMessage } from "./helpers";

    function resizeNotes() {
        const footer = document.getElementById("footer");
        const notes = document.getElementById("notes");
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

        if (notes.clientHeight > availableHeight) {
            notes.style.height = `${availableHeight}px`;
        }
    }

    // On mount!
    onMount(() => {
        const notes = document.getElementById("notes");

        if (notes !== null) {
            // Cast notes to NOT null.
            notes.addEventListener("touchend", resizeNotes);
            notes.addEventListener("mouseup", resizeNotes);
        }
    });

    // biome-ignore lint/suspicious/noExplicitAny: any is ok here.
    async function handleForm(e: any) {
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
    }
</script>

<main>
    <form
        on:submit={(e) => {
            return handleForm(e);
        }}
        action="/create"
        method="post"
        id="form"
        class="flex flex-wrap"
    >
        <!-- Paste input -->
        <textarea
            id="paste"
            name="paste"
            placeholder="Paste your tournament winning team here!"
            class="bg-black"
            style="width: 50vw; height: 100vh; resize: none"
        ></textarea>

        <!-- Sidebar -->
        <div
            id="right"
            class="flex flex-wrap"
            style="width: 50vw; height: 100vh;"
        >
            <div id="sidebar" class="w-full">
                <div id="top" class="w-full">
                    <!-- Title Section -->
                    <div
                        class="text-4xl mt-2 mb-2 flex flex-row"
                        style="padding: 0 !important;"
                    >
                        <span class="text-pink-600">Poke</span><span
                            style="color: #f7cae2">Bin</span
                        ><img
                            class="ml-1"
                            src="/assets/favicon/android-chrome-192x192.png"
                            style="height: 50px; width: 50px; scale: 1.0"
                            alt="It's Spheal!"
                        />
                        <br />
                    </div>

                    <!-- Title -->
                    <div class="form-field">
                        <label for="title" class="form-label">Title</label>
                        <input
                            type="text"
                            name="title"
                            id="title"
                            autocomplete="off"
                            class="form-input"
                        />
                    </div>

                    <!--Author-->
                    <div class="form-field">
                        <label for="author" class="form-label">Author</label>
                        <input
                            type="text"
                            name="author"
                            id="author"
                            autocomplete="off"
                            class="form-input"
                        />
                    </div>

                    <!--Rental-->
                    <div class="form-field">
                        <label for="rental" class="form-label">Rental</label>
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

                    <!--Format-->
                    <div class="form-field">
                        <label for="format" class="form-label">Format</label>
                        <input
                            type="text"
                            name="format"
                            id="format"
                            autocomplete="off"
                            class="form-input"
                        />
                    </div>
                </div>

                <!-- Notes Section -->
                <div class="form-field">
                    <label for="notes" class="form-label" id="notesLabel"
                        >Notes</label
                    >
                    <textarea
                        id="notes"
                        name="notes"
                        autocomplete="off"
                        class="form-input"
                        rows="3"
                    ></textarea>
                </div>
                <div id="belowNotes">
                    <!-- Password Section -->
                    <div class="form-field">
                        <label for="password" class="form-label">Password</label
                        >
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
                    <!-- Submit Button -->
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
            <!-- Footer pinned to the bottom -->
            <div
                class="text-center mt-auto py-8 w-full flex justify-center items-center"
                id="footer"
            >
                <!-- Stylized about button link -->
                <div>
                    <a href="/about" class="text-pink-700 hover:text-pink-500">
                        About PokeBin
                    </a>
                    <br />
                    <p>Made with ❤️</p>
                </div>
            </div>
        </div>
    </form>
</main>

<style lang="postcss">
    #footer {
        display: flex;
        justify-content: center; /* Center content horizontally */
        align-items: center; /* Center content vertically */
        text-align: center; /* Ensure text within is centered */
        margin-top: auto; /* Push footer to the bottom */
        width: 100%; /* Make footer full width */
    }

    .form-field {
        display: flex;
        flex-direction: column;
        margin-bottom: 5px;
    }

    .form-label {
        @apply text-base;
    }

    .form-input {
        width: 100%;
        @apply text-base;
        border-radius: 0.25rem;
        border: 1px solid #ccc;
    }

    @media (min-width: 768px) {
        .form-field {
            flex-direction: row;
            align-items: center;
        }

        .form-label {
            width: 20%;
            margin-bottom: 0;
            text-align: right;
            padding-right: 1rem;
        }

        .form-input {
            width: 80%;
        }
    }

    @media (max-width: 767px) {
        button {
            width: 100% !important;
            margin-left: 0 !important;
        }
    }

    #right {
        flex: 0 1 auto;
        /* width: 325px; */
        width: 50vw;
        padding: 0 12px;
        box-sizing: border-box;
        font:
            12px "M+ 1c",
            sans-serif;
        display: inline-flex;
        /* flex-direction: column; */
        background-color: #121419;
        color: white;
    }

    #right label {
        color: white;
    }
    #right textarea {
        color: white;
        background-color: #2b2a33;
        border-color: #383d4c;
    }

    form > textarea[name="paste"] {
        flex: 1 1 auto;
        width: 50vw;
        height: 100vh;
        margin: 0;
        border: 0;
        padding: 12px;
        box-sizing: border-box;
        background-color: black;
        color: white;
        font:
            12px "M+ 1m",
            monospace;
    }

    input {
        color: white !important;
        border-color: #383d4c !important;
        background-color: #2b2a33;
    }
</style>
