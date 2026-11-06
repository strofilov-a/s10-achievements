#!/bin/sh
# sh tools/zip.sh <out dir> — the two archives for the S10 developers, from release/ (run the builds and the tests first)
#   s10-achievements-backend-<id>.zip   release/backend: the PHP code, the tables, the catalog, the brief
#   s10-achievements-frontend-<id>.zip  release/frontend: achievements.js, the page shell, the brief, the API
set -e
ROOT=$(cd "$(dirname "$0")/.." && pwd)
OUT=${1:?out dir}
mkdir -p "$OUT"
ID=$(cd "$ROOT" && git rev-parse --short HEAD)
for part in backend frontend; do
  [ -f "$ROOT/release/$part/README.md" ] || { echo "no release/$part/README.md"; exit 1; }
  rm -f "$OUT"/s10-achievements-$part-*.zip
  (cd "$ROOT/release" && zip -qr -X "$OUT/s10-achievements-$part-$ID.zip" "$part" -x '*.DS_Store')
  echo "$OUT/s10-achievements-$part-$ID.zip"
done
