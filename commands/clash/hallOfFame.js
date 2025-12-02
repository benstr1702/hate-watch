const { SlashCommandBuilder, EmbedBuilder } = require("discord.js");

module.exports = {
	data: new SlashCommandBuilder()
		.setName("hall-of-fame")
		.setDescription("Displays the JB6 Clash Royale Hall of Fame."),
	async execute(interaction) {
		const embed = new EmbedBuilder()
			.setColor(0x0099ff)
			.setTitle("JB6 Clash Royale Hall of Fame")
			.setDescription("Most memorable JB6 moments")
			.addFields(
				{
					name: "1. Remus knocked out by 0-5 tournament player",
					value: "https://discord.com/channels/1258477556110200833/1258587331326382080/1440844177460957344",
				},
				{
					name: "2. Dev 0-11 Losing record against human players",
					value: "https://discord.com/channels/1258477556110200833/1258587331326382080/1445147678764699690",
				},
				{
					name: "3. Benis tournament final choke",
					value: "https://discord.com/channels/1258477556110200833/1258587331326382080/1444062425493012715",
				},
				{
					name: "4. bagshawties last minute sub",
					value: "https://discord.com/channels/1258477556110200833/1258587331326382080/1439335631175159971",
				},
				{
					name: "5. Brockor toughest opponent to date: Dolphin",
					value: "https://discord.com/channels/1258477556110200833/1258587331326382080/1435100987101548706",
				},
				{
					name: "6. Ace goes on a midnight walk to prepare mentally for his match",
					value: "https://discord.com/channels/1258477556110200833/1258587331326382080/1440120089708986448",
				}
			)
			.setFooter({ text: "Clash Royale Hatewatch Bot Database" });

		await interaction.reply({ embeds: [embed] });
	},
	public: true,
};
