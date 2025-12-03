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
					name: "1. Brockor devestating loss to Xioami Roomba: Shark",
					value: "https://discord.com/channels/1258477556110200833/1258587331326382080/1435100987101548706",
				},
				{
					name: "2. Dev 0-11 Losing record against human players",
					value: "https://discord.com/channels/1258477556110200833/1258587331326382080/1445147678764699690",
				},
				{
					name: "3. Remus knocked out by 0-5 tournament player",
					value: "https://discord.com/channels/1258477556110200833/1258587331326382080/1440844177460957344",
				},

				{
					name: "4. Sena struggles to get a single win in 10 games",
					value: "https://discord.com/channels/1258477556110200833/1258587331326382080/1416633398067331274",
				},
				{
					name: "5. Ace goes on a midnight walk to prepare mentally for his match",
					value: "https://discord.com/channels/1258477556110200833/1258587331326382080/1440120089708986448",
				},
				{
					name: "6. bagshawties last minute sub",
					value: "https://discord.com/channels/1258477556110200833/1258587331326382080/1439335631175159971",
				}
			)
			.setFooter({ text: "Clash Royale Hatewatch Bot Database" });

		await interaction.reply({ embeds: [embed] });
	},
	public: true,
};
