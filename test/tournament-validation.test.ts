import { describe, it, expect } from "vitest";
import {
	TournamentOpenSchema,
	TournamentCloseSchema,
	SubmitAdrSchema,
	ShowAdrSchema,
	GenerateTeamsSchema,
	ShowTeamsSchema,
	ResultMatchSchema,
	TournamentInteractionSchema,
	SubmitAdrInteractionSchema,
	GenerateTeamsInteractionSchema,
	ResultMatchInteractionSchema,
	extractTournamentSubcommand,
	extractSubmitAdrParams,
	extractGenerateTeamsParams,
	extractResultMatchParams,
	parseMatchString,
	validateTournamentCommandParams,
	ValidationError,
	validateData,
} from "../src/validation";
import { DISCORD_OPTION_TYPES } from "../src/validation/discord";

describe("Tournament Validation Schemas", () => {
	describe("TournamentOpenSchema", () => {
		it("should validate empty object", () => {
			const result = TournamentOpenSchema.parse({});
			expect(result).toEqual({});
		});

		it("should ignore extra properties", () => {
			const result = TournamentOpenSchema.parse({ extra: "value" });
			expect(result).toEqual({});
		});
	});

	describe("TournamentCloseSchema", () => {
		it("should validate empty object", () => {
			const result = TournamentCloseSchema.parse({});
			expect(result).toEqual({});
		});
	});

	describe("SubmitAdrSchema", () => {
		it("should validate valid ADR", () => {
			const result = SubmitAdrSchema.parse({ adr: 85.5 });
			expect(result).toEqual({ adr: 85.5 });
		});

		it("should validate ADR with player and action", () => {
			const result = SubmitAdrSchema.parse({
				adr: 90.25,
				player: "123456789",
				action: "lock",
			});
			expect(result).toEqual({
				adr: 90.25,
				player: "123456789",
				action: "lock",
			});
		});

		it("should reject negative ADR", () => {
			expect(() => SubmitAdrSchema.parse({ adr: -5 })).toThrow(
				"ADR must be non-negative",
			);
		});

		it("should reject ADR over 999.99", () => {
			expect(() => SubmitAdrSchema.parse({ adr: 1000 })).toThrow(
				"ADR cannot exceed 999.99",
			);
		});

		it("should reject ADR with more than 2 decimal places", () => {
			expect(() => SubmitAdrSchema.parse({ adr: 85.123 })).toThrow(
				"ADR must have at most 2 decimal places",
			);
		});

		it("should accept ADR with exactly 2 decimal places", () => {
			const result = SubmitAdrSchema.parse({ adr: 85.12 });
			expect(result.adr).toBe(85.12);
		});

		it("should accept integer ADR", () => {
			const result = SubmitAdrSchema.parse({ adr: 85 });
			expect(result.adr).toBe(85);
		});

		it("should validate unlock action", () => {
			const result = SubmitAdrSchema.parse({ adr: 85, action: "unlock" });
			expect(result.action).toBe("unlock");
		});

		it("should reject invalid action", () => {
			expect(() =>
				SubmitAdrSchema.parse({ adr: 85, action: "invalid" }),
			).toThrow();
		});
	});

	describe("GenerateTeamsSchema", () => {
		it("should validate with default runs", () => {
			const result = GenerateTeamsSchema.parse({});
			expect(result.runs).toBe(500);
		});

		it("should validate with custom runs", () => {
			const result = GenerateTeamsSchema.parse({ runs: 100 });
			expect(result.runs).toBe(100);
		});

		it("should validate with lock action", () => {
			const result = GenerateTeamsSchema.parse({ action: "lock" });
			expect(result.action).toBe("lock");
		});

		it("should reject runs less than 1", () => {
			expect(() => GenerateTeamsSchema.parse({ runs: 0 })).toThrow(
				"Must run at least 1 optimization",
			);
		});

		it("should reject runs greater than 1000", () => {
			expect(() => GenerateTeamsSchema.parse({ runs: 1001 })).toThrow(
				"Cannot exceed 1000 optimization runs",
			);
		});

		it("should reject non-integer runs", () => {
			expect(() => GenerateTeamsSchema.parse({ runs: 100.5 })).toThrow(
				"Optimization runs must be an integer",
			);
		});
	});

	describe("ResultMatchSchema", () => {
		it("should validate valid match string", () => {
			const result = ResultMatchSchema.parse({
				match_string: "TEAM1-16-14-TEAM2",
			});
			expect(result.match_string).toBe("TEAM1-16-14-TEAM2");
		});

		it("should validate match string with numbers in team names", () => {
			const result = ResultMatchSchema.parse({
				match_string: "TEAM10-13-16-TEAM5",
			});
			expect(result.match_string).toBe("TEAM10-13-16-TEAM5");
		});

		it("should reject invalid match string format", () => {
			expect(() =>
				ResultMatchSchema.parse({ match_string: "invalid-format" }),
			).toThrow("Match string must be in format TEAM1-score1-score2-TEAM2");
		});

		it("should reject match string with lowercase team names", () => {
			expect(() =>
				ResultMatchSchema.parse({ match_string: "team1-16-14-team2" }),
			).toThrow();
		});

		it("should reject match string with non-numeric scores", () => {
			expect(() =>
				ResultMatchSchema.parse({ match_string: "TEAM1-abc-14-TEAM2" }),
			).toThrow();
		});
	});
});

describe("Tournament Discord Interaction Schemas", () => {
	describe("TournamentInteractionSchema", () => {
		it("should validate basic tournament interaction", () => {
			const interaction = {
				data: {
					name: "tournament" as const,
					options: [
						{
							name: "open",
							type: DISCORD_OPTION_TYPES.SUB_COMMAND,
						},
					],
				},
			};
			const result = TournamentInteractionSchema.parse(interaction);
			expect(result.data.name).toBe("tournament");
		});
	});

	describe("SubmitAdrInteractionSchema", () => {
		it("should validate submit_adr interaction with ADR only", () => {
			const interaction = {
				data: {
					name: "tournament" as const,
					options: [
						{
							name: "submit_adr" as const,
							type: DISCORD_OPTION_TYPES.SUB_COMMAND,
							options: [
								{
									name: "adr",
									type: DISCORD_OPTION_TYPES.NUMBER,
									value: 85.5,
								},
							],
						},
					],
				},
			};
			const result = SubmitAdrInteractionSchema.parse(interaction);
			expect(result.data.options[0].name).toBe("submit_adr");
		});

		it("should validate submit_adr interaction with user mention", () => {
			const interaction = {
				data: {
					name: "tournament" as const,
					options: [
						{
							name: "submit_adr" as const,
							type: DISCORD_OPTION_TYPES.SUB_COMMAND,
							options: [
								{
									name: "player",
									type: DISCORD_OPTION_TYPES.USER,
									user: {
										id: "123456789",
										username: "testuser",
										global_name: "Test User",
									},
								},
								{
									name: "adr",
									type: DISCORD_OPTION_TYPES.NUMBER,
									value: 90.0,
								},
							],
						},
					],
				},
			};
			const result = SubmitAdrInteractionSchema.parse(interaction);
			expect(result.data.options[0].options?.[0].user?.id).toBe("123456789");
		});
	});
});

describe("Parameter Extraction Utilities", () => {
	describe("extractTournamentSubcommand", () => {
		it("should extract subcommand name", () => {
			const interaction = {
				data: {
					name: "tournament" as const,
					options: [
						{
							name: "open",
							type: DISCORD_OPTION_TYPES.SUB_COMMAND,
						},
					],
				},
			};
			const subcommand = extractTournamentSubcommand(interaction);
			expect(subcommand).toBe("open");
		});
	});

	describe("extractSubmitAdrParams", () => {
		it("should extract ADR parameter", () => {
			const interaction = {
				data: {
					name: "tournament" as const,
					options: [
						{
							name: "submit_adr" as const,
							type: DISCORD_OPTION_TYPES.SUB_COMMAND,
							options: [
								{
									name: "adr",
									type: DISCORD_OPTION_TYPES.NUMBER,
									value: 85.5,
								},
							],
						},
					],
				},
			};
			const params = extractSubmitAdrParams(interaction);
			expect(params.adr).toBe(85.5);
		});

		it("should extract player and action parameters", () => {
			const interaction = {
				data: {
					name: "tournament" as const,
					options: [
						{
							name: "submit_adr" as const,
							type: DISCORD_OPTION_TYPES.SUB_COMMAND,
							options: [
								{
									name: "player",
									type: DISCORD_OPTION_TYPES.USER,
									user: {
										id: "123456789",
										username: "testuser",
									},
								},
								{
									name: "adr",
									type: DISCORD_OPTION_TYPES.NUMBER,
									value: 90.0,
								},
								{
									name: "action",
									type: DISCORD_OPTION_TYPES.STRING,
									value: "lock",
								},
							],
						},
					],
				},
			};
			const params = extractSubmitAdrParams(interaction);
			expect(params.player).toBe("123456789");
			expect(params.adr).toBe(90.0);
			expect(params.action).toBe("lock");
		});

		it("should handle missing options", () => {
			const interaction = {
				data: {
					name: "tournament" as const,
					options: [
						{
							name: "submit_adr" as const,
							type: DISCORD_OPTION_TYPES.SUB_COMMAND,
						},
					],
				},
			};
			const params = extractSubmitAdrParams(interaction);
			expect(params).toEqual({});
		});
	});

	describe("extractGenerateTeamsParams", () => {
		it("should extract runs parameter", () => {
			const interaction = {
				data: {
					name: "tournament" as const,
					options: [
						{
							name: "generate_teams" as const,
							type: DISCORD_OPTION_TYPES.SUB_COMMAND,
							options: [
								{
									name: "runs",
									type: DISCORD_OPTION_TYPES.INTEGER,
									value: 100,
								},
							],
						},
					],
				},
			};
			const params = extractGenerateTeamsParams(interaction);
			expect(params.runs).toBe(100);
		});

		it("should extract action parameter", () => {
			const interaction = {
				data: {
					name: "tournament" as const,
					options: [
						{
							name: "generate_teams" as const,
							type: DISCORD_OPTION_TYPES.SUB_COMMAND,
							options: [
								{
									name: "action",
									type: DISCORD_OPTION_TYPES.STRING,
									value: "unlock",
								},
							],
						},
					],
				},
			};
			const params = extractGenerateTeamsParams(interaction);
			expect(params.action).toBe("unlock");
		});
	});

	describe("extractResultMatchParams", () => {
		it("should extract match string parameter", () => {
			const interaction = {
				data: {
					name: "tournament" as const,
					options: [
						{
							name: "result" as const,
							type: DISCORD_OPTION_TYPES.SUB_COMMAND,
							options: [
								{
									name: "match_string" as const,
									type: DISCORD_OPTION_TYPES.STRING,
									value: "TEAM1-16-14-TEAM2",
								},
							],
						},
					],
				},
			};
			const params = extractResultMatchParams(interaction);
			expect(params.match_string).toBe("TEAM1-16-14-TEAM2");
		});

		it("should throw error when match string is missing", () => {
			const interaction = {
				data: {
					name: "tournament" as const,
					options: [
						{
							name: "result" as const,
							type: DISCORD_OPTION_TYPES.SUB_COMMAND,
							options: [],
						},
					],
				},
			};
			expect(() => extractResultMatchParams(interaction)).toThrow(
				"Match string parameter is required",
			);
		});
	});
});

describe("Match String Parsing", () => {
	describe("parseMatchString", () => {
		it("should parse valid match string", () => {
			const result = parseMatchString("TEAM1-16-14-TEAM2");
			expect(result).toEqual({
				team1Id: "TEAM1",
				score1: 16,
				score2: 14,
				team2Id: "TEAM2",
			});
		});

		it("should parse match string with numeric team names", () => {
			const result = parseMatchString("TEAM10-13-16-TEAM5");
			expect(result).toEqual({
				team1Id: "TEAM10",
				score1: 13,
				score2: 16,
				team2Id: "TEAM5",
			});
		});

		it("should handle zero scores", () => {
			const result = parseMatchString("TEAM1-0-0-TEAM2");
			expect(result).toEqual({
				team1Id: "TEAM1",
				score1: 0,
				score2: 0,
				team2Id: "TEAM2",
			});
		});

		it("should throw error for invalid format", () => {
			expect(() => parseMatchString("invalid-format")).toThrow(
				"Invalid match string format",
			);
		});

		it("should throw error for negative scores", () => {
			expect(() => parseMatchString("TEAM1--1-14-TEAM2")).toThrow(
				"Invalid match string format",
			);
		});

		it("should throw error for non-numeric scores", () => {
			expect(() => parseMatchString("TEAM1-abc-14-TEAM2")).toThrow(
				"Invalid match string format",
			);
		});
	});
});

describe("Command Parameter Validation", () => {
	describe("validateTournamentCommandParams", () => {
		it("should validate open command", () => {
			const result = validateTournamentCommandParams("open", {});
			expect(result).toEqual({});
		});

		it("should validate submit_adr command", () => {
			const result = validateTournamentCommandParams("submit_adr", {
				adr: 85.5,
			});
			expect(result).toEqual({ adr: 85.5 });
		});

		it("should validate generate_teams command", () => {
			const result = validateTournamentCommandParams("generate_teams", {
				runs: 100,
			});
			expect(result).toEqual({ runs: 100 });
		});

		it("should validate result command", () => {
			const result = validateTournamentCommandParams("result", {
				match_string: "TEAM1-16-14-TEAM2",
			});
			expect(result).toEqual({ match_string: "TEAM1-16-14-TEAM2" });
		});

		it("should throw error for unknown subcommand", () => {
			expect(() => validateTournamentCommandParams("unknown", {})).toThrow(
				"Unknown tournament subcommand: unknown",
			);
		});

		it("should throw ValidationError for invalid parameters", () => {
			expect(() =>
				validateTournamentCommandParams("submit_adr", { adr: -5 }),
			).toThrow();
		});
	});
});

describe("Error Handling", () => {
	it("should throw ValidationError with proper error details", () => {
		try {
			validateData(SubmitAdrSchema, { adr: -5 });
		} catch (error) {
			expect(error).toBeInstanceOf(ValidationError);
			expect((error as ValidationError).errors).toBeDefined();
			expect((error as ValidationError).errors.length).toBeGreaterThan(0);
		}
	});

	it("should handle complex validation errors", () => {
		try {
			validateData(SubmitAdrSchema, {
				adr: 1000.123, // Too high and too many decimals
				action: "invalid", // Invalid action
			});
		} catch (error) {
			expect(error).toBeInstanceOf(ValidationError);
			expect((error as ValidationError).errors.length).toBeGreaterThan(1);
		}
	});
});
