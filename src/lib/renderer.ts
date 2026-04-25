import { VideoClip, BackgroundConfig, Transition } from '../types';

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
    // Abstract fallback if no media selected
    const grd = ctx.createRadialGradient(width/2, height/2, 0, width/2, height/2, width);
    grd.addColorStop(0, '#1e1b4b');
    grd.addColorStop(1, '#020617');
    ctx.fillStyle = grd;
    ctx.fillRect(0, 0, width, height);
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
  customAlpha?: number
) => {
  ctx.save();
  ctx.translate(width / 2, height / 2);
  ctx.rotate((clip.transform.rotation || 0) * Math.PI / 180);
  ctx.scale(clip.transform.scale || 1, clip.transform.scale || 1);
  ctx.translate(-width / 2, -height / 2);

  const alpha = customAlpha !== undefined ? customAlpha : (clip.transform.opacity ?? 1);
  ctx.globalAlpha = alpha;

  if (clip.filters) {
    const f = clip.filters;
    ctx.filter = `brightness(${f.brightness}) contrast(${f.contrast}) saturate(${f.saturation}) blur(${f.blur}px) grayscale(${f.grayscale}) sepia(${f.sepia}) invert(${f.invert})`;
  }

  const media = mediaCache[clip.url];
  if (media) {
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
  mediaCache: Record<string, HTMLVideoElement | HTMLImageElement>
) => {
  if (type === 'fade' || type === 'cross-dissolve') {
    renderClip(ctx, width, height, from, mediaCache, 1 - progress);
    renderClip(ctx, width, height, to, mediaCache, progress);
  } else if (type.startsWith('slide-')) {
    const dir = type.split('-')[1];
    if (dir === 'left') {
      ctx.save();
      ctx.translate(-progress * width, 0);
      renderClip(ctx, width, height, from, mediaCache);
      ctx.restore();
      ctx.save();
      ctx.translate(width - progress * width, 0);
      renderClip(ctx, width, height, to, mediaCache);
      ctx.restore();
    } else if (dir === 'right') {
      ctx.save();
      ctx.translate(progress * width, 0);
      renderClip(ctx, width, height, from, mediaCache);
      ctx.restore();
      ctx.save();
      ctx.translate(-width + progress * width, 0);
      renderClip(ctx, width, height, to, mediaCache);
      ctx.restore();
    } else if (dir === 'up') {
      ctx.save();
      ctx.translate(0, -progress * height);
      renderClip(ctx, width, height, from, mediaCache);
      ctx.restore();
      ctx.save();
      ctx.translate(0, height - progress * height);
      renderClip(ctx, width, height, to, mediaCache);
      ctx.restore();
    } else if (dir === 'down') {
      ctx.save();
      ctx.translate(0, progress * height);
      renderClip(ctx, width, height, from, mediaCache);
      ctx.restore();
      ctx.save();
      ctx.translate(0, -height + progress * height);
      renderClip(ctx, width, height, to, mediaCache);
      ctx.restore();
    }
  } else if (type === 'zoom-in') {
    renderClip(ctx, width, height, from, mediaCache, 1 - progress);
    ctx.save();
    const scale = 0.5 + progress * 0.5;
    ctx.translate(width / 2, height / 2);
    ctx.scale(scale, scale);
    ctx.translate(-width / 2, -height / 2);
    renderClip(ctx, width, height, to, mediaCache, progress);
    ctx.restore();
  } else if (type === 'blur') {
    ctx.save();
    ctx.filter = `blur(${progress * 20}px)`;
    renderClip(ctx, width, height, from, mediaCache, 1 - progress);
    ctx.restore();
    ctx.save();
    ctx.filter = `blur(${(1 - progress) * 20}px)`;
    renderClip(ctx, width, height, to, mediaCache, progress);
    ctx.restore();
  } else if (type === 'glitch') {
    const shift = (Math.random() - 0.5) * progress * 50;
    ctx.save();
    if (progress < 0.5) {
       ctx.translate(shift, 0);
       renderClip(ctx, width, height, from, mediaCache);
    } else {
       ctx.translate(-shift, 0);
       renderClip(ctx, width, height, to, mediaCache);
    }
    ctx.restore();
  } else if (type === 'pulse') {
    renderClip(ctx, width, height, progress < 0.5 ? from : to, mediaCache);
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
    renderClip(ctx, width, height, from, mediaCache);
    ctx.restore();
    
    ctx.save();
    ctx.beginPath();
    ctx.rect(width * (1-progress), 0, width * progress, height);
    ctx.clip();
    renderClip(ctx, width, height, to, mediaCache);
    ctx.restore();
  } else if (type === 'iris') {
    const radius = Math.sqrt(width * width + height * height) / 2;
    ctx.save();
    ctx.beginPath();
    ctx.arc(width / 2, height / 2, radius * (1 - progress), 0, Math.PI * 2);
    ctx.clip();
    renderClip(ctx, width, height, from, mediaCache);
    ctx.restore();
    
    ctx.save();
    ctx.beginPath();
    ctx.arc(width / 2, height / 2, radius * progress, 0, Math.PI * 2);
    ctx.globalCompositeOperation = 'destination-over';
    renderClip(ctx, width, height, to, mediaCache);
    ctx.restore();
  } else if (type === 'rotate') {
    ctx.save();
    ctx.translate(width / 2, height / 2);
    ctx.rotate(progress * Math.PI);
    ctx.scale(1 - progress, 1 - progress);
    ctx.translate(-width / 2, -height / 2);
    renderClip(ctx, width, height, from, mediaCache);
    ctx.restore();

    ctx.save();
    ctx.translate(width / 2, height / 2);
    ctx.rotate((progress - 1) * Math.PI);
    ctx.scale(progress, progress);
    ctx.translate(-width / 2, -height / 2);
    ctx.globalAlpha = progress;
    renderClip(ctx, width, height, to, mediaCache);
    ctx.restore();
  } else if (type === 'spiral') {
    ctx.save();
    ctx.translate(width / 2, height / 2);
    ctx.rotate(progress * Math.PI * 4);
    ctx.scale(1 - progress, 1 - progress);
    ctx.translate(-width / 2, -height / 2);
    renderClip(ctx, width, height, from, mediaCache);
    ctx.restore();

    ctx.save();
    ctx.translate(width / 2, height / 2);
    ctx.rotate((1 - progress) * Math.PI * 4);
    ctx.scale(progress, progress);
    ctx.translate(-width / 2, -height / 2);
    ctx.globalAlpha = progress;
    renderClip(ctx, width, height, to, mediaCache);
    ctx.restore();
  } else {
    renderClip(ctx, width, height, progress < 0.5 ? from : to, mediaCache);
  }
};
