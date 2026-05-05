import { fetchFile } from '@ffmpeg/util';
import { getFFmpeg } from './ffmpeg';

export async function generateProxy(assetId: string, url: string, onProgress: (progress: number) => void): Promise<string> {
  const proxyFFmpeg = await getFFmpeg();

  const inputName = `input_${assetId}.mp4`;
  const outputName = `proxy_${assetId}.mp4`;

  proxyFFmpeg.on('progress', ({ progress }) => {
    onProgress(Math.round(progress * 100));
  });

  const fileData = await fetchFile(url);
  await proxyFFmpeg.writeFile(inputName, fileData);

  // Generate 1/4 res proxy, fast encode
  await proxyFFmpeg.exec([
    '-i', inputName,
    '-vf', 'scale=iw/4:ih/4',
    '-c:v', 'libx264',
    '-preset', 'ultrafast',
    '-crf', '28',
    '-c:a', 'aac',
    outputName
  ]);

  const data = await proxyFFmpeg.readFile(outputName);
  const blob = new Blob([data as Uint8Array], { type: 'video/mp4' });
  const proxyUrl = URL.createObjectURL(blob);

  // Cleanup
  await proxyFFmpeg.deleteFile(inputName);
  await proxyFFmpeg.deleteFile(outputName);

  return proxyUrl;
}
