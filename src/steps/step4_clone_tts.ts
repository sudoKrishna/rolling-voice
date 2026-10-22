/**
 * Step 4 + 5 — Text-to-Speech (rumik.ai Silk TTS backend, via official rumik-ai SDK)
 *
 * rumik.ai has no voice-cloning capability (checked docs.rumik.ai) — only
 * preset voices/tone-tagged synthesis. So this does NOT clone the original
 * speaker's voice.
 *
 * Shells out to scripts/rumik_synth.py (uses the official `rumik-ai` Python
 * package) so we don't hand-roll the HTTP request format ourselves.
 */

import fs from "node:fs";
import path from "node:path";
import type { TranslatedTranscript } from "./step3_translate.js";
import { run } from "../utils/ffmpeg.js";

export interface TtsSegment {
  start: number;
  end: number;
  path: string;
}

export async function synthesizeSegments(
  translated: TranslatedTranscript,
  workDir: string
): Promise<TtsSegment[]> {
  const segmentsDir = path.join(workDir, "tts_segments");
  fs.mkdirSync(segmentsDir, { recursive: true });

  const out: TtsSegment[] = [];
  const jobs: { text: string; out: string }[] = [];

  for (let i = 0; i < translated.segments.length; i++) {
    const seg = translated.segments[i]!;
    const text = seg.translatedText.trim();
    if (!text) continue;

    const outPath = path.join(segmentsDir, `seg_${String(i).padStart(4, "0")}.wav`);
    jobs.push({ text, out: outPath });
    out.push({ start: seg.start, end: seg.end, path: outPath });
  }

  const jobsPath = path.join(workDir, "tts_jobs.json");
  fs.writeFileSync(jobsPath, JSON.stringify(jobs, null, 2), "utf-8");

  console.log(`[Step 4/5] Synthesizing ${jobs.length} segments with rumik.ai (no voice cloning)...`);
  const scriptPath = path.join(import.meta.dir, "../../scripts/rumik_synth.py");
  await run("python", [scriptPath, "--jobs", jobsPath]);

  console.log(`[Step 4/5] Generated ${out.length} TTS segments in ${segmentsDir}`);
  return out;
}

// CLI entry point: `npm run step4`
if (import.meta.url === `file://${process.argv[1]}`) {
  const { SETTINGS } = await import("../config.js");
  if (!process.env.RUMIK_API_KEY) throw new Error("Set RUMIK_API_KEY in your environment first.");

  const translatedPath = path.join(SETTINGS.workDir, "translated_transcript.json");
  const translated: TranslatedTranscript = JSON.parse(fs.readFileSync(translatedPath, "utf-8"));

  await synthesizeSegments(translated, SETTINGS.workDir);
}
