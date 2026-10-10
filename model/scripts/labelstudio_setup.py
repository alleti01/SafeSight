"""Create the local Label Studio project for the home test set and import frames with first-guess boxes.

Needs Label Studio running with LABEL_STUDIO_LOCAL_FILES_SERVING_ENABLED=true and
LABEL_STUDIO_LOCAL_FILES_DOCUMENT_ROOT=<repo>/model/data, and LABEL_STUDIO_API_KEY in model/.env.
Usage: labelstudio_setup.py <tasks.json> [project title]
"""
import json
import os
import sys
import urllib.request
from pathlib import Path

from dotenv import load_dotenv

ROOT = Path(__file__).resolve().parents[1]
URL = "http://localhost:8080"
LABELS = ["rug", "toilet", "toilet_roll_holder", "towel", "mirror", "stairs", "cable",
          "floor_clutter", "bin", "bed", "sofa", "chair", "table"]
COLORS = ["#e6194b", "#3cb44b", "#ffe119", "#4363d8", "#f58231", "#911eb4", "#00bcd4",
          "#f032e6", "#9acd32", "#fa8072", "#008080", "#b388ff", "#9a6324"]
CONFIG = f"""<View>
  <Header value="Room: $room   ($file)"/>
  <Image name="image" value="$image" zoom="true" zoomControl="true"/>
  <RectangleLabels name="label" toName="image">
{chr(10).join(f'    <Label value="{l}" background="{c}" hotkey="{k}"/>' for k, (l, c) in enumerate(zip(LABELS, COLORS), 1) if k <= 9)}
{chr(10).join(f'    <Label value="{l}" background="{c}"/>' for k, (l, c) in enumerate(zip(LABELS, COLORS), 1) if k > 9)}
  </RectangleLabels>
</View>"""
INSTRUCTIONS = """<p>Box every one of the 13 objects you can see, even if it is not a hazard. Our code decides hazards later.</p>
<ul>
<li>Delete wrong boxes, drag sloppy ones to fit, draw missed ones.</li>
<li><b>stairs</b>: the whole staircase. <b>cable</b>: any visible cord. <b>floor_clutter</b>: loose items on the floor (clothes, shoes, bags, boxes, toys).</li>
<li><b>toilet_roll_holder</b>: the roll and holder together. <b>bin</b>: any trash can or basket that could be mistaken for a toilet.</li>
<li>Skip blurred people. Tiny or far-away objects you can't recognize: skip.</li>
</ul>"""


def api(method, path, token, body=None):
    req = urllib.request.Request(URL + path, method=method, headers={
        "Authorization": f"Bearer {token}", "Content-Type": "application/json"},
        data=json.dumps(body).encode() if body is not None else None)
    with urllib.request.urlopen(req) as r:
        txt = r.read()
        return json.loads(txt) if txt else None


def access_token():
    load_dotenv(ROOT / ".env")
    refresh = os.environ["LABEL_STUDIO_API_KEY"]
    req = urllib.request.Request(URL + "/api/token/refresh", method="POST",
                                 headers={"Content-Type": "application/json"},
                                 data=json.dumps({"refresh": refresh}).encode())
    return json.load(urllib.request.urlopen(req))["access"]


def main():
    tasks_path = Path(sys.argv[1])
    title = sys.argv[2] if len(sys.argv) > 2 else "SafeSight home test set"
    tok = access_token()
    existing = [p for p in api("GET", "/api/projects?page_size=100", tok)["results"] if p["title"] == title]
    if existing:
        sys.exit(f"project '{title}' already exists (id {existing[0]['id']}); not creating a second one")
    proj = api("POST", "/api/projects", tok, {"title": title, "label_config": CONFIG,
                                               "expert_instruction": INSTRUCTIONS, "show_instruction": True,
                                               "show_skip_button": True})
    tasks = json.load(open(tasks_path))
    frames_dir = (ROOT / "data" / Path(tasks[0]["data"]["image"].split("?d=")[1]).parent).resolve()
    api("POST", "/api/storages/localfiles", tok, {"project": proj["id"], "title": "home test frames",
                                                  "path": str(frames_dir), "use_blob_urls": False})
    api("POST", f"/api/projects/{proj['id']}/import", tok, tasks)
    n_boxes = sum(len(t["predictions"][0]["result"]) for t in tasks)
    print(f"project {proj['id']} created: {len(tasks)} frames, {n_boxes} first-guess boxes")
    print(f"open: {URL}/projects/{proj['id']}/data")


if __name__ == "__main__":
    main()
