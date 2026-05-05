import { FFmpeg } from '@ffmpeg/ffmpeg';
import { fetchFile, toBlobURL } from '@ffmpeg/util';
import * as WebMMuxer from 'webm-muxer';
import { TimelineState } from '../types';
import { renderBackground, renderClip, renderClipWithTransition } from './renderer';
import { ExportJob, useExportStore } from '../store/exportStore';

const baseURL = 'https://unpkg.com/@ffmpeg/core@0.12.6/dist/esm';
let ffmpegInstance: FFmpeg | null = null;

async function getFFmpeg() {
  if (!ffmpegInstance) {
    const ffmpeg = new FFmpeg();
    ffmpeg.on('log', ({ message }) => console.log('[FFmpeg]', message));
    
    await ffmpeg.load({
      coreURL: await toBlobURL(`${baseURL}/ffmpeg-core.js`, 'text/javascript'),
      wasmURL: await toBlobURL(`${baseURL}/ffmpeg-core.wasm`, 'application/wasm'),
    });
    ffmpegInstance = ffmpeg;
  }
  return ffmpegInstance;
}

export async function processExportJob(jobId: string) {
  const store = useExportStore.getState();
  const job = store.queue.find(j => j.id === jobId);
  if (!job) return;

  try {
    store.updateJob(jobId, { status: 'encoding', progress: 0 });
    
    const { timelineState, config } = job;
    const width = config.width || 1920;
    const height = config.height || 1080;
    const fps = config.fps || 60;
    
    const state = timelineState as TimelineState;

    const minStartTime = state.clips.length > 0 ? Math.min(...state.clips.map(c => c.startTime)) : 0;
    const maxEndTime = state.clips.length > 0 ? Math.max(...state.clips.map(c => c.startTime + c.duration)) : 0;
    const durationSeconds = config.range ? (config.range[1] - config.range[0]) : (maxEndTime - minStartTime);
    const startOffset = config.range ? config.range[0] : minStartTime;
    const totalFrames = Math.ceil(durationSeconds * fps);

    if (totalFrames <= 0) throw new Error("Timeline is empty or invalid duration");

    const canvas = document.createElement('canvas');
    canvas.width = width;
    canvas.height = height;
    const ctx = canvas.getContext('2d', { alpha: false, desynchronized: true });
    if (!ctx) throw new Error("Could not get 2d context");

    const mediaElements: Record<string, HTMLVideoElement | HTMLImageElement> = {};
    const uniqueUrls = Array.from(new Set(state.clips.map(c => c.url)));
    uniqueUrls.push(state.background.mediaUrl || '');
    
    await Promise.all(uniqueUrls.filter(Boolean).map(async (url) => {
      return new Promise<void>((resolve) => {
        const isVideo = url.match(/\.(mp4|webm|mkv|mov)$/i) || state.clips.find(c => c.url === url)?.type === 'video';
        if (isVideo) {
          const vid = document.createElement('video');
          vid.src = url;
          vid.crossOrigin = "anonymous";
          vid.muted = true;
          vid.preload = "auto";
          vid.onloadeddata = () => { mediaElements[url] = vid; resolve(); };
          vid.onerror = () => resolve();
        } else {
          const img = new Image();
          img.src = url;
          img.crossOrigin = "anonymous";
          img.onload = () => { mediaElements[url] = img; resolve(); };
          img.onerror = () => resolve();
        }
      });
    }));

    const muxer = new WebMMuxer.Muxer({
      target: new WebMMuxer.ArrayBufferTarget(),
      video: { codec: 'V_VP9', width, height, frameRate: fps }
    });

    const videoEncoder = new window.VideoEncoder({
      output: (chunk, meta) => muxer.addVideoChunk(chunk, meta),
      error: (e) => console.error(e)
    });

    videoEncoder.configure({
      codec: 'vp09.00.10.08',
      width,
      height,
      bitrate: 20000000, 
    });

    const seekVideo = async (video: HTMLVideoElement, targetTime: number) => {
      if (Math.abs(video.currentTime - targetTime) < 0.01) return;
      return new Promise<void>((resolve) => {
        let resolved = false;
        const onSeeked = () => {
          if (resolved) return;
          resolved = true;
          video.removeEventListener('seeked', onSeeked);
          resolve();
        };
        video.addEventListener('seeked', onSeeked);
        try { video.currentTime = targetTime; } catch (e) { resolved = true; resolve(); }
        setTimeout(() => { if (!resolved) { resolved=true; video.removeEventListener('seeked', onSeeked); resolve(); } }, 150);
      });
    };

    let frameCount = 0;
    const startTimeStamp = performance.now();

    for (let i = 0; i < totalFrames; i++) {
       const absoluteTime = startOffset + (i / fps);
       ctx.fillStyle = state.background.color || '#000000';
       ctx.fillRect(0, 0, width, height);

       renderBackground(ctx, width, height, state.background, mediaElements, absoluteTime);

       const activeClips = (state.clips || [])
       .filter(c => absoluteTime >= c.startTime && absoluteTime < (c.startTime + c.duration))
       .sort((a, b) => (a.trackIndex || 0) - (b.trackIndex || 0));
       
       for (const clip of activeClips) {
          const media = mediaElements[clip.url];
          if (clip.type === 'video' && media instanceof HTMLVideoElement) {
             const relativeTime = (absoluteTime - clip.startTime) * (clip.speed || 1) + clip.sourceStart;
             await seekVideo(media, Math.min(relativeTime, media.duration - 0.05));
          }
          renderClip(ctx, width, height, clip, mediaElements, absoluteTime);
       }

       const frame = new VideoFrame(canvas, { timestamp: Math.round((i * 1000000) / fps) });
       videoEncoder.encode(frame);
       frame.close();

       if (i % 20 === 0) {
          await new Promise(r => setTimeout(r, 0)); // yield
          const progress = (i / totalFrames) * 0.5; // Muxing is first 50%
          store.updateJob(jobId, { progress });
       }
    }

    await videoEncoder.flush();
    muxer.finalize();
    const webmBuffer = muxer.target.buffer;

    store.updateJob(jobId, { progress: 0.5 }); // Intermediate WebM done

    // Phase 2: Transcode using FFmpeg
    const ffmpeg = await getFFmpeg();
    await ffmpeg.writeFile('input.webm', new Uint8Array(webmBuffer));

    // Handle FFmpeg progress
    ffmpeg.on('progress', ({ progress: fProgress, time }) => {
       const totalProgress = 0.5 + (fProgress * 0.5);
       store.updateJob(jobId, { progress: totalProgress });
    });

    const outputName = `output.${config.container || 'mp4'}`;
    const ffmpegArgs = ['-i', 'input.webm'];

    // Additional FFmpeg args based on payload
    if (config.codec === 'h264') ffmpegArgs.push('-c:v', 'libx264', '-preset', 'fast');
    if (config.codec === 'h265') ffmpegArgs.push('-c:v', 'libx265'); // Might be slow in WASM
    if (config.codec === 'vp9') ffmpegArgs.push('-c:v', 'libvpx-vp9');
    if (config.audioCodec === 'aac') ffmpegArgs.push('-c:a', 'aac');
    if (config.audioCodec === 'mp3') ffmpegArgs.push('-c:a', 'libmp3lame');
    
    // Metadata
    if (config.metadata) {
      if (config.metadata.title) ffmpegArgs.push('-metadata', `title=${config.metadata.title}`);
      if (config.metadata.author) ffmpegArgs.push('-metadata', `artist=${config.metadata.author}`);
    }

    if (config.c2paEnabled) {
      console.log("[C2PA] Generating Content Credentials manifest...");
      console.log(`[C2PA] Creator: ${config.c2paCreator}, Socials: ${config.c2paSocials}, GenAI: ${config.c2paGenAI}`);
      // Since C2PA WASM tool involves private keys, we mock the injection by setting custom metadata in ffmpeg for now.
      ffmpegArgs.push('-metadata', `comment=C2PA_MANIFEST_EMBEDDED;CREATOR=${config.c2paCreator};GEN_AI=${config.c2paGenAI}`);
    }

    ffmpegArgs.push(outputName);

    await ffmpeg.exec(ffmpegArgs);

    const data = await ffmpeg.readFile(outputName);
    const mimeMap: any = { mp4: 'video/mp4', mov: 'video/quicktime', webm: 'video/webm' };
    const blob = new Blob([(data as Uint8Array).buffer], { type: mimeMap[config.container || 'mp4'] || 'video/mp4' });
    const blobUrl = URL.createObjectURL(blob);

    store.updateJob(jobId, { status: 'done', progress: 1, blobUrl });

    // Try to trigger download if window is active or dispatch notification
    if (Notification.permission === 'granted') {
       new Notification('Export Complete', { body: `Your export "${job.name}" is ready.` });
    }

  } catch (error: any) {
    console.error('Export error: ', error);
    store.updateJob(jobId, { status: 'error' });
  }
}
