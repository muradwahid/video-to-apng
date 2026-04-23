import React, { useEffect, useRef } from "react";
import { VideoClip } from "@/src/types";
import { formatTime } from "@/src/lib/utils";

interface Props {
  clips: VideoClip[];
  currentTime: number;
  width: number;
  height: number;
}

export const VideoCanvas: React.FC<Props> = ({ clips, currentTime, width, height }) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const lastUrlRef = useRef<string | null>(null);

  useEffect(() => {
    // Find active clip
    const activeClip = clips.find(c => 
      currentTime >= c.startTime && 
      currentTime <= c.startTime + c.duration
    );

    if (activeClip && activeClip.type === 'video') {
      if (!videoRef.current) {
        videoRef.current = document.createElement('video');
        videoRef.current.muted = true;
        videoRef.current.playsInline = true;
      }
      
      if (lastUrlRef.current !== activeClip.url) {
        videoRef.current.src = activeClip.url;
        lastUrlRef.current = activeClip.url;
      }

      // Seek video to corresponding position
      const relativeTime = (currentTime - activeClip.startTime) * activeClip.speed + activeClip.sourceStart;
      videoRef.current.currentTime = relativeTime;
    }
  }, [clips, currentTime]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const render = () => {
      // Solid black background for professional preview
      ctx.fillStyle = "#000000";
      ctx.fillRect(0, 0, width, height);
      
      const activeClips = clips.filter(c => 
        currentTime >= c.startTime && 
        currentTime < c.startTime + c.duration
      );

      activeClips.forEach(clip => {
        ctx.save();
        
        // Setup Transform
        ctx.translate(width / 2, height / 2);
        ctx.rotate((clip.transform.rotation || 0) * Math.PI / 180);
        ctx.scale(clip.transform.scale || 1, clip.transform.scale || 1);
        ctx.translate(-width / 2, -height / 2);

        // Apply Filters
        if (clip.filters) {
          const f = clip.filters;
          ctx.filter = `brightness(${f.brightness}) contrast(${f.contrast}) saturate(${f.saturation}) blur(${f.blur}px) grayscale(${f.grayscale}) sepia(${f.sepia}) invert(${f.invert})`;
        } else {
          ctx.filter = 'none';
        }

        if (clip.type === 'video' && videoRef.current && lastUrlRef.current === clip.url) {
          if (clip.transform.crop) {
            const { x, y, width: cw, height: ch } = clip.transform.crop;
            // Draw only the cropped portion of the video to fill the entire canvas
            ctx.drawImage(
              videoRef.current,
              x * videoRef.current.videoWidth,
              y * videoRef.current.videoHeight,
              cw * videoRef.current.videoWidth,
              ch * videoRef.current.videoHeight,
              0, 0, width, height
            );
          } else {
            ctx.drawImage(videoRef.current, 0, 0, width, height);
          }

          // Apply Post-processing effects (Vignette & Grain)
          if (clip.filters) {
            const f = clip.filters;
            
            // Vignette
            if (f.vignette > 0) {
              const gradient = ctx.createRadialGradient(width/2, height/2, 0, width/2, height/2, width * 0.8);
              gradient.addColorStop(0, 'rgba(0,0,0,0)');
              gradient.addColorStop(1, `rgba(0,0,0,${f.vignette})`);
              ctx.fillStyle = gradient;
              ctx.fillRect(0, 0, width, height);
            }

            // Grain (Simple static noise for preview)
            if (f.grain > 0) {
              ctx.fillStyle = 'rgba(255,255,255,0.05)';
              for (let i = 0; i < 500 * f.grain; i++) {
                ctx.fillRect(Math.random() * width, Math.random() * height, 1, 1);
              }
            }
          }
          
          // Technical Overlay
          ctx.fillStyle = "rgba(0,0,0,0.5)";
          ctx.fillRect(20, height - 80, 200, 60);
          ctx.fillStyle = "#00ff00";
          ctx.font = "bold 12px monospace";
          ctx.fillText(`FRAME: ${Math.floor(currentTime * 60)}`, 40, height - 55);
          ctx.fillText(`TIME:  ${formatTime(currentTime)}`, 40, height - 35);
        } else {
          ctx.fillStyle = clip.type === 'image' ? "#222" : "#111";
          ctx.fillRect(0, 0, width, height);

          ctx.fillStyle = "#fff";
          ctx.font = "40px sans-serif";
          ctx.textAlign = "center";
          ctx.fillText(clip.name, width/2, height/2);
        }
        
        ctx.restore();
      });
    };

    render();
  }, [clips, currentTime, width, height]);

  return (
    <canvas 
      ref={canvasRef} 
      width={width} 
      height={height} 
      className="max-h-full max-w-full object-contain"
    />
  );
};
