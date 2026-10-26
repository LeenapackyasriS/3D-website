(function () {
  'use strict';

  var TOTAL_FRAMES = 192;
  var INITIAL_FRAMES = 12;

  function $(s, r) { return (r || document).querySelector(s); }
  function $$(s, r) { return Array.prototype.slice.call((r || document).querySelectorAll(s)); }

  document.addEventListener('DOMContentLoaded', function () {
    $('#year').textContent = new Date().getFullYear();
    initNav();
    initForm();
    initHero();
  });

  /* ---------- Navigation ---------- */
  function initNav() {
    var header = $('#site-header'), toggle = $('#nav-toggle'), menu = $('#nav-menu');

    function onScroll() { header.classList.toggle('is-solid', window.scrollY > 40); }
    window.addEventListener('scroll', onScroll, { passive: true });
    onScroll();

    function setMenu(open) {
      menu.classList.toggle('is-open', open);
      toggle.setAttribute('aria-expanded', String(open));
      toggle.setAttribute('aria-label', open ? 'Close menu' : 'Open menu');
    }
    toggle.addEventListener('click', function () { setMenu(!menu.classList.contains('is-open')); });
    $$('a', menu).forEach(function (a) { a.addEventListener('click', function () { setMenu(false); }); });
    document.addEventListener('keydown', function (e) {
      if (e.key === 'Escape' && menu.classList.contains('is-open')) { setMenu(false); toggle.focus(); }
    });

    // Highlight the current section in the nav
    if ('IntersectionObserver' in window) {
      var map = {};
      $$('a[href^="#"]', menu).forEach(function (a) { map[a.getAttribute('href').slice(1)] = a; });
      var io = new IntersectionObserver(function (entries) {
        entries.forEach(function (en) {
          var id = en.target.id === 'robotics' || en.target.id === 'coding' || en.target.id === 'ai' || en.target.id === 'design' ? 'courses' : en.target.id;
          if (en.isIntersecting && map[id]) {
            Object.keys(map).forEach(function (k) { map[k].removeAttribute('aria-current'); });
            map[id].setAttribute('aria-current', 'true');
          }
        });
      }, { rootMargin: '-45% 0px -50% 0px' });
      ['explore', 'about', 'contact', 'robotics', 'coding', 'ai', 'design'].forEach(function (id) {
        var s = document.getElementById(id); if (s) io.observe(s);
      });
    }
  }

  /* ---------- Contact form (front-end only) ---------- */
  function initForm() {
    var form = $('#contact-form'), note = $('#form-note');
    form.addEventListener('submit', function (e) {
      e.preventDefault();
      var bad = false;
      ['f-name', 'f-email'].forEach(function (id) {
        var f = document.getElementById(id);
        var ok = f.value.trim() && f.checkValidity();
        f.setAttribute('aria-invalid', ok ? 'false' : 'true');
        if (!ok && !bad) { f.focus(); bad = true; }
      });
      if (bad) { note.textContent = 'Please enter your name and a valid email address.'; return; }
      note.textContent = 'Thank you! This demo form is not connected to a server yet. Connect it to your backend or form service to receive submissions.';
      form.reset();
    });
  }

  /* ---------- Hero ---------- */
  function initHero() {
    var hero = $('#home'), canvas = $('#hero-canvas');
    var mqReduce = window.matchMedia('(prefers-reduced-motion: reduce)');
    var conn = navigator.connection || {};
    var constrained = conn.saveData === true || (navigator.deviceMemory && navigator.deviceMemory <= 1);
    var isMobile = window.matchMedia('(max-width: 768px)').matches;
    var hasGsap = !!(window.gsap && window.ScrollTrigger);
    var staticMode = mqReduce.matches || constrained || !hasGsap;

    // Switching the reduced-motion preference mid-session: simplest correct behaviour is to rebuild.
    if (mqReduce.addEventListener) mqReduce.addEventListener('change', function () { location.reload(); });

    var anim = null;
    try {
      anim = new FrameAnimation({
        canvas: canvas, total: TOTAL_FRAMES, isMobile: isMobile || constrained,
        sources: FrameAnimation.buildSources(isMobile || constrained)
      });
    } catch (err) {
      console.warn('Canvas unavailable; showing text-only hero.', err);
    }

    if (!anim) { hero.classList.add('hero--static'); BeycanPreloader.hide(); wireCtas(null); return; }

    // Static hero shows the final "welcome" composition; animated hero starts on frame 1.
    var initial = staticMode ? [TOTAL_FRAMES - 1] : Array.apply(null, Array(INITIAL_FRAMES)).map(function (_, i) { return i; });

    BeycanPreloader.run(anim, initial).then(function () {
      if (staticMode) {
        hero.classList.add('hero--static');
        anim.setFrame(TOTAL_FRAMES - 1);
        wireCtas(null);
        // Static mode: keep the sequence light; only the one frame is needed.
        return;
      }
      anim.setFrame(0);
      var st = buildScroll(hero, anim);
      wireCtas(st);
      anim.startBackgroundLoad();
      if (document.fonts && document.fonts.ready) document.fonts.ready.then(function () { window.ScrollTrigger.refresh(); });
    });

    window.addEventListener('pagehide', function () { if (anim) anim.destroy(); });
  }

  function buildScroll(hero, anim) {
    var gsap = window.gsap, ScrollTrigger = window.ScrollTrigger;
    gsap.registerPlugin(ScrollTrigger);

    var proxy = { frame: 0 };
    var lastIndex = TOTAL_FRAMES - 1;

    var tl = gsap.timeline({
      defaults: { ease: 'none' },
      scrollTrigger: {
        trigger: hero,
        start: 'top top',
        end: function () { return '+=' + Math.round(window.innerHeight * (window.innerWidth <= 768 ? 1.8 : 2.8)); },
        pin: true,
        scrub: 0.6,
        anticipatePin: 1,
        invalidateOnRefresh: true
      }
    });

    // progress (0..1) -> frame (0..191)
    tl.to(proxy, {
      frame: lastIndex, duration: 1,
      onUpdate: function () {
        var idx = Math.max(0, Math.min(lastIndex, Math.round(proxy.frame)));
        anim.setFrame(idx);
      }
    }, 0);
    tl.to('#hero-progress', { scaleX: 1, duration: 1 }, 0);
    tl.to('#scroll-indicator', { autoAlpha: 0, duration: 0.05 }, 0);

    // Text phases: opacity + vertical translation, fully scrubbed (reverse naturally on scroll up).
    var D = 0.06, Y = 36;
    // Phase 1 is visible at the start and leaves first.
    tl.to('#phase-1', { autoAlpha: 0, y: -Y, duration: D, ease: 'power2.in' }, 0.14);
    [
      ['#phase-2', 0.24, 0.40],
      ['#phase-3', 0.44, 0.58],
      ['#phase-4', 0.62, 0.76]
    ].forEach(function (p) {
      tl.fromTo(p[0], { autoAlpha: 0, y: Y }, { autoAlpha: 1, y: 0, duration: D, ease: 'power2.out' }, p[1]);
      tl.to(p[0], { autoAlpha: 0, y: -Y, duration: D, ease: 'power2.in' }, p[2]);
    });
    // Phase 5 arrives with the final composition and stays.
    tl.fromTo('#phase-5', { autoAlpha: 0, y: Y }, { autoAlpha: 1, y: 0, duration: D, ease: 'power2.out' }, 0.84);

    return tl.scrollTrigger;
  }

  /* ---------- CTAs ---------- */
  function wireCtas(st) {
    var btn = $('[data-action="explore-beybot"]');
    if (!btn || !st) return; // static mode: the href (#explore) works natively
    btn.addEventListener('click', function (e) {
      e.preventDefault();
      var smooth = !window.matchMedia('(prefers-reduced-motion: reduce)').matches;
      window.scrollTo({ top: st.end - 2, behavior: smooth ? 'smooth' : 'auto' });
    });
  }
})();
