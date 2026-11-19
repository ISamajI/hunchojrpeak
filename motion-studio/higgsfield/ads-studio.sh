#!/usr/bin/env bash
# Generate ad images with Higgsfield Ads Studio (higgsfield/ads-studio/v1.0) from a briefs file.
#
#   HF_KEY="KEY_ID:KEY_SECRET" ./ads-studio.sh                 # all ads in ltgpeak-ads.json
#   HF_KEY=... ./ads-studio.sh ltgpeak-ads.json before-after   # one ad by name
#
# Images land in ../out/higgsfield/<name>-<n>.png. Needs curl and jq.
# In a Claude cloud session with a Higgsfield network secret saved, HF_KEY can be left unset:
# the proxy adds the real Authorization header.
set -euo pipefail
cd "$(dirname "$0")"
BRIEFS="${1:-ltgpeak-ads.json}"; ONLY="${2:-}"
API="https://api.higgsfield.ai"; MODEL="higgsfield/ads-studio/v1.0"
AUTH="Authorization: Key ${HF_KEY:-placeholder:placeholder}"
OUT="../out/higgsfield"; mkdir -p "$OUT"

jq -c --arg only "$ONLY" '.defaults as $d | .ads[] | select($only=="" or .name==$only) | {name, body: ($d + del(.name))}' "$BRIEFS" |
while read -r ad; do
  name=$(jq -r .name <<<"$ad")
  echo "→ $name: submitting"
  sub=$(curl -sS --fail-with-body -X POST "$API/$MODEL" -H "$AUTH" -H "Content-Type: application/json" -d "$(jq -c .body <<<"$ad")")
  status_url=$(jq -r '.status_url // empty' <<<"$sub"); id=$(jq -r .request_id <<<"$sub")
  [ -n "$status_url" ] || status_url="$API/requests/$id/status"
  for _ in $(seq 1 120); do
    res=$(curl -sS "$status_url" -H "$AUTH"); st=$(jq -r .status <<<"$res")
    case "$st" in
      completed) break ;;
      failed|nsfw|canceled) echo "  ✗ $st: $(jq -r '.error // ""' <<<"$res")"; continue 2 ;;
      *) sleep 5 ;;
    esac
  done
  [ "$st" = completed ] || { echo "  ✗ timed out ($st)"; continue; }
  n=0; for url in $(jq -r '.images[].url' <<<"$res"); do
    n=$((n+1)); f="$OUT/$name-$n.png"; curl -sS -o "$f" "$url"; echo "  ✓ $f"
  done
done
