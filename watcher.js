const dotenv = require("dotenv");
dotenv.config();
const apiKey = process.env.API_KEY;
const baseURL = `https://api.clashroyale.com/v1/players/`;
const fs = require("node:fs");

function encodeTag(tag) {
	return `%23${tag.replace("#", "").toUpperCase()}`;
}

function parseBattleTime(battleTime) {
	// Example input: "20250922T153747.000Z"
	// Convert to "2025-09-22T15:37:47.000Z"
	const fixed = battleTime.replace(
		/^(\d{4})(\d{2})(\d{2})T(\d{2})(\d{2})(\d{2})\.(\d+)Z$/,
		"$1-$2-$3T$4:$5:$6.$7Z"
	);
	return new Date(fixed);
}

function checkTiltMessages(player, discordId) {
	const tokens = player.tilt.tokens;
	const userMention = `<@${discordId}>`;

	if (tokens === 3)
		return `${userMention} brother bear... 3 losses? maybe take a break 😭`;
	if (tokens === 6) return `${userMention} 6 losses? put the phone down.`;
	if (tokens === 10)
		return `${userMention} https://tenor.com/view/jamie-carragher-football-meme-leave-the-football-before-it-leaves-you-too-far-gone-it-cant-go-on-like-this-gif-2536563062431203619`;
	return null;
}

function updateTiltBucket(player, result) {
	const tilt = player.tilt;

	if (result === "WON") {
		// Win = hard reset
		tilt.tokens = 0;
		tilt.lastUpdate = Date.now();
		return;
	}

	if (result === "LOST") {
		tilt.tokens = Math.min(tilt.tokens + 1, 10); // cap at 10
		tilt.lastUpdate = Date.now();
	}
}

async function pollPlayer(tag, nick, discordId) {
	const res = await fetch(`${baseURL}${encodeTag(tag)}/battlelog`, {
		headers: { Authorization: `Bearer ${apiKey}` },
	});

	if (!res.ok) {
		const text = await res.text();
		throw new Error(`API error for ${tag}: ${res.status} ${text}`);
	}

	const battles = await res.json();
	const recentBattle = battles[0];
	const validModes = [72000006, 72000450];

	if (!validModes.includes(recentBattle.gameMode.id)) return null;
	const timestamp = parseBattleTime(recentBattle.battleTime).toISOString();
	console.log(`last timestamp for ${nick} :  ${timestamp}`);

	// --- DB setup ---
	const dbPath = "./lastBattleTimes.json";
	if (!fs.existsSync(dbPath))
		fs.writeFileSync(dbPath, JSON.stringify({}, null, 2));

	const rawJsonDB = fs.readFileSync(dbPath, "utf-8");
	const jsonDB = JSON.parse(rawJsonDB);
	if (!jsonDB.tracked) jsonDB.tracked = {};

	let player = jsonDB.tracked[tag];
	if (!player) {
		player = {
			name: nick,
			discordId, // FIX
			tilt: { tokens: 0, lastUpdate: 0 },
		};
		jsonDB.tracked[tag] = player;
	}
	player.discordId = discordId;

	if (!player.tilt) player.tilt = { tokens: 0, lastUpdate: 0 };
	const MIN_NOTIFICATION_INTERVAL = 10 * 60 * 1000;
	let shouldNotify = true;
	if (player.lastNotified) {
		const lastNotifiedTime = new Date(player.lastNotified);
		const currentTime = new Date(timestamp);
		if (currentTime - lastNotifiedTime < MIN_NOTIFICATION_INTERVAL) {
			console.log(
				`${player.name} battle too recent, skipping notification.`
			);
			shouldNotify = false;
		}
	}
	// --- Detect new battle ---
	if (player && player.timestamp === timestamp) {
		console.log(`${player.name}'s status remains unchanged.`);
		return null;
	}

	// update timestamp & gamemode
	player.timestamp = timestamp;
	player.gameMode =
		recentBattle.gameMode.id === 72000006 ? "Ladder" : "Ranked";

	if (shouldNotify) {
		player.lastNotified = timestamp;
	}

	const lostOrWon =
		recentBattle.team[0].crowns < recentBattle.opponent[0].crowns
			? "LOST"
			: recentBattle.team[0].crowns > recentBattle.opponent[0].crowns
			? "WON"
			: "TIED";

	const score = `${recentBattle.team[0].crowns} - ${recentBattle.opponent[0].crowns}`;
	const trophyChange = Number.isFinite(recentBattle.team[0].trophyChange)
		? recentBattle.team[0].trophyChange
		: undefined;
	// return info for announcements
	updateTiltBucket(player, lostOrWon);
	const tiltMsg = checkTiltMessages(player, discordId);
	// save DB
	fs.writeFileSync(dbPath, JSON.stringify(jsonDB, null, 2));

	return {
		tag,
		name: player.name,
		gameMode: player.gameMode,
		timestamp,
		lostOrWon,
		score,
		...(trophyChange !== undefined && { trophyChange }),
		shouldNotify,
		tiltMsg,
	};
}

module.exports = pollPlayer;
