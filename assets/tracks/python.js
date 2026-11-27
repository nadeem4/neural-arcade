// Colours lesson code at page-generation time, so the browser runs no highlighter.
// shortcut: covers the Python the lesson write-ups use (no triple-quoted strings, no f-string parts), extend the grammar when a lesson needs more.
const TOKEN = /&#?\w+;|(#.*)|("[^"\n]*"|'[^'\n]*')|\b(def|return|for|in|while|not|or|and|if|else|elif|True|False|None|import|from|as|lambda)\b|\b(\d+(?:\.\d+)?)\b|\b([A-Za-z_]\w*)(?=\()/g;
const CLASS = ['', 'tc', 'ts', 'tk', 'tn', 'tf'];

// `code` is already HTML-escaped; entities pass through untouched.
export function highlightPython(code) {
  return code.replace(TOKEN, (m, ...g) => {
    const i = g.slice(0, 5).findIndex(x => x !== undefined) + 1;
    return i ? `<span class="${CLASS[i]}">${m}</span>` : m;
  });
}
