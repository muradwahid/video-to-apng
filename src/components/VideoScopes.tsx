import React, { useEffect, useRef, useState } from 'react';

interface ScopesProps {
  layout: 1 | 2 | 4;
}

export function VideoScopes({ layout }: ScopesProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const waveformRef = useRef<HTMLCanvasElement>(null);
  const vectorscopeRef = useRef<HTMLCanvasElement>(null);
  const histogramRef = useRef<HTMLCanvasElement>(null);

  const [mode, setMode] = useState<'luma' | 'rgb'>('rgb');

  useEffect(() => {
    // Create an offscreen canvas for downsampling
    const offCanvas = document.createElement('canvas');
    offCanvas.width = 256;
    offCanvas.height = 256; // 64k pixels, fast to read
    const offCtx = offCanvas.getContext('2d', { willReadFrequently: true })!;

    let animationFrameId: number;

    const loop = () => {
      const sourceCanvas = document.getElementById('video-canvas') as HTMLCanvasElement;
      if (!sourceCanvas) {
        animationFrameId = requestAnimationFrame(loop);
        return;
      }

      // Draw and read downsampled image
      offCtx.drawImage(sourceCanvas, 0, 0, 256, 256);
      const imgData = offCtx.getImageData(0, 0, 256, 256).data;

      // 1. Histogram
      if (histogramRef.current) {
        const hCtx = histogramRef.current.getContext('2d')!;
        hCtx.fillStyle = '#111';
        hCtx.fillRect(0, 0, 256, 128);
        
        const rBuckets = new Int32Array(256);
        const gBuckets = new Int32Array(256);
        const bBuckets = new Int32Array(256);
        const lBuckets = new Int32Array(256);

        let maxCount = 1;

        for (let i = 0; i < imgData.length; i += 4) {
          const r = imgData[i];
          const g = imgData[i+1];
          const b = imgData[i+2];
          const luma = Math.round(0.299*r + 0.587*g + 0.114*b);
          rBuckets[r]++;
          gBuckets[g]++;
          bBuckets[b]++;
          lBuckets[luma]++;
        }
        for (let i = 0; i < 256; i++) {
          maxCount = Math.max(maxCount, rBuckets[i], gBuckets[i], bBuckets[i], lBuckets[i]);
        }

        hCtx.globalCompositeOperation = 'screen';
        const drawBucket = (buckets: Int32Array, color: string) => {
          hCtx.strokeStyle = color;
          hCtx.beginPath();
          for (let i = 0; i < 256; i++) {
            const h = (buckets[i] / maxCount) * 120;
            hCtx.moveTo(i, 128);
            hCtx.lineTo(i, 128 - h);
          }
          hCtx.stroke();
        };

        if (mode === 'rgb') {
          drawBucket(rBuckets, 'rgba(255, 0, 0, 0.7)');
          drawBucket(gBuckets, 'rgba(0, 255, 0, 0.7)');
          drawBucket(bBuckets, 'rgba(0, 0, 255, 0.7)');
        } else {
          drawBucket(lBuckets, 'rgba(255, 255, 255, 0.7)');
        }
        hCtx.globalCompositeOperation = 'source-over';
      }

      // 2. Waveform
      if (waveformRef.current) {
         const wCtx = waveformRef.current.getContext('2d')!;
         wCtx.fillStyle = '#111';
         wCtx.fillRect(0, 0, 256, 256);
         const wData = wCtx.createImageData(256, 256);
         
         if (mode === 'rgb') {
           // RGB Parade = 3 sections of 85 width
           for (let y = 0; y < 256; y++) {
             for (let x = 0; x < 256; x+=3) { // skip some x to match width
               const idx = (y * 256 + x) * 4;
               const r = imgData[idx];
               const g = imgData[idx+1];
               const b = imgData[idx+2];
               
               // r parade (0-85)
               let wx = Math.floor(x / 3);
               let wy = 255 - r;
               wData.data[(wy * 256 + wx) * 4] += 50; 
               wData.data[(wy * 256 + wx) * 4 + 3] = 255; 

               // g parade (85-170)
               wx = 85 + Math.floor(x / 3);
               wy = 255 - g;
               wData.data[(wy * 256 + wx) * 4 + 1] += 50;
               wData.data[(wy * 256 + wx) * 4 + 3] = 255;

               // b parade (170-255)
               wx = 170 + Math.floor(x / 3);
               wy = 255 - b;
               wData.data[(wy * 256 + wx) * 4 + 2] += 50;
               wData.data[(wy * 256 + wx) * 4 + 3] = 255;
             }
           }
         } else {
           for (let y = 0; y < 256; y += 2) {
             for (let x = 0; x < 256; x++) {
               const idx = (y * 256 + x) * 4;
               const luma = Math.round(0.299*imgData[idx] + 0.587*imgData[idx+1] + 0.114*imgData[idx+2]);
               const wy = 255 - luma;
               const wIdx = (wy * 256 + x) * 4;
               wData.data[wIdx] = Math.min(255, wData.data[wIdx] + 50);
               wData.data[wIdx+1] = Math.min(255, wData.data[wIdx+1] + 50);
               wData.data[wIdx+2] = Math.min(255, wData.data[wIdx+2] + 50);
               wData.data[wIdx+3] = 255;
             }
           }
         }
         wCtx.putImageData(wData, 0, 0);
      }

      // 3. Vectorscope
      if (vectorscopeRef.current) {
        const vCtx = vectorscopeRef.current.getContext('2d')!;
        vCtx.fillStyle = '#111';
        vCtx.fillRect(0, 0, 256, 256);
        
        // Skin tone line
        vCtx.strokeStyle = 'rgba(255,255,255,0.2)';
        vCtx.beginPath();
        vCtx.moveTo(128, 128);
        vCtx.lineTo(128 - Math.cos(-2.1) * 128, 128 + Math.sin(-2.1) * 128); // Roughly 120 degrees depending on axis
        vCtx.stroke();
        
        // Target boxes (R, G, B, C, M, Y)
        const targets = [
          { a: 104, color: 'red' },
          { a: 243, color: 'green' },
          { a: 347, color: 'blue' },
          { a: 167, color: 'cyan' },
          { a: 61, color: 'magenta' },
          { a: 284, color: 'yellow' }
        ];
        targets.forEach(t => {
          const rad = (t.a * Math.PI) / 180;
          vCtx.strokeStyle = t.color;
          vCtx.strokeRect(128 + Math.cos(rad)*100 - 4, 128 + Math.sin(rad)*100 - 4, 8, 8);
        });

        const vData = vCtx.getImageData(0, 0, 256, 256);
        for (let i = 0; i < imgData.length; i += 4) {
          const r = imgData[i] / 255;
          const g = imgData[i+1] / 255;
          const b = imgData[i+2] / 255;
          const cb = -0.148 * r - 0.291 * g + 0.439 * b;
          const cr = 0.439 * r - 0.368 * g - 0.071 * b;
          
          const vx = Math.floor(128 + cb * 256);
          const vy = Math.floor(128 - cr * 256);
          if (vx >= 0 && vx < 256 && vy >= 0 && vy < 256) {
             const idx = (vy * 256 + vx) * 4;
             vData.data[idx] = Math.min(255, vData.data[idx] + 20);
             vData.data[idx+1] = Math.min(255, vData.data[idx+1] + 20);
             vData.data[idx+2] = Math.min(255, vData.data[idx+2] + 20);
             vData.data[idx+3] = 255;
          }
        }
        vCtx.putImageData(vData, 0, 0);
      }

      animationFrameId = requestAnimationFrame(loop);
    };

    animationFrameId = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(animationFrameId);
  }, [mode]);

  return (
    <div className="absolute inset-0 pointer-events-none p-4 flex flex-col items-end gap-2 z-50">
      <div className="pointer-events-auto bg-black/80 backdrop-blur border border-white/10 rounded-lg p-2.5 flex flex-col gap-2">
         <div className="flex justify-between items-center px-1">
           <span className="text-[10px] font-bold tracking-widest uppercase text-white/50">Scopes</span>
           <button onClick={() => setMode(m => m === 'rgb' ? 'luma' : 'rgb')} className="text-[10px] bg-white/10 px-1.5 py-0.5 rounded text-white">{mode.toUpperCase()}</button>
         </div>
         <div className={layout === 4 ? 'grid grid-cols-2 gap-2' : layout === 2 ? 'grid grid-rows-2 gap-2' : 'flex'}>
           {layout >= 1 && (
             <div className="space-y-1">
               <div className="text-[9px] text-gray-500 uppercase tracking-wider text-center">Waveform</div>
               <canvas ref={waveformRef} width={256} height={256} className="w-32 h-32 bg-[#111] rounded border border-white/5" />
             </div>
           )}
           {layout >= 2 && (
             <div className="space-y-1">
               <div className="text-[9px] text-gray-500 uppercase tracking-wider text-center">Vectorscope</div>
               <canvas ref={vectorscopeRef} width={256} height={256} className="w-32 h-32 bg-[#111] rounded border border-white/5" />
             </div>
           )}
           {layout >= 4 && (
             <div className="space-y-1 col-span-2 mt-2">
               <div className="text-[9px] text-gray-500 uppercase tracking-wider text-center">Histogram</div>
               <canvas ref={histogramRef} width={256} height={128} className="w-full h-16 bg-[#111] rounded border border-white/5" />
             </div>
           )}
         </div>
      </div>
    </div>
  );
}
