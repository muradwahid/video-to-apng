import React, { useEffect, useRef, useState } from "react";
import { VideoClip, BackgroundConfig, Transition } from "@/src/types";
import { formatTime } from "@/src/lib/utils";

interface Props {
  clips: VideoClip[];
  currentTime: number;
  width: number;
  height: number;
  isCropping?: boolean;
  background: BackgroundConfig;
  transitions?: Transition[];
}

import { renderBackground, renderClip, renderClipWithTransition } from "@/src/lib/renderer";

export const VideoCanvas: React.FC<Props> = ({ clips, currentTime, width, height, isCropping, background, transitions = [] }) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const mediaCache = useRef<Record<string, HTMLVideoElement | HTMLImageElement>>({});

  useEffect(() => {
    // Preload media for active clips and background
    const activeClips = (clips || []).filter(c => currentTime >= c.startTime && currentTime <= c.startTime + c.duration);
    const mediaToLoad = [...activeClips.map(c => ({ url: c.url, type: c.type }))];
    
    if (background.mediaUrl) {
      mediaToLoad.push({ url: background.mediaUrl, type: background.type === 'video' ? 'video' : 'image' });
    }

    mediaToLoad.forEach(item => {
      if (!mediaCache.current[item.url]) {
        if (item.type === 'video') {
          const v = document.createElement('video');
          v.src = item.url;
          v.muted = true;
          v.playsInline = true;
          v.preload = "auto";
          v.crossOrigin = "anonymous";
          mediaCache.current[item.url] = v;
        } else {
          const img = new Image();
          img.src = item.url;
          img.crossOrigin = "anonymous";
          mediaCache.current[item.url] = img;
        }
      }
      
      const media = mediaCache.current[item.url];
      if (media instanceof HTMLVideoElement && item.type === 'video') {
        const clip = (clips || []).find(c => c.url === item.url);
        if (clip) {
          const relativeTime = (currentTime - clip.startTime) * clip.speed + clip.sourceStart;
          media.currentTime = relativeTime;
        } else if (background.mediaUrl === item.url) {
           media.currentTime = currentTime % (media.duration || 1);
        }
      }
    });

  }, [clips, currentTime, background]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const render = () => {
      renderBackground(ctx, width, height, background, mediaCache.current, currentTime);

      const activeTransition = transitions.find(t => {
        const fromClip = (clips || []).find(c => c.id === t.fromClipId);
        if (!fromClip) return false;
        const junction = fromClip.startTime + fromClip.duration;
        return currentTime >= junction - t.duration / 2 && currentTime <= junction + t.duration / 2;
      });

      if (activeTransition) {
        const fromClip = (clips || []).find(c => c.id === activeTransition.fromClipId)!;
        const toClip = (clips || []).find(c => c.id === activeTransition.toClipId)!;
        const junction = fromClip.startTime + fromClip.duration;
        const progress = (currentTime - (junction - activeTransition.duration / 2)) / activeTransition.duration;

        renderClipWithTransition(ctx, width, height, fromClip, toClip, activeTransition.type, progress, mediaCache.current, currentTime);
      } else {
        const activeClips = (clips || [])
          .filter(c => c.type !== 'audio' && currentTime >= c.startTime && currentTime < c.startTime + c.duration)
          .sort((a, b) => a.trackIndex - b.trackIndex);

        activeClips.forEach(clip => {
          renderClip(ctx, width, height, clip, mediaCache.current, currentTime);
        });
      }

      // HUD
      ctx.fillStyle = "rgba(0,0,0,0.5)";
      ctx.fillRect(20, height - 80, 200, 60);
      ctx.fillStyle = "#00ff00";
      ctx.font = "bold 12px monospace";
      ctx.fillText(`FRAME: ${Math.floor(currentTime * 60)}`, 40, height - 55);
      ctx.fillText(`TIME:  ${formatTime(currentTime)}`, 40, height - 35);
    };

    render();
  }, [clips, currentTime, width, height, background, transitions]);

  return (
    <canvas 
      id="video-canvas"
      ref={canvasRef} 
      width={width} 
      height={height} 
      className="max-h-full max-w-full object-contain"
    />
  );
};
