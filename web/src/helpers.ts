import { Err, None, Ok, Option, Result, Some } from "bakutils-catcher";
import { match } from "ts-pattern";

// Utility function to convert strings to ArrayBuffers
// function str2ab(str: string) {
// 	const buf = new ArrayBuffer(str.length);
// 	const bufView = new Uint8Array(buf);
// 	for (let i = 0, strLen = str.length; i < strLen; i++) {
// 		bufView[i] = str.charCodeAt(i);
// 	}
// 	return buf;
// }

// Utility function to convert ArrayBuffers to strings
function ab2str(buf: ArrayBuffer) {
	return new Uint8Array(buf).reduce(
		(str, byte) => str + String.fromCharCode(byte),
		"",
	);
}

// Function to generate an AES-CBC key based on a passphrase
async function generateKey(passphrase: string | undefined) {
	const enc = new TextEncoder();
	const keyMaterial = await window.crypto.subtle.importKey(
		"raw",
		enc.encode(passphrase),
		{ name: "PBKDF2" },
		false,
		["deriveKey"],
	);
	return window.crypto.subtle.deriveKey(
		{
			name: "PBKDF2",
			salt: enc.encode("a-unique-salt"),
			iterations: 100000,
			hash: "SHA-256",
		},
		keyMaterial,
		{ name: "AES-CBC", length: 256 },
		false,
		["encrypt", "decrypt"],
	);
}

// Function to encrypt a message
async function encryptMessage(passphrase: string, message: string | undefined) {
	const key = await generateKey(passphrase);
	const iv = window.crypto.getRandomValues(new Uint8Array(16)); // Initialization vector
	const enc = new TextEncoder();
	const encryptedContent = await window.crypto.subtle.encrypt(
		{ name: "AES-CBC", iv },
		key,
		enc.encode(message),
	);

	const hexString = arrayBufferToHexString(encryptedContent);

	const ivHex = arrayBufferToHexString(iv);

	return `${ivHex}:${hexString}`;
}

function hexStringToArrayBuffer(hexString: string): ArrayBuffer {
	// Ensure the hex string has an even length
	if (hexString.length % 2 !== 0) {
		throw new Error("Hex string must have an even length");
	}

	const length = hexString.length / 2;
	const arrayBuffer = new ArrayBuffer(length);
	const view = new Uint8Array(arrayBuffer);

	for (let i = 0; i < length; i++) {
		const byte = hexString.substring(i * 2, i * 2 + 2);
		view[i] = parseInt(byte, 16);
	}

	return arrayBuffer;
}

// Function to decrypt a message
async function decryptMessage(
	passphrase: string,
	content: string,
): Promise<Result<string, string>> {
	const ivHex = content.split(":")[0];
	const hexString = content.split(":")[1];

	// Convert the string from a hex string to an ArrayBuffer
	const iv = hexStringToArrayBuffer(ivHex);
	const encryptedContent = hexStringToArrayBuffer(hexString);

	const key = await generateKey(passphrase);

	try {
		const decryptedContent = await window.crypto.subtle.decrypt(
			{ name: "AES-CBC", iv },
			key,
			encryptedContent,
		);
		return Ok(ab2str(decryptedContent));
	} catch (error) {
		console.error(error);
		return Err("Unable to decrypt data");
	}
}

function arrayBufferToHexString(arrayBuffer: ArrayBuffer): string {
	const byteArray = new Uint8Array(arrayBuffer);
	return byteArray.reduce(
		(str, byte) => str + byte.toString(16).padStart(2, "0"),
		"",
	);
}

function search_like<T>(
	hashmap: Map<string, T>,
	pattern: string,
): Option<[string, T]> {
	// Check for a direct match.
	const value = hashmap.get(pattern);
	if (value !== undefined) {
		return Some([pattern, value]);
	}

	const regex_pattern = `^${pattern.replace("_", ".")}.*`;

	// Iterate over the map.
	let regex_match_value: Option<[string, T]> = None;
	hashmap.forEach((v, k, _map) => {
		if (k.match(regex_pattern) !== null) {
			regex_match_value = Some([k, v]);
		}
	});

	if (regex_match_value.isSome()) {
		return regex_match_value;
	}

	const old_pattern = pattern;
	const pat = pattern.split("-")[0];
	if (old_pattern === pat) {
		return None;
	}

	const res = search_like(hashmap, pat);
	if (res.isSome()) {
		const tuple = res.unwrap();
		return Some([old_pattern, tuple[1]]);
	}

	return None;
}

interface DynamicObject {
	// biome-ignore lint: this is a fine use of any.
	[key: string]: any;
}
function get_item_image(
	hashmap: Map<string, DynamicObject>,
	item: string,
): string {
	const early_return =
		'background: transparent url("assets/missing") no-repeat; height: 64px !important; width: 64px!important; background-position: 5px 10px';

	const value = hashmap.get(item);
	if (value === undefined) {
		return early_return;
	}

	const sprite_num: number = value.spritenum as number;
	const top = Math.floor(sprite_num / 16) * 24 * 2;
	const left = Math.floor(sprite_num % 16) * 24 * 2;

	return `background: transparent url("assets/sprites") -${left}px -${top}px no-repeat;`;
}

const base_url = "https://pokebin-imgs.s3.amazonaws.com/";
const alcremie_decorations = [
	"berry-sweet",
	"clove-sweet",
	"flower-sweet",
	"love-sweet",
	"ribbon-sweet",
	"star-sweet",
	"strawberry-sweet",
];

const same_as_base_forms = [
	"sinistcha-masterpiece",
	"poltchageist-artisan",
	"polteageist-antique",
	"sinistea-antique",
];

function get_image(
	hashmap: Map<string, DynamicObject>,
	raw_pokemon: string,
	is_shiny: boolean,
	is_female: boolean,
): string {
	// First, see if the pokemon is in the map.
	// If it is, return the filepath.
	let base_path = `${base_url}home`;
	let pokemon = raw_pokemon;

	// Special case for Sinistcha-Masterpiece, Poltchageist-Artisan, Sinistea-Antique, and Polteageist-Antique.
	if (same_as_base_forms.includes(pokemon)) {
		pokemon = pokemon.split("-")[0];
	}

	if (pokemon.includes("alcremie") && !pokemon.includes("gmax")) {
		// Alcremie is a special case. Since there are SO many variations.
		const random_decoration_idx =
			(Math.random() * alcremie_decorations.length) >> 0;
		const decoration = alcremie_decorations[random_decoration_idx];
		if (is_shiny) {
			return `${base_path}home/shiny/869-${decoration}.png`;
		}
		const flavor = match(pokemon)
			.with("alcremie", () => {
				return "vanilla-cream";
			})
			.otherwise(() => {
				const items = pokemon.split("-");
				// Join the items 1 -> end
				const joined_items = items.slice(1, items.length).join("-");
				return joined_items;
			});

		return `${base_path}home/869-${flavor}-${decoration}.png`;
	}

	let value = hashmap.get(pokemon);
	console.log(value);
	if (value !== undefined) {
		if (is_shiny && value.has_shiny) {
			base_path += "/shiny";
		}

		if (is_female && value.has_female) {
			base_path += "/female";
		}

		base_path += `/${value.id}.png`;
		return base_path;
	}

	const split = pokemon.split("-");
	const species = split[0];
	value = hashmap.get(species);
	if (value !== undefined) {
		const remaining_slice = split.slice(1, split.length).join("-");
		const id = `${value.id}-${remaining_slice}`;
		if (is_shiny && value.has_shiny) {
			base_path += "/shiny";
		}
		if (is_female && value.has_female) {
			base_path += "/female";
		}

		base_path += `/${id}.png`;
		return base_path;
	}

	const egg_path = `${base_path}/home/0.png`;

	return egg_path;
}

export {
	encryptMessage,
	decryptMessage,
	search_like,
	get_item_image,
	get_image,
};
