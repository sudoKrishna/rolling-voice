import argparse
import json
import os

os.environ["COQUI_TOS_AGREED"] = "1"

import soundfile as sf
import torch
import torchaudio


def _load_with_soundfile(path, *args, **kwargs):
    data, sr = sf.read(path, dtype="float32", always_2d=True)
    return torch.from_numpy(data.T), sr


torchaudio.load = _load_with_soundfile

import num2words as num2words_module

_orig_num2words = num2words_module.num2words


def _safe_num2words(number, lang="en", **kwargs):
    try:
        return _orig_num2words(number, lang=lang, **kwargs)
    except NotImplementedError:
        return _orig_num2words(number, lang="en", **kwargs)


num2words_module.num2words = _safe_num2words

from TTS.api import TTS

parser = argparse.ArgumentParser()
parser.add_argument("--speaker-wav", required=True)
parser.add_argument("--language", required=True)
parser.add_argument("--jobs", required=True, help="path to JSON file: [{text, out}, ...]")
args = parser.parse_args()

with open(args.jobs, "r", encoding="utf-8") as f:
    jobs = json.load(f)

tts = TTS("tts_models/multilingual/multi-dataset/xtts_v2").to("cpu")

for job in jobs:
    tts.tts_to_file(
        text=job["text"],
        speaker_wav=args.speaker_wav,
        language=args.language,
        file_path=job["out"],
    )
    print(f"done {job['out']}")
