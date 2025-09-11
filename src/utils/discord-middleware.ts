/**
 * Hono middleware for Discord signature verification
 */

import type { Context, Next } from "hono";
import type { DiscordInteraction } from "../validation/discord";
import {
	DiscordSignatureError,
	verifyDiscordSignature,
} from "./discord-verify";

/**
 * Hono middleware to verify Discord webhook signatures
 * @param publicKey - Discord application public key (hex string)
 * @returns Hono middleware function
 */
export function discordSignatureMiddleware(publicKey: string) {
	return async (c: Context, next: Next) => {
		try {
			// Get signature and timestamp from headers
			const signature = c.req.header("x-signature-ed25519");
			const timestamp = c.req.header("x-signature-timestamp");

			// Check if required headers are present
			if (!signature || !timestamp) {
				console.error("Missing Discord signature headers");
				return c.json({ error: "Missing signature headers" }, 401);
			}

			// Get raw body for verification
			const body = await c.req.text();

			// Verify the signature
			const isValid = await verifyDiscordSignature(
				signature,
				timestamp,
				body,
				publicKey,
			);

			if (!isValid) {
				console.error("Invalid Discord signature");
				return c.json({ error: "Invalid signature" }, 401);
			}

			// Store the parsed body for use in handlers
			// Parse it back to JSON since we consumed the stream
			try {
				const parsedBody = JSON.parse(body);
				c.set("discordBody", parsedBody);
			} catch (parseError) {
				console.error("Failed to parse Discord body:", parseError);
				return c.json({ error: "Invalid JSON body" }, 400);
			}

			// Continue to next middleware/handler
			await next();
		} catch (error) {
			console.error("Discord signature middleware error:", error);

			if (error instanceof DiscordSignatureError) {
				return c.json({ error: "Signature verification failed" }, 401);
			}

			return c.json({ error: "Internal server error" }, 500);
		}
	};
}

/**
 * Helper function to get Discord body from context
 * Use this in handlers to get the parsed Discord interaction
 */
export function getDiscordBody(c: Context): DiscordInteraction {
	return c.get("discordBody");
}
