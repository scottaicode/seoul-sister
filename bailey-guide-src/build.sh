#!/bin/bash
# Regenerate Bailey's TikTok Playbook (PDF + DOCX) from bailey-guide.md
#
# The .md files in the repo root are the WORKING SOURCE (script bank, strategy,
# competitor teardowns). bailey-guide.md in THIS directory is the assembled,
# Bailey-facing version — written in her second person, no internal jargon.
# They are maintained separately on purpose; edit both when a script changes.
#
# Usage:  ./bailey-guide-src/build.sh
# Output: ~/Downloads/Baileys-TikTok-Playbook.{pdf,docx}
#
# Requires: pandoc (brew install pandoc) + Google Chrome (for PDF).
# NOTE: pandoc's own PDF path needs LaTeX, which is NOT installed here — hence
# the Chrome headless route. Do not "simplify" this to `pandoc -o out.pdf`.

set -euo pipefail
cd "$(dirname "$0")"

OUT="$HOME/Downloads/Baileys-TikTok-Playbook"
CHROME="/Applications/Google Chrome.app/Contents/MacOS/Google Chrome"

command -v pandoc >/dev/null || { echo "pandoc not found: brew install pandoc"; exit 1; }

# DOCX — pandoc handles this directly
pandoc bailey-guide.md -o "$OUT.docx" --toc --toc-depth=1
echo "wrote $OUT.docx"

# PDF — via styled HTML + headless Chrome
pandoc bailey-guide.md -o /tmp/bg.html --standalone --toc --toc-depth=1 \
  --metadata title="Bailey's TikTok Playbook" -c style.css

python3 - <<'PY'
html = open('/tmp/bg.html').read()
css = open('style.css').read()
html = html.replace('<link rel="stylesheet" href="style.css" />', '<style>' + css + '</style>')
# Page-break tuning: break before each numbered section, never before the opener
html = html.replace(
    'h1{font-size:20pt;color:#8B2942;border-bottom:2px solid #D4A574;padding-bottom:6px;margin-top:28px;page-break-before:always}',
    'h1{font-size:20pt;color:#8B2942;border-bottom:2px solid #D4A574;padding-bottom:6px;margin-top:30px}')
html = html.replace(
    '@media print{h1{page-break-before:always}h1:first-of-type{page-break-before:avoid}blockquote,table{page-break-inside:avoid}}',
    '@media print{h1{page-break-before:always;break-before:page}h1#start-here{page-break-before:avoid;break-before:avoid}blockquote,table,h2{page-break-inside:avoid}h2,h3{page-break-after:avoid}}')
open('/tmp/bg_inline.html', 'w').write(html)
PY

if [ -x "$CHROME" ]; then
  "$CHROME" --headless --disable-gpu --no-pdf-header-footer \
    --print-to-pdf="$OUT.pdf" "file:///tmp/bg_inline.html" 2>/dev/null
  echo "wrote $OUT.pdf"
else
  echo "Chrome not found; DOCX written but PDF skipped."
fi
