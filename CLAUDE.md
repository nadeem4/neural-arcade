# Neural Arcade

Small browser games where tiny neural networks learn in front of you; each game teaches one machine learning idea.

## Commands
- Setup: npm install
- Test: npm test (Vitest; runner-presets takes ~90 s)
- Run: npm run dev (serves http://localhost:4173)

## Layout
- engine/: shared learning code (tinynet, evolve, reinforce, train, brain-panel, curve)
- about/: the About page
- games/<name>/: one game each (index.html, sim.js, main.js, words.js, story-data.js, how-it-works/)
- assets/: home page, shared CSS, fonts, theme, video.js (click-to-play video facade), games.js (games and categories data), studio.css (new site tokens), site.js (shared header/footer)
- videos/<game>/: git-ignored upload pack per explainer video (mp4, captions, description, thumbnail)
- tests/: Vitest tests for the engine and each game's sim, words and story

## Conventions
- No build step: plain HTML, CSS and ES modules; deployed as static files to Vercel
- Every game has a brief, (i) buttons, an illustrated How it works write-up and one stated lesson; no tours or quizzes; one optional narrated explainer video per game, hosted on YouTube, shown as a click-to-play facade (assets/video.js)
- How it works figures come from a seeded run recorded by story-data.js; regenerate it when the sim changes
- Plans and design docs go in Notion, never git (docs/ is ignored)
