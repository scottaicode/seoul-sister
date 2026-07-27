#!/bin/bash
# Regenerate "Posting Frequency & Reposts" (PDF + DOCX) for Bailey.
#
# Source: ../POSTING-FREQUENCY-AND-REPOSTS.md — unlike the main playbook, this
# doc has NO separate Bailey-facing copy. It was written to her from the start,
# so the tracked .md IS the source. Edit that file, then re-run this.
#
# Usage:  ./bailey/guide-src/build-frequency-doc.sh
# Output: bailey/Posting-Frequency-And-Reposts.{pdf,docx} + ~/Downloads copies
#
# Requires: pandoc (brew install pandoc) + Google Chrome (for PDF).
# Same Chrome-headless route as build.sh — pandoc's native PDF path needs
# LaTeX, which is not installed here. Do not "simplify" to `pandoc -o out.pdf`.

set -euo pipefail
cd "$(dirname "$0")"

SRC="../POSTING-FREQUENCY-AND-REPOSTS.md"
REPO_OUT="$(cd .. && pwd)/Posting-Frequency-And-Reposts"
OUT="$HOME/Downloads/Posting-Frequency-And-Reposts"
CHROME="/Applications/Google Chrome.app/Contents/MacOS/Google Chrome"

command -v pandoc >/dev/null || { echo "pandoc not found: brew install pandoc"; exit 1; }
[ -f "$SRC" ] || { echo "source not found: $SRC"; exit 1; }

# No --toc: this is a short read, and a table of contents on a 5-page doc
# just adds a page she has to scroll past.
pandoc "$SRC" -o "$OUT.docx"
echo "wrote $OUT.docx"
cp "$OUT.docx" "$REPO_OUT.docx" && echo "wrote $REPO_OUT.docx"

# No --metadata title: the markdown already opens with its own H1, and passing
# a title makes pandoc render a second one above it (verified — the first PDF
# build had the heading twice). The <title> tag is cosmetic here since the
# output is a PDF, not a web page.
pandoc "$SRC" -o /tmp/freq.html --standalone -c style.css

python3 - <<'PY'
html = open('/tmp/freq.html').read()
css = open('style.css').read()
html = html.replace('<link rel="stylesheet" href="style.css" />', '<style>' + css + '</style>')
# The shared stylesheet forces a page break before every h1 (right for the
# 29-script playbook, wrong for a 5-page read — it would strand each short
# section on its own page). Keep breaks off; just protect tables/quotes.
html = html.replace(
    'h1{font-size:20pt;color:#8B2942;border-bottom:2px solid #D4A574;padding-bottom:6px;margin-top:28px;page-break-before:always}',
    'h1{font-size:20pt;color:#8B2942;border-bottom:2px solid #D4A574;padding-bottom:6px;margin-top:26px}')
html = html.replace(
    '@media print{h1{page-break-before:always}h1:first-of-type{page-break-before:avoid}blockquote,table{page-break-inside:avoid}}',
    '@media print{blockquote,table{page-break-inside:avoid}h1,h2,h3{page-break-after:avoid}}')
open('/tmp/freq_inline.html', 'w').write(html)
PY

if [ -x "$CHROME" ]; then
  "$CHROME" --headless --disable-gpu --no-pdf-header-footer \
    --print-to-pdf="$OUT.pdf" "file:///tmp/freq_inline.html" 2>/dev/null
  echo "wrote $OUT.pdf"
  cp "$OUT.pdf" "$REPO_OUT.pdf" && echo "wrote $REPO_OUT.pdf"
else
  echo "Chrome not found; DOCX written but PDF skipped."
fi
