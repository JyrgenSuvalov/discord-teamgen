import type { DiscordInteraction } from "../validation/discord.js";

export class PermissionError extends Error {
	constructor(message: string) {
		super(message);
		this.name = "PermissionError";
	}
}

export class PermissionService {
	private adminRoleIds: string[];

	constructor(adminRoleIds: string[]) {
		this.adminRoleIds = adminRoleIds;
	}

	/**
	 * Create PermissionService from environment variable
	 * @param env Environment object containing TOURNAMENT_ADMIN_ROLES
	 * @returns PermissionService instance
	 */
	static fromEnvironment(env: {
		TOURNAMENT_ADMIN_ROLES?: string;
	}): PermissionService {
		const roleIds = env.TOURNAMENT_ADMIN_ROLES
			? env.TOURNAMENT_ADMIN_ROLES.split(",")
					.map((id) => id.trim())
					.filter((id) => id.length > 0)
			: [];

		return new PermissionService(roleIds);
	}

	/**
	 * Check if user has admin permissions based on Discord roles
	 * @param interaction Discord interaction containing user/member data
	 * @returns Promise<boolean> true if user has admin permissions
	 */
	async checkAdminPermission(
		interaction: DiscordInteraction,
	): Promise<boolean> {
		// If no admin roles configured, deny access
		if (this.adminRoleIds.length === 0) {
			return false;
		}

		const userRoles = await this.extractUserRoles(interaction);

		// Check if user has any of the required admin roles
		return this.adminRoleIds.some((adminRole) => userRoles.includes(adminRole));
	}

	/**
	 * Extract user roles from Discord interaction
	 * @param interaction Discord interaction
	 * @returns Promise<string[]> array of role IDs
	 */
	async extractUserRoles(interaction: DiscordInteraction): Promise<string[]> {
		// In guild context, roles come from member object
		if (interaction.member?.roles) {
			return interaction.member.roles;
		}

		// In DM context or if member data is missing, no roles
		return [];
	}

	/**
	 * Validate admin permission and throw error if insufficient
	 * @param interaction Discord interaction
	 * @throws PermissionError if user lacks admin permissions
	 */
	async requireAdminPermission(interaction: DiscordInteraction): Promise<void> {
		const hasPermission = await this.checkAdminPermission(interaction);

		if (!hasPermission) {
			throw new PermissionError(
				"Insufficient permissions. Admin role required.",
			);
		}
	}

	/**
	 * Get configured admin role IDs
	 * @returns string[] array of admin role IDs
	 */
	getAdminRoleIds(): string[] {
		return [...this.adminRoleIds];
	}
}
