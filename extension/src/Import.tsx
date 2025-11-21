import { createSignal } from "solid-js";
import type { UnsafeWindow } from "./types.ts";
import { decrypt } from "./encryption.ts";
import { h } from "preact";

const usfw: UnsafeWindow = window as unknown as UnsafeWindow;

type ImportProps = {
  newUI?: boolean;
};

const Import = ({ newUI = false }: ImportProps) => {
  const [importUrl, setImportUrl] = createSignal("");
  const [password, setPassword] = createSignal("");

  const onkey = async (e: KeyboardEvent) => {
    if (e.key === "Enter") {
      await submit();
    }
  };

  const submit = async () => {
    if (importUrl() === "") {
      alert("You must enter some text to import.");
      return;
    }

    const url = importableUrl(importUrl());
    if (url === "") {
      alert("Not a valid PokeBin URL");
      return;
    }

    const response = await fetch(url);
    const response_data = await response.json();
    if (response_data.encrypted && password() === "") {
      alert("You need to enter a password to import.");
      return;
    }
    let paste = undefined;
    if (response_data.encrypted && password() !== "") {
      const decrypted = decrypt(response_data.data, password());
      if (decrypted == null) {
        alert("Incorrect password.");
        return;
      }
      paste = JSON.parse(decrypted);
    } else {
      paste = response_data.data;
    }

    const format = paste.format;

    if (!newUI) {
      if (format) {
        usfw.room.changeFormat(format);
      }
      let title = paste.title;
      if (title && !title.startsWith("Untitled")) {
        title = title.replace(/[\|\\\/]/g, "");
        usfw.$(".teamnameedit").val(title).change();
      }
      usfw.Storage.activeSetList = usfw.room.curSetList =
        usfw.Storage.importTeam(paste.content);
      usfw.room.updateTeamView();
    } else {
      if (format) {
        usfw.PS.room.team.format = format;
      }
      let title = paste.title;
      if (title && !title.startsWith("Untitled")) {
        title = title.replace(/[\|\\\/]/g, "");
        usfw.PS.room.team.name = title;
      }
      console.log("POKEBIN: ", paste.content);
      const sets = usfw.Teams.import(paste.content);
      const packed = usfw.Teams.pack(sets);
      usfw.PS.room.team.packedTeam = packed;
      usfw.PS.teams.push(usfw.PS.room.team);
      const icons = [];
      for (const set of sets) {
        icons.push(
          h("span", {
            class: "picon",
            style: usfw.Dex.getPokemonIcon(set.species),
          }),
        );
      }
      usfw.PS.room.team.iconCache = icons;
      usfw.PS.teams.save();
      usfw.PS.teams.update();
      usfw.PS.room.update();
      usfw.PS.panel.forceReload = true;
      usfw.PS.update();
    }
  };

  const importableUrl = (value: string): string => {
    if (
      !value.startsWith("https://pokebin.com/") &&
      !value.startsWith("https://pokebin.malaow3.com/")
    ) {
      throw new Error("Not a valid PokeBin URL");
    }
    let new_value = value;
    if (!value.endsWith("/json")) {
      if (!value.endsWith("/")) {
        new_value = `${value}/json`;
      } else {
        new_value = `${value}json`;
      }
    }
    return new_value;
  };

  return (
    <main>
      <input
        onKeyDown={onkey}
        id="import-url"
        class="custom-input custom-input-import"
        type="url"
        placeholder="Enter PokeBin URL"
        value={importUrl()}
        onInput={(e) => setImportUrl(e.currentTarget.value)}
        style={{ "margin-right": "2px" }}
      />
      <input
        onKeyDown={onkey}
        class="custom-input custom-password"
        type="password"
        id="password-import"
        placeholder="Enter a password"
        value={password()}
        onInput={(e) => setPassword(e.currentTarget.value)}
        style={{ "margin-right": "2px" }}
      />
      <button type="submit" class="button" onClick={submit}>
        Import from PokeBin
      </button>

      <style>{`
        .custom-input-import {
          width: 250px;
        }
      `}</style>
    </main>
  );
};

export default Import;
