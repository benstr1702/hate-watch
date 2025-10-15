const {
	Client,
	Events,
	GatewayIntentBits,
	Collection,
	MessageFlags,
} = require("discord.js");
const fs = require("node:fs");
const path = require("node:path");
const dotenv = require("dotenv");
const pollPlayer = require("./watcher.js");
dotenv.config();

const trackedPlayers = require("./queue.js");
const token = process.env.DISCORD_TOKEN;
const apiKey = process.env.API_KEY;

const BASE_URL = "https://api.clashroyale.com/v1/players/";

// --- Helpers ---
function encodeTag(tag) {
	return `%23${tag.replace("#", "").toUpperCase()}`;
}

// --- Discord Setup ---
const client = new Client({ intents: [GatewayIntentBits.Guilds] });
client.commands = new Collection();
const boinChannelId = process.env.BOINGBOING_CHANNEL_ID;
const jbChannelId = process.env.JB_CHANNEL_ID;

const foldersPath = path.join(__dirname, "commands");
for (const folder of fs.readdirSync(foldersPath)) {
	const commandsPath = path.join(foldersPath, folder);
	for (const file of fs
		.readdirSync(commandsPath)
		.filter((f) => f.endsWith(".js"))) {
		const command = require(path.join(commandsPath, file));
		if ("data" in command && "execute" in command) {
			client.commands.set(command.data.name, command);
		}
	}
}

// --- Poll Loop ---
async function pollLoop(channel) {
	while (true) {
		try {
			for (const tag in trackedPlayers) {
				const nick = trackedPlayers[tag];
				const newBattle = await pollPlayer(tag, nick);
				if (newBattle) {
					// always announce the battle
					let msg = `${newBattle.name} played a **${newBattle.gameMode}** match! **${newBattle.lostOrWon}** *${newBattle.score}*`;

					if (Number.isFinite(newBattle.trophyChange)) {
						msg += ` | ${newBattle.trophyChange} 🏆`;
					}
					// ping only if 10 minutes passed
					if (newBattle.shouldNotify) {
						msg = `<@762388297825124402> ` + msg;
					}

					await channel.send(msg);
				}

				await new Promise((r) => setTimeout(r, 2000));
			}
		} catch (err) {
			console.error("Polling loop error:", err);
			await new Promise((r) => setTimeout(r, 10_000)); // avoid crash loop
		}
		await new Promise((r) => setTimeout(r, 60_000));
	}
}

client.once(Events.ClientReady, async (readyClient) => {
	console.log(`✅ Ready! Logged in as ${readyClient.user.tag}`);
	const channel = await client.channels.fetch(boinChannelId);
	//const channel = await client.channels.fetch(jbChannelId);
	channel.send("#NowHateWatching");
	pollLoop(channel); // kick off polling in background
});

client.on(Events.InteractionCreate, async (interaction) => {
	if (!interaction.isChatInputCommand()) return;
	const command = interaction.client.commands.get(interaction.commandName);
	if (!command) return;
	try {
		await command.execute(interaction);
	} catch (err) {
		console.error(err);
		const reply = {
			content: "There was an error while executing this command!",
			flags: MessageFlags.Ephemeral,
		};
		if (interaction.replied || interaction.deferred) {
			await interaction.followUp(reply);
		} else {
			await interaction.reply(reply);
		}
	}
});

client.login(token);
