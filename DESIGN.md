---
name: Neural Arcade
description: Small browser games where tiny neural networks learn in front of you, drawn on a lab bench.
colors:
  bench-green: "#12352B"
  specimen-tray: "#0B271F"
  tray-road: "#1D4538"
  road-edge: "rgba(238, 242, 230, .3)"
  chalk: "#EEF2E6"
  lichen-muted: "#A3BAAD"
  slate-rule: "#2E5849"
  agar-amber: "#F2A93B"
  fly-eye-red: "#E5533F"
  daylight-paper: "#E3EBE5"
  daylight-tray: "#C6D6CB"
  daylight-road: "#F1F5F0"
  daylight-road-edge: "rgba(18, 53, 43, .4)"
  daylight-muted: "#46685A"
  daylight-muted-on-tray: "#3A5A4C"
  daylight-rule: "#AFC3B6"
  daylight-amber-ink: "#8F5300"
  daylight-red: "#C23A2B"
typography:
  display:
    fontFamily: "Saira Condensed, Arial Narrow, sans-serif"
    fontSize: "clamp(44px, 6vw, 72px)"
    fontWeight: 800
    lineHeight: 0.92
    letterSpacing: "0.005em"
  headline:
    fontFamily: "Saira Condensed, Arial Narrow, sans-serif"
    fontSize: "48px"
    fontWeight: 800
    letterSpacing: "0.01em"
  title:
    fontFamily: "Saira Condensed, Arial Narrow, sans-serif"
    fontSize: "22px"
    fontWeight: 600
    letterSpacing: "0.08em"
  numeral:
    fontFamily: "Saira Condensed, Arial Narrow, sans-serif"
    fontSize: "34px"
    fontWeight: 800
    lineHeight: 1.05
    fontFeature: "tnum"
  body:
    fontFamily: "Public Sans, Segoe UI, Roboto, sans-serif"
    fontSize: "16px"
    fontWeight: 400
    lineHeight: 1.5
  lede:
    fontFamily: "Public Sans, Segoe UI, Roboto, sans-serif"
    fontSize: "18px"
    fontWeight: 400
    lineHeight: 1.5
  label:
    fontFamily: "Saira Condensed, Arial Narrow, sans-serif"
    fontSize: "18px"
    fontWeight: 600
    letterSpacing: "0.06em"
  note:
    fontFamily: "Public Sans, Segoe UI, Roboto, sans-serif"
    fontSize: "13px"
    fontWeight: 400
rounded:
  none: "0px"
spacing:
  cell: "8px"
  cell-2: "16px"
  cell-3: "24px"
  cell-4: "32px"
  cell-5: "40px"
  cell-6: "48px"
  cell-8: "64px"
  cell-10: "80px"
components:
  button-outline:
    backgroundColor: "transparent"
    textColor: "{colors.chalk}"
    typography: "{typography.label}"
    rounded: "{rounded.none}"
    padding: "0 16px"
    height: "44px"
  button-solid:
    backgroundColor: "{colors.chalk}"
    textColor: "{colors.bench-green}"
    typography: "{typography.label}"
    rounded: "{rounded.none}"
    padding: "0 16px"
    height: "44px"
  button-pressed:
    backgroundColor: "{colors.chalk}"
    textColor: "{colors.bench-green}"
  lamp-toggle:
    backgroundColor: "transparent"
    textColor: "{colors.chalk}"
    rounded: "{rounded.none}"
    padding: "0 12px"
    height: "36px"
  generation-plate:
    backgroundColor: "transparent"
    textColor: "{colors.chalk}"
    rounded: "{rounded.none}"
    padding: "0 12px"
    height: "36px"
  specimen-tray:
    backgroundColor: "{colors.specimen-tray}"
    rounded: "{rounded.none}"
---

# Design System: Neural Arcade

## Overview

**Creative North Star: "The Breeding Lab"**

Neural Arcade is a lab bench, not a dashboard. The ground is a slate bench green, the play area is a deeper specimen tray, and everything the network does is drawn on it in chalk-white ink strokes (1.5px) as if a researcher were annotating the dish. Evolution reads as breeding: generations, parents, survivors, crashes, written in a small fixed vocabulary of marks rather than glowing graphics. The default is the bench at night (dark); the daylight variant is the same lab with the lights on, a pale green-grey paper ground and ink in bench green.

The system is flat, hard-edged and quiet so the simulation is the only thing that moves. Chrome is outlines and hairline rules; colour is held back for meaning. Two signal colours exist and each carries exactly one idea: amber is survival, red is a crash. Weight sign, lineage and car state are all encoded by line style and shape, never by extra hues.

It rejects the dark neon "AI dashboard" with a glowing net in a side card: no glow, no gradients, no rounded cards, no shadows.

**Key Characteristics:**
- Bench green ground, deeper specimen tray, chalk ink strokes.
- Two signal hues only: amber = survivor/leader, red = crash.
- Meaning by mark and stroke style (solid/dashed, square/circle/diamond/strike), not by colour.
- Saira Condensed uppercase for every display, label and button; Public Sans for reading.
- Radius 0 everywhere, no shadows, everything on an 8px cell.
- Dark bench by default, daylight variant, Light/Dark lamp toggle.

## Colors

A near-monochrome lab-green palette with chalk ink and two strictly rationed signal colours.

### Primary
- **Agar Amber** (`agar-amber`): The survivor colour. Fills the leader car, its sensor rays, the leader node in the pedigree, finished cars (at reduced opacity) and the finished-per-generation bars. On the daylight bench, amber text (the "Furthest car" readout) switches to **Burnt Agar** (`daylight-amber-ink`) for contrast; amber fills stay `agar-amber` in both themes.

### Secondary
- **Fly-Eye Red** (`fly-eye-red`, daylight `daylight-red`): Crashes only. The crashed-car fill on the track and the 2px strike through a crashed pedigree node.

### Neutral
- **Bench Green** (`bench-green`): Dark page ground; also the text colour on amber and on inverted (pressed/solid) buttons, and the daylight ink.
- **Specimen Tray** (`specimen-tray`, daylight `daylight-tray`): The track tray and the home preview tray. Nothing but the cars lives in it.
- **Tray Road** (`tray-road`, daylight `daylight-road`) with **Road Edge** (`road-edge`, daylight `daylight-road-edge`): The road surface and its dotted kerb on the canvas.
- **Chalk** (`chalk`): Dark-theme ink: text, button outlines, pedigree strokes, brain weights, ordinary cars.
- **Lichen** (`lichen-muted`, daylight `daylight-muted`): Secondary text: ledes, notes, readout labels, chart axis labels, "Coming" headings. Inside the How it works link, the Last round card and the write-up's figure plates, which sit on the tray colour, daylight uses the darker `daylight-muted-on-tray` to keep 4.5:1.
- **Slate Rule** (`slate-rule`, daylight `daylight-rule`): Hairline dividers, tray borders, chart reference lines, scrollbar.
- **Daylight Paper** (`daylight-paper`): Light-theme page ground.

### Named Rules
**The Agar Rule.** Amber means survived, leading, or what the leader is doing, and nothing else: the leader car, finished cars, the leader's pedigree node and readout, the finished-per-generation bars, the leader's outputs in words in the brain panel, the How it works link's and ghost caption's edge marks, the info explanations' edge marks, the write-up's section numbers, kicker and the finishing car's path, the parents in the Last round card, its update flash and mutated genes (the new material a child carries). If an element is not one of these, it is not amber.

**The Fly-Eye Rule.** Red appears only where a car crashed. No red for errors, warnings, emphasis or destructive buttons.

**The Sign-Is-Stroke Rule.** A weight's sign is drawn as a solid (positive) or dashed (negative, 4/4 dash) ink line, never as a hue. Magnitude is line width (0.6 to 2.2px) and live signal is opacity.

## Typography

**Display Font:** Saira Condensed 600/800 (with Arial Narrow, sans-serif), self-hosted
**Body Font:** Public Sans variable 100-900 (with Segoe UI, Roboto, sans-serif), self-hosted

**Character:** A condensed, stencil-plate display face for everything that is a label on the bench, set uppercase; a plain, sturdy grotesque for every sentence the player reads.

### Hierarchy
- **Display** (800, clamp(44px, 6vw, 72px), 0.92): Page titles (h1), uppercase, balanced wrap. Home intro runs clamp(40px, 5vw, 76px) at max 26ch.
- **Headline** (800, 48px): Featured game title on the home page; section headings on home step to 30px/800 with a 1.5px ink underline.
- **Title** (600, 22px, 0.08em, uppercase): Panel headings (h2) with a 1px rule beneath and 6px padding.
- **Numeral** (800, 34px, tabular): Big readouts (still driving, furthest car). The generation plate uses 22px/800 at 0.08em; every live number is tabular.
- **Body** (400, 16px, 1.5): Running text; log line capped at 70ch, feature copy at 46ch.
- **Lede** (400, 18px, muted): One-line page lede under the title, max 52ch.
- **Label** (600, 18px, 0.06em, uppercase): Buttons and the dial name. Lamp toggle at 16px.
- **Note** (400, 13-15px, muted): Panel notes, readout labels, key legend, chart labels.

### Named Rules
**The Plate Rule.** Anything that names, labels or counts is Saira Condensed uppercase; anything that explains is Public Sans sentence case.

## Layout

One 8px cell drives every gap and pad (multiples 2, 3, 4, 5, 6, 8, 10 in use). Content sits in a 1360px wrap with 48px side padding, 16px under 720px. The top strip is 64px tall (56px under 520px): wordmark left (on game pages it carries a back arrow and links to the arcade home), flexible spacer, (on the race page) a "How it works" link with a book icon, styled like the lamp and icon-only under 520px, generation plate, lamp toggle. Under 520px the strip's gap tightens to 8px and the wordmark drops to 19px so the plate is never clipped. The game page is a 2fr / 1fr grid (right column min 320px) with a 40px gap: stage left (title, lede, tray, controls, log), bench right (pedigree, readouts, brain, chart) stacked at 32px. Phones come first in the design: below 980px the two halves dissolve into one column in reading order (title, experiment brief, tray, live readouts, How it works link, controls, brain, commentary, Last round card, chart, pedigree), so the numbers and the brain sit right under the track. Under 520px the controls form two rows: speed, pause and restart, then Follow, Ghost race and New track sharing the width equally (Follow leader shortens to Follow). Under 380px the brain's outputs and their "What it does" heading move beneath the network. The home page features the live tray at 1.7fr / 1fr, collapsing at 860px; games are grouped into shelves by what they teach (How AI learns, Physical AI): each shelf has a 30px heading over an ink rule, a muted one-line description, its games, then a "Coming" list of planned games in 3 columns that stack under 860px. Trays and the home preview hold an 8:5 aspect ratio.

## Elevation & Depth

There are no shadows. Depth is tonal and stroked: the tray is a darker green set into the bench and outlined with a 1.5px rule, panels are separated by 1px hairlines, and emphasis comes from 1.5px ink rules and ink inversion (pressed buttons fill with ink). 

### Named Rules
**The Flat Bench Rule.** Nothing floats. No box-shadow, no glow, no blur; separate with tone and a rule line.

## Shapes

Hard rectangles throughout, radius 0 on every control and container. Lines are 1px hairlines for structure and 1.5px for ink (button outlines, plate border, tray border, pedigree strokes, emphasis rules). Cars, brain nodes and chart bars are rectangles. Circles and diamonds exist only as pedigree lineage marks.

### Named Rules
**The Lineage Mark Rule.** Pedigree and key marks are fixed: square = kept unchanged (elite), circle = bred from two parents, diamond = random newcomer, a 2px red diagonal strike = crashed, amber fill = the current leader. Cars echo it: kept = solid, child = solid at reduced opacity, newcomer = hollow outline. A ghost-race car is a dashed ink outline. Each round starts from a grid, in rows of five behind the start line, so every car is visible.

## Components

### Buttons
Ink-outlined plates, inverted when pressed.
- **Shape:** Square corners (0), 1.5px ink border, min height 44px, 0 16px padding.
- **Outline (default):** Transparent fill, ink label in the Label style.
- **Hover / Focus:** 12% ink tint fill (color-mix), 0.15s colour transition; active nudges down 1px; focus ring is a 2px outline at 2px offset.
- **Solid / Pressed:** Ink fill with ground-coloured label (primary Play link, the selected speed in a segment).
- **Segmented group:** Buttons butt together with a -1.5px overlap so borders share one stroke.
- **Icons:** Phosphor (regular weight), inlined as SVG in the label colour at 1.25em, 8px from any text. Icon only where the symbol is universal (pause/play, restart, theme, info), always with an accessible name and tooltip; icon plus text where a symbol alone is ambiguous (how it works, follow leader, ghost race, new track, breed another child). Numbers (speeds, population sizes) stay as text. Icon-only buttons are square (44px).

### Lamp Toggle
A compact square icon button (36px) in the top strip showing a sun (switches to light) or a moon (switches to dark), with a matching accessible name and tooltip. The choice persists; otherwise the system preference applies, and dark is the default.

### Generation Plate
A 1.5px ink-bordered plate (36px tall) reading GEN and a three-digit tabular number. The number flips up into place (0.32s, cubic-bezier(.16, 1, .3, 1)) on each new generation; this is one of only two chrome animations.

### Specimen Tray
The canvas container: tray fill, 1.5px slate rule border, 8:5 aspect, no chrome inside. On the home page the whole tray is the link to the game.

### Readout
A two-column definition list between hairlines: muted 13px label ("Still driving", "Furthest car") above an 800-weight 34px tabular numeral followed by its goal in 15px muted ("7 of 10", "0.42 of 2 laps"), so a distance never reads as a speed. The furthest-car value is amber ink.

### Info button
A borderless 32px (i) after a label (readouts, panel headings, Population, Mutation, the Last round card's top-right corner), muted until hovered or open. It toggles a short explanation directly under the label: 14px muted body text with a 3px amber left edge, capped at 62ch. Nothing pops over the race; the explanation pushes content down. In a readout, the opened one takes the whole row (the others move to the next row), so on a phone its explanation is not squeezed into one narrow column; its text stays 14px whatever size the numbers are.

### Dial (slider)
Uppercase Label-style name, native range input tinted ink, muted tabular value to the right on desktop, full-width input below on narrow screens.

### Pedigree (signature)
Headed "Family tree" on the page. Three generations of the leader's family as an SVG in chalk 1.5px strokes using the lineage marks, with orthogonal elbow links and tabular score labels beneath each node. Each generation the previous family slides up a row and the new leader settles in (0.55s, cubic-bezier(.16, 1, .3, 1)). A key beneath repeats the marks at 14px.

### Brain Panel
The network drawn live: square nodes (14px) filled by activation, a ground-coloured dash through negative nodes, weight lines in ink obeying the Sign-Is-Stroke Rule. Muted 11px uppercase column heads ("What it senses", "8 hidden", "What it does"). Each input label adds a plain word for its value (clear, far, near, close; slow, cruising, fast); each output shows its number in ink with a word beneath in amber ink (turning left, going straight, turning right; speeding up, coasting, braking). Under 380px the outputs move beneath the network.

### How It Works Link
Directly under the tray: a tray-coloured block with a 3px amber left edge, linking to the write-up. A book icon, an uppercase display "How it works" (20px/800) over one muted line ("What you are watching, step by step, with pictures. 5 min read."), and a trailing arrow that nudges right on hover. The race page no longer has a guided tour or voiceover; explaining lives in the write-up and in the info buttons.

### Write-up (How it works)
`games/racer/how-it-works/` and `games/teach/how-it-works/` read like lab reports and share `story.css`. One 680px reading column of 18px body text (17px under 720px) at 1.65 line height; an amber-ink uppercase kicker, an h1 at clamp(40px, 6vw, 64px), a 20px lede and a muted meta line (read time, "Watch it live" link). Eleven numbered steps: an amber-ink display number ("01") over a 30px uppercase heading. Figures are tray-coloured plates with a 1.5px rule border and a caption under a hairline that starts with a bold uppercase "Fig. N". Plates holding tracks or small multiples break out of the column to 1040px, centred on it; the opening race plate is also capped so its height fits the window. Every figure is drawn from one seeded run of the real simulation (seed 307), so the pictures match the words; animated figures run only while on screen and stand still under reduced motion. Small multiples are 8:5 mini tracks: the path in ink (amber for the car that finished), a red cross where a car crashed, an ink ring where it stalled; they draw themselves out over 2.4s the first time they scroll into view. The genome figure shows 74 squares: filled = positive, outlined = negative, stronger = darker. The practitioners' section is a `details` box between an ink rule and a hairline, with a +/− marker. The page ends with three numbered experiments and a solid "Open the live experiment" button.

### Experiment Brief
Under the page title, three columns between a top hairline and vertical hairlines: an amber-ink uppercase label (The setup, The rule, Watch for) over one 15px sentence each. Under 640px the three stack as label-and-sentence rows. The setup sentence follows the chosen population.

### Ghost Caption
One line of 17px body text (14px under 760px) on a ground-coloured plate with a 3px amber left edge, pinned 12px from the tray's bottom-left, shown only during a ghost race.

### Population Picker
A segmented row of four buttons (5, 10, 20, 50) after the Population label, with a muted 14px hint that wraps beside it on desktop and sits below it on narrow screens.

### Last Round Card
A tray-coloured card with a 1.5px slate border under the controls, updated the moment a round ends; the race never stops for it. Its border flashes amber and fades back over 0.6s on each update. An uppercase display headline ("Last round · generation N: X of 10 finished"), then two columns (stacked under 760px). Left: every car ranked, each with an 8px distance bar, laps and its role; parents are full ink with amber bars, the rest drop to 45% opacity. Right: "How a child is made", three DNA strips of 74 cells in two rows of 37 (solid ink = first parent, ink outline = second parent, amber = mutated) with a key. Up to 12 cars are listed, then "and N more with no children". Before the first round ends it holds a one-line empty state.

### Ghost Race
The best brain of generation 1 drives as a dashed ink outline beside the latest best (the amber leader), both from the start line, each with a small name tag ("Gen 1", "Gen N") on a tray-coloured plate.

### Per-Generation Bars
Amber bars on a slate baseline with a dashed slate reference line at the maximum, muted Gen labels at each end.

### Teach by Driving
Same page structure as the racer, reusing its styles (`games/racer/racer.css`) plus `games/teach/teach.css`. Under the brief, a three-step strip (You drive, It learns, It drives) between hairlines: numbered squares, the current step's square filled amber with dark text and its label in ink, the others muted. The plate in the top strip reads "Step 1", "Step 2" or "Step 3". Directly under the tray, two equal hold-to-steer buttons (64px tall, caret icon plus label) that invert while held, under one 14px line saying what they do right now (muted; ink and 600 weight for "Take the wheel" while the brain drives); they are disabled (40% opacity) while it learns, while a step is being announced, between drives and once it is done; they take no touch scrolling or text selection. The track canvas is also a steering pad (touch-action none): slide sideways to steer in proportion. While a car is moving the tray shows a driver's view: zoom 3×, the world turned so the car points up, the car 70% of the way down, smoothed heading; a whole-track minimap (road, red crash crosses, amber car square) sits top-right on a translucent tray-coloured plate, and a steering gauge (hairline with a centre tick and a 6×14 marker, ink when you steer, amber when the brain does) runs along the bottom. While it learns and after a crash or finish, the tray shows the whole track. Every change of step is announced in the tray's caption (the same plate as the start prompt) and held for 2.5 seconds before the step starts: the lap is over and step 2 is next; the pass count while it learns; step 3 is next; how the brain's drive ended. The strip and plate switch to the new step as the caption appears. Teaching tracks have a wider road (85 against the racer's 54) with gentler bends; the road and its dashed edges are drawn at each track's own width. A red cross marks every crash until the track changes. Readouts run in three columns (Examples, Loss, Distance). The brain panel adds one muted line under the network: "You: … · Its guess: …" while you drive. The chart panel holds a loss line (ink, 2px, a 6px square on the latest point) from "Start" (the untrained loss) to "N passes", scaled from zero; a retrain adds its own starting point, so new corrections show as a bump. Retrain is the one solid button, disabled until you have added corrections, and shows how many ("Retrain (+120)"). New track and Drive again (a circular-arrow icon and label) sit beside it; on phones Retrain takes its own row and the other two share the next. Step 3 ends parked, with the caption held, after two clean laps on a track it has never seen.

### Loss Line
`drawLine` in `engine/curve.js`: a zero-based line chart with the top value in muted text at the top left, a hairline baseline, and "Start" and "N passes" under the ends. Charts meant to be compared pass a shared `max`.

## Do's and Don'ts

### Do:
- **Do** reserve amber for the uses listed in the Agar Rule.
- **Do** use red only for crashes (car fill, pedigree strike).
- **Do** encode weight sign as solid (positive) vs dashed (negative) ink lines.
- **Do** use the lineage marks exactly: square kept, circle bred, diamond newcomer, red strike crashed.
- **Do** keep every corner at 0 and every gap on the 8px cell.
- **Do** set display, labels and buttons in Saira Condensed uppercase; body in Public Sans.
- **Do** ship both themes from the same tokens, dark bench by default, with the Light/Dark lamp toggle.
- **Do** keep chrome still: only the plate number flip, the pedigree row slide and the Last round card's border flash animate.

### Don't:
- **Don't** add shadows, glows, blur or gradients.
- **Don't** introduce a third signal hue, or colour-code weights, lineage or car state.
- **Don't** round corners on any control, tray or panel.
- **Don't** put chrome, labels or overlays inside the specimen tray; it holds only the track and the cars.
- **Don't** build the dark neon "AI dashboard" look with a glowing network in a side card.
