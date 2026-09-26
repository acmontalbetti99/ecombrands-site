/* ==========================================================================
   ECOM BRANDS LLC — interaction layer
   No dependencies. Everything degrades to a readable static page.
   ========================================================================== */
(function () {
  'use strict';

  var RM = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  var $  = function (s, c) { return (c || document).querySelector(s); };
  var $$ = function (s, c) { return Array.prototype.slice.call((c || document).querySelectorAll(s)); };

  /* ---- 1. header: stuck state + scroll progress ------------------------ */
  var hdr = $('.hdr');
  function onScroll() {
    var y = window.scrollY || window.pageYOffset;
    if (hdr) {
      hdr.classList.toggle('is-stuck', y > 24);
      var h = document.documentElement.scrollHeight - window.innerHeight;
      hdr.style.setProperty('--sp', (h > 0 ? (y / h) * 100 : 0).toFixed(2) + '%');
    }
  }
  window.addEventListener('scroll', onScroll, { passive: true });
  onScroll();

  /* ---- 2. mobile sheet -------------------------------------------------- */
  var burger = $('.burger'), sheet = $('.sheet');
  if (burger && sheet) {
    burger.addEventListener('click', function () {
      var open = sheet.classList.toggle('is-open');
      burger.textContent = open ? 'Close' : 'Menu';
      document.body.style.overflow = open ? 'hidden' : '';
    });
    $$('a', sheet).forEach(function (a) {
      a.addEventListener('click', function () {
        sheet.classList.remove('is-open');
        burger.textContent = 'Menu';
        document.body.style.overflow = '';
      });
    });
  }

  /* ---- 3. reveal on enter ---------------------------------------------- */
  var io = ('IntersectionObserver' in window)
    ? new IntersectionObserver(function (entries) {
        entries.forEach(function (e) {
          if (e.isIntersecting) { e.target.classList.add('in'); io.unobserve(e.target); }
        });
      }, { threshold: 0.12, rootMargin: '0px 0px -8% 0px' })
    : null;

  if (io) { $$('.up, .wipe, .flow > div, .utc').forEach(function (n) { io.observe(n); }); }
  else { $$('.up, .wipe, .flow > div, .utc').forEach(function (n) { n.classList.add('in'); }); }

  /* hero lights up immediately */
  var hero = $('[data-lit]');
  if (hero) { requestAnimationFrame(function () { setTimeout(function () { hero.classList.add('is-lit'); }, 120); }); }

  /* ---- 4. hero dot field ------------------------------------------------
     A lattice of cells with a signal pulse travelling through it.
     Reads as distribution across a network — not decoration.          */
  var cv = document.getElementById('dots');
  if (cv && !RM) {
    var ctx = cv.getContext('2d'), dpr = Math.min(window.devicePixelRatio || 1, 2);
    var cols, rows, gap = 34, pts = [], W = 0, H = 0, t = 0, raf;

    function build() {
      var r = cv.getBoundingClientRect();
      W = r.width; H = r.height;
      cv.width = W * dpr; cv.height = H * dpr;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      gap = W < 640 ? 26 : 34;
      cols = Math.ceil(W / gap) + 1;
      rows = Math.ceil(H / gap) + 1;
      pts = [];
      for (var y = 0; y < rows; y++) {
        for (var x = 0; x < cols; x++) {
          pts.push({ x: x * gap, y: y * gap, s: Math.random() });
        }
      }
    }

    function draw() {
      t += 0.0052;
      ctx.clearRect(0, 0, W, H);
      // sweeping wavefront position, normalised across the diagonal
      var fx = (t % 1.6) / 1.6;
      var front = fx * (W + H * 0.6) - H * 0.3;
      for (var i = 0; i < pts.length; i++) {
        var p = pts[i];
        var d = Math.abs((p.x + p.y * 0.6) - front);
        var lit = Math.max(0, 1 - d / 120);
        var base = 0.05 + p.s * 0.035;
        var a = base + lit * 0.5;
        if (lit > 0.55) {
          ctx.fillStyle = 'rgba(255,61,0,' + ((lit - 0.55) * 1.4).toFixed(3) + ')';
          ctx.fillRect(p.x - 1.2, p.y - 1.2, 2.4, 2.4);
        }
        ctx.fillStyle = 'rgba(242,241,237,' + a.toFixed(3) + ')';
        ctx.fillRect(p.x - 0.75, p.y - 0.75, 1.5, 1.5);
      }
      raf = requestAnimationFrame(draw);
    }

    build(); draw();
    var rt;
    window.addEventListener('resize', function () { clearTimeout(rt); rt = setTimeout(build, 180); });
    document.addEventListener('visibilitychange', function () {
      if (document.hidden) { cancelAnimationFrame(raf); } else { raf = requestAnimationFrame(draw); }
    });
  }

  /* ---- 5. module rack ----------------------------------------------------
     No auto-advance. It cycled every 3.4s, which is faster than anyone can
     read a bay, so the thing read as a slideshow you were losing a race to.
     The rack opens on hover, on tap and on keyboard focus, then stays put. */
  var bays = $$('.bay');
  if (bays.length) {
    var canHover = window.matchMedia('(hover: hover)').matches;
    function setBay(i) {
      bays.forEach(function (b, n) {
        b.classList.toggle('is-on', n === i);
        b.setAttribute('aria-expanded', n === i ? 'true' : 'false');
      });
    }
    bays.forEach(function (b, i) {
      b.addEventListener('mouseenter', function () {
        if (canHover && window.innerWidth > 900) setBay(i);
      });
      b.addEventListener('click', function () { setBay(i); });
      b.addEventListener('focus', function () { setBay(i); });
    });
    setBay(0);
  }

  /* ---- 6. the two models -------------------------------------------------
     A  STORE -> SHELF -> PRODUCT -> CONSUMER
        One rail, four stations, in order. You had to be in the building.
     B  CONTENT -> DISCOVERY -> CURIOSITY -> SEARCH -> PURCHASE
        A broadcast that narrows: everything goes out, most of it dies, one
        thread survives all the way to a sale.
     The same stations travel between the two layouts against scroll progress,
     so the diagram IS the argument rather than an illustration beside it.  */
  var stage = $('.morph-stage');
  if (stage) {
    var scene = $('.morph-scene');
    var svg   = $('.chain', stage);
    var linkG = $('.ch-links', svg);
    var nodes = $$('.ch-node', svg);
    var lblA  = $('[data-lbl="shelf"]'), lblB = $('[data-lbl="feed"]');
    var clamp01 = function (v) { return v < 0 ? 0 : v > 1 ? 1 : v; };
    var p = 0, target = 0;

    var A_LABEL = ['',            'Store',         'Shelf',         'Product',    'Consumer'];
    var B_LABEL = ['Content',     'Discovery',     'Curiosity',     'Search',     'Purchase'];
    var A_GLYPH = ['#gx-content', '#dg-store',     '#dg-shelf',     '#dg-product','#dg-consumer'];
    var B_GLYPH = ['#gx-content', '#gx-discovery', '#gx-curiosity', '#gx-search', '#gx-purchase'];

    var SVGNS = 'http://www.w3.org/2000/svg';
    function mk(tag, cls) {
      var e = document.createElementNS(SVGNS, tag);
      if (cls) e.setAttribute('class', cls);
      linkG.appendChild(e);
      return e;
    }

    /* link layer, built once and then only re-positioned */
    var rail = mk('path', 'rail');
    var chev = [mk('path', 'chev'), mk('path', 'chev'), mk('path', 'chev')];

    var RAYS = 23, SIG = 11, LIVE = [7, 11, 15];
    var rays = [], dots = [];
    for (var r = 0; r < RAYS; r++) {
      var isLive = LIVE.indexOf(r) !== -1;
      rays.push(mk('path', 'ray' + (isLive ? (r === SIG ? ' live sig' : ' live') : '')));
      dots.push(mk('circle', 'rdot'));
    }
    var SEGS = [3, 2, 1], thr = [];
    for (var sgi = 0; sgi < SEGS.length; sgi++) {
      for (var k = 0; k < SEGS[sgi]; k++) {
        thr.push({ el: mk('path', 'thr' + (k === 0 ? ' sig' : '')), seg: sgi, k: k, n: SEGS[sgi] });
      }
    }

    nodes.forEach(function (g, i) {
      $('.ga', g).setAttribute('href', A_GLYPH[i]);
      $('.gb', g).setAttribute('href', B_GLYPH[i]);
      $('.la', g).textContent = A_LABEL[i];
      $('.lb', g).textContent = B_LABEL[i];
    });

    var at = [0, 0, 0, 0, 0];   // current along-axis position per node

    function layout() {
      var W = stage.clientWidth, H = stage.clientHeight;
      if (!W || !H) return;
      svg.setAttribute('viewBox', '0 0 ' + W + ' ' + H);

      var vert = W < 820;
      var NS   = vert ? 46 : Math.max(54, Math.min(78, W * 0.055));
      var half = NS / 2;
      var L    = vert ? H : W;
      var pad  = half + (vert ? 22 : 30);
      var aStep = (L - pad * 2) / 3;
      var bStep = (L - pad * 2) / 4;
      var cross = vert ? W * 0.40 : H * 0.455;   // node centre, so node + label sit centred
      var fan   = (vert ? W : H) * 0.38;

      var pm = clamp01((p - 0.22) / 0.46);          // hold model A, then morph
      var gm = clamp01((pm - 0.34) / 0.38);         // glyph + label crossfade
      var av = clamp01(1 - pm * 1.9);               // model A link opacity
      var bv = clamp01((pm - 0.42) * 2.4);          // model B link opacity

      if (scene) scene.style.setProperty('--pm', pm.toFixed(3));

      function P(along, off) {
        return vert ? [(cross + off).toFixed(1), along.toFixed(1)]
                    : [along.toFixed(1), (cross + off).toFixed(1)];
      }
      function M(a, o) { var q = P(a, o); return 'M' + q[0] + ' ' + q[1]; }
      function Lto(a, o) { var q = P(a, o); return 'L' + q[0] + ' ' + q[1]; }

      nodes.forEach(function (g, i) {
        var a = (pad + (i - 1) * aStep) + ((pad + i * bStep) - (pad + (i - 1) * aStep)) * pm;
        at[i] = a;
        var q = P(a, 0);
        g.setAttribute('transform', 'translate(' + q[0] + ',' + q[1] + ')');
        g.style.opacity = i === 0 ? clamp01((pm - 0.08) / 0.30).toFixed(3) : '1';
        g.classList.toggle('sig', i === 4 && pm > 0.55);

        var fr = $('.fr', g);
        fr.setAttribute('x', -half); fr.setAttribute('y', -half);
        fr.setAttribute('width', NS); fr.setAttribute('height', NS);

        var gs = NS * 0.78;
        [['.ga', 1 - gm], ['.gb', gm]].forEach(function (pair) {
          var u = $(pair[0], g);
          u.setAttribute('x', -gs / 2); u.setAttribute('y', -gs / 2);
          u.setAttribute('width', gs);  u.setAttribute('height', gs);
          u.style.opacity = pair[1].toFixed(3);
        });

        var ix = $('.ix', g);
        ix.textContent = pm > 0.5 ? '0' + (i + 1) : (i === 0 ? '' : '0' + i);
        var la = $('.la', g), lb = $('.lb', g);
        la.style.opacity = (1 - gm).toFixed(3);
        lb.style.opacity = gm.toFixed(3);

        if (vert) {
          ix.setAttribute('x', half + 14); ix.setAttribute('y', -4);
          ix.setAttribute('text-anchor', 'start');
          [la, lb].forEach(function (t) {
            t.setAttribute('x', half + 14); t.setAttribute('y', 12);
            t.setAttribute('text-anchor', 'start');
          });
        } else {
          ix.setAttribute('x', 0); ix.setAttribute('y', -half - 14);
          ix.setAttribute('text-anchor', 'middle');
          [la, lb].forEach(function (t) {
            t.setAttribute('x', 0); t.setAttribute('y', half + 24);
            t.setAttribute('text-anchor', 'middle');
          });
        }
      });

      /* ---- model A: one rail, three chevrons, nothing else --------------- */
      rail.setAttribute('d', M(at[1], 0) + Lto(at[4], 0));
      rail.style.opacity = av.toFixed(3);
      chev.forEach(function (c, i) {
        var mid = (at[i + 1] + at[i + 2]) / 2;
        var d = vert
          ? 'M' + (cross - 5) + ' ' + (mid - 5) + 'L' + cross + ' ' + mid + 'L' + (cross + 5) + ' ' + (mid - 5)
          : 'M' + (mid - 5) + ' ' + (cross - 5) + 'L' + mid + ' ' + cross + 'L' + (mid - 5) + ' ' + (cross + 5);
        c.setAttribute('d', d);
        c.style.opacity = av.toFixed(3);
      });

      /* ---- model B: a broadcast that narrows ----------------------------- */
      var src = at[0] + half + 5, dst = at[1] - half - 5;
      for (var i2 = 0; i2 < RAYS; i2++) {
        var fr2 = RAYS === 1 ? 0.5 : i2 / (RAYS - 1);
        var off = (fr2 - 0.5) * fan * 2;
        var live = LIVE.indexOf(i2) !== -1;
        var t = live ? 1 : (0.34 + ((i2 * 37) % 19) / 19 * 0.40);
        var ea = src + (dst - src) * t;
        var eo = live ? off * 0.16 : off * t;
        rays[i2].setAttribute('d', M(src, 0) + Lto(ea, eo));
        rays[i2].style.opacity = bv.toFixed(3);
        var dq = P(ea, eo);
        dots[i2].setAttribute('cx', dq[0]); dots[i2].setAttribute('cy', dq[1]);
        dots[i2].setAttribute('r', live ? 0 : 1.6);
        dots[i2].style.opacity = bv.toFixed(3);
      }
      thr.forEach(function (o) {
        var i0 = 1 + o.seg, i1 = i0 + 1;
        var sa = at[i0] + half + 5, ta = at[i1] - half - 5;
        var so = o.k === 0 ? 0 : (o.k === 1 ? NS * 0.34 : -NS * 0.34);
        o.el.setAttribute('d', M(sa, so) + Lto(ta, so * 0.28));
        o.el.style.opacity = bv.toFixed(3);
      });

      if (lblA) lblA.style.opacity = clamp01(1 - pm * 2.3).toFixed(3);
      if (lblB) lblB.style.opacity = clamp01((pm - 0.5) * 2.6).toFixed(3);
    }

    function track() {
      if (!scene) return;
      var r = scene.getBoundingClientRect();
      var span = r.height - window.innerHeight;
      target = span > 0 ? Math.min(1, Math.max(0, -r.top / span)) : 0;
    }
    function tick() {
      p += (target - p) * (RM ? 1 : 0.11);
      layout();
      requestAnimationFrame(tick);
    }
    track(); layout();
    window.__ebMorph = function () { track(); layout(); };
    window.addEventListener('scroll', track, { passive: true });
    window.addEventListener('resize', function () { track(); layout(); }, { passive: true });
    tick();
  }

  /* ---- 7. UTC band ------------------------------------------------------ */
  var utc = $('.utc-scale');
  if (utc) {
    for (var u = 0; u < 27; u++) {
      var i2 = document.createElement('i');
      if (u % 3 === 0) i2.className = 'tall';
      utc.appendChild(i2);
    }
    var live = function () {
      var h = new Date().getUTCHours();
      $$('i', utc).forEach(function (n, k) {
        var off = k - 12;
        var local = ((h + off) % 24 + 24) % 24;
        n.classList.toggle('on', local >= 8 && local <= 19);
      });
    };
    live(); setInterval(live, 60000);
  }

  /* ---- 8. inquiry form ---------------------------------------------------
     Posts to /api/inquiry, which sends the mail through Resend. Opened from
     a file:// preview there is no server, so it falls back to composing the
     same message as a mailto — the single-file copy keeps working offline. */
  var form = $('#inquiry-form');
  if (form) {
    var chips = $$('.chip', form),
        typeInput = $('#i-type', form),
        submitBtn = $('[type="submit"]', form),
        sentBox = $('.sent'),
        errBox  = $('.form-err'),
        idleLabel = submitBtn ? submitBtn.querySelector('span').textContent : 'Send inquiry',
        sending = false;

    chips.forEach(function (c) {
      c.addEventListener('click', function () {
        chips.forEach(function (x) { x.classList.remove('on'); x.setAttribute('aria-pressed', 'false'); });
        c.classList.add('on');
        c.setAttribute('aria-pressed', 'true');
        if (typeInput) typeInput.value = c.dataset.v;
      });
    });

    function setLabel(t) { if (submitBtn) submitBtn.querySelector('span').textContent = t; }
    function busy(on) {
      sending = on;
      if (!submitBtn) return;
      submitBtn.disabled = on;
      submitBtn.setAttribute('aria-busy', on ? 'true' : 'false');
      setLabel(on ? 'Sending' : idleLabel);
    }
    function showError(msg) {
      if (!errBox) return;
      errBox.textContent = msg;
      errBox.classList.add('show');
    }
    function clearError() { if (errBox) errBox.classList.remove('show'); }
    function showSent() {
      form.classList.add('is-done');
      if (sentBox) {
        sentBox.classList.add('show');
        sentBox.setAttribute('tabindex', '-1');
        sentBox.focus({ preventScroll: true });
        sentBox.scrollIntoView({ behavior: RM ? 'auto' : 'smooth', block: 'center' });
      }
    }

    function payload() {
      var d = new FormData(form), g = function (k) { return (d.get(k) || '').toString().trim(); };
      return {
        type: g('type') || 'Other', name: g('name'), company: g('company'),
        email: g('email'), country: g('country'), message: g('message'),
        website: g('website')   // honeypot
      };
    }

    function mailtoFallback(p) {
      var lines = [
        'Inquiry type: ' + p.type, 'Name: ' + p.name, 'Company: ' + p.company,
        'Email: ' + p.email, 'Country: ' + p.country, '', p.message, ''
      ].join('\n');
      window.location.href = 'mailto:hello@ecombrands.us'
        + '?subject=' + encodeURIComponent('[' + p.type + '] ' + (p.company || p.name))
        + '&body=' + encodeURIComponent(lines);
    }

    form.addEventListener('submit', function (e) {
      e.preventDefault();
      if (sending) return;
      clearError();

      var p = payload();
      if (!p.name || !p.email || !p.message) {
        showError('Name, email and message are required.');
        return;
      }
      if (!/^[^@\s]+@[^@\s.]+\.[^@\s]+$/.test(p.email)) {
        showError('That email address does not look right.');
        return;
      }

      // no server behind a local preview file — compose the mail instead
      if (location.protocol === 'file:') { showSent(); mailtoFallback(p); return; }

      busy(true);
      fetch('/api/inquiry', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(p)
      })
        .then(function (r) {
          return r.json().catch(function () { return {}; })
            .then(function (data) { return { ok: r.ok, status: r.status, data: data }; });
        })
        .then(function (res) {
          busy(false);
          if (res.ok) { showSent(); return; }
          showError(res.data.error || 'Something went wrong. Please email hello@ecombrands.us directly.');
        })
        .catch(function () {
          // the network, not the server: let them send it themselves
          busy(false);
          showError('We could not reach the server. Opening your email client instead.');
          mailtoFallback(p);
        });
    });
  }

  /* ---- 9. year --------------------------------------------------------- */
  $$('[data-year]').forEach(function (n) { n.textContent = new Date().getFullYear(); });

  /* ---- 10. live UTC clock in the status rail --------------------------- */
  var clock = $('[data-clock]');
  if (clock) {
    var tickClock = function () {
      var n = new Date();
      var pad = function (v) { return v < 10 ? '0' + v : '' + v; };
      clock.textContent = pad(n.getUTCHours()) + ':' + pad(n.getUTCMinutes()) + ' UTC';
    };
    tickClock(); setInterval(tickClock, 15000);
  }
})();
