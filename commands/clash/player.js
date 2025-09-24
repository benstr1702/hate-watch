const { SlashCommandBuilder, EmbedBuilder } = require("discord.js");

const BASE_URL = "https://api.clashroyale.com/v1/players/";
const API_KEY = process.env.API_KEY;

function sanitizeTag(input) {
	if (!input) return null;

	// Step 1: Uppercase and trim
	let tag = input.toUpperCase().trim();

	// Step 2: Remove leading #
	if (tag.startsWith("#")) {
		tag = tag.slice(1);
	}

	// Step 3: Replace O with 0
	tag = tag.replace(/O/g, "0");

	// Step 4: Validate allowed characters
	const validChars = /^[0289CGJLPQRUVY]+$/;
	if (!validChars.test(tag)) {
		return null; // invalid tag
	}

	return tag;
}

//// Example usage
//const rawTag = "#o2qL9cgy";
//const safeTag = sanitizeTag(rawTag);

//if (!safeTag) {
//	console.log("Invalid tag!");
//} else {
//	console.log("Clean tag:", safeTag); // -> "02QL9CGY"
//}

module.exports = {
	data: new SlashCommandBuilder()
		.setName("player")
		.setDescription("replies with clash royale player profile")
		.addStringOption((option) =>
			option
				.setName("tag")
				.setDescription("The player's tg (E.G #2ABC)")
				.setRequired(true)
		),

	async execute(interaction) {
		const tag = interaction.options.getString("tag");
		// sanitize it
		const finalTag = sanitizeTag(tag);
		if (!finalTag) {
			return interaction.reply({
				content:
					"❌ Invalid player tag. Use only 0289CGJLPQRUVY characters.",
				ephemeral: true,
			});
		}

		try {
			const res = await fetch(`${BASE_URL}%23${finalTag}`, {
				headers: { Authorization: `Bearer ${API_KEY}` },
			});

			if (!res.ok) {
				const text = await res.text();
				throw new Error(`API error: ${res.status} ${text}`);
			}

			const player = await res.json();
			console.log(player);

			// DECK
			const deckString = player.currentDeck
				.map(
					(card) =>
						`**${card.name}** (Lvl ${card.level}) | Elixir: ${card.elixirCost}`
				)
				.join("\n");

			const embed = new EmbedBuilder()
				.setColor(0x0099ff)
				.setTitle(`${player.name} (${player.tag})`)
				.setDescription(`Clan: ${player.clan?.name || "No Clan"}`)
				.addFields(
					{
						name: "Level",
						value: `${player.expLevel}`,
						inline: true,
					},
					{
						name: "Trophies",
						value: `${player.trophies}`,
						inline: true,
					},
					{
						name: "Best Trophies",
						value: `${player.bestTrophies}`,
						inline: true,
					},
					{ name: "Wins", value: `${player.wins}`, inline: true },
					{ name: "Losses", value: `${player.losses}`, inline: true },
					{
						name: "3 Crown Wins",
						value: `${player.threeCrownWins}`,
						inline: true,
					},
					{ name: "Current Deck", value: deckString }
				)
				.setFooter({ text: "Clash Royale Hatewatch Bot" });

			await interaction.reply({ embeds: [embed] });
		} catch (error) {
			console.error(error);
			await interaction.reply({
				content:
					"Failed to fetch player info. Check the tag or API key.",
			});
		}
	},
	public: true,
};
