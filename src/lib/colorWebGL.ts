import { ColorGradeState } from '../store/useColorStore';

const vertexShaderSource = `
  attribute vec2 a_position;
  attribute vec2 a_texCoord;
  varying vec2 v_texCoord;
  void main() {
    gl_Position = vec4(a_position, 0.0, 1.0);
    v_texCoord = a_texCoord;
  }
`;

const fragmentShaderSource = `
  precision mediump float;
  uniform sampler2D u_image;
  varying vec2 v_texCoord;

  // Basic Correct
  uniform float u_exposure;
  uniform float u_contrast;
  uniform float u_saturation;
  uniform float u_temperature;
  uniform float u_tint;
  
  // Vignette
  uniform float u_vignetteAmount;
  uniform float u_vignetteMidpoint;

  // Wheel Lift, Gamma, Gain
  uniform vec3 u_lift;
  uniform vec3 u_gamma;
  uniform vec3 u_gain;

  vec3 applyLiftGammaGain(vec3 color, vec3 lift, vec3 gamma, vec3 gain) {
     vec3 c = color;
     c = c * (gain + 1.0) + lift * (1.0 - c);
     c = sign(c) * pow(abs(c), 1.0 / max(gamma + 1.0, 0.001));
     return c;
  }

  vec3 rgb2hsv(vec3 c) {
      vec4 K = vec4(0.0, -1.0 / 3.0, 2.0 / 3.0, -1.0);
      vec4 p = mix(vec4(c.bg, K.wz), vec4(c.gb, K.xy), step(c.b, c.g));
      vec4 q = mix(vec4(p.xyw, c.r), vec4(c.r, p.yzx), step(p.x, c.r));
      float d = q.x - min(q.w, q.y);
      float e = 1.0e-10;
      return vec3(abs(q.z + (q.w - q.y) / (6.0 * d + e)), d / (q.x + e), q.x);
  }

  vec3 hsv2rgb(vec3 c) {
      vec4 K = vec4(1.0, 2.0 / 3.0, 1.0 / 3.0, 3.0);
      vec3 p = abs(fract(c.xxx + K.xyz) * 6.0 - K.www);
      return c.z * mix(K.xxx, clamp(p - K.xxx, 0.0, 1.0), c.y);
  }

  void main() {
    vec4 texColor = texture2D(u_image, v_texCoord);
    vec3 color = texColor.rgb;

    // Exposure
    color = color * pow(2.0, u_exposure);

    // Contrast
    color = (color - 0.5) * max(u_contrast + 1.0, 0.0) + 0.5;

    // Saturation
    float luma = dot(color, vec3(0.299, 0.587, 0.114));
    color = mix(vec3(luma), color, u_saturation);

    // Temp Check
    color.r *= clamp(1.0 + u_temperature, 0.0, 2.0);
    color.b *= clamp(1.0 - u_temperature, 0.0, 2.0);

    // Tint Check
    color.g *= clamp(1.0 + u_tint, 0.0, 2.0);

    // Lift, Gamma, Gain
    color = applyLiftGammaGain(color, u_lift, u_gamma, u_gain);

    // Vignette
    float dist = distance(v_texCoord, vec2(0.5, 0.5));
    float vignette = smoothstep(u_vignetteMidpoint, u_vignetteMidpoint + 0.4, dist);
    color = mix(color, vec3(0.0), vignette * u_vignetteAmount);

    gl_FragColor = vec4(clamp(color, 0.0, 1.0), texColor.a);
  }
`;

class WebGLColorGrader {
  private canvas: HTMLCanvasElement;
  private gl: WebGLRenderingContext;
  private program: WebGLProgram;
  private positionBuffer: WebGLBuffer;
  private texCoordBuffer: WebGLBuffer;
  private texture: WebGLTexture;

  constructor() {
    this.canvas = document.createElement('canvas');
    this.gl = this.canvas.getContext('webgl')!;
    const gl = this.gl;

    const vs = gl.createShader(gl.VERTEX_SHADER)!;
    gl.shaderSource(vs, vertexShaderSource);
    gl.compileShader(vs);

    const fs = gl.createShader(gl.FRAGMENT_SHADER)!;
    gl.shaderSource(fs, fragmentShaderSource);
    gl.compileShader(fs);

    this.program = gl.createProgram()!;
    gl.attachShader(this.program, vs);
    gl.attachShader(this.program, fs);
    gl.linkProgram(this.program);

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

    this.texture = gl.createTexture()!;
    gl.bindTexture(gl.TEXTURE_2D, this.texture);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
  }

  public process(media: HTMLVideoElement | HTMLImageElement | HTMLCanvasElement, grade: ColorGradeState): HTMLCanvasElement {
    const gl = this.gl;
    const width = media instanceof HTMLVideoElement ? media.videoWidth : media.width;
    const height = media instanceof HTMLVideoElement ? media.videoHeight : media.height;

    if (this.canvas.width !== width || this.canvas.height !== height) {
      this.canvas.width = width;
      this.canvas.height = height;
      gl.viewport(0, 0, width, height);
    }

    gl.useProgram(this.program);

    // Upload texture
    gl.activeTexture(gl.TEXTURE0);
    gl.bindTexture(gl.TEXTURE_2D, this.texture);
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, media);
    const uImage = gl.getUniformLocation(this.program, "u_image");
    gl.uniform1i(uImage, 0);

    // Uniforms
    gl.uniform1f(gl.getUniformLocation(this.program, "u_exposure"), grade.exposure);
    gl.uniform1f(gl.getUniformLocation(this.program, "u_contrast"), grade.contrast);
    gl.uniform1f(gl.getUniformLocation(this.program, "u_saturation"), grade.saturation);
    gl.uniform1f(gl.getUniformLocation(this.program, "u_temperature"), grade.temperature);
    gl.uniform1f(gl.getUniformLocation(this.program, "u_tint"), grade.tint);

    gl.uniform3fv(gl.getUniformLocation(this.program, "u_lift"), grade.lift);
    gl.uniform3fv(gl.getUniformLocation(this.program, "u_gamma"), grade.gamma);
    gl.uniform3fv(gl.getUniformLocation(this.program, "u_gain"), grade.gain);

    gl.uniform1f(gl.getUniformLocation(this.program, "u_vignetteAmount"), grade.vignetteAmount / 100);
    gl.uniform1f(gl.getUniformLocation(this.program, "u_vignetteMidpoint"), 1.0 - (grade.vignetteMidpoint / 100));

    // Attributes
    const aPosition = gl.getAttribLocation(this.program, "a_position");
    gl.enableVertexAttribArray(aPosition);
    gl.bindBuffer(gl.ARRAY_BUFFER, this.positionBuffer);
    gl.vertexAttribPointer(aPosition, 2, gl.FLOAT, false, 0, 0);

    const aTexCoord = gl.getAttribLocation(this.program, "a_texCoord");
    gl.enableVertexAttribArray(aTexCoord);
    gl.bindBuffer(gl.ARRAY_BUFFER, this.texCoordBuffer);
    gl.vertexAttribPointer(aTexCoord, 2, gl.FLOAT, false, 0, 0);

    gl.drawArrays(gl.TRIANGLES, 0, 6);

    return this.canvas;
  }
}

// Singleton instance
let grader: WebGLColorGrader | null = null;
export function applyColorGrade(media: HTMLVideoElement | HTMLImageElement | HTMLCanvasElement, grade: ColorGradeState) {
  if (!grader) {
    grader = new WebGLColorGrader();
  }
  return grader.process(media, grade);
}
