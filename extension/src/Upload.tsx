import { createSignal, Show } from "solid-js";
import { encrypt } from "./encryption.ts";
import type { UnsafeWindow } from "./types.ts";
import { utf8ToBase64 } from "./helpers.ts";

const usfw = window as unknown as UnsafeWindow;

type UploadProps = {
  pokebin_url: string;
  newUI?: boolean;
};

const Upload = ({ pokebin_url, newUI = false }: UploadProps) => {
  const [ots, setOts] = createSignal(false);
  const [removeAuthor, setRemoveAuthor] = createSignal(false);
  const [password, setPassword] = createSignal("");

  const onkey = async (e: KeyboardEvent) => {
    if (e.key === "Enter") {
      await process_button();
    }
  };

  const process_button = async (e?: Event) => {
    if (e) {
      e.preventDefault();
    }

    if (!newUI && usfw.room.curTeam.team.length === 0) {
      alert("No team selected.");
      return;
    }

    let name: string;
    let format: string;
    if (!newUI) {
      name = usfw.room.curTeam.name;
      format = usfw.room.curTeam.format;
    } else {
      name = usfw.PS.room.team.name;
      format = usfw.PS.room.team.format;
    }

    let team: string;
    if (!newUI) {
      const gen = usfw.room.curTeam.gen;
      team = usfw.Storage.exportTeam(usfw.room.curTeam.team, gen, ots());
    } else {
      team = usfw.PSTeambuilder.exportPackedTeam(usfw.PS.room.team, true);
      if (ots()) {
        let lines = team.split("\n");
        lines = lines.filter((line) => {
          const trimmed = line.trim();
          return (
            !trimmed.startsWith("EVs: ") &&
            !trimmed.startsWith("IVs: ") &&
            !trimmed.includes("Nature")
          );
        });
        team = lines.join("\n");
      }
    }
    let author: string;
    if (!newUI) {
      author = usfw.app.user.attributes.name;
    } else {
      author = usfw.PS.user.name;
    }
    if (removeAuthor()) {
      author = "";
    }

    console.log("POKEBIN:", team);
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

    const encoded = utf8ToBase64(form_content);
    const data_element = document.getElementById("data") as HTMLInputElement;
    data_element.value = encoded;

    const password_element = document.getElementById(
      "password",
    ) as HTMLInputElement;
    password_element.disabled = true;

    form.submit();
  };

  return (
    <main
      style={{
        "padding-bottom": newUI ? "10px" : "",
      }}
    >
      <br />
      <div class="group">
        <form
          id="PokeBinForm"
          method="post"
          action={`${pokebin_url}/create`}
          target="_blank"
          class="form-row"
          onSubmit={process_button}
        >
          <Show when={newUI}>
            <button style={{ width: "160px" }} class="button" type="submit">
              Upload to PokeBin
            </button>
          </Show>
          <Show when={!newUI}>
            <button class="button" type="submit">
              Upload to PokeBin
            </button>
          </Show>
          <div
            style={{
              display: "flex",
              "flex-direction": "row",
              "align-items": "center",
            }}
          >
            <Show when={!newUI}>
              <label for="anonymous">Remove username</label>
            </Show>
            <Show when={newUI}>
              <label style={{ "font-size": "13px" }} for="anonymous">
                Remove username
              </label>
            </Show>
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
            <Show when={!newUI}>
              <label for="ots">OTS</label>
            </Show>
            <Show when={newUI}>
              <label style={{ "font-size": "13px" }} for="ots">
                OTS
              </label>
            </Show>
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
