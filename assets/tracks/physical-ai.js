// Track: Physical AI. Lessons live only here (names, order, status).
export default {
  id: 'physical-ai',
  title: 'Physical AI',
  blurb: 'How robots learn to move, steer and stay upright.',
  game: 'balance',
  parts: [
    {
      title: 'Feedback',
      lessons: [
        { id: 'pid', title: 'PID control', game: 'balance', video: 'drtqgVse4jo', status: 'live',
          shareAlt: "PID, explained: a car's speed on a hill, P alone against P plus I",
          says: 'A PID controller steers by mixing three looks at the error: how big it is now, how long it has lasted, and how fast it is changing.',
          wild: [
            { game: 'balance', show: false, says: 'Its "A PID with three dials" mode: tune P, I and D yourself, then let evolution tune them.' },
          ] },
      ],
    },
  ],
};
