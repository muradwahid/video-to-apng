import { EffectNode } from '../types';
import { EFFECT_DEFS } from './effectsDefs';

const vertexShaderSource = `
  attribute vec2 a_position;
  attribute vec2 a_texCoord;
  varying vec2 v_texCoord;
  void main() {
    gl_Position = vec4(a_position, 0.0, 1.0);
    v_texCoord = a_texCoord;
  }
`;

class EffectsPipelineManager {
  private canvas: HTMLCanvasElement;
  private gl: WebGLRenderingContext;
  
  private positionBuffer: WebGLBuffer;
  private texCoordBuffer: WebGLBuffer;
  
  private programs: Record<string, WebGLProgram> = {};
  
  // Ping-pong framebuffers
  private textures: [WebGLTexture, WebGLTexture] = [null as any, null as any];
  private framebuffers: [WebGLFramebuffer, WebGLFramebuffer] = [null as any, null as any];

  constructor() {
    this.canvas = document.createElement('canvas');
    this.gl = this.canvas.getContext('webgl', { premultipliedAlpha: false, preserveDrawingBuffer: true })!;
    const gl = this.gl;

    this.positionBuffer = gl.createBuffer()!;
    gl.bindBuffer(gl.ARRAY_BUFFER, this.positionBuffer);
    gl.bufferData(
      gl.ARRAY_BUFFER,
      new Float32Array([
        -1.0, -1.0,
         1.0, -1.0,
        -1.0,  1.0,
        -1.0,  1.0,
         1.0, -1.0,
         1.0,  1.0,
      ]),
      gl.STATIC_DRAW
    );

    this.texCoordBuffer = gl.createBuffer()!;
    gl.bindBuffer(gl.ARRAY_BUFFER, this.texCoordBuffer);
    gl.bufferData(
      gl.ARRAY_BUFFER,
      new Float32Array([
        0.0, 1.0,
        1.0, 1.0,
        0.0, 0.0,
        0.0, 0.0,
        1.0, 1.0,
        1.0, 0.0,
      ]),
      gl.STATIC_DRAW
    );

    this.textures[0] = this.createTexture();
    this.textures[1] = this.createTexture();
    this.framebuffers[0] = this.createFramebuffer(this.textures[0]);
    this.framebuffers[1] = this.createFramebuffer(this.textures[1]);
  }

  private createTexture(): WebGLTexture {
    const gl = this.gl;
    const tex = gl.createTexture()!;
    gl.bindTexture(gl.TEXTURE_2D, tex);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
    return tex;
  }

  private createFramebuffer(texture: WebGLTexture): WebGLFramebuffer {
    const gl = this.gl;
    const fb = gl.createFramebuffer()!;
    gl.bindFramebuffer(gl.FRAMEBUFFER, fb);
    gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_2D, texture, 0);
    return fb;
  }

  private getProgram(type: string): WebGLProgram | null {
    if (this.programs[type]) return this.programs[type];
    
    const def = EFFECT_DEFS.find(d => d.id === type);
    if (!def && type !== "copy") return null;

    const gl = this.gl;
    const vs = gl.createShader(gl.VERTEX_SHADER)!;
    gl.shaderSource(vs, vertexShaderSource);
    gl.compileShader(vs);

    const fs = gl.createShader(gl.FRAGMENT_SHADER)!;
    gl.shaderSource(fs, type === "copy" ? "precision mediump float; uniform sampler2D u_image; varying vec2 v_texCoord; void main(){ gl_FragColor = texture2D(u_image, v_texCoord); }" : def!.fragmentSource);
    gl.compileShader(fs);

    const prog = gl.createProgram()!;
    gl.attachShader(prog, vs);
    gl.attachShader(prog, fs);
    gl.linkProgram(prog);
    
    this.programs[type] = prog;
    return prog;
  }

  private resize(width: number, height: number) {
    if (this.canvas.width === width && this.canvas.height === height) return;
    this.canvas.width = width;
    this.canvas.height = height;
    const gl = this.gl;
    gl.viewport(0, 0, width, height);

    gl.bindTexture(gl.TEXTURE_2D, this.textures[0]);
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, width, height, 0, gl.RGBA, gl.UNSIGNED_BYTE, null);

    gl.bindTexture(gl.TEXTURE_2D, this.textures[1]);
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, width, height, 0, gl.RGBA, gl.UNSIGNED_BYTE, null);
  }

  public process(media: HTMLVideoElement | HTMLImageElement | HTMLCanvasElement, effects: EffectNode[], time: number): HTMLCanvasElement {
    const width = media instanceof HTMLVideoElement ? media.videoWidth : media.width;
    const height = media instanceof HTMLVideoElement ? media.videoHeight : media.height;
    if (width === 0 || height === 0) return this.canvas;
    
    this.resize(width, height);
    const gl = this.gl;

    const activeEffects = (effects || []).filter(e => e.enabled);
    if (activeEffects.length === 0) {
      // Just draw to canvas
      gl.bindFramebuffer(gl.FRAMEBUFFER, null);
      gl.clear(gl.COLOR_BUFFER_BIT);
      gl.activeTexture(gl.TEXTURE0);
      const tex = gl.createTexture();
      gl.bindTexture(gl.TEXTURE_2D, tex);
      gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, media);
      // Wait, we need a simple copy program if no effects. 
      // Instead, just load it into texture 0, apply a 'pass-through' filter or skip if empty.
      // But if there are no effects, we don't even call this pipeline, the renderer skips it.
    }

    // Unpack media to texture 0
    gl.activeTexture(gl.TEXTURE0);
    gl.bindTexture(gl.TEXTURE_2D, this.textures[0]);
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, media);

    let readIndex = 0;
    let writeIndex = 1;

    for (let i = 0; i < activeEffects.length; i++) {
        const effect = activeEffects[i];
        const prog = this.getProgram(effect.type);
        if (!prog) continue;

        gl.bindFramebuffer(gl.FRAMEBUFFER, this.framebuffers[writeIndex]);
        gl.useProgram(prog);

        gl.activeTexture(gl.TEXTURE0);
        gl.bindTexture(gl.TEXTURE_2D, this.textures[readIndex]);
        const uImage = gl.getUniformLocation(prog, "u_image");
        gl.uniform1i(uImage, 0);

        // Common Uniforms
        const uRes = gl.getUniformLocation(prog, "u_resolution");
        if (uRes) gl.uniform2f(uRes, width, height);
        
        const uTime = gl.getUniformLocation(prog, "u_time");
        if (uTime) gl.uniform1f(uTime, time);

        // Specific Params
        const params = effect.params;
        for (const [key, val] of Object.entries(params)) {
            const loc = gl.getUniformLocation(prog, "u_" + key);
            if (loc) {
                if (typeof val === 'number') {
                    gl.uniform1f(loc, val);
                } else if (Array.isArray(val)) {
                    if (val.length === 2) gl.uniform2fv(loc, val);
                    if (val.length === 3) gl.uniform3fv(loc, val);
                    if (val.length === 4) gl.uniform4fv(loc, val);
                }
            }
        }

        const aPosition = gl.getAttribLocation(prog, "a_position");
        gl.enableVertexAttribArray(aPosition);
        gl.bindBuffer(gl.ARRAY_BUFFER, this.positionBuffer);
        gl.vertexAttribPointer(aPosition, 2, gl.FLOAT, false, 0, 0);

        const aTexCoord = gl.getAttribLocation(prog, "a_texCoord");
        gl.enableVertexAttribArray(aTexCoord);
        gl.bindBuffer(gl.ARRAY_BUFFER, this.texCoordBuffer);
        gl.vertexAttribPointer(aTexCoord, 2, gl.FLOAT, false, 0, 0);

        // If it's a multi-pass effect like blur, we can do two passes. 
        // For simplicity, SHADERS.blur takes a direction param, so we just run it twice if it's blur.
        if (effect.type === 'blur') {
             // Pass 1: Horizontal
             gl.uniform2f(gl.getUniformLocation(prog, "u_direction"), 1, 0);
             gl.drawArrays(gl.TRIANGLES, 0, 6);

             // Swap
             readIndex = writeIndex;
             writeIndex = 1 - writeIndex;

             // Pass 2: Vertical
             gl.bindFramebuffer(gl.FRAMEBUFFER, this.framebuffers[writeIndex]);
             gl.bindTexture(gl.TEXTURE_2D, this.textures[readIndex]);
             gl.uniform2f(gl.getUniformLocation(prog, "u_direction"), 0, 1);
             gl.drawArrays(gl.TRIANGLES, 0, 6);
        } else {
             gl.drawArrays(gl.TRIANGLES, 0, 6);
        }

        readIndex = writeIndex;
        writeIndex = 1 - writeIndex;
    }

    // Final pass to canvas
    // Or we just read from the last written texture. The easiest is to copy texture[readIndex] to the main canvas.
    gl.bindFramebuffer(gl.FRAMEBUFFER, null);
    
    // We can use a simple copy shader
    const prog = this.getProgram("copy") || (()=>{
        const vs = gl.createShader(gl.VERTEX_SHADER)!;
        gl.shaderSource(vs, vertexShaderSource);
        gl.compileShader(vs);
        const fs = gl.createShader(gl.FRAGMENT_SHADER)!;
        gl.shaderSource(fs, "precision mediump float; uniform sampler2D u_image; varying vec2 v_texCoord; void main(){ gl_FragColor = texture2D(u_image, v_texCoord); }");
        gl.compileShader(fs);
        const p = gl.createProgram()!;
        gl.attachShader(p, vs); gl.attachShader(p, fs); gl.linkProgram(p);
        this.programs["copy"] = p;
        return p;
    })();

    gl.useProgram(prog);
    gl.activeTexture(gl.TEXTURE0);
    gl.bindTexture(gl.TEXTURE_2D, this.textures[readIndex]);
    gl.uniform1i(gl.getUniformLocation(prog, "u_image"), 0);

    const aPosition = gl.getAttribLocation(prog, "a_position");
    gl.enableVertexAttribArray(aPosition);
    gl.bindBuffer(gl.ARRAY_BUFFER, this.positionBuffer);
    gl.vertexAttribPointer(aPosition, 2, gl.FLOAT, false, 0, 0);

    const aTexCoord = gl.getAttribLocation(prog, "a_texCoord");
    gl.enableVertexAttribArray(aTexCoord);
    gl.bindBuffer(gl.ARRAY_BUFFER, this.texCoordBuffer);
    gl.vertexAttribPointer(aTexCoord, 2, gl.FLOAT, false, 0, 0);

    gl.drawArrays(gl.TRIANGLES, 0, 6);

    return this.canvas;
  }
}

let pipeline: EffectsPipelineManager | null = null;
export function applyEffectsPipeline(media: HTMLVideoElement | HTMLImageElement | HTMLCanvasElement, effects: EffectNode[], time: number) {
  if (!pipeline) pipeline = new EffectsPipelineManager();
  return pipeline.process(media, effects, time);
}
