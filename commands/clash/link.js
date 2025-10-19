/**
 * Clash Royale Account link command
 * Interaction user enters a valid IGN and a Member id (ping)
 */

const { SlashCommandBuilder } = require("discord.js");
const BASE_URL = "https://api.clashroyale.com/v1/players/";
const API_KEY = process.env.API_KEY;
const fs = require("node:fs");
const path = require("node:path");

function encodeTag(tag) {
	return `%23${tag.replace("#", "").toUpperCase()}`;
}

const dbPath = path.join(__dirname, "../../lastBattleTimes.json");

module.exports = {
	data: new SlashCommandBuilder()
		.setName("link")
		.setDescription(
			"Link your Clash Royale account to your Discord User for ease of access. "
		)
		.addStringOption((option) =>
			option
				.setName("tag")
				.setDescription("Your Clash Royale tag (E.G #C890U22V)")
				.setRequired(true)
		)
		.addUserOption((option) =>
			option
				.setName("user")
				.setDescription(
					"Select the discord user to link the account to."
				)
				.setRequired(false)
		),

	async execute(interaction) {
		await interaction.deferReply({ ephemeral: true });
		const user = interaction.options.getUser("user") ?? interaction.user;
		const tag = interaction.options.getString("tag");

		//validate tag
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

			return `#${tag}`;
		}

		try {
			const dbKey = sanitizeTag(tag);
			const cleanTag = dbKey.substring(1);
			const encodedTag = `%23${cleanTag}`;
			// check if the provided tag corresponds to a real clash royale account
			const res = await fetch(`${BASE_URL}${encodedTag}`, {
				headers: { Authorization: `Bearer ${API_KEY}` },
			});

			if (!res.ok) {
				const text = await res.text();
				throw new Error(
					`Failed to link , Please use a real Clash Royale tag`
				);
			}

			const player = await res.json();
			let db = {};
			try {
				if (fs.existsSync(dbPath)) {
					db = JSON.parse(fs.readFileSync(dbPath, "utf-8"));
				}
			} catch (error) {
				console.warn(
					"could not read db, initializing empty db instead",
					error
				);
				db = {};
			}

			if (!db.tracked) db.tracked = {};

			// After confirming db exists , we need to link the user to the tag
			// find tag in db

			let dbTag = db.tracked[dbKey];
			if (!dbTag) {
				db.tracked[dbKey] = {
					name: user.username,
					discordId: user.id,
					player: { name: player.name },
				};
			} else if (dbTag.discordId) {
				// update existing user by adding the discord id
				await interaction.followUp({
					content: `😡 Critical Error: A link already exists between the tag **${tag}** and a discord Id.`,
					ephemeral: false,
				});
				return;
				//dbTag.discordId = user.id;
				//dbTag.name = user.username;
				//dbTag.player = { name: player.name };
			} else {
				dbTag.discordId = user.id;
				if (!dbTag.name || dbTag.name !== user.username) {
					dbTag.name = user.username;
				}

				if (!dbTag.player) dbTag.player = {};
				dbTag.player.name = player.name;
			}
			// write to db all the new information
			try {
				fs.writeFileSync(dbPath, JSON.stringify(db, null, 4), "utf-8");
			} catch (error) {
				console.error("Failed to write new data to db", error);
				throw new Error(
					"failed to save account in the database",
					error
				);
			}

			await interaction.followUp({
				content: `✅ Successfully linked Discord user **${user.username}** to Clash Account **${tag}** ✅`,
				ephemeral: false,
			});
		} catch (error) {
			console.error(
				`Link command execution error for tag ${tag}:`,
				error
			);
			await interaction.followUp({
				content: `Failed to execute link command: ${
					error.message ||
					"An unknown error occurred during API communication or data persistence."
				}`,
				ephemeral: true,
			});
		}
	},
	public: true,
};
