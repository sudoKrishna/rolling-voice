/**
 * this is teh stt and we doing this with help of assembaly
 * 
 */

import fs from "node:fs";
import path from "node:path";


export interface TranscriptSegment {
    start: number;
    end: number;
    text: string;
}

export interface Transcript {
    language: string;
    segments: TranscriptSegment[];
}


async function uploadAudio(audioPath: string, apiKey: string): Promise<string> {
    const res = await fetch("https://api.assemblyai.com/v2/upload", {
        method: "POST",
        headers: { authorization: apiKey },
        body: fs.readFileSync(audioPath)
    });
    if (!res.ok) {
        throw new Error(`Upload failed : ${await res.text()}`);
    }
    const data = await res.json() as {upload_url : string}
    return data.upload_url
}

async function submitJob(uploadUrl: string, apiKey: string): Promise<string> {
    const res = await fetch("https://api.assemblyai.com/v2/transcript", {
        method: "POST",
        headers: { authorization: apiKey, "content-type": "application/json" },
        body: JSON.stringify({ audio_url: uploadUrl, speaker_labels: true })
    });
    if (!res.ok) {
        throw new Error(`Job submit is failed : ${await res.text()}`);
    }
    const data = await res.json() as {id : string}
    return data.id;
}

interface AssemblyUtterance {
    start: number;
    end: number;
    text: string;
}

interface AssemblyTranscriptResult {
    status: "queued" | "processing" | "completed" | "error";
    error?: string;
    language_code?: string;
    utterances?: AssemblyUtterance[];
}

async function pollUnitlDone(id: string, apiKey: string): Promise<AssemblyTranscriptResult> {
    while (true) {
        const res = await fetch(`https://api.assemblyai.com/v2/transcript/${id}`, {
            headers: { authorization: apiKey },
        });
        const data = await res.json() as AssemblyTranscriptResult;
        if (data.status === "completed") return data;
        if (data.status === "error") throw new Error(data.error);
        console.log("  [AssemblyAI] still processing...");
        await new Promise((r) => setTimeout(r, 3000));
    }
}

export async function transcribe(audioPath: string, workDir : string  ,apiKey: string,  ): Promise<Transcript> {
    console.log(`step 2 uploading ${audioPath} assembly ai`)
    const uploadUrl = await uploadAudio(audioPath, apiKey);

    console.log("step 2 start transcription");
    const jobId = await submitJob(uploadUrl, apiKey);

    console.log("step 2 waiting for the result");
    const result = await pollUnitlDone(jobId, apiKey);

    // utterances is the pieces of speach 

    const segments : TranscriptSegment[] = (result.utterances ?? []).map((u : any) => ({
        start : Math.round((u.start / 1000) * 100) / 100,
        end : Math.round((u.end /1000) * 100) / 100,
        text : u.text.trim(),
    }))
   
    const transcript : Transcript = {
        language : result.language_code ?? "en",
        segments,
    }

    const outPath = path.join(workDir, "transcript.json");
    fs.writeFileSync(outPath, JSON.stringify(transcript, null, 2), "utf-8");
    console.log(`step 2 done ${segments.length} segment => ${outPath}`);

    return transcript

}

if(import.meta.url === `file://${process.argv[1]}`) {
    const {SETTINGS} = await import("../config.js");
    const apiKey = process.env.ASSEMBLYAI_API_KEY;
    if(!apiKey)  throw new Error("assemblyai  api is not found")
    
    const audio = process.argv[2] ?? path.join(SETTINGS.workDir, "vocals.wav");
    const target = fs.existsSync(audio) ?  audio : SETTINGS.inputAudio;
    await transcribe(target, SETTINGS.workDir, apiKey);
}





