interface WebAssemblyExports {
  init(seed: bigint): void;
  memory: WebAssembly.Memory;

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
}
export let wasm_exports: WebAssemblyExports;
export let memory: WebAssembly.Memory;

function decodeString(pointer: number, length: number) {
  const slice = new Uint8Array(memory.buffer, pointer, length);
  return new TextDecoder().decode(slice);
}

export async function initWasm() {
  const wasmModule = await WebAssembly.instantiateStreaming(
    fetch("https://pokebin.com/wasm"),
    {
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
    },
  );
  const instance = wasmModule.instance;
  wasm_exports = instance.exports as unknown as WebAssemblyExports;
  memory = wasm_exports.memory;

  const now = BigInt(Date.now());
  wasm_exports.init(now);
}
