/**
 * Preloader: shows progress while a small initial batch of frames loads, then reveals the page.
 * The remaining frames continue loading in the background (see FrameAnimation.startBackgroundLoad).
 */
(function (global) {
  'use strict';

  var el, fill, pct;

  function ui(ratio) {
    var p = Math.round(Math.max(0, Math.min(1, ratio)) * 100);
    if (fill) fill.style.transform = 'scaleX(' + (p / 100) + ')';
    if (pct) pct.textContent = p;
  }

  function hide() {
    ui(1);
    document.body.classList.remove('is-loading');
    if (el) {
      el.classList.add('is-done');
      setTimeout(function () { if (el && el.parentNode) el.parentNode.removeChild(el); }, 900);
    }
  }

  /**
   * @param {FrameAnimation} anim
   * @param {number[]} indices  initial frames that must be ready
   * @param {number} [timeoutMs] safety net so a slow/failed network can never trap the visitor
   */
  function run(anim, indices, timeoutMs) {
    el = document.getElementById('preloader');
    fill = document.getElementById('preloader-fill');
    pct = document.getElementById('preloader-pct');
    ui(0);
    var timeout = new Promise(function (res) { setTimeout(res, timeoutMs || 10000); });
    return Promise.race([anim.preload(indices, ui), timeout]).then(hide, hide);
  }

  global.BeycanPreloader = { run: run, hide: hide };
})(window);
