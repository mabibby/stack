#!/usr/bin/env bash
# Copies the template into a new directory, assigns a port slot, and stamps name/title/ports.
# Usage: new-app.sh <app-name-kebab> "<App Title>" [destination-dir] [--slot N]
#
# Port slots: slot k → web 3000+k · postgres 5432+k · minio 9000+2k / console 9001+2k ·
# mailpit smtp 1025+k / web 8025+k. Recorded in ~/.stack/apps.tsv (slot, name, path) so several
# apps can run side by side. The first slot whose ports are all free (registry + this machine) wins.
set -euo pipefail

NAME="${1:-}"; TITLE="${2:-}"; DEST="${3:-}"; SLOT=""
if [[ "${DEST:-}" == "--slot" ]]; then DEST=""; SLOT="${4:-}"; elif [[ "${4:-}" == "--slot" ]]; then SLOT="${5:-}"; fi
DEST="${DEST:-$NAME}"
HERE="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
TEMPLATE="$HERE/../template"
REGISTRY="${STACK_REGISTRY:-$HOME/.stack/apps.tsv}"

if [[ -z "$NAME" || -z "$TITLE" ]]; then
  echo "usage: new-app.sh <app-name-kebab> \"<App Title>\" [destination-dir] [--slot N]" >&2; exit 2
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

# ---- port slot -------------------------------------------------------------
ports_for_slot() { # slot → "web pg minio console smtp mail"
  local k=$1; echo "$((3000+k)) $((5432+k)) $((9000+2*k)) $((9001+2*k)) $((1025+k)) $((8025+k))"
}
port_busy() { lsof -nP -iTCP:"$1" -sTCP:LISTEN >/dev/null 2>&1; }
slot_taken() { [[ -f "$REGISTRY" ]] && awk -F'\t' -v s="$1" '$1==s{f=1} END{exit !f}' "$REGISTRY"; }
if [[ -z "$SLOT" ]]; then
  for k in $(seq 0 99); do
    slot_taken "$k" && continue
    busy=0; for p in $(ports_for_slot "$k"); do port_busy "$p" && { busy=1; break; }; done
    [[ $busy -eq 0 ]] && { SLOT=$k; break; }
  done
  [[ -z "$SLOT" ]] && { echo "no free port slot found (0–99)" >&2; exit 1; }
fi
read -r P_WEB P_PG P_MINIO P_MINIO_CONSOLE P_SMTP P_MAIL <<<"$(ports_for_slot "$SLOT")"

# ---- copy + stamp -------------------------------------------------------------
mkdir -p "$DEST"
rsync -a \
  --exclude node_modules --exclude .next --exclude .env.local --exclude .env \
  --exclude tsconfig.tsbuildinfo --exclude next-env.d.ts --exclude test-results \
  --exclude playwright-report --exclude .playwright-mcp \
  "$TEMPLATE/" "$DEST/"

DB_NAME="${NAME//-/_}"
export STAMP_TITLE="$TITLE" STAMP_NAME="$NAME" STAMP_DB="$DB_NAME" STAMP_SLOT="$SLOT" \
  P_WEB P_PG P_MINIO P_MINIO_CONSOLE P_SMTP P_MAIL
grep -rIl --exclude-dir=node_modules -e "__APP_NAME__" -e "__APP_TITLE__" -e "__DB_NAME__" -e "__PORT_" "$DEST" | while read -r f; do
  perl -pi -e '
    s/__APP_TITLE__/$ENV{STAMP_TITLE}/g; s/__DB_NAME__/$ENV{STAMP_DB}/g; s/__APP_NAME__/$ENV{STAMP_NAME}/g;
    s/__PORT_SLOT__/$ENV{STAMP_SLOT}/g; s/__PORT_WEB__/$ENV{P_WEB}/g; s/__PORT_PG__/$ENV{P_PG}/g;
    s/__PORT_MINIO_CONSOLE__/$ENV{P_MINIO_CONSOLE}/g; s/__PORT_MINIO__/$ENV{P_MINIO}/g;
    s/__PORT_SMTP__/$ENV{P_SMTP}/g; s/__PORT_MAIL__/$ENV{P_MAIL}/g' "$f"
done

# ---- registry -------------------------------------------------------------
mkdir -p "$(dirname "$REGISTRY")"
ABS_DEST="$(cd "$DEST" && pwd)"
if ! slot_taken "$SLOT"; then printf '%s\t%s\t%s\n' "$SLOT" "$NAME" "$ABS_DEST" >> "$REGISTRY"; fi

echo "✔ created $ABS_DEST from template (name=$NAME, title=\"$TITLE\", port slot $SLOT)"
echo "  app http://localhost:$P_WEB · emails http://localhost:$P_MAIL · files http://localhost:$P_MINIO_CONSOLE · postgres localhost:$P_PG"
