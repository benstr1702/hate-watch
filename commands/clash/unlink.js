/**
 * Clash Royale Account unlink command
 * Interaction user enters a valid Clash Royale tag to remove its Discord association.
 */

const { SlashCommandBuilder } = require("discord.js");
const fs = require("node:fs");
const path = require("node:path");

const dbPath = path.join(__dirname, "../../lastBattleTimes.json");

// Ensures that the tag used for DB lookup is always in the consistent '#TAG' format.
function sanitizeTag(input) {
	if (!input) return null;

	// Step 1: Uppercase and trim
	let tag = input.toUpperCase().trim();

	// Step 2: Remove leading # for cleaning purposes
	if (tag.startsWith("#")) {
		tag = tag.slice(1);
	}

	// Step 3: Replace common typos (O with 0)
	tag = tag.replace(/O/g, "0");

	// Step 4: Validate allowed characters
	const validChars = /^[0289CGJLPQRUVY]+$/;
	if (!validChars.test(tag)) {
		return null; // invalid tag
	}

	// Step 5: Return the standardized tag with '#' prefix for DB key consistency
	return `#${tag}`;
}
// -----------------------------------------------------------

module.exports = {
	data: new SlashCommandBuilder()
		.setName("unlink")
		.setDescription(
			"Removes the link between a Clash Royale account and its Discord User."
		)
		.addStringOption((option) =>
			option
				.setName("tag")
				.setDescription(
					"The Clash Royale tag (E.G #C890U22V) to unlink"
				)
				.setRequired(true)
		),

	async execute(interaction) {
		await interaction.deferReply({ ephemeral: true });
		const inputTag = interaction.options.getString("tag");
		const dbKey = sanitizeTag(inputTag);

		if (!dbKey) {
			await interaction.followUp({
				content: `❌ Invalid Clash Royale Tag provided.`,
				ephemeral: true,
			});
			return;
		}

		let db = {};
		let dbReadError = false;

		try {
			if (fs.existsSync(dbPath)) {
				db = JSON.parse(fs.readFileSync(dbPath, "utf-8"));
			}
		} catch (error) {
			console.error("Failed to read database for unlink command:", error);
			dbReadError = true;
			db = {};
		}

		if (dbReadError || !db.tracked) {
			await interaction.followUp({
				content:
					"❌ Database initialization error. Cannot proceed with unlink.",
				ephemeral: true,
			});
			return;
		}

		// Use the standardized dbKey for lookup
		let dbTag = db.tracked[dbKey];

		if (!dbTag) {
			// Case 1: Tag not found in DB
			await interaction.followUp({
				content: `⚠️ Clash Account **${dbKey}** was not found in the database.`,
				ephemeral: true,
			});
			return;
		}

		let originalDiscordId = dbTag.discordId;

		if (!originalDiscordId) {
			// Case 2: Tag found, but already unlinked (no discordId property, or null/undefined)
			await interaction.followUp({
				content: `ℹ️ Clash Account **${dbKey}** (Player: ${
					dbTag.player?.name || "Unknown"
				}) is already unlinked.`,
				ephemeral: true,
			});
			return;
		}

		try {
			// Case 3: Tag is linked. Remove the discordId while preserving other tracking data.
			// Setting to null allows link.js to easily treat it as an incomplete entry later.
			dbTag.discordId = null;
			// dbTag.name is intentionally NOT set to null to preserve potential custom nicknames.

			// Persistence: Write the updated object back to the JSON file
			fs.writeFileSync(dbPath, JSON.stringify(db, null, 4), "utf-8");

			await interaction.followUp({
				content: `✅ Successfully unlinked Discord ID **${originalDiscordId}** from Clash Account **${dbKey}** (Player: ${
					dbTag.player?.name || "Unknown"
				}). All tracking data remains intact.`,
				ephemeral: false,
			});
		} catch (error) {
			console.error(
				`Unlink command persistence error for tag ${dbKey}:`,
				error
			);
			await interaction.followUp({
				content: `❌ Failed to save changes to the database: ${error.message}`,
				ephemeral: true,
			});
		}
	},
	public: true,
};
