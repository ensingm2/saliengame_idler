// Disable the game animations to minimize browser CPU usage
requestAnimationFrame = function(){}

// This is the zone you want to attack.
var target_zone = -1;

// Variables. Don't change these unless you know what you're doing.
var max_scores = [600, 1200, 2400] // Max scores for each difficulty (easy, medium, hard)
var round_length = 120; // Round Length (In Seconds)
var update_length = 15; // How long to wait between updates (In Seconds)
var loop_rounds = true;
var language = "english"; // Used when POSTing scores
var access_token = "";
var current_game_id = undefined;
var current_timeout = undefined;
var max_retry = 3; // Max number of retries to report your score
var current_retry = 0;
var auto_first_join = true; // Automatically join the best zone at first
var current_planet_id = undefined;

class BotGUI {
	constructor(state) {
        console.log('GUI Has been created');
        
        this.state = state;
		
		this.createStatusWindow();
	}
	
	createStatusWindow() {
		if(document.getElementById('salienbot_gui')) {
			return false;
		}
		
		var $statusWindow = $J([
			'<div id="salienbot_gui" style="background: #191919; border: 3px solid #83d674; padding: 20px; width: 300px; margin: 0 auto; transform: translate(0, -200px);">',
				'<h1>Salien Game Idler</h1>',
				'<p>Status: <span id="salienbot_status"></span></p>',
				'<p>Level: <span id="salienbot_level">' + this.state.level + '</span></p>',
				'<p>EXP: <span id="salienbot_exp">' + this.state.exp + '</span></p>',
			'</div>'
		].join(''))


		$J('#salien_game_placeholder').append( $statusWindow )
	}
	
	updateStatus(status) {
        console.log(status);
		document.getElementById('salienbot_status').innerText = status;
	}
	
	updateExp(exp) {
		document.getElementById('salienbot_exp').innerText = exp;
	}
	
	updateLevel(level) {
		document.getElementById('salienbot_level').innerText = level;
	}
};

var gui = new BotGUI({
    level: gPlayerInfo.level,
    exp: gPlayerInfo.score
});

// Grab the user's access token
var INJECT_get_access_token = function() {
	$J.ajax({
		type: "GET",
		url: "https://steamcommunity.com/saliengame/gettoken",
		success: function(data) {
			if(data.token != undefined) {
				console.log("Got access token: " + data.token);
				access_token = data.token;
			}
			else {
				console.log("Failed to retrieve access token.")
				access_token = undefined;
			}
		}
	});
}

// Make the call to start a round, and kick-off the idle process
var INJECT_start_round = function(zone, access_token) {
	// Leave the game if we're already in one.
	if(current_game_id !== undefined) {
		console.log("Previous game detected. Ending it.");
		INJECT_leave_round();
	}

	// Send the POST to join the game.
	$J.ajax({
		type: "POST",
		url: "https://community.steam-api.com/ITerritoryControlMinigameService/JoinZone/v0001/",
		data: { access_token: access_token, zone_position: zone },
		success: function(data) {
			console.log("Round successfully started in zone #" + zone);
			console.log(data);
			if (data.response.zone_info !== undefined) {
				current_game_id = data.response.zone_info.gameid;
				INJECT_wait_for_end(round_length);
			} else {
					SwitchNextZone();
			}
		},
		error: function (xhr, ajaxOptions, thrownError) {
			alert("Error starting round: " + xhr.status + ": " + thrownError);
		}
	});
}

// Update time remaining, and wait for the round to complete.
var INJECT_wait_for_end = function(time_remaining) {
    gui.updateStatus("Time remaining in round: " + time_remaining + "s");

	// Wait
	var wait_time;
	var callback;
	if(time_remaining <= update_length) {
		wait_time = time_remaining*1000;
		callback = function() { INJECT_end_round(); };
	}
	else { 
		var wait_time = update_length*1000;
		callback = function() { INJECT_wait_for_end(time_remaining); };
	}

	// Decrement timer
	time_remaining -= update_length;

	// Set the timeout
	current_timeout = setTimeout(callback, wait_time);
}

// Send the call to end a round, and restart if needed.
var INJECT_end_round = function() {
	// Grab the max score we're allowed to send
	var score = max_scores[INJECT_get_difficulty(target_zone)];

	// Post our "Yay we beat the level" call
	$J.ajax({
		type: "POST",
		url: "https://community.steam-api.com/ITerritoryControlMinigameService/ReportScore/v0001/",
		data: { access_token: access_token, score: score, language: language },
		success: function(data) {
			if( $J.isEmptyObject(data.response) ) {
				if (current_retry < max_retry) {
					console.log("Empty Response. Waiting 5s and trying again.")
					current_timeout = setTimeout(function() { INJECT_end_round(); }, 5000);
					current_retry++;
				} else {
					current_retry = 0;
					SwitchNextZone();
				}
			}
			else {
				console.log("Successfully finished the round and got expected data back:");
				console.log("Level: ", data.response.new_level, "\nEXP:   ", data.response.new_score);
                console.log(data);
                
                gui.updateLevel(data.response.new_level);
                gui.updateExp(data.response.new_score);

				// Update the player info in the UI
				INJECT_update_player_info();

				// Restart the round if we have that variable set
				if(loop_rounds) {
					UpdateNotificationCounts();
					current_game_id = undefined;
					INJECT_start_round(target_zone, access_token)
				}
			}
		}
	});
}

// Leave an existing game
var INJECT_leave_round = function() {
	if(current_game_id === undefined)
		return;

	console.log("Leaving game: " + current_game_id);

	// Cancel timeouts
	clearTimeout(current_timeout);

	// POST to the endpoint
	$J.ajax({
		async: false,
		type: "POST",
		url: "https://community.steam-api.com/IMiniGameService/LeaveGame/v0001/",
		data: { access_token: access_token, gameid: current_game_id },
		success: function(data) {}
	});

	// Clear the current game ID var
	current_game_id = undefined;
}

// returns 0 for easy, 1 for medium, 2 for hard
var INJECT_get_difficulty = function(zone_id) {
	return window.gGame.m_State.m_PlanetData.zones[zone_id].difficulty - 1;
}

// Updates the player info
// Currently unused. This was meant to hopefully update the UI.
var INJECT_update_player_info = function() {
	gServer.GetPlayerInfo(
		function( results ) {
			gPlayerInfo = results.response;
		},
		function(){}
	);
}

// Update the zones of the grid (map) on the current planet
var INJECT_update_grid = function() {
	if(current_planet_id === undefined)
        return;
        

    gui.updateStatus('Updating grid');

	// GET to the endpoint
	$J.ajax({
		async: false,
		type: "GET",
		url: "https://community.steam-api.com/ITerritoryControlMinigameService/GetPlanet/v0001/",
		data: { id: current_planet_id },
		success: function(data) {
			window.gGame.m_State.m_PlanetData = data.response.planets[0];
			window.gGame.m_State.m_PlanetData.zones.forEach( function ( zone ) {
				window.gGame.m_State.m_Grid.m_Tiles[zone.zone_position].Info.progress = zone.capture_progress; 
				window.gGame.m_State.m_Grid.m_Tiles[zone.zone_position].Info.captured = zone.captured; 
			});
			console.log("Successfully updated map data on planet: " + current_planet_id);
		}
	});
}

// Get the best zone available
function GetBestZone() {
	var bestZoneIdx;
    var highestDifficulty = -1;
    
    gui.updateStatus('Getting best zone');

	for (var idx = 0; idx < window.gGame.m_State.m_Grid.m_Tiles.length; idx++) {
		var zone = window.gGame.m_State.m_Grid.m_Tiles[idx].Info;
		if (!zone.captured) {
			if (zone.boss) {
				console.log("Zone " + idx + " with boss. Switching to it.");
				return idx;
			}

			if(zone.difficulty > highestDifficulty) {
				highestDifficulty = zone.difficulty;
				maxProgress = zone.progress;
				bestZoneIdx = idx;
			} else if(zone.difficulty < highestDifficulty) continue;

			if(zone.progress < maxProgress) {
				maxProgress = zone.progress;
				bestZoneIdx = idx;
			}
		}
	}

	if(bestZoneIdx !== undefined) {
			console.log(`${window.gGame.m_State.m_PlanetData.state.name} - Zone ${bestZoneIdx} Progress: ${window.gGame.m_State.m_Grid.m_Tiles[bestZoneIdx].Info.progress} Difficulty: ${window.gGame.m_State.m_Grid.m_Tiles[bestZoneIdx].Info.difficulty}`);
	}

	return bestZoneIdx;
}

// Switch to the next zone when one is completed
function SwitchNextZone() {
	next_zone = GetBestZone();
	INJECT_leave_round();
	INJECT_update_grid();
	var next_zone = GetBestZone();
	if (next_zone !== undefined) {
		console.log("Zone #" + target_zone + " has ended. Trying #" + next_zone);
		target_zone = next_zone;
		INJECT_start_round(next_zone, access_token);
	} else {
		console.log("There's no more zone, the planet must be completed. You'll need to choose another planet!");
		target_zone = -1;
	}
}

// Auto-grab the access token
INJECT_get_access_token();

// Auto join best zone at first
if (auto_first_join == true) {
	var delayingStart = setTimeout(firstJoin, 3000);
	function firstJoin() {
		clearTimeout(delayingStart);
		current_planet_id = window.gGame.m_State.m_PlanetData.id;
		if(target_zone === -1)
			target_zone = GetBestZone();
		INJECT_start_round(first_zone, access_token);
	}
}

// Overwrite join function so clicking on a grid square will run our code instead
gServer.JoinZone = function (zone_id, callback, error_callback) {
	current_planet_id = window.gGame.m_State.m_PlanetData.id;
	target_zone = zone_id;
	INJECT_start_round(zone_id, access_token);
}
