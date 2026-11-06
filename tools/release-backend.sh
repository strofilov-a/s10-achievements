#!/bin/sh
# sh tools/release-backend.sh — release/backend for the S10 backend developer: the code, its tests and what they read
# (the contract and the catalog), with backend/README.md as the brief on top. Runs the tests inside the copy.
set -e
ROOT=$(cd "$(dirname "$0")/.." && pwd)
OUT="$ROOT/release/backend"
rm -rf "$OUT"; mkdir -p "$OUT"
rsync -a --exclude 'dev/var/' --exclude '.DS_Store' "$ROOT/backend" "$OUT/"
rsync -a "$ROOT/catalog" "$OUT/"
cp "$ROOT/docs/TZ.md" "$ROOT/docs/TZ.pdf" "$OUT/"
mkdir -p "$OUT/contract"; rsync -a "$ROOT/contract/API.md" "$ROOT/contract/mock" "$OUT/contract/"
{ printf '%s\n\n' "> Все пути ниже — внутри папки \`backend/\`. Рядом лежат \`contract/\` (API и примеры ответов) и \`catalog/\` (каталог), их читают тесты."; cat "$ROOT/backend/README.md"; } > "$OUT/README.md"
(cd "$OUT" && php backend/tests/run.php | tail -1)
