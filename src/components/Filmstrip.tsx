import React, { useEffect, useRef, useState, useMemo } from "react";

interface Props {
  url: string;
  duration: number;
  zoom: number;
  sourceStart: number;
  sourceEnd: number;
}

export const Filmstrip: React.FC<Props> = ({ url, duration, zoom, sourceStart, sourceEnd }) => {
  const [thumbnails, setThumbnails] = useState<string[]>([]);
  const videoRef = useRef<HTMLVideoElement | null>(null);

  // Calculate how many frames we need based on zoom and duration
  const frameWidth = 60; // 60px per thumbnail
  const clipWidth = duration * zoom;
  const frameCount = Math.max(1, Math.floor(clipWidth / frameWidth));

  useEffect(() => {
    let isMounted = true;
    const frames: string[] = [];

    const generateFrames = async () => {
      const video = document.createElement("video");
      video.src = url;
      video.muted = true;
      video.playsInline = true;
      video.preload = "auto";
      videoRef.current = video;

      await new Promise((resolve) => (video.onloadedmetadata = resolve));
      
      const canvas = document.createElement("canvas");
      canvas.width = 160;
      canvas.height = 90;
      const ctx = canvas.getContext("2d");

      const interval = (sourceEnd - sourceStart) / frameCount;

      for (let i = 0; i < frameCount; i++) {
        if (!isMounted) break;
        const seekTime = sourceStart + i * interval;
        video.currentTime = seekTime;
        
        await new Promise((resolve) => (video.onseeked = resolve));
        
        if (ctx) {
          ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
          frames.push(canvas.toDataURL("image/jpeg", 0.5));
        }
      }

      if (isMounted) setThumbnails(frames);
    };

    generateFrames().catch(console.error);

    return () => {
      isMounted = false;
      if (videoRef.current) {
        videoRef.current.src = "";
        videoRef.current.load();
      }
    };
  }, [url, frameCount, sourceStart, sourceEnd]);

  return (
    <div className="absolute inset-0 flex overflow-hidden pointer-events-none opacity-80">
      <div className="absolute inset-0 bg-blue-500/10 mix-blend-overlay z-10" />
      {thumbnails.map((src, i) => (
        <div 
          key={i} 
          className="h-full shrink-0 border-r border-white/10 overflow-hidden"
          style={{ width: frameWidth }}
        >
          <img 
            src={src} 
            alt={`Frame ${i}`} 
            className="h-full w-full object-cover" 
          />
        </div>
      ))}
      {/* Skeleton for loading */}
      {thumbnails.length === 0 && Array.from({ length: frameCount }).map((_, i) => (
        <div 
          key={`skip-${i}`} 
          className="h-full bg-white/5 border-r border-white/5 shrink-0" 
          style={{ width: frameWidth }}
        />
      ))}
    </div>
  );
};
