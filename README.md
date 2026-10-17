# Neural Arcade

Small browser games where tiny neural networks learn in front of you, and the player is part of the training loop. Each game teaches one machine learning idea, and each comes with an illustrated "How it works" write-up.

**Live: https://neuralarcade.vercel.app**

## Experiments

| Experiment | Play it | Read how it works | What it teaches |
|---|---|---|---|
| **Neural Racer** | [Play](https://neuralarcade.vercel.app/games/racer/) | [How it works](https://neuralarcade.vercel.app/games/racer/how-it-works/) | Learning from a score: fitness, selection, crossover, mutation, overfitting |
| **Teach by Driving** | [Play](https://neuralarcade.vercel.app/games/teach/) | [How it works](https://neuralarcade.vercel.app/games/teach/how-it-works/) | Learning from examples: training data, loss, gradient descent, learning rate, distribution shift |

The two are a pair: the same car, track and senses, with the brain's numbers set two different ways (breeding by score, or gradient descent on your examples).

### Neural Racer (`games/racer/`)
10 cars, each driven by a 6→8→2 network (74 weights), learn to lap a track by neuroevolution. Cars start on a grid, in rows of five behind the start line, and every car's distance is measured from the line itself. With the default 10 cars, each round the best car is kept, 8 children are bred from the top 3 and 1 random newcomer joins.
- **Experiment brief:** above the track, three short lines state the setup, the rule and what to watch for.
- **How it works** (`games/racer/how-it-works/`): an illustrated write-up, linked from the race page's top bar, under the track, and from the home page. It explains what a car senses, what its brain is, how a round is ranked and how children are bred, then shows the best car of each generation improving. Every figure is drawn live from one seeded run of the real simulation (seed 307, recorded by `story-data.js`), so the pictures always match the text. A collapsed section gives practitioners the exact network, fitness, selection and mutation settings.
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
- **No step starts unannounced:** a caption on the track says what just happened and what comes next, and stays for 2.5 seconds before the next step starts ("Lap complete! Next, step 2: it learns from your 850 examples.", then "Step 2: learning. Pass 12 of 40", then "Step 3: now it drives on its own…", and after each of its drives "It crashed at the red cross…", "Two laps on your track. Now the real test…" or "Done: two laps on a track it never saw…"). The wording lives in `games/teach/words.js`.
- **Levers:** learning rate (0.002 to 3, with what each does; changing it after it has learned relearns your same examples from a fresh brain, back on your track, so rates can be compared), New track (at step 1, a new track to teach on; later, another unseen track for the same brain), Drive again (back to step 1 with a fresh brain and no examples).
- **Panels:** examples, loss and distance readouts; its brain, with "You: … · Its guess: …" while you drive; the loss per pass. Every one has an (i) explanation.
- **How it works** (`games/teach/how-it-works/`): examples, loss, one weight's loss hill with a ball rolling down it, backpropagation, the copied brain crashing where the teacher never drove (distribution shift), corrections that fix it (DAgger-style), and three learning rates. Every figure is drawn from one seeded lesson (track `LESSON_SEED` = 10, recorded by `games/teach/story-data.js`) whose teaching lap is driven by a stand-in autopilot; the page says so.
- Testing aid: add `?autopilot` to the game's URL and the stand-in teacher drives the teaching lap.

## Run locally

```
npm install
npm run dev     # serves the site at http://localhost:4173
npm test        # engine and simulation tests (Vitest)
```

There is no build step. Pages are plain HTML, CSS and JavaScript ES modules.

## Layout

```
index.html              arcade home (live previews of both games)
assets/                 shared styles, theme helper, self-hosted fonts, icon
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
games/racer/            Neural Racer: sim.js (no DOM), track-view.js, main.js, story-data.js
  how-it-works/         the illustrated write-up (story.js draws its figures; story.css is shared by all write-ups)
games/teach/            Teach by Driving: sim.js (no DOM, reuses the racer's track and physics), main.js, story-data.js
  how-it-works/         its write-up
tests/                  Vitest tests for engine/ and each game's simulation and write-up data
```

Each game's `sim.js` has no DOM code, so the simulations run under test. Every animation loop asks `engine/ticker.js` how many 60 Hz steps to run, so a 120 Hz phone does not play twice as fast. Each write-up's `story-data.js` is tested too, so the story the text tells (for example "the copied brain crashes, corrections fix it") is checked on every test run.

## Deploy

Hosted as its own Vercel project, `neural_arcade` (live at https://neuralarcade.vercel.app). `vercel.json` skips install and build and serves the repo root as static files. `.vercelignore` keeps tests, design notes and tooling folders out of the deployment.

```
vercel          # preview
vercel --prod   # production
```

Custom domain: add `arcade.codewithnk.com` under the Vercel project's Domains.

## Adding a game

Every game follows the same pattern:
1. Write the simulation as a DOM-free module under `games/<name>/` with tests in `tests/`.
2. Reuse `engine/` for the network, training or evolution, brain panel and charts.
3. Give the page the shared top bar (with a How it works link), an experiment brief (setup, rule, watch for), and an (i) button on every readout, panel and control.
4. Write an illustrated `how-it-works/` page whose figures are drawn from a seeded, tested run.
5. Say what it teaches on its home-page card, and add it to the Experiments table above.
