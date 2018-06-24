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
var current_game_start = undefined; // Timestamp for when the current game started
var time_passed_ms = 0;
var current_timeout = undefined;
var max_retry = 5; // Max number of retries to send requests
var auto_first_join = true; // Automatically join the best zone at first
var current_planet_id = undefined;
var auto_switch_planet = {
	"active": false, // Automatically switch to the best planet available (true : yes, false : no)
	"current_difficulty": undefined,
	"wanted_difficulty": 3, // Difficulty prefered. Will check planets if the current one differs
	"rounds_before_check": 5, // If we're not in a wanted difficulty zone, we start a planets check in this amount of rounds
	"current_round": 0,
	"coeffScore": {
		1: 1,
		2: 100,
		3: 10000
	}
};

class BotGUI {
	constructor(state) {
		console.log('GUI Has been created');

		this.state = state;
		
		this.createStatusWindow();
		this.createProgressBar();
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

	createProgressBar() {
		this.progressbar = new CProgressBar(63);
		this.progressbar.x = 2
		this.progressbar.y = 48
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
		else {
			$J("#salienbot_zone_difficulty_div").show();
			gGame.m_State.m_Grid.m_Tiles[target_zone].addChild(this.progressbar)
		}

		document.getElementById('salienbot_zone').innerText = printString;
		document.getElementById('salienbot_zone_difficulty').innerText = difficulty;
	}
};

var gui = new BotGUI({
	level: gPlayerInfo.level,
	exp: gPlayerInfo.score
});

function calculateTimeToNextLevel() {	
	const nextScoreAmount = get_max_score(target_zone);
	const missingExp = Math.ceil((gPlayerInfo.next_level_score - gPlayerInfo.score) / nextScoreAmount) * nextScoreAmount;
	const roundTime = resend_frequency + update_length;

	const secondsLeft = missingExp / nextScoreAmount * roundTime - time_passed_ms / 1000;

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
		async: false,
		type: "POST",
		url: "https://community.steam-api.com/ITerritoryControlMinigameService/JoinZone/v0001/",
		data: { access_token: access_token, zone_position: zone },
		success: function(data) {
			if( $J.isEmptyObject(data.response) ) {
				// Check if the zone is completed
				INJECT_update_grid();
				if(window.gGame.m_State.m_Grid.m_Tiles[target_zone].Info.captured || attempt_no >= max_retry) {
					if (auto_switch_planet.active == true)
						CheckSwitchBetterPlanet();
					else
						SwitchNextZone();
				}
				else {
					console.log("Error getting zone response:",data);
					gui.updateTask("Waiting 5s and re-sending join attempt(Attempt #" + attempt_no + ").");
					setTimeout(function() { INJECT_start_round(zone, access_token, attempt_no+1); }, 5000);
				}
			}
			else {
				console.log("Round successfully started in zone #" + zone);
				console.log(data);

				// Set target
				target_zone = zone;

				if (auto_switch_planet.active == true) {
					if (auto_switch_planet.current_difficulty != data.response.zone_info.difficulty)
						auto_switch_planet.current_round = 0; // Difficulty changed, reset rounds counter before new planet check
					auto_switch_planet.current_difficulty = data.response.zone_info.difficulty;
					if (auto_switch_planet.current_difficulty < auto_switch_planet.wanted_difficulty) {
						if (auto_switch_planet.current_round >= auto_switch_planet.rounds_before_check) {
							auto_switch_planet.current_round = 0;
							CheckSwitchBetterPlanet(true);
						} else {
							auto_switch_planet.current_round++;
						}
					}
				}
				
				// Update the GUI
        		gui.updateStatus(true);
				gui.updateZone(zone, data.response.zone_info.capture_progress, data.response.zone_info.difficulty);
				gui.updateEstimatedTime(calculateTimeToNextLevel());
        
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
var INJECT_wait_for_end = function() {
	var now = new Date().getTime();
	time_passed_ms = now - current_game_start;
	var time_remaining_ms = (resend_frequency*1000) - time_passed_ms;
	var time_remaining = Math.round(time_remaining_ms/1000);

	// Update GUI
	gui.updateTask("Waiting " + Math.max(time_remaining, 0) + "s for round to end", false);
	gui.updateStatus(true);
	gui.updateEstimatedTime(calculateTimeToNextLevel())
	gui.progressbar.SetValue(time_passed_ms/(resend_frequency*1000))

	// Wait
	var wait_time = update_length*1000;;
	var callback;
	
	// use absolute timestamps to calculate if the game is over, since setTimeout timings are not always reliable
	if(time_remaining_ms <= 0) {
		callback = function() { INJECT_end_round(); };
	}
	else { 
		callback = function() { INJECT_wait_for_end(); };
	}
	
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
		async: false,
		type: "POST",
		url: "https://community.steam-api.com/ITerritoryControlMinigameService/ReportScore/v0001/",
		data: { access_token: access_token, score: score, language: language },
		success: function(data) {
			if( $J.isEmptyObject(data.response) ) {
				// Check if the zone is completed
				INJECT_update_grid();
				if(window.gGame.m_State.m_Grid.m_Tiles[target_zone].Info.captured || attempt_no >= max_retry) {
					if (auto_switch_planet.active == true)
						CheckSwitchBetterPlanet();
					else
						SwitchNextZone();
				}
				else {
					console.log("Error getting zone response:",data);
					gui.updateTask("Waiting 5s and re-sending score(Attempt #" + attempt_no + ").");
					setTimeout(function() { INJECT_end_round(attempt_no+1); }, 5000);
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
				window.gGame.m_State.m_Grid.m_Tiles[zone.zone_position].Info.difficulty = zone.difficulty; 
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

// Get the best planet available
function GetBestPlanet() {
	var bestPlanetId = undefined;
	var activePlanetsScore = [];
	var maxScore = 0;
	var numberErrors = 0;
	
	gui.updateStatus('Getting best planet');
	
	// GET to the endpoint
	$J.ajax({
		async: false,
		type: "GET",
		url: "https://community.steam-api.com/ITerritoryControlMinigameService/GetPlanets/v0001/",
		success: function(data) {
			data.response.planets.forEach( function(planet) {
				if (planet.state.active == true && planet.state.captured == false)
					activePlanetsScore[planet.id] = 0;
			});
		}
	});
	
	// GET the score of each active planet
	Object.keys(activePlanetsScore).forEach ( function (planet_id) {
		// GET to the endpoint
		$J.ajax({
			async: false,
			type: "GET",
			url: "https://community.steam-api.com/ITerritoryControlMinigameService/GetPlanet/v0001/",
			data: { id: planet_id },
			success: function(data) {
				data.response.planets[0].zones.forEach( function ( zone ) {
					if (zone.difficulty >= 1 && zone.difficulty <= 3 && zone.captured == false)
						activePlanetsScore[planet_id] += Math.ceil(auto_switch_planet["coeffScore"][zone.difficulty] * (1 - zone.capture_progress));
				});
			},
			error: function() {
				numberErrors++;
			}
		});
		if (activePlanetsScore[planet_id] > maxScore) {
			maxScore = activePlanetsScore[planet_id];
			bestPlanetId = planet_id;
		}
	});
	console.log(activePlanetsScore);
	// Prevent a planet switch if there were >= 2 errors while fetching planets or if there's an error while fetching the current planet score
	if (numberErrors >= 2 || ((current_planet_id in activePlanetsScore) && activePlanetsScore[current_planet_id] == 0))
		return null;
	
	return bestPlanetId;
}

// Switch to the next zone when one is completed
function SwitchNextZone(attempt_no, planet_call) {
	if(attempt_no === undefined)
		attempt_no = 0;
	if (planet_call === undefined)
		planet_call = false;
	INJECT_update_grid();
	var next_zone = GetBestZone();
	if (next_zone !== undefined) {
		if (next_zone != target_zone) {
			console.log("Found new best zone: " + next_zone);
			INJECT_start_round(next_zone, access_token, attempt_no);
		} else {
			console.log("Current zone #" + target_zone + " is already the best. No need to switch.");
			if (planet_call === true)
				INJECT_start_round(target_zone, access_token, attempt_no);
		}
	} else {
		if (auto_switch_planet.active == true) {
			console.log("There are no more zones, the planet must be completed. Searching a new one.");
			CheckSwitchBetterPlanet();
		} else {
			INJECT_leave_round();
			INJECT_update_grid();
			console.log("There are no more zones, the planet must be completed. You'll need to choose another planet!");
			target_zone = -1;
			INJECT_leave_planet();
		}
	}
}

// Check & switch for a potentially better planet, start to the best available zone
function CheckSwitchBetterPlanet(difficulty_call) {
	if (difficulty_call === undefined)
		difficulty_call = false;
	var best_planet = GetBestPlanet();
	if (best_planet !== undefined && best_planet !== null && best_planet !== current_planet_id) {
		console.log("Planet #" + best_planet + " has higher XP potential. Switching to it. Bye planet #" + current_planet_id);
		INJECT_switch_planet(best_planet, function() {
			target_zone = GetBestZone();
			INJECT_start_round(target_zone, access_token);
		});
	} else if (best_planet == current_planet_id) {
		SwitchNextZone(0, difficulty_call);
	} else if (best_planet === null) {
		console.log("Too many errors while searching a better planet. Let's continue on the current zone.");
		INJECT_start_round(target_zone, access_token);
	} else {
		console.log("There's no planet better than the current one.");
	}
}

var INJECT_switch_planet = function(planet_id, callback) {
	// ONLY usable from battle selection
	if(!(gGame.m_State instanceof CBattleSelectionState))
		return;

	gui.updateTask("Attempting to move to Planet #" + planet_id);

	function wait_for_state_load() {
		if(gGame.m_IsStateLoading || gGame.m_State instanceof CPlanetSelectionState)
			setTimeout(function() { wait_for_state_load(); }, 50);
		else
			callback();
	}

	// Leave our current round if we haven't.
	INJECT_leave_round();

	// Leave the planet
	INJECT_leave_planet(function() {

		// Make sure the planet_id is valid (or we'll error out)
		var valid_planets = gGame.m_State.m_rgPlanets;
		var found = false;
		for(var i=0; i<valid_planets.length; i++)
			if (valid_planets[i].id == planet_id)
					found = true;
		if(!found) {
			gui.updateTask("Attempted to switch to an invalid planet. Please choose a new one.");
			gui.updateStatus(false);
			return;
		}

		// Join Planet
		INJECT_join_planet(planet_id,
			function ( response ) {
				gGame.ChangeState( new CBattleSelectionState( planet_id ) );
				wait_for_state_load();
			},
			function ( response ) {
				ShowAlertDialog( 'Join Planet Error', 'Failed to join planet.  Please reload your game or try again shortly.' );
			});
	});

}

// Leave the planet
var INJECT_leave_planet = function(callback) {
	if(typeof callback !== 'function')
		callback = function() {};

	function wait_for_state_load() {
		if(gGame.m_IsStateLoading || gGame.m_State instanceof CBattleSelectionState)
			setTimeout(function() { wait_for_state_load(); }, 50);
		else {
			// Clear the current planet ID var
			current_planet_id = undefined;

			INJECT_init();
			callback();
		}
	}

	// Cancel timeouts
	clearTimeout(current_timeout);

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
	if(typeof success_callback !== 'function')
		success_callback = function() {};
	if(typeof error_callback !== 'function')
		error_callback = function() {};
	function wait_for_state_load() {
		if(gGame.m_IsStateLoading || gGame.m_State instanceof CPlanetSelectionState)
			setTimeout(function() { wait_for_state_load(); }, 50);
		else {
			current_planet_id = planet_id;
			INJECT_init();
		}
	}

	// Modified Default code
	var rgParams = {
		id: planet_id,
		access_token: access_token
	};

	$J.ajax({
		async: false,
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
		gui.progressbar.parent.removeChild(gui.progressbar)

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
