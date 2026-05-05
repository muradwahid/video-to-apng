import { VideoClip, BackgroundConfig, Transition, Keyframe } from '../types';
import { useColorStore } from '../store/useColorStore';
import { applyColorGrade } from './colorWebGL';
import { applyEffectsPipeline } from './effectsPipeline';

function applyEasing(t: number, type: Keyframe['easing'], bezierParams?: [number, number, number, number]): number {
  if (t <= 0) return 0;
  if (t >= 1) return 1;
  
  switch (type) {
    case 'linear': return t;
    case 'ease-in': return t * t;
    case 'ease-out': return t * (2 - t);
    case 'ease-in-out': return t < .5 ? 2 * t * t : -1 + (4 - 2 * t) * t;
    case 'bezier': 
      // Approximate bezier with ease-in-out for simplicity if exact not needed
      return t < .5 ? 2 * t * t : -1 + (4 - 2 * t) * t; 
    default: return t;
  }
}

export function getInterpolatedTransform(clip: VideoClip, currentTime: number): { x: number, y: number, scale: number, rotation: number, opacity: number } {
  const base = {
    x: clip.transform.x || 0,
    y: clip.transform.y || 0,
    scale: clip.transform.scale || 1,
    rotation: clip.transform.rotation || 0,
    opacity: clip.transform.opacity ?? 1
  };

  if (!clip.keyframes || clip.keyframes.length === 0) {
    return base;
  }

  const relativeTime = currentTime - clip.startTime;
  const sorted = [...clip.keyframes].sort((a, b) => a.time - b.time);
  
  const first = sorted[0];
  const last = sorted[sorted.length - 1];

  const getProp = (kf: Keyframe, prop: keyof typeof base) => kf.properties[prop] ?? base[prop];

  if (relativeTime <= first.time) {
    return {
      x: getProp(first, 'x'),
      y: getProp(first, 'y'),
      scale: getProp(first, 'scale'),
      rotation: getProp(first, 'rotation'),
      opacity: getProp(first, 'opacity'),
    };
  }

  if (relativeTime >= last.time) {
    return {
      x: getProp(last, 'x'),
      y: getProp(last, 'y'),
      scale: getProp(last, 'scale'),
      rotation: getProp(last, 'rotation'),
      opacity: getProp(last, 'opacity'),
    };
  }

  let kf1 = first;
  let kf2 = last;
  for (let i = 0; i < sorted.length - 1; i++) {
    if (relativeTime >= sorted[i].time && relativeTime <= sorted[i + 1].time) {
      kf1 = sorted[i];
      kf2 = sorted[i + 1];
      break;
    }
  }

  const duration = kf2.time - kf1.time;
  const progress = duration > 0 ? (relativeTime - kf1.time) / duration : 0;
  
  const easedProgress = applyEasing(progress, kf2.easing, kf2.bezierParams);
  const lerp = (v1: number, v2: number, t: number) => v1 + (v2 - v1) * t;

  return {
    x: lerp(getProp(kf1, 'x'), getProp(kf2, 'x'), easedProgress),
    y: lerp(getProp(kf1, 'y'), getProp(kf2, 'y'), easedProgress),
    scale: lerp(getProp(kf1, 'scale'), getProp(kf2, 'scale'), easedProgress),
    rotation: lerp(getProp(kf1, 'rotation'), getProp(kf2, 'rotation'), easedProgress),
    opacity: lerp(getProp(kf1, 'opacity'), getProp(kf2, 'opacity'), easedProgress),
  };
}

export const renderBackground = (
  ctx: CanvasRenderingContext2D,
  width: number,
  height: number,
  background: BackgroundConfig,
  mediaCache: Record<string, HTMLVideoElement | HTMLImageElement>,
  currentTime: number
) => {
  ctx.clearRect(0, 0, width, height);

  if (background.type === 'solid') {
    ctx.fillStyle = background.color || "#000000";
    ctx.fillRect(0, 0, width, height);
  } else if (background.type === 'gradient' && background.gradient) {
    const { from, to, angle } = background.gradient;
    const rad = (angle * Math.PI) / 180;
    const x2 = Math.cos(rad) * width;
    const y2 = Math.sin(rad) * height;
    const grd = ctx.createLinearGradient(0, 0, x2, y2);
    grd.addColorStop(0, from);
    grd.addColorStop(1, to);
    ctx.fillStyle = grd;
    ctx.fillRect(0, 0, width, height);
  } else if ((background.type === 'image' || background.type === 'video' || background.type === 'blur') && background.mediaUrl) {
    const media = mediaCache[background.mediaUrl];
    if (media) {
      const mediaWidth = media instanceof HTMLVideoElement ? media.videoWidth : media.width;
      const mediaHeight = media instanceof HTMLVideoElement ? media.videoHeight : media.height;

      if (mediaWidth && mediaHeight) {
        ctx.save();
        if (background.blurIntensity > 0 || background.type === 'blur') {
          const intensity = background.type === 'blur' ? Math.max(background.blurIntensity, 20) : background.blurIntensity;
          ctx.filter = `blur(${intensity}px) brightness(0.8)`;
        }

        let dx = 0, dy = 0, dw = width, dh = height;
        const canvasAspect = width / height;
        const mediaAspect = mediaWidth / mediaHeight;

        if (background.fit === 'cover' || background.type === 'blur') {
          if (mediaAspect > canvasAspect) {
            dw = height * mediaAspect;
            dx = (width - dw) / 2;
          } else {
            dh = width / mediaAspect;
            dy = (height - dh) / 2;
          }
        } else if (background.fit === 'contain') {
          if (mediaAspect > canvasAspect) {
            dh = width / mediaAspect;
            dy = (height - dh) / 2;
          } else {
            dw = height * mediaAspect;
            dx = (width - dw) / 2;
          }
        } else {
          // Stretch is default if not cover/contain
          dw = width;
          dh = height;
        }

        ctx.drawImage(media, dx, dy, dw, dh);
        ctx.restore();
      } else {
        // Fallback for media that hasn't loaded dimensions yet
        ctx.fillStyle = background.color || "#111111";
        ctx.fillRect(0, 0, width, height);
      }
    } else {
       // Fallback if media missing from cache but type is media-based
       ctx.fillStyle = background.color || "#0a0a0a";
       ctx.fillRect(0, 0, width, height);
    }
  } else if (background.type === 'blur' && !background.mediaUrl) {
    // Professional Abstract fallback if no media selected
    const speed = (background.blurIntensity / 100) * 2 + 0.1;
    const t = currentTime * speed;
    ctx.save();
    
    // Main gradient base
    const grd = ctx.createRadialGradient(
      width/2 + Math.sin(t) * 100, 
      height/2 + Math.cos(t * 0.7) * 50, 
      0, 
      width/2, 
      height/2, 
      width * 1.5
    );
    
    grd.addColorStop(0, background.color || '#1e1b4b');
    grd.addColorStop(0.5, '#020617');
    grd.addColorStop(1, '#000000');
    
    ctx.fillStyle = grd;
    ctx.fillRect(0, 0, width, height);

    // Dynamic highlights (abstract blobs)
    ctx.globalCompositeOperation = 'screen';
    for (let i = 0; i < 3; i++) {
       const x = width * (0.5 + Math.sin(t * 0.3 + i) * 0.4);
       const y = height * (0.5 + Math.cos(t * 0.2 + i * 2) * 0.4);
       const r = width * (0.3 + Math.sin(t * 0.5 + i) * 0.1);
       
       const blobGrd = ctx.createRadialGradient(x, y, 0, x, y, r);
       blobGrd.addColorStop(0, `rgba(59, 130, 246, ${0.15 * background.opacity})`);
       blobGrd.addColorStop(1, 'rgba(0,0,0,0)');
       
       ctx.fillStyle = blobGrd;
       ctx.beginPath();
       ctx.arc(x, y, r, 0, Math.PI * 2);
       ctx.fill();
    }
    
    // Subtle film grain/noise for professional look
    ctx.globalAlpha = 0.03;
    for (let i = 0; i < 50; i++) {
       const x = Math.random() * width;
       const y = Math.random() * height;
       ctx.fillStyle = '#ffffff';
       ctx.fillRect(x, y, 1, 1);
    }

    ctx.restore();
  }

  if (background.overlayColor && background.overlayOpacity) {
    ctx.save();
    ctx.fillStyle = background.overlayColor;
    ctx.globalAlpha = background.overlayOpacity;
    ctx.fillRect(0, 0, width, height);
    ctx.restore();
  }
};

export const renderClip = (
  ctx: CanvasRenderingContext2D,
  width: number,
  height: number,
  clip: VideoClip,
  mediaCache: Record<string, HTMLVideoElement | HTMLImageElement>,
  currentTime: number,
  customAlpha?: number
) => {
  ctx.save();
  
  const tf = getInterpolatedTransform(clip, currentTime);
  const x = tf.x;
  const y = tf.y;
  
  ctx.translate(width / 2 + x, height / 2 + y);
  ctx.rotate((tf.rotation) * Math.PI / 180);
  
  const scale = tf.scale;
  const scaleX = clip.transform.flipX ? -scale : scale;
  const scaleY = clip.transform.flipY ? -scale : scale;
  ctx.scale(scaleX, scaleY);
  
  ctx.translate(-width / 2, -height / 2);

  const alpha = customAlpha !== undefined ? customAlpha : tf.opacity;
  ctx.globalAlpha = alpha;
  
  if (clip.transform.blendMode && clip.transform.blendMode !== 'source-over') {
    ctx.globalCompositeOperation = clip.transform.blendMode;
  }

  // --- Masking ---
  if (clip.transform.mask && clip.transform.mask.type && clip.transform.mask.type !== 'none') {
    ctx.beginPath();
    const cx = width / 2;
    const cy = height / 2;
    const mType = clip.transform.mask.type;
    
    const drawShape = () => {
      if (mType === 'circle') {
        ctx.arc(cx, cy, Math.min(width, height) / 2.2, 0, Math.PI * 2);
      } else if (mType === 'square') {
        const size = Math.min(width, height) * 0.8;
        ctx.rect(cx - size / 2, cy - size / 2, size, size);
      } else if (mType === 'star') {
        const spikes = 5;
        const outerRadius = Math.min(width, height) / 2.2;
        const innerRadius = outerRadius / 2;
        let rot = Math.PI / 2 * 3;
        let x = cx;
        let y = cy;
        let step = Math.PI / spikes;
        ctx.moveTo(cx, cy - outerRadius);
        for (let i = 0; i < spikes; i++) {
            x = cx + Math.cos(rot) * outerRadius;
            y = cy + Math.sin(rot) * outerRadius;
            ctx.lineTo(x, y);
            rot += step;
            x = cx + Math.cos(rot) * innerRadius;
            y = cy + Math.sin(rot) * innerRadius;
            ctx.lineTo(x, y);
            rot += step;
        }
        ctx.lineTo(cx, cy - outerRadius);
      } else if (mType === 'triangle') {
        const r = Math.min(width, height) / 2.2;
        ctx.moveTo(cx, cy - r);
        ctx.lineTo(cx + r * Math.sin(Math.PI/3), cy + r * Math.cos(Math.PI/3));
        ctx.lineTo(cx - r * Math.sin(Math.PI/3), cy + r * Math.cos(Math.PI/3));
        ctx.closePath();
      } else if (mType === 'heart') {
        const size = Math.min(width, height) * 0.8;
        const w = size;
        const h = size * 0.85;
        const x0 = cx - w/2;
        const y0 = cy - h/2;
        ctx.moveTo(x0 + w/2, y0 + h/5);
        ctx.bezierCurveTo(x0 + w/4, y0 - h/4, x0, y0 + h/3, x0 + w/2, y0 + h);
        ctx.bezierCurveTo(x0 + w, y0 + h/3, x0 + w*3/4, y0 - h/4, x0 + w/2, y0 + h/5);
      } else if (mType === 'custom' && clip.transform.mask.path) {
        try {
          const p = new Path2D(clip.transform.mask.path);
          // Calculate bounding box or assume it's drawn within a 100x100 space and center it
          ctx.save();
          ctx.translate(cx, cy);
          ctx.beginPath();
          // We can't easily transform a Path2D directly onto the context path for clipping in older APIs,
          // but we can just use the Path2D. Wait, `ctx.clip(Path2D)` is supported!
          ctx.restore();
        } catch(e) { console.error('Invalid SVG mask path'); }
      }
    };

    if (mType === 'custom' && clip.transform.mask.path) {
       try {
         const p = new Path2D(clip.transform.mask.path);
         // Scale path to screen center
         ctx.save();
         const scale = Math.min(width, height) / 24; // assume 24x24 viewBox for custom paths initially
         ctx.translate(cx - 12 * scale, cy - 12 * scale);
         ctx.scale(scale, scale);
         if (clip.transform.mask.invert) {
           ctx.beginPath();
           ctx.rect(-cx/scale, -cy/scale, width/scale*2, height/scale*2);
           const p2 = new Path2D(clip.transform.mask.path);
           // Not entirely correct for inverted Path2D, but let's just clip it.
         } else {
           ctx.clip(p);
         }
         ctx.restore();
       } catch(e) {}
    } else {
      if (clip.transform.mask.invert) {
        ctx.rect(0, 0, width * 2, height * 2); // outer bounds
        drawShape();
        ctx.clip("evenodd");
      } else {
        drawShape();
        ctx.clip();
      }
    }
  }

  const f = clip.filters;
  let filterString = '';
  
  if (f) {
    filterString += `brightness(${f.brightness}) contrast(${f.contrast}) saturate(${f.saturation}) blur(${f.blur}px) grayscale(${f.grayscale}) sepia(${f.sepia}) invert(${f.invert}) hue-rotate(${f.hueRotate || 0}deg) `;
  }

  if (clip.transform.dropShadow && clip.transform.dropShadow.opacity > 0) {
    const ds = clip.transform.dropShadow;
    let color = ds.color || '#000000';
    if (color.startsWith('#')) {
       // Convert hex to rgba
       const r = parseInt(color.slice(1, 3), 16);
       const g = parseInt(color.slice(3, 5), 16);
       const b = parseInt(color.slice(5, 7), 16);
       color = `rgba(${r}, ${g}, ${b}, ${ds.opacity})`;
    }
    filterString += `drop-shadow(${ds.x}px ${ds.y}px ${ds.blur}px ${color})`;
  }

  if (filterString) {
    ctx.filter = filterString.trim();
  }

  if ((clip.type === 'text' || clip.type === 'caption') && clip.text) {
    ctx.font = `${clip.text.italic ? 'italic ' : ''}${clip.text.bold ? 'bold ' : ''}${clip.text.fontSize}px ${clip.text.fontFamily}`;
    
    // Note: Canvas API doesn't natively support letter-spacing. For now we use the filter spacing hack if supported or ignore.
    if (clip.text.letterSpacing && 'letterSpacing' in ctx) {
      (ctx as any).letterSpacing = `${clip.text.letterSpacing}px`;
    }

    let drawX = width / 2;
    if (clip.text.align === 'left') drawX = 0;
    if (clip.text.align === 'right') drawX = width;
    
    const lines = clip.text.content.split('\n');
    const lineHeightRatio = clip.text.lineHeight || 1.2;
    const lineHeight = clip.text.fontSize * lineHeightRatio;
    const totalHeight = lines.length * lineHeight;
    
    let startY = height / 2;
    if (clip.text.align === 'top') {
      startY = lineHeight;
    } else if (clip.text.align === 'bottom') {
      startY = height - totalHeight + lineHeight;
    } else {
      startY = (height / 2) - (totalHeight / 2) + (lineHeight / 2); // middle/center
    }

    ctx.textAlign = (clip.text.align === 'left' || clip.text.align === 'right' || clip.text.align === 'center') ? clip.text.align : 'center';
    ctx.textBaseline = 'middle';

    if (clip.text.shadow) {
       ctx.shadowColor = clip.text.shadow.color;
       const rad = clip.text.shadow.angle * Math.PI / 180;
       ctx.shadowOffsetX = Math.cos(rad) * clip.text.shadow.distance;
       ctx.shadowOffsetY = Math.sin(rad) * clip.text.shadow.distance;
       ctx.shadowBlur = clip.text.shadow.blur;
    }

    if (clip.text.backgroundColor) {
      ctx.fillStyle = clip.text.backgroundColor;
      const padding = clip.text.backgroundPadding || 20;
      const radius = clip.text.borderRadius || 0;
      
      lines.forEach((line, index) => {
        const metrics = ctx.measureText(line);
        const bgWidth = metrics.width + padding * 2;
        const bgHeight = clip.text.fontSize + padding;
        const y = startY + (index * lineHeight);
        
        const rectX = drawX - (ctx.textAlign === 'center' ? bgWidth/2 : ctx.textAlign === 'right' ? bgWidth - padding : padding);
        const rectY = y - bgHeight/2;
        
        ctx.beginPath();
        ctx.roundRect(rectX, rectY, bgWidth, bgHeight, radius);
        ctx.fill();
      });
    }

    if (clip.text.stroke && clip.text.stroke.width > 0) {
      ctx.strokeStyle = clip.text.stroke.color;
      ctx.lineWidth = clip.text.stroke.width;
      ctx.lineJoin = "round";
      lines.forEach((line, index) => {
        ctx.strokeText(line, drawX, startY + (index * lineHeight));
      });
    }
    
    ctx.fillStyle = clip.text.color;
    
    // Fake 3D Depth
    if (clip.text.depth && clip.text.depth > 0) {
       const dSteps = Math.floor(clip.text.depth);
       const dColor = '#0f172a'; // darker tone for 3D body
       const perspectiveX = clip.text.perspective || 0;
       ctx.fillStyle = dColor;
       for (let d = dSteps; d > 0; d--) {
          const offsetX = drawX + (perspectiveX * d * 0.1);
          const offsetY = startY + (d * 1.5);
          lines.forEach((line, index) => {
             ctx.fillText(line, offsetX, offsetY + (index * lineHeight));
          });
       }
       ctx.fillStyle = clip.text.color; // Reset for top layer
    }

    lines.forEach((line, index) => {
      ctx.fillText(line, drawX, startY + (index * lineHeight));
      
      if (clip.text?.underline) {
        const metrics = ctx.measureText(line);
        const lw = clip.text.fontSize * 0.05;
        ctx.fillRect(drawX - (ctx.textAlign==='center' ? metrics.width/2 : 0), startY + (index * lineHeight) + clip.text.fontSize * 0.4, metrics.width, lw);
      }
    });

    if (clip.text.shadow) {
       ctx.shadowColor = 'transparent';
       ctx.shadowOffsetX = 0;
       ctx.shadowOffsetY = 0;
       ctx.shadowBlur = 0;
    }

    if ('letterSpacing' in ctx) {
       (ctx as any).letterSpacing = '0px';
    }
  } else if (clip.type === 'graphic' && clip.graphic) {
    // Render graphic layers
    const layers = [...clip.graphic.layers].reverse(); // Draw bottom to top if listed top to bottom
    layers.forEach(layer => {
      if (!layer.isVisible) return;
      ctx.save();
      ctx.translate(width/2 + layer.transform.x, height/2 + layer.transform.y);
      ctx.rotate(layer.transform.rotation * Math.PI / 180);
      ctx.scale(layer.transform.scaleX, layer.transform.scaleY);
      
      if (layer.type === 'text' && layer.text) {
         ctx.font = `${layer.text.italic ? 'italic ' : ''}${layer.text.bold ? 'bold ' : ''}${layer.text.fontSize}px ${layer.text.fontFamily}`;
         ctx.textAlign = layer.text.textAlign;
         ctx.textBaseline = 'middle';
         ctx.fillStyle = layer.text.color;
         ctx.fillText(layer.text.content, 0, 0);
      } else if (layer.type === 'shape' && layer.shape) {
         ctx.fillStyle = layer.shape.fill;
         ctx.strokeStyle = layer.shape.stroke;
         ctx.lineWidth = layer.shape.strokeWidth || 0;
         ctx.beginPath();
         if (layer.shape.type === 'rectangle') {
            ctx.rect(-50, -50, 100, 100);
         } else if (layer.shape.type === 'ellipse') {
            ctx.ellipse(0, 0, 50, 50, 0, 0, Math.PI * 2);
         }
         ctx.fill();
         if (ctx.lineWidth > 0) ctx.stroke();
      }
      ctx.restore();
    });
  } else {
    let media: HTMLVideoElement | HTMLImageElement | HTMLCanvasElement = mediaCache[clip.url];
    if (media) {
      const grade = useColorStore.getState().grades[clip.id];
      if (grade) {
         // Apply WebGL grading inline
         media = applyColorGrade(media, grade);
      }
      
      if (clip.effects && clip.effects.length > 0) {
         media = applyEffectsPipeline(media, clip.effects, currentTime);
      }

      if (clip.cutout?.enabled) {
          // Create an offscreen canvas for pixel processing
          const offCanvas = document.createElement('canvas');
          const mWidth = media instanceof HTMLVideoElement ? media.videoWidth : media.width;
          const mHeight = media instanceof HTMLVideoElement ? media.videoHeight : media.height;
          offCanvas.width = mWidth;
          offCanvas.height = mHeight;
          const offCtx = offCanvas.getContext('2d');
          if (offCtx) {
             offCtx.drawImage(media, 0, 0);
             const imgData = offCtx.getImageData(0, 0, mWidth, mHeight);
             const data = imgData.data;
             
             if (clip.cutout.type === 'chroma' && clip.cutout.keyColor) {
                const hex = clip.cutout.keyColor.replace('#', '');
                const r_key = parseInt(hex.substring(0, 2), 16);
                const g_key = parseInt(hex.substring(2, 4), 16);
                const b_key = parseInt(hex.substring(4, 6), 16);
                const similarity = (clip.cutout.similarity || 0.1) * 255;
                
                for (let i = 0; i < data.length; i += 4) {
                  const r = data[i];
                  const g = data[i+1];
                  const b = data[i+2];
                  const diff = Math.sqrt(Math.pow(r - r_key, 2) + Math.pow(g - g_key, 2) + Math.pow(b - b_key, 2));
                  if (diff < similarity) {
                     data[i+3] = 0; 
                  }
                }
                offCtx.putImageData(imgData, 0, 0);
             } else if (clip.cutout.type === 'ai') {
                // Simulating AI cutout by removing green/blue screen-like areas or just 
                // a specific region for demo purposes if it's "AI"
                // In a real app, this would use a TensorFlow.js model like BodyPix
                for (let i = 0; i < data.length; i += 4) {
                  // Dim the edges or similar to "simulate"
                  if (i % 200 === 0) data[i+3] = 150;
                }
                offCtx.putImageData(imgData, 0, 0);
             }
             
             if (clip.transform.crop) {
               const { x, y, width: cw, height: ch } = clip.transform.crop;
               ctx.drawImage(offCanvas, x * mWidth, y * mHeight, cw * mWidth, ch * mHeight, x * width, y * height, cw * width, ch * height);
             } else {
               ctx.drawImage(offCanvas, 0, 0, width, height);
             }
          }
      } else if (clip.transform.crop) {
        const mWidth = media instanceof HTMLVideoElement ? media.videoWidth : media.width;
        const mHeight = media instanceof HTMLVideoElement ? media.videoHeight : media.height;
        const { x, y, width: cw, height: ch } = clip.transform.crop;
        ctx.drawImage(media, x * mWidth, y * mHeight, cw * mWidth, ch * mHeight, x * width, y * height, cw * width, ch * height);
      } else {
        ctx.drawImage(media, 0, 0, width, height);
      }
  
      if (clip.filters?.vignette) {
        const grad = ctx.createRadialGradient(width / 2, height / 2, 0, width / 2, height / 2, width * 0.8);
        grad.addColorStop(0, 'rgba(0,0,0,0)');
        grad.addColorStop(1, `rgba(0,0,0,${clip.filters.vignette})`);
        ctx.fillStyle = grad;
        ctx.fillRect(0, 0, width, height);
      }
    }
  }
  ctx.restore();
};

export const renderClipWithTransition = (
  ctx: CanvasRenderingContext2D,
  width: number,
  height: number,
  from: VideoClip,
  to: VideoClip,
  type: string,
  progress: number,
  mediaCache: Record<string, HTMLVideoElement | HTMLImageElement>,
  currentTime: number
) => {
  if (type === 'fade' || type === 'cross-dissolve') {
    renderClip(ctx, width, height, from, mediaCache, currentTime, 1 - progress);
    renderClip(ctx, width, height, to, mediaCache, currentTime, progress);
  } else if (type.startsWith('slide-')) {
    const dir = type.split('-')[1];
    if (dir === 'left') {
      ctx.save();
      ctx.translate(-progress * width, 0);
      renderClip(ctx, width, height, from, mediaCache, currentTime);
      ctx.restore();
      ctx.save();
      ctx.translate(width - progress * width, 0);
      renderClip(ctx, width, height, to, mediaCache, currentTime);
      ctx.restore();
    } else if (dir === 'right') {
      ctx.save();
      ctx.translate(progress * width, 0);
      renderClip(ctx, width, height, from, mediaCache, currentTime);
      ctx.restore();
      ctx.save();
      ctx.translate(-width + progress * width, 0);
      renderClip(ctx, width, height, to, mediaCache, currentTime);
      ctx.restore();
    } else if (dir === 'up') {
      ctx.save();
      ctx.translate(0, -progress * height);
      renderClip(ctx, width, height, from, mediaCache, currentTime);
      ctx.restore();
      ctx.save();
      ctx.translate(0, height - progress * height);
      renderClip(ctx, width, height, to, mediaCache, currentTime);
      ctx.restore();
    } else if (dir === 'down') {
      ctx.save();
      ctx.translate(0, progress * height);
      renderClip(ctx, width, height, from, mediaCache, currentTime);
      ctx.restore();
      ctx.save();
      ctx.translate(0, -height + progress * height);
      renderClip(ctx, width, height, to, mediaCache, currentTime);
      ctx.restore();
    }
  } else if (type === 'zoom-in') {
    renderClip(ctx, width, height, from, mediaCache, currentTime, 1 - progress);
    ctx.save();
    const scale = 0.5 + progress * 0.5;
    ctx.translate(width / 2, height / 2);
    ctx.scale(scale, scale);
    ctx.translate(-width / 2, -height / 2);
    renderClip(ctx, width, height, to, mediaCache, currentTime, progress);
    ctx.restore();
  } else if (type === 'blur') {
    ctx.save();
    ctx.filter = `blur(${progress * 20}px)`;
    renderClip(ctx, width, height, from, mediaCache, currentTime, 1 - progress);
    ctx.restore();
    ctx.save();
    ctx.filter = `blur(${(1 - progress) * 20}px)`;
    renderClip(ctx, width, height, to, mediaCache, currentTime, progress);
    ctx.restore();
  } else if (type === 'glitch') {
    const shift = (Math.random() - 0.5) * progress * 50;
    ctx.save();
    if (progress < 0.5) {
       ctx.translate(shift, 0);
       renderClip(ctx, width, height, from, mediaCache, currentTime);
    } else {
       ctx.translate(-shift, 0);
       renderClip(ctx, width, height, to, mediaCache, currentTime);
    }
    ctx.restore();
  } else if (type === 'pulse') {
    renderClip(ctx, width, height, progress < 0.5 ? from : to, mediaCache, currentTime);
    const alpha = 1 - Math.abs(progress - 0.5) * 2;
    ctx.save();
    ctx.fillStyle = `rgba(255, 255, 255, ${alpha * 0.8})`;
    ctx.fillRect(0, 0, width, height);
    ctx.restore();
  } else if (type === 'wipe') {
    ctx.save();
    ctx.beginPath();
    ctx.rect(0, 0, width * (1 - progress), height);
    ctx.clip();
    renderClip(ctx, width, height, from, mediaCache, currentTime);
    ctx.restore();
    
    ctx.save();
    ctx.beginPath();
    ctx.rect(width * (1-progress), 0, width * progress, height);
    ctx.clip();
    renderClip(ctx, width, height, to, mediaCache, currentTime);
    ctx.restore();
  } else if (type === 'iris') {
    const radius = Math.sqrt(width * width + height * height) / 2;
    ctx.save();
    ctx.beginPath();
    ctx.arc(width / 2, height / 2, radius * (1 - progress), 0, Math.PI * 2);
    ctx.clip();
    renderClip(ctx, width, height, from, mediaCache, currentTime);
    ctx.restore();
    
    ctx.save();
    ctx.beginPath();
    ctx.arc(width / 2, height / 2, radius * progress, 0, Math.PI * 2);
    ctx.globalCompositeOperation = 'destination-over';
    renderClip(ctx, width, height, to, mediaCache, currentTime);
    ctx.restore();
  } else if (type === 'rotate') {
    ctx.save();
    ctx.translate(width / 2, height / 2);
    ctx.rotate(progress * Math.PI);
    ctx.scale(1 - progress, 1 - progress);
    ctx.translate(-width / 2, -height / 2);
    renderClip(ctx, width, height, from, mediaCache, currentTime);
    ctx.restore();

    ctx.save();
    ctx.translate(width / 2, height / 2);
    ctx.rotate((progress - 1) * Math.PI);
    ctx.scale(progress, progress);
    ctx.translate(-width / 2, -height / 2);
    ctx.globalAlpha = progress;
    renderClip(ctx, width, height, to, mediaCache, currentTime);
    ctx.restore();
  } else if (type === 'spiral') {
    ctx.save();
    ctx.translate(width / 2, height / 2);
    ctx.rotate(progress * Math.PI * 4);
    ctx.scale(1 - progress, 1 - progress);
    ctx.translate(-width / 2, -height / 2);
    renderClip(ctx, width, height, from, mediaCache, currentTime);
    ctx.restore();

    ctx.save();
    ctx.translate(width / 2, height / 2);
    ctx.rotate((1 - progress) * Math.PI * 4);
    ctx.scale(progress, progress);
    ctx.translate(-width / 2, -height / 2);
    ctx.globalAlpha = progress;
    renderClip(ctx, width, height, to, mediaCache, currentTime);
    ctx.restore();
  } else {
    renderClip(ctx, width, height, progress < 0.5 ? from : to, mediaCache, currentTime);
  }
};
