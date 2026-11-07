// Click-to-play YouTube facade: the page shows a local thumbnail button; nothing is requested
// from YouTube until it is clicked. Markup: <div class="video" data-youtube="ID" data-title="..."><button class="video-play">...</button></div>

export function embedUrl(id) {
  if (!/^[\w-]{6,20}$/.test(id)) throw new Error('Not a YouTube id: ' + id);
  return `https://www.youtube-nocookie.com/embed/${id}?autoplay=1&rel=0`;
}

export function iframeAttrs(id, title) {
  return {
    src: embedUrl(id), title,
    allow: 'autoplay; encrypted-media; picture-in-picture; fullscreen',
    allowfullscreen: true,
  };
}

export function initVideos(root = document) {
  for (const box of root.querySelectorAll('.video[data-youtube]')) {
    box.querySelector('.video-play')?.addEventListener('click', () => {
      const a = iframeAttrs(box.dataset.youtube, box.dataset.title || 'Video');
      const f = document.createElement('iframe');
      for (const [k, v] of Object.entries(a)) f.setAttribute(k, v === true ? '' : v);
      box.replaceChildren(f);
      f.focus();
    }, { once: true });
  }
}

if (typeof document !== 'undefined') initVideos();
