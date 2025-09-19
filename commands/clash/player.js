const { SlashCommandBuilder, EmbedBuilder } = require("discord.js");

const BASE_URL = "https://api.clashroyale.com/v1/players/";
const API_KEY = process.env.API_KEY;

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
		const encodedTag = encodeURIComponent(tag.replace("#", ""));
		console.log("raw tag:", tag);

		console.log("encoded tag:", encodedTag);
		const fullTag = `${BASE_URL}%23${encodedTag}`;
		console.log("fullTag:", fullTag);

		try {
			const res = await fetch(fullTag, {
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
};
