export const sizeOfUint32 = Uint32Array.BYTES_PER_ELEMENT;
export const sizeOfNullByte = Uint8Array.BYTES_PER_ELEMENT;
export const nullByte = 0x00;

export type WasmInstance = {
  // biome-ignore lint/suspicious/noExplicitAny : The exports type can change based on the Wasm module
  exports: any;
  memory: WebAssembly.Memory;
};

export function decodeString(
  instance: WasmInstance,
  pointer: number,
  length: number,
) {
  const slice = new Uint8Array(instance.memory.buffer, pointer, length);
  return new TextDecoder().decode(slice);
}

export function decodeNullTerminatedString(
  instance: WasmInstance,
  pointer: number,
) {
  if (pointer === 0) return "";

  // Get current memory buffer size
  const memSize = instance.memory.buffer.byteLength;

  // Ensure pointer is within bounds
  if (pointer >= memSize) {
    console.error(`Invalid pointer: ${pointer} exceeds memory size ${memSize}`);
    return "";
  }

  // Create a view starting from pointer
  const slice = new Uint8Array(instance.memory.buffer, pointer);

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
    return decodeString(instance, pointer, length);
  } catch (e) {
    console.error(`Failed to decode string at pointer ${pointer}:`, e);
    return "";
  }
}

export function encodeNullTerminatedString(
  instance: WasmInstance,
  string: string,
) {
  const buffer = new TextEncoder().encode(string);
  const sizeOfNullTerminatedString = buffer.length + sizeOfNullByte;
  const pointer = instance.exports.allocUint8(sizeOfNullTerminatedString);
  const slice = new Uint8Array(
    instance.memory.buffer,
    pointer,
    sizeOfNullTerminatedString,
  );
  slice.set(buffer);
  slice[buffer.length] = nullByte;
  return { pointer, length: buffer.length };
}
