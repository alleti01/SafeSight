#!/bin/bash
# Start the SafeSight brain on this machine and expose it with a temporary public Cloudflare link.
# Usage: scripts/serve.sh [detector]   (default: combo  -> combo.json)
# Stop with Ctrl+C (closes the service and the public link).
cd "$(dirname "$0")/.."
DET=${1:-combo}
DETECTOR=$DET .venv/bin/uvicorn service:app --host 127.0.0.1 --port 8000 > data/service.log 2>&1 &
SVC=$!
trap 'kill $SVC $TUN 2>/dev/null; echo stopped' EXIT
until curl -s localhost:8000/health >/dev/null; do sleep 1; done
echo "service up (detector: $DET)"
cloudflared tunnel --no-autoupdate --url http://localhost:8000 > data/tunnel.log 2>&1 &
TUN=$!
until grep -qoE "https://[a-z0-9-]+\.trycloudflare\.com" data/tunnel.log; do sleep 1; done
URL=$(grep -oE "https://[a-z0-9-]+\.trycloudflare\.com" data/tunnel.log | head -1)
echo "PUBLIC URL (give this to Anish): $URL"
echo "$URL" > data/public_url.txt
wait $SVC
