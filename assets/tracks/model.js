// Pure lesson model over the track configs: numbering, links, chips and validation. No DOM.
import { TRACKS } from './index.js';
import { GAMES } from '../games.js';

// Every lesson in order, with its place in its track and its game resolved.
export function flatLessons(tracks = TRACKS) {
  const out = [];
  for (const track of tracks) {
    const total = track.parts.reduce((s, p) => s + p.lessons.length, 0);
    let n = 0;
    track.parts.forEach((part, partIndex) => {
      for (const lesson of part.lessons) {
        n += 1;
        out.push({
          ...lesson, trackId: track.id, trackTitle: track.title, partTitle: part.title, partIndex,
          n, total, game: lesson.game ?? track.game, whole: lesson.level == null,
        });
      }
    });
  }
  return out;
}

export const lessonById = (id, tracks = TRACKS) => flatLessons(tracks).find(l => l.id === id);

export const lessonLabel = (l, sep = ': ') => `Lesson ${l.n}${sep}${l.title}`;
export const lessonHref = (l, base) => `${base}concepts/${l.id}/`;
export const trackHref = (id, base) => `${base}${id}/`;

// The live lessons either side of one, in its own track (soon lessons have no page).
export function neighbours(id, tracks = TRACKS) {
  const me = lessonById(id, tracks);
  const live = flatLessons(tracks).filter(l => l.trackId === me?.trackId && l.status === 'live');
  const i = live.findIndex(l => l.id === id);
  return { prev: live[i - 1] ?? null, next: live[i + 1] ?? null };
}

export function trackCounts(track) {
  const lessons = track.parts.flatMap(p => p.lessons);
  const live = lessons.filter(l => l.status === 'live').length;
  return { total: lessons.length, live, soon: lessons.length - live };
}

// The chips a game page shows: its live lessons, as "Lesson N: Title", with the game's own line when there is one.
export function chipsForGame(gameId, tracks = TRACKS) {
  return flatLessons(tracks)
    .filter(l => l.status === 'live')
    .map(l => ({ l, wild: (l.wild ?? []).find(w => w.game === gameId) }))
    .filter(({ l, wild }) => wild || l.game === gameId)
    .map(({ l, wild }) => ({ id: l.id, label: lessonLabel(l), href: `concepts/${l.id}/`, says: wild?.says ?? null }));
}

// Tracks with a live lesson that teaches with a game, as the lesson's game or in its wild list, in track order.
export function tracksOfGame(gameId, tracks = TRACKS) {
  const ids = new Set(flatLessons(tracks)
    .filter(l => l.status === 'live')
    .filter(l => l.game === gameId || (l.wild ?? []).some(w => w.game === gameId))
    .map(l => l.trackId));
  return tracks.filter(t => ids.has(t.id));
}

// A game page's "More games": the other games that share a track with it, newest first, topped up with the newest other games.
export function moreGames(game, games, tracks = TRACKS, max = 3) {
  const byNewest = (a, b) => b.added.localeCompare(a.added) || a.title.localeCompare(b.title);
  const mine = tracksOfGame(game.id, tracks);
  const others = games.filter(g => g.id !== game.id).sort(byNewest);
  const sharing = others.filter(g => tracksOfGame(g.id, tracks).some(t => mine.includes(t)));
  return [...sharing, ...others.filter(g => !sharing.includes(g))].slice(0, max);
}

export const lessonOfLevel = (gameId, id, tracks = TRACKS) =>
  flatLessons(tracks).find(l => l.game === gameId && l.level === id);

// The lesson's own video, else the game's video for a whole-game lesson.
export function lessonVideo(lesson, games = GAMES) {
  if (lesson.video) return lesson.video;
  return lesson.whole ? games.find(g => g.id === lesson.game)?.youtube ?? null : null;
}

// Every problem with the config as a message; empty when it is valid.
export function validateTracks(tracks, games, builtLevels) {
  const errs = [];
  const gameIds = new Set(games.map(g => g.id));
  const checkGame = (game, where) => { if (!gameIds.has(game)) errs.push(`${where}: unknown game ${game}`); };
  const trackIds = new Set();
  const lessonIds = new Set();

  for (const track of tracks) {
    if (trackIds.has(track.id)) errs.push(`duplicate track id ${track.id}`);
    trackIds.add(track.id);
    if (track.game != null) checkGame(track.game, `track ${track.id}`);
    for (const lesson of track.parts.flatMap(p => p.lessons)) {
      const at = `lesson ${lesson.id}`;
      if (lessonIds.has(lesson.id)) errs.push(`duplicate lesson id ${lesson.id}`);
      lessonIds.add(lesson.id);
      if (lesson.status !== 'live' && lesson.status !== 'soon') errs.push(`${at}: bad status ${lesson.status}`);
      const game = lesson.game ?? track.game;
      if (lesson.level == null && !lesson.game) errs.push(`${at}: needs a level or a game`);
      if (lesson.game) checkGame(lesson.game, at);
      if (lesson.level != null && lesson.level !== lesson.id) errs.push(`${at}: level ${lesson.level} must be its own id`);
      if (lesson.status === 'live' && lesson.level != null && game) {
        const built = builtLevels[game];
        if (!built) errs.push(`${at}: no built levels for game ${game}`);
        else if (!built.includes(lesson.level)) errs.push(`${at}: level ${lesson.level} is not a built level of ${game}`);
      }
      if (lesson.question !== undefined && !(typeof lesson.question === 'string' && lesson.question.endsWith('?'))) errs.push(`${at}: question must end in "?"`);
      if (lesson.video !== null && !/^[\w-]{11}$/.test(lesson.video ?? '')) errs.push(`${at}: video must be null or an 11-character id`);
      for (const w of lesson.wild ?? []) {
        checkGame(w.game, `${at} wild`);
        if (typeof w.says !== 'string' || !w.says.trim()) errs.push(`${at} wild ${w.game}: says must be a non-empty string`);
        if (typeof w.show !== 'boolean') errs.push(`${at} wild ${w.game}: show must be true or false`);
      }
    }
  }

  for (const track of tracks) {
    const own = new Set(track.parts.flatMap(p => p.lessons.map(l => l.id)));
    for (const need of track.needs ?? []) {
      if (!trackIds.has(need.track)) errs.push(`track ${track.id} needs track ${need.track}, which does not exist`);
      if (!own.has(need.before)) errs.push(`track ${track.id} needs: lesson ${need.before} does not exist`);
    }
  }
  return errs;
}
