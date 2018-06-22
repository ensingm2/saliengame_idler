# Ensingm2 Salien Game Idler

### Intro
Hey everyone, Like all of you, I was interested in "streamlining" the process of the 2018 Steam sale 'Salien' minigame. You may or may not remember me as a contributor/dev in the Steam Monster Minigame autoclicking scene from the 2015 Steam sale. I took a look at this year's game, and noticed it's much more... boring. No interactions between other players mean there are only a few interactions with the server, and they can be easily spoofed, as long as you wait out the timer of the round, and only send the maximum allowed score for a zone. So I figured, why automate the game at all? Much easier to just sit at the menu and just say we beat the level.

### Features
* Does not need to run the game at all, works from the main map.
* Fast switching between zones.
* Will automatically send the maximum score allowed (to my knowledge) for each zone difficulty.
* Automatically restarts runs after completion.

### How to Run
**Currently tested on Chrome, Firefox and Safari. The following guide is for Chrome only**

1. Open the Salien Game in a new tab and select a planet.
2. Bring up the JavaScript Console
   1. Windows: F12 or CTRL+Shift+J
   1. Mac: Command+Option+J
3. Copy the JavaScript code from [idle.js](idle.js) and paste it into the console and press enter
   1. Output can be seen and tracked in the console

Note: The script may also be setup on userscript managers such as Greasemonkey/Tampermonkey however this is advised against due to security matters.

#### ***THERE IS CURRENTLY NO GRAPHICAL OUTPUT IN THIS VERSION, CHECK THE CONSOLE TO VERIFY IF IT IS WORKING***

### TO DO
* Add automated switching of zones when they are completed, prioritize by difficulty for extra points
* Add some kind of UI to display status
* Update player information window between runs

### Want to Contribute?
Feel free. You can submit whatever changes you'd like. Fork, PR, whatever. Go nuts.
