//const apiKey = process.env.API_KEY;
//const baseURL = `https://api.clashroyale.com/v1/players/`;
//const fs = require("node:fs");

//function encodeTag(tag) {
//	return `%23${tag.replace("#", "").toUpperCase()}`;
//}

//async function pollPlayer(tag) {
//	const res = await fetch(`${baseURL}${encodeTag(tag)}/battlelog`, {
//		headers: { Authorization: `Bearer ${apiKey}` },
//	});

//	if (!res.ok) {
//		const text = await res.text();
//		throw new Error(`api error for ${tag} : ${res.status} ${text}`);
//	}

//	// get the battles
//	const battles = await res.json();
//	//get the last known battle
//	const recentBattle = battles[0];
//	const validModes = [72000006, 72000464];

//	if (validModes.includes(recentBattle.gameMode.id)) {
//		// this means the last battle is either ladder or ranked (both work)
//		// now we need to check the timetamp and compare it to the timestamp saved in our db
//		const timestamp = new Date(recentBattle.battleTime).toISOString();
//		console.log("last timestamp:", timestamp);

//		//example battleTime = "battleTime": "20250922T153747.000Z",
//		// check if the file even exists
//		if (!fs.existsSync("./lastBattleTimes.json")) {
//			fs.writeFileSync(
//				"./lastBattleTimes.json",
//				JSON.stringify({}, null, 2)
//			);
//			console.log("json db created");
//		} else {
//			console.log("json db already exists");
//		}
//		// read the json db file
//		const rawJsonDB = fs.readFileSync("./lastBattleTimes.json", "utf-8");
//		const jsonDB = JSON.parse(rawJsonDB);

//		if (!jsonDB.tracked) jsonDB.tracked = {};

//		const player = jsonDB.tracked[tag];

//		// json db should be made of player tags and their last match timestamp
//		/**
//		 * {
//		 * 	"tracked": [
//		 * 		 "#C890U22V" : {"name" : "benis" , "timestamp" : "2025-09-24T00:30:00Z" , "gamemode": "ranked"} ,
//		 * 		"#C890U275J" : {"name" : "peemus" , "timestamp" : "2025-04-24T00:30:00Z" , "gamemode": "ladder"}
//		 *    ]
//		 * }
//		 */

//		if (player && player.timestamp === timestamp) {
//			// this means the newest battle is the same as the one in the db
//			// do nothing
//			console.log(`${player.name}'s status remains unchanged.`);
//			return null;
//		} else if (player.timestamp < timestamp) {
//			// update db
//			player.timestamp = timestamp;

//			// save changes
//			fs.writeFileSync(
//				"./lastBattleTimes.json",
//				JSON.stringify(jsonDB, null, 2)
//			);

//			// return the announcement info
//			return {
//				tag,
//				name: jsonDB.tracked[tag].name,
//				gameMode:
//					recentBattle.gameMode.id === 72000006 ? "Ladder" : "Ranked",
//				timestamp,
//			};
//		} else {
//			console.log(
//				"smth weird is going on looks like the date in the db is more recent than the one he just played, look into it "
//			);
//		}
//	}
//}

//module.exports = pollPlayer;

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
async function pollPlayer(tag, nick) {
	const res = await fetch(`${baseURL}${encodeTag(tag)}/battlelog`, {
		headers: { Authorization: `Bearer ${apiKey}` },
	});

	if (!res.ok) {
		const text = await res.text();
		throw new Error(`API error for ${tag}: ${res.status} ${text}`);
	}

	const battles = await res.json();
	const recentBattle = battles[0];
	const validModes = [72000006, 72000464];

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
		player = { name: nick }; // <-- use the nickname here
		jsonDB.tracked[tag] = player;
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

	// save DB
	fs.writeFileSync(dbPath, JSON.stringify(jsonDB, null, 2));

	const lostOrWon =
		recentBattle.team[0].crowns < recentBattle.opponent[0].crowns
			? "LOST"
			: recentBattle.team[0].crowns > recentBattle.opponent[0].crowns
			? "WON"
			: "TIED";

	const score = `${recentBattle.team[0].crowns} - ${recentBattle.opponent[0].crowns}`;
	// return info for announcements
	return {
		tag,
		name: player.name,
		gameMode: player.gameMode,
		timestamp,
		lostOrWon,
		score,
	};
}

module.exports = pollPlayer;
