/**
 * Step 6 — Timing Adjustment + Final Mix
 *
 * For each generated TTS segment:
 *   1. Compare its duration to the original segment's duration.
 *   2. Time-stretch it (ffmpeg atempo, pitch-preserved) to roughly fit.
 *   3. Place it at the correct timestamp on a silent timeline (ffmpeg adelay + amix).
 *   4. Mix the assembled speech timeline with the separated background
 *      track (if available) to produce the final dubbed audio.
 */

import fs from "node:fs";
import path from "node:path";
import { getDurationSeconds, timeStretch, buildTimeline, mixTwo } from "../utils/ffmpeg.js";
import type { TtsSegment } from "./step4_clone_tts.js";

export async function alignAndMix(
  ttsSegments: TtsSegment[],
  workDir: string,
  outputDir: string,
  backgroundPath?: string
): Promise<string> {
  console.log(`[Step 6] Aligning ${ttsSegments.length} segments to original timing`);

  const stretchedDir = path.join(workDir, "tts_stretched");
  fs.mkdirSync(stretchedDir, { recursive: true });

  const placed: { path: string; startMs: number }[] = [];
  let maxEndMs = 0;

  for (const seg of ttsSegments) {
    const targetSec = seg.end - seg.start;
    if (targetSec <= 0) continue;

    const currentSec = await getDurationSeconds(seg.path);
    if (currentSec <= 0) continue;

    let factor = currentSec / targetSec; // >1 => too long -> speed up
    factor = Math.max(0.5, Math.min(factor, 2.5)); // keep stretch natural-sounding

    const stretchedPath = path.join(stretchedDir, path.basename(seg.path));
    await timeStretch(seg.path, stretchedPath, factor);

    const startMs = Math.round(seg.start * 1000);
    placed.push({ path: stretchedPath, startMs });
    maxEndMs = Math.max(maxEndMs, Math.round(seg.end * 1000));
  }

  const totalMs = maxEndMs + 2000;

  fs.mkdirSync(outputDir, { recursive: true });
  const speechOnlyPath = path.join(outputDir, "dubbed_speech_only.wav");
  await buildTimeline(placed, totalMs, speechOnlyPath);
  console.log(`[Step 6] Speech-only track -> ${speechOnlyPath}`);

  const finalPath = path.join(outputDir, "final_dubbed_audio.wav");
  if (backgroundPath && fs.existsSync(backgroundPath)) {
    await mixTwo(speechOnlyPath, backgroundPath, finalPath);
    console.log(`[Step 6] Mixed with background -> ${finalPath}`);
  } else {
    fs.copyFileSync(speechOnlyPath, finalPath);
    console.log(`[Step 6] No background track; speech-only used as final -> ${finalPath}`);
  }

  return finalPath;
}

// CLI entry point: `npm run step5`
if (import.meta.url === `file://${process.argv[1]}`) {
  const { SETTINGS } = await import("../config.js");
  const translatedPath = path.join(SETTINGS.workDir, "translated_transcript.json");
  const translated = JSON.parse(fs.readFileSync(translatedPath, "utf-8"));

  const segmentsDir = path.join(SETTINGS.workDir, "tts_segments");
  const ttsSegments: TtsSegment[] = [];
  translated.segments.forEach((seg: any, i: number) => {
    const p = path.join(segmentsDir, `seg_${String(i).padStart(4, "0")}.wav`);
    if (fs.existsSync(p)) ttsSegments.push({ start: seg.start, end: seg.end, path: p });
  });

  const bgPath = path.join(SETTINGS.workDir, "background.wav");
  await alignAndMix(ttsSegments, SETTINGS.workDir, SETTINGS.outputDir, bgPath);
}
