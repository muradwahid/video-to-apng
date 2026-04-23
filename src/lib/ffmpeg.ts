import { FFmpeg } from "@ffmpeg/ffmpeg";
import { toBlobURL } from "@ffmpeg/util";

let ffmpeg: FFmpeg | null = null;

export async function getFFmpeg() {
  if (ffmpeg) return ffmpeg;

  ffmpeg = new FFmpeg();
  
  // Load ffmpeg.wasm from a CDN for faster initial setup
  const baseURL = "https://unpkg.com/@ffmpeg/core@0.12.6/dist/esm";
  
  await ffmpeg.load({
    coreURL: await toBlobURL(`${baseURL}/ffmpeg-core.js`, "text/javascript"),
    wasmURL: await toBlobURL(`${baseURL}/ffmpeg-core.wasm`, "application/wasm"),
  });

  return ffmpeg;
}

export async function extractFrames(file: File, startTime: number, duration: number, fps: number): Promise<string[]> {
  const ffmpeg = await getFFmpeg();
  const inputName = "input.mp4";
  const outputPattern = "frame_%04d.png";

  const fileData = new Uint8Array(await file.arrayBuffer());
  await ffmpeg.writeFile(inputName, fileData);

  // Extract frames at specified FPS
  await ffmpeg.exec([
    "-ss", startTime.toString(),
    "-t", duration.toString(),
    "-i", inputName,
    "-vf", `fps=${fps}`,
    outputPattern
  ]);

  const outputFiles = await ffmpeg.listDir(".");
  const frameFiles = outputFiles
    .filter(f => f.name.startsWith("frame_") && f.name.endsWith(".png"))
    .sort((a, b) => a.name.localeCompare(b.name));

  const frameUrls: string[] = [];
  for (const file of frameFiles) {
    const data = await ffmpeg.readFile(file.name);
    const blob = new Blob([data], { type: "image/png" });
    frameUrls.push(URL.createObjectURL(blob));
  }

  // Cleanup
  await ffmpeg.deleteFile(inputName);
  for (const file of frameFiles) {
    await ffmpeg.deleteFile(file.name);
  }

  return frameUrls;
}

export async function convertToAPNG(inputPath: string, outputPath: string, options: { fps: number }): Promise<Uint8Array> {
  const ffmpeg = await getFFmpeg();
  
  // Example command for APNG
  await ffmpeg.exec([
    "-i", inputPath,
    "-f", "apng",
    "-plays", "0", // Infinite loop
    "-vf", `fps=${options.fps}`,
    outputPath
  ]);

  const data = await ffmpeg.readFile(outputPath);
  return new Uint8Array(data as ArrayBuffer);
}
