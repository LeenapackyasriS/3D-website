/**
 * FrameAnimation: draws a scroll-driven image sequence on a canvas.
 *  - de-duplicated, progressive loading (every frame is requested at most once per source)
 *  - never shows a blank frame: falls back to the nearest loaded frame
 *  - redraws only when the displayed frame or canvas size changes
 *  - aspect ratio preserved ("cover" on wide screens, "contain" on narrow ones)
 */
(function (global) {
  'use strict';

  var STATUS = { IDLE: 0, LOADING: 1, READY: 2, FAILED: 3 };
  var BG = '#030a1f';

  function pad(n) { return String(n).padStart(4, '0'); }

  function supportsWebP() {
    try {
      var c = document.createElement('canvas');
      c.width = c.height = 1;
      return c.toDataURL('image/webp').indexOf('data:image/webp') === 0;
    } catch (e) { return false; }
  }

  /** Ordered list of sources to try for each frame. JPEG originals are always the last fallback. */
  function buildSources(isMobile) {
    var list = [];
    if (supportsWebP()) {
      list.push({ dir: isMobile ? 'assets/frames-mobile/' : 'assets/frames-webp/', ext: 'webp' });
    }
    list.push({ dir: 'assets/frames/', ext: 'jpg' });
    return list;
  }

  function FrameAnimation(opts) {
    this.canvas = opts.canvas;
    this.ctx = this.canvas.getContext('2d', { alpha: false });
    this.total = opts.total || 192;
    this.sources = opts.sources || buildSources(false);
    this.isMobile = !!opts.isMobile;
    this.concurrency = opts.concurrency || (this.isMobile ? 3 : 4);

    this.images = new Array(this.total).fill(null);
    this.status = new Uint8Array(this.total);
    this.promises = new Array(this.total);

    this.target = 0;
    this.drawnIndex = -1;
    this.dirty = true;
    this.raf = 0;
    this.destroyed = false;
    this.cssW = 0; this.cssH = 0;
    this._queue = [];
    this._active = 0;
    this._bgStarted = false;

    var self = this;
    this._onFrame = function () { self.raf = 0; self._draw(); };
    this._resize = function () { self.resize(); };
    if ('ResizeObserver' in global) {
      this._ro = new ResizeObserver(this._resize);
      this._ro.observe(this.canvas);
    } else {
      global.addEventListener('resize', this._resize);
    }
    this.resize();
  }

  FrameAnimation.prototype.framePath = function (i, src) {
    return src.dir + 'frame-' + pad(i + 1) + '.' + src.ext;
  };

  /** Load one frame (deduplicated). Resolves with the Image, or null on failure. */
  FrameAnimation.prototype.load = function (i) {
    if (i < 0 || i >= this.total) return Promise.resolve(null);
    if (this.promises[i]) return this.promises[i];
    var self = this;
    this.status[i] = STATUS.LOADING;
    this.promises[i] = this._tryFetch(i, 0).then(function (img) {
      if (self.destroyed) return null;
      if (img) {
        self.images[i] = img; self.status[i] = STATUS.READY;
        if (i === self._shownTarget()) { self.dirty = true; self._schedule(); }
      } else {
        self.status[i] = STATUS.FAILED;
      }
      return img;
    });
    return this.promises[i];
  };

  FrameAnimation.prototype._shownTarget = function () { return this.target; };

  FrameAnimation.prototype._tryFetch = function (i, s) {
    var self = this;
    if (s >= this.sources.length) return Promise.resolve(null);
    return new Promise(function (resolve) {
      var img = new Image();
      img.decoding = 'async';
      img.onload = function () {
        img.onload = img.onerror = null;
        var done = function () { resolve(img); };
        if (img.decode) img.decode().then(done, done); else done();
      };
      img.onerror = function () {
        img.onload = img.onerror = null;
        resolve(self._tryFetch(i, s + 1)); // fall back to next source (e.g. JPEG)
      };
      img.src = self.framePath(i, self.sources[s]);
    });
  };

  /** Load a set of frame indices; calls onProgress(0..1). Never rejects. */
  FrameAnimation.prototype.preload = function (indices, onProgress) {
    var done = 0, n = indices.length, self = this;
    if (!n) { if (onProgress) onProgress(1); return Promise.resolve(); }
    return Promise.all(indices.map(function (i) {
      return self.load(i).then(function () { done++; if (onProgress) onProgress(done / n); });
    }));
  };

  /** Progressively load every remaining frame: a coarse stride pass first (so fast scrolling always has
   *  a nearby frame), then fill in the gaps. Limited concurrency keeps the main thread responsive. */
  FrameAnimation.prototype.startBackgroundLoad = function () {
    if (this._bgStarted || this.destroyed) return;
    this._bgStarted = true;
    var seen = new Uint8Array(this.total), q = [], i, stride;
    [16, 8, 4, 2, 1].forEach(function (st) {
      for (i = 0; i < this.total; i += st) if (!seen[i]) { seen[i] = 1; q.push(i); }
    }, this);
    if (!seen[this.total - 1]) q.push(this.total - 1);
    this._queue = q;
    this._pump();
  };

  FrameAnimation.prototype._pump = function () {
    var self = this;
    while (!this.destroyed && this._active < this.concurrency && this._queue.length) {
      var i = this._queue.shift();
      if (this.status[i] !== STATUS.IDLE) continue; // already loaded / loading
      this._active++;
      this.load(i).then(function () {
        self._active--;
        // yield between loads so scrolling & painting stay smooth
        (global.requestIdleCallback || function (cb) { return setTimeout(cb, 16); })(function () { self._pump(); });
      });
    }
  };

  FrameAnimation.prototype.loadedCount = function () {
    var c = 0; for (var i = 0; i < this.total; i++) if (this.status[i] === STATUS.READY) c++;
    return c;
  };

  /** Request a frame (clamped integer). Cheap to call from scroll handlers. */
  FrameAnimation.prototype.setFrame = function (index) {
    var i = Math.max(0, Math.min(this.total - 1, Math.round(index)));
    if (i === this.target && !this.dirty) return;
    this.target = i;
    if (this.status[i] === STATUS.IDLE) this.load(i); // bump priority of a frame the user is waiting for
    this._schedule();
  };

  FrameAnimation.prototype._schedule = function () {
    if (!this.raf && !this.destroyed) this.raf = global.requestAnimationFrame(this._onFrame);
  };

  FrameAnimation.prototype.resize = function () {
    if (this.destroyed) return;
    var w = this.canvas.clientWidth, h = this.canvas.clientHeight;
    if (!w || !h) return;
    var cap = this.isMobile ? 1.5 : 2;
    var dpr = Math.min(global.devicePixelRatio || 1, cap);
    if (w * dpr > 2560) dpr = 2560 / w; // bound memory on very large screens
    var pw = Math.round(w * dpr), ph = Math.round(h * dpr);
    if (this.canvas.width !== pw || this.canvas.height !== ph) {
      this.canvas.width = pw; this.canvas.height = ph;
    }
    this.cssW = w; this.cssH = h; this.dpr = dpr;
    this.dirty = true;
    this._schedule();
  };

  /** Nearest ready frame to the requested one, so the canvas is never blank. */
  FrameAnimation.prototype._bestIndex = function () {
    var t = this.target, d, a, b;
    if (this.status[t] === STATUS.READY) return t;
    for (d = 1; d < this.total; d++) {
      a = t - d; b = t + d;
      if (a >= 0 && this.status[a] === STATUS.READY) return a;
      if (b < this.total && this.status[b] === STATUS.READY) return b;
    }
    return -1;
  };

  FrameAnimation.prototype._draw = function () {
    if (this.destroyed) return;
    var idx = this._bestIndex();
    if (idx < 0) return; // nothing loaded yet: keep whatever is on screen
    if (idx === this.drawnIndex && !this.dirty) return;
    var img = this.images[idx], ctx = this.ctx;
    var cw = this.canvas.width, ch = this.canvas.height;
    var iw = img.naturalWidth || 1280, ih = img.naturalHeight || 720;
    var viewAspect = cw / ch, imgAspect = iw / ih;
    var dw, dh, dx, dy, s;

    if (viewAspect >= 1.45) {
      // Wide screens: cover, biased to the right where Beybot stands. Only the (empty) left/top may crop.
      s = Math.max(cw / iw, ch / ih);
      dw = iw * s; dh = ih * s;
      dx = -(dw - cw) * 0.72; dy = -(dh - ch) * 0.5;
    } else {
      // Narrow screens: contain (fit width) so Beybot is never cropped; sit in the upper area.
      s = Math.min(cw / iw, ch / ih);
      dw = iw * s; dh = ih * s;
      dx = (cw - dw) / 2;
      dy = Math.max(72 * this.dpr, (ch - dh) * 0.3);
    }
    ctx.fillStyle = BG;
    ctx.fillRect(0, 0, cw, ch);
    ctx.imageSmoothingQuality = 'high';
    ctx.drawImage(img, dx, dy, dw, dh);
    if (viewAspect < 1.45) {
      // Feather the top/bottom edges of the letterboxed frame into the page background
      var f = Math.round(dh * 0.18), g;
      g = ctx.createLinearGradient(0, dy, 0, dy + f);
      g.addColorStop(0, BG); g.addColorStop(1, 'rgba(3,10,31,0)');
      ctx.fillStyle = g; ctx.fillRect(0, dy, cw, f);
      g = ctx.createLinearGradient(0, dy + dh, 0, dy + dh - f);
      g.addColorStop(0, BG); g.addColorStop(1, 'rgba(3,10,31,0)');
      ctx.fillStyle = g; ctx.fillRect(0, dy + dh - f, cw, f);
    }
    this.drawnIndex = idx;
    this.dirty = false;
  };

  FrameAnimation.prototype.destroy = function () {
    this.destroyed = true;
    if (this.raf) global.cancelAnimationFrame(this.raf);
    this.raf = 0;
    if (this._ro) this._ro.disconnect(); else global.removeEventListener('resize', this._resize);
    this._queue = [];
    this.images = [];
  };

  FrameAnimation.buildSources = buildSources;
  global.FrameAnimation = FrameAnimation;
})(window);
