#!/bin/bash
# One-time setup to run the SafeSight analysis service on your own Mac or Linux machine.
# Needs Python 3.11, ffmpeg, and the GitHub CLI (gh) logged in to an account with access to this repo.
#   brew install python@3.11 ffmpeg gh && gh auth login
# Then: model/scripts/setup.sh, and start the service with
#   cd model && DETECTOR=combo .venv/bin/uvicorn service:app --port 8000
# Weights that are already in place are kept, so it's safe to run again.
set -euo pipefail
cd "$(dirname "$0")/.."
REPO=alleti01/SafeSight
TAG=${TAG:-model-v6}

for c in ffmpeg gh; do
  command -v "$c" >/dev/null || { echo "Missing $c. Install it with: brew install $c"; exit 1; }
done

echo "1/3 Python packages"
if [ ! -x .venv/bin/python ]; then
  if command -v uv >/dev/null; then uv venv --python 3.11 .venv
  else python3.11 -m venv .venv; fi
fi
if command -v uv >/dev/null; then uv pip install --python .venv/bin/python -r requirements-serve.txt
else .venv/bin/python -m pip install -r requirements-serve.txt; fi

echo "2/3 Fine-tuned detector and people finder (from the $TAG release)"
get() {  # get <release file> <where it goes>
  [ -s "$2" ] && { echo "  have $2"; return; }
  mkdir -p "$(dirname "$2")"
  gh release download "$TAG" -R "$REPO" -p "$1" -O "$2"
  echo "  got $2"
}
for r in 5 8 9 11; do get "run${r}_best.pt" "runs/run${r}_world/weights/best.pt"; done
get yolov8l-worldv2.pt weights/yolov8l-worldv2.pt
get yolo11m.pt weights/yolo11m.pt

echo "3/3 Grounding DINO and SAM 2.1 (from Hugging Face)"
.venv/bin/python - <<'EOF'
from huggingface_hub import snapshot_download
keep = ["*.json", "*.txt", "*.safetensors"]
snapshot_download("IDEA-Research/grounding-dino-base", local_dir="weights/grounding-dino-base", allow_patterns=keep)
snapshot_download("facebook/sam2.1-hiera-large", local_dir="weights/sam2.1-hiera-large", allow_patterns=keep)
EOF

echo "Done. Start it with: cd model && DETECTOR=combo .venv/bin/uvicorn service:app --port 8000"
