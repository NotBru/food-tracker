#!/usr/bin/env bash
# Compile GitHub-flavoured markdown (with $…$ / $$…$$ math) into a single self-contained HTML file:
# GitHub styling, math pre-rendered with KaTeX, fonts and CSS inlined — no network needed to view it.
#
#   ./md2html.sh notes.md [more.md ...]   writes notes.html (etc.) next to each input
#   ./md2html.sh notes.md -o out.html     one input, explicit output
#
# First run installs markdown-it, KaTeX and github-markdown-css into ~/.cache/md2html (needs npm access).
# For a PDF, open the HTML in a browser and Print → Save as PDF (it prints dark-on-white).
set -euo pipefail

# Shells started outside zsh lack fnm's PATH.
export PATH="$HOME/.fnm/aliases/default/bin:$PATH"
command -v node >/dev/null || { echo "node not found" >&2; exit 1; }

CACHE="${XDG_CACHE_HOME:-$HOME/.cache}/md2html"
DEPS=(markdown-it@14.1.0 markdown-it-texmath@1.0.0 katex@0.16.22 github-markdown-css@5.8.1)

[[ $# -ge 1 ]] || { sed -n '2,9p' "$0" | sed 's/^# \{0,1\}//'; exit 1; }
OUT=
if [[ $# -eq 3 && "$2" == "-o" ]]; then OUT="$3"; set -- "$1"; fi

mkdir -p "$CACHE"
if [[ ! -f "$CACHE/.installed" ]] || [[ "$(cat "$CACHE/.installed")" != "${DEPS[*]}" ]]; then
  echo "Installing renderer into $CACHE ..." >&2
  (cd "$CACHE" && { [[ -f package.json ]] || echo '{"private":true}' > package.json; } \
    && npm install --silent --no-audit --no-fund "${DEPS[@]}")
  echo "${DEPS[*]}" > "$CACHE/.installed"
fi

cat > "$CACHE/render.js" <<'JS'
// node render.js <in.md> <out.html>
const fs = require('fs');
const path = require('path');
const katex = require('katex');
const md = require('markdown-it')({ html: true, linkify: true })
  .use(require('markdown-it-texmath'), { engine: katex, delimiters: 'dollars', katexOptions: { throwOnError: false } });

const [inFile, outFile] = process.argv.slice(2);
const src = fs.readFileSync(inFile, 'utf8');
const esc = s => s.replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
const title = (src.match(/^#\s+(.+)$/m) || [, path.basename(inFile, '.md')])[1].trim();

const nm = path.join(__dirname, 'node_modules');
const ghCss = fs.readFileSync(path.join(nm, 'github-markdown-css/github-markdown.css'), 'utf8');
const katexDir = path.join(nm, 'katex/dist');
// Inline KaTeX's woff2 fonts (every current browser takes woff2) and drop the woff/ttf fallbacks.
const katexCss = fs.readFileSync(path.join(katexDir, 'katex.min.css'), 'utf8')
  .replace(/src:url\((fonts\/[^)]+\.woff2)\) format\("woff2"\)(,url\([^)]+\) format\("[^"]+"\))*/g, (_, f) =>
    `src:url(data:font/woff2;base64,${fs.readFileSync(path.join(katexDir, f)).toString('base64')}) format("woff2")`);

fs.writeFileSync(outFile, `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${esc(title)}</title>
<!-- Compiled from ${esc(path.basename(inFile))} by md2html.sh -->
<style>${ghCss}</style>
<style>${katexCss}</style>
<style>
  :root { color-scheme: light dark; }
  body { margin: 0; background: #ffffff; }
  @media (prefers-color-scheme: dark) { body { background: #0d1117; } }
  .markdown-body { box-sizing: border-box; max-width: 980px; margin: 0 auto; padding: 45px 16px; }
  @media (min-width: 768px) { .markdown-body { padding: 45px; } }
  .markdown-body eq { display: inline; }
  .markdown-body eqn { display: block; overflow-x: auto; overflow-y: hidden; }
  @media print {
    :root { color-scheme: light; }
    body, .markdown-body { background: #ffffff !important; color: #1f2328 !important; }
    .markdown-body { padding: 0; }
  }
</style>
</head>
<body>
<article class="markdown-body">
${md.render(src)}</article>
</body>
</html>
`);
JS

for f in "$@"; do
  [[ -f "$f" ]] || { echo "no such file: $f" >&2; exit 1; }
  out="${OUT:-${f%.md}.html}"
  node "$CACHE/render.js" "$f" "$out"
  echo "$f -> $out"
done
