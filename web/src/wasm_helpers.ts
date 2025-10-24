export let exports: WebAssemblyExports;
export let memory: WebAssembly.Memory;
import { encrypt, decrypt } from './encryption.ts';
import { type WasmInstance, decodeString } from './wasm_utils.ts';

let instance: WasmInstance;

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
}

async function initWasm() {
    const wasmModule = await WebAssembly.instantiateStreaming(fetch('/wasm'), {
        env: {
            _throwError(pointer: number, length: number) {
                const message = decodeString(instance, pointer, length);
                throw new Error(message);
            },
            _consoleLog(pointer: number, length: number) {
                const message = decodeString(instance, pointer, length);
                console.log(message);
            },
        },
    });
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

export { encrypt, initWasm, decrypt };
