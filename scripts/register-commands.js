/**
 * Script to register Discord slash commands
 * Run with: node --env-file=.env scripts/register-commands.js
 *
 * Requires .env file with:
 * DISCORD_TOKEN=your_bot_token_here
 * APPLICATION_ID=your_application_id_here
 */

const DISCORD_TOKEN = process.env.DISCORD_TOKEN;
const APPLICATION_ID = process.env.APPLICATION_ID;

const commands = [
	{
		name: "t",
		description: "Manage CS2 scrim tournaments",
		options: [
			{
				name: "open",
				description: "Open a new tournament (Admin only)",
				type: 1, // SUB_COMMAND
			},
			{
				name: "close",
				description: "Close the current tournament (Admin only)",
				type: 1, // SUB_COMMAND
			},
			{
				name: "help",
				description: "Show tournament command help and usage guide",
				type: 1, // SUB_COMMAND
			},
			{
				name: "set_adr",
				description:
					"Set your ADR or manage player ADRs (Admin can set for others)",
				type: 1, // SUB_COMMAND
				options: [
					{
						name: "adr",
						description: "Your ADR value (0-999.99)",
						type: 10, // NUMBER type
						required: false,
					},
					{
						name: "player",
						description: "Player to submit ADR for (Admin only)",
						type: 6, // USER type
						required: false,
					},
					{
						name: "action",
						description: "Lock or unlock player ADR (Admin only)",
						type: 3, // STRING type
						required: false,
						choices: [
							{
								name: "Lock ADR",
								value: "lock",
							},
							{
								name: "Unlock ADR",
								value: "unlock",
							},
						],
					},
				],
			},
			{
				name: "show_adr",
				description: "Show all player ADRs for the current tournament",
				type: 1, // SUB_COMMAND
			},
			{
				name: "generate_teams",
				description:
					"Generate balanced teams or manage team locks (Admin only)",
				type: 1, // SUB_COMMAND
				options: [
					{
						name: "action",
						description: "Lock or unlock teams",
						type: 3, // STRING type
						required: false,
						choices: [
							{
								name: "Lock teams",
								value: "lock",
							},
							{
								name: "Unlock teams",
								value: "unlock",
							},
						],
					},
					{
						name: "runs",
						description: "Number of optimization runs (1-200, default: 200)",
						type: 4, // INTEGER type
						required: false,
						min_value: 1,
						max_value: 200,
					},
				],
			},
			{
				name: "show_teams",
				description: "Show current teams for the tournament",
				type: 1, // SUB_COMMAND
			},
			{
				name: "join",
				description: "Join the current tournament (Admin can join others)",
				type: 1, // SUB_COMMAND
				options: [
					{
						name: "player",
						description: "Player to join to tournament (Admin only)",
						type: 6, // USER type
						required: false,
					},
				],
			},
			{
				name: "leave",
				description: "Leave the current tournament",
				type: 1, // SUB_COMMAND
			},
			{
				name: "remove",
				description: "Remove a player from the tournament (Admin only)",
				type: 1, // SUB_COMMAND
				options: [
					{
						name: "player",
						description: "Player to remove from tournament",
						type: 6, // USER type
						required: true,
					},
				],
			},
			{
				name: "result",
				description: "Record match results (Admin only)",
				type: 1, // SUB_COMMAND
				options: [
					{
						name: "match_string",
						description:
							"Match result in format: TEAM1-score1-score2-TEAM2 (e.g., TEAM1-16-14-TEAM2)",
						type: 3, // STRING type
						required: true,
					},
				],
			},
			{
				name: "exchange",
				description: "Exchange two players between teams (Admin only)",
				type: 1, // SUB_COMMAND
				options: [
					{
						name: "player1",
						description: "First player to exchange",
						type: 6, // USER type
						required: true,
					},
					{
						name: "player2",
						description: "Second player to exchange",
						type: 6, // USER type
						required: true,
					},
				],
			},
			{
				name: "add",
				description: "Add a player to a specific team (Admin only)",
				type: 1, // SUB_COMMAND
				options: [
					{
						name: "player",
						description: "Player to add to the team",
						type: 6, // USER type
						required: true,
					},
					{
						name: "team_id",
						description: "Team ID to add player to (e.g., TEAM1, TEAM2)",
						type: 3, // STRING type
						required: true,
						// Note: We could add choices here if we want to limit to specific team IDs
						// but keeping it flexible for dynamic team generation
					},
				],
			},
		],
	},
];

async function registerCommands() {
	// Validate environment variables
	if (!DISCORD_TOKEN) {
		console.error("❌ DISCORD_TOKEN not found in environment variables");
		console.error("   Make sure you have DISCORD_TOKEN in your .env file");
		process.exit(1);
	}

	if (!APPLICATION_ID) {
		console.error("❌ APPLICATION_ID not found in environment variables");
		console.error("   Make sure you have APPLICATION_ID in your .env file");
		process.exit(1);
	}

	try {
		console.log("Registering Discord slash commands...");
		console.log(`Application ID: ${APPLICATION_ID}`);

		const response = await fetch(
			`https://discord.com/api/v10/applications/${APPLICATION_ID}/commands`,
			{
				method: "PUT",
				headers: {
					Authorization: `Bot ${DISCORD_TOKEN}`,
					"Content-Type": "application/json",
				},
				body: JSON.stringify(commands),
			},
		);

		if (response.ok) {
			const data = await response.json();
			console.log("✅ Successfully registered commands:", data);
		} else {
			const error = await response.text();
			console.error("❌ Failed to register commands:", error);
		}
	} catch (error) {
		console.error("❌ Error registering commands:", error);
	}
}

registerCommands();
