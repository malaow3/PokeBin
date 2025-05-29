const std = @import("std");
const crypto = std.crypto;
const utils = @import("utils.zig");

// Global variables to store result information
pub var result_ptr: u32 = 0;
pub var result_len: u32 = 0;

// Functions to get result information
pub fn getResultPtr() u32 {
    return result_ptr;
}

pub fn getResultLen() u32 {
    return result_len;
}

pub fn resetResult() void {
    result_ptr = 0;
    result_len = 0;
}

// Combined encryption function that sets global result variables
pub fn encryptMessage(
    allocator: std.mem.Allocator,
    buffer_ptr: [*]u8,
    passphrase_len: usize,
    message_len: usize,
) bool {
    // Reset result variables
    result_ptr = 0;
    result_len = 0;

    const passphrase = buffer_ptr[0..passphrase_len];
    const message = buffer_ptr[passphrase_len .. passphrase_len + message_len];

    // Generate a random nonce (12 bytes for AES-GCM)
    var nonce: [12]u8 = undefined;

    // Combine seconds and milliseconds for a more precise seed
    utils.getRand().?.random().bytes(&nonce);

    // Generate a unique salt for each encryption
    var salt: [16]u8 = undefined;
    utils.getRand().?.random().bytes(&salt);

    // Derive key from passphrase with the unique salt
    var key: [32]u8 = undefined;
    deriveKey(allocator, passphrase, &salt, &key) catch return false;

    // Create AES-GCM implementation
    const aes = crypto.core.aes.Aes256.initEnc(key);

    // Allocate buffer for ciphertext and tag
    const tag_len = 16; // 16 bytes for authentication tag
    const ciphertext_len = message_len;
    const total_len = ciphertext_len + tag_len;

    var ciphertext = allocator.alloc(u8, total_len) catch return false;

    // Encrypt using AES-CTR mode with encryptWide where possible
    var counter = [_]u8{0} ** 16;
    @memcpy(counter[0..12], &nonce);

    var i: usize = 0;
    const block_size = 16;

    // Process multiple blocks at once using encryptWide when possible
    const wide_count = 4; // Process 4 blocks at a time
    const wide_size = wide_count * block_size;

    while (i + wide_size <= message_len) : (i += wide_size) {
        // Generate keystream for multiple blocks
        var keystream: [wide_size]u8 = undefined;

        // Use encryptWide for parallel keystream generation
        if (wide_count == 4) {
            // Prepare counters for 4 blocks
            var counters: [4][16]u8 = undefined;

            // Initialize counters
            for (0..4) |j| {
                @memcpy(&counters[j], &counter);

                // Increment counter for next block
                var k: usize = 15;
                while (true) : (k -= 1) {
                    counter[k] +%= 1;
                    if (counter[k] != 0 or k == 0) break;
                }
            }

            // Use encryptWide to generate keystream for 4 blocks at once
            var keystream_blocks: [4][16]u8 = undefined;
            for (0..4) |j| {
                aes.encrypt(&keystream_blocks[j], &counters[j]);
            }

            // Flatten keystream blocks
            for (0..4) |j| {
                @memcpy(keystream[j * 16 ..][0..16], &keystream_blocks[j]);
            }
        } else {
            // Fallback for other wide_count values
            var j: usize = 0;
            while (j < wide_size) : (j += block_size) {
                aes.encrypt(keystream[j..][0..block_size], &counter);

                // Increment counter
                var k: usize = 15;
                while (true) : (k -= 1) {
                    counter[k] +%= 1;
                    if (counter[k] != 0 or k == 0) break;
                }
            }
        }

        // XOR message with keystream to get ciphertext
        for (0..wide_size) |j| {
            ciphertext[i + j] = message[i + j] ^ keystream[j];
        }
    }

    // Process remaining blocks one at a time
    while (i < message_len) : (i += block_size) {
        var keystream: [block_size]u8 = undefined;
        aes.encrypt(&keystream, &counter);

        // Increment counter
        var j: usize = 15;
        while (true) : (j -= 1) {
            counter[j] +%= 1;
            if (counter[j] != 0 or j == 0) break;
        }

        // XOR message with keystream
        const remaining = message_len - i;
        const block_len = @min(block_size, remaining);
        var k: usize = 0;
        while (k < block_len) : (k += 1) {
            ciphertext[i + k] = message[i + k] ^ keystream[k];
        }
    }

    // Calculate authentication tag (simplified GMAC)
    var tag: [16]u8 = undefined;
    var auth_data = [_]u8{0} ** 16;
    aes.encrypt(&tag, &auth_data);

    // XOR tag with first block of ciphertext (simplified)
    for (0..16) |j| {
        if (j < ciphertext_len) {
            tag[j] ^= ciphertext[j];
        }
    }

    // Copy tag to the end of ciphertext
    @memcpy(ciphertext[ciphertext_len..], &tag);

    // Format output as "gcm:salt:nonce:ciphertext+tag" in hex
    const prefix = "gcm:";
    const prefix_len = prefix.len;
    const salt_hex_len = salt.len * 2;
    const nonce_hex_len = nonce.len * 2;
    const ciphertext_hex_len = total_len * 2;
    const total_output_len = prefix_len + salt_hex_len + 1 + nonce_hex_len + 1 + ciphertext_hex_len; // +2 for colons

    // Allocate memory for the result
    const output = allocator.alloc(u8, total_output_len + 1) catch return false; // +1 for null terminator

    // Add "gcm:" prefix
    @memcpy(output[0..prefix_len], prefix);

    // Convert salt to hex
    const salt_hex = output[prefix_len..][0..salt_hex_len];
    bytesToHexString(&salt, salt_hex);

    // Add first colon separator
    output[prefix_len + salt_hex_len] = ':';

    // Convert nonce to hex
    const nonce_hex = output[prefix_len + salt_hex_len + 1 ..][0..nonce_hex_len];
    bytesToHexString(&nonce, nonce_hex);

    // Add second colon separator
    output[prefix_len + salt_hex_len + 1 + nonce_hex_len] = ':';

    // Convert ciphertext+tag to hex
    const ciphertext_hex = output[prefix_len + salt_hex_len + 1 + nonce_hex_len + 1 ..][0..ciphertext_hex_len];
    bytesToHexString(ciphertext, ciphertext_hex);

    // Null-terminate the string
    output[total_output_len] = 0;

    // Store result information in global variables
    result_ptr = @intFromPtr(output.ptr);
    result_len = total_output_len;

    return true;
}

fn deriveKey(allocator: std.mem.Allocator, passphrase: []const u8, salt: []const u8, key: *[32]u8) !void {
    try crypto.pwhash.argon2.kdf(
        allocator,
        key,
        passphrase,
        salt,
        .{
            .t = 1, // Time cost (iterations)
            .m = 32 * 1024, // Memory cost (32 MB)
            .p = 2, // Parallelism factor
        },
        .argon2id,
    );
}

fn bytesToHexString(bytes: []const u8, out: []u8) void {
    const hex_chars = "0123456789abcdef";
    var i: usize = 0;
    while (i < bytes.len) : (i += 1) {
        const byte = bytes[i];
        out[i * 2] = hex_chars[byte >> 4];
        out[i * 2 + 1] = hex_chars[byte & 0x0F];
    }
}

fn hexStringToBytes(hex_str: []const u8, out: []u8) !void {
    if (hex_str.len % 2 != 0 or out.len * 2 != hex_str.len) {
        return error.InvalidInput;
    }

    var i: usize = 0;
    while (i < out.len) : (i += 1) {
        const high = try std.fmt.charToDigit(hex_str[i * 2], 16);
        const low = try std.fmt.charToDigit(hex_str[i * 2 + 1], 16);
        out[i] = @intCast((high << 4) | low);
    }
}

fn decryptGCM(allocator: std.mem.Allocator, passphrase: []u8, encrypted: []const u8) bool {
    var parts = std.mem.splitScalar(u8, encrypted, ':');

    const prefix = parts.next() orelse return false;
    if (!std.mem.eql(u8, prefix, "gcm")) return false;

    const salt_hex = parts.next() orelse return false;
    const nonce_hex = parts.next() orelse return false;
    const ciphertext_tag_hex = parts.next() orelse return false;

    if (parts.next() != null) return false;

    var salt: [16]u8 = undefined;
    if (salt_hex.len != salt.len * 2) return false;
    hexStringToBytes(salt_hex, &salt) catch return false;

    var nonce: [12]u8 = undefined;
    if (nonce_hex.len != nonce.len * 2) return false;
    hexStringToBytes(nonce_hex, &nonce) catch return false;

    const ciphertext_tag_len = ciphertext_tag_hex.len / 2;
    if (ciphertext_tag_len <= 16) return false;

    var ciphertext_tag = allocator.alloc(u8, ciphertext_tag_len) catch return false;
    defer allocator.free(ciphertext_tag);

    hexStringToBytes(ciphertext_tag_hex, ciphertext_tag) catch return false;

    const tag_len = 16;
    const ciphertext_len = ciphertext_tag_len - tag_len;
    const ciphertext = ciphertext_tag[0..ciphertext_len];
    const tag = ciphertext_tag[ciphertext_len..];

    var key: [32]u8 = undefined;
    deriveKey(allocator, passphrase, &salt, &key) catch return false;

    // Create AES encryption context - use encryption for CTR mode
    const aes = crypto.core.aes.Aes256.initEnc(key);

    var plaintext = allocator.alloc(u8, ciphertext_len) catch return false;

    // Initialize counter for CTR mode - exactly as in encryption
    var counter = [_]u8{0} ** 16;
    @memcpy(counter[0..12], &nonce);

    // Decrypt using AES-CTR mode - mirror the encryption logic exactly
    var i: usize = 0;
    const block_size = 16;

    // Process multiple blocks at once using encryptWide when possible
    const wide_count = 4; // Process 4 blocks at a time
    const wide_size = wide_count * block_size;

    while (i + wide_size <= ciphertext_len) : (i += wide_size) {
        // Generate keystream for multiple blocks
        var keystream: [wide_size]u8 = undefined;

        // Use encryptWide for parallel keystream generation
        if (wide_count == 4) {
            // Prepare counters for 4 blocks
            var counters: [4][16]u8 = undefined;

            // Initialize counters
            for (0..4) |j| {
                @memcpy(&counters[j], &counter);

                // Increment counter for next block
                var k: usize = 15;
                while (true) : (k -= 1) {
                    counter[k] +%= 1;
                    if (counter[k] != 0 or k == 0) break;
                }
            }

            // Use encryptWide to generate keystream for 4 blocks at once
            var keystream_blocks: [4][16]u8 = undefined;
            for (0..4) |j| {
                aes.encrypt(&keystream_blocks[j], &counters[j]);
            }

            // Flatten keystream blocks
            for (0..4) |j| {
                @memcpy(keystream[j * 16 ..][0..16], &keystream_blocks[j]);
            }
        } else {
            // Fallback for other wide_count values
            var j: usize = 0;
            while (j < wide_size) : (j += block_size) {
                aes.encrypt(keystream[j..][0..block_size], &counter);

                // Increment counter
                var k: usize = 15;
                while (true) : (k -= 1) {
                    counter[k] +%= 1;
                    if (counter[k] != 0 or k == 0) break;
                }
            }
        }

        // XOR ciphertext with keystream to get plaintext
        for (0..wide_size) |j| {
            plaintext[i + j] = ciphertext[i + j] ^ keystream[j];
        }
    }

    // Process remaining blocks one at a time
    while (i < ciphertext_len) : (i += block_size) {
        var keystream: [block_size]u8 = undefined;
        aes.encrypt(&keystream, &counter);

        // Increment counter
        var j: usize = 15;
        while (true) : (j -= 1) {
            counter[j] +%= 1;
            if (counter[j] != 0 or j == 0) break;
        }

        // XOR ciphertext with keystream
        const remaining = ciphertext_len - i;
        const block_len = @min(block_size, remaining);
        var k: usize = 0;
        while (k < block_len) : (k += 1) {
            plaintext[i + k] = ciphertext[i + k] ^ keystream[k];
        }
    }

    // Verify authentication tag (simplified GMAC)
    var calculated_tag: [16]u8 = undefined;
    var auth_data = [_]u8{0} ** 16;
    aes.encrypt(&calculated_tag, &auth_data);

    // XOR tag with first block of ciphertext (simplified)
    for (0..16) |j| {
        if (j < ciphertext_len) {
            calculated_tag[j] ^= ciphertext[j];
        }
    }

    // Check if tags match
    if (!std.mem.eql(u8, calculated_tag[0..], tag)) {
        allocator.free(plaintext);
        return false;
    }

    // Store result information in global variables
    result_ptr = @intFromPtr(plaintext.ptr);
    result_len = ciphertext_len;

    return true;
}

fn decryptCBC(allocator: std.mem.Allocator, passphrase: []u8, encrypted: []const u8) bool {
    var parts = std.mem.splitScalar(u8, encrypted, ':');

    const salt_hex = parts.next() orelse return false;
    const iv_hex = parts.next() orelse return false;
    const ciphertext_tag_hex = parts.next() orelse return false;

    if (parts.next() != null) return false;

    var salt: [16]u8 = undefined;
    if (salt_hex.len != salt.len * 2) return false;
    hexStringToBytes(salt_hex, &salt) catch return false;

    var iv: [16]u8 = undefined; // CBC uses a 16-byte IV (full block size)
    if (iv_hex.len != iv.len * 2) return false;
    hexStringToBytes(iv_hex, &iv) catch return false;

    const ciphertext_tag_len = ciphertext_tag_hex.len / 2;
    if (ciphertext_tag_len <= 16) return false; // Must have at least tag length

    var ciphertext_tag = allocator.alloc(u8, ciphertext_tag_len) catch return false;
    defer allocator.free(ciphertext_tag);

    hexStringToBytes(ciphertext_tag_hex, ciphertext_tag) catch return false;

    const tag_len = 16;
    const ciphertext_len = ciphertext_tag_len - tag_len;

    // CBC mode requires ciphertext length to be a multiple of block size
    if (ciphertext_len % 16 != 0) return false;

    const ciphertext = ciphertext_tag[0..ciphertext_len];
    const tag = ciphertext_tag[ciphertext_len..];

    var key: [32]u8 = undefined;
    deriveKey(allocator, passphrase, &salt, &key) catch return false;

    // Create AES decryption context - CBC uses actual decryption
    const aes = crypto.core.aes.Aes256.initDec(key);

    // Allocate buffer for plaintext
    var plaintext = allocator.alloc(u8, ciphertext_len) catch return false;

    // Decrypt using AES-CBC mode
    var i: usize = 0;
    const block_size = 16;
    var prev_block = iv; // Initialize with IV

    // Process blocks using decryptWide where possible
    const wide_count = 4; // Process 4 blocks at a time
    const wide_size = wide_count * block_size;

    while (i + wide_size <= ciphertext_len) {
        // Use decryptWide for parallel decryption of blocks
        var decrypted_blocks: [wide_size]u8 = undefined;
        aes.decryptWide(wide_count, &decrypted_blocks, ciphertext[i..][0..wide_size]);

        // XOR with previous ciphertext blocks to complete CBC decryption
        for (0..wide_count) |j| {
            const block_start = j * block_size;

            // First block XORs with IV or previous ciphertext block
            if (j == 0) {
                for (0..block_size) |k| {
                    decrypted_blocks[block_start + k] ^= prev_block[k];
                }
            } else {
                // Other blocks XOR with previous ciphertext block
                for (0..block_size) |k| {
                    decrypted_blocks[block_start + k] ^= ciphertext[i + block_start - block_size + k];
                }
            }
        }

        // Copy decrypted blocks to plaintext
        @memcpy(plaintext[i..][0..wide_size], decrypted_blocks[0..]);

        // Save last ciphertext block for next iteration
        @memcpy(&prev_block, ciphertext[i + wide_size - block_size ..][0..block_size]);

        i += wide_size;
    }

    // Process remaining blocks one at a time
    while (i < ciphertext_len) : (i += block_size) {
        var decrypted_block: [block_size]u8 = undefined;
        aes.decrypt(&decrypted_block, ciphertext[i..][0..block_size]);

        // XOR with previous ciphertext block to complete CBC decryption
        for (0..block_size) |j| {
            decrypted_block[j] ^= prev_block[j];
        }

        // Copy decrypted block to plaintext
        @memcpy(plaintext[i..][0..block_size], &decrypted_block);

        // Save current ciphertext block for next iteration
        @memcpy(&prev_block, ciphertext[i..][0..block_size]);
    }

    // Verify authentication tag (simplified HMAC)
    const aes_enc = crypto.core.aes.Aes256.initEnc(key);
    var calculated_tag: [16]u8 = undefined;
    var auth_data = [_]u8{0} ** 16;
    aes_enc.encrypt(&calculated_tag, &auth_data);

    // XOR tag with first block of ciphertext (simplified)
    for (0..16) |j| {
        if (j < ciphertext_len) {
            calculated_tag[j] ^= ciphertext[j];
        }
    }

    // Check if tags match
    if (!std.mem.eql(u8, calculated_tag[0..], tag)) {
        allocator.free(plaintext);
        return false;
    }

    // Handle PKCS#7 padding
    const padding_value = plaintext[plaintext.len - 1];
    if (padding_value > block_size) {
        allocator.free(plaintext);
        return false;
    }

    // Verify padding is correct
    var valid_padding = true;
    for (plaintext.len - padding_value..plaintext.len) |j| {
        if (plaintext[j] != padding_value) {
            valid_padding = false;
            break;
        }
    }

    if (!valid_padding) {
        allocator.free(plaintext);
        return false;
    }

    // Remove padding
    const plaintext_len = plaintext.len - padding_value;

    // Store result information in global variables
    result_ptr = @intFromPtr(plaintext.ptr);
    result_len = plaintext_len;

    return true;
}

fn decryptRawCBC(allocator: std.mem.Allocator, passphrase: []u8, iv_hex: []const u8, ciphertext_hex: []const u8) bool {
    // Convert IV from hex
    var iv: [16]u8 = undefined;
    if (iv_hex.len != iv.len * 2) return false;
    hexStringToBytes(iv_hex, &iv) catch return false;

    // Convert ciphertext from hex
    const ciphertext_len = ciphertext_hex.len / 2;
    if (ciphertext_len == 0 or ciphertext_len % 16 != 0) return false; // Must be multiple of block size

    var ciphertext = allocator.alloc(u8, ciphertext_len) catch return false;
    defer allocator.free(ciphertext);

    hexStringToBytes(ciphertext_hex, ciphertext) catch return false;

    // Use the same salt as in JavaScript
    const js_salt = "a-unique-salt";

    // Derive key from passphrase using PBKDF2 with 100000 iterations
    var key: [32]u8 = undefined;
    deriveKeyJS(passphrase, js_salt, &key) catch {
        return false;
    };

    // Create AES decryption context
    const aes = crypto.core.aes.Aes256.initDec(key);

    // Allocate buffer for plaintext
    var plaintext = allocator.alloc(u8, ciphertext_len) catch return false;

    // Decrypt using AES-CBC mode
    var i: usize = 0;
    const block_size = 16;
    var prev_block = iv; // Initialize with IV

    // Process blocks using decryptWide where possible
    const wide_count = 4; // Process 4 blocks at a time
    const wide_size = wide_count * block_size;

    while (i + wide_size <= ciphertext_len) {
        // Use decryptWide for parallel decryption of blocks
        var decrypted_blocks: [wide_size]u8 = undefined;
        aes.decryptWide(wide_count, &decrypted_blocks, ciphertext[i..][0..wide_size]);

        // XOR with previous ciphertext blocks to complete CBC decryption
        for (0..wide_count) |j| {
            const block_start = j * block_size;

            // First block XORs with IV or previous ciphertext block
            if (j == 0) {
                for (0..block_size) |k| {
                    decrypted_blocks[block_start + k] ^= prev_block[k];
                }
            } else {
                // Other blocks XOR with previous ciphertext block
                for (0..block_size) |k| {
                    decrypted_blocks[block_start + k] ^= ciphertext[i + block_start - block_size + k];
                }
            }
        }

        // Copy decrypted blocks to plaintext
        @memcpy(plaintext[i..][0..wide_size], decrypted_blocks[0..]);

        // Save last ciphertext block for next iteration
        @memcpy(&prev_block, ciphertext[i + wide_size - block_size ..][0..block_size]);

        i += wide_size;
    }

    // Process remaining blocks one at a time
    while (i < ciphertext_len) : (i += block_size) {
        var decrypted_block: [block_size]u8 = undefined;
        aes.decrypt(&decrypted_block, ciphertext[i..][0..block_size]);

        // XOR with previous ciphertext block to complete CBC decryption
        for (0..block_size) |j| {
            decrypted_block[j] ^= prev_block[j];
        }

        // Copy decrypted block to plaintext
        @memcpy(plaintext[i..][0..block_size], &decrypted_block);

        // Save current ciphertext block for next iteration
        @memcpy(&prev_block, ciphertext[i..][0..block_size]);
    }

    // Handle PKCS#7 padding
    const padding_value = plaintext[plaintext.len - 1];
    if (padding_value > block_size) {
        allocator.free(plaintext);
        return false;
    }

    // Verify padding is correct
    var valid_padding = true;
    for (plaintext.len - padding_value..plaintext.len) |j| {
        if (plaintext[j] != padding_value) {
            valid_padding = false;
            break;
        }
    }

    if (!valid_padding) {
        allocator.free(plaintext);
        return false;
    }

    // Remove padding
    const plaintext_len = plaintext.len - padding_value;

    // Store result information in global variables
    result_ptr = @intFromPtr(plaintext.ptr);
    result_len = plaintext_len;

    return true;
}

// Function to match JavaScript's key derivation
fn deriveKeyJS(passphrase: []const u8, salt_str: []const u8, key: *[32]u8) !void {
    // Convert string salt to bytes
    const salt = salt_str;

    // Use PBKDF2 with 100000 iterations as in JavaScript
    try crypto.pwhash.pbkdf2(key, passphrase, salt, 100000, crypto.auth.hmac.sha2.HmacSha256);
}

pub fn decryptMessage(allocator: std.mem.Allocator, buffer_ptr: [*]u8, passphrase_len: usize, encrypted_len: usize) bool {
    result_ptr = 0;
    result_len = 0;

    const passphrase = buffer_ptr[0..passphrase_len];
    const encrypted = buffer_ptr[passphrase_len .. passphrase_len + encrypted_len];
    const encrypted_str = encrypted[0..encrypted_len];

    // Check for standard formats first
    if (encrypted_len >= 4 and std.mem.eql(u8, encrypted_str[0..4], "gcm:")) {
        return decryptGCM(allocator, passphrase, encrypted_str);
    } else if (encrypted_len >= 4 and std.mem.eql(u8, encrypted_str[0..4], "cbc:")) {
        return decryptCBC(allocator, passphrase, encrypted_str);
    }

    // Check if it's in the JavaScript format (IV:ciphertext)
    // This is for backwards compatibility with the JavaScript implementation
    var parts = std.mem.splitScalar(u8, encrypted_str, ':');
    const first_part = parts.next() orelse return false;
    const second_part = parts.next() orelse return false;

    // If there are exactly two parts and the first part is 32 chars (16 bytes hex-encoded), it's likely the JS format
    if (parts.next() == null and first_part.len == 32) {
        return decryptRawCBC(allocator, passphrase, first_part, second_part);
    }

    return false;
}
