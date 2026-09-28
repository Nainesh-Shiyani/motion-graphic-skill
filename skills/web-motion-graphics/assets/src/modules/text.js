/* Motion Kit - text: animated typography
 *   data-text="reveal"      words rise from a mask (hero headlines)
 *   data-text="fade|blur"   words fade / un-blur in sequence
 *   data-text="chars"       letters pop in one by one
 *   data-text="wave"        letters bob in a continuous wave
 *   data-text="scroll"      words light up as you scroll (Apple-style)
 *   data-text="highlight"   marker highlight sweeps behind the text
 *   data-text="scramble"    decoding / hacker effect   (data-text-trigger="hover" for links)
 *   data-text="typewriter"  types text; data-words="one|two|three" cycles words
 *   data-text="rotate"      cycles data-words="one|two|three" with a slide
 * Options: data-text-delay, data-text-duration, data-text-stagger, data-text-speed, data-text-interval
 */
(function (MK) {
  'use strict';
  var d = document;
  var SKIP = /^(SCRIPT|STYLE|SVG|BR|IMG|INPUT|TEXTAREA|SELECT|CANVAS|VIDEO|IFRAME|PICTURE)$/i;
  var seg = typeof Intl !== 'undefined' && Intl.Segmenter ? new Intl.Segmenter(undefined, { granularity: 'grapheme' }) : null;
  var MODES = {
    reveal: { by: 'words', stagger: 70, total: 1400 },
    fade: { by: 'words', stagger: 60, total: 1400 },
    blur: { by: 'words', stagger: 70, total: 1400 },
    chars: { by: 'chars', stagger: 28, total: 1300 },
    wave: { by: 'chars', stagger: 0, total: 0 },
    scroll: { by: 'words', stagger: 0, total: 0 }
  };

  function span(cls, text) {
    // a custom tag, so page CSS written for <span> (e.g. ".stats span { font-size: 14px }") can't restyle the pieces
    var s = d.createElement('mk-span');
    s.className = cls;
    if (text != null) s.textContent = text;
    return s;
  }
  function graphemes(str) {
    return seg ? Array.from(seg.segment(str), function (s) { return s.segment; }) : Array.from(str);
  }
  function isClipText(el) {
    if (el.classList.contains('mk-gradient-text') || el.classList.contains('mk-shine')) return true;
    var cs = getComputedStyle(el);
    return cs.webkitBackgroundClip === 'text' || cs.backgroundClip === 'text';
  }
  function addSr(el, text) {
    var old = el.querySelector(':scope > .mk-sr');
    if (old) return old;
    var sr = span('mk-sr', text);
    el.insertBefore(sr, el.firstChild);
    return sr;
  }

  // Split text into animatable spans while keeping inline markup (<em>, <a>, <span class>) intact.
  function split(el, by) {
    if (el.hasAttribute('data-mk-split')) {
      return Array.prototype.slice.call(el.querySelectorAll(by === 'chars' ? '.mk-c' : '.mk-wi'));
    }
    var text = el.textContent.replace(/\s+/g, ' ').trim();
    var units = [];
    var idx = 0;
    function unit(content) {
      var u = span(by === 'chars' ? 'mk-c' : 'mk-wi');
      if (typeof content === 'string') u.textContent = content; else u.appendChild(content);
      u.style.setProperty('--i', idx++);
      units.push(u);
      return u;
    }
    function word(content) {
      var wEl = span('mk-w');
      wEl.setAttribute('aria-hidden', 'true');
      if (typeof content === 'string' && by === 'chars') {
        graphemes(content).forEach(function (ch) { wEl.appendChild(unit(ch)); });
      } else {
        wEl.appendChild(unit(content));
      }
      return wEl;
    }
    function walk(node) {
      Array.prototype.slice.call(node.childNodes).forEach(function (n) {
        if (n.nodeType === 3) {
          var frag = d.createDocumentFragment();
          n.nodeValue.split(/(\s+)/).forEach(function (p) {
            if (!p) return;
            frag.appendChild(/^\s+$/.test(p) ? d.createTextNode(' ') : word(p));
          });
          node.replaceChild(frag, n);
        } else if (n.nodeType === 1) {
          if (n.classList.contains('mk-sr') || SKIP.test(n.tagName)) return;
          // gradient-clipped text must stay one piece or the gradient breaks; nested text effects
          // replace their own content, so any nested text effect (except highlight) rides along as a single unit
          if (isClipText(n) || (n.hasAttribute('data-text') && n.getAttribute('data-text') !== 'highlight')) {
            var holder = d.createElement('span');
            node.replaceChild(holder, n);
            holder.parentNode.replaceChild(word(n), holder);
            return;
          }
          walk(n);
        }
      });
    }
    walk(el);
    addSr(el, text);
    el.setAttribute('data-mk-split', by);
    el.style.setProperty('--mk-n', units.length);
    return units;
  }

  function splitMode(el, mode) {
    var cfg = MODES[mode];
    var units = split(el, cfg.by);
    var stagger = MK.ms(el, 'data-text-stagger', cfg.stagger);
    if (cfg.total && units.length > 1) stagger = Math.min(stagger, cfg.total / (units.length - 1));
    el.style.setProperty('--mk-stagger', stagger + 'ms');
    var delay = MK.ms(el, 'data-text-delay', 0);
    if (delay) el.style.setProperty('--mk-delay', delay + 'ms');
    var dur = MK.ms(el, 'data-text-duration', 0);
    if (dur) el.style.setProperty('--mk-dur', dur + 'ms');
    var ease = MK.ease(el.getAttribute('data-text-ease'));
    if (ease) el.style.setProperty('--mk-ease', ease);

    if (mode === 'scroll') return scrollFill(el, units);
    if (MK.reduced) { el.classList.add('mk-in'); return; }
    return MK.onEnter(el, function () { el.classList.add('mk-in'); MK.emit(el, 'text'); });
  }

  function scrollFill(el, units) {
    if (MK.reduced) { units.forEach(function (u) { u.style.opacity = 1; }); return; }
    var active = false;
    var offView = MK.inView(el, function (v) { active = v; if (v) MK.update(); }, { rootMargin: '200px 0px' });
    var last = -1;
    var offScroll = MK.onScroll(function (y, vh) {
      if (!active) return;
      var r = el.getBoundingClientRect();
      var start = vh * 0.85, end = vh * 0.4;
      var p = MK.clamp((start - r.top) / (r.height + start - end), 0, 1);
      if (Math.abs(p - last) < 0.001) return;
      last = p;
      var n = units.length;
      for (var i = 0; i < n; i++) {
        var o = MK.clamp(p * n - i, 0, 1);
        units[i].style.opacity = (0.16 + 0.84 * o).toFixed(3);
      }
    });
    return function () { offView(); offScroll(); };
  }

  function words(el) {
    return (el.getAttribute('data-words') || '').split('|').map(function (s) { return s.trim(); }).filter(Boolean);
  }

  function highlight(el) {
    if (MK.reduced) { el.classList.add('mk-in'); return; }
    return MK.onEnter(el, function () { el.classList.add('mk-in'); });
  }

  // extra modes (scramble, typewriter, rotate) live in their own add-on files and register here
  MK.textModes = MK.textModes || {};
  MK.textModes.highlight = highlight;
  MK.textUtil = { span: span, addSr: addSr, words: words, split: split };

  MK.register({
    name: 'text',
    selector: '[data-text]',
    init: function (el) {
      var mode = (el.getAttribute('data-text') || 'reveal').trim();
      if (MODES[mode]) return splitMode(el, mode);
      if (MK.textModes[mode]) return MK.textModes[mode](el);
      MK.warn('unknown data-text="' + mode + '" (is its add-on included in the bundle?)', el);
    }
  });
  MK.splitText = split;
})(window.MotionKit);
