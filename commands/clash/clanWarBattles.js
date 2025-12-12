const { SlashCommandBuilder, EmbedBuilder } = require("discord.js");
const API_KEY = process.env.API_KEY;

module.exports = {
	data: new SlashCommandBuilder()
		.setName("clan-war-battles")
		.setDescription(
			"responds with information about clan members and their battles in the clan war."
		),
	async execute(interaction) {
		await interaction.deferReply();
		// We need to request the information about the river race from the api
		const url = `https://api.clashroyale.com/v1/clans/%23GPPJJQQL/currentriverrace`;
		const res = await fetch(url, {
			headers: { Authorization: `Bearer ${API_KEY}` },
		});

		if (!res.ok) {
			const text = await res.text();
			// Check for known "not found" error
			if (res.status === 404) {
				throw new Error(
					`CRHW Encountered an error while trying to retrieve clan war status.`
				);
			}
			throw new Error(`API error: ${res.status} ${text}`);
		}

		const riverRace = await res.json();
		const participants = riverRace.clan.participants;

		const tableHeader =
			"Name        | Fame 🏅 | Att | Decks\n" +
			"-----------------------------------";

		const tableBody = participants
			.map(
				(p) =>
					`${p.name.slice(0, 10).padEnd(10)} | ${String(
						p.fame
					).padEnd(7)} | ${String(p.boatAttacks).padEnd(3)} | ${
						p.decksUsed
					}/4`
			)
			.join("\n");

		const table = "```md\n" + tableHeader + "\n" + tableBody + "\n```";
		const embed = new EmbedBuilder()
			.setColor(0x0099ff)
			.setTitle(`Current JB6 River Race Status`)
			.setDescription(table)
			.setFooter({
				text: `Clash Royale Hatewatch Bot`,
			});

		await interaction.followUp({ embeds: [embed] });
	},
	public: true,
};
