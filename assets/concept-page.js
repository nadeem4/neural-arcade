// Shared builders for the lesson pages (concepts/<id>/): the video facade, the tries list and its wiring.

export const esc = s => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

const PLAY = '<svg class="ic" aria-hidden="true" focusable="false" viewBox="0 0 256 256" fill="currentColor"><path d="M232.4,114.49,88.32,26.35a16,16,0,0,0-16.2-.3A15.86,15.86,0,0,0,64,39.87V216.13A15.94,15.94,0,0,0,80,232a16.07,16.07,0,0,0,8.36-2.35L232.4,141.51a15.81,15.81,0,0,0,0-27ZM80,215.94V40l143.83,88Z"/></svg>';

export const videoHtml = concept => concept.youtube
  ? `<div class="video" data-youtube="${esc(concept.youtube)}" data-title="${esc(concept.title)}"><button class="video-play" type="button"><img src="https://i.ytimg.com/vi/${esc(concept.youtube)}/hqdefault.jpg" width="480" height="360" loading="lazy" alt=""><span class="video-label">${PLAY}Watch: ${esc(concept.title)}</span></button></div>`
  : '';

export const triesHtml = presets => presets.map((p, i) =>
  `<li><button type="button" data-preset="${i}">${esc(p.label)}</button> ${esc(p.text)}</li>`).join('');

export function wireTries(root, presets, apply) {
  root.addEventListener('click', e => {
    const b = e.target.closest('[data-preset]');
    if (b) apply(presets[Number(b.dataset.preset)].state);
  });
}
