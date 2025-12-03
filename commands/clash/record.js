/**
 * Command to show the last 25 match record (WIN / LOSS)
 * gets tag / user object
 * Only for ranked / ladder
 * if no ladder / ranked matches in the past 25 , A message displaying "No Ladder / Ranked matches in the past 25."
 */

const { SlashCommandBuilder, EmbedBuilder } = require("discord.js");
const fs = require("node:fs");
const path = require("node:path");

const BASE_URL = "https://api.clashroyale.com/v1/players/";
const API_KEY = process.env.API_KEY;
const dbPath = path.join(__dirname, "../../lastBattleTimes.json"); // Path to the linking database

/**
 * Sanitizes and validates a player tag.
 * Returns the clean tag WITHOUT the '#' prefix for use in the API URL.
 */
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

	return tag; // Returns tag without '#'
}

module.exports = {
	data: new SlashCommandBuilder()
		.setName("record")
		.setDescription("displays last 25 matches record (win/loss)")
		.addStringOption((option) =>
			option
				.setName("tag")
				.setDescription("The player's tag (E.G #2ABC)")
				.setRequired(false)
		)
		.addUserOption((option) =>
			option
				.setName("user")
				.setDescription("The Discord user whose record to view")
				.setRequired(false)
		),

	async execute(interaction) {
		await interaction.deferReply();

		const inputTag = interaction.options.getString("tag");
		const inputUser = interaction.options.getUser("user");

		let finalTagForAPI;
		let tagSource;

		// --- TAG RESOLUTION LOGIC ---
		if (inputTag) {
			finalTagForAPI = sanitizeTag(inputTag);
			tagSource = "manual tag";
		} else if (inputUser || !inputTag) {
			const userToLookup = inputUser || interaction.user;
			tagSource = `linked to ${userToLookup.username}`;

			let db = {};
			try {
				if (fs.existsSync(dbPath)) {
					db = JSON.parse(fs.readFileSync(dbPath, "utf-8"));
				}
			} catch (error) {
				console.error("DB read error in record command:", error);
				return interaction.followUp({
					content: "❌ Database error during link lookup.",
					ephemeral: true,
				});
			}

			const tracked = db.tracked || {};
			let foundDbKey = null;

			// Iterate through tracked players to find a match for the Discord ID
			for (const tagKey in tracked) {
				if (tracked[tagKey].discordId === userToLookup.id) {
					foundDbKey = tagKey;
					break;
				}
			}

			if (!foundDbKey) {
				return interaction.followUp({
					content: `❌ Discord user **${userToLookup.username}** does not have a Clash Royale tag linked. Please use \`/link\` first or provide a tag directly.`,
					ephemeral: true,
				});
			}

			finalTagForAPI = sanitizeTag(foundDbKey);
		}

		if (!finalTagForAPI) {
			return interaction.followUp({
				content:
					"❌ Invalid player tag. Use only 0289CGJLPQRUVY characters.",
				ephemeral: true,
			});
		}
		// -----------------------------

		try {
			// The API requires the tag to be URL encoded (%23 for #)
			const encodedTag = `%23${finalTagForAPI}`;

			// --- SINGLE API Call: Get Battle Log (Contains Player Info) ---
			const logRes = await fetch(`${BASE_URL}${encodedTag}/battlelog`, {
				headers: { Authorization: `Bearer ${API_KEY}` },
			});

			if (!logRes.ok) {
				const text = await logRes.text();
				if (logRes.status === 404) {
					throw new Error(
						`Clash Royale Player Tag (${finalTagForAPI}) not found.`
					);
				}
				throw new Error(`API error: ${logRes.status} ${text}`);
			}

			const log = await logRes.json();

			if (!log || log.length === 0) {
				return interaction.followUp({
					content: `⚠️ No battle log data found for tag \`#${finalTagForAPI}\`. The player may be new or inactive.`,
					ephemeral: true,
				});
			}

			// Extract player details from the first battle log entry (most recent)
			const playerDetails = log[0].team?.[0];
			if (!playerDetails) {
				return interaction.followUp({
					content: `⚠️ Could not identify player details from the battle log for tag \`#${finalTagForAPI}\`.`,
					ephemeral: true,
				});
			}

			const playerName = playerDetails.name;
			const playerTag = playerDetails.tag;
			const playerClan = playerDetails.clan?.name || "No Clan";
			// --- End Player Info Extraction ---

			let winCounter = 0;
			let lossCounter = 0;
			let drawCounter = 0;
			let rankedMatchCounter = 0;

			// Match criteria: Official Ladder (72000006) or Ranked 1v1 (72000450)
			for (const match of log) {
				const isLadder =
					match.gameMode.id === 72000006 &&
					match.gameMode.name.includes("Ladder");
				const isRanked =
					match.gameMode.id === 72000450 &&
					match.gameMode.name.includes("Ranked");

				if (isLadder || isRanked) {
					// We assume 1v1 battles for ladder/ranked, hence checking team[0] vs opponent[0]
					const teamCrowns = match.team?.[0]?.crowns || 0;
					const opponentCrowns = match.opponent?.[0]?.crowns || 0;

					rankedMatchCounter++;

					if (teamCrowns > opponentCrowns) {
						winCounter++;
					} else if (teamCrowns < opponentCrowns) {
						lossCounter++;
					} else {
						drawCounter++;
					}
				}
			}

			// --- Embed Generation ---
			let recordString;
			if (rankedMatchCounter === 0) {
				recordString = "No Ladder/Ranked matches in the past 25.";
			} else {
				recordString = `W: **${winCounter}** | L: **${lossCounter}** | D: **${drawCounter}**`;
			}

			const embed = new EmbedBuilder()
				.setColor(0x0099ff)
				.setTitle(`${playerName} (${playerTag})`)
				.setDescription(`Clan: ${playerClan}`)
				.addFields({
					name: `Competitive 1v1 Record (Last ${log.length} Battles)`,
					value: recordString,
				})
				.setFooter({
					text: `Source: ${tagSource} | Clash Royale Hatewatch Bot`,
				});

			await interaction.followUp({ embeds: [embed] });
		} catch (error) {
			console.error(`Record command execution error:`, error);
			await interaction.followUp({
				content: `❌ Failed to retrieve match record: ${
					error.message || "An unknown error occurred."
				}`,
				ephemeral: true,
			});
		}
	},
	public: true,
};
