import { createSignal } from "solid-js";

export type Settings = {
  moveColors: boolean;
  twoDImages: boolean;
  darkMode: boolean;
  newFormat: boolean;
};

export function initSettings() {
  const moveColorsString = localStorage.getItem("moveColors");
  let moveColors = true;
  if (moveColorsString !== null) {
    moveColors = JSON.parse(moveColorsString);
  }

  const twoDImagesString = localStorage.getItem("twoDImages");
  let twoDImages = false;
  if (twoDImagesString !== null) {
    twoDImages = JSON.parse(twoDImagesString);
  }

  const darkModeString = localStorage.getItem("darkMode");
  let darkMode = true;
  if (darkModeString !== null) {
    darkMode = JSON.parse(darkModeString);
  }

  const newFormatString = localStorage.getItem("newFormat");
  let newFormat = false;
  if (newFormatString !== null) {
    newFormat = JSON.parse(newFormatString);
  }

  const initSettings: Settings = {
    moveColors: moveColors,
    twoDImages: twoDImages,
    darkMode: darkMode,
    newFormat: newFormat,
  };

  const [sett, setSett] = createSignal<Settings>(initSettings);
  return { sett, setSett };
}
