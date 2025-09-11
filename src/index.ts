import { type Context, Hono } from "hono";
import { cors } from "hono/cors";
import { logger } from "hono/logger";
import { prettyJSON } from "hono/pretty-json";
import { ZodError } from "zod";
import { DatabaseError, type Env, ValidationError } from "./db/types";
import { handleTournamentCommand } from "./handlers/tournament";
import {
	discordSignatureMiddleware,
	getDiscordBody,
} from "./utils/discord-middleware";
import {
	createDiscordHttpResponse,
	createErrorResponse,
	createPongResponse,
} from "./utils/discord-responses";
import { DISCORD_INTERACTION_TYPES } from "./validation/discord";

// Create Hono app with proper typing for Cloudflare Worker environment
const app = new Hono<{
	Bindings: Env;
	Variables: {
		requestId: string;
		// biome-ignore lint/suspicious/noExplicitAny: Discord interaction body has complex nested structure
		discordBody?: any;
	};
}>();

// Rate limiting for private server (more lenient than public)
const rateLimitMap = new Map<string, { count: number; resetTime: number }>();

const privateServerRateLimit = async (
	c: Context<{
		Bindings: Env;
		// biome-ignore lint/suspicious/noExplicitAny: Discord interaction body has complex nested structure
		Variables: { requestId: string; discordBody?: any };
	}>,
	next: () => Promise<void>,
) => {
	const userId =
		c.get("discordBody")?.user?.id || c.get("discordBody")?.member?.user?.id;
	const now = Date.now();
	const windowMs = 30000; // 30 seconds
	const maxRequests = 20; // 20 requests per 30 seconds (generous for private use)

	if (userId) {
		const key = `user:${userId}`;
		const current = rateLimitMap.get(key);

		if (!current || now > current.resetTime) {
			rateLimitMap.set(key, { count: 1, resetTime: now + windowMs });
		} else if (current.count >= maxRequests) {
			console.warn("Rate limit exceeded for user:", {
				userId,
				count: current.count,
			});
			const errorResponse = createErrorResponse(
				"You are sending commands too quickly. Please wait a moment.",
				{ title: "Rate Limited" },
			);
			return createDiscordHttpResponse(errorResponse, 429);
		} else {
			current.count++;
		}
	}

	return next();
};

// Global middleware setup
app.use("*", prettyJSON());
app.use("*", logger());

// Security headers middleware
app.use("*", async (c, next) => {
	await next();

	// Security headers for private server
	c.res.headers.set("X-Content-Type-Options", "nosniff");
	c.res.headers.set("X-Frame-Options", "DENY");
	c.res.headers.set("X-XSS-Protection", "1; mode=block");
	c.res.headers.set("Referrer-Policy", "strict-origin-when-cross-origin");
	c.res.headers.set(
		"Content-Security-Policy",
		"default-src 'self'; script-src 'none'; object-src 'none';",
	);

	// Remove server information
	c.res.headers.delete("Server");
});

// Request logging middleware with enhanced security logging
app.use("*", async (c, next) => {
	const start = Date.now();
	const requestId = crypto.randomUUID();
	const clientIP =
		c.req.header("CF-Connecting-IP") ||
		c.req.header("X-Forwarded-For") ||
		"unknown";
	const userAgent = c.req.header("User-Agent") || "unknown";

	// Add request ID to context for tracing
	c.set("requestId", requestId);

	console.log("Incoming request:", {
		requestId,
		method: c.req.method,
		path: c.req.path,
		clientIP,
		userAgent: userAgent.substring(0, 100), // Truncate long user agents
		timestamp: new Date().toISOString(),
	});

	await next();

	const duration = Date.now() - start;
	console.log("Request completed:", {
		requestId,
		method: c.req.method,
		path: c.req.path,
		status: c.res.status,
		duration: `${duration}ms`,
		timestamp: new Date().toISOString(),
	});
});

// CORS middleware for Discord webhook requests
app.use(
	"/discord/*",
	cors({
		origin: ["https://discord.com", "https://discordapp.com"],
		allowMethods: ["POST"],
		allowHeaders: [
			"Content-Type",
			"X-Signature-Ed25519",
			"X-Signature-Timestamp",
		],
	}),
);

// Discord signature verification middleware for webhook endpoint
app.use("/discord/webhook", async (c, next) => {
	const publicKey = c.env.DISCORD_PUBLIC_KEY;

	if (!publicKey) {
		console.error("DISCORD_PUBLIC_KEY environment variable not set");
		return c.json({ error: "Server configuration error" }, 500);
	}

	// Apply Discord signature verification
	const middleware = discordSignatureMiddleware(publicKey);
	return middleware(c, next);
});

// Enhanced request validation middleware
const validateDiscordRequest = async (
	c: Context<{
		Bindings: Env;
		// biome-ignore lint/suspicious/noExplicitAny: Discord interaction body has complex nested structure
		Variables: { requestId: string; discordBody?: any };
	}>,
	next: () => Promise<void>,
) => {
	// Content length validation
	const contentLength = c.req.header("content-length");
	if (contentLength && parseInt(contentLength, 10) > 1024 * 5) {
		// 5KB limit for Discord interactions
		console.warn("Request too large:", { contentLength, path: c.req.path });
		const errorResponse = createErrorResponse("Request payload too large", {
			title: "Request Too Large",
		});
		return createDiscordHttpResponse(errorResponse, 413);
	}

	// Validate required Discord headers
	const signature = c.req.header("X-Signature-Ed25519");
	const timestamp = c.req.header("X-Signature-Timestamp");

	if (!signature || !timestamp) {
		console.warn("Missing Discord signature headers:", {
			hasSignature: !!signature,
			hasTimestamp: !!timestamp,
			path: c.req.path,
		});
		const errorResponse = createErrorResponse("Missing required headers", {
			title: "Invalid Request",
		});
		return createDiscordHttpResponse(errorResponse, 400);
	}

	// Validate timestamp (prevent replay attacks)
	const now = Math.floor(Date.now() / 1000);
	const requestTime = parseInt(timestamp, 10);
	const timeDiff = Math.abs(now - requestTime);

	if (timeDiff > 300) {
		// 5 minutes tolerance
		console.warn("Request timestamp too old:", {
			requestTime,
			currentTime: now,
			difference: timeDiff,
		});
		const errorResponse = createErrorResponse("Request timestamp invalid", {
			title: "Invalid Request",
		});
		return createDiscordHttpResponse(errorResponse, 400);
	}

	return next();
};

// Apply security middleware to Discord webhook
app.use("/discord/webhook", validateDiscordRequest);
app.use("/discord/webhook", privateServerRateLimit);

// Main Discord webhook endpoint
app.post("/discord/webhook", async (c) => {
	const startTime = Date.now();

	try {
		// Validate environment configuration
		if (!c.env.DB) {
			console.error("D1 database binding (DB) not found in environment");
			const errorResponse = createErrorResponse(
				"Database configuration error",
				{ title: "Configuration Error" },
			);
			return createDiscordHttpResponse(errorResponse, 500);
		}

		// Get the verified Discord interaction from middleware
		const interaction = getDiscordBody(c);

		if (!interaction) {
			console.error("No Discord interaction found in request");
			const errorResponse = createErrorResponse("Invalid request format", {
				title: "Invalid Request",
			});
			return createDiscordHttpResponse(errorResponse, 400);
		}

		console.log("Processing Discord interaction:", {
			type: interaction.type,
			id: interaction.id,
			command: interaction.data?.name,
			user: interaction.user?.username || interaction.member?.user?.username,
			timestamp: new Date().toISOString(),
		});

		// Route based on interaction type
		switch (interaction.type) {
			case DISCORD_INTERACTION_TYPES.PING: {
				// Handle Discord verification ping
				console.log("Handling Discord ping verification");
				const pongResponse = createPongResponse();
				return createDiscordHttpResponse(pongResponse, 200);
			}

			case DISCORD_INTERACTION_TYPES.APPLICATION_COMMAND:
				// Handle slash commands
				if (interaction.data?.name === "t") {
					console.log("Handling tournament command");
					return handleTournamentCommand(c);
				} else {
					// Unknown command
					console.warn(`Unknown command received: ${interaction.data?.name}`);
					const errorResponse = createErrorResponse(
						`Unknown command: ${interaction.data?.name || "undefined"}`,
						{ title: "Unknown Command" },
					);
					return createDiscordHttpResponse(errorResponse, 400);
				}

			default: {
				// Unknown interaction type
				console.warn(`Unhandled interaction type: ${interaction.type}`);
				const errorResponse = createErrorResponse(
					"This interaction type is not supported",
					{ title: "Unsupported Interaction" },
				);
				return createDiscordHttpResponse(errorResponse, 400);
			}
		}
	} catch (error) {
		const processingTime = Date.now() - startTime;
		console.error("Error processing Discord interaction:", {
			error: error instanceof Error ? error.message : String(error),
			stack: error instanceof Error ? error.stack : undefined,
			processingTime,
			timestamp: new Date().toISOString(),
		});

		// Return generic error response
		const errorResponse = createErrorResponse(
			"An internal error occurred while processing your request",
			{ title: "Internal Error" },
		);
		return createDiscordHttpResponse(errorResponse, 500);
	}
});

// Health check endpoint (minimal info in production)
app.get("/health", async (c) => {
	// In production, return minimal health info to avoid information disclosure
	if (c.env.ENVIRONMENT === "production") {
		return c.json({
			status: "ok",
			timestamp: new Date().toISOString(),
		});
	}

	// Development/testing environment - show detailed health info
	const health = {
		status: "healthy",
		timestamp: new Date().toISOString(),
		service: "discord-ping-bot",
		version: "1.0.0",
		checks: {
			database: "unknown",
			environment: "unknown",
			tournament_config: "unknown",
		},
	};

	try {
		// Check environment variables
		health.checks.environment = c.env.DISCORD_PUBLIC_KEY
			? "ok"
			: "missing_discord_key";

		// Check tournament configuration
		health.checks.tournament_config = c.env.TOURNAMENT_ADMIN_ROLES
			? "ok"
			: "missing_admin_roles";

		// Check database connection
		if (c.env.DB) {
			try {
				// Simple database connectivity test
				const result = await c.env.DB.prepare("SELECT 1 as test").first();
				health.checks.database = result?.test === 1 ? "ok" : "error";
			} catch (dbError) {
				console.error("Database health check failed:", dbError);
				health.checks.database = "error";
				health.status = "degraded";
			}
		} else {
			health.checks.database = "missing_binding";
			health.status = "degraded";
		}

		// Overall status
		if (
			health.checks.database === "error" ||
			health.checks.database === "missing_binding"
		) {
			health.status = "unhealthy";
		} else if (health.checks.environment !== "ok") {
			health.status = "degraded";
		}

		const statusCode =
			health.status === "healthy"
				? 200
				: health.status === "degraded"
					? 200
					: 503;

		return c.json(health, statusCode);
	} catch (error) {
		console.error("Health check error:", error);
		return c.json(
			{
				...health,
				status: "unhealthy",
				error: error instanceof Error ? error.message : "Unknown error",
			},
			503,
		);
	}
});

// Root endpoint (minimal info in production)
app.get("/", (c) => {
	if (c.env.ENVIRONMENT === "production") {
		// Minimal response in production to avoid information disclosure
		return c.json({
			status: "ok",
			timestamp: new Date().toISOString(),
		});
	}

	return c.json({
		name: "CS2 Tournament Bot",
		version: "1.0.0",
		description:
			"A Discord bot for managing CS2 tournaments with team generation and match tracking",
		endpoints: {
			webhook: "/discord/webhook",
			health: "/health",
		},
		features: [
			"Tournament management (/t open, /t close)",
			"Player ADR submission and tracking",
			"Balanced team generation algorithms",
			"Match result recording and history",
			"Admin permission controls",
			"Historical team composition tracking",
		],
		timestamp: new Date().toISOString(),
	});
});

// Global error handler middleware
app.onError((err, c) => {
	console.error("Application error:", {
		message: err.message,
		stack: err.stack,
		path: c.req.path,
		method: c.req.method,
		timestamp: new Date().toISOString(),
	});

	// Check if this is a Discord interaction request
	const isDiscordRequest = c.req.path.startsWith("/discord/");

	if (isDiscordRequest) {
		// Handle specific error types for Discord requests
		if (err instanceof ZodError) {
			const firstError = err.issues[0];
			const errorResponse = createErrorResponse(
				`Validation failed: ${firstError.message}`,
				{ title: "Invalid Request" },
			);
			return createDiscordHttpResponse(errorResponse, 400);
		}

		if (err instanceof ValidationError) {
			const errorResponse = createErrorResponse(err.message, {
				title: "Validation Error",
			});
			return createDiscordHttpResponse(errorResponse, 400);
		}

		if (err instanceof DatabaseError) {
			const errorResponse = createErrorResponse(
				"Database operation failed. Please try again later.",
				{ title: "Database Error" },
			);
			return createDiscordHttpResponse(errorResponse, 500);
		}

		// Return Discord-formatted error response for other errors
		const errorResponse = createErrorResponse("An unexpected error occurred", {
			title: "Server Error",
		});
		return createDiscordHttpResponse(errorResponse, 500);
	}

	// Return standard JSON error for other endpoints
	return c.json(
		{
			error: "Internal server error",
			message: err.message,
			timestamp: new Date().toISOString(),
		},
		500,
	);
});

// 404 handler
app.notFound((c) => {
	const isDiscordRequest = c.req.path.startsWith("/discord/");

	if (isDiscordRequest) {
		// Return Discord-formatted error for Discord requests
		const errorResponse = createErrorResponse("Endpoint not found", {
			title: "Not Found",
		});
		return createDiscordHttpResponse(errorResponse, 404);
	}

	// Return standard 404 for other requests
	return c.json(
		{
			error: "Not found",
			path: c.req.path,
			method: c.req.method,
			timestamp: new Date().toISOString(),
		},
		404,
	);
});

export default app;
