#!/usr/bin/env bash
# Hourly job: fetch r/halifax → summarize with Gemini → store to Supabase.
# Steps run sequentially; summarize only runs if fetch succeeds.
set -uo pipefail
export PATH="/opt/homebrew/bin:/usr/local/bin:/usr/bin:/bin:$PATH"
cd "$HOME/halifax-civic-dashboard"
set -a; source "$HOME/halifax-civic-dashboard/.briefing.env"; set +a

LOCK_FILE="/tmp/reddit-hourly.lock"
LAST_RUN_FILE="$HOME/.reddit-hourly-last-run"
COOLDOWN_SECS=1800          # 30 min — prevents double-fire on reboot near the hour
NETWORK_WAIT_SECS=600       # wait up to 10 min for network
NETWORK_POLL_INTERVAL=30
NTFY_TOPIC="${NTFY_TOPIC:-}"

log() { echo "[hourly] $(date '+%Y-%m-%d %H:%M:%S') $*"; }

# ── 1. Prevent concurrent runs ───────────────────────────────────────────────
if [[ -f "$LOCK_FILE" ]]; then
  EXISTING_PID=$(cat "$LOCK_FILE" 2>/dev/null || echo "")
  if [[ -n "$EXISTING_PID" ]] && kill -0 "$EXISTING_PID" 2>/dev/null; then
    log "already running (PID $EXISTING_PID), skipping"
    exit 0
  fi
  rm -f "$LOCK_FILE"
fi
echo $$ > "$LOCK_FILE"
trap 'rm -f "$LOCK_FILE"' EXIT

# ── 2. Cooldown ───────────────────────────────────────────────────────────────
if [[ -f "$LAST_RUN_FILE" ]]; then
  AGE=$(( $(date +%s) - $(cat "$LAST_RUN_FILE") ))
  if [[ $AGE -lt $COOLDOWN_SECS ]]; then
    log "ran ${AGE}s ago (cooldown ${COOLDOWN_SECS}s), skipping"
    exit 0
  fi
fi

# ── 3. Wait for network ───────────────────────────────────────────────────────
WAITED=0
while ! ping -c 1 -W 2 8.8.8.8 &>/dev/null; do
  if [[ $WAITED -ge $NETWORK_WAIT_SECS ]]; then
    log "no network after ${NETWORK_WAIT_SECS}s, skipping silently"
    exit 0
  fi
  log "no network, retrying in ${NETWORK_POLL_INTERVAL}s… (${WAITED}s)"
  sleep $NETWORK_POLL_INTERVAL
  WAITED=$(( WAITED + NETWORK_POLL_INTERVAL ))
done
log "network OK"

# ── Notification helper ───────────────────────────────────────────────────────
notify_failure() {
  local step="$1" msg="$2"
  osascript -e "display notification \"$msg\" with title \"reddit-hourly [$step]\" sound name \"Basso\"" 2>/dev/null || true
  if [[ -n "$NTFY_TOPIC" ]]; then
    curl -s -o /dev/null \
      -H "Title: reddit-hourly [$step] failed" \
      -H "Priority: high" -H "Tags: warning" \
      -d "$msg" "https://ntfy.sh/${NTFY_TOPIC}" || true
  fi
}

# ── Step 1: Fetch ─────────────────────────────────────────────────────────────
log "step 1/2 — fetch"
if ! node scripts/fetch-reddit-to-db.mjs; then
  MSG="$(date '+%Y-%m-%d %H:%M:%S') fetch exited $? — check logs/reddit-hourly-error.log"
  log "$MSG"
  notify_failure "fetch" "$MSG"
  exit 1
fi
log "fetch done"

# ── Step 2: Summarize ─────────────────────────────────────────────────────────
log "step 2/2 — summarize"
if ! node scripts/summarize-reddit-mac-mini.mjs; then
  MSG="$(date '+%Y-%m-%d %H:%M:%S') summarize exited $? — check logs/reddit-hourly-error.log"
  log "$MSG"
  notify_failure "summarize" "$MSG"
  exit 1
fi
log "summarize done"

# ── All done ──────────────────────────────────────────────────────────────────
date +%s > "$LAST_RUN_FILE"
log "all done"
