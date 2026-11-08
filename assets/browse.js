// The browse page's URL state, kept pure so it can be tested; the page wiring (added below) only runs in a browser.
export function parseQuery(search) {
  const p = new URLSearchParams(search);
  const page = parseInt(p.get('page'), 10);
  return {
    q: p.get('q') ?? '',
    category: p.get('c') ?? '',
    sort: p.get('sort') === 'az' ? 'az' : 'newest',
    page: page >= 1 ? page : 1,
  };
}

export function toQuery({ q, category, sort, page }) {
  const p = new URLSearchParams();
  if (q) p.set('q', q);
  if (category) p.set('c', category);
  if (sort !== 'newest') p.set('sort', sort);
  if (page > 1) p.set('page', page);
  const s = p.toString();
  return s ? '?' + s : '';
}
