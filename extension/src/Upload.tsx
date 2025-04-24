import { createSignal } from "solid-js";
import { encrypt } from "./encryption.ts";
import type { UnsafeWindow } from "./types.ts";

const usfw = window as unknown as UnsafeWindow;

const Upload = (props: { pokebin_url: string }) => {
  const [ots, setOts] = createSignal(false);
  const [removeAuthor, setRemoveAuthor] = createSignal(false);
  const [password, setPassword] = createSignal("");
  const [pokebin_url] = createSignal(props.pokebin_url);

  const onkey = async (e: KeyboardEvent) => {
    if (e.key === "Enter") {
      await process_button();
    }
  };

  const process_button = async (e?: Event) => {
    if (e) {
      e.preventDefault();
    }
    if (usfw.room.curTeam.team.length === 0) {
      alert("No team selected.");
      return;
    }

    const name = usfw.room.curTeam.name;
    const format = usfw.room.curTeam.format;
    const gen = usfw.room.curTeam.gen;
    const team = usfw.Storage.exportTeam(usfw.room.curTeam.team, gen, ots());
    let author = usfw.app.user.attributes.name;
    if (removeAuthor()) {
      author = "";
    }

    const form = document.getElementById("PokeBinForm") as HTMLFormElement;
    const base_data = {
      title: name,
      author: author,
      notes: "",
      format: format,
      rental: "",
      content: team,
    };

    type BaseData = {
      title: string;
      author: string;
      notes: string;
      format: string;
      rental: string;
      content: string;
    };
    type FormData = {
      encrypted: boolean;
      data: BaseData | string;
    };
    let data: BaseData | string = base_data;
    let encrypted = false;
    if (password() !== "") {
      // AES encrypt the paste
      const encrypted_data = encrypt(JSON.stringify(base_data), password());
      if (encrypted_data == null) {
        alert("Failed to encrypt paste");
        return;
      }
      data = encrypted_data;
      encrypted = true;
    }

    const form_data: FormData = {
      encrypted: encrypted,
      data: data,
    };
    const form_content = JSON.stringify(form_data);

    const encoded = btoa(decodeURIComponent(encodeURIComponent(form_content)));
    const data_element = document.getElementById("data") as HTMLInputElement;
    data_element.value = encoded;

    const password_element = document.getElementById(
      "password",
    ) as HTMLInputElement;
    password_element.disabled = true;

    form.submit();
  };

  return (
    <main>
      <br />
      <div class="group">
        <form
          id="PokeBinForm"
          method="post"
          action={`${pokebin_url()}/create`}
          target="_blank"
          class="form-row"
          onSubmit={process_button}
        >
          <button class="button" type="submit">
            Upload to PokeBin
          </button>
          <div
            style={{
              display: "flex",
              "flex-direction": "row",
              "align-items": "center",
            }}
          >
            <label for="anonymous">Remove username</label>
            <input
              type="checkbox"
              id="anonymous"
              checked={removeAuthor()}
              onChange={(e) => setRemoveAuthor(e.currentTarget.checked)}
            />
          </div>
          <div
            style={{
              display: "flex",
              "flex-direction": "row",
              "align-items": "center",
            }}
          >
            <label for="ots">OTS</label>
            <input
              type="checkbox"
              id="ots"
              checked={ots()}
              onChange={(e) => setOts(e.currentTarget.checked)}
            />
          </div>
          <input
            onKeyDown={onkey}
            class="custom-input"
            type="password"
            id="password"
            placeholder="Enter a password"
            value={password()}
            onInput={(e) => setPassword(e.currentTarget.value)}
          />
          <input name="data" id="data" hidden />
        </form>
      </div>
      <style>{`
        .group {
          display: flex;
          flex-direction: row;
          align-items: center;
        }
        .form-row {
          display: flex;
          flex-direction: row;
          align-items: center;
        }
        .form-row > * {
          margin-right: 10px;
        }
        .custom-input {
          border-radius: 5px;
        }
      `}</style>
    </main>
  );
};

export default Upload;
