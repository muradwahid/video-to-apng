export interface CaptionNode {
  id: string;
  start: number;
  end: number;
  text: string;
}

export function parseSRT(srtData: string): CaptionNode[] {
  const normalize = srtData.replace(/\r\n/g, '\n').replace(/\r/g, '\n').split('\n\n');
  const captions: CaptionNode[] = [];
  
  normalize.forEach((block) => {
    const lines = block.split('\n').filter(line => line.trim() !== '');
    if (lines.length >= 2) {
      const id = lines[0];
      const timecode = lines[1];
      const text = lines.slice(2).join('\n');
      
      const tcRegex = /(\d{2}):(\d{2}):(\d{2}),(\d{3})\s*-->\s*(\d{2}):(\d{2}):(\d{2}),(\d{3})/;
      const match = tcRegex.exec(timecode);
      
      if (match) {
        const start = parseInt(match[1]) * 3600 + parseInt(match[2]) * 60 + parseInt(match[3]) + parseInt(match[4]) / 1000;
        const end = parseInt(match[5]) * 3600 + parseInt(match[6]) * 60 + parseInt(match[7]) + parseInt(match[8]) / 1000;
        
        captions.push({ id, start, end, text });
      }
    }
  });
  
  return captions;
}

export function parseVTT(vttData: string): CaptionNode[] {
  const normalize = vttData.replace(/\r\n/g, '\n').replace(/\r/g, '\n').split('\n\n');
  const captions: CaptionNode[] = [];
  let idCounter = 1;
  
  normalize.forEach((block, index) => {
    if (index === 0 && block.startsWith('WEBVTT')) return; // Skip header
    
    const lines = block.split('\n').filter(line => line.trim() !== '');
    if (lines.length >= 1) {
      let timecodeLine = lines[0];
      let textLines = lines.slice(1);
      
      if (!timecodeLine.includes('-->') && lines.length > 1) {
         timecodeLine = lines[1];
         textLines = lines.slice(2);
      }
      
      const text = textLines.join('\n');
      const tcRegex = /(?:(\d{2,}):)?(\d{2}):(\d{2})\.(\d{3})\s*-->\s*(?:(\d{2,}):)?(\d{2}):(\d{2})\.(\d{3})/;
      const match = tcRegex.exec(timecodeLine);
      
      if (match) {
        const h1 = match[1] ? parseInt(match[1]) : 0;
        const m1 = parseInt(match[2]);
        const s1 = parseInt(match[3]);
        const ms1 = parseInt(match[4]);
        
        const h2 = match[5] ? parseInt(match[5]) : 0;
        const m2 = parseInt(match[6]);
        const s2 = parseInt(match[7]);
        const ms2 = parseInt(match[8]);
        
        const start = h1 * 3600 + m1 * 60 + s1 + ms1 / 1000;
        const end = h2 * 3600 + m2 * 60 + s2 + ms2 / 1000;
        
        captions.push({ id: idCounter.toString(), start, end, text });
        idCounter++;
      }
    }
  });
  
  return captions;
}

export function formatSRT(captions: CaptionNode[]): string {
  const pad = (n: number, z = 2) => ('00' + n).slice(-z);
  const formatTime = (seconds: number) => {
    const h = Math.floor(seconds / 3600);
    const m = Math.floor((seconds % 3600) / 60);
    const s = Math.floor(seconds % 60);
    const ms = Math.floor((seconds % 1) * 1000);
    return `${pad(h)}:${pad(m)}:${pad(s)},${pad(ms, 3)}`;
  };
  
  return captions.map((c, i) => `${i + 1}\n${formatTime(c.start)} --> ${formatTime(c.end)}\n${c.text}\n\n`).join('');
}

export function formatVTT(captions: CaptionNode[]): string {
  const pad = (n: number, z = 2) => ('00' + n).slice(-z);
  const formatTime = (seconds: number) => {
    const h = Math.floor(seconds / 3600);
    const m = Math.floor((seconds % 3600) / 60);
    const s = Math.floor(seconds % 60);
    const ms = Math.floor((seconds % 1) * 1000);
    return `${pad(h)}:${pad(m)}:${pad(s)}.${pad(ms, 3)}`;
  };
  
  const blocks = captions.map((c, i) => `${i + 1}\n${formatTime(c.start)} --> ${formatTime(c.end)}\n${c.text}\n\n`);
  return `WEBVTT\n\n${blocks.join('')}`;
}
