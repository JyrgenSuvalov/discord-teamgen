/**
 * Discord signature verification utilities using Web Crypto API
 * Implements Ed25519 signature verification for Discord webhook security
 */

/**
 * Verifies Discord request signature using Ed25519 public key
 * @param signature - The signature from Discord (hex string)
 * @param timestamp - The timestamp from Discord headers
 * @param body - The raw request body
 * @param publicKey - Discord application public key (hex string)
 * @returns Promise<boolean> - True if signature is valid
 */
export async function verifyDiscordSignature(
	signature: string,
	timestamp: string,
	body: string,
	publicKey: string,
): Promise<boolean> {
	try {
		// Convert hex signature to Uint8Array
		const sig = hexToUint8Array(signature);

		// Convert hex public key to Uint8Array
		const pubKeyBytes = hexToUint8Array(publicKey);

		// Create the message that was signed (timestamp + body)
		const message = new TextEncoder().encode(timestamp + body);

		// Import the public key for verification
		const cryptoKey = await crypto.subtle.importKey(
			"raw",
			pubKeyBytes,
			{
				name: "Ed25519",
				namedCurve: "Ed25519",
			},
			false,
			["verify"],
		);

		// Verify the signature
		const isValid = await crypto.subtle.verify(
			"Ed25519",
			cryptoKey,
			sig,
			message,
		);

		return isValid;
	} catch (error) {
		console.error("Discord signature verification failed:", error);
		return false;
	}
}

/**
 * Converts hex string to Uint8Array
 * @param hex - Hex string to convert
 * @returns Uint8Array representation
 */
function hexToUint8Array(hex: string): Uint8Array {
	// Remove '0x' prefix if present
	const cleanHex = hex.startsWith("0x") ? hex.slice(2) : hex;

	// Ensure even length
	const paddedHex = cleanHex.length % 2 === 0 ? cleanHex : `0${cleanHex}`;

	const bytes = new Uint8Array(paddedHex.length / 2);
	for (let i = 0; i < paddedHex.length; i += 2) {
		bytes[i / 2] = parseInt(paddedHex.substr(i, 2), 16);
	}

	return bytes;
}

/**
 * Error class for Discord signature verification failures
 */
export class DiscordSignatureError extends Error {
	constructor(message: string) {
		super(message);
		this.name = "DiscordSignatureError";
	}
}
