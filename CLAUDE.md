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
File-by-file detail: docs/layout.md (keep it current when a file is added, moved or removed; two tests check it).
- index.html, about/, games/index.html: home, About, browse all games; category/ and concepts/index.html are redirect stubs
- assets/: shared code and styles (studio.css, site.js, game.css + game-page.js, home.js, video.js); assets/games.js lists the games
- assets/tracks/: the three track configs (lessons live only there), page builder (build.js), progress; scripts/build-pages.mjs writes the pages
- neural-networks/, reinforcement-learning/, physical-ai/: generated track pages
- concepts/<id>/: one lesson page per live lesson (index.html generated from config + writeup.html + page.js)
- games/<name>/: one game each (index.html, sim.js, ai.js, main.js, words.js, story-data.js, how-it-works/)
- games/city/ (Reward City): 3D taxi on an OSM Chicago grid; start at sim.js, presets.js, main.js; scripts/city/ makes chicago.json
- games/treasure-room/ (Treasure Room): 3D room with six levels; start at sim.js, levels.js, level-panel.js
- assets/vendor/three/: the one pinned three.js r160 plus loaders; pages that load it carry the import map
- engine/: shared learning code (tinynet, evolve, reinforce, qlearn, train, brain-panel, curve)
- tests/: Vitest tests, flat, named `<game>-*.test.js`
- .github/workflows/check.yml, scripts/check_pr.py, .githooks/pre-push: the PR check

## Conventions
- Adding a lesson is one config entry in its track, one level, one write-up, then `npm run pages`. Generated pages are committed; a test fails on drift. A game's chips and track crumb come from the track configs, so adding a game to a lesson (`game` or a `wild` entry) is all a game page needs; the game's own HTML carries only the empty `#uses` and `#moreFrom` sections
- Adding a whole-game lesson (no `level`): add it to its track config with its `game`; the page shows the game banner (`concepts/<id>/share.png` if it exists, else `games/<game>/share.png`) with Play, the lesson's video or the game's, Same idea in other games and Mark as done, and loads only studio.css, concept.css and lesson.css. Add `concepts/<id>/writeup.html` and `page.js` for a write-up and playground; without them Read links to the game's How it works. Then run `npm run pages`
- Every lesson page has one order: lead, room or game banner, tries, explanation, In code, video, Same idea in other games, Mark as done, Previous and Next (`lessonBodyHtml`; a section a lesson lacks is absent). The lead is the lesson's optional `asks` question when it has one, else `says`, which stays the track row text and meta description
- Adding a Treasure Room lesson: add the lesson (with its `level`, status live) to assets/tracks/reinforcement-learning.js, add `concepts/<id>/` with sim.js, figures.js, writeup.html (tries that point at the level controls, then the explanation, then an "In code" block: `<h3>In code</h3>` and one `<pre class="code"><code>` of read-only Python) and page.js (copy state-action-reward, policy or value; the agent lesson has no page.js; a 2D playground with play.js is only for lessons that need one, like return and mdp), then run `npm run pages`; lesson pages load studio.css, game.css, treasure-room.css, concept.css and lesson.css (lesson.css guards the concept playground against the first three's leaks, so do not edit game.css or treasure-room.css for lesson pages); the page gets the playable level, Mark as done, video slot ("Video coming soon" while `video` is null), Same idea in other games and previous/next from config. One level per page (the panel's element ids are page-wide). A new level also needs an entry in `OVERLAYS_FOR_LEVEL` (room-overlays.js) and `assumes` in levels.js, and may add labels in `MARKERS_FOR_LEVEL` (room-markers.js) with their cards in `MARKER_INFO` (words.js); any button that cannot act at the start is disabled with a reason (a test audits this)
- Every page carries share/SEO tags (canonical, og:*, twitter:*) hard-coded in its HTML; a game banner is games/<name>/share.png (1280x720), copied from its video thumbnail, or its shot.jpg if it has no video; assets/share.png is the site default
- Every page links assets/studio.css; game pages add game.css and a game-only file, How it works pages add assets/story.css (and a story.css of their own if they need one); concept pages add assets/concept.css and carry share tags like any page. Adding a youtube id to assets/games.js, and copying its thumbnail to games/<name>/share.png, is all a video needs
- A game with a video also gets a `demo` block in assets/games.js (net, learns, panel, alt words) and a games/<name>/demo.js exporting `startDemo(canvas, panelEl)`, so it can be the home hero: the home page picks the newest game with a youtube id and a demo, and its stage words and recorded run come from those, with no home-page code change
- One optional narrated explainer video per game, hosted on YouTube, shown as a click-to-play facade (assets/video.js)
- How it works figures come from a seeded run recorded by story-data.js; regenerate it when the sim changes
- Treasure Room How it works figures are still images from the 3D room, never live canvases: regenerate them with `?shots=1&fig=N&size=WxH` (N is 1 to 8) (see `FIGURES` in games/treasure-room/shots.js, default 1280x800, webp under 120 KB) whenever story-data.js or the room look changes, and capture `games/treasure-room/share.png` with fig=1 at size=1280x720
- Plans live in `.plan/` (local, not in git); Notion is the dashboard only. docs/ is git-ignored except docs/layout.md
