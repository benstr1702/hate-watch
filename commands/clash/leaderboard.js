const { SlashCommandBuilder, EmbedBuilder } = require("discord.js");
const trackedPlayers = require("../../queue");

const BASE_URL = "https://api.clashroyale.com/v1/players/";
const API_KEY = process.env.API_KEY;

function encodeTag(tag) {
	return `%23${tag.replace("#", "").toUpperCase()}`;
}

module.exports = {
	data: new SlashCommandBuilder()
		.setName("leaderboard")
		.setDescription(
			"Displays the current trophy leaderboard of tracked players"
		),

	async execute(interaction) {
		await interaction.deferReply(); // in case API calls take a second

		try {
			const results = [];

			// Loop through each tracked player (tag → nickname)
			for (const tag in trackedPlayers) {
				const nick = trackedPlayers[tag];
				const res = await fetch(`${BASE_URL}${encodeTag(tag)}`, {
					headers: { Authorization: `Bearer ${API_KEY}` },
				});

				if (!res.ok) {
					console.warn(`❌ Failed to fetch ${nick}: ${res.status}`);
					continue;
				}

				const player = await res.json();

				let displayedTrophies = player.trophies;
				let rankLabel = "";

				// Fallback to Path of Legends if ladder cap reached
				if (
					player.trophies >= 10000 &&
					player.currentPathOfLegendSeasonResult
				) {
					const pol = player.currentPathOfLegendSeasonResult;

					const leagues = {
						1: "Master I",
						2: "Master II",
						3: "Master III",
						4: "Champion",
						5: "Grand Champion",
						6: "Royal Champion",
						7: "Ultimate Champion",
					};

					const leagueName =
						leagues[pol.leagueNumber] ||
						`League ${pol.leagueNumber}`;
					const polTrophies = pol.trophies || 0;
					const polRank = pol.rank ? ` #${pol.rank}` : "";

					rankLabel = `${leagueName} (${polTrophies} PoL${polRank})`;
					displayedTrophies = `10,000+ — ${rankLabel}`;
				}

				results.push({
					name: nick,
					trophies: player.trophies,
					displayedTrophies,
					bestTrophies: player.bestTrophies,
				});
			}

			// Sort by trophies
			results.sort((a, b) => b.trophies - a.trophies);

			// Build leaderboard string
			const leaderboard = results
				.map(
					(p, i) =>
						`**${i + 1}.** ${p.name} — 🏆 ${p.trophies} *(best: ${
							p.bestTrophies
						})*`
				)
				.join("\n");

			// Build embed
			const embed = new EmbedBuilder()
				.setTitle("🏆 Hatewatch Leaderboard")
				.setColor(0xffd700)
				.setDescription(leaderboard)
				.setFooter({
					text: "Clash Royale Hatewatch Bot",
				});

			await interaction.editReply({ embeds: [embed] });
		} catch (err) {
			console.error(err);
			await interaction.editReply(
				"❌ Error fetching leaderboard. Try again later."
			);
		}
	},
	public: true,
};
