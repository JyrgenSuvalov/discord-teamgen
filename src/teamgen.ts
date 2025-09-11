export type Player = {
	name: string;
	adr: number;
};

export type Team = {
	players: Player[];
	totalAdr: number;
};

// Utility: shuffle array in place
function shuffle<T>(array: T[]): void {
	for (let i = array.length - 1; i > 0; i--) {
		const j = Math.floor(Math.random() * (i + 1));
		// biome-ignore lint/style/noNonNullAssertion: Array bounds are controlled by loop
		const temp = array[i]!;
		// biome-ignore lint/style/noNonNullAssertion: Array bounds are controlled by loop
		array[i] = array[j]!;
		array[j] = temp;
	}
}

// Compute initial teams and ADR difference
export function computeTeams(
	players: Player[],
	teamSize: number,
): { teams: Team[]; adrDiff: number } {
	const numTeams = players.length / teamSize;
	const teams: Team[] = Array.from({ length: numTeams }, () => ({
		players: [],
		totalAdr: 0,
	}));

	for (let i = 0; i < players.length; i++) {
		// biome-ignore lint/style/noNonNullAssertion: Array bounds are controlled by loop
		const player = players[i]!;
		// biome-ignore lint/style/noNonNullAssertion: Array bounds are controlled by modulo operation
		const team = teams[i % numTeams]!;
		team.players.push(player);
		team.totalAdr += player.adr;
	}

	const totals = teams.map((t) => t.totalAdr);
	const adrDiff = Math.max(...totals) - Math.min(...totals);

	return { teams, adrDiff };
}

// Local search optimizer
export function optimizeTeams(
	players: Player[],
	teamSize = 5,
	maxNoImprovement = 1000,
	runs = 500,
): { teams: Team[]; adrDiff: number } {
	if (players.length % teamSize !== 0) {
		throw new Error(`Player count must be a multiple of ${teamSize}`);
	}

	let bestTeams: Team[] = [];
	let bestDiff = Infinity;

	for (let run = 0; run < runs; run++) {
		const shuffled = [...players];
		shuffle(shuffled);

		let { teams, adrDiff } = computeTeams(shuffled, teamSize);

		let noImprovement = 0;

		while (noImprovement < maxNoImprovement) {
			// Pick two random teams
			const indices = Array.from({ length: teams.length }, (_, i) => i);
			shuffle(indices);
			const [i, j] = indices.slice(0, 2) as [number, number];

			// biome-ignore lint/style/noNonNullAssertion: Indices are controlled by shuffle of valid team indices
			const teamA = teams[i]!;
			// biome-ignore lint/style/noNonNullAssertion: Indices are controlled by shuffle of valid team indices
			const teamB = teams[j]!;

			// Pick random players from each team
			const aIndex = Math.floor(Math.random() * teamA.players.length);
			const bIndex = Math.floor(Math.random() * teamB.players.length);

			// biome-ignore lint/style/noNonNullAssertion: Index is controlled by team.players.length
			const playerA = teamA.players[aIndex]!;
			// biome-ignore lint/style/noNonNullAssertion: Index is controlled by team.players.length
			const playerB = teamB.players[bIndex]!;

			// Swap
			[teamA.players[aIndex], teamB.players[bIndex]] = [playerB, playerA];

			// Update totals
			teamA.totalAdr = teamA.players.reduce(
				(sum: number, p: Player) => sum + p.adr,
				0,
			);
			teamB.totalAdr = teamB.players.reduce(
				(sum: number, p: Player) => sum + p.adr,
				0,
			);

			const totals = teams.map((t) => t.totalAdr);
			const newDiff = Math.max(...totals) - Math.min(...totals);

			if (newDiff < adrDiff) {
				adrDiff = newDiff;
				noImprovement = 0;
			} else {
				// Revert swap
				[teamA.players[aIndex], teamB.players[bIndex]] = [playerA, playerB];
				teamA.totalAdr = teamA.players.reduce(
					(sum: number, p: Player) => sum + p.adr,
					0,
				);
				teamB.totalAdr = teamB.players.reduce(
					(sum: number, p: Player) => sum + p.adr,
					0,
				);
				noImprovement++;
			}
		}

		// Keep best run
		if (adrDiff < bestDiff) {
			bestDiff = adrDiff;
			bestTeams = teams.map((t) => ({ ...t, players: [...t.players] }));
		}
	}

	return { teams: bestTeams, adrDiff: bestDiff };
}
