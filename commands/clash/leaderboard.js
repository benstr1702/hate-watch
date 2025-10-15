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
				results.push({
					name: nick,
					trophies: player.trophies,
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
