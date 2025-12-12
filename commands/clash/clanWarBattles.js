const {
	SlashCommandBuilder,
	EmbedBuilder,
	ActionRowBuilder,
	ButtonBuilder,
	ButtonStyle,
} = require("discord.js");
const API_KEY = process.env.API_KEY;

module.exports = {
	data: new SlashCommandBuilder()
		.setName("clan-war-battles")
		.setDescription(
			"responds with information about clan members and their battles in the clan war."
		),
	async execute(interaction) {
		await interaction.deferReply();

		// Request the information about the river race from the API
		const url = `https://api.clashroyale.com/v1/clans/%23GPPJJQQL/currentriverrace`;
		const res = await fetch(url, {
			headers: { Authorization: `Bearer ${API_KEY}` },
		});

		if (!res.ok) {
			const text = await res.text();
			if (res.status === 404) {
				await interaction.followUp({
					content:
						"❌ CRHW Encountered an error while trying to retrieve clan war status.",
					ephemeral: true,
				});
				return;
			}
			await interaction.followUp({
				content: `❌ API error: ${res.status} ${text}`,
				ephemeral: true,
			});
			return;
		}

		const riverRace = await res.json();
		const participants = riverRace.clan.participants;

		// Sort by fame (descending), then by decks used today (descending)
		participants.sort((a, b) => {
			if (b.fame !== a.fame) return b.fame - a.fame;
			return b.decksUsedToday - a.decksUsedToday;
		});

		const pageSize = 10;
		const totalPages = Math.ceil(participants.length / pageSize);
		let currentPage = 0;

		// Function to normalize string width for monospace display
		// Approximates visual width considering emoji and wide characters
		function getVisualWidth(str) {
			let width = 0;
			for (const char of str) {
				const code = char.charCodeAt(0);
				// CJK characters and other wide chars take ~2 spaces
				if (
					(code >= 0x1100 && code <= 0x11ff) || // Hangul
					(code >= 0x2e80 && code <= 0x9fff) || // CJK
					(code >= 0xac00 && code <= 0xd7af) || // Hangul Syllables
					(code >= 0xff00 && code <= 0xffef) // Full-width forms
				) {
					width += 2;
				} else {
					width += 1;
				}
			}
			return width;
		}

		// Function to truncate/pad name to fit target visual width
		function formatName(name, targetWidth = 12) {
			let result = "";
			let width = 0;

			for (const char of name) {
				const charWidth = getVisualWidth(char);
				if (width + charWidth > targetWidth) break;
				result += char;
				width += charWidth;
			}

			// Pad with spaces to reach target width
			while (width < targetWidth) {
				result += " ";
				width++;
			}

			return result;
		}

		// Function to create embed for a specific page
		function createEmbed(page) {
			const start = page * pageSize;
			const end = Math.min(start + pageSize, participants.length);
			const pageParticipants = participants.slice(start, end);

			const tableHeader =
				"Name         | Fame 🏅  | Decks Today\n" +
				"─────────────────────────────────────";

			const tableRows = pageParticipants.map((p) => {
				const name = formatName(p.name, 12);
				const fame = String(p.fame).padStart(6);
				const decks = `${p.decksUsedToday}/4`;

				// Add indicator for players who haven't played at all
				const indicator =
					p.fame === 0 && p.decksUsedToday === 0 ? " ⚠️" : "";

				return `${name} | ${fame}   | ${decks}${indicator}`;
			});

			const table =
				"```md\n" + tableHeader + "\n" + tableRows.join("\n") + "\n```";

			// Count inactive players (no fame, no decks used)
			const inactivePlayers = participants.filter(
				(p) => p.fame === 0 && p.decksUsedToday === 0
			).length;

			const description =
				table +
				(inactivePlayers > 0
					? `\n⚠️ = Player hasn't participated yet (${inactivePlayers} total)`
					: "");

			return new EmbedBuilder()
				.setColor(0x0099ff)
				.setTitle("Current JB6 River Race Status")
				.setDescription(description)
				.setFooter({
					text: `Clash Royale Hatewatch Bot | Page ${
						page + 1
					}/${totalPages} | ${participants.length} participants`,
				});
		}

		// Function to create navigation buttons
		function createButtons(page) {
			return new ActionRowBuilder().addComponents(
				new ButtonBuilder()
					.setCustomId("first")
					.setLabel("⏮️ First")
					.setStyle(ButtonStyle.Primary)
					.setDisabled(page === 0),
				new ButtonBuilder()
					.setCustomId("prev")
					.setLabel("◀️ Previous")
					.setStyle(ButtonStyle.Primary)
					.setDisabled(page === 0),
				new ButtonBuilder()
					.setCustomId("next")
					.setLabel("Next ▶️")
					.setStyle(ButtonStyle.Primary)
					.setDisabled(page === totalPages - 1),
				new ButtonBuilder()
					.setCustomId("last")
					.setLabel("Last ⏭️")
					.setStyle(ButtonStyle.Primary)
					.setDisabled(page === totalPages - 1)
			);
		}

		// Send initial message
		const message = await interaction.followUp({
			embeds: [createEmbed(currentPage)],
			components: totalPages > 1 ? [createButtons(currentPage)] : [],
		});

		// Only set up collector if there are multiple pages
		if (totalPages > 1) {
			const collector = message.createMessageComponentCollector({
				time: 120000, // 5 minutes
			});

			collector.on("collect", async (i) => {
				// Check if the button was clicked by the original command user
				if (i.user.id !== interaction.user.id) {
					await i.reply({
						content: "Cannot interact with this Embed.",
						ephemeral: true,
					});
					return;
				}

				// Update page based on button clicked
				switch (i.customId) {
					case "first":
						currentPage = 0;
						break;
					case "prev":
						currentPage = Math.max(0, currentPage - 1);
						break;
					case "next":
						currentPage = Math.min(totalPages - 1, currentPage + 1);
						break;
					case "last":
						currentPage = totalPages - 1;
						break;
				}

				// Update the message
				await i.update({
					embeds: [createEmbed(currentPage)],
					components: [createButtons(currentPage)],
				});
			});

			collector.on("end", () => {
				// Disable all buttons when collector expires
				message
					.edit({
						components: [
							new ActionRowBuilder().addComponents(
								new ButtonBuilder()
									.setCustomId("first")
									.setLabel("⏮️ First")
									.setStyle(ButtonStyle.Primary)
									.setDisabled(true),
								new ButtonBuilder()
									.setCustomId("prev")
									.setLabel("◀️ Previous")
									.setStyle(ButtonStyle.Primary)
									.setDisabled(true),
								new ButtonBuilder()
									.setCustomId("next")
									.setLabel("Next ▶️")
									.setStyle(ButtonStyle.Primary)
									.setDisabled(true),
								new ButtonBuilder()
									.setCustomId("last")
									.setLabel("Last ⏭️")
									.setStyle(ButtonStyle.Primary)
									.setDisabled(true)
							),
						],
					})
					.catch(() => {}); // Ignore errors if message was deleted
			});
		}
	},
	public: true,
};
