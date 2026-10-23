/* Majumi Motion Engine · refresh-rate adaptive, composited UI (60/90/120 Hz+)
 * Native WAAPI + IntersectionObserver. No JavaScript per-frame animation loops.
 * requestAnimationFrame is used only by the optional one-shot diagnostics.
 */
(() => {
  'use strict';
  const reduceQuery = window.matchMedia?.('(prefers-reduced-motion: reduce)');
  const prefersLess = () => !!reduceQuery?.matches;
  const running = new WeakMap();
  const closings = new WeakSet();
  const easings = {
    ease: 'cubic-bezier(.22, 1, .36, 1)',
    spring: 'cubic-bezier(.16, 1, .3, 1)',
    fade: 'cubic-bezier(.2, 0, .2, 1)'
  };
  const presets = {
    search: {distance: -15, duration: 300, easing: easings.ease},
    popover: {distance: 18, duration: 370, easing: easings.spring},
    menu: {distance: -10, duration: 320, easing: easings.ease},
    modal: {distance: 20, duration: 430, easing: easings.spring},
    shade: {distance: 0, duration: 240, easing: easings.fade},
    toast: {distance: 0, duration: 200, easing: easings.fade}
  };
  const frames = (kind, entering) => {
    const config = presets[kind] || presets.popover;
    const displaced = config.distance === 0 ? {} : {transform: 'translate3d(0,' + config.distance + 'px,0)'};
    const normal = config.distance === 0 ? {} : {transform: 'translate3d(0,0,0)'};
    return entering
      ? [{opacity: 0, ...displaced}, {opacity: 1, ...normal}]
      : [{opacity: 1, ...normal}, {opacity: 0, ...displaced}];
  };
  function stop(el) {
    const current = running.get(el);
    if (current) {
      running.delete(el);
      current.cancel();
    }
  }
  function animate(el, keyframes, options, completed) {
    if (!el) return;
    stop(el);
    if (prefersLess() || typeof el.animate !== 'function') {
      completed?.();
      return;
    }
    const animation = el.animate(keyframes, {
      duration: options.duration,
      easing: options.easing || easings.ease,
      fill: 'none'
    });
    running.set(el, animation);
    animation.finished.then(() => {
      if (running.get(el) !== animation) return;
      running.delete(el);
      completed?.();
    }).catch(() => {});
    return animation;
  }
  function show(el, kind = 'popover') {
    if (!el) return;
    closings.delete(el);
    el.hidden = false;
    const config = presets[kind] || presets.popover;
    animate(el, frames(kind, true), config);
  }
  function hide(el, kind = 'popover', completed) {
    if (!el) return;
    closings.add(el);
    const config = presets[kind] || presets.popover;
    animate(el, frames(kind, false), config, () => {
      if (!closings.has(el)) return;
      closings.delete(el);
      el.hidden = true;
      completed?.();
    });
  }
  function bump(el) {
    if (!el || prefersLess()) return;
    animate(el, [
      {transform:'scale(1)'}, {transform:'scale(1.28)',offset:.35},
      {transform:'scale(.96)',offset:.7}, {transform:'scale(1)'}
    ], {duration:360,easing:easings.spring});
  }
  let observer = null;
  function addReveal(elements) {
    if (prefersLess() || !('IntersectionObserver' in window)) return;
    if (!observer) observer = new IntersectionObserver(entries => {
      for (const entry of entries) {
        if (!entry.isIntersecting) continue;
        entry.target.classList.add('motion-visible');
        observer.unobserve(entry.target);
      }
    }, {rootMargin:'0px 0px -5% 0px', threshold:.08});
    Array.from(elements || []).forEach((node,index) => {
      if (!node || node.classList.contains('motion-visible')) return;
      node.style.setProperty('--motion-delay',Math.min(index % 8,7)*45+'ms');
      node.classList.add('motion-reveal');
      observer.observe(node);
    });
  }
  function catalog(root) {
    if (!root || prefersLess()) return;
    addReveal(root.querySelectorAll('.product-card'));
  }
  function init() {
    if (prefersLess()) return;
    document.documentElement.classList.add('motion-enhanced');
    addReveal(document.querySelectorAll(
      '.section-heading, .category-card, .editorial-photo, .editorial-copy, .note-heading, .note-points > div'
    ));
    if (reduceQuery?.addEventListener) reduceQuery.addEventListener('change', event => {
      if (event.matches) {
        observer?.disconnect();
        document.querySelectorAll('.motion-reveal').forEach(node => node.classList.add('motion-visible'));
      } else {
        document.documentElement.classList.add('motion-enhanced');
      }
    });
  }
  // Optional test: ?motionDebug=1 measures frame cadence for ~1.5s, then stops.
  function diagnostics() {
    if (new URLSearchParams(location.search).get('motionDebug') !== '1') return;
    if (!('requestAnimationFrame' in window) || document.visibilityState === 'hidden') return;
    const panel = document.createElement('output');
    panel.className = 'motion-diagnostics';
    panel.setAttribute('aria-live','polite');
    panel.textContent = 'Analizando frecuencia de pantalla…';
    document.body.appendChild(panel);
    const intervals = [];
    let last = 0;
    let count = 0;
    const start = performance.now();
    function measure(ts) {
      if (document.visibilityState === 'hidden') {
        panel.textContent = 'No se puede medir con la pestaña en segundo plano.';
        return;
      }
      if (last) intervals.push(ts-last);
      last = ts;
      count++;
      if (count < 110 && ts-start < 2200) {
        requestAnimationFrame(measure);
        return;
      }
      const sorted = intervals.filter(t=>t>0).sort((a,b)=>a-b);
      if (sorted.length < 15) {
        panel.textContent = 'No se pudo estimar la frecuencia.';
        return;
      }
      const median = sorted[Math.floor(sorted.length / 2)];
      const hz = Math.round(1000 / median);
      const late = intervals.filter(t => t > median * 1.55).length;
      panel.textContent = hz + ' Hz observados · ' + late + ' cuadros tardíos de ' + intervals.length +
        (prefersLess() ? ' · movimiento reducido' : '') +
        ' · estimación local, no certificación de FPS';
    }
    requestAnimationFrame(measure);
  }
  window.MajumiMotion = Object.freeze({
    show, hide, bump, catalog, init, diagnostics, isClosing: el => closings.has(el),
    reduced: prefersLess
  });
  init();
  diagnostics();
})();
