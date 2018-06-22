// This is the zone you want to attack.
var target_zone = -1;

// Variables. Don't change these unless you know what you're doing.
var max_scores = [600, 1200, 2400] // Max scores for each difficulty (easy(5), medium(10), hard(20) *120)
var round_length = 120; // Round Length (In Seconds)
var update_length = 15; // How long to wait between updates (In Seconds)
var loop_rounds = true;
var language = "english"; // Used when POSTing scores
var access_token = "";
var current_game_id = undefined;
var current_timeout = undefined;

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
			current_game_id = data.response.zone_info.gameid;
			INJECT_wait_for_end(round_length);
		},
		error: function (xhr, ajaxOptions, thrownError) {
			alert("Error starting round: " + xhr.status + ": " + thrownError);
		}
	});
}

// Update time remaining, and wait for the round to complete.
var INJECT_wait_for_end = function(time_remaining) {
	// Log to console
	console.log("Time remaining in round: " + time_remaining + "s");

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
				console.log("Empty Response. Waiting 5s and trying again.")
				current_timeout = setTimeout(function() { INJECT_end_round(); }, 5000);
			}
			else {
				console.log("Successfully finished the round and got expected data back:");
				console.log(data);

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
	return gGame.m_State.m_PlanetData.zones[zone_id].difficulty - 1;
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

// Auto-grab the access token
INJECT_get_access_token();

// Overwrite join function so clicking on a grid square will run our code instead
gServer.JoinZone = function (zone_id, callback, error_callback) {
	target_zone = zone_id;
	INJECT_start_round(zone_id, access_token);
}
