# Ensingm2 Salien Game Idler

[Link to Saliens Game](https://steamcommunity.com/saliengame/play)

## NOTE: DOES NOT CURRENTLY SUPPORT BOSS ZONES

### Intro
Hey everyone, Like all of you, I was interested in "streamlining" the process of the 2018 Steam sale 'Salien' minigame. You may or may not remember me as a contributor/dev in the Steam Monster Minigame autoclicking scene from the 2015 Steam sale. I took a look at this year's game, and noticed it's much more... boring. No interactions between other players mean there are only a few interactions with the server, and they can be easily spoofed, as long as you wait out the timer of the round, and only send the maximum allowed score for a zone. So I figured, why automate the game at all? Much easier to just sit at the menu and just say we beat the level.

**JUNE 30 Boss Update:** I'm currently on vacation and will not likely be able to make major additions/changes to this script (boss update, etc), but can bugfix & merge in pull requests from other people periodically, if you would like to contribute. A big thanks to [Harest](https://github.com/Harest) specifically, for all of the additions they've made so far (Including the entirety of the planet/zone auto-switch component). I've made them a collaborator, and are able to update as needed.

### Features
* Does not need to run the minigame at all, works from the main map.
* Automatic switching between zones & planets for maximum experience.
* Easy & quick zone/planet override with the default map.
* Sends the maximum score allowed for each zone difficulty.
* Automatically repeats runs after completion.
* Optionally disables game animations & hides the game UI to minimize resource usage.
* Status GUI to update level, experience, time remaining in round, etc

### How to Run
**Currently tested on Chrome/Chromium, Firefox and Safari. Internet Explorer and Edge both encounter errors. The following guide is for Chrome:**

1. Open the Salien Game in a new tab (Any view of the game is fine, main menu, planet, or zone selector)
2. Bring up the JavaScript Console
   * Windows: F12 or CTRL+Shift+J
   * Mac: Command+Option+J
3. Copy the JavaScript code from [idle.js](https://raw.githubusercontent.com/ensingm2/saliengame_idler/master/idle.js), paste it into the console and press enter
   * Output can be seen and tracked in the console, and a "Salien Game Idler" GUI should be displayed on-screen.

Note: The script may also be set up on userscript managers such as Tampermonkey, however we advise against enabling automatic updates for _*any*_ scripts, for your own security, and have disabled automatic updates by default.

### TO DO
* Add support for boss zones
* I have a feeling the game will evolve over time, so handle things as they come.
* Any other cool features, with support from viewers like you!

### Want to Contribute?
Feel free. You can submit whatever changes you'd like. Fork, PR, whatever. Go nuts.
