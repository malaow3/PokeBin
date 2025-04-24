import { wasm_exports, memory } from "./wasm.ts";

export function encrypt(message: string, passphrase: string): string | null {
  if (!wasm_exports || !memory) {
    return null;
  }
  const passphrase_len = passphrase.length;
  const message_len = message.length;

  // Allocate a single buffer for both strings
  const buffer_ptr = wasm_exports.allocUint8(passphrase_len + message_len);
  if (!buffer_ptr) {
    console.error("Failed to allocate memory");
    return null;
  }

  // Get a view of memory
  let memoryView = new Uint8Array(exports.memory.buffer);

  // Copy the passphrase and message into the single buffer
  const passphraseBuffer = new TextEncoder().encode(passphrase);
  const messageBuffer = new TextEncoder().encode(message);

  // Write passphrase at the beginning of the buffer
  for (let i = 0; i < passphrase_len; i++) {
    memoryView[buffer_ptr + i] = passphraseBuffer[i];
  }

  // Write message right after the passphrase
  for (let i = 0; i < message_len; i++) {
    memoryView[buffer_ptr + passphrase_len + i] = messageBuffer[i];
  }

  // Single call to encrypt
  const success = exports.encryptMessage(
    buffer_ptr,
    passphrase_len,
    message_len,
  );

  if (!success) {
    console.error("Failed to encrypt message");
    exports.resetArena();
    return null;
  }

  // Get result information from separate functions
  const resultPtr = exports.getResultPtr();
  const resultLen = exports.getResultLen();

  if (resultPtr === 0 || resultLen === 0) {
    console.error("Invalid result");
    exports.resetArena();
    return null;
  }

  // Get a fresh view of memory after the WASM function call
  memoryView = new Uint8Array(exports.memory.buffer);

  const decoder = new TextDecoder();
  const result_message = decoder.decode(
    memoryView.slice(resultPtr, resultPtr + resultLen),
  );

  // Reset the arena instead of individual frees
  exports.resetArena();

  return result_message;
}

export function decrypt(encrypted: string, passphrase: string): string | null {
  if (!exports || !memory) {
    return null;
  }
  const passphrase_len = passphrase.length;
  const encrypted_len = encrypted.length;

  // Allocate a single buffer for both strings
  const buffer_ptr = exports.allocUint8(passphrase_len + encrypted_len);
  if (!buffer_ptr) {
    console.error("Failed to allocate memory");
    return null;
  }

  // Get a view of memory
  let memoryView = new Uint8Array(exports.memory.buffer);

  // Copy the passphrase and message into the single buffer
  const passphraseBuffer = new TextEncoder().encode(passphrase);
  const encryptedBuffer = new TextEncoder().encode(encrypted);

  // Write passphrase at the beginning of the buffer
  for (let i = 0; i < passphrase_len; i++) {
    memoryView[buffer_ptr + i] = passphraseBuffer[i];
  }

  // Write message right after the passphrase
  for (let i = 0; i < encrypted_len; i++) {
    memoryView[buffer_ptr + passphrase_len + i] = encryptedBuffer[i];
  }

  // Single call to encrypt
  const success = exports.decryptMessage(
    buffer_ptr,
    passphrase_len,
    encrypted_len,
  );

  if (!success) {
    console.error("Failed to encrypt message");
    exports.resetArena();
    return null;
  }

  // Get result information from separate functions
  const resultPtr = exports.getResultPtr();
  const resultLen = exports.getResultLen();

  if (resultPtr === 0 || resultLen === 0) {
    console.error("Invalid result");
    exports.resetArena();
    return null;
  }

  // Get a fresh view of memory after the WASM function call
  memoryView = new Uint8Array(exports.memory.buffer);

  const decoder = new TextDecoder();
  const result_message = decoder.decode(
    memoryView.slice(resultPtr, resultPtr + resultLen),
  );

  // Reset the arena instead of individual frees
  exports.resetArena();

  return result_message;
}
