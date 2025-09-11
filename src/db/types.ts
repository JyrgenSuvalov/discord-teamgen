import type { Database } from "./index";

// Environment interface for Cloudflare Worker
export interface Env {
	DB: D1Database;
	DISCORD_PUBLIC_KEY: string;
	ALLOWED_GUILD_ID?: string;
	ENVIRONMENT?: string;
	TOURNAMENT_ADMIN_ROLES?: string;
	TOURNAMENT_TIMEZONE?: string;
}

// Database context type for handlers
export interface DatabaseContext {
	db: Database;
}

// Error types for database operations
export class DatabaseError extends Error {
	constructor(
		message: string,
		public cause?: unknown,
	) {
		super(message);
		this.name = "DatabaseError";
	}
}

export class ValidationError extends Error {
	constructor(
		message: string,
		public field?: string,
	) {
		super(message);
		this.name = "ValidationError";
	}
}
