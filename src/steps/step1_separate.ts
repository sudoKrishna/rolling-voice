// ffmpeg  bana liya tha 
// now what i have to make is
/**
 * step 1 sepatae the audio and the background noise 
 * how to do that there is the libary come os hai 
 * his task is to separete the audio 
 * so like vocal and music play together 
 * then it convert the vocal and background nosice seprate 
 * this is cool shit 
 * i need see anything like this 
 */

import fs from "node:fs";
import path from "node:path"
import { run } from "../utils/ffmpeg";


export interface SeparationResult {
    vocals : string;
    background : string;
}

/**
 * ek folder create karte hai then inside it it do 
 * work on the sepration and what it want 
 */


export async function separateVocals(inputAudio : string, workDir : string): Promise<SeparationResult>  {
    const sepDir = path.join(workDir, "separated");
    fs.mkdirSync(sepDir, {recursive : true});

    console.log(`[Step 1] Running Demucs separation on ${inputAudio}`);
    // runing the demucs there
    await run("demucs", ["--two-stems", "vocals", "-o", sepDir , inputAudio]);

    const baseName = path.basename(inputAudio, path.extname(inputAudio));
    const modelDirs  = fs.readdirSync(sepDir).filter((d) => fs.statSync(path.join(sepDir, d)).isDirectory());
    if(modelDirs.length === 0) {
        throw new Error(`Demus did not produce output check installation (pip demus install)`)
    }

    const modelDir = path.join(sepDir , modelDirs[0]!, baseName);

    const vocalsSrc = path.join(modelDir, "vocals.wav");
    const bgSrc = path.join(modelDir, "no_vocals.wav");
    const vocalsDst = path.join(workDir, "vocals.wav");
    const bgDst = path.join(workDir, "background.wav");

    fs.copyFileSync(vocalsSrc, vocalsDst)
    fs.copyFileSync(bgSrc, bgDst)

    console.log(`stpe 1 done vacals=${vocalsDst} background=${bgDst}`)

    return {vocals : vocalsDst, background : bgDst}
}



// somethign happen in the php i thing it got  hacked in php2 shell ai desicover some varabilty
// itnahi pata hai first i understand what happen then i tell you 

// lovely for now we calling there 

// byb byb

// CLI entry point: `npm run step1 -- input/my_video.mp4`
if (import.meta.url === `file://${process.argv[1]}`) {
  const { SETTINGS } = await import("../config.js");
  const input = process.argv[2] ?? SETTINGS.inputAudio;
  await separateVocals(input, SETTINGS.workDir);
}
