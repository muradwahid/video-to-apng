/**
 * Mock WebCodecs and WASM decoder utility for modern and RAW formats.
 * Provides a unified pipeline mock for WebCodecs and custom WASM decoders (N-RAW, CRM).
 */

export interface DecoderParams {
  colorSpace?: 'rec709' | 'slog2' | 'vlog' | 'clog' | 'auto';
  decodeTo10Bit?: boolean;
}

export class RawVideoDecoder {
  private format: string;
  private frameQueue: Array<any> = [];
  
  constructor(format: string) {
    this.format = format;
  }

  async initialize() {
    console.log(`[Decoder] Initializing hardware acceleration (WebCodecs) / WASM for ${this.format}`);
    await new Promise(r => setTimeout(r, 100)); // fast mock
  }

  // Uses WebCodecs to decode H.264/HEVC or WASM for RAW formats
  async decodeFrame(time: number, params: DecoderParams): Promise<ImageBitmap | HTMLCanvasElement> {
    // Check internal queue first (mocking a real frame queue for smooth playback)
    const queuedFrame = this.frameQueue.find(f => Math.abs(f.time - time) < 0.05);
    if (queuedFrame) return queuedFrame.image;

    const canvas = document.createElement('canvas');
    canvas.width = 1920;
    canvas.height = 1080;
    const ctx = canvas.getContext('2d');
    if (ctx) {
      ctx.fillStyle = '#050505';
      ctx.fillRect(0, 0, 1920, 1080);
      ctx.fillStyle = params.colorSpace === 'slog2' ? '#a5a5a5' : '#fff';
      ctx.font = '48px monospace';
      ctx.fillText(`${this.format.toUpperCase()} Hardware/RAW Decode`, 100, 100);
      ctx.fillText(`Time: ${time.toFixed(3)}s`, 100, 160);
      ctx.fillText(`Color Space: ${params.colorSpace || 'auto'}`, 100, 220);
      ctx.fillText(`Depth: ${params.decodeTo10Bit ? '10-bit HDR (Float16)' : '8-bit SDR'}`, 100, 280);
      ctx.fillStyle = '#0f0';
      ctx.fillText(`WebCodecs Accelerated`, 100, 340);
    }
    
    // push to simple bounded mock queue
    this.frameQueue.push({ time, image: canvas });
    if (this.frameQueue.length > 5) this.frameQueue.shift();

    return canvas;
  }
}

export async function detectFormat(file: File): Promise<string> {
  const ext = file.name.split('.').pop()?.toLowerCase();
  switch (ext) {
    case 'nef':
    case 'nrw': return 'n-raw';
    case 'crm': return 'crm';
    case 'mxf': return 'dnxhd';
    case 'webm': return 'vp9';
    case 'mkv': return 'mkv';
    default: return 'mp4';
  }
}
