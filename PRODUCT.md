# Product

<!-- impeccable:product-schema 1 -->

## Platform

web

## Stack

Static site: plain HTML, CSS and vanilla JavaScript ES modules, no framework, no build step, no ML library. Vitest is the only dev dependency (engine tests). Hosted as its own Vercel project at arcade.codewithnk.com and linked from codewithnk.com's Live Projects.

## Users

Anyone curious about how neural networks learn: people who have never seen training happen, and ML practitioners who know the theory and want intuition. Copy must be understandable without ML background, yet never wrong or dumbed down for an expert. It should feel like play, not a lesson.

## Product Purpose

Small browser games where tiny neural networks learn in front of you, and the player is part of the training loop instead of a spectator. Each game teaches exactly one ML concept, so the arcade doubles as a curriculum. Success: a player changes a lever, sees the consequence in the learning, and can say why.

## Positioning

"AI learns to drive" videos can only be watched. Here the player sets the fitness, mutation rate, track or data, and every neuron and weight is drawn live, because networks stay tiny (under 200 weights).

## Capabilities and Constraints

- One concept per game; the network is always visible; the player always has a lever that changes training; each game has a way to break learning on purpose.
- Runs on a phone browser; under 1M multiply-adds per frame at the fastest speed.
- First game: Neural Racer (neuroevolution: 50 cars, 5 distance sensors + speed, 6→8→2 tanh net, 74 weights; elitism, crossover, mutation; New track tests overfitting).
- Built: Neural Racer, Teach by Driving, Coin Runner. The home page groups games into two shelves. **How AI learns** (evolution, copying examples, trial and error): Neural Racer, Teach by Driving, Coin Runner (an original Mario-style platformer learned from reward; teaches reward hacking). **Physical AI** (a brain with a body: lag, noisy sensors, wind, sim to real): coming: Hover, Balance, The real world. Earlier ideas (Flappy Flock, Snake Gym, Loss Golf, Boundary Builder, Predators and Prey, Feature Detector, Lunar Lander) are dropped from the home page for now. Direction: childhood games rebuilt with AI inside, always with original art and names (never a real game's name, characters or assets).
- Undecided: leaderboards (deferred, needs shared state), share-a-brain links, Breeder mode.

## Brand Commitments

Name: Neural Arcade. Part of Nadeem's codewithnk.com body of work.

## Evidence on Hand

Neural Racer v1 (working prototype). No user metrics, testimonials or play counts exist; do not invent any.

## Product Principles

- The learning is the show: the brain and its consequences take the stage, chrome recedes.
- Every control changes training, not just playback.
- Failure is a lesson: breaking learning on purpose is a feature.
- Plain words first, the real term second.
