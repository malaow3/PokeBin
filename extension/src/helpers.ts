function utf8ToBase64(str: string | undefined) {
  // Encode to UTF-8 bytes, then to base64
  return btoa(String.fromCharCode(...new TextEncoder().encode(str)));
}

function base64ToUtf8(b64: string) {
  // Decode base64 to bytes, then decode as UTF-8
  return new TextDecoder().decode(
    Uint8Array.from(atob(b64), (c) => c.charCodeAt(0)),
  );
}

export { utf8ToBase64, base64ToUtf8 };
