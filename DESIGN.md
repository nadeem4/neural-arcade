---
name: Neural Arcade
description: Small browser games where tiny neural networks learn in front of you, shown on dark stages in a cool, quiet studio.
colors:
  ground: "#F5F6F8"
  surface: "#FFFFFF"
  ink: "#0D1015"
  ink-2: "#4A515B"
  line: "#DDE1E6"
  track: "#E4E8EC"
  stage: "#0F1319"
  stage-2: "#1A2029"
  stage-ink: "#E9EDF2"
  stage-dim: "#7D8794"
  signal: "#FF5A1F"
  signal-text: "#C2410C"
  signal-ink: "#FFFFFF"
  signal-fill: "#C2410C"
  crash-red: "#E5533F"
  dark-ground: "#0B0E12"
  dark-surface: "#12161C"
  dark-ink: "#ECEFF3"
  dark-ink-2: "#A0A9B4"
  dark-line: "#232A33"
  dark-stage: "#161B23"
  dark-stage-2: "#1F2630"
typography:
  display:
    fontFamily: "Schibsted Grotesk, Segoe UI, system-ui, sans-serif"
    fontSize: "clamp(2.6rem, 6.2vw, 5.4rem)"
    fontWeight: 800
    lineHeight: 0.98
    letterSpacing: "-0.04em"
  headline:
    fontFamily: "Schibsted Grotesk, Segoe UI, system-ui, sans-serif"
    fontSize: "clamp(2.4rem, 5vw, 4.2rem)"
    fontWeight: 800
    lineHeight: 1
    letterSpacing: "-0.04em"
  section:
    fontFamily: "Schibsted Grotesk, Segoe UI, system-ui, sans-serif"
    fontSize: "clamp(2rem, 4vw, 3.2rem)"
    fontWeight: 800
    lineHeight: 1
    letterSpacing: "-0.035em"
  title:
    fontFamily: "Schibsted Grotesk, Segoe UI, system-ui, sans-serif"
    fontSize: "20px"
    fontWeight: 700
    letterSpacing: "-0.02em"
  body:
    fontFamily: "Schibsted Grotesk, Segoe UI, system-ui, sans-serif"
    fontSize: "17px"
    fontWeight: 400
    lineHeight: 1.55
  lead:
    fontFamily: "Schibsted Grotesk, Segoe UI, system-ui, sans-serif"
    fontSize: "19px"
    fontWeight: 400
    lineHeight: 1.55
  reading:
    fontFamily: "Schibsted Grotesk, Segoe UI, system-ui, sans-serif"
    fontSize: "18px"
    fontWeight: 400
    lineHeight: 1.65
  label:
    fontFamily: "Schibsted Grotesk, Segoe UI, system-ui, sans-serif"
    fontSize: "13px"
    fontWeight: 700
    letterSpacing: "0.06em"
  numeral:
    fontFamily: "JetBrains Mono, ui-monospace, Consolas, monospace"
    fontSize: "26px"
    fontWeight: 700
    lineHeight: 1
    letterSpacing: "-0.03em"
    fontFeature: "tnum"
rounded:
  pill: "999px"
  stage: "20px"
  card: "18px"
  shot: "14px"
  tile: "12px"
  thumb: "10px"
  inset: "8px"
spacing:
  gutter: "16px"
  gap: "20px"
  block: "40px"
  section: "96px"
components:
  button:
    backgroundColor: "{colors.surface}"
    textColor: "{colors.ink}"
    rounded: "{rounded.pill}"
    padding: "0 20px"
    height: "46px"
  button-primary:
    backgroundColor: "{colors.signal-fill}"
    textColor: "{colors.signal-ink}"
    rounded: "{rounded.pill}"
    padding: "0 20px"
    height: "46px"
  chip:
    backgroundColor: "{colors.surface}"
    textColor: "{colors.ink}"
    rounded: "{rounded.pill}"
    padding: "0 14px"
    height: "38px"
  chip-pressed:
    backgroundColor: "{colors.ink}"
    textColor: "{colors.ground}"
  switch-tab-current:
    backgroundColor: "{colors.ink}"
    textColor: "{colors.ground}"
    rounded: "{rounded.pill}"
    padding: "0 18px"
    height: "42px"
  search:
    backgroundColor: "{colors.surface}"
    textColor: "{colors.ink}"
    rounded: "{rounded.pill}"
    padding: "0 18px"
    height: "52px"
  stage:
    backgroundColor: "{colors.stage}"
    textColor: "{colors.stage-ink}"
    rounded: "{rounded.stage}"
  card:
    backgroundColor: "{colors.surface}"
    textColor: "{colors.ink}"
    rounded: "{rounded.card}"
    padding: "18px 20px"
---

# Design System: Neural Arcade

## Overview

**Creative North Star: "The Studio"**

A cool, quiet studio with a dark stage in the middle of it. The page around a game is pale grey ground, white surfaces and deep ink, set in one grotesk; the game itself always plays on a near-black stage. Everything the network does happens on that stage, so the chrome stays neutral and the stage is the only dark, lively thing on a light page.

One signal orange carries action and emphasis: the primary button, the selected move, the live dot, the lesson's last words, focus rings. Numbers the learning produces are set in a monospace with tabular figures, so they read as data, not decoration. Shapes are soft: pill controls, large-radius stages and cards, hairline dividers between rows.

The site follows the system colour scheme by default and has a sun/moon toggle in the header that stores the choice (`na-theme` in localStorage). In dark mode the ground and surfaces go near-black and the stage lifts slightly so it still reads as its own plane.

**Key Characteristics:**
- Light cool ground, white surfaces, deep ink; dark stage for every game.
- One accent: signal orange, with a darker text variant for orange words on light ground.
- Schibsted Grotesk for everything; JetBrains Mono for live numbers.
- Pill controls, 18 to 20px stages and cards, 1px hairline rules.
- Flat, apart from the home demo stage's soft drop shadow.

## Colors

A neutral cool-grey palette with one orange signal and a separate dark stage palette.

### Primary
- **Signal Orange** (`signal`): the selected move's bar and value, the live dot, the logo's output node, range-slider accents and focus outlines. On light ground, orange text uses **Burnt Signal** (`signal-text`) instead, which passes contrast; in dark mode `--signal-text` resolves to `signal` itself. Orange fills that carry white text (the primary button, the New badge, the current Teach phase, text selection) use **Signal Fill** (`signal-fill`, #C2410C) so white (`signal-ink`) reaches 4.5:1.

### Neutral
- **Cool Ground** (`ground`, CSS `--bg`): page background; the sticky browse toolbar uses it too.
- **White Surface** (`surface`): buttons, chips, the switch, the search field, controls panel, cards, figure plates.
- **Deep Ink** (`ink`) and **Slate Ink** (`ink-2`): headings and body; secondary copy, nav links, hints, legends, captions.
- **Hairline** (`line`): every border and row divider. **Track** (`track`): segmented-control trough, opened (i) explanations, figure bar troughs.
- **Stage** (`stage`), **Stage Raised** (`stage-2`), **Stage Ink** (`stage-ink`), **Stage Dim** (`stage-dim`): the game stage and the dark thumbnails behind game shots; inner dividers; text on the stage; secondary stage text and idle bars.
- Dark mode swaps ground, surface, ink, ink-2, line, track and stage to the `dark-*` values (track uses `dark-line`); stage-ink, stage-dim and signal stay.

### Canvas colours
Canvas code reads colours through `assets/theme.js` using older names that alias the studio tokens: `--ground`, `--tray` (stage), `--road` (stage-2), `--edge`, `--muted`, `--rule`, `--car`, `--amber` (signal), `--amber-ink` (signal-text) and `--red` (`crash-red`, deaths and crashes in charts and legends). New CSS uses the studio names.

### Named Rules
**The One Signal Rule.** Orange is the only accent. Charts may add `crash-red` for failure; nothing else gets a hue.

**The Burnt Text Rule.** Orange words on a light surface use `--signal-text`, never `--signal`.

## Typography

**Display and Body Font:** Schibsted Grotesk, variable 400 to 900 (with Segoe UI, system-ui)
**Numeral Font:** JetBrains Mono 500 and 700 (with ui-monospace, Consolas)

**Character:** One tight, heavy grotesk does both the shouting and the reading; the mono appears only where the network produces a number.

### Hierarchy
- **Display** (800, clamp(2.6rem, 6.2vw, 5.4rem), 0.98): the home hero headline only, max 14ch.
- **Headline** (800, clamp(2.4rem, 5vw, 4.2rem), 1): page h1s; game pages cap it at 3.8rem, how it works intros at 64px. Balanced wrapping.
- **Section** (800, clamp(2rem, 4vw, 3.2rem), 1): home section headings. The game lesson line uses the same voice at clamp(1.6rem, 3.4vw, 2.6rem), max 22ch.
- **Title** (700, 20px): row and step titles; card and panel headings drop to 15px 700.
- **Body** (400, 17px, 1.55): default. **Lead** (19px, max 52ch, `ink-2`): the paragraph under an h1. **Reading** (18px, 1.65, 680px column): how it works prose.
- **Label** (700, 13px, 0.06em, uppercase): brief terms and the home stage's panel heading. Used sparingly.
- **Numeral** (JetBrains Mono 700, 26px, tabular): stage readouts (20px on phones); dial outputs at 14px; percentages in move bars.

### Named Rules
**The Mono Means Data Rule.** JetBrains Mono is for live numbers only, never for headings or labels.

## Layout

Content sits in a 1200px wrap with 16px side gutters that respect safe-area insets. Sections breathe in tens of pixels: 40px between hero blocks, 56px around game-page bands, 96px at the end of a page.

- **Home:** hero (headline, lead plus actions, then the demo stage with a 300px brain column), then "Pick what you want to understand", one block per category (260px info column beside a four-column tile grid, the newest game as a two-column feature tile), then a row of category chips.
- **Browse (`games/`):** headline and lead, a sticky toolbar (search pill, category chips, sort select), then a list of rows (150px thumb, title and lesson, category and video note, Play button) and a pager of chips.
- **Category (`category/?c=`):** crumb, headline, lead, a "Start with" primary button (oldest game), then large two-column steps that alternate image side, each with a Learns by / Goes wrong when list and Play, Watch explainer (only with a video) and How it works actions; then chips for other categories.
- **About:** headline and three paragraphs in a 680px column.
- **Game page** (`assets/game.css`; `games/runner` is the reference): crumb and h1 with the lesson as lead, with a Play / Watch / How it works switch on the right; the brief (setup, rule, watch for) in three columns between hairlines; the play row (dark stage beside a 360px controls panel); two cards (brain, chart); the lesson band with a "Why it happens" button; (Coin Runner) a Play it yourself button with an (i) in the stage head, a start card (key caps in a two-column grid, none on touch screens), an icon-only full screen button at the level's top right while you play (hidden where the browser has no element fullscreen), 3-2-1 countdown, score/coins/time readout and end card as HTML overlays inside the level (dialog, token colours on the stage), and a left, right and jump touch pad over the level on touch screens while you play; a watch-and-read pair; "More from <category>" as up to three tiles; the art credit.
- **How it works:** one 680px reading column of numbered steps; figures sit in plates, some up to 1040px wide.

Breakpoints: 1000px stacks the game page's play row, cards and watch/read pair; 900px stacks the home stage and categories and folds browse rows; 640px stacks the brief and lesson and makes the switch full width; 560px makes tiles one column.

## Elevation & Depth

Flat. Depth comes from the dark stage sitting on a light ground, and from white surfaces on grey. Three shadows exist, each with one job.

### Shadow Vocabulary
- **Stage lift** (`box-shadow: 0 30px 60px -30px rgba(13, 16, 21, .45)`): the home demo stage only; game pages set it to none.
- **Pressed segment** (`box-shadow: 0 1px 3px rgba(13, 16, 21, .15)`): the selected option in a segmented control.
- **Play glow** (`box-shadow: 0 12px 30px -8px rgba(255, 90, 31, .6)`): the orange play disc on a video facade.

## Shapes

Every control is a pill (999px): buttons, chips, the switch, search, sort select, the "New" badge. Containers get large soft corners: 20px home stage (18px on game pages), 18px panels and cards, 16px video, 14px category shots, 12px tiles and segmented troughs, 10px row thumbs, 8px for captions and opened explanations. Borders are 1px `line` hairlines (1.5px on buttons and search). Figure plates on how it works pages are square-cornered.

## Components

### Header and footer
Mounted by `assets/site.js` into `<header data-site>` and `<footer data-site>`. The header is the logo mark (ink rounded square, two ground-coloured input dots, one orange output dot) with "Neural Arcade" at 800, then Games and About links (`ink-2`; current page `ink` 700) and a 40px round sun/moon lamp button. The footer is a hairline-topped row: "Built by Nadeem." and a codewithnk.com link.

### Buttons
- **Shape:** pill, 46px tall, 0 20px, 600 15px; 52px tall on the home hero.
- **Default:** white surface, ink text, 1.5px hairline.
- **Primary:** orange fill and border, white text. One per action group; Play and Read How it works use it.
- **Text link:** 46px tall underlined 600 text, for How it works beside buttons.
- **Disabled:** 50% opacity. **Focus:** 2px orange outline, 3px offset, on every link, button and input.

### Chips
38px pills, white with hairline, 500 14px. Pressed (browse filters) and current (pager) invert to ink fill with ground text. Used for categories, filters and pages.

### Rows and tiles
- **Row (browse):** a grid between hairlines; 4:3 dark thumb, title and lesson, category name plus "Video explainer" in `signal-text` when a video exists, Play on the right.
- **Tile (home, More from):** 16:10 dark thumb with the game shot, title in 700 16px, "learns by" line in `ink-2`; the thumb lifts 3px on hover (0.25s, cubic-bezier(.2, .8, .2, 1)). The newest game's feature tile carries an orange "New" pill.

### Stage
The dark plane every game plays on. A head row (live orange dot, bold stage-ink label, dim details), the canvas, then on game pages a narration line (`say`, polite live region) and a row of three or two readouts: dim label with an (i) button over a mono numeral. Captions float bottom-left on the canvas in a small stage-coloured box.

### Controls panel and cards
White, hairline, 18px. The panel stacks sections split by hairlines; each has a 15px 700 heading with an (i) button, a segmented control (track trough, white raised selection), hints in 13px `ink-2`, range dials (name, mono value, orange accent) and default buttons. Cards hold one canvas each (the brain, a chart) under a heading and a one-line question, with a legend of small rounded swatches.

### (i) buttons
A 28px round, transparent icon button beside a heading or readout label; it toggles a short explanation in a track-coloured 8px box (stage-2 on the stage). An opened readout explanation spans the full row.

### Switch, brief, lesson
- **Switch:** a white pill holding pill links; the current one is ink-filled. Watch is hidden until the game has a video.
- **Brief:** a definition list in three columns between hairlines, uppercase labels over 15px text.
- **Lesson (`moral`):** a band between hairlines: a small "The lesson" line, the lesson in 800 headline type with its last clause in `signal-text`, and a default button to the write-up.

### Watch and read, video facade
A two-column pair: "Watch it learn" with the video, and "How it works" with a primary button. Without a video only the read column shows, full width. The facade (`assets/video.js`) is a 16:9 rounded box with the YouTube thumbnail, a 76px orange play disc and a dark pill label "Watch: how it learns"; a click swaps in the iframe.

### Crumb and pager
Crumb: 14px `ink-2` text, links underlined at 4px offset, "Category / Game" on game pages and "Every game / Category" on category pages. Pager: chips, hidden when there is one page.

### How it works page
Intro (headline, 20px lede, read time and a "Try it live" arrow link), a wide opening figure, then numbered steps: a bold `signal-text` step number, a 30px 800 heading, reading prose with bold (not italic) terms. Figures are white hairline plates with "Fig. N" captions under a rule; bar figures use track troughs with orange fills. A "deep" details box with a heavy top rule holds the practitioner notes. The shared styles live in `assets/story.css`; the Coin Runner and Teach write-ups add their own figure CSS. The finale button is `btn primary`.

## Do's and Don'ts

### Do:
- **Do** render games, categories and their order from `assets/games.js`; adding a game is one entry there.
- **Do** show a game's video, its Watch tab and every "Watch the explainer" link only when its `youtube` field is set.
- **Do** say "category" for a group of games, in copy and in new class names.
- **Do** put every game on a dark stage, with its controls in the white panel beside it.
- **Do** use `--signal-text` for orange words on light ground and JetBrains Mono for live numbers.
- **Do** give every control an (i) explanation and every game page one lesson band.

### Don't:
- **Don't** show counts of games, "Coming soon" or "Playable" labels, or tiles for unbuilt games.
- **Don't** add a second accent colour; failure in charts is the only use of `crash-red`.
- **Don't** add shadows beyond the three in Elevation & Depth.
- **Don't** reintroduce Saira or Public Sans, uppercase condensed labels or square-cornered controls; that was the previous design.
