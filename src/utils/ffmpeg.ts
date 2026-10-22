/**
 * https://ffmpeg.org/ffmpeg-filters.html
 * check this out 
 *  why we need this because we want to edit dont want to edit file
 * by my slef to yeah we want to create a ffmpeg utils to work and one more thign that 
 * 
 * ffmpeg not know the ts so first we have to create a helper the translare between the 
 * ffmpef command and over ts so let start thign let see who to build this 
 * setp by step 
 * 
 * spawn node js ye sab lagega
 */

import { spawn } from "node:child_process";

// create a fucntion it runs the external command and is if is succeded or not 

// optional setting if quirt
export async function run(cmd: string, args: string[], opts: { quiet?: boolean } = {}): Promise<void> {
    return new Promise((resolve, reject) => {
        // process chalo check karo 0 hai 1 and resolve and reject the promise 
        // process me kya chalan hai
        const proc = spawn(cmd, args, { stdio: opts.quiet ? "ignore" : "inherit" });
        proc.on("error", reject);
        proc.on("close", (code) => {
            if (code === 0) resolve();
            else reject(new Error(`${cmd} exited with code ${code} (args : ${args.join("")})`))
        });
    });
}


// now the 2 function it kam was convert input media file into wav file with specified auido sample rate
// it make the processing more easy especially when combiing clips from different sources

/**
 * original file kaha hai 
 * convert file kaha save hogi
 * sampleRate  if you dont supply one
 */
export async function toWAV(inputPath: string, outPath: string, sampleRate: 44100): Promise<string> {
    await run("ffmpeg", ["-y", "-i", inputPath, "-ar", String(sampleRate), outPath], { quiet: true })
    return outPath;
}

// checking the duration in ms

export async function getDurationSeconds(filePath: string): Promise<number> {
    return new Promise((resovle, reject) => {
        const proc = spawn("ffprobe", [
            "-v", "error",
            "-show_entries", "format=duration",
            "-of", "default=noprint_wrappers=1:nokey=1",
            filePath,
        ]);
        let out = "";
        proc.stdout.on("data", (d) => (out += d.toString()))
        proc.on("error", reject);
        proc.on("close", (code) => {
            if (code === 0) resovle(parseFloat(out.trim()));
            else reject(new Error(`ffprobe failed on ${filePath}`))
        })

    })
}


// now a fucntion at filter audio speed while aming to preserver the pitch

export function atempoChain(factor: number): string {
    if (factor <= 0) return "atempo=1.0";
    const filters: string[] = [];
    let f = factor;
    while (f > 2.0) {
        filters.push("atempo=2.0");
        f /= 2
    }
    while (f < 0.5) {
        filters.push("atempo=0.5")
        f /= 0.5;
    }
    filters.push(`atempo=${f.toFixed(4)}`);
    return filters.join(",");
}

// change the packback speed and have to save the result

export async function timeStretch(inPath: string, outPath: string, factor: number): Promise<void> {
    const filt = atempoChain(factor);
    await run("ffmpeg", ["-y", "-i", inPath, "-filter:a", filt, outPath], { quiet: true });

}

// fucntion create one file witht speficified and place each inpit clop assieged start time

// calling tehre is want then meet for this other wise ok by good by 



/**
 * Build one wav of length `totalMs` with each segment placed (adelay'd) at its
 * start time and mixed together, using a single ffmpeg filter_complex call.
 */
export async function buildTimeline(
  segments: { path: string; startMs: number }[],
  totalMs: number,
  outPath: string
): Promise<void> {
  if (segments.length === 0) {
    // silent track
    await run("ffmpeg", [
      "-y", "-f", "lavfi", "-i", `anullsrc=r=44100:cl=stereo:d=${(totalMs / 1000).toFixed(3)}`,
      outPath,
    ], { quiet: true });
    return;
  }

  const inputs: string[] = [];
  const filterParts: string[] = [];
  segments.forEach((seg, i) => {
    inputs.push("-i", seg.path);
    filterParts.push(`[${i}:a]adelay=${seg.startMs}|${seg.startMs}[a${i}]`);
  });
  const mixInputs = segments.map((_, i) => `[a${i}]`).join("");
  filterParts.push(`${mixInputs}amix=inputs=${segments.length}:duration=longest:dropout_transition=0[out]`);

  const args = [
    "-y",
    ...inputs,
    "-filter_complex", filterParts.join(";"),
    "-map", "[out]",
    "-t", (totalMs / 1000).toFixed(3),
    outPath,
  ];
  await run("ffmpeg", args, { quiet: true });
}

/** Mix two wav files (e.g. speech timeline + background track) into one. */
export async function mixTwo(aPath: string, bPath: string, outPath: string): Promise<void> {
  await run("ffmpeg", [
    "-y", "-i", aPath, "-i", bPath,
    "-filter_complex", "[0:a][1:a]amix=inputs=2:duration=longest:dropout_transition=0[out]",
    "-map", "[out]",
    outPath,
  ], { quiet: true });
}
