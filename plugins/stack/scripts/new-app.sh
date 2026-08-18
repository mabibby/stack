#!/usr/bin/env bash
# Copies the template into a new directory and stamps the app name/title.
# Usage: new-app.sh <app-name-kebab> "<App Title>" [destination-dir]
set -euo pipefail

NAME="${1:-}"
TITLE="${2:-}"
DEST="${3:-$NAME}"
HERE="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
TEMPLATE="$HERE/../template"

if [[ -z "$NAME" || -z "$TITLE" ]]; then
  echo "usage: new-app.sh <app-name-kebab> \"<App Title>\" [destination-dir]" >&2; exit 2
fi
if ! [[ "$NAME" =~ ^[a-z][a-z0-9-]{1,38}$ ]]; then
  echo "app name must be kebab-case: lowercase letters, digits, hyphens (e.g. my-app). Got: $NAME" >&2; exit 2
fi
if [[ "$TITLE" == *'"'* || "$TITLE" == *'\'* ]]; then
  echo "app title must not contain double quotes or backslashes. Got: $TITLE" >&2; exit 2
fi
if [[ -e "$DEST" && -n "$(ls -A "$DEST" 2>/dev/null)" ]]; then
  echo "destination '$DEST' exists and is not empty — refusing to overwrite" >&2; exit 2
fi

mkdir -p "$DEST"
# rsync keeps dotfiles; exclude anything that must never ship.
rsync -a \
  --exclude node_modules --exclude .next --exclude .env.local --exclude .env \
  --exclude tsconfig.tsbuildinfo --exclude next-env.d.ts --exclude test-results \
  --exclude playwright-report --exclude .playwright-mcp \
  "$TEMPLATE/" "$DEST/"

# Stamp placeholders (text files only).
DB_NAME="${NAME//-/_}"   # postgres identifiers prefer underscores
export STAMP_TITLE="$TITLE" STAMP_NAME="$NAME" STAMP_DB="$DB_NAME"
grep -rIl --exclude-dir=node_modules -e "__APP_NAME__" -e "__APP_TITLE__" -e "__DB_NAME__" "$DEST" | while read -r f; do
  perl -pi -e 's/__APP_TITLE__/$ENV{STAMP_TITLE}/g; s/__DB_NAME__/$ENV{STAMP_DB}/g; s/__APP_NAME__/$ENV{STAMP_NAME}/g' "$f"
done

echo "✔ created $DEST from template (name=$NAME, title=\"$TITLE\")"
