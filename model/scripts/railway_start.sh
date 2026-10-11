#!/bin/bash
# Start the analysis service on Railway: get the weights, then serve on $PORT.
# With a volume attached, the weights are kept there so later deploys skip the ~2.5 GB download.
set -euo pipefail
cd "$(dirname "$0")/.."
if [ -n "${RAILWAY_VOLUME_MOUNT_PATH:-}" ]; then
  for d in weights runs; do
    mkdir -p "$RAILWAY_VOLUME_MOUNT_PATH/$d"
    rm -rf "$d"
    ln -s "$RAILWAY_VOLUME_MOUNT_PATH/$d" "$d"
  done
fi
python scripts/fetch_weights.py
exec uvicorn service:app --host 0.0.0.0 --port "${PORT:-8000}"
