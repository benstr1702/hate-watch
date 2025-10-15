const { SlashCommandBuilder, EmbedBuilder } = require("discord.js");
const trackedPlayers = require("../../queue");

const BASE_URL = "https://api.clashroyale.com/v1/players/";
const API_KEY = process.env.API_KEY;

function encodeTag(tag) {
	return `%23${tag.replace("#", "").toUpperCase()}`;
}

function getLeagueName(leagueNumber) {
	const leagues = {
		1: "Master I",
		2: "Master II",
		3: "Master III",
		4: "Champion",
		5: "Grand Champion",
		6: "Royal Champion",
		7: "Ultimate Champion",
	};
	return leagues[leagueNumber] || `League ${leagueNumber}`;
}

/**
 * Pick the best available Path of Legends result from the player object.
 * Preference order: currentPathOfLegendSeasonResult -> lastPathOfLegendSeasonResult -> bestPathOfLegendSeasonResult
 * Returns null if none is present.
 */
function choosePolResult(player) {
	if (!player) return null;

	const candidates = [
		player.currentPathOfLegendSeasonResult,
		player.lastPathOfLegendSeasonResult,
		player.bestPathOfLegendSeasonResult,
	];

	for (const c of candidates) {
		if (
			c &&
			(Number.isFinite(c.trophies) || Number.isFinite(c.leagueNumber))
		) {
			// Normalize trophy value if missing
			return {
				leagueNumber: c.leagueNumber ?? null,
				trophies: Number.isFinite(c.trophies) ? c.trophies : 0,
				rank: Number.isFinite(c.rank) ? c.rank : null,
			};
		}
	}
	return null;
}

module.exports = {
	data: new SlashCommandBuilder()
		.setName("leaderboard")
		.setDescription(
			"Displays the current trophy leaderboard of tracked players"
		),

	async execute(interaction) {
		await interaction.deferReply();

		try {
			const results = [];

			for (const tag in trackedPlayers) {
				const nick = trackedPlayers[tag];

				let res;
				try {
					res = await fetch(`${BASE_URL}${encodeTag(tag)}`, {
						headers: { Authorization: `Bearer ${API_KEY}` },
					});
				} catch (err) {
					console.warn(
						`❌ Network error fetching ${nick} (${tag}):`,
						err.message
					);
					continue;
				}

				if (!res.ok) {
					console.warn(
						`❌ Failed to fetch ${nick} (${tag}): ${res.status}`
					);
					continue;
				}

				const player = await res.json();

				const pol = choosePolResult(player);
				let polDisplay = "";
				if (pol && pol.leagueNumber) {
					const leagueName = getLeagueName(pol.leagueNumber);
					const rankPart = pol.rank ? ` #${pol.rank}` : "";
					polDisplay = ` — ${leagueName} (${pol.trophies} PoL${rankPart})`;
				} else if (pol && pol.trophies) {
					// If leagueNumber missing but trophies present (rare), still show trophies
					polDisplay = ` — PathOfLegends (${pol.trophies})`;
				}

				results.push({
					name: nick,
					trophies: player.trophies ?? 0,
					bestTrophies: player.bestTrophies ?? 0,
					polDisplay,
				});
			}

			// Sort by trophies descending (you can change to consider PoL later)
			results.sort((a, b) => b.trophies - a.trophies);

			// Build leaderboard string
			const leaderboard = results
				.map(
					(p, i) =>
						`**${i + 1}.** ${p.name} — 🏆 ${p.trophies}${
							p.polDisplay ? ` ${p.polDisplay}` : ""
						} *(best: ${p.bestTrophies})*`
				)
				.join("\n");

			const embed = new EmbedBuilder()
				.setTitle("🏆 Hatewatch Leaderboard")
				.setColor(0xffd700)
				.setDescription(leaderboard || "No tracked players found.")
				.setFooter({ text: "Clash Royale Hatewatch Bot" });

			await interaction.editReply({ embeds: [embed] });
		} catch (err) {
			console.error("Leaderboard command error:", err);
			await interaction.editReply(
				"❌ Error fetching leaderboard. Try again later."
			);
		}
	},
	public: true,
};
