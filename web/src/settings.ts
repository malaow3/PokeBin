import { type Accessor, createSignal } from 'solid-js';

export type Settings = {
    moveColors: boolean;
    twoDImages: boolean;
    darkMode: boolean;
    newFormat: boolean;
    lastViewedCount: number;
    lastViewedPacked: string;
};

export function initSettings() {
    const moveColorsString = localStorage.getItem('moveColors');
    let moveColors = true;
    if (moveColorsString !== null) {
        moveColors = JSON.parse(moveColorsString);
    }

    const twoDImagesString = localStorage.getItem('twoDImages');
    let twoDImages = false;
    if (twoDImagesString !== null) {
        twoDImages = JSON.parse(twoDImagesString);
    }

    const darkModeString = localStorage.getItem('darkMode');
    let darkMode = true;
    if (darkModeString !== null) {
        darkMode = JSON.parse(darkModeString);
    }

    const newFormatString = localStorage.getItem('newFormat');
    let newFormat = false;
    if (newFormatString !== null) {
        newFormat = JSON.parse(newFormatString);
    }

    const lastViewedCountString = localStorage.getItem('lastViewedCount');
    let lastViewedCount = 20;
    if (lastViewedCountString !== null) {
        lastViewedCount = JSON.parse(lastViewedCountString);
    }

    const lastViewedPackedString = localStorage.getItem('lastViewedPacked');
    let lastViewedPacked = '';
    if (lastViewedPackedString !== null) {
        lastViewedPacked = lastViewedPackedString;
    }

    const initSettings: Settings = {
        moveColors: moveColors,
        twoDImages: twoDImages,
        darkMode: darkMode,
        newFormat: newFormat,
        lastViewedCount: lastViewedCount,
        lastViewedPacked: lastViewedPacked,
    };

    const [sett, setSett] = createSignal<Settings>(initSettings);
    return { sett, setSett };
}

function packedToList(packed: string) {
    const list = packed.split('\n');
    return list;
}

export type PackedPaste = {
    id: string;
    name: string;
    format: string;
    pokemon: string[];
};

export function getPackedPastes(): PackedPaste[] {
    const packed = localStorage.getItem('lastViewedPacked');
    if (packed === null) {
        return [];
    }
    const list: string[] = packedToList(packed);
    return list.map((item) => {
        const sections = item.split('|');
        return {
            id: sections[0],
            name: sections[1],
            format: sections[2],
            pokemon: sections.slice(3),
        };
    });
}

function listToPacked(list: PackedPaste[]): string {
    let packedString = '';
    for (let i = 0; i < list.length; i++) {
        if (i > 0) {
            packedString += '\n';
        }
        packedString += `${list[i].id}|${list[i].name}|${list[i].format}`;
        for (let j = 0; j < list[i].pokemon.length; j++) {
            packedString += `|${list[i].pokemon[j]}`;
        }
    }
    return packedString;
}

export function removePackedPaste(
    id: string,
    sett: Accessor<Settings>,
    setSett: (settings: Settings) => void,
) {
    const items = getPackedPastes().filter((item) => item.id !== id);
    const newPacked = listToPacked(items);
    localStorage.setItem('lastViewedPacked', newPacked);
    setSett({ ...sett(), lastViewedPacked: newPacked });
}

export function updateSetting(
    key: string,
    value: boolean | number | string,
    sett: Accessor<Settings>,
    setSett: (settings: Settings) => void,
) {
    if (key === 'lastViewedCount' && typeof value === 'number') {
        const list = packedToList(sett().lastViewedPacked);
        if (value === 0) {
            setSett({ ...sett(), lastViewedPacked: '' });
        } else {
            setSett({
                ...sett(),
                lastViewedPacked: list.slice(0, value).join('\n'),
            });
        }
    }

    setSett({ ...sett(), [key]: value });
    localStorage.setItem(key, JSON.stringify(value));
}
