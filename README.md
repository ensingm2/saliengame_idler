# Ensingm2 Salien Game Idler

### Intro
Hey everyone, Like all of you, I was interested in "streamlining" the process of the 2018 Steam sale 'Salien' minigame. You may or may not remember me as a contributor/dev in the Steam Monster Minigame autoclicking scene from the 2015 Steam sale. I took a look at this year's game, and noticed it's much more... boring. No interactions between other players mean there are only a few interactions with the server, and they can be easily spoofed, as long as you wait out the timer of the round, and only send the maximum allowed score for a zone. So I figured, why automate the game at all? Much easier to just sit at the menu and just say we beat the level.

### Features
* Does not need to run the game at all, works from the main map.
* Fast switching between zones.
* Will automatically send the maximum score allowed (to my knowledge) for each zone difficulty.
* Automatically restarts runs after completion.

### How to Run
Simply paste the Javascript code in your console while on the Game page. You can also set up Greasemonkey/etc scripts as the others do, but I'm not a fan of those myself, for security reasons.

The game will hook into the main menu, and automatically send requests every 120 seconds (the length of a round) for whichever zone you click on. Output can be seen in the console, for those who want it. **Tested in Chrome only, currently**

#### ***THERE IS CURRENTLY NO GRAPHICAL OUTPUT IN THIS VERSION, CHECK THE CONSOLE TO VERIFY IF IT IS WORKING***

### TODO
* Add automated switching of zones when they are completed, prioritize by difficulty for extra points
* Add some kind of UI to display status
* Update player information window between runs

### Want to Contribute?
Feel free. You can submit whatever changes you'd like. Fork, PR, whatever. Go nuts.