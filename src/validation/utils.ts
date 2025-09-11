import { ZodError, z } from "zod";
import type { DiscordInteraction } from "./discord";

// Custom validation error class
export class ValidationError extends Error {
	public readonly errors: z.ZodIssue[];

	constructor(zodError: ZodError) {
		// ZodError has an 'issues' property
		const errors = zodError.issues || [];
		const message = `Validation failed: ${errors.map((e) => e.message).join(", ")}`;
		super(message);
		this.name = "ValidationError";
		this.errors = errors;
	}
}

// Safe validation wrapper that returns result or throws ValidationError
export function validateData<T>(schema: z.ZodSchema<T>, data: unknown): T {
	try {
		return schema.parse(data);
	} catch (error) {
		if (error instanceof ZodError) {
			throw new ValidationError(error);
		}
		throw error;
	}
}

// Safe validation wrapper that returns success/error result
export function safeValidateData<T>(
	schema: z.ZodSchema<T>,
	data: unknown,
): { success: true; data: T } | { success: false; error: ValidationError } {
	try {
		const result = schema.parse(data);
		return { success: true, data: result };
	} catch (error) {
		if (error instanceof ZodError) {
			return { success: false, error: new ValidationError(error) };
		}
		throw error;
	}
}

// Extract command options from Discord interaction
export function extractCommandOptions(
	interaction: DiscordInteraction,
): Record<string, string | number | boolean> {
	const options: Record<string, string | number | boolean> = {};

	if (!interaction.data?.options) {
		return options;
	}

	for (const option of interaction.data.options) {
		if (option.value !== undefined) {
			options[option.name] = option.value;
		}
	}

	return options;
}

// Get specific option value from command options
export function getOptionValue<T = string>(
	options: Record<string, string | number | boolean>,
	name: string,
	defaultValue?: T,
): T | undefined {
	const value = options[name];
	if (value !== undefined) {
		return value as T;
	}
	return defaultValue;
}

// Validate Discord interaction type
export function isApplicationCommand(interaction: DiscordInteraction): boolean {
	return interaction.type === 2; // APPLICATION_COMMAND
}

export function isPingInteraction(interaction: DiscordInteraction): boolean {
	return interaction.type === 1; // PING
}

// Format validation errors for Discord response
export function formatValidationErrorForDiscord(
	error: ValidationError,
): string {
	if (!error.errors || error.errors.length === 0) {
		return "Invalid input provided";
	}

	// Get all error messages, prioritizing top-level errors but including nested ones if needed
	const allErrors = error.errors.map((e) => e.message);
	const topLevelErrors = error.errors
		.filter((e) => e.path.length <= 1)
		.map((e) => e.message);

	// Use top-level errors if available, otherwise use all errors
	const errorsToShow = topLevelErrors.length > 0 ? topLevelErrors : allErrors;
	const limitedErrors = errorsToShow.slice(0, 3); // Limit to 3 errors to avoid overwhelming the user

	if (limitedErrors.length === 0) {
		return "Invalid input provided";
	}

	if (limitedErrors.length === 1) {
		return limitedErrors[0];
	}

	return `Multiple validation errors: ${limitedErrors.join(", ")}`;
}

// Validate that required environment variables are present
export const EnvironmentSchema = z.object({
	DISCORD_PUBLIC_KEY: z.string().min(1, "DISCORD_PUBLIC_KEY is required"),
});

export type Environment = z.infer<typeof EnvironmentSchema>;
