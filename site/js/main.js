/* Edmilson Veloso | Arquiteto. GSAP 3 + ScrollTrigger + Lenis, vanilla.
   Toda animacao e ligada a posicao do scroll (scrub): avanca ao descer e reverte ao subir. */
(() => {
  'use strict';
  const root = document.documentElement;
  const $ = (s, c = document) => c.querySelector(s);
  const $$ = (s, c = document) => Array.from(c.querySelectorAll(s));
  const reduce = matchMedia('(prefers-reduced-motion: reduce)').matches;
  const HDR = 64; // pilula flutuante (top 12 + 52); a capsula do sub-nav sobrepoe o conteudo e nao entra no calculo
  const hasGsap = !!(window.gsap && window.ScrollTrigger);
  if (hasGsap) {
    gsap.registerPlugin(ScrollTrigger);
    ScrollTrigger.config({ ignoreMobileResize: true });
  }

  /* ---------- Lenis (scroll suave) ---------- */
  let lenis = null;
  if (hasGsap && window.Lenis && !reduce) {
    lenis = new Lenis({ lerp: 0.09, wheelMultiplier: 0.95, smoothWheel: true });
    lenis.on('scroll', ScrollTrigger.update);
    gsap.ticker.add((t) => lenis.raf(t * 1000));
    gsap.ticker.lagSmoothing(0);
  }

  /* ---------- menu mobile e ancoras ---------- */
  const header = $('#nav');
  const toggle = $('.gnav__toggle');
  const setMenu = (open) => {
    header.classList.toggle('is-open', open);
    toggle.setAttribute('aria-expanded', String(open));
    toggle.setAttribute('aria-label', open ? 'Fechar menu' : 'Abrir menu');
    if (lenis) open ? lenis.stop() : lenis.start();
    else document.body.style.overflow = open ? 'hidden' : '';
  };
  toggle.addEventListener('click', () => setMenu(!header.classList.contains('is-open')));
  addEventListener('keydown', (e) => { if (e.key === 'Escape') setMenu(false); });
  addEventListener('resize', () => { if (innerWidth > 833) setMenu(false); });

  /* ---------- sub-nav: recolhe ao descer, volta ao subir ---------- */
  let lastY = scrollY, acc = 0, navLock = false;
  const retract = (v) => header.classList.toggle('is-retracted', v);
  const onScroll = () => {
    const y = Math.max(0, scrollY);
    const d = y - lastY;
    lastY = y;
    if (y <= 8) { acc = 0; retract(false); return; }
    if (navLock || header.classList.contains('is-open') || d === 0) return;
    if ((d > 0) !== (acc > 0)) acc = 0;
    acc += d;
    if (acc > 6) retract(true);
    else if (acc < -6) retract(false);
  };
  addEventListener('scroll', onScroll, { passive: true });
  header.addEventListener('focusin', () => retract(false));

  /* trava do sub-nav durante rolagem por ancora: liberada no onComplete, em qualquer input
     do usuario (wheel/touch/teclas) e por um timeout de seguranca, para nunca ficar presa. */
  let lockTimer = 0;
  const releaseNavLock = () => {
    clearTimeout(lockTimer);
    navLock = false;
    lastY = Math.max(0, scrollY); acc = 0;
    USER_EVENTS.forEach((ev) => removeEventListener(ev, releaseNavLock, true));
  };
  const USER_EVENTS = ['wheel', 'touchstart', 'keydown', 'pointerdown'];
  const startNavLock = (y) => {
    clearTimeout(lockTimer);
    USER_EVENTS.forEach((ev) => removeEventListener(ev, releaseNavLock, true));
    navLock = true; acc = 0;
    if (y > 8) retract(true);
    lockTimer = setTimeout(releaseNavLock, 2200);
    USER_EVENTS.forEach((ev) => addEventListener(ev, releaseNavLock, { capture: true, passive: true }));
  };

  $$('a[href^="#"]').forEach((a) => {
    a.addEventListener('click', (e) => {
      const id = a.getAttribute('href');
      if (id === '#') { e.preventDefault(); return; }
      const el = $(id);
      if (!el) return;
      e.preventDefault();
      if (header.classList.contains('is-open')) setMenu(false);
      const ref = el.parentElement && el.parentElement.classList.contains('pin-spacer') ? el.parentElement : el;
      const y = id === '#topo' ? 0 : Math.max(0, ref.getBoundingClientRect().top + scrollY - HDR);
      startNavLock(y);
      if (lenis) lenis.scrollTo(y, { duration: 1.6, easing: (t) => 1 - Math.pow(1 - t, 4), onComplete: releaseNavLock });
      else scrollTo({ top: y, behavior: 'auto' });
    });
  });

  /* ---------- hero: tour em sequencia de frames (canvas) ---------- */
  const heroEl = $('.hero');
  const canvas = $('.hero__canvas');
  const cctx = canvas.getContext('2d');
  const posterImg = $('.hero__poster img');
  const manifestP = fetch('assets/tour/manifest.json', { cache: 'no-cache' })
    .then((r) => (r.ok ? r.json() : null)).catch(() => null);
  const stores = {}; // frames ja baixados, por variante (sobrevivem a troca de breakpoint)

  const evenOrder = (n) => { // frames espacados primeiro, depois preenche
    const seen = new Uint8Array(n), out = [];
    for (let step = 16; step >= 1; step >>= 1) for (let i = 0; i < n; i += step) if (!seen[i]) { seen[i] = 1; out.push(i); }
    return out;
  };

  function startHero(variant, staticOnly) {
    let dead = false, mode = 'fallback', cfg = null, count = 0, p = 0, drawn = null, ctx = null;
    const store = stores[variant] || (stores[variant] = { frames: [] });
    const frames = store.frames;

    const cover = (img, scale) => {
      const iw = img.naturalWidth, ih = img.naturalHeight, W = canvas.width, H = canvas.height;
      if (!iw || !ih || !W || !H) return false;
      const r = Math.max(W / iw, H / ih) * (scale || 1);
      cctx.drawImage(img, (W - iw * r) / 2, (H - ih * r) / 2, iw * r, ih * r);
      return true;
    };
    const render = (force) => {
      if (dead) return;
      if (mode === 'tour') {
        const idx = Math.round(p * (count - 1));
        let j = -1;
        for (let d = 0; d < count; d++) {
          if (frames[idx - d]) { j = idx - d; break; }
          if (frames[idx + d]) { j = idx + d; break; }
        }
        if (j < 0 || (!force && j === drawn)) return;
        if (cover(frames[j])) { drawn = j; heroEl.classList.add('is-ready'); }
      } else {
        const sc = staticOnly ? 1 : Math.round((1.15 - 0.15 * p) * 1000) / 1000;
        if (!force && sc === drawn) return;
        if (posterImg && posterImg.complete && cover(posterImg, sc)) { drawn = sc; heroEl.classList.add('is-ready'); }
      }
    };
    const resize = () => {
      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      const w = canvas.clientWidth, h = canvas.clientHeight;
      if (!w || !h) return;
      const W = Math.round(w * dpr), H = Math.round(h * dpr);
      if (canvas.width !== W || canvas.height !== H) { canvas.width = W; canvas.height = H; }
      render(true);
    };
    addEventListener('resize', resize);
    if (posterImg) posterImg.addEventListener('load', () => render(true));

    const loadFrames = () => {
      const load = (i) => new Promise((res) => {
        if (frames[i]) return res();
        const im = new Image();
        im.decoding = 'async';
        im.onload = () => { frames[i] = im; render(); res(); };
        im.onerror = () => res();
        const n = String(i + 1).padStart(cfg.pad || 4, '0');
        im.src = cfg.path + n + cfg.ext;
      });
      const queue = evenOrder(count);
      queue.unshift(...queue.splice(queue.indexOf(0), 1)); // frame 1 primeiro
      let k = 0;
      const worker = async () => { while (!dead && k < queue.length) await load(queue[k++]); };
      for (let w = 0; w < 6; w++) worker();
    };

    const build = () => {
      resize();
      if (staticOnly || !hasGsap) return;
      ctx = gsap.context(() => {
        const st = { p: 0 };
        const tl = gsap.timeline({
          defaults: { ease: 'none' },
          scrollTrigger: { trigger: heroEl, start: 'top top', end: 'bottom bottom', scrub: true }
        });
        tl.to(st, { p: 1, duration: 1, onUpdate: () => { p = st.p; render(); } }, 0);
        if (mode === 'tour') {
          gsap.set('.chapter', { opacity: 0, y: 16 });
          tl.to('.hero__copy', { opacity: 0, y: -40, duration: 0.12 }, 0.04)
            .to('.hero__scrim', { opacity: 0.55, duration: 0.2 }, 0.05);
          const seg = [[0.16, 0.30], [0.32, 0.46], [0.48, 0.62], [0.64, 0.78], [0.80, 0.92]];
          $$('.chapter:not(.chapter--final)').forEach((el, i) => {
            const [a, b] = seg[i];
            tl.to(el, { opacity: 1, y: 0, duration: 0.035 }, a)
              .to(el, { opacity: 0, y: -16, duration: 0.035 }, b - 0.035);
          });
          tl.to($('.chapter--final'), { opacity: 1, y: 0, duration: 0.04 }, 0.94);
        } else {
          tl.to('.hero__copy', { opacity: 0, y: -40, duration: 0.25 }, 0.6)
            .to('.hero__scrim', { opacity: 0.55, duration: 0.3 }, 0.6);
        }
      }, heroEl);
    };

    manifestP.then((m) => {
      if (dead) return;
      const c = m && m[variant];
      if (c && c.count > 0 && !staticOnly && hasGsap) { mode = 'tour'; cfg = c; count = c.count; }
      if (!staticOnly && hasGsap) heroEl.classList.add(mode === 'tour' ? 'is-tour' : 'is-scrub');
      build();
      if (mode === 'tour') loadFrames();
      if (hasGsap) ScrollTrigger.refresh();
    });

    return () => {
      dead = true;
      removeEventListener('resize', resize);
      if (ctx) ctx.revert();
      heroEl.classList.remove('is-tour', 'is-scrub');
      gsap.set && gsap.set(['.hero__copy', '.hero__scrim', '.chapter'], { clearProps: 'all' });
    };
  }

  /* ---------- sem motion: conteudo estatico e legivel ---------- */
  if (!hasGsap || reduce) {
    startHero(innerWidth <= 833 ? 'mobile' : 'desktop', true);
    return;
  }
  root.classList.add('motion');

  // Divide texto em palavras (para o manifesto).
  const splitWords = (el) => {
    const frag = document.createDocumentFragment();
    el.textContent.trim().split(/\s+/).forEach((w, i, arr) => {
      const s = document.createElement('span'); s.className = 'w'; s.textContent = w; frag.appendChild(s);
      if (i < arr.length - 1) frag.appendChild(document.createTextNode(' '));
    });
    el.textContent = ''; el.appendChild(frag);
  };
  splitWords($('.manifesto__text'));

  // Revela por scrub: sobe e aparece ao entrar, desce e some ao voltar.
  const reveal = (scope) => {
    $$('[data-reveal]', scope).forEach((el) => {
      gsap.fromTo(el, { opacity: 0, y: 28 }, {
        opacity: 1, y: 0, ease: 'none',
        scrollTrigger: { trigger: el, start: 'top 94%', end: 'top 72%', scrub: true }
      });
    });
  };

  const mm = gsap.matchMedia();
  mm.add({ desktop: '(min-width: 834px)', mobile: '(max-width: 833px)' }, (ctx) => {
    const { desktop } = ctx.conditions;

    /* 1. HERO: tour scrub (canvas) */
    const stopHero = startHero(desktop ? 'desktop' : 'mobile', false);

    /* 2. MANIFESTO: palavras acendem com o scroll */
    gsap.to($$('.manifesto__text .w'), {
      opacity: 1, ease: 'none', stagger: 0.1, duration: 0.5,
      scrollTrigger: { trigger: '.manifesto__text', start: 'top 82%', end: 'bottom 50%', scrub: true }
    });

    /* 3. PROJETOS: scroll horizontal pinado (desktop) / carrossel nativo (mobile) */
    if (desktop) {
      const section = $('.projects'), track = $('.projects__track');
      section.classList.add('hpin');
      const dist = () => Math.max(0, track.scrollWidth - innerWidth);
      const scrollTween = gsap.to(track, {
        x: () => -dist(), ease: 'none',
        scrollTrigger: { trigger: section, start: 'top ' + HDR + 'px', end: () => '+=' + dist(), pin: true, scrub: 0.6, invalidateOnRefresh: true }
      });
      $$('.panel').forEach((panel, i) => {
        const media = $('.panel__media', panel), meta = $('.panel__meta', panel);
        // deslocamento leve do quadro inteiro (sem escala): a imagem nunca e cortada
        gsap.fromTo(media, { y: 16 }, {
          y: -16, ease: 'none',
          scrollTrigger: { trigger: panel, containerAnimation: scrollTween, start: 'left right', end: 'right left', scrub: true }
        });
        const amt = 30 * (1 + (i % 3)); // velocidades diferentes por painel
        gsap.fromTo(meta, { x: amt }, {
          x: -amt, ease: 'none',
          scrollTrigger: { trigger: panel, containerAnimation: scrollTween, start: 'left right', end: 'right left', scrub: true }
        });
      });
    }

    /* 4. CASE JK e MANIFESTO: paralaxe multi-velocidade (data-speed) */
    reveal($('.case'));
    $$('[data-speed]').forEach((el) => {
      const amt = (desktop ? 54 : 16) * parseFloat(el.dataset.speed);
      gsap.fromTo(el, { y: amt }, { y: -amt, ease: 'none', scrollTrigger: { trigger: el, start: 'top bottom', end: 'bottom top', scrub: true } });
    });

    /* 4b. CITACAO */
    reveal($('.quote'));

    /* 5. SOBRE: retrato assenta e texto entra; numeros contam com o scroll */
    const frame = $('.about__frame');
    gsap.fromTo(frame, { opacity: 0.4, y: 40 }, { opacity: 1, y: 0, ease: 'none', scrollTrigger: { trigger: frame, start: 'top 95%', end: 'top 60%', scrub: true } });
    gsap.fromTo($('img', frame), { scale: 1.15 }, { scale: 1, ease: 'none', scrollTrigger: { trigger: frame, start: 'top bottom', end: 'bottom 40%', scrub: true } });
    reveal($('.about'));
    $$('[data-count]').forEach((el) => {
      const n = parseInt(el.dataset.count, 10), o = { v: 0 };
      el.textContent = '0';
      gsap.to(o, { v: n, ease: 'none', onUpdate: () => { el.textContent = Math.round(o.v); },
        scrollTrigger: { trigger: el, start: 'top 95%', end: 'top 65%', scrub: true } });
    });

    /* 6. SERVICOS */
    reveal($('.services'));

    /* 7. PROCESSO: etapas trocadas por scrub, pinado no desktop */
    if (desktop) {
      const section = $('.process');
      section.classList.add('ppin');
      const steps = $$('.step'), idx = $$('.process__index li'), bodies = $$('.step__body');
      gsap.set(steps.slice(1), { opacity: 0, y: 32 });
      gsap.set(bodies.slice(1), { y: 56 });
      const tl = gsap.timeline({
        defaults: { ease: 'none' },
        scrollTrigger: {
          trigger: section, start: 'top ' + HDR + 'px', end: '+=300%', pin: true, scrub: 0.5,
          onUpdate: (self) => {
            const i = Math.min(steps.length - 1, Math.floor(self.progress * steps.length));
            idx.forEach((li, j) => li.classList.toggle('is-active', j === i));
            steps.forEach((s, j) => s.classList.toggle('is-active', j === i));
          }
        }
      });
      for (let i = 1; i < steps.length; i++) {
        tl.to(steps[i - 1], { opacity: 0, y: -32, duration: 0.25 }, i - 0.25)
          .to(bodies[i - 1], { y: -56, duration: 0.25 }, i - 0.25)
          .to(steps[i], { opacity: 1, y: 0, duration: 0.3 }, i - 0.02)
          .to(bodies[i], { y: 0, duration: 0.3 }, i - 0.02);
      }
      tl.to({}, { duration: 0.5 }, steps.length - 0.5);
    } else {
      $$('.step').forEach((el) => {
        gsap.fromTo(el, { opacity: 0, y: 28 }, { opacity: 1, y: 0, ease: 'none', scrollTrigger: { trigger: el, start: 'top 94%', end: 'top 68%', scrub: true } });
      });
    }

    /* 8. GALERIA: duas faixas em sentidos opostos, presas ao scroll */
    reveal($('.gallery'));
    $$('.marquee').forEach((row) => {
      const track = $('.marquee__track', row), dir = parseFloat(row.dataset.dir) || -1;
      const max = () => Math.max(0, track.scrollWidth - row.clientWidth);
      gsap.fromTo(track, { x: () => (dir < 0 ? 0 : -max()) }, {
        x: () => (dir < 0 ? -max() : 0), ease: 'none', immediateRender: true,
        scrollTrigger: { trigger: row, start: 'top bottom', end: 'bottom top', scrub: true, invalidateOnRefresh: true }
      });
    });

    /* 9. DEPOIMENTOS e 10. CTA */
    reveal($('.quotes'));
    reveal($('.cta'));

    return () => { // limpeza quando o breakpoint muda
      stopHero();
      $('.projects').classList.remove('hpin');
      $('.process').classList.remove('ppin');
    };
  });

  addEventListener('load', () => ScrollTrigger.refresh());
  if (document.fonts && document.fonts.ready) document.fonts.ready.then(() => ScrollTrigger.refresh());
})();
