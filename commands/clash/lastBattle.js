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

module.exports = {
	data: new SlashCommandBuilder()
		.setName("last-battle")
		.setDescription("returns last available clash royale match.")
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
			const res = await fetch(`${BASE_URL}%23${finalTag}/battlelog`, {
				headers: { Authorization: `Bearer ${API_KEY}` },
			});

			if (!res.ok) {
				const text = await res.text();
				throw new Error(`API error: ${res.status} ${text}`);
			}

			const battleLog = await res.json();
			//console.log(battleLog);
			const validModes = [72000006, 72000464];

			const filteredBattles = battleLog.filter((battle) =>
				validModes.includes(battle.gameMode.id)
			);

			const lastBattle = filteredBattles[0];
			//gameMode: { id: 72000464, name: }
			const battleType =
				lastBattle.gameMode.id === 72000464 &&
				lastBattle.gameMode.name === "Ranked1v1_NewArena2"
					? "Ranked"
					: "Ladder";
			const playerTag = lastBattle.team[0].tag.replace("#", "");
			const opponentTag = lastBattle.opponent[0].tag.replace("#", "");
			const battleScore = `${lastBattle.team[0].crowns} - ${lastBattle.opponent[0].crowns}`;
			const playerDeck = lastBattle.team[0].cards;
			const opponentDeck = lastBattle.opponent[0].cards;

			console.log("battleScore:", battleScore);
			console.log("playerDeck", playerDeck);
			console.log("opponentDeck", opponentDeck);

			const playerLink = `https://royaleapi.com/player/${playerTag}`;
			const opponentLink = `https://royaleapi.com/player/${opponentTag}`;
			console.log("layerLink:", playerLink);
			console.log("opponentLink:", opponentLink);

			//await interaction.reply({ embeds: [embed] });
		} catch (error) {
			console.error(error);
			await interaction.reply({
				content:
					"Failed to fetch player info. Check the tag or API key.",
			});
		}
	},
	public: false,
};
