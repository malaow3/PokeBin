export let exports: WebAssemblyExports;
export let memory: WebAssembly.Memory;
import { encrypt, decrypt } from "./encryption.ts";

interface WebAssemblyExports {
  memory: WebAssembly.Memory;

  init(seed: bigint): void;

  allocUint8(length: number): number;

  encryptMessage(
    buffer_ptr: number,
    passphrase_len: number,
    message_len: number,
  ): boolean;

  resetArena(): void;
  free(pointer: number, length: number): void;

  getResultPtr(): number;
  getResultLen(): number;
  decryptMessage(
    buffer_ptr: number,
    passphrase_len: number,
    encrypted_len: number,
  ): boolean;

  validatePaste(buffer_ptr: number, paste_len: number): number;

  sendPerson(person_ptr: number): void;
  receivePerson(buffer_ptr: number, buffer_len: number): number;
  destroyPerson(person_ptr: number): void;

  parsePaste(
    buffer_ptr: number,
    buffer_len: number,
    twoDimages: boolean,
  ): number;
  destroyPaste(paste_ptr: number): void;
}

const sizeOfUint32 = Uint32Array.BYTES_PER_ELEMENT;
const sizeOfUint8 = Uint8Array.BYTES_PER_ELEMENT;
const sizeOfNullByte = Uint8Array.BYTES_PER_ELEMENT;
const nullByte = 0x00;

function decodeString(pointer: number, length: number) {
  const slice = new Uint8Array(memory.buffer, pointer, length);
  return new TextDecoder().decode(slice);
}

function decodeNullTerminatedString(pointer: number) {
  if (pointer === 0) return "";

  // Get current memory buffer size
  const memSize = memory.buffer.byteLength;

  // Ensure pointer is within bounds
  if (pointer >= memSize) {
    console.error(`Invalid pointer: ${pointer} exceeds memory size ${memSize}`);
    return "";
  }

  // Create a view starting from pointer
  const slice = new Uint8Array(memory.buffer, pointer);

  // Find null terminator, but limit search to avoid buffer overflow
  const maxLength = memSize - pointer;
  const length = slice.findIndex((value: number, index) => {
    if (index >= maxLength) return true;
    return value === nullByte;
  });

  if (length === -1 || length === 0) {
    return "";
  }

  try {
    return decodeString(pointer, length);
  } catch (e) {
    console.error(`Failed to decode string at pointer ${pointer}:`, e);
    return "";
  }
}

function encodeNullTerminatedString(string: string) {
  const buffer = new TextEncoder().encode(string);
  const sizeOfNullTerminatedString = buffer.length + sizeOfNullByte;
  const pointer = exports.allocUint8(sizeOfNullTerminatedString);
  const slice = new Uint8Array(
    memory.buffer,
    pointer,
    sizeOfNullTerminatedString,
  );
  slice.set(buffer);
  slice[buffer.length] = nullByte;
  return pointer;
}

async function initWasm() {
  const wasmModule = await WebAssembly.instantiateStreaming(fetch("/wasm"), {
    env: {
      _throwError(pointer: number, length: number) {
        const message = decodeString(pointer, length);
        throw new Error(message);
      },
      _consoleLog(pointer: number, length: number) {
        const message = decodeString(pointer, length);
        console.log(message);
      },
    },
  });
  const instance = wasmModule.instance;
  exports = instance.exports as unknown as WebAssemblyExports;
  memory = exports.memory;

  const now = BigInt(Date.now());
  exports.init(now);
}

function validatePaste(paste: string): number {
  if (!exports || !memory) {
    return -1;
  }

  const buffer_ptr = exports.allocUint8(paste.length);
  if (!buffer_ptr) {
    console.error("Failed to allocate memory");
    return -1;
  }

  // Get a view of memory
  const memoryView = new Uint8Array(exports.memory.buffer);

  // Copy the passphrase and message into the single buffer
  const pasteBuffer = new TextEncoder().encode(paste);
  for (let i = 0; i < paste.length; i++) {
    memoryView[buffer_ptr + i] = pasteBuffer[i];
  }

  const success = exports.validatePaste(buffer_ptr, paste.length);
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
    const name = decodeNullTerminatedString(nameSlice);
    offset += sizeOfUint32;

    const type1Ptr = new Uint32Array(memory.buffer, movePtr + offset, 1);
    const type1Slice = type1Ptr[0];
    const type1 = decodeNullTerminatedString(type1Slice);

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
    const name = decodeNullTerminatedString(nameSlice);
    offset += sizeOfUint32;

    const nicknamePtr = new Uint32Array(memory.buffer, basePtr + offset, 1);
    const nicknameSlice = nicknamePtr[0];
    const nickname = decodeNullTerminatedString(nicknameSlice);
    offset += sizeOfUint32;

    const itemPtr = new Uint32Array(memory.buffer, basePtr + offset, 1);
    const itemSlice = itemPtr[0];
    const item = decodeNullTerminatedString(itemSlice);
    offset += sizeOfUint32;

    const genderPtr = new Uint32Array(memory.buffer, basePtr + offset, 1);
    const genderNum = genderPtr[0];
    offset += sizeOfUint32;

    const itemImagePtr = new Uint32Array(memory.buffer, basePtr + offset, 1);
    const itemImageSlice = itemImagePtr[0];
    const itemImage = decodeNullTerminatedString(itemImageSlice);
    offset += sizeOfUint32;

    const pokemonImagePtr = new Uint32Array(memory.buffer, basePtr + offset, 1);
    const pokemonImageSlice = pokemonImagePtr[0];
    const pokemonImage = decodeNullTerminatedString(pokemonImageSlice);
    offset += sizeOfUint32;

    const movesLenPtr = new Uint32Array(memory.buffer, basePtr + offset, 1);
    const moves_len = movesLenPtr[0];
    offset += sizeOfUint32;

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

    const moves: Move[] = [];
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
        const line = decodeNullTerminatedString(linePtr);
        lines.push(line);
      }

      offset += sizeOfUint32 * lines_len;
    } else {
      offset += sizeOfUint32;
    }

    const lastStatEvPtr = new Uint32Array(memory.buffer, basePtr + offset, 1);
    const lastStatEvSlice = lastStatEvPtr[0];
    const last_stat_ev = decodeNullTerminatedString(lastStatEvSlice);
    offset += sizeOfUint32;

    const lastStatIvPtr = new Uint32Array(memory.buffer, basePtr + offset, 1);
    const lastStatIvSlice = lastStatIvPtr[0];
    const last_stat_iv = decodeNullTerminatedString(lastStatIvSlice);
    offset += sizeOfUint32;

    const type1Ptr = new Uint32Array(memory.buffer, basePtr + offset, 1);
    const type1Slice = type1Ptr[0];
    const type1 = decodeNullTerminatedString(type1Slice);
    offset += sizeOfUint32;

    const type2Ptr = new Uint32Array(memory.buffer, basePtr + offset, 1);
    const type2Slice = type2Ptr[0];
    const type2 = decodeNullTerminatedString(type2Slice);
    offset += sizeOfUint32;

    const abilityPtr = new Uint32Array(memory.buffer, basePtr + offset, 1);
    const abilitySlice = abilityPtr[0];
    const ability = decodeNullTerminatedString(abilitySlice);
    offset += sizeOfUint32;

    const levelPtr = new Uint32Array(memory.buffer, basePtr + offset, 1);
    const level = levelPtr[0];
    offset += sizeOfUint32;

    const shinyPtr = new Uint32Array(memory.buffer, basePtr + offset, 1);
    const shinySlice = shinyPtr[0];
    const shiny = decodeNullTerminatedString(shinySlice);
    offset += sizeOfUint32;

    const hpPointer = new Uint32Array(memory.buffer, basePtr + offset, 1);
    const hpSlice = hpPointer[0];
    const hidden_power = decodeNullTerminatedString(hpSlice);
    offset += sizeOfUint32;

    const teraTypePointer = new Uint32Array(memory.buffer, basePtr + offset, 1);
    const teraTypeSlice = teraTypePointer[0];
    const tera_type = decodeNullTerminatedString(teraTypeSlice);
    offset += sizeOfUint32;

    const naturePointer = new Uint32Array(memory.buffer, basePtr + offset, 1);
    const natureSlice = naturePointer[0];
    const nature = decodeNullTerminatedString(natureSlice);
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
    const title = decodeNullTerminatedString(titlePtr);

    const authorSlice = new Uint32Array(
      memory.buffer,
      pastePtr + sizeOfUint32,
      1,
    );
    const authorPtr = authorSlice[0];
    const author = decodeNullTerminatedString(authorPtr);

    const notesSlice = new Uint32Array(
      memory.buffer,
      pastePtr + sizeOfUint32 * 2,
      1,
    );
    const notesPtr = notesSlice[0];
    const notes = decodeNullTerminatedString(notesPtr);

    const formatSlice = new Uint32Array(
      memory.buffer,
      pastePtr + sizeOfUint32 * 3,
      1,
    );
    const formatPtr = formatSlice[0];
    const format = decodeNullTerminatedString(formatPtr);

    const rentalSlice = new Uint32Array(
      memory.buffer,
      pastePtr + sizeOfUint32 * 4,
      1,
    );
    const rentalPtr = rentalSlice[0];
    const rental = decodeNullTerminatedString(rentalPtr);

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

  const input = encodeNullTerminatedString(data);
  const input_len = data.length;

  const pastePtr = exports.parsePaste(input, input_len, twoDimages);
  const paste = decodePaste(pastePtr);

  exports.resetArena();

  return paste;
}

export { encrypt, initWasm, decrypt, validatePaste };
