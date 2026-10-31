(() => {
  'use strict';

  // ---------------------------------------------------------------------------
  // Utilidades
  // ---------------------------------------------------------------------------
  const $ = (sel) => document.querySelector(sel);
  const clamp = (v, min, max) => Math.min(max, Math.max(min, v));
  const uid = () => Math.random().toString(36).slice(2, 10);

  const store = {
    get(key, fallback) {
      try {
        const raw = localStorage.getItem(key);
        return raw ? JSON.parse(raw) : fallback;
      } catch { return fallback; }
    },
    set(key, value) {
      try { localStorage.setItem(key, JSON.stringify(value)); } catch { /* sin almacenamiento */ }
    },
  };

  const escapeHtml = (s) => s.replace(/[&<>"']/g, (c) => (
    { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]
  ));

  const normalize = (s) => s
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]/g, '');

  const fmtTime = (sec) => {
    if (!isFinite(sec) || sec < 0) sec = 0;
    sec = Math.round(sec);
    const h = Math.floor(sec / 3600);
    const m = Math.floor((sec % 3600) / 60);
    const s = String(sec % 60).padStart(2, '0');
    return h ? `${h}:${String(m).padStart(2, '0')}:${s}` : `${m}:${s}`;
  };

  let toastTimer;
  function toast(msg, ms = 2200) {
    const el = $('#toast');
    el.textContent = msg;
    el.hidden = false;
    el.style.animation = 'none';
    void el.offsetWidth;
    el.style.animation = '';
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => { el.hidden = true; }, ms);
  }

  // ---------------------------------------------------------------------------
  // Estado: ajustes y guiones
  // ---------------------------------------------------------------------------
  const DEFAULTS = {
    speed: 5,
    fontSize: 56,
    lineHeight: 1.5,
    width: 80,
    guide: 35,
    countdown: 3,
    family: 'sans',
    align: 'left',
    color: '#ffffff',
    bg: '#000000',
    accent: '#ffcc33',
    mirrorX: false,
    mirrorY: false,
    showGuide: true,
    fade: true,
    focus: true,
    upper: false,
    lang: 'es-ES',
  };

  const FONTS = {
    sans: '"Inter", system-ui, sans-serif',
    serif: '"Merriweather", Georgia, serif',
    mono: '"JetBrains Mono", ui-monospace, monospace',
  };

  const SAMPLE = `# Bienvenida

Hola a todos y bienvenidos. Este es un **teleprompter dinámico**: el texto se desplaza a la velocidad que elijas y puedes ajustarlo en tiempo real.

[sonríe a cámara]

# Cómo usarlo

Pulsa la barra espaciadora para reproducir o pausar. Usa las flechas arriba y abajo para cambiar la velocidad, y las teclas más y menos para cambiar el tamaño de la letra.

Si activas el **modo voz** con la tecla V, el teleprompter escuchará lo que dices y avanzará solo, siguiendo tus palabras.

[pausa]

# Cierre

Puedes usar el espejo horizontal si tienes un cristal de teleprompter, y la pantalla completa con la tecla F. Gracias por ver, y nos vemos en el próximo video.`;

  let settings = { ...DEFAULTS, ...store.get('tp.settings', {}) };
  let scripts = store.get('tp.scripts', null);
  if (!Array.isArray(scripts) || !scripts.length) {
    scripts = [{ id: uid(), title: 'Guion de ejemplo', text: SAMPLE, updated: Date.now() }];
  }
  let currentId = store.get('tp.current', scripts[0].id);
  if (!scripts.some((s) => s.id === currentId)) currentId = scripts[0].id;

  const saveSettings = () => store.set('tp.settings', settings);
  const saveScripts = () => { store.set('tp.scripts', scripts); store.set('tp.current', currentId); };
  const currentScript = () => scripts.find((s) => s.id === currentId);

  // ---------------------------------------------------------------------------
  // Editor
  // ---------------------------------------------------------------------------
  const ui = {
    editor: $('#editor'),
    list: $('#scriptList'),
    title: $('#scriptTitle'),
    text: $('#scriptText'),
    stats: $('#stats'),
  };

  function renderList() {
    ui.list.innerHTML = '';
    [...scripts].sort((a, b) => b.updated - a.updated).forEach((s) => {
      const li = document.createElement('li');
      li.className = s.id === currentId ? 'active' : '';
      const words = countWords(s.text);
      li.innerHTML = `<span class="t"></span><span class="m">${words} palabras · ${new Date(s.updated).toLocaleDateString()}</span>`;
      li.querySelector('.t').textContent = s.title || 'Sin título';
      li.addEventListener('click', () => selectScript(s.id));
      ui.list.appendChild(li);
    });
  }

  function countWords(text) {
    return (text.replace(/\[[^\]]*\]/g, ' ').replace(/[#*]/g, ' ').match(/\S+/g) || []).length;
  }

  function renderStats() {
    const text = ui.text.value;
    const words = countWords(text);
    const mins = words / 150;
    ui.stats.innerHTML =
      `<strong>${words}</strong> palabras · <strong>${text.length}</strong> caracteres · ` +
      `≈ <strong>${fmtTime(mins * 60)}</strong> a 150 ppm`;
  }

  function selectScript(id) {
    currentId = id;
    const s = currentScript();
    ui.title.value = s.title;
    ui.text.value = s.text;
    renderStats();
    renderList();
    saveScripts();
  }

  let saveTimer;
  function onEdit() {
    const s = currentScript();
    s.title = ui.title.value;
    s.text = ui.text.value;
    s.updated = Date.now();
    renderStats();
    clearTimeout(saveTimer);
    saveTimer = setTimeout(() => { saveScripts(); renderList(); }, 400);
  }

  ui.title.addEventListener('input', onEdit);
  ui.text.addEventListener('input', onEdit);

  $('#newScript').addEventListener('click', () => {
    const s = { id: uid(), title: 'Nuevo guion', text: '', updated: Date.now() };
    scripts.push(s);
    selectScript(s.id);
    ui.title.select();
  });

  $('#deleteScript').addEventListener('click', () => {
    const s = currentScript();
    if (!confirm(`¿Eliminar "${s.title || 'Sin título'}"?`)) return;
    scripts = scripts.filter((x) => x.id !== s.id);
    if (!scripts.length) scripts.push({ id: uid(), title: 'Nuevo guion', text: '', updated: Date.now() });
    selectScript(scripts[0].id);
  });

  $('#importFile').addEventListener('change', (e) => {
    const file = e.target.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      const s = { id: uid(), title: file.name.replace(/\.[^.]+$/, ''), text: String(reader.result), updated: Date.now() };
      scripts.push(s);
      selectScript(s.id);
      toast('Guion importado');
    };
    reader.readAsText(file);
    e.target.value = '';
  });

  $('#exportScript').addEventListener('click', () => {
    const s = currentScript();
    const blob = new Blob([s.text], { type: 'text/plain;charset=utf-8' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = `${(s.title || 'guion').replace(/[\\/:*?"<>|]/g, '_')}.txt`;
    a.click();
    setTimeout(() => URL.revokeObjectURL(a.href), 1000);
  });

  // ---------------------------------------------------------------------------
  // Controles de ajustes (editor) ligados al estado
  // ---------------------------------------------------------------------------
  const ranges = [
    ['sSpeed', 'speed', 'oSpeed', (v) => v.toFixed(1)],
    ['sFont', 'fontSize', 'oFont', (v) => `${v}px`],
    ['sLine', 'lineHeight', 'oLine', (v) => v.toFixed(2)],
    ['sWidth', 'width', 'oWidth', (v) => `${v}%`],
    ['sGuide', 'guide', 'oGuide', (v) => `${v}%`],
    ['sCountdown', 'countdown', 'oCountdown', (v) => (v ? `${v}s` : 'No')],
  ];
  const selects = [['sFamily', 'family'], ['sAlign', 'align'], ['sLang', 'lang']];
  const colors = [['sColor', 'color'], ['sBg', 'bg'], ['sAccent', 'accent']];
  const checks = [
    ['sMirrorX', 'mirrorX'], ['sMirrorY', 'mirrorY'], ['sShowGuide', 'showGuide'],
    ['sFade', 'fade'], ['sFocus', 'focus'], ['sUpper', 'upper'],
  ];

  function syncControls() {
    ranges.forEach(([id, key, out, fmt]) => {
      $(`#${id}`).value = settings[key];
      $(`#${out}`).textContent = fmt(Number(settings[key]));
    });
    selects.forEach(([id, key]) => { $(`#${id}`).value = settings[key]; });
    colors.forEach(([id, key]) => { $(`#${id}`).value = settings[key]; });
    checks.forEach(([id, key]) => { $(`#${id}`).checked = settings[key]; });
  }

  function setSetting(key, value) {
    settings[key] = value;
    saveSettings();
    syncControls();
    applySettings();
  }

  ranges.forEach(([id, key]) => $(`#${id}`).addEventListener('input', (e) => setSetting(key, Number(e.target.value))));
  selects.forEach(([id, key]) => $(`#${id}`).addEventListener('change', (e) => setSetting(key, e.target.value)));
  colors.forEach(([id, key]) => $(`#${id}`).addEventListener('input', (e) => setSetting(key, e.target.value)));
  checks.forEach(([id, key]) => $(`#${id}`).addEventListener('change', (e) => setSetting(key, e.target.checked)));

  $('#resetSettings').addEventListener('click', () => {
    settings = { ...DEFAULTS };
    saveSettings();
    syncControls();
    applySettings();
    toast('Ajustes restablecidos');
  });

  // ---------------------------------------------------------------------------
  // Teleprompter
  // ---------------------------------------------------------------------------
  const P = {
    root: $('#prompter'),
    stage: $('#stage'),
    content: $('#content'),
    bar: $('#progressBar'),
    hud: $('#hud'),
    play: $('#playBtn'),
    countdown: $('#countdown'),
    end: $('#endBadge'),
    help: $('#help'),
    voiceBtn: $('#voiceBtn'),
    voiceStatus: $('#voiceStatus'),
    mirrorXBtn: $('#mirrorXBtn'),
    mirrorYBtn: $('#mirrorYBtn'),
    hudSpeed: $('#hudSpeed'),
    hudFont: $('#hudFont'),
    hudElapsed: $('#hudElapsed'),
    hudRemaining: $('#hudRemaining'),
  };

  const state = {
    open: false,
    playing: false,
    pos: 0,            // desplazamiento actual (px de contenido)
    vel: 0,            // velocidad actual (px/s), suavizada
    jumpTo: null,      // destino de un salto suave
    maxPos: 0,
    guideY: 0,
    lineH: 0,
    blocks: [],        // [{el, top, bottom}]
    words: [],         // [{el, norm}]
    activeBlock: null,
    elapsed: 0,
    lastT: 0,
    countdownTimer: null,
    ended: false,
    wakeLock: null,
    hudTimer: null,
    drag: null,
  };

  // Velocidad en px/s: escala con el tamaño de letra para que "velocidad 5"
  // signifique aproximadamente las mismas líneas por minuto en cualquier tamaño.
  const pxPerSec = () => settings.speed * settings.fontSize * 0.1;

  function applySettings() {
    const r = document.documentElement.style;
    r.setProperty('--pf-size', `${settings.fontSize}px`);
    r.setProperty('--pf-lh', settings.lineHeight);
    r.setProperty('--pf-width', `${settings.width}%`);
    r.setProperty('--pf-color', settings.color);
    r.setProperty('--pf-bg', settings.bg);
    r.setProperty('--pf-accent', settings.accent);
    r.setProperty('--pf-font', FONTS[settings.family] || FONTS.sans);
    r.setProperty('--pf-align', settings.align);
    r.setProperty('--pf-guide', `${settings.guide}%`);

    P.stage.style.transform = `scale(${settings.mirrorX ? -1 : 1}, ${settings.mirrorY ? -1 : 1})`;
    P.root.classList.toggle('no-guide', !settings.showGuide);
    P.root.classList.toggle('no-fade', !settings.fade);
    P.content.classList.toggle('focus-mode', settings.focus);
    P.content.classList.toggle('upper', settings.upper);
    P.mirrorXBtn.classList.toggle('on', settings.mirrorX);
    P.mirrorYBtn.classList.toggle('on', settings.mirrorY);
    P.hudSpeed.textContent = settings.speed.toFixed(1);
    P.hudFont.textContent = settings.fontSize;

    if (voice.rec) voice.rec.lang = settings.lang;
    if (state.open) relayout();
  }

  // --- Render del guion ------------------------------------------------------
  function renderInline(line, wordList) {
    // Separa [indicaciones] y **énfasis**, el resto son palabras normales.
    const parts = line.split(/(\[[^\]]*\]|\*\*[^*]+\*\*)/);
    let html = '';
    for (const part of parts) {
      if (!part) continue;
      if (part.startsWith('[') && part.endsWith(']')) {
        html += `<span class="cue">${escapeHtml(part.slice(1, -1).trim())}</span>`;
      } else if (part.startsWith('**') && part.endsWith('**') && part.length > 4) {
        html += `<strong>${wrapWords(part.slice(2, -2), wordList)}</strong>`;
      } else {
        html += wrapWords(part, wordList);
      }
    }
    return html;
  }

  function wrapWords(text, wordList) {
    return text.split(/(\s+)/).map((tok) => {
      if (!tok || /^\s+$/.test(tok)) return tok;
      const norm = normalize(tok);
      if (!norm) return escapeHtml(tok);
      const i = wordList.length;
      wordList.push(norm);
      return `<span class="w" data-i="${i}">${escapeHtml(tok)}</span>`;
    }).join('');
  }

  function renderScript(text) {
    const norms = [];
    const blocks = text.replace(/\r\n?/g, '\n').split(/\n\s*\n/);
    let html = '';
    for (const raw of blocks) {
      const block = raw.trim();
      if (!block) continue;
      const lines = block.split('\n');
      // Un bloque puede empezar con un título "# ..." seguido de texto.
      let i = 0;
      while (i < lines.length && /^#{1,6}\s+/.test(lines[i])) {
        html += `<h2>${renderInline(lines[i].replace(/^#{1,6}\s+/, ''), norms)}</h2>`;
        i++;
      }
      const rest = lines.slice(i);
      if (rest.length) html += `<p>${rest.map((l) => renderInline(l, norms)).join('<br>')}</p>`;
    }
    if (!html) html = '<p><span class="cue">El guion está vacío</span></p>';
    P.content.innerHTML = html;

    const els = P.content.querySelectorAll('.w');
    state.words = norms.map((norm, i) => ({ norm, el: els[i] }));
  }

  // --- Layout ---------------------------------------------------------------
  function relayout() {
    const ratio = state.maxPos ? state.pos / state.maxPos : 0;
    const h = P.stage.clientHeight;
    state.lineH = settings.fontSize * settings.lineHeight;
    state.guideY = h * settings.guide / 100;
    state.blocks = [...P.content.children].map((el) => ({
      el, top: el.offsetTop, bottom: el.offsetTop + el.offsetHeight,
    }));
    // El final llega cuando la última línea queda sobre la guía.
    const last = state.blocks[state.blocks.length - 1];
    state.maxPos = Math.max(0, (last ? last.bottom : 0) - state.lineH);
    state.pos = ratio * state.maxPos;
    if (voice.active) voice.target = wordPos(voice.idx);
    render();
  }

  const wordPos = (i) => {
    const w = state.words[clamp(i, 0, state.words.length - 1)];
    if (!w) return 0;
    return clamp(w.el.offsetTop + w.el.offsetHeight / 2 - state.lineH / 2, 0, state.maxPos);
  };

  // --- Bucle de animación ----------------------------------------------------
  function frame(t) {
    if (!state.open) return;
    const dt = Math.min(0.1, (t - (state.lastT || t)) / 1000);
    state.lastT = t;

    if (state.drag) {
      state.vel = 0;
    } else if (state.jumpTo !== null) {
      const d = state.jumpTo - state.pos;
      state.pos += d * Math.min(1, dt * 9);
      if (Math.abs(d) < 0.5) { state.pos = state.jumpTo; state.jumpTo = null; }
    } else if (voice.active) {
      const d = voice.target - state.pos;
      state.pos += d * Math.min(1, dt * 4);
      state.vel = 0;
    } else {
      const target = state.playing ? pxPerSec() : 0;
      // Aceleración y frenado suaves.
      state.vel += (target - state.vel) * Math.min(1, dt * (state.playing ? 2.5 : 6));
      if (!state.playing && Math.abs(state.vel) < 0.5) state.vel = 0;
      state.pos += state.vel * dt;
    }

    if (state.playing || voice.active) state.elapsed += dt;

    state.pos = clamp(state.pos, 0, state.maxPos);
    if (state.playing && !voice.active && state.pos >= state.maxPos) finish();

    render();
    requestAnimationFrame(frame);
  }

  function render() {
    const y = state.guideY - state.lineH / 2 - state.pos;
    P.content.style.transform = `translate3d(0, ${y}px, 0)`;

    const progress = state.maxPos ? state.pos / state.maxPos : 1;
    P.bar.style.width = `${progress * 100}%`;
    P.hudElapsed.textContent = fmtTime(state.elapsed);
    P.hudRemaining.textContent = voice.active
      ? `${Math.max(0, state.words.length - voice.idx)} pal.`
      : fmtTime((state.maxPos - state.pos) / pxPerSec());

    // Párrafo activo (el que cruza la línea de lectura).
    const at = state.pos + state.lineH / 2;
    const active = state.blocks.find((b) => at >= b.top && at < b.bottom + settings.fontSize * 0.9)
      || state.blocks[state.blocks.length - 1];
    if (active && active !== state.activeBlock) {
      state.activeBlock?.el.classList.remove('active');
      active.el.classList.add('active');
      state.activeBlock = active;
    }
  }

  // --- Controles -------------------------------------------------------------
  function setPlaying(on) {
    if (on && voice.active) { toast('Modo voz activo: el texto sigue tu voz'); return; }
    if (on && state.pos >= state.maxPos) state.pos = 0;
    clearCountdown();
    state.playing = on;
    state.ended = false;
    P.end.hidden = true;
    P.play.textContent = on ? '❚❚' : '▶';
    if (on) scheduleHudHide(); else showHud(true);
  }

  function togglePlay() {
    if (state.countdownTimer) { clearCountdown(); return; }
    if (state.playing) setPlaying(false);
    else startWithCountdown();
  }

  function startWithCountdown() {
    const n = settings.countdown;
    if (!n || state.pos > 0) { setPlaying(true); return; }
    let left = n;
    P.countdown.hidden = false;
    const tick = () => {
      if (left <= 0) { clearCountdown(); setPlaying(true); return; }
      P.countdown.textContent = left;
      P.countdown.classList.remove('tick');
      void P.countdown.offsetWidth;
      P.countdown.classList.add('tick');
      left--;
      state.countdownTimer = setTimeout(tick, 1000);
    };
    tick();
  }

  function clearCountdown() {
    clearTimeout(state.countdownTimer);
    state.countdownTimer = null;
    P.countdown.hidden = true;
  }

  function finish() {
    state.playing = false;
    state.ended = true;
    P.play.textContent = '▶';
    P.end.hidden = false;
    showHud(true);
  }

  function jump(pos) {
    state.jumpTo = clamp(pos, 0, state.maxPos);
    if (voice.active) {
      voice.idx = wordIndexAt(state.jumpTo);
      voice.target = state.jumpTo;
      markWords();
    }
  }

  function restart() {
    setPlaying(false);
    state.elapsed = 0;
    jump(0);
    if (voice.active) { voice.idx = 0; markWords(); }
  }

  function jumpBlock(dir) {
    const at = state.pos + 1;
    if (dir > 0) {
      const next = state.blocks.find((b) => b.top > at);
      jump(next ? next.top : state.maxPos);
    } else {
      const prev = [...state.blocks].reverse().find((b) => b.top < at - state.lineH);
      jump(prev ? prev.top : 0);
    }
  }

  function changeSpeed(delta) {
    setSetting('speed', clamp(Math.round((settings.speed + delta) * 2) / 2, 0.5, 30));
    flashHud();
  }

  function changeFont(delta) {
    setSetting('fontSize', clamp(settings.fontSize + delta, 20, 160));
    flashHud();
  }

  function toggleFullscreen() {
    if (document.fullscreenElement) document.exitFullscreen?.();
    else P.root.requestFullscreen?.().catch(() => toast('Pantalla completa no disponible'));
  }

  // --- HUD auto-ocultable ----------------------------------------------------
  function showHud(persist) {
    P.hud.classList.remove('hidden');
    P.root.classList.remove('hide-cursor');
    clearTimeout(state.hudTimer);
    if (!persist) scheduleHudHide();
  }
  function scheduleHudHide() {
    clearTimeout(state.hudTimer);
    state.hudTimer = setTimeout(() => {
      if ((state.playing || voice.active) && P.help.hidden) {
        P.hud.classList.add('hidden');
        P.root.classList.add('hide-cursor');
      }
    }, 2500);
  }
  const flashHud = () => showHud(false);

  P.root.addEventListener('mousemove', () => {
    if (state.drag) return;
    showHud(!(state.playing || voice.active));
  });

  // --- Abrir / cerrar ----------------------------------------------------------
  async function openPrompter() {
    const text = currentScript().text;
    if (!text.trim()) { toast('Escribe algo en el guion primero'); return; }
    ui.editor.hidden = true;
    P.root.hidden = false;
    state.open = true;
    state.pos = 0;
    state.vel = 0;
    state.elapsed = 0;
    state.maxPos = 0;
    state.jumpTo = null;
    state.activeBlock = null;
    renderScript(text);
    applySettings();
    await document.fonts?.ready;
    relayout();
    showHud(true);
    state.lastT = 0;
    requestAnimationFrame(frame);
    requestWakeLock();
  }

  function closePrompter() {
    setPlaying(false);
    stopVoice();
    clearCountdown();
    state.open = false;
    P.help.hidden = true;
    if (document.fullscreenElement) document.exitFullscreen?.();
    P.root.hidden = true;
    ui.editor.hidden = false;
    state.wakeLock?.release?.().catch(() => {});
    state.wakeLock = null;
    ui.text.focus();
  }

  async function requestWakeLock() {
    try { state.wakeLock = await navigator.wakeLock?.request('screen'); } catch { /* no soportado */ }
  }
  document.addEventListener('visibilitychange', () => {
    if (state.open && document.visibilityState === 'visible') requestWakeLock();
  });

  $('#startBtn').addEventListener('click', openPrompter);

  // --- Acciones del HUD --------------------------------------------------------
  const actions = {
    editor: closePrompter,
    restart,
    prev: () => jumpBlock(-1),
    next: () => jumpBlock(1),
    play: togglePlay,
    slower: () => changeSpeed(-0.5),
    faster: () => changeSpeed(0.5),
    smaller: () => changeFont(-4),
    bigger: () => changeFont(4),
    voice: toggleVoice,
    mirrorX: () => setSetting('mirrorX', !settings.mirrorX),
    mirrorY: () => setSetting('mirrorY', !settings.mirrorY),
    fullscreen: toggleFullscreen,
    help: () => { P.help.hidden = !P.help.hidden; showHud(!P.help.hidden); },
  };

  P.root.addEventListener('click', (e) => {
    const btn = e.target.closest('[data-act]');
    if (btn) { e.stopPropagation(); btn.blur(); actions[btn.dataset.act]?.(); }
  });

  // --- Teclado -----------------------------------------------------------------
  document.addEventListener('keydown', (e) => {
    if (!state.open) {
      if ((e.ctrlKey || e.metaKey) && e.key === 'Enter') { e.preventDefault(); openPrompter(); }
      return;
    }
    if (e.ctrlKey || e.metaKey || e.altKey) return;
    const k = e.key;
    let handled = true;
    switch (true) {
      case k === ' ' || k === 'k' || k === 'K': togglePlay(); break;
      case k === 'ArrowUp': changeSpeed(0.5); break;
      case k === 'ArrowDown': changeSpeed(-0.5); break;
      case k === 'ArrowLeft': jump((state.jumpTo ?? state.pos) - state.lineH); break;
      case k === 'ArrowRight': jump((state.jumpTo ?? state.pos) + state.lineH); break;
      case k === 'PageDown': jumpBlock(1); break;
      case k === 'PageUp': jumpBlock(-1); break;
      case k === '+' || k === '=': changeFont(4); break;
      case k === '-' || k === '_': changeFont(-4); break;
      case k === 'm': actions.mirrorX(); break;
      case k === 'M': actions.mirrorY(); break;
      case k === 'f' || k === 'F': toggleFullscreen(); break;
      case k === 'v' || k === 'V': toggleVoice(); break;
      case k === 'r' || k === 'R' || k === 'Home': restart(); break;
      case k === 'End': jump(state.maxPos); break;
      case k === '?' || k === 'h' || k === 'H': actions.help(); break;
      case k === 'Escape':
        if (!P.help.hidden) actions.help();
        else if (!document.fullscreenElement) closePrompter();
        break;
      case /^[1-9]$/.test(k): setSetting('speed', Number(k) * 2); flashHud(); break;
      default: handled = false;
    }
    if (handled) e.preventDefault();
  });

  // --- Rueda, arrastre y clic -------------------------------------------------
  P.stage.addEventListener('wheel', (e) => {
    e.preventDefault();
    const dir = settings.mirrorY ? -1 : 1;
    const delta = e.deltaMode === 1 ? e.deltaY * state.lineH : e.deltaY;
    state.jumpTo = null;
    state.pos = clamp(state.pos + delta * dir, 0, state.maxPos);
    if (voice.active) { voice.idx = wordIndexAt(state.pos); voice.target = state.pos; markWords(); }
    flashHud();
  }, { passive: false });

  P.stage.addEventListener('pointerdown', (e) => {
    if (e.button !== 0) return;
    state.drag = { y: e.clientY, startPos: state.pos, moved: false, id: e.pointerId };
  });
  window.addEventListener('pointermove', (e) => {
    const d = state.drag;
    if (!d || d.id !== e.pointerId) return;
    const dy = e.clientY - d.y;
    if (Math.abs(dy) > 5) d.moved = true;
    if (d.moved) {
      state.jumpTo = null;
      state.pos = clamp(d.startPos - dy * (settings.mirrorY ? -1 : 1), 0, state.maxPos);
    }
  });
  window.addEventListener('pointerup', (e) => {
    const d = state.drag;
    if (!d || d.id !== e.pointerId) return;
    state.drag = null;
    if (d.moved) {
      if (voice.active) { voice.idx = wordIndexAt(state.pos); voice.target = state.pos; markWords(); }
      return;
    }
    // Clic simple
    if (!state.open) return;
    if (voice.active) {
      const w = e.target.closest?.('.w');
      if (w) { voice.idx = Number(w.dataset.i); voice.target = wordPos(voice.idx); markWords(); }
      return;
    }
    togglePlay();
  });

  window.addEventListener('resize', () => { if (state.open) relayout(); });

  // ---------------------------------------------------------------------------
  // Modo voz: reconocimiento de voz que sigue el guion palabra a palabra
  // ---------------------------------------------------------------------------
  const SR = window.SpeechRecognition || window.webkitSpeechRecognition;
  const voice = { rec: null, active: false, idx: 0, target: 0, marked: 0 };

  function wordIndexAt(pos) {
    const y = pos + state.lineH / 2;
    const i = state.words.findIndex((w) => w.el.offsetTop + w.el.offsetHeight >= y);
    return i === -1 ? state.words.length : i;
  }

  function markWords() {
    const words = state.words;
    const prev = voice.marked;
    const next = voice.idx;
    const [a, b] = prev < next ? [prev, next] : [next, prev];
    for (let i = a; i < b && i < words.length; i++) words[i].el.classList.toggle('said', i < next);
    P.content.querySelector('.w.cur')?.classList.remove('cur');
    words[next]?.el.classList.add('cur');
    voice.marked = next;
  }

  function resetMarks() {
    P.content.querySelectorAll('.w.said, .w.cur').forEach((el) => el.classList.remove('said', 'cur'));
    voice.marked = 0;
  }

  function lev1(a, b) {
    // ¿Distancia de edición <= 1?
    if (Math.abs(a.length - b.length) > 1) return false;
    let i = 0, j = 0, edits = 0;
    while (i < a.length && j < b.length) {
      if (a[i] === b[j]) { i++; j++; continue; }
      if (++edits > 1) return false;
      if (a.length > b.length) i++;
      else if (a.length < b.length) j++;
      else { i++; j++; }
    }
    return edits + (a.length - i) + (b.length - j) <= 1;
  }

  function similar(a, b) {
    if (a === b) return true;
    const min = Math.min(a.length, b.length);
    if (min >= 4 && lev1(a, b)) return true;
    if (min >= 5 && (a.startsWith(b) || b.startsWith(a))) return true;
    return false;
  }

  function matchSpoken(tokens) {
    const words = state.words;
    const n = tokens.length;
    if (!n || !words.length) return;
    const from = Math.max(0, voice.idx - 3);
    const to = Math.min(words.length, voice.idx + 40);

    for (let k = Math.min(n, 4); k >= 1; k--) {
      const seq = tokens.slice(n - k);
      // Con secuencias cortas exigimos más cercanía para evitar saltos falsos.
      const reach = k >= 3 ? to : k === 2 ? Math.min(to, voice.idx + 15) : Math.min(to, voice.idx + 4);
      for (let j = from + k - 1; j < reach; j++) {
        let ok = true;
        for (let t = 0; t < k; t++) {
          if (!similar(words[j - k + 1 + t].norm, seq[t])) { ok = false; break; }
        }
        if (ok) {
          if (k === 1 && seq[0].length < 3) break;
          if (j + 1 > voice.idx) {
            voice.idx = j + 1;
            voice.target = wordPos(Math.min(voice.idx, words.length - 1));
            markWords();
          }
          return;
        }
      }
    }
  }

  function startVoice() {
    if (!SR) { toast('Tu navegador no soporta reconocimiento de voz. Usa Chrome o Edge.', 3500); return; }
    setPlaying(false);
    clearCountdown();
    voice.rec = new SR();
    voice.rec.lang = settings.lang;
    voice.rec.continuous = true;
    voice.rec.interimResults = true;
    voice.rec.onresult = (e) => {
      let text = '';
      for (let i = e.resultIndex; i < e.results.length; i++) text += ' ' + e.results[i][0].transcript;
      const tokens = text.split(/\s+/).map(normalize).filter(Boolean).slice(-6);
      matchSpoken(tokens);
    };
    voice.rec.onerror = (e) => {
      if (e.error === 'not-allowed' || e.error === 'service-not-allowed') {
        toast('Permiso de micrófono denegado', 3000);
        stopVoice();
      } else if (e.error === 'network') {
        toast('El reconocimiento de voz necesita conexión a internet', 3000);
      }
    };
    voice.rec.onend = () => {
      // Chrome corta la sesión periódicamente: la reanudamos.
      if (voice.active) { try { voice.rec.start(); } catch { /* ya iniciada */ } }
    };
    try { voice.rec.start(); } catch { /* ignore */ }

    voice.active = true;
    resetMarks();
    voice.idx = wordIndexAt(state.pos);
    voice.target = state.pos;
    markWords();
    P.content.classList.add('voice-mode');
    P.voiceBtn.classList.add('on');
    P.voiceStatus.hidden = false;
    toast('Modo voz activado: empieza a leer');
    scheduleHudHide();
  }

  function stopVoice() {
    if (!voice.active) return;
    voice.active = false;
    try { voice.rec?.stop(); } catch { /* ignore */ }
    voice.rec = null;
    P.content.classList.remove('voice-mode');
    resetMarks();
    P.voiceBtn.classList.remove('on');
    P.voiceStatus.hidden = true;
    showHud(true);
  }

  function toggleVoice() {
    if (voice.active) { stopVoice(); toast('Modo voz desactivado'); } else startVoice();
  }

  // ---------------------------------------------------------------------------
  // Inicio
  // ---------------------------------------------------------------------------
  syncControls();
  applySettings();
  selectScript(currentId);
})();
