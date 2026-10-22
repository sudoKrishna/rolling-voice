import argparse
import json

from rumikai import Rumik

parser = argparse.ArgumentParser()
parser.add_argument("--jobs", required=True, help="path to JSON file: [{text, out}, ...]")
args = parser.parse_args()

with open(args.jobs, "r", encoding="utf-8") as f:
    jobs = json.load(f)

with Rumik() as client:
    for job in jobs:
        audio = client.speech.create(text=job["text"], model="muga")
        audio.save(job["out"])
        print(f"done {job['out']}")
