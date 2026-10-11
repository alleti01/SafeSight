"""Download the weights the service needs, for servers without the GitHub CLI (Railway).

Fine-tuned detector and people finder: this repo's model-v6 release (private, so GITHUB_TOKEN must be a
token that can read alleti01/SafeSight). Grounding DINO and SAM 2.1: Hugging Face. Files already in place are kept.
Same files as setup.sh.
"""
import json
import os
import shutil
import sys
import urllib.request
from pathlib import Path

from huggingface_hub import snapshot_download

ROOT = Path(__file__).resolve().parents[1]
REPO, TAG = "alleti01/SafeSight", os.environ.get("WEIGHTS_TAG", "model-v6")
FILES = {f"run{r}_best.pt": f"runs/run{r}_world/weights/best.pt" for r in (5, 8, 9, 11)}
FILES |= {"yolov8l-worldv2.pt": "weights/yolov8l-worldv2.pt", "yolo11m.pt": "weights/yolo11m.pt"}


class NoRedirect(urllib.request.HTTPRedirectHandler):
    def redirect_request(self, *a, **k):
        return None


def release_assets(token):
    req = urllib.request.Request(f"https://api.github.com/repos/{REPO}/releases/tags/{TAG}",
                                 headers={"Authorization": f"Bearer {token}", "Accept": "application/vnd.github+json"})
    return {a["name"]: a["url"] for a in json.load(urllib.request.urlopen(req))["assets"]}


def download(asset_url, token, dest):
    # The asset API answers with a redirect to signed storage, which must be fetched without our token.
    req = urllib.request.Request(asset_url, headers={"Authorization": f"Bearer {token}", "Accept": "application/octet-stream"})
    try:
        urllib.request.build_opener(NoRedirect).open(req)
        raise RuntimeError(f"expected a redirect for {asset_url}")
    except urllib.error.HTTPError as e:
        if e.code not in (301, 302, 307):
            raise
        location = e.headers["Location"]
    dest.parent.mkdir(parents=True, exist_ok=True)
    tmp = dest.with_suffix(".part")
    with urllib.request.urlopen(location) as r, open(tmp, "wb") as f:
        shutil.copyfileobj(r, f, 1 << 20)
    tmp.rename(dest)


def main():
    missing = {n: ROOT / p for n, p in FILES.items() if not (ROOT / p).is_file()}
    if missing:
        token = os.environ.get("GITHUB_TOKEN")
        if not token:
            sys.exit("GITHUB_TOKEN is not set: it's needed to download the fine-tuned weights from the private release.")
        assets = release_assets(token)
        for name, dest in missing.items():
            print("downloading", name, flush=True)
            download(assets[name], token, dest)
    keep = ["*.json", "*.txt", "*.safetensors"]
    snapshot_download("IDEA-Research/grounding-dino-base", local_dir=ROOT / "weights/grounding-dino-base", allow_patterns=keep)
    snapshot_download("facebook/sam2.1-hiera-large", local_dir=ROOT / "weights/sam2.1-hiera-large", allow_patterns=keep)
    print("weights ready", flush=True)


if __name__ == "__main__":
    main()
