import type { Accessor, Setter } from "solid-js";
import type { Settings } from "./settings.ts";
import {
  type WasmInstance,
  decodeNullTerminatedString,
  decodeString,
  encodeNullTerminatedString,
  sizeOfUint32,
} from "./wasm_utils.ts";
import { getId } from "./utils.ts";
export let exports: WebAssemblyExports;
export let memory: WebAssembly.Memory;

type QRResponse = { ptr: number; size: number };
let qrResponse: QRResponse = { ptr: 0, size: 0 };

function createQRCodeCallback(ptr: number, size: number) {
  qrResponse = { ptr, size };
}

interface WebAssemblyExports {
  memory: WebAssembly.Memory;

  init(seed: bigint): void;

  allocUint8(length: number): number;

  resetArena(): void;
  free(pointer: number, length: number): void;

  validatePaste(buffer_ptr: number, paste_len: number): number;
  parsePaste(
    buffer_ptr: number,
    buffer_len: number,
    twoDimages: boolean,
  ): number;
  destroyPaste(paste_ptr: number): void;

  savePasteToLastViewed(
    limit: number,
    packedStringPointer: number,
    packedStringLength: number,
    pasteJsonPointer: number,
    pasteJsonLength: number,
  ): number;

  getPackedPtr(): number;
  getPackedLen(): number;
  resetPackedResult(): void;
  createQRCode(messagePtr: number): void;
}

let instance: WasmInstance;

export async function initWasm() {
  const version_response = await fetch("/version");
  const version = await version_response.text();
  const wasmModule = await WebAssembly.instantiateStreaming(
    fetch(`/web_wasm?v=${version}`),
    {
      env: {
        _throwError(pointer: number, length: number) {
          const message = decodeString(instance, pointer, length);
          throw new Error(message);
        },
        _consoleLog(pointer: number, length: number) {
          const message = decodeString(instance, pointer, length);
          console.log(message);
        },
        createQRCodeCallback,
      },
    },
  );
  const inst = wasmModule.instance;
  exports = inst.exports as unknown as WebAssemblyExports;
  memory = exports.memory;

  instance = {
    exports: exports,
    memory: memory,
  };

  const now = BigInt(Date.now());
  exports.init(now);
}

export function SavePasteToLastVisited(
  sett: Accessor<Settings>,
  setSett: Setter<Settings>,
  paste: Paste,
) {
  if (sett().lastViewedCount === 0) {
    return;
  }
  const packedString = sett().lastViewedPacked;
  const { pointer: packedStringPointer, length: packedStringLength } =
    encodeNullTerminatedString(instance, packedString);

  // @ts-ignore: we need to add the ID to the paste struct
  paste.id = getId();

  const { pointer: pasteJsonPointer, length: pasteJsonLength } =
    encodeNullTerminatedString(instance, JSON.stringify(paste));

  instance.exports.savePasteToLastViewed(
    sett().lastViewedCount,
    packedStringPointer,
    packedStringLength,
    pasteJsonPointer,
    pasteJsonLength,
  );

  const packedPtr = instance.exports.getPackedPtr();
  const packedLen = instance.exports.getPackedLen();

  if (packedLen === -1) {
    console.log("Failed to get packed string length");
    instance.exports.resetPackedResult();
    return;
  }

  // Read the packed string as bytes
  const packedBytes = new Uint8Array(memory.buffer, packedPtr, packedLen);

  // Decode as UTF-8 string
  const packed = new TextDecoder().decode(packedBytes);
  console.log(packed);

  setSett({ ...sett(), lastViewedPacked: packed });
  localStorage.setItem("lastViewedPacked", packed);

  instance.exports.resetPackedResult();
  instance.exports.resetArena();
}

export function validatePaste(paste: string): number {
  if (!exports || !memory) {
    return -1;
  }

  const pasteBuffer = new TextEncoder().encode(paste);
  const buffer_ptr = exports.allocUint8(pasteBuffer.length);
  if (!buffer_ptr) {
    console.error("Failed to allocate memory");
    return -1;
  }

  // Get a view of memory
  const memoryView = new Uint8Array(exports.memory.buffer);

  // Copy the entire buffer
  memoryView.set(pasteBuffer, buffer_ptr);

  const success = exports.validatePaste(buffer_ptr, pasteBuffer.length);
  exports.resetArena();

  return success;
}

function alignTo4Bytes(pointer: number): number {
  return Math.ceil(pointer / 4) * 4;
}

export type Move = {
  name: string;
  type1: string;
};

export type Pokemon = {
  name: string;
  nickname: string;
  item: string;
  gender: string;
  item_image: string;
  pokemon_image: string;
  moves_len: number;
  moves: Move[];
  evs: number[];
  ivs: number[];
  lines_count: number;
  lines: string[];
  last_stat_ev: string;
  last_stat_iv: string;
  type1: string;
  type2: string;
  ability: string;
  level: number;
  shiny: string;
  hidden_power: string;
  tera_type: string;
  nature: string;
};

export type Paste = {
  title: string;
  author: string;
  notes: string;
  format: string;
  rental: string;
  pokemon_len: number;
  pokemon: Pokemon[];
  isOts: boolean;
};

function decodeMove(movePtr: number): Move {
  try {
    let offset = 0;
    const namePtr = new Uint32Array(memory.buffer, movePtr, 1);
    const nameSlice = namePtr[0];
    const name = decodeNullTerminatedString(instance, nameSlice);
    offset += sizeOfUint32;

    const type1Ptr = new Uint32Array(memory.buffer, movePtr + offset, 1);
    const type1Slice = type1Ptr[0];
    const type1 = decodeNullTerminatedString(instance, type1Slice);

    return { name, type1 };
  } catch (e) {
    console.error(e);
    return { name: "", type1: "" };
  }
}

function decodePokemon(pokemonPtr: number): Pokemon {
  try {
    const basePtr = pokemonPtr;
    let offset = 0;
    const namePtr = new Uint32Array(memory.buffer, basePtr, 1);
    const nameSlice = namePtr[0];
    const name = decodeNullTerminatedString(instance, nameSlice);
    offset += sizeOfUint32;

    const nicknamePtr = new Uint32Array(memory.buffer, basePtr + offset, 1);
    const nicknameSlice = nicknamePtr[0];
    const nickname = decodeNullTerminatedString(instance, nicknameSlice);
    offset += sizeOfUint32;

    const itemPtr = new Uint32Array(memory.buffer, basePtr + offset, 1);
    const itemSlice = itemPtr[0];
    const item = decodeNullTerminatedString(instance, itemSlice);
    offset += sizeOfUint32;

    const genderPtr = new Uint32Array(memory.buffer, basePtr + offset, 1);
    const genderNum = genderPtr[0];
    offset += sizeOfUint32;

    const itemImagePtr = new Uint32Array(memory.buffer, basePtr + offset, 1);
    const itemImageSlice = itemImagePtr[0];
    const itemImage = decodeNullTerminatedString(instance, itemImageSlice);
    offset += sizeOfUint32;

    const pokemonImagePtr = new Uint32Array(memory.buffer, basePtr + offset, 1);
    const pokemonImageSlice = pokemonImagePtr[0];
    const pokemonImage = decodeNullTerminatedString(
      instance,
      pokemonImageSlice,
    );
    offset += sizeOfUint32;

    const movesLenPtr = new Uint32Array(memory.buffer, basePtr + offset, 1);
    const moves_len = movesLenPtr[0];
    offset += sizeOfUint32;

    const moves: Move[] = [];
    if (moves_len > 0) {
      const movesArrayPtrSlice = new Uint32Array(
        memory.buffer,
        basePtr + offset,
        1,
      );
      const movesArrayPointer = movesArrayPtrSlice[0];

      const movesArray = new Uint32Array(
        memory.buffer,
        movesArrayPointer,
        moves_len,
      );

      if (moves_len > 0) {
        for (let i = 0; i < moves_len; i++) {
          const currentMovePtr = movesArray[i];
          try {
            const move = decodeMove(currentMovePtr);
            moves.push(move);
          } catch (e) {
            console.error(`Error decoding move at index ${i}:`, e);
          }
        }
      }
    }
    offset += sizeOfUint32;

    let gender = "";
    if (genderNum === 77) {
      gender = "M";
    } else if (genderNum === 70) {
      gender = "F";
    }

    const evs: number[] = [];
    for (let i = 0; i < 6; i++) {
      const evPtr = new Uint32Array(memory.buffer, basePtr + offset, 1);
      const evValue = evPtr[0];
      evs.push(evValue);
      offset += sizeOfUint32;
    }

    const ivs: number[] = [];
    for (let i = 0; i < 6; i++) {
      const ivPtr = new Uint32Array(memory.buffer, basePtr + offset, 1);
      const ivValue = ivPtr[0];
      ivs.push(ivValue);
      offset += sizeOfUint32;
    }

    const linesLenPointer = basePtr + offset;
    const linesLenSlice = new Uint32Array(memory.buffer, linesLenPointer, 1);
    const lines_len = linesLenSlice[0];
    offset += sizeOfUint32;

    const lines: string[] = [];
    if (lines_len > 0) {
      // Decode items array pointer - ensure 4-byte alignment
      const linesArrayPtrPointer = basePtr + offset;
      const linesArrayPtrSlice = new Uint32Array(
        memory.buffer,
        linesArrayPtrPointer,
        1,
      );
      const linesArrayPointer = linesArrayPtrSlice[0];

      // Decode each line - ensure the pointer is properly aligned
      const alignedLinesArrayPointer = alignTo4Bytes(linesArrayPointer);
      const linesArraySlice = new Uint32Array(
        memory.buffer,
        alignedLinesArrayPointer,
        lines_len,
      );

      for (let i = 0; i < lines_len; i++) {
        const linePtr = linesArraySlice[i];
        const line = decodeNullTerminatedString(instance, linePtr);
        lines.push(line);
      }

      offset += sizeOfUint32 * lines_len;
    } else {
      offset += sizeOfUint32;
    }

    const lastStatEvPtr = new Uint32Array(memory.buffer, basePtr + offset, 1);
    const lastStatEvSlice = lastStatEvPtr[0];
    const last_stat_ev = decodeNullTerminatedString(instance, lastStatEvSlice);
    offset += sizeOfUint32;

    const lastStatIvPtr = new Uint32Array(memory.buffer, basePtr + offset, 1);
    const lastStatIvSlice = lastStatIvPtr[0];
    const last_stat_iv = decodeNullTerminatedString(instance, lastStatIvSlice);
    offset += sizeOfUint32;

    const type1Ptr = new Uint32Array(memory.buffer, basePtr + offset, 1);
    const type1Slice = type1Ptr[0];
    const type1 = decodeNullTerminatedString(instance, type1Slice);
    offset += sizeOfUint32;

    const type2Ptr = new Uint32Array(memory.buffer, basePtr + offset, 1);
    const type2Slice = type2Ptr[0];
    const type2 = decodeNullTerminatedString(instance, type2Slice);
    offset += sizeOfUint32;

    const abilityPtr = new Uint32Array(memory.buffer, basePtr + offset, 1);
    const abilitySlice = abilityPtr[0];
    const ability = decodeNullTerminatedString(instance, abilitySlice);
    offset += sizeOfUint32;

    const levelPtr = new Uint32Array(memory.buffer, basePtr + offset, 1);
    const level = levelPtr[0];
    offset += sizeOfUint32;

    const shinyPtr = new Uint32Array(memory.buffer, basePtr + offset, 1);
    const shinySlice = shinyPtr[0];
    const shiny = decodeNullTerminatedString(instance, shinySlice);
    offset += sizeOfUint32;

    const hpPointer = new Uint32Array(memory.buffer, basePtr + offset, 1);
    const hpSlice = hpPointer[0];
    const hidden_power = decodeNullTerminatedString(instance, hpSlice);
    offset += sizeOfUint32;

    const teraTypePointer = new Uint32Array(memory.buffer, basePtr + offset, 1);
    const teraTypeSlice = teraTypePointer[0];
    const tera_type = decodeNullTerminatedString(instance, teraTypeSlice);
    offset += sizeOfUint32;

    const naturePointer = new Uint32Array(memory.buffer, basePtr + offset, 1);
    const natureSlice = naturePointer[0];
    const nature = decodeNullTerminatedString(instance, natureSlice);
    offset += sizeOfUint32;

    return {
      name,
      nickname,
      item,
      gender,
      item_image: itemImage,
      pokemon_image: pokemonImage,
      moves_len: moves_len,
      moves,
      evs,
      ivs,
      lines_count: lines_len,
      lines,
      last_stat_ev,
      last_stat_iv,
      type1,
      type2,
      ability,
      level,
      shiny,
      hidden_power,
      tera_type,
      nature,
    };
  } catch (e) {
    console.error(e);
    return {
      name: "",
      nickname: "",
      item: "",
      gender: "",
      item_image: "",
      pokemon_image: "",
      moves_len: 0,
      moves: [],
      evs: [],
      ivs: [],
      lines_count: 0,
      lines: [],
      last_stat_ev: "",
      last_stat_iv: "",
      type1: "",
      type2: "",
      ability: "",
      level: 100,
      shiny: "",
      hidden_power: "",
      tera_type: "",
      nature: "",
    };
  }
}

function decodePaste(pastePtr: number): Paste {
  try {
    // Access the header pointer
    const titleSlice = new Uint32Array(memory.buffer, pastePtr, 1);
    const titlePtr = titleSlice[0];
    const title = decodeNullTerminatedString(instance, titlePtr);

    const authorSlice = new Uint32Array(
      memory.buffer,
      pastePtr + sizeOfUint32,
      1,
    );
    const authorPtr = authorSlice[0];
    const author = decodeNullTerminatedString(instance, authorPtr);

    const notesSlice = new Uint32Array(
      memory.buffer,
      pastePtr + sizeOfUint32 * 2,
      1,
    );
    const notesPtr = notesSlice[0];
    const notes = decodeNullTerminatedString(instance, notesPtr);

    const formatSlice = new Uint32Array(
      memory.buffer,
      pastePtr + sizeOfUint32 * 3,
      1,
    );
    const formatPtr = formatSlice[0];
    const format = decodeNullTerminatedString(instance, formatPtr);

    const rentalSlice = new Uint32Array(
      memory.buffer,
      pastePtr + sizeOfUint32 * 4,
      1,
    );
    const rentalPtr = rentalSlice[0];
    const rental = decodeNullTerminatedString(instance, rentalPtr);

    const pokemonLenPtr = pastePtr + sizeOfUint32 * 5;
    const pokemonLenSlice = new Uint32Array(memory.buffer, pokemonLenPtr, 1);
    const pokemon_len = pokemonLenSlice[0];

    // Decode items array pointer - ensure 4-byte alignment
    const pokemonArrayPtrPointer = alignTo4Bytes(pastePtr + sizeOfUint32 * 6);
    const pokemonArrayPtrSlice = new Uint32Array(
      memory.buffer,
      pokemonArrayPtrPointer,
      1,
    );
    const pokemonArrayPointer = pokemonArrayPtrSlice[0];

    // Decode each item - ensure the pointer is properly aligned
    const pokemon: Pokemon[] = [];
    const alignedPokemonArrayPointer = alignTo4Bytes(pokemonArrayPointer);
    const pokemonArraySlice = new Uint32Array(
      memory.buffer,
      alignedPokemonArrayPointer,
      pokemon_len,
    );

    for (let i = 0; i < pokemon_len; i++) {
      const pokemonPtr = pokemonArraySlice[i];
      const mon = decodePokemon(pokemonPtr);
      pokemon.push(mon);
    }

    const isOtsOffset = pokemonArrayPtrPointer + sizeOfUint32;
    const isOtsValue = new Uint32Array(memory.buffer, isOtsOffset, 1)[0];
    const isOts = isOtsValue === 1;

    const paste = {
      title,
      author,
      notes,
      format,
      rental,
      pokemon_len,
      pokemon,
      isOts,
    };

    return paste;
  } finally {
    exports.destroyPaste(pastePtr);
  }
}

export function parsePaste(data: string, twoDimages: boolean): Paste | null {
  if (!exports || !memory) {
    return null;
  }

  const { pointer, length } = encodeNullTerminatedString(instance, data);

  const pastePtr = exports.parsePaste(pointer, length, twoDimages);
  const paste = decodePaste(pastePtr);

  exports.resetArena();

  return paste;
}

export function utf8ToBase64(str: string | undefined) {
  // Encode to UTF-8 bytes, then to base64
  return btoa(String.fromCharCode(...new TextEncoder().encode(str)));
}

export function base64ToUtf8(b64: string) {
  // Decode base64 to bytes, then decode as UTF-8
  return new TextDecoder().decode(
    Uint8Array.from(atob(b64), (c) => c.charCodeAt(0)),
  );
}

function renderQRCode(
  matrix: number[] | Uint8Array<ArrayBuffer>,
  size: number,
) {
  const canvas = document.createElement("canvas");
  const ctx = canvas.getContext("2d");
  if (ctx === null) {
    return;
  }

  const canvasScale = 10;
  const canvasSize = canvasScale * size;

  canvas.width = canvasSize;
  canvas.height = canvasSize;

  ctx.scale(canvasScale, canvasScale);

  ctx.fillStyle = "white";
  ctx.fillRect(0, 0, size, size);

  ctx.fillStyle = "black";

  for (let r = 0; r < size; r++) {
    for (let c = 0; c < size; c++) {
      if (matrix[r * size + c] === 1) {
        ctx.fillRect(c, r, 1, 1);
      }
    }
  }

  return canvas.toDataURL("image/png");
}

export function createQRCode(message: string) {
  const buffer = new TextEncoder().encode(message);
  const messagePtr = exports.allocUint8(buffer.length + 1);
  const slice = new Uint8Array(memory.buffer, messagePtr, buffer.length + 1);
  slice.set(buffer);
  slice[buffer.length] = 0;

  exports.createQRCode(messagePtr);
  // createQRCodeCallback is called by the wasm module

  const matrix = new Uint8Array(
    memory.buffer,
    qrResponse.ptr,
    qrResponse.size * qrResponse.size,
  );
  const url = renderQRCode(matrix, qrResponse.size);

  exports.free(messagePtr, message.length);
  exports.free(qrResponse.ptr, qrResponse.size * qrResponse.size);
  return url;
}
