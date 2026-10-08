/**
 * <water-ripple> -- wraps a real <img> and turns it into an interactive
 * water surface: moving the pointer or clicking sends out real ripples
 * that visibly refract the underlying photo, like a drop hitting a
 * pond. Pure WebGL, no dependencies. Degrades to the plain <img> if
 * WebGL isn't available or the user prefers reduced motion.
 *
 * Technique: a height-field simulated on the GPU via a ping-pong pair
 * of framebuffers (classic wave-equation relaxation: each texel's new
 * height is derived from its neighbors' previous heights, minus its
 * own height two frames ago, times a damping factor). Pointer input
 * stamps a radial depression into the height field. The final render
 * pass perturbs the image's texture coordinates by the height field's
 * spatial gradient, producing the refraction look.
 */
class WaterRipple extends HTMLElement {
  connectedCallback() {
    this.img = this.querySelector('img');
    if (!this.img) return;

    const prefersReducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    if (prefersReducedMotion) return;

    this.canvas = document.createElement('canvas');
    this.canvas.className = 'water-ripple__canvas';
    this.canvas.setAttribute('aria-hidden', 'true');

    const gl = this.canvas.getContext('webgl', { alpha: false, antialias: false, preserveDrawingBuffer: false })
      || this.canvas.getContext('experimental-webgl');
    if (!gl) return;
    this.gl = gl;

    this.ready = false;
    this.lastPointer = null;
    this.resizeObserver = new ResizeObserver(() => this.resize());

    const start = () => {
      this.appendChild(this.canvas);
      this.img.style.visibility = 'hidden';
      this.setup();
      this.resizeObserver.observe(this);
      this.bindPointerEvents();
      this.loop();
    };

    if (this.img.complete && this.img.naturalWidth > 0) {
      start();
    } else {
      this.img.addEventListener('load', start, { once: true });
    }
  }

  disconnectedCallback() {
    if (this.rafId) cancelAnimationFrame(this.rafId);
    if (this.resizeObserver) this.resizeObserver.disconnect();
  }

  // --- WebGL setup -----------------------------------------------------

  compileShader(type, source) {
    const gl = this.gl;
    const shader = gl.createShader(type);
    gl.shaderSource(shader, source);
    gl.compileShader(shader);
    if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
      gl.deleteShader(shader);
      return null;
    }
    return shader;
  }

  linkProgram(vertexSource, fragmentSource) {
    const gl = this.gl;
    const vertexShader = this.compileShader(gl.VERTEX_SHADER, vertexSource);
    const fragmentShader = this.compileShader(gl.FRAGMENT_SHADER, fragmentSource);
    if (!vertexShader || !fragmentShader) return null;

    const program = gl.createProgram();
    gl.attachShader(program, vertexShader);
    gl.attachShader(program, fragmentShader);
    gl.linkProgram(program);
    if (!gl.getProgramParameter(program, gl.LINK_STATUS)) return null;
    return program;
  }

  setup() {
    const gl = this.gl;

    const quadVerts = new Float32Array([-1, -1, 1, -1, -1, 1, 1, 1]);
    this.quadBuffer = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, this.quadBuffer);
    gl.bufferData(gl.ARRAY_BUFFER, quadVerts, gl.STATIC_DRAW);

    const vertexSource = `
      attribute vec2 aPosition;
      varying vec2 vUv;
      void main() {
        vUv = aPosition * 0.5 + 0.5;
        gl_Position = vec4(aPosition, 0.0, 1.0);
      }
    `;

    // Propagates the height field one simulation step. Height is
    // stored in the red channel, the previous frame's height in the
    // green channel -- avoids needing a third buffer. Heights are
    // bias-encoded (+0.5) since a standard 8-bit texture can only
    // hold [0,1] and a wave's height genuinely needs to go negative;
    // storing it raw would silently clamp every trough to zero and
    // the "ripple" would never actually oscillate.
    const updateSource = `
      precision highp float;
      varying vec2 vUv;
      uniform sampler2D uHeightField;
      uniform vec2 uTexel;
      void main() {
        vec2 state = texture2D(uHeightField, vUv).rg;
        float heightNow = state.r - 0.5;
        float heightBefore = state.g - 0.5;

        float left = texture2D(uHeightField, vUv - vec2(uTexel.x, 0.0)).r - 0.5;
        float right = texture2D(uHeightField, vUv + vec2(uTexel.x, 0.0)).r - 0.5;
        float up = texture2D(uHeightField, vUv + vec2(0.0, uTexel.y)).r - 0.5;
        float down = texture2D(uHeightField, vUv - vec2(0.0, uTexel.y)).r - 0.5;

        float newHeight = (left + right + up + down) * 0.5 - heightBefore;
        newHeight *= 0.99;

        gl_FragColor = vec4(newHeight + 0.5, heightNow + 0.5, 0.0, 1.0);
      }
    `;

    // Stamps a soft radial depression into the height field at the
    // pointer position -- the "drop" hitting the water.
    const dropSource = `
      precision highp float;
      varying vec2 vUv;
      uniform sampler2D uHeightField;
      uniform vec2 uCenter;
      uniform float uRadius;
      uniform float uStrength;
      uniform float uAspect;
      void main() {
        vec2 state = texture2D(uHeightField, vUv).rg;
        float heightNow = state.r - 0.5;
        float heightBefore = state.g - 0.5;

        vec2 delta = vUv - uCenter;
        delta.x *= uAspect;
        float dist = length(delta);
        float drop = 1.0 - smoothstep(0.0, uRadius, dist);
        drop = drop * drop * uStrength;

        gl_FragColor = vec4((heightNow - drop) + 0.5, heightBefore + 0.5, 0.0, 1.0);
      }
    `;

    // Final pass: samples the real photo, offsetting UVs by the
    // height field's gradient to create the refraction distortion.
    const renderSource = `
      precision highp float;
      varying vec2 vUv;
      uniform sampler2D uHeightField;
      uniform sampler2D uImage;
      uniform vec2 uTexel;
      void main() {
        float heightRight = texture2D(uHeightField, vUv + vec2(uTexel.x, 0.0)).r;
        float heightLeft = texture2D(uHeightField, vUv - vec2(uTexel.x, 0.0)).r;
        float heightUp = texture2D(uHeightField, vUv + vec2(0.0, uTexel.y)).r;
        float heightDown = texture2D(uHeightField, vUv - vec2(0.0, uTexel.y)).r;
        vec2 gradient = vec2(heightRight - heightLeft, heightUp - heightDown);
        vec2 distortedUv = vUv + gradient * 3.5;
        vec4 color = texture2D(uImage, clamp(distortedUv, 0.0, 1.0));
        float shade = 1.0 + gradient.x * 8.0 - gradient.y * 8.0;
        gl_FragColor = vec4(color.rgb * shade, 1.0);
      }
    `;

    this.updateProgram = this.linkProgram(vertexSource, updateSource);
    this.dropProgram = this.linkProgram(vertexSource, dropSource);
    this.renderProgram = this.linkProgram(vertexSource, renderSource);

    this.imageTexture = this.createImageTexture();
    this.resize();
  }

  createFramebufferTexture(width, height) {
    const gl = this.gl;
    const texture = gl.createTexture();
    gl.bindTexture(gl.TEXTURE_2D, texture);
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, width, height, 0, gl.RGBA, gl.UNSIGNED_BYTE, null);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);

    const framebuffer = gl.createFramebuffer();
    gl.bindFramebuffer(gl.FRAMEBUFFER, framebuffer);
    gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_2D, texture, 0);
    gl.bindFramebuffer(gl.FRAMEBUFFER, null);

    return { texture, framebuffer };
  }

  createImageTexture() {
    const gl = this.gl;
    const texture = gl.createTexture();
    gl.bindTexture(gl.TEXTURE_2D, texture);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, this.img);
    return texture;
  }

  resize() {
    const gl = this.gl;
    const rect = this.getBoundingClientRect();
    const width = Math.max(1, Math.round(rect.width));
    const height = Math.max(1, Math.round(rect.height));
    if (this.canvas.width === width && this.canvas.height === height) return;

    this.canvas.width = width;
    this.canvas.height = height;
    this.simWidth = width;
    this.simHeight = height;
    this.texel = [1 / width, 1 / height];

    this.bufferA = this.createFramebufferTexture(width, height);
    this.bufferB = this.createFramebufferTexture(width, height);
    this.current = this.bufferA;
    this.previous = this.bufferB;

    // A freshly allocated texture defaults to all-zero, which would
    // decode as height -0.5 everywhere (a bogus instant "wave") under
    // the bias-encoding scheme above -- clear both buffers to encoded
    // zero (0.5) so the surface actually starts flat.
    gl.clearColor(0.5, 0.5, 0, 1);
    gl.bindFramebuffer(gl.FRAMEBUFFER, this.bufferA.framebuffer);
    gl.clear(gl.COLOR_BUFFER_BIT);
    gl.bindFramebuffer(gl.FRAMEBUFFER, this.bufferB.framebuffer);
    gl.clear(gl.COLOR_BUFFER_BIT);
    gl.bindFramebuffer(gl.FRAMEBUFFER, null);
  }

  bindPointerEvents() {
    const stamp = (clientX, clientY, strength) => {
      const rect = this.getBoundingClientRect();
      const x = (clientX - rect.left) / rect.width;
      const y = 1 - (clientY - rect.top) / rect.height;
      if (x < 0 || x > 1 || y < 0 || y > 1) return;
      this.pendingDrop = { x, y, strength };
    };

    this.addEventListener('pointermove', (event) => {
      if (!this.lastPointer) {
        this.lastPointer = { x: event.clientX, y: event.clientY };
        return;
      }
      const dx = event.clientX - this.lastPointer.x;
      const dy = event.clientY - this.lastPointer.y;
      const speed = Math.sqrt(dx * dx + dy * dy);
      this.lastPointer = { x: event.clientX, y: event.clientY };
      if (speed > 2) stamp(event.clientX, event.clientY, Math.min(speed * 0.004, 0.09));
    });

    this.addEventListener('pointerdown', (event) => {
      stamp(event.clientX, event.clientY, 0.22);
    });

    this.addEventListener('pointerleave', () => {
      this.lastPointer = null;
    });
  }

  drawQuad(program) {
    const gl = this.gl;
    gl.useProgram(program);
    const positionLoc = gl.getAttribLocation(program, 'aPosition');
    gl.bindBuffer(gl.ARRAY_BUFFER, this.quadBuffer);
    gl.enableVertexAttribArray(positionLoc);
    gl.vertexAttribPointer(positionLoc, 2, gl.FLOAT, false, 0, 0);
    gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);
  }

  swapBuffers() {
    const temp = this.current;
    this.current = this.previous;
    this.previous = temp;
  }

  step() {
    const gl = this.gl;
    gl.viewport(0, 0, this.simWidth, this.simHeight);

    if (this.pendingDrop) {
      gl.bindFramebuffer(gl.FRAMEBUFFER, this.current.framebuffer);
      gl.activeTexture(gl.TEXTURE0);
      gl.bindTexture(gl.TEXTURE_2D, this.previous.texture);
      gl.useProgram(this.dropProgram);
      gl.uniform1i(gl.getUniformLocation(this.dropProgram, 'uHeightField'), 0);
      gl.uniform2f(gl.getUniformLocation(this.dropProgram, 'uCenter'), this.pendingDrop.x, this.pendingDrop.y);
      gl.uniform1f(gl.getUniformLocation(this.dropProgram, 'uRadius'), 0.05);
      gl.uniform1f(gl.getUniformLocation(this.dropProgram, 'uStrength'), this.pendingDrop.strength);
      gl.uniform1f(gl.getUniformLocation(this.dropProgram, 'uAspect'), this.simWidth / this.simHeight);
      this.drawQuad(this.dropProgram);
      this.pendingDrop = null;
      this.swapBuffers();
    }

    gl.bindFramebuffer(gl.FRAMEBUFFER, this.current.framebuffer);
    gl.activeTexture(gl.TEXTURE0);
    gl.bindTexture(gl.TEXTURE_2D, this.previous.texture);
    gl.useProgram(this.updateProgram);
    gl.uniform1i(gl.getUniformLocation(this.updateProgram, 'uHeightField'), 0);
    gl.uniform2fv(gl.getUniformLocation(this.updateProgram, 'uTexel'), this.texel);
    this.drawQuad(this.updateProgram);
    this.swapBuffers();

    gl.bindFramebuffer(gl.FRAMEBUFFER, null);
    gl.viewport(0, 0, this.canvas.width, this.canvas.height);
    gl.activeTexture(gl.TEXTURE0);
    gl.bindTexture(gl.TEXTURE_2D, this.previous.texture);
    gl.activeTexture(gl.TEXTURE1);
    gl.bindTexture(gl.TEXTURE_2D, this.imageTexture);
    gl.useProgram(this.renderProgram);
    gl.uniform1i(gl.getUniformLocation(this.renderProgram, 'uHeightField'), 0);
    gl.uniform1i(gl.getUniformLocation(this.renderProgram, 'uImage'), 1);
    gl.uniform2fv(gl.getUniformLocation(this.renderProgram, 'uTexel'), this.texel);
    this.drawQuad(this.renderProgram);
  }

  loop() {
    this.step();
    this.rafId = requestAnimationFrame(() => this.loop());
  }
}

if (!customElements.get('water-ripple')) {
  customElements.define('water-ripple', WaterRipple);
}
