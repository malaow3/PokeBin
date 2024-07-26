// Define custom paste data type
export type Set = {
    mon: Mon | null;
    text: string | null;
};
export type Move = {
    name: string;
    type1: string;
};
export type Mon = {
    nickname: string;
    name: string;
    type1: string;
    item: string;
    other: string[];
    hp: number;
    atk: number;
    def: number;
    spa: number;
    spd: number;
    spe: number;
    last_stat: string;
    image: string;
    item_img: string;
    hp_iv: number | null;
    atk_iv: number | null;
    def_iv: number | null;
    spa_iv: number | null;
    spd_iv: number | null;
    spe_iv: number | null;
    last_stat_iv: string | null;
    moves: Move[];
    gender: string;
};

function newMon(): Mon {
    return {
        nickname: "",
        name: "",
        type1: "",
        item: "",
        other: [],
        hp: 0,
        atk: 0,
        def: 0,
        spa: 0,
        spd: 0,
        spe: 0,
        last_stat: "",
        image: "",
        item_img: "",
        hp_iv: null,
        atk_iv: null,
        def_iv: null,
        spa_iv: null,
        spd_iv: null,
        spe_iv: null,
        last_stat_iv: null,
        moves: [],
        gender: "",
    };
}

export type PasteData = {
    title: string;
    author: string;
    notes: string;
    rental: string;
    format: string;
    paste: string;
    sets: Set[];
    encrypted_data: string;
    // biome-ignore lint/complexity/noBannedTypes: object is ok.
    mons: Object;
    // biome-ignore lint/complexity/noBannedTypes: object is ok.
    items: Object;
    // biome-ignore lint/complexity/noBannedTypes: object is ok.
    moves: Object;
};

// Create empty paste data
function newPasteData(): PasteData {
    return {
        title: "",
        author: "",
        notes: "",
        rental: "",
        format: "",
        paste: "",
        sets: [],
        encrypted_data: "",
        mons: {},
        items: {},
        moves: {},
    };
}
export { newMon, newPasteData };
