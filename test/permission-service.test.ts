import { describe, it, expect, beforeEach } from "vitest";
import {
	PermissionService,
	PermissionError,
} from "../src/services/permission.js";
import type { DiscordInteraction } from "../src/validation/discord.js";

describe("PermissionService", () => {
	let permissionService: PermissionService;
	const adminRoleIds = ["123456789", "987654321"];

	beforeEach(() => {
		permissionService = new PermissionService(adminRoleIds);
	});

	describe("constructor", () => {
		it("should create service with admin role IDs", () => {
			const service = new PermissionService(["role1", "role2"]);
			expect(service.getAdminRoleIds()).toEqual(["role1", "role2"]);
		});

		it("should create service with empty role IDs", () => {
			const service = new PermissionService([]);
			expect(service.getAdminRoleIds()).toEqual([]);
		});
	});

	describe("fromEnvironment", () => {
		it("should create service from environment variable", () => {
			const env = { TOURNAMENT_ADMIN_ROLES: "123,456,789" };
			const service = PermissionService.fromEnvironment(env);
			expect(service.getAdminRoleIds()).toEqual(["123", "456", "789"]);
		});

		it("should handle environment variable with spaces", () => {
			const env = { TOURNAMENT_ADMIN_ROLES: " 123 , 456 , 789 " };
			const service = PermissionService.fromEnvironment(env);
			expect(service.getAdminRoleIds()).toEqual(["123", "456", "789"]);
		});

		it("should handle missing environment variable", () => {
			const env = {};
			const service = PermissionService.fromEnvironment(env);
			expect(service.getAdminRoleIds()).toEqual([]);
		});

		it("should handle empty environment variable", () => {
			const env = { TOURNAMENT_ADMIN_ROLES: "" };
			const service = PermissionService.fromEnvironment(env);
			expect(service.getAdminRoleIds()).toEqual([]);
		});

		it("should filter out empty role IDs", () => {
			const env = { TOURNAMENT_ADMIN_ROLES: "123,,456," };
			const service = PermissionService.fromEnvironment(env);
			expect(service.getAdminRoleIds()).toEqual(["123", "456"]);
		});
	});

	describe("extractUserRoles", () => {
		it("should extract roles from guild member", async () => {
			const interaction: DiscordInteraction = {
				id: "1",
				application_id: "app1",
				type: 2,
				token: "token",
				version: 1,
				member: {
					roles: ["role1", "role2", "role3"],
					joined_at: "2023-01-01T00:00:00Z",
				},
			};

			const roles = await permissionService.extractUserRoles(interaction);
			expect(roles).toEqual(["role1", "role2", "role3"]);
		});

		it("should return empty array when member has no roles", async () => {
			const interaction: DiscordInteraction = {
				id: "1",
				application_id: "app1",
				type: 2,
				token: "token",
				version: 1,
				member: {
					roles: [],
					joined_at: "2023-01-01T00:00:00Z",
				},
			};

			const roles = await permissionService.extractUserRoles(interaction);
			expect(roles).toEqual([]);
		});

		it("should return empty array when no member data", async () => {
			const interaction: DiscordInteraction = {
				id: "1",
				application_id: "app1",
				type: 2,
				token: "token",
				version: 1,
			};

			const roles = await permissionService.extractUserRoles(interaction);
			expect(roles).toEqual([]);
		});

		it("should return empty array when member exists but no roles property", async () => {
			const interaction: DiscordInteraction = {
				id: "1",
				application_id: "app1",
				type: 2,
				token: "token",
				version: 1,
				member: {
					joined_at: "2023-01-01T00:00:00Z",
				} as any,
			};

			const roles = await permissionService.extractUserRoles(interaction);
			expect(roles).toEqual([]);
		});
	});

	describe("checkAdminPermission", () => {
		it("should return true when user has admin role", async () => {
			const interaction: DiscordInteraction = {
				id: "1",
				application_id: "app1",
				type: 2,
				token: "token",
				version: 1,
				member: {
					roles: ["123456789", "other_role"],
					joined_at: "2023-01-01T00:00:00Z",
				},
			};

			const hasPermission =
				await permissionService.checkAdminPermission(interaction);
			expect(hasPermission).toBe(true);
		});

		it("should return true when user has multiple admin roles", async () => {
			const interaction: DiscordInteraction = {
				id: "1",
				application_id: "app1",
				type: 2,
				token: "token",
				version: 1,
				member: {
					roles: ["123456789", "987654321", "other_role"],
					joined_at: "2023-01-01T00:00:00Z",
				},
			};

			const hasPermission =
				await permissionService.checkAdminPermission(interaction);
			expect(hasPermission).toBe(true);
		});

		it("should return false when user has no admin roles", async () => {
			const interaction: DiscordInteraction = {
				id: "1",
				application_id: "app1",
				type: 2,
				token: "token",
				version: 1,
				member: {
					roles: ["other_role1", "other_role2"],
					joined_at: "2023-01-01T00:00:00Z",
				},
			};

			const hasPermission =
				await permissionService.checkAdminPermission(interaction);
			expect(hasPermission).toBe(false);
		});

		it("should return false when user has no roles", async () => {
			const interaction: DiscordInteraction = {
				id: "1",
				application_id: "app1",
				type: 2,
				token: "token",
				version: 1,
				member: {
					roles: [],
					joined_at: "2023-01-01T00:00:00Z",
				},
			};

			const hasPermission =
				await permissionService.checkAdminPermission(interaction);
			expect(hasPermission).toBe(false);
		});

		it("should return false when no member data", async () => {
			const interaction: DiscordInteraction = {
				id: "1",
				application_id: "app1",
				type: 2,
				token: "token",
				version: 1,
			};

			const hasPermission =
				await permissionService.checkAdminPermission(interaction);
			expect(hasPermission).toBe(false);
		});

		it("should return false when no admin roles configured", async () => {
			const service = new PermissionService([]);
			const interaction: DiscordInteraction = {
				id: "1",
				application_id: "app1",
				type: 2,
				token: "token",
				version: 1,
				member: {
					roles: ["any_role"],
					joined_at: "2023-01-01T00:00:00Z",
				},
			};

			const hasPermission = await service.checkAdminPermission(interaction);
			expect(hasPermission).toBe(false);
		});
	});

	describe("requireAdminPermission", () => {
		it("should not throw when user has admin permission", async () => {
			const interaction: DiscordInteraction = {
				id: "1",
				application_id: "app1",
				type: 2,
				token: "token",
				version: 1,
				member: {
					roles: ["123456789"],
					joined_at: "2023-01-01T00:00:00Z",
				},
			};

			await expect(
				permissionService.requireAdminPermission(interaction),
			).resolves.not.toThrow();
		});

		it("should throw PermissionError when user lacks admin permission", async () => {
			const interaction: DiscordInteraction = {
				id: "1",
				application_id: "app1",
				type: 2,
				token: "token",
				version: 1,
				member: {
					roles: ["other_role"],
					joined_at: "2023-01-01T00:00:00Z",
				},
			};

			await expect(
				permissionService.requireAdminPermission(interaction),
			).rejects.toThrow(PermissionError);

			await expect(
				permissionService.requireAdminPermission(interaction),
			).rejects.toThrow("Insufficient permissions. Admin role required.");
		});

		it("should throw PermissionError when no member data", async () => {
			const interaction: DiscordInteraction = {
				id: "1",
				application_id: "app1",
				type: 2,
				token: "token",
				version: 1,
			};

			await expect(
				permissionService.requireAdminPermission(interaction),
			).rejects.toThrow(PermissionError);
		});
	});

	describe("getAdminRoleIds", () => {
		it("should return copy of admin role IDs", () => {
			const roleIds = permissionService.getAdminRoleIds();
			expect(roleIds).toEqual(adminRoleIds);

			// Verify it's a copy, not the original array
			roleIds.push("new_role");
			expect(permissionService.getAdminRoleIds()).toEqual(adminRoleIds);
		});

		it("should return empty array when no roles configured", () => {
			const service = new PermissionService([]);
			expect(service.getAdminRoleIds()).toEqual([]);
		});
	});
});
