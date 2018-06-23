// This is the zone you want to attack (Optional, otherwise picks one for you).
var target_zone = -1;

// Variables. Don't change these unless you know what you're doing.
var real_round_length = 120; // Round Length of a real game (In Seconds, for calculating score)
var resend_frequency = 110; // Frequency at which we can say we finished a round (May be different than real length)
var update_length = 1; // How long to wait between updates (In Seconds)
var loop_rounds = true;
var language = "english"; // Used when POSTing scores
var access_token = "";
var current_game_id = undefined;
var current_timeout = undefined;
var max_retry = 5; // Max number of retries to send requests
var auto_first_join = true; // Automatically join the best zone at first
var current_planet_id = undefined;
var current_game_start = undefined; // Timestamp for when the current game started

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
			'<div id="salienbot_gui" style="background: #191919; z-index: 1; border: 3px solid #83d674; padding: 20px; margin: 15px; width: 300px; transform: translate(0, 0);">',
				'<h1><a href="https://github.com/ensingm2/saliengame_idler/">Salien Game Idler</a></h1>',
				'<p style="margin-top: -.8em; font-size: .75em"><span id="salienbot_status"></span></p>', // Running or stopped
				'<p><b>Task:</b> <span id="salienbot_task">Initializing</span></p>', // Current task
				`<p><b>Target Zone:</b> <span id="salienbot_zone">None</span></p>`,
				`<p style="display: none;" id="salienbot_zone_difficulty_div"><b>Zone Difficulty:</b> <span id="salienbot_zone_difficulty"></span></p>`,
				'<p><b>Level:</b> <span id="salienbot_level">' + this.state.level + '</span> &nbsp;&nbsp;&nbsp;&nbsp; <b>EXP:</b> <span id="salienbot_exp">' + this.state.exp + '</span></p>',
				'<p><b>Lvl Up In:</b> <span id="salienbot_esttimlvl"></span></p>',
				'<p><input id="disableAnimsBtn" type="button" onclick="INJECT_disable_animations()" value="Disable Animations"/></p>',
			'</div>'
		].join(''))

		$J('#salien_game_placeholder').append( $statusWindow )
	}

	updateStatus(running) {
		const statusTxt = running ? '<span style="color: green;">✓ Running</span>' : '<span style="color: red;">✗ Stopped</span>';

		$J('#salienbot_status').html(statusTxt);
	}

	updateTask(status, log_to_console) {
		if(log_to_console || log_to_console === undefined)
			console.log(status);
		document.getElementById('salienbot_task').innerText = status;
	}

	updateExp(exp) {
		document.getElementById('salienbot_exp').innerText = exp;
	}

	updateLevel(level) {
		document.getElementById('salienbot_level').innerText = level;
	}

	updateEstimatedTime(secondsLeft) {
		let date = new Date(null);
		date.setSeconds(secondsLeft);
		var result = date.toISOString().substr(11, 8);

		var timeTxt = result.replace(/(\d{2}):(\d{2}):(\d{2})/gm, '$1h $2m $3s');

		document.getElementById('salienbot_esttimlvl').innerText = timeTxt;
	}

	updateZone(zone, progress, difficulty) {
		var printString = zone;
		if(progress !== undefined)
			printString += " (" + (progress * 100).toFixed(2) + "% Complete)"
		if(progress === undefined) {
			$J("#salienbot_zone_difficulty_div").hide();
			difficulty = "";
		}
		else
			$J("#salienbot_zone_difficulty_div").show();

		document.getElementById('salienbot_zone').innerText = printString;
		document.getElementById('salienbot_zone_difficulty').innerText = difficulty;
	}
};

var gui = new BotGUI({
	level: gPlayerInfo.level,
	exp: gPlayerInfo.score
});

function calculateTimeToNextLevel() {
	const missingExp = gPlayerInfo.next_level_score - gPlayerInfo.score;
	const nextScoreAmount = get_max_score(target_zone);
	const roundTime = resend_frequency + update_length;

	const secondsLeft = missingExp / nextScoreAmount * roundTime;

	return secondsLeft;
}

// Grab the user's access token
var INJECT_get_access_token = function() {
	$J.ajax({
		async: false,
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
var INJECT_start_round = function(zone, access_token, attempt_no) {
	if(attempt_no === undefined)
		attempt_no = 0;

	// Leave the game if we're already in one.
	if(current_game_id !== undefined) {
		gui.updateTask("Previous game detected. Ending it.", true);
		INJECT_leave_round();
	}

	// Send the POST to join the game.
	$J.ajax({
		type: "POST",
		url: "https://community.steam-api.com/ITerritoryControlMinigameService/JoinZone/v0001/",
		data: { access_token: access_token, zone_position: zone },
		success: function(data) {
			if( $J.isEmptyObject(data.response) ) {
				if(attempt_no < max_retry) {
					console.log("Error getting zone response:",data);
					gui.updateTask("Waiting 5s and re-sending join attempt(Attempt #" + attempt_no + ").");
					setTimeout(function() { INJECT_start_round(zone, access_token, attempt_no+1); }, 5000);
				}
				else {
					gui.updateTask("Something went wrong attempting to start a round. Please refresh");
					gui.updateStatus(false);
					return;
				}
			}
			else {
				console.log("Round successfully started in zone #" + zone);
				console.log(data);

				// Set target
				target_zone = zone;

				// Update the GUI
				gui.updateStatus(true);
				gui.updateZone(zone, data.response.zone_info.capture_progress, data.response.zone_info.difficulty);
				gui.updateEstimatedTime(calculateTimeToNextLevel())

				current_game_id = data.response.zone_info.gameid;
				current_game_start = new Date().getTime();
				INJECT_wait_for_end(resend_frequency);
			}
		},
		error: function (xhr, ajaxOptions, thrownError) {
			alert("Error starting round: " + xhr.status + ": " + thrownError);
		}
	});
}

// Update time remaining, and wait for the round to complete.
var INJECT_wait_for_end = function(time_remaining) {
	gui.updateTask("Waiting " + time_remaining + "s for round to end", false);

	// Wait
	var wait_time;
	var callback;
	// use absolute timestamps to calculate if the game is over, since setTimeout timings are not always reliable
	if(current_game_start + 1000 * real_round_length < new Date().getTime()) {
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
var INJECT_end_round = function(attempt_no) {
	if(attempt_no === undefined)
		attempt_no = 0;

	// Grab the max score we're allowed to send
	var score = get_max_score();

	// Update gui
	gui.updateTask("Ending Round");

	// Post our "Yay we beat the level" call
	$J.ajax({
		type: "POST",
		url: "https://community.steam-api.com/ITerritoryControlMinigameService/ReportScore/v0001/",
		data: { access_token: access_token, score: score, language: language },
		success: function(data) {
			if( $J.isEmptyObject(data.response) ) {
				if(attempt_no < max_retry) {
					console.log("Error getting zone response:",data);
					gui.updateTask("Waiting 5s and re-sending score(Attempt #" + attempt_no + ").");
					setTimeout(function() { INJECT_end_round(attempt_no+1); }, 5000);
				}
				else {
					gui.updateTask("Something went wrong attempting to send results. Please refresh");
					gui.updateStatus(false);
					return;
				}
			}
			else {
				console.log("Successfully finished the round and got expected data back:");
				console.log("Level: ", data.response.new_level, "\nEXP:   ", data.response.new_score);
				console.log(data);

				gui.updateLevel(data.response.new_level);
				gui.updateExp(data.response.new_score);
				// When we get a new EXP we also want to recalculate the time for next level.
				gui.updateEstimatedTime(calculateTimeToNextLevel())

				// Update the player info in the UI
				INJECT_update_player_info();

				// Update the GUI
				window.gui.updateZone("None");

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

	// Update the GUI
	gui.updateTask("Left Zone #" + target_zone);
	gui.updateStatus(false);

	target_zone = -1;
}

// returns 0 for easy, 1 for medium, 2 for hard
var INJECT_get_difficulty = function(zone_id) {
	return window.gGame.m_State.m_PlanetData.zones[zone_id].difficulty;
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

	gui.updateTask('Updating grid', true);

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

// Defaults to max score of current zone & full round duration if no params are given
function get_max_score(zone, round_duration) {
	// defaults
	if(zone === undefined)
		zone = target_zone;
	if(round_duration === undefined)
		round_duration = real_round_length;

	var difficulty = INJECT_get_difficulty(zone);
	var score = 5 * round_duration * Math.pow(2, (difficulty-1));

	return score;
}

// Get the best zone available
function GetBestZone() {
	var bestZoneIdx;
	var highestDifficulty = -1;

	gui.updateTask('Getting best zone');

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
function SwitchNextZone(attempt_no) {
	if(attempt_no === undefined)
		attempt_no = 0;

	INJECT_leave_round();
	INJECT_update_grid();
	var next_zone = GetBestZone();
	if (next_zone !== undefined) {
		console.log("Found Best Zone: " + next_zone);
		INJECT_start_round(next_zone, access_token, attempt_no);
	} else {
		console.log("There's no more zone, the planet must be completed. You'll need to choose another planet!");
		target_zone = -1;
	}
}

// Leave the planet
var INJECT_leave_planet = function() {
	function wait_for_state_load() {
		if(gGame.m_IsStateLoading || gGame.m_State instanceof CBattleSelectionState)
			setTimeout(function() { wait_for_state_load(); }, 50);
		else
			INJECT_init();
	}

	// Leave our current round if we haven't.
	INJECT_leave_round();

	// (Modified) Default Code
	gAudioManager.PlaySound( 'ui_select_backwards' );
	gServer.LeaveGameInstance(
		gGame.m_State.m_PlanetData.id,
		function() {
			gGame.ChangeState( new CPlanetSelectionState() );
			// Wait for the new state to load, then hook in
			wait_for_state_load();
		}
	);
}

var INJECT_join_planet = function(planet_id, success_callback, error_callback) {
	function wait_for_state_load() {
		if(gGame.m_IsStateLoading || gGame.m_State instanceof CPlanetSelectionState)
			setTimeout(function() { wait_for_state_load(); }, 50);
		else
			INJECT_init();
	}

	// Modified Default code
	var rgParams = {
		id: planet_id,
		access_token: access_token
	};

	$J.ajax({
		url: window.gServer.m_WebAPI.BuildURL( 'ITerritoryControlMinigameService', 'JoinPlanet', true ),
		method: 'POST',
		data: rgParams
	}).success( function( results, textStatus, request ) {
		if ( request.getResponseHeader( 'x-eresult' ) == 1 ) {
			success_callback( results );
			// Wait for the new state to load, then hook in
			wait_for_state_load();
		}
		else {
			console.log(results, textStatus, request);
			error_callback();
		}
	}).fail( error_callback );
}
var INJECT_init_battle_selection = function() {
	gui.updateStatus(true);
	gui.updateTask("Initializing Battle Selection Menu.");
	// Auto join best zone at first
	if (auto_first_join == true) {
		firstJoin();
		function firstJoin() {
			// Wait for state & access_token
			if(access_token === undefined || gGame === undefined || gGame.m_IsStateLoading || gGame.m_State instanceof CPlanetSelectionState) {
				setTimeout(function() { firstJoin(); }, 100);
				console.log("waiting");
				return;
			}

			current_planet_id = window.gGame.m_State.m_PlanetData.id;

			var first_zone;
			if(target_zone === -1)
				first_zone = GetBestZone();
			else
				first_zone = target_zone

			if(access_token === undefined)
				INJECT_get_access_token();

			INJECT_start_round(first_zone, access_token);
		}
	}

	// Overwrite join function so clicking on a grid square will run our code instead
	gServer.JoinZone = function (zone_id, callback, error_callback) {
		current_planet_id = window.gGame.m_State.m_PlanetData.id;
		INJECT_start_round(zone_id, access_token);
	}

	// Hook the Grid click function
	var grid_click_default = gGame.m_State.m_Grid.click;
	gGame.m_State.m_Grid.click = function(tileX, tileY) {
		// Get the selected zone ID
		var zoneIdx = _GetTileIdx( tileX, tileY );

		// Return if it's the current zone (Don't want clicking on same zone to leave/rejoin)
		if(target_zone === zoneIdx)
			return;

		// Return if it's a completed zone
		if(window.gGame.m_State.m_Grid.m_Tiles[zoneIdx].Info.captured) {
			console.log("Manually selected zone already captured. Returning.");
			return;
		}

		// Update the GUI
		gui.updateTask("Attempting manual switch to Zone #" + zoneIdx);

		// Leave existing round
		INJECT_leave_round();

		// Join new round
		INJECT_start_round(zoneIdx, access_token);
	}

	// Hook the Leave Planet Button
	gGame.m_State.m_LeaveButton.click = function(btn) {
		INJECT_leave_planet();
	};
}

var INJECT_init_planet_selection = function() {
	gui.updateStatus(true);
	gui.updateTask("Initializing Planet Selection Menu.");

	// Hook the Join Planet Function
	gServer.JoinPlanet = function(planet_id, success_callback, error_callback) {
		INJECT_join_planet(planet_id, success_callback, error_callback);
	}

	// Update GUI
	gui.updateStatus(false);
	gui.updateTask("At Planet Selection");
	gui.updateZone("None");
};

var INJECT_init = function() {
	if (gGame.m_State instanceof CBattleSelectionState)
		INJECT_init_battle_selection();
	else if (gGame.m_State instanceof CPlanetSelectionState)
		INJECT_init_planet_selection();
};

var INJECT_disable_animations = function() {
	var confirmed = confirm("Disabling animations will vastly reduce resources used, but you will no longer be able to manually swap zones until you refresh. Continue?");

	if(confirmed) {
		requestAnimationFrame = function(){};
		$J("#disableAnimsBtn").prop("disabled",true).prop("value", "Animations Disabled.");
	}
};

// ============= CODE THAT AUTORUNS ON LOAD =============
// Auto-grab the access token
INJECT_get_access_token();

// Run the global initializer, which will call the function for whichever screen you're in
INJECT_init();
