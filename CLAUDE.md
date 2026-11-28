# Neural Arcade

Small browser games where tiny neural networks learn in front of you; each game teaches one machine learning idea.

## Constraints
- Static site: plain HTML, CSS, ES modules, no build step, deployed to Vercel
- Browser only: no backend, no accounts, state in localStorage
- One game teaches one ML idea; brief, (i) buttons, How it works, no tours or quizzes
- Phone first: playable at 390 px wide; 3D keeps frame rate on a mid phone
- Art and models CC0 only; three.js r160 pinned in assets/vendor
- Generated files (track/lesson pages, story.json, chicago.json) never hand-edited
- Tests: Vitest only; full suite stays under ~3 minutes

## Check and release

Check command: npm test && node scripts/build-pages.mjs --check
Check [games/city/*, scripts/city/*]: npx vitest run city-
Check [games/treasure-room/*]: npx vitest run treasure-room-

Release targets:
- site: vercel, from main, auto-release: yes

## Commands
- Setup: npm install
- Run: npm run dev (serves http://localhost:4173)
- Test: npm test (Vitest; runner-presets takes ~90 s)
- Pages: `npm run pages` rewrites the generated pages (the three `<track id>/index.html` and `concepts/<id>/index.html` for every live lesson) from assets/tracks/; `node scripts/build-pages.mjs --check` exits 1 if any differ (a test also checks this)
- Record Reward City footage: open `/games/city/?record=1&card=<preset id>&fps=<n>&cam=<default|map|auto>&endcard=1&maxms=<n>` (frame-stepped through `window.__rc`; see README)

## Layout
- `docs/`: layout.md is the file-by-file map; keep it current when a file is added, moved or removed (two tests check it)
- `about/`: the About page; `index.html` is home and `games/index.html` browses all games
- `category/`: a redirect stub, as is `concepts/index.html`
- `concepts/`: one lesson page per live lesson in `concepts/<id>/` (index.html generated from config + writeup.html + page.js)
- `assets/`: shared code and styles (studio.css, site.js, game.css + game-page.js, home.js, video.js); games.js lists the games; tracks/ holds the three track configs (lessons live only there), page builder (build.js) and progress; vendor/three/ is the one pinned three.js r160 plus loaders, and pages that load it carry the import map
- `neural-networks/`: generated track page
- `reinforcement-learning/`: generated track page
- `physical-ai/`: generated track page
- `games/`: one game per folder (index.html, sim.js, ai.js, main.js, words.js, story-data.js, how-it-works/); city/ is Reward City, a 3D taxi on an OSM Chicago grid (start at sim.js, presets.js, main.js); treasure-room/ is Treasure Room, a 3D room with six levels (start at sim.js, levels.js, level-panel.js)
- `engine/`: shared learning code (tinynet, evolve, reinforce, qlearn, train, brain-panel, curve)
- `scripts/`: build-pages.mjs writes the generated pages; city/ makes chicago.json; check_pr.py, with .githooks/pre-push and .github/workflows/check.yml, is the PR check
- `tests/`: Vitest tests, flat, named `<game>-*.test.js`

## Conventions
- Adding a lesson is one config entry in its track, one level, one write-up, then `npm run pages`. Generated pages are committed; a test fails on drift. A game's chips and track crumb come from the track configs, so adding a game to a lesson (`game` or a `wild` entry) is all a game page needs; the game's own HTML carries only the empty `#uses` and `#moreFrom` sections
- Adding a whole-game lesson (no `level`): add it to its track config with its `game`; the page shows the game banner (`concepts/<id>/share.png` if it exists, else `games/<game>/share.png`) with Play, the lesson's video or the game's, Same idea in other games and Mark as done, and loads only studio.css, concept.css and lesson.css. Add `concepts/<id>/writeup.html` and `page.js` for a write-up and playground; without them Read links to the game's How it works. Then run `npm run pages`
- Every lesson page has one order: lead, room or game banner, own-game line, tries, write-up, video, Same idea in other games, Mark as done, Previous and Next (`lessonBodyHtml`; a section a lesson lacks is absent). A Treasure Room write-up runs: What you saw (picture and three lines), Key terms, In code (folded), the takeaway (`<p><b>The lesson:</b> ...</p>`). The lead is the lesson's `says`, plain text of the idea in two sentences at most, which is also the track row text and meta description
- Adding a Treasure Room lesson: add the lesson (with `level` set to its own lesson id, status live) to assets/tracks/reinforcement-learning.js, add `concepts/<id>/` with sim.js, figures.js (agent and return have neither, nor a page.js: their tries are static text in writeup.html), writeup.html (tries that point at the level controls, then `<h2>What you saw</h2>` with the picture and a `<ul class="saw">` of three lines, `<h2>Key terms</h2>` as a `<table class="terms">`, then the fold `<details class="incode"><summary><h3>In code: the same idea in Python</h3></summary>` holding one `<pre class="code"><code>` of read-only Python, run by hand against the room first and extending the lesson before it; `build.js` colours it through `assets/tracks/python.js`, so write plain escaped code) and page.js (copy state-action-reward, policy or value; a 2D playground with play.js is only for lessons that need one, like mdp), then run `npm run pages`; lesson pages load studio.css, game.css, treasure-room.css, concept.css and lesson.css (lesson.css guards the concept playground against the first three's leaks, so do not edit game.css or treasure-room.css for lesson pages); the page gets the playable level, video slot ("Video coming soon" while `video` is null), Same idea in other games, Mark as done and previous/next from config. One level per page (the panel's element ids are page-wide). A new level is keyed by that lesson id everywhere: an entry in `LEVELS` (levels.js, with `assumes`), a view in `views` (level-panel.js, whose track order sets the level order and `?level=<id>`) and an entry in `OVERLAYS_FOR_LEVEL` (room-overlays.js); it may add labels in `MARKERS_FOR_LEVEL` (room-markers.js) with their cards in `MARKER_INFO` (words.js); any button that cannot act at the start is disabled with a reason (a test audits this)
- Every page carries share/SEO tags (canonical, og:*, twitter:*) hard-coded in its HTML; a game banner is games/<name>/share.png (1280x720), copied from its video thumbnail, or its shot.jpg if it has no video; assets/share.png is the site default
- Every page links assets/studio.css; game pages add game.css and a game-only file, How it works pages add assets/story.css (and a story.css of their own if they need one); concept pages add assets/concept.css and carry share tags like any page. Adding a youtube id to assets/games.js, and copying its thumbnail to games/<name>/share.png, is all a video needs
- A game with a video also gets a `demo` block in assets/games.js (net, learns, panel, alt words) and a games/<name>/demo.js exporting `startDemo(canvas, panelEl)`, so it can be the home hero: the home page picks the newest game with a youtube id and a demo, and its stage words and recorded run come from those, with no home-page code change
- One optional narrated explainer video per game, hosted on YouTube, shown as a click-to-play facade (assets/video.js)
- How it works figures come from a seeded run recorded by story-data.js; regenerate it when the sim changes
- Treasure Room How it works figures are still images from the 3D room, never live canvases: regenerate them with `?shots=1&fig=N&size=WxH` (N is 1 to 8) (see `FIGURES` in games/treasure-room/shots.js, default 1280x800, webp under 120 KB) whenever story-data.js or the room look changes, and capture `games/treasure-room/share.png` with fig=1 at size=1280x720
- Lesson pages load studio.css, game.css, treasure-room.css, concept.css and lesson.css together, so a class added to lesson.css or a writeup.html takes a name none of the other four defines, or is scoped under its own parent like `.loop .head` (a test in lesson-view.test.js lists the shared names)
- When a heading, term or file is renamed or removed, grep README.md, DESIGN.md and docs/layout.md for the old name in the same commit; when a level's room or rules change, update README's Treasure Room summary line too
- A level view's behaviour (tabs, hints, picks) is tested by driving `mount()` through `tests/treasure-room-fake-ui.js`, not by matching its static markup
- Plans live in `.plan/` (local, not in git); Notion is the dashboard only. docs/ is git-ignored except docs/layout.md
