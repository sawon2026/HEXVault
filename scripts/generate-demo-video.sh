#!/usr/bin/env bash
# Generate HEXVault demo video from guide SVGs
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
FRAMES=$(mktemp -d)
trap 'rm -rf "$FRAMES"' EXIT

mkdir -p "$ROOT/assets/video"

for i in 01-setup 02-add-memory 03-github-action 04-dashboard 05-ci-cd; do
  convert -background '#0F172A' -density 150 "$ROOT/assets/guides/${i}.svg" \
    -resize 1280x720 -gravity center -extent 1280x720 "$FRAMES/${i}.png"
done

convert -background '#0F172A' -density 150 "$ROOT/assets/hexvault-banner.svg" \
  -resize 1280x720 -gravity center -extent 1280x720 "$FRAMES/00-intro.png"

convert -size 1280x720 xc:'#0F172A' \
  -gravity center -fill '#F8FAFC' -pointsize 48 -annotate +0-40 'HEXVault' \
  -fill '#94A3B8' -pointsize 28 -annotate +0+30 'github.com/sawon2026/HEXVault' \
  "$FRAMES/06-outro.png"

LIST="$FRAMES/list.txt"
cat > "$LIST" << EOF
file '$FRAMES/00-intro.png'
duration 3
file '$FRAMES/01-setup.png'
duration 5
file '$FRAMES/02-add-memory.png'
duration 5
file '$FRAMES/03-github-action.png'
duration 6
file '$FRAMES/04-dashboard.png'
duration 5
file '$FRAMES/05-ci-cd.png'
duration 5
file '$FRAMES/06-outro.png'
duration 4
file '$FRAMES/06-outro.png'
EOF

ffmpeg -y -f concat -safe 0 -i "$LIST" \
  -vf "fps=30,format=yuv420p" -c:v libx264 -preset medium -crf 23 \
  -movflags +faststart "$ROOT/assets/video/hexvault-demo.mp4"

ffmpeg -y -i "$ROOT/assets/video/hexvault-demo.mp4" \
  -vf "fps=4,scale=640:-1:flags=lanczos,split[s0][s1];[s0]palettegen=max_colors=64[p];[s1][p]paletteuse" \
  -loop 0 "$ROOT/assets/video/hexvault-demo.gif"

echo "Done → assets/video/hexvault-demo.mp4 and .gif"
