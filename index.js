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
				const { nick, discordId } = trackedPlayers[tag];
				const userMention = `<@${discordId}>`;

				//const nick = trackedPlayers[tag];
				const newBattle = await pollPlayer(tag, nick, discordId);
				if (!newBattle) continue;
				if (newBattle) {
					// always announce the battle
					if (!newBattle.tilt)
						newBattle.tilt = { tokens: 0, lastUpdate: 0 };

					if (newBattle.lostOrWon === "WON") {
						newBattle.tilt.tokens = 0;
						newBattle.tilt.lastUpdate = Date.now();
					} else if (newBattle.lostOrWon === "LOST") {
						newBattle.tilt.tokens = Math.min(
							newBattle.tilt.tokens + 1,
							10
						);
						newBattle.tilt.lastUpdate = Date.now();
					}
					let msg = `${nick} played a **${newBattle.gameMode}** match! **${newBattle.lostOrWon}** *${newBattle.score}*`;

					if (newBattle.trophyChange) {
						msg += ` | ${newBattle.trophyChange} 🏆`;
					}
					let tiltMsg = null;
					if (newBattle.tilt.tokens === 3)
						tiltMsg = `${userMention} hey… 3 losses? maybe take a break 😭`;
					else if (newBattle.tilt.tokens === 6)
						tiltMsg = `${userMention} 6 losses… put the phone down.?`;
					else if (newBattle.tilt.tokens === 10)
						tiltMsg = `${userMention} https://media1.tenor.com/m/IzOuqn6WwSMAAAAd/jamie-carragher-football-meme.gif`;

					// ping only if 10 minutes passed
					if (newBattle.shouldNotify) {
						//msg = `<@762388297825124402> ` + msg;

						msg = userMention + " " + msg;
					}

					await channel.send(msg);
					if (tiltMsg) await channel.send(tiltMsg);
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
	//const channel = await client.channels.fetch(boinChannelId);
	const channel = await client.channels.fetch(jbChannelId);
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
