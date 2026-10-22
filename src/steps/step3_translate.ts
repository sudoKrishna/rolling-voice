/**
 * translation karna hai, DeepSeek chat API se (OpenAI-compatible)
 */

import fs from "node:fs";
import path from "node:path";
import type { Transcript, TranscriptSegment } from "./step2_transcribe";


export interface TranslateSegment extends TranscriptSegment {
    translatedText: string;
}

export interface TranslatedTranscript {
    sourceLanguage: string;
    targetLanguage: string;
    segments: TranslateSegment[]
}

const LANG_NAMES: Record<string, string> = {
    hi: "Hindi",
    es: "Spanish",
    fr: "French",
    de: "German",
    ja: "Japanese",
    ko: "Korean",
    zh: "Chinese",
    ar: "Arabic",
    ru: "Russian",
    pt: "Portuguese",
};

async function translateOne(text: string, targetLang: string, apiKey: string): Promise<string> {
    const targetLangName = LANG_NAMES[targetLang.toLowerCase()] ?? targetLang;

    const res = await fetch("https://api.deepseek.com/chat/completions", {
        method: "POST",
        headers: {
            Authorization: `Bearer ${apiKey}`,
            "Content-Type": "application/json",
        },
        body: JSON.stringify({
            model: "deepseek-chat",
            messages: [
                {
                    role: "system",
                    content: `You are a translation engine. Translate the user's text into ${targetLangName}. Reply with ONLY the translation, no quotes, no explanation.`,
                },
                { role: "user", content: text },
            ],
            temperature: 0.2,
        }),
    });

    if (!res.ok) throw new Error(`DeepSeek translate failed : ${await res.text()}`);
    const data = await res.json() as { choices: { message: { content: string } }[] };
    return data.choices[0]!.message.content.trim();
}

export async function translateSegments(transcript: Transcript, targetLang: string, workDir: string, apiKey: string): Promise<TranslatedTranscript> {

    const segments: TranslateSegment[] = [];
    for (let i = 0; i < transcript.segments.length; i++) {
        const seg = transcript.segments[i]!;
        const translatedText = seg.text.trim() ? await translateOne(seg.text, targetLang, apiKey) : "";
        segments.push({ ...seg, translatedText });
        if ((i + 1) % 10 === 0) console.log(`  translated ${i + 1}/${transcript.segments.length}`);

    }

    const result : TranslatedTranscript = {
        sourceLanguage : transcript.language,
        targetLanguage : targetLang,
        segments,
    };

    const outPath = path.join(workDir, "translated_transcript.json");
    fs.writeFileSync(outPath, JSON.stringify(result,null, 2), "utf-8");
    console.log(`step3 done ${outPath}`)
    return result;
}


if (import.meta.url === `file://${process.argv[1]}`) {
  const { SETTINGS } = await import("../config.js");
  const apiKey = process.env.DEEPSEEK_API_KEY;
  if (!apiKey) throw new Error("Set DEEPSEEK_API_KEY in your environment first.");

  const transcriptPath = path.join(SETTINGS.workDir, "transcript.json");
  const transcript: Transcript = JSON.parse(fs.readFileSync(transcriptPath, "utf-8"));
  await translateSegments(transcript, SETTINGS.targetLang, SETTINGS.workDir, apiKey);
}
