/**
 * setting type hai
 */

import fs from "node:fs";
import path from "node:path";

export type TtsBackend = "xtts-python" | "elevenlabs";

export interface Setting {
    inputAudio : string;
    sourceLang : string;
    targetLang : string;

    whisperModel : string;
    ttsBackend : TtsBackend;
    xttsModelName : string;
    workDir : string;
    outputDir : string;
}


export const SETTINGS : Setting = {
    inputAudio  : "input/original.mp3",
    sourceLang : "auto",
    targetLang : "hi",

    whisperModel : "Xenova/whisper-small",
    ttsBackend : "xtts-python",
    xttsModelName : "tts_models/multilingual/multi-dataset/xtts_v2",

    workDir : "work",
    outputDir : "output"
}

for(const dir of [SETTINGS.workDir, SETTINGS.outputDir, "input"]) {
    fs.mkdirSync(path.resolve(dir), {recursive : true})
}


