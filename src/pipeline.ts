/**
 * pipeline.ts — saare 6 steps ko order mein chalata hai, shuru se end tak.
 *
 * Usage:
 *   npm run dub -- input/my_video.mp4 --target hi
 */

import fs from "node:fs";
import path from "node:path";
import { Command } from "commander";

import { SETTINGS } from "./config.js";
import { toWAV } from "./utils/ffmpeg.js";
import { separateVocals } from "./steps/step1_separate.js";
import { transcribe } from "./steps/step2_transcribe.js";
import { translateSegments } from "./steps/step3_translate.js";
import { synthesizeSegments } from "./steps/step4_clone_tts.js";
import { alignAndMix } from "./steps/step5_align_mix.js";

async function ensureWav(inputPath: string, workDir: string): Promise<string> {
  if (inputPath.toLowerCase().endsWith(".wav")) return inputPath;
  const outPath = path.join(workDir, "input_converted.wav");
  console.log("[Prep] Converting input to wav...");
  return toWAV(inputPath, outPath, 44100);
}

export async function runPipeline(opts: {
  input: string;
  targetLang: string;
  sourceLang: string;
  doSeparate: boolean;
}) {
  const { workDir, outputDir } = SETTINGS;

  // Step 0: input ko wav mein convert karo (mp3/mp4 jo bhi ho)
  const wavPath = await ensureWav(opts.input, workDir);

  // Step 1: separation (agar chahiye)
  let vocalsPath = wavPath;
  let backgroundPath: string | undefined;
  if (opts.doSeparate) {
    const sep = await separateVocals(wavPath, workDir);
    vocalsPath = sep.vocals;
    backgroundPath = sep.background;
  }

  // Step 2: transcription
  const assemblyApiKey = process.env.ASSEMBLYAI_API_KEY;
  if (!assemblyApiKey) throw new Error("Set ASSEMBLYAI_API_KEY in your environment first.");
  const transcript = await transcribe(vocalsPath, workDir, assemblyApiKey);

  // Step 3: translation
  const deepseekApiKey = process.env.DEEPSEEK_API_KEY;
  if (!deepseekApiKey) throw new Error("Set DEEPSEEK_API_KEY in your environment first.");
  const translated = await translateSegments(transcript, opts.targetLang, workDir, deepseekApiKey);

  // Step 4+5: TTS (rumik.ai, no voice cloning)
  if (!process.env.RUMIK_API_KEY) throw new Error("Set RUMIK_API_KEY in your environment first.");
  const ttsSegments = await synthesizeSegments(translated, workDir);

  // Step 6: timing fix + final mix
  const finalPath = await alignAndMix(ttsSegments, workDir, outputDir, backgroundPath);

  console.log("\n=== DONE ===");
  console.log(`Final dubbed audio: ${finalPath}`);
  return finalPath;
}

// CLI entry point
if (import.meta.url === `file://${process.argv[1]}`) {
  const program = new Command();
  program
    .name("dub")
    .argument("[input]", "Input audio/video file", SETTINGS.inputAudio)
    .option("--target <lang>", "Target language", SETTINGS.targetLang)
    .option("--source <lang>", "Source language", SETTINGS.sourceLang)
    .option("--no-separate", "Skip Demucs separation")
    .action(async (input: string, options: any) => {
      await runPipeline({
        input,
        targetLang: options.target,
        sourceLang: options.source,
        doSeparate: options.separate !== false,
      });
    });

  program.parseAsync(process.argv);
}