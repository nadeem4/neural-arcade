# Neural Arcade

Small browser games where tiny neural networks learn in front of you, and the player is part of the training loop. Each game teaches one machine learning idea, and each comes with an illustrated "How it works" write-up.

**Live: https://arcade.codewithnk.com**

## Experiments

| Experiment | Play it | Read how it works | What it teaches |
|---|---|---|---|
| **Neural Racer** | [Play](https://arcade.codewithnk.com/games/racer/) | [How it works](https://arcade.codewithnk.com/games/racer/how-it-works/) | Learning from a score: fitness, selection, crossover, mutation, overfitting |
| **Teach by Driving** | [Play](https://arcade.codewithnk.com/games/teach/) | [How it works](https://arcade.codewithnk.com/games/teach/how-it-works/) | Learning from examples: training data, loss, gradient descent, learning rate, distribution shift |
| **Coin Runner** | [Play](https://arcade.codewithnk.com/games/runner/) | [How it works](https://arcade.codewithnk.com/games/runner/how-it-works/) | Learning from reward: trial and error, exploration, policy gradients, reward hacking |
| **Balance** | [Play](https://arcade.codewithnk.com/games/balance/) | [How it works](https://arcade.codewithnk.com/games/balance/how-it-works/) | Physical AI: feedback control, PID, evolution, disturbances |

The home page shows the newest game as a recorded demo, then groups games into categories. **How AI learns** holds the first three: the three ways a brain gets better (breeding by score, copying examples, trial and error from reward). The first two are a pair: the same car, track and senses, with the brain's numbers set two different ways. **Physical AI** holds Balance, a cart-pole kept upright by feedback: a person, a PID controller or a small net that evolves. The home hero is the newest game that has a YouTube explainer and a `demo` (today Balance), else the newest game with a `demo`, so a new game without a video never replaces it. The recorded run under the hero follows it: its words come from the game's `demo` block in `assets/games.js` and its drawing from `games/<name>/demo.js`. For now the arcade has two categories.

### Neural Racer (`games/racer/`)
10 cars, each driven by a 6→8→2 network (74 weights), learn to lap a track by neuroevolution. Cars start on a grid, in rows of five behind the start line, and every car's distance is measured from the line itself. With the default 10 cars, each round the best car is kept, 8 children are bred from the top 3 and 1 random newcomer joins.
- **Experiment brief:** above the track, three short lines state the setup, the rule and what to watch for.
- **How it works** (`games/racer/how-it-works/`): an illustrated write-up, linked from the race page's Play / Watch / How it works switch and its write-up section. It explains what a car senses, what its brain is, how a round is ranked and how children are bred, then shows the best car of each generation improving. Every figure is drawn live from one seeded run of the real simulation (seed 307, recorded by `story-data.js`), so the pictures always match the text. A collapsed section gives practitioners the exact network, fitness, selection and mutation settings.
- **Last round card:** under the controls, updated the moment each round ends without stopping the race: every car ranked by distance with its role (kept, parent, no children), and one child's genes shown coming from its two parents, with mutated genes marked.
- **Ghost race:** replays the best brain of generation 1 against the latest best on the current track.
- **Levers:** speed, follow leader, population (5, 10, 20 or 50 cars; kept cars and newcomers scale at 10%, the parent pool at 30%), mutation rate, new track (tests overfitting), restart.
- **Phone-first layout:** on narrow screens the page reads top to bottom as track, live numbers, the How it works link, controls, brain, then results.
- **Panels:** live readouts (still driving, e.g. "7 of 10"; furthest car, e.g. "0.42 of 2 laps"), the leader's family tree, its brain (inputs and outputs also described in words) and how many cars finished per generation. Each has an (i) button that opens a short plain-language explanation under it.
- **Lucky first round:** a random brain finishes in generation 1 about one run in five. The commentary says so ("a random brain got lucky") instead of calling it learning.

### Teach by Driving (`games/teach/`)
You steer: slide a thumb sideways on the track (the further, the harder it turns), or hold the Left/Right buttons, arrow keys or A/D. The car holds a slow cruising speed (1.5), full steering is 60% of the racer's turn rate, and the road is 85 wide (the racer's is 54) with bends at 70% strength, so it can be driven with two buttons. Every visit starts on the same track (the write-up's, `LESSON_SEED` in `story-data.js`); New track gives random ones. While a car is moving, the camera is a driver's view: zoomed 3×, turned so the car always points up (Left always turns left on screen), with a whole-track map in the corner and a steering gauge along the bottom. The brain is a 6→8→1 network (65 weights): the same six senses as the racer, one output for steering.
1. **You drive** one lap (about 14 seconds, about 850 examples). Every frame becomes one example: the six senses, and your (smoothed) steering. A crash throws that attempt away, so it never learns to crash.
2. **It learns:** 40 passes of mini-batch gradient descent (backpropagation, batches of 32) on your examples. The loss chart starts from the untrained brain's loss, and the brain panel shows its weights changing.
3. **It drives** two laps on its own, first on your track. Two clean laps there move it to a track it has never seen, the real test: did it learn to drive, or only your track? Two clean laps on that one and it parks ("Done"). Where it crashes, a red cross stays on the track (and on the map) and it goes again from the start; with the same brain and track it crashes in the same place, so you can take the wheel just before the cross (hold Left/Right or slide on the track). Those moments are added as new examples, and Retrain (30 more passes) learns from them.
- **Steering buttons:** a line above them always says what they do: steer while you teach, "Take the wheel" (in ink) while the brain drives. While it learns, while a caption announces the next step, between drives and once it is done they are disabled, and the line says why.
- **No step starts unannounced:** a caption on the track says what just happened and what comes next, and stays for 2.5 seconds before the next step starts ("Lap complete! Next, step 2: it learns from your 850 examples.", then "Step 2: learning. Pass 12 of 40", then "Step 3: now it drives on its own…", and after each of its drives "It crashed at the red cross…", "Two laps on your track. Now the real test…" or "Done: two laps on a track it never saw…"). The wording lives in `games/teach/words.js`.
- **Levers:** learning rate (0.002 to 3, with what each does; changing it after it has learned relearns your same examples from a fresh brain, back on your track, so rates can be compared), New track (at step 1, a new track to teach on; later, another unseen track for the same brain), Drive again (back to step 1 with a fresh brain and no examples).
- **Panels:** examples, loss and distance readouts; its brain, with "You: … · Its guess: …" while you drive; the loss per pass. Every one has an (i) explanation.
- **How it works** (`games/teach/how-it-works/`): examples, loss, one weight's loss hill with a ball rolling down it, backpropagation, the copied brain crashing where the teacher never drove (distribution shift), corrections that fix it (DAgger-style), and three learning rates. Every figure is drawn from one seeded lesson (track `LESSON_SEED` = 10, recorded by `games/teach/story-data.js`) whose teaching lap is driven by a stand-in autopilot; the page says so.
- Testing aid: add `?autopilot` to the game's URL and the stand-in teacher drives the teaching lap.

### Coin Runner (`games/runner/`)
A hero that has never played learns a short side-scrolling level (two pits, a step, five coins, a coin block above the start, one walking enemy, a flag) by trial and error from points. Nobody shows it what to do. The player sets what earns points, and it learns whatever earns the most, including loopholes.
- **Brain:** 12 senses (pits 1 to 3 tiles ahead, wall ahead, enemy distance and presence, on the ground, rising or falling, under the block, block ready, how far through the level, time left), 8 hidden neurons, 4 moves (wait, run, leap, jump), 140 weights. Outputs become chances and it rolls the dice for a move about 8 times a second; the randomness is its exploration.
- **Learning:** REINFORCE (a policy gradient) with a learned value baseline, in `engine/reinforce.js`: every 12 tries, moves that led to more points than expected become more likely. Tries end at the flag, on death, or after 20 seconds.
- **Rules (the lever):** five sliders, every one visible: reaching the flag, each coin, each new tile forward, dying, each second alive (a cost or a payment). Three ready-made sets: **Balanced** (learns to finish), **Coin hungry** (learns to bump the block forever), **Afraid of dying** (learns never to move). Changing the rules starts a fresh brain. Once most recent tries use a loophole, a line under the chart says so and names it: reward hacking.
- **Practice speed:** one try plays at real speed while more run unseen in the background (0, 5 or 30 a second, at most 6 ms a frame), all learning into the same brain. At 30 a second it learns to finish in about a minute.
- **Play it yourself:** the "Play it yourself" button starts one try by hand on the same level, physics and scoring as the AI: arrows, WASD or Space on a keyboard, or on-screen left, right and jump buttons on touch screens. Pressing it scrolls the level into view and opens a start card (controls as key caps, your current rules as signed points so a negative score is explainable (no key list on touch screens); Start, Enter, Space or any control key begins), then a 3-2-1 countdown, then the try, with a score, coins and seconds-left readout on the level. An end card compares your try with the AI's best so far, adds one line on why they differ (`whyNote` in `words.js`), and offers Play again or Back to the AI. While you play, the stage button reads "Back to the AI", so you can switch back at any point without finishing the try (Esc does the same). The stage plate reads "You are playing" or "AI is playing", and while you play the level caption is hidden and the narration says the AI is paused and how many tries it has had. The AI's learning stays paused (your moves never reach the trainer) until you go back to it. Your try is scored with the current rules. Changing the rules or pressing New brain cancels your try. While you play, a small full screen icon appears at the top right of the level (where the browser supports it, not iPhone Safari); leaving play mode leaves full screen too.
- **Night level:** in the dark theme the level is recoloured as a night (navy sky, a fixed scatter of twinkling stars, dimmed hills; `skyFor` in `render.js`), with no extra art; ground, hero, enemy and coins stay in colour, and the lamp button repaints it. The light theme draws the day level as before.
- **Sound:** an icon-only speaker button (with an (i) explanation) in the stage head, next to Play it yourself. It plays short sound effects generated with Web Audio in `games/runner/sfx.js`, one per event: a rising boing for a jump, a ding for a ground coin, a different pling for a coin block bump, a low thump for a stomped enemy, a falling buzz for dying and a short fanfare for the flag (landing is silent). They play only for the try on screen: full volume for your own try, about 40% while the AI plays, never for unseen background tries, and the same sound is limited to once per 80 ms. There are no audio files. It is muted by default, starts only after a click or key press (browser rules), stops while the tab is hidden, remembers the choice in `localStorage` under `na-sound` (storage errors are ignored), and the button is hidden where Web Audio is missing.
- **Panels:** tries, score and coins readouts; its brain with each move's chance; how tries end, one stacked bar per 50 tries (amber reached the flag, red died, grey ran out of time). Every one has an (i) explanation.
- **Art:** Kenney's Pixel Platformer (CC0) in `games/runner/art/`, drawn at 288 x 180 and scaled up so pixels stay crisp. Dust, coin pops, squash and stretch and a small shake are drawing only (`render.js`); they never touch the simulation.
- **Tested promise:** `tests/runner-presets.test.js` trains 20 random brains per rule set (about 90 s): Balanced finishes on at least 18, both loopholes appear on all 20.
- **How it works** (`games/runner/how-it-works/`): the third way to learn, senses and moves, rolling the dice, credit for points, watching it learn, three rule sets side by side, real reward-hacking cases, honest notes. Its figures come from `story.json`: three seeded runs (seed 1000) recorded by `node games/runner/story-data.js`; a test re-records them and checks the file still matches.

### Balance (`games/balance/`)
A cart on a rail with a pole hinged on top; the pole falls unless the cart moves under it. Four controllers try to keep it up for 20 s, and you can shove the cart with Push and Wind.
- **Cart-pole:** the classic equations in `sim.js` (no DOM): gravity 9.8, cart 1 kg, pole 0.1 kg, half-pole 1 m, force up to 10 N, 60 steps a second, a try ends when the pole tips past 0.4 rad, the cart leaves the 2.4 m rail, or 20 s pass. Everything else (PID, AI, tries) is built on it.
- **Four controllers:** **You** (arrow keys or A and D, a held key pushes 40% of full force via `HUMAN_POWER`; the pole is frozen until your first key; a fall ends the try and it waits for the next key), **PID** (three dials: P 0-60 default 25, I 0-30 default 0, D 0-10 default 0) and **Tuned PID** (the same formula and dials, but evolution sets them: a genome of 3 numbers that `tune.js` squashes into the dial ranges and rounds to each dial's step, so what is shown is what ran) and **AI** (a 4-6-1 tanh net, 37 weights, reads cart position, speed, pole angle and spin, and outputs one push).
- **PID with cart centring:** the pole is asked to hold a small lean, set from the cart's position and speed (`K_X`, `K_V`, capped at `CENTER_MAX`), so the cart does not wander off. With P alone it wobbles; D calms it; with Wind on and I at 0 it parks off-centre; raising I returns it (the I memory is capped by `I_MAX`). Each try starts a fresh PID memory.
- **Push and Wind:** Push kicks the cart's speed by 0.8 m/s, right then left on each press, in every mode. Wind is a steady 0.6 N sideways force; turning it on resets nothing. The AI never practises with Wind.
- **AI:** evolution (`ai.js`): 20 brains a generation, the best 3 kept, 3 fresh random newcomers, the rest bred and mutated, each scored on 2 tries with random pushes. Training runs unseen in the background at 2 or 10 generations a second (or paused) in every mode, never with Wind; the stage shows the best brain so far. A fresh random brain falls at once, and the best brain first holds the full 20 s within about 10-30 generations. Restart training throws away both the AI and the tuned dials and starts both again.
- **Tuned PID:** `tune.js` (no DOM) runs the same kind of evolution over the three dials: 20 candidates, the best 3 kept, each scored by averaging one shove test (random pushes) and one wind test (steady wind) over 2 tries; in the wind test only steps with the cart within `CENTRE_BAND` of the middle count, so I pays off. It starts with the dials near zero (`INIT_OFFSET`), trains in the background beside the AI under one time budget and the same speed and pause buttons, and the stage plays the best dials so far. The dials are shown moving and cannot be dragged. In Tuned PID the brain card shows the formula (`push = 58 × lean + ...`) with the numbers it is using now, and Use these dials copies the current dials into PID and switches there. The teaching line: PID is a person writing the formula and setting the dials, Tuned PID is a person writing the formula and evolution setting the dials, AI is no formula with evolution setting 37 weights.
- **Panels:** up-for time, best time and AI generation readouts; the best brain's network drawn live with what each input and the output say right now; a bar chart with one bar per generation (seconds the best brain stayed up, dashed line at 20 s) and a line under it that says when it first held 20 s. Every one has an (i) explanation.
- **Touch bar:** left and right buttons under the stage, shown only on a coarse pointer and only in You mode.
- **Tested promises:** `tests/balance-tune.test.js` (evolution finds good dials, I rises because the wind test pays for it) and `tests/balance-pid.test.js` (P alone wobbles, D calms it, Wind leaves a steady error that I removes) and `tests/balance-ai.test.js` (a random brain falls, evolution learns to balance within a few dozen generations from several seeds).
- **How it works** (`games/balance/how-it-works/`): seven short sections (constant correction, P, D, I, evolution, evolution can tune the dials too, what it has and has not learned) with seven figures. All but the live replay in Fig. 1 are drawn from `games/balance/story.json`: seed `STORY_SEED`, recorded by `node games/balance/story-data.js`; a test re-records it and compares. Traces are sampled every 3 steps (`every`); the P and D traces cover 10 s but the wind traces cover 20 s, so the charts size their time axis from the data. The AI history runs to the first full-20 s generation plus 5 more, and the fresh, early and late genomes are stored. `story.json` also holds a 30-generation tuned-PID run (`TUNER_STORY_SEED`: the best dials and seconds per generation) behind Fig. 7. Fig. 1 replays the late genome on the real sim.
- **Share banner and video:** Balance's explainer video is `ui3l3xSUZ4U` in `assets/games.js`. Its banner, `games/balance/share.png`, is the video thumbnail.

## Run locally

```
npm install
npm run dev     # serves the site at http://localhost:4173
npm test        # engine and simulation tests (Vitest)
```

There is no build step. Pages are plain HTML, CSS and JavaScript ES modules.

## Layout

```
index.html              arcade home, rendered from assets/games.js: hero (newest game with a video and a demo), that game's recorded run (words from its `demo` config, drawn by its `games/<name>/demo.js`), categories, chips
about/                  the About page
games/index.html        browse every game: search, category chips, sort, pager (assets/browse.js)
category/index.html     one category page, /category/?c=<id> (assets/category.js)
assets/                 shared styles (studio.css, game.css), theme helper, self-hosted fonts (Schibsted Grotesk, JetBrains Mono), icon, share.png (default share banner); games.js (the list of games and categories), home.js and home-view.js (the home page), studio.css (site tokens and shared styles), site.js (shared header and footer), game.css and game-page.js (the shared game page layout and the script that fills its video, write-up link and More from; every game uses them), story-page.js (header and footer for the How it works pages)
engine/                 reusable pieces for every game
  rng.js                seedable random numbers
  tinynet.js            dense tanh network: forward pass, weight indexing
  evolve.js             elitism, random newcomers, crossover, mutation
  train.js              loss, backpropagation, mini-batch gradient descent
  ticker.js             fixed 60 Hz simulation clock, so cars move at the same speed on any screen
  lineage.js            who bred whom, for the last few generations
  pedigree.js           pedigree chart layout and SVG
  brain-panel.js        draws any small network live
  curve.js              per-generation bar chart and loss line chart
  reinforce.js          learning from reward: policy, sampling, REINFORCE with a value baseline
games/racer/            Neural Racer: sim.js (no DOM), track-view.js, main.js, story-data.js
  how-it-works/         the illustrated write-up (story.js draws its figures; the shared styles are assets/story.css)
games/teach/            Teach by Driving: sim.js (no DOM, reuses the racer's track and physics), main.js, story-data.js
  how-it-works/         its write-up
games/runner/           Coin Runner: sim.js (no DOM; also `actionFor`, `tickHuman` and `timeLeft` for playing by hand), render.js (incl. `skyFor`, the night recolour), words.js (incl. `compareNote`, `whyNote`), sfx.js (`SOUNDS` data, `soundsFor`, `readSound`/`saveSound`, the Web Audio player), main.js, story-data.js + story.json, demo.js (the home page's recorded run, `startDemo(canvas, panelEl)`), art/ (Kenney, CC0)
  how-it-works/         its write-up
games/balance/          Balance: demo.js (the home page's recorded run: the write-up's trained brain keeping the pole up through shoves, `startDemo(canvas, panelEl)`), sim.js (no DOM: cart-pole, PID, tries), tune.js (evolution of the PID dials, TUNER_STORY_SEED), words.js, state.js (pure page helpers: keys, training allowance, Wind, dial markup), ai.js (4-6-1 net, evolution trainer, AI_STORY_SEED) and render.js (stage layout and drawing), story-data.js + story.json (the recorded run behind the write-up), index.html + balance.css + main.js (the playable page: You / PID / Tuned PID / AI, Push, Wind; both trainings run in every mode) and how-it-works/ (the write-up)
tests/                  Vitest tests for engine/ and each game's simulation and write-up data
```

Each game's `sim.js` has no DOM code, so the simulations run under test. Every animation loop asks `engine/ticker.js` how many 60 Hz steps to run, so a 120 Hz phone does not play twice as fast. Each write-up's `story-data.js` is tested too, so the story the text tells (for example "the copied brain crashes, corrections fix it") is checked on every test run.

## Deploy

Hosted as its own Vercel project, `neural_arcade` (live at https://arcade.codewithnk.com, also https://neuralarcade.vercel.app). `vercel.json` skips install and build and serves the repo root as static files. `.vercelignore` keeps tests, design notes and tooling folders out of the deployment.

```
vercel          # preview
vercel --prod   # production
```

Custom domain: `arcade.codewithnk.com`, set under the Vercel project's Domains. Share tags use this domain for absolute URLs.

## Adding a game

1. Write the simulation as a DOM-free module under `games/<name>/` with tests in `tests/`, reusing `engine/` for the network, training or evolution, brain panel and charts.
2. Add one entry to `GAMES` in `assets/games.js`: id, title, category, lesson, `learnsBy`, `goesWrongWhen`, `shot`, `path`, `writeup`, `added`, `youtube`, and `demo` (`null`, or `{ net, learns, panel, alt }`: the home stage words). The home page, browse page, category page and More from lists all render from it.
3. Copy the page skeleton from `games/runner/index.html` (and `assets/game.css`), keep `<body data-game="<name>">`, and add a game-only CSS file. Give it an experiment brief (setup, rule, watch for) and an (i) button on every readout, panel and control. `assets/game-page.js` fills the header, footer, crumb, video, write-up link and More from.
4. Add a `how-it-works/` folder (copy one, link `assets/story.css`) whose figures are drawn from a seeded, tested run, and a `shot.jpg` for the tiles.
5. Add share tags: copy the `<link rel="canonical">`, `og:*` and `twitter:*` lines from another game page into the game page and its write-up, changing the URLs, title and description, and put a 1280x720 `share.png` in `games/<name>/`. `tests/share-meta.test.js` checks it.

Add a video: set `youtube` to the YouTube id in `assets/games.js`, and copy the video thumbnail to `games/<name>/share.png` for the share banner. A game without a video may use its `shot.jpg` as the banner instead.

Be the home hero: give the game a `demo` block in `assets/games.js` (`net`, `learns`, `panel`, `alt`: the words on the stage under the hero) and a `games/<name>/demo.js` that exports `startDemo(canvas, panelEl)`. It plays a recorded or trained run on the canvas on a loop (pausing off screen, still under reduced motion) and fills the side panel list. The home page picks the newest game with both a `youtube` id and a `demo`, so a game with a video but no demo never breaks it.

Add a category: one entry in `CATEGORIES`. Empty categories stay hidden.