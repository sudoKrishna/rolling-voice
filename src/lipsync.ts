
import { SyncClient } from "@sync.so/sdk";
import { basename, dirname } from "node:path";
import { mkdir } from "node:fs/promises";

function getApiKey(): string {
  const apiKey = process.env.SYNC_API_KEY;

  if (!apiKey) {
    throw new Error("Missing SYNC_API_KEY in .env");
  }

  return apiKey;
}

const API_KEY: string = getApiKey();

const sync = new SyncClient({ apiKey: API_KEY });

interface CreateResponse {
  id: string;
  error?: string;
}

export async function lipSyncVideo(
  videoPath: string,
  audioPath: string,
  outputPath: string,
): Promise<string> {
  const video = Bun.file(videoPath);
  const audio = Bun.file(audioPath);

  if (!(await video.exists())) {
    throw new Error(`Video not found: ${videoPath}`);
  }

  if (!(await audio.exists())) {
    throw new Error(`Audio not found: ${audioPath}`);
  }

  // Upload your original video and your own generated audio.
  const form = new FormData();
  form.append("video", video, basename(videoPath));
  form.append("audio", audio, basename(audioPath));
  form.append("model", "lipsync-2");

  const response = await fetch(
    "https://api.sync.so/v2/generate",
    {
      method: "POST",
      headers: {
        "x-api-key": API_KEY,
      },
      body: form,
    },
  );

  if (!response.ok) {
    throw new Error(
      `Sync Labs request failed (${response.status}): ${
        await response.text()
      }`,
    );
  }

  const { id: jobId } =
    (await response.json()) as CreateResponse;

  console.log(`Lip-sync job started: ${jobId}`);

 
  const deadline = Date.now() + 30 * 60 * 1000;

  while (Date.now() < deadline) {
    await Bun.sleep(10_000);

    const job = await sync.generations.get(jobId);

    console.log(`Status: ${job.status}`);

    if (job.status === "FAILED" || job.status === "REJECTED") {
      throw new Error(
        `Lip-sync failed: ${job.error ?? job.status}`,
      );
    }

    if (job.status === "COMPLETED") {
      if (!job.outputUrl) {
        throw new Error("Job completed without an output URL");
      }

      // Download the completed video locally.
      const result = await fetch(job.outputUrl);

      if (!result.ok) {
        throw new Error(
          `Could not download output: ${result.status}`,
        );
      }

      await mkdir(dirname(outputPath), { recursive: true });
      await Bun.write(outputPath, await result.arrayBuffer());

      console.log(`Lip-synced video saved: ${outputPath}`);
      return outputPath;
    }
  }

  throw new Error(
    `Timed out waiting for lip-sync job ${jobId}. Check its status in Sync Labs.`,
  );
}

// CLI usage:
// bun run src/lipsync.ts input/video.mp4 input/dubbed.wav output/lipsynced.mp4
if (import.meta.main) {
  const [, , videoPath, audioPath, outputPath] = process.argv;

  if (!videoPath || !audioPath || !outputPath) {
    console.error(
      "Usage: bun run src/lipsync.ts <video> <audio> <output>",
    );
    process.exitCode = 1;
  } else {
    lipSyncVideo(videoPath, audioPath, outputPath).catch((error) => {
      console.error("Lip-sync error:", error);
      process.exitCode = 1;
    });
  }
}
