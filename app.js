/* Vocab — a small vocabulary trainer. No build step, no dependencies. */
'use strict';

/* ================= storage ================= */
const PREFIX = 'vocab.';
const memStore = {};
const store = {
  get(k, d) {
    try {
      const v = localStorage.getItem(PREFIX + k);
      if (v != null) return JSON.parse(v);
    } catch (_) { /* storage unavailable */ }
    return k in memStore ? memStore[k] : d;
  },
  set(k, v) {
    memStore[k] = v;
    try { localStorage.setItem(PREFIX + k, JSON.stringify(v)); return true; } catch (_) { return false; }
  },
};

const DEFAULT_SETTINGS = {
  sessionLength: 20,
  showTranslit: true,
  hideMarks: false,
  acceptTranslit: true,
  autoSpeak: false,
  autoNext: true,
  gh: { owner: '', repo: '', branch: '', folder: '', token: '' },
};
let settings = Object.assign({}, DEFAULT_SETTINGS, store.get('settings', {}));
settings.gh = Object.assign({}, DEFAULT_SETTINGS.gh, settings.gh || {});
let lists = store.get('lists', {});
let progress = store.get('progress', {});
let ui = Object.assign({ selected: [], dir: 'ab', sense: '', groups: {}, diffOnly: false }, store.get('ui', {}));

const saveSettings = () => store.set('settings', settings);
const saveLists = () => { if (!store.set('lists', lists)) toast('Could not save lists on this device (storage full or blocked).'); };
const saveProgress = () => store.set('progress', progress);
const saveUI = () => store.set('ui', ui);

if (navigator.storage && navigator.storage.persist) navigator.storage.persist().catch(() => {});

/* ================= small helpers ================= */
const $ = (s, el = document) => el.querySelector(s);
const ESC = { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' };
const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ESC[c]);
const shuffle = (a) => { a = a.slice(); for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; } return a; };
const pick = (a) => a[Math.floor(Math.random() * a.length)];
const slug = (s) => String(s).toLowerCase().normalize('NFD').replace(/\p{M}/gu, '').replace(/[^\p{L}\p{N}]+/gu, '-').replace(/^-|-$/g, '') || 'list';
const stripMarks = (s) => String(s ?? '').normalize('NFD').replace(/\p{M}/gu, '').normalize('NFC');
const LEADING = /^(to|a|an|the|le|la|les|l|un|une|des|der|die|das|ein|eine|el|los|las)\s+/;

function norm(s) {
  let t = stripMarks(s).toLowerCase();
  t = t.replace(/[\p{P}\p{S}]+/gu, ' ').replace(/\s+/g, ' ').trim();
  for (let i = 0; i < 2; i++) t = t.replace(LEADING, '');
  return t;
}
const squash = (s) => norm(s).replace(/\s+/g, '');
const translitKey = (s) => squash(s).replace(/kh|ch/g, 'h').replace(/tz/g, 'ts').replace(/(.)\1+/g, '$1');

/** Split a meaning like "strength, valor; wealth (rare)" into accepted alternatives. */
function alternatives(text) {
  const noParen = String(text).replace(/\([^)]*\)/g, ' ');
  const parts = noParen.split(/[;,/]/).map((p) => p.trim()).filter(Boolean);
  return [noParen, ...parts];
}

function lev(a, b) {
  if (a === b) return 0;
  if (Math.abs(a.length - b.length) > 2) return 3;
  const m = a.length, n = b.length;
  let prev = Array.from({ length: n + 1 }, (_, j) => j);
  for (let i = 1; i <= m; i++) {
    const cur = [i];
    for (let j = 1; j <= n; j++) cur[j] = Math.min(prev[j] + 1, cur[j - 1] + 1, prev[j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1));
    prev = cur;
  }
  return prev[n];
}
function tolerance(len) { return len >= 8 ? 2 : len >= 4 ? 1 : 0; }

/** Compare input with candidate strings. Returns 'exact' | 'close' | null. */
function matchAny(input, candidates, keyFn = squash) {
  const k = keyFn(input);
  if (!k) return null;
  let best = null;
  for (const c of candidates) {
    const ck = keyFn(c);
    if (!ck) continue;
    if (ck === k) return 'exact';
    if (lev(k, ck) <= tolerance(ck.length)) best = 'close';
  }
  return best;
}

let toastTimer;
function toast(msg, ms = 2600) {
  const t = $('#toast');
  t.textContent = msg;
  t.classList.add('show');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => t.classList.remove('show'), ms);
}

/* ================= icons ================= */
const I = (p) => `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${p}</svg>`;
const ICON = {
  gear: I('<circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.7 1.7 0 0 0 .3 1.8l.1.1a2 2 0 1 1-2.8 2.8l-.1-.1a1.7 1.7 0 0 0-1.8-.3 1.7 1.7 0 0 0-1 1.5V21a2 2 0 1 1-4 0v-.1a1.7 1.7 0 0 0-1.1-1.5 1.7 1.7 0 0 0-1.8.3l-.1.1a2 2 0 1 1-2.8-2.8l.1-.1a1.7 1.7 0 0 0 .3-1.8 1.7 1.7 0 0 0-1.5-1H3a2 2 0 1 1 0-4h.1a1.7 1.7 0 0 0 1.5-1.1 1.7 1.7 0 0 0-.3-1.8l-.1-.1a2 2 0 1 1 2.8-2.8l.1.1a1.7 1.7 0 0 0 1.8.3H9a1.7 1.7 0 0 0 1-1.5V3a2 2 0 1 1 4 0v.1a1.7 1.7 0 0 0 1 1.5 1.7 1.7 0 0 0 1.8-.3l.1-.1a2 2 0 1 1 2.8 2.8l-.1.1a1.7 1.7 0 0 0-.3 1.8V9a1.7 1.7 0 0 0 1.5 1H21a2 2 0 1 1 0 4h-.1a1.7 1.7 0 0 0-1.5 1z"/>'),
  close: I('<path d="M18 6 6 18M6 6l12 12"/>'),
  back: I('<path d="M15 18l-6-6 6-6"/>'),
  next: I('<path d="M9 18l6-6-6-6"/>'),
  speak: I('<path d="M11 5 6 9H2v6h4l5 4V5z"/><path d="M15.5 8.5a5 5 0 0 1 0 7M19 5a10 10 0 0 1 0 14"/>'),
  check: I('<path d="M20 6 9 17l-5-5"/>'),
  x: I('<circle cx="12" cy="12" r="9"/><path d="m15 9-6 6M9 9l6 6"/>'),
  warn: I('<circle cx="12" cy="12" r="9"/><path d="M12 8v5M12 16h.01"/>'),
  file: I('<path d="M14 3H6a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V9z"/><path d="M14 3v6h6M12 18v-6M9 15l3-3 3 3"/>'),
  cloud: I('<path d="M17.5 19a4.5 4.5 0 1 0-1.4-8.8A6 6 0 0 0 4.3 12.5 3.5 3.5 0 0 0 6.5 19z"/><path d="M12 12v6M9.5 15.5 12 18l2.5-2.5"/>'),
  cards: I('<rect x="3" y="6" width="14" height="14" rx="2"/><path d="M7 3h12a2 2 0 0 1 2 2v12"/>'),
  list: I('<path d="M8 6h13M8 12h13M8 18h13M3 6h.01M3 12h.01M3 18h.01"/>'),
  choose: I('<rect x="3" y="4" width="18" height="6" rx="2"/><rect x="3" y="14" width="18" height="6" rx="2"/>'),
  pen: I('<path d="M12 20h9"/><path d="M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4z"/>'),
  target: I('<circle cx="12" cy="12" r="9"/><circle cx="12" cy="12" r="5"/><circle cx="12" cy="12" r="1"/>'),
  quote: I('<path d="M3 21c3 0 7-1 7-8V5H3v7h4c0 4-2 6-4 6zM14 21c3 0 7-1 7-8V5h-7v7h4c0 4-2 6-4 6z"/>'),
  layers: I('<path d="m12 2 10 5-10 5L2 7z"/><path d="m2 17 10 5 10-5M2 12l10 5 10-5"/>'),
  flame: I('<path d="M8.5 14.5A2.5 2.5 0 0 0 11 12c0-1.4-.5-2-1-3-1.1-2.1-.2-4 2-6 .5 2.5 2 4.9 4 6.5 2 1.6 3 3.5 3 5.5a7 7 0 1 1-14 0c0-1.2.4-2.3 1-3.3.3 1.6 1.4 2.8 2.5 2.8z"/>'),
  shuffle: I('<path d="M16 3h5v5M4 20 21 3M21 16v5h-5M15 15l6 6M4 4l5 5"/>'),
  refresh: I('<path d="M21 12a9 9 0 1 1-3-6.7L21 8"/><path d="M21 3v5h-5"/>'),
};

/* ================= list parsing ================= */
function parseDelimited(text) {
  const lines = text.replace(/^﻿/, '').split(/\r?\n/).filter((l) => l.trim() && !/^\s*#/.test(l));
  if (!lines.length) return [];
  const first = lines[0];
  const delim = first.includes('\t') ? '\t' : (first.split(';').length > first.split(',').length ? ';' : ',');
  const rows = [];
  for (const line of lines) {
    const row = []; let cur = ''; let q = false;
    for (let i = 0; i < line.length; i++) {
      const c = line[i];
      if (q) {
        if (c === '"' && line[i + 1] === '"') { cur += '"'; i++; }
        else if (c === '"') q = false;
        else cur += c;
      } else if (c === '"' && cur === '') q = true;
      else if (c === delim) { row.push(cur.trim()); cur = ''; }
      else cur += c;
    }
    row.push(cur.trim());
    rows.push(row);
  }
  return rows;
}

function listFromTable(rows, filename) {
  const header = rows[0].map((h) => h.trim());
  const senses = [];
  const cols = header.map((h) => {
    const low = h.toLowerCase();
    const m = /^(meaning|translation)\s*[:(]\s*([^)]+?)\s*\)?$/i.exec(h);
    if (m) { const s = { id: slug(m[2]), label: m[2] }; senses.push(s); return { meaning: s.id }; }
    if (low === 'meaning' || low === 'translation') { senses.push({ id: 'main', label: '' }); return { meaning: 'main' }; }
    const field = { word: 'term', term: 'term', translit: 'translit', transliteration: 'translit', form: 'form', pos: 'pos',
      note: 'note', notes: 'note', context: 'context', example: 'context', contexttranslation: 'contextTranslation',
      ref: 'ref', group: 'group', section: 'group' }[low.replace(/[\s_-]/g, '')];
    return field ? { field } : null;
  });
  if (!cols.some((c) => c && c.field === 'term') || !senses.length) {
    throw new Error('A CSV/TSV list needs a header row with a "term" column and a "meaning" (or "meaning:Label") column.');
  }
  const items = rows.slice(1).map((r) => {
    const it = { meaning: {} };
    cols.forEach((c, i) => {
      const v = (r[i] || '').trim();
      if (!c || !v) return;
      if (c.meaning) it.meaning[c.meaning] = v; else it[c.field] = v;
    });
    return it;
  });
  return { title: filename.replace(/\.[^.]+$/, ''), senses, items };
}

/** Parse a list file (JSON, CSV or TSV) into the normalized list shape. */
function parseList(text, filename) {
  let raw;
  const trimmed = text.replace(/^﻿/, '').trim();
  if (/\.json$/i.test(filename) || /^[[{]/.test(trimmed)) {
    try { raw = JSON.parse(trimmed); } catch (e) { throw new Error(`${filename}: not valid JSON (${e.message})`); }
    if (Array.isArray(raw)) raw = { items: raw };
  } else {
    raw = listFromTable(parseDelimited(trimmed), filename);
  }
  if (!raw || !Array.isArray(raw.items) || !raw.items.length) throw new Error(`${filename}: no "items" found.`);

  const base = filename.split('/').pop().replace(/\.[^.]+$/, '');
  let senses = Array.isArray(raw.senses) && raw.senses.length
    ? raw.senses.map((s) => (typeof s === 'string' ? { id: slug(s), label: s } : { id: String(s.id ?? slug(s.label)), label: String(s.label ?? s.id ?? '') }))
    : [{ id: 'main', label: '' }];
  const side = (o, fallback) => {
    o = typeof o === 'string' ? { name: o } : (o || {});
    return { name: String(o.name || fallback), lang: String(o.lang || ''), font: o.font ? String(o.font).replace(/[^\w ]/g, '') : '' };
  };
  const list = {
    id: slug(raw.id || base),
    title: String(raw.title || base),
    description: String(raw.description || ''),
    from: side(raw.from, 'Term'),
    to: side(raw.to, 'Meaning'),
    senses,
    source: raw.source ? String(raw.source) : '',
    items: [],
  };
  const seen = new Map();
  raw.items.forEach((r, idx) => {
    if (!r || !r.term) throw new Error(`${filename}: item ${idx + 1} has no "term".`);
    let meaning = r.meaning ?? r.translation;
    if (meaning == null || meaning === '') throw new Error(`${filename}: "${r.term}" has no "meaning".`);
    if (typeof meaning !== 'object') meaning = { [senses[0].id]: String(meaning) };
    const m = {};
    for (const [k, v] of Object.entries(meaning)) if (v != null && String(v).trim()) m[k] = String(v);
    for (const k of Object.keys(m)) if (!senses.some((s) => s.id === k)) senses.push({ id: k, label: k });
    let key = String(r.id || stripMarks(r.term).trim());
    const n = (seen.get(key) || 0) + 1; seen.set(key, n);
    if (n > 1) key += '#' + n;
    list.items.push({
      key,
      term: String(r.term),
      translit: r.translit ? String(r.translit) : '',
      form: r.form ? String(r.form) : '',
      alts: Array.isArray(r.alts) ? r.alts.map(String) : [],
      pos: r.pos ? String(r.pos) : '',
      meaning: m,
      note: r.note ? String(r.note) : '',
      context: r.context ? String(r.context) : '',
      contextTranslation: r.contextTranslation ? String(r.contextTranslation) : '',
      ref: r.ref ? String(r.ref) : '',
      group: r.group != null ? String(r.group) : '',
    });
  });
  // drop senses that no item uses
  list.senses = senses.filter((s) => list.items.some((it) => it.meaning[s.id] != null));
  return list;
}

function addList(list, sourceInfo) {
  const isNew = !lists[list.id];
  list.loadedFrom = sourceInfo;
  list.loadedAt = Date.now();
  lists[list.id] = list;
  if (isNew && !ui.selected.includes(list.id)) ui.selected.push(list.id);
  saveLists(); saveUI();
  return isNew;
}

/* ================= model helpers ================= */
const selectedLists = () => ui.selected.map((id) => lists[id]).filter(Boolean);
const entryOf = (list, item) => ({ list, item, pkey: list.id + '::' + item.key });
const meaningOf = (e, sid) => e.item.meaning[sid] ?? e.item.meaning[e.list.senses[0]?.id] ?? Object.values(e.item.meaning)[0];
const senseLabel = (list, sid) => (list.senses.find((s) => s.id === sid) || {}).label || '';
const primaryMeaning = (e) => { const s = currentSense(); return meaningOf(e, s !== '*' && e.list.senses.some((x) => x.id === s) ? s : e.list.senses[0].id); };

/** Sense ids whose meanings are explicitly given and differ from each other. */
function distinctSenses(e) {
  const out = []; const keys = new Set();
  for (const s of e.list.senses) {
    const m = e.item.meaning[s.id];
    if (m == null) continue;
    const k = squash(m);
    if (!keys.has(k)) { keys.add(k); out.push(s.id); }
  }
  return out;
}

function allGroups(list) {
  const g = [];
  for (const it of list.items) if (it.group && !g.includes(it.group)) g.push(it.group);
  return g;
}

function pool(opts = {}) {
  const diffOnly = opts.diffOnly ?? ui.diffOnly;
  let out = [];
  for (const list of selectedLists()) {
    const gs = ui.groups[list.id];
    for (const it of list.items) if (!gs || !gs.length || gs.includes(it.group)) out.push(entryOf(list, it));
  }
  if (diffOnly && senseOptions().length > 1) out = out.filter((e) => distinctSenses(e).length > 1);
  return out;
}

/** Sense choices across the selected lists (union by id). */
function senseOptions() {
  const out = [];
  for (const l of selectedLists()) for (const s of l.senses) if (!out.some((o) => o.id === s.id)) out.push(s);
  return out;
}
function currentSense() {
  const opts = senseOptions();
  if (ui.sense === '*' && opts.length > 1) return '*';
  if (opts.some((o) => o.id === ui.sense)) return ui.sense;
  return opts[0] ? opts[0].id : '*';
}
/** Which sense a question about entry e should use. */
function resolveSense(e, dir) {
  const want = currentSense();
  if (want === '*') return dir === 'ab' ? '*' : pick(distinctSenses(e).length ? distinctSenses(e) : [e.list.senses[0].id]);
  return e.list.senses.some((s) => s.id === want) ? want : e.list.senses[0].id;
}

/* ---------- progress ---------- */
function pstate(e) { return progress[e.pkey] || (progress[e.pkey] = { s: {} }); }
function getStat(e, k) { const p = progress[e.pkey]; return p && p.s[k]; }
function statFor(e, k) { const p = pstate(e); return p.s[k] || (p.s[k] = { box: 0, right: 0, wrong: 0, last: 0 }); }
function record(e, k, correct, kind) {
  const st = statFor(e, k);
  const before = { ...st };
  if (correct) { st.right++; st.box = kind === 'choice' ? Math.max(st.box, Math.min(st.box + 1, 2)) : Math.min(st.box + 1, 5); }
  else { st.wrong++; st.box = 0; }
  st.last = Date.now();
  saveProgress();
  return before;
}
function totals(e) {
  const p = progress[e.pkey]; let right = 0, wrong = 0, box = 0;
  if (p) for (const st of Object.values(p.s)) { right += st.right; wrong += st.wrong; box = Math.max(box, st.box); }
  return { right, wrong, box, seen: !!(p && p.seen) };
}
const isMastered = (e) => totals(e).box >= 3;
const hardness = (e) => { const t = totals(e); return t.wrong * 2 - t.right; };

/* ---------- display ---------- */
const fontsLoaded = new Set();
function ensureFont(list) {
  const f = list.from.font;
  if (!f || fontsLoaded.has(f)) return;
  fontsLoaded.add(f);
  const link = document.createElement('link');
  link.rel = 'stylesheet';
  link.href = `https://fonts.googleapis.com/css2?family=${encodeURIComponent(f).replace(/%20/g, '+')}:wght@400;600&display=swap`;
  document.head.appendChild(link);
}
const fontStyle = (list) => (list.from.font ? ` style="font-family:'${list.from.font}',var(--font-serif)"` : '');
const dispTerm = (s) => (settings.hideMarks ? stripMarks(s) : s);
function termHTML(list, text, cls = '') {
  return `<span class="term ${cls}" lang="${esc(list.from.lang)}" dir="auto"${fontStyle(list)}>${esc(dispTerm(text))}</span>`;
}
function meaningHTML(list, text) {
  return `<span lang="${esc(list.to.lang)}" dir="auto">${esc(text)}</span>`;
}
function contextHTML(list, ctx, gap = false) {
  const html = esc(dispTerm(ctx)).replace(/\[([^\]]*)\]/g, (_, w) => (gap ? '<span class="gap">&nbsp;</span>' : `<mark>${w}</mark>`));
  return `<div class="context-text" lang="${esc(list.from.lang)}" dir="auto"${fontStyle(list)}>${html}</div>`;
}
const contextTarget = (ctx) => { const m = /\[([^\]]*)\]/.exec(ctx || ''); return m ? m[1] : ''; };
const canSpeak = 'speechSynthesis' in window;
function speakBtn(list, text, cls = 'speak') {
  if (!canSpeak || !list.from.lang) return '';
  return `<button class="icon-btn ${cls}" data-action="speak" data-text="${esc(text)}" data-lang="${esc(list.from.lang)}" aria-label="Listen">${ICON.speak}</button>`;
}
function speak(text, lang) {
  if (!canSpeak) return;
  try {
    speechSynthesis.cancel();
    const u = new SpeechSynthesisUtterance(String(text).replace(/[[\]]/g, ''));
    u.lang = lang;
    const base = lang.split('-')[0].toLowerCase();
    const v = speechSynthesis.getVoices().find((x) => x.lang.toLowerCase().replace('_', '-').startsWith(base));
    if (v) u.voice = v; else if (speechSynthesis.getVoices().length) toast(`No ${lang} voice installed on this device.`);
    u.rate = 0.85;
    speechSynthesis.speak(u);
  } catch (_) { /* ignore */ }
}

/** Full info block for a word: senses, note, context. */
function detailHTML(e, askedSense) {
  const { list, item } = e;
  const ds = distinctSenses(e);
  let senses;
  if (list.senses.length <= 1 || ds.length <= 1) {
    const label = list.senses.length > 1 ? `<dt>${esc(list.senses.map((s) => s.label).join(' · '))}</dt>` : '';
    senses = `<dl class="senses ${label ? '' : 'single'}">${label}<dd>${meaningHTML(list, meaningOf(e, list.senses[0].id))}</dd></dl>`;
  } else {
    senses = `<dl class="senses">${list.senses.map((s) => {
      const m = item.meaning[s.id] ?? meaningOf(e, list.senses[0].id);
      const same = item.meaning[s.id] == null;
      return `<dt class="${askedSense === s.id ? 'asked' : ''}">${esc(s.label)}</dt><dd>${same ? '<span class="muted">same</span>' : meaningHTML(list, m)}</dd>`;
    }).join('')}</dl>`;
  }
  const form = item.form && squash(item.form) !== squash(item.term)
    ? `<div class="d-form">in the text: ${termHTML(list, item.form)}</div>` : '';
  const ctx = item.context ? `<div class="d-context">${contextHTML(list, item.context)}
      ${item.contextTranslation ? `<div class="ctx-tr" lang="${esc(list.to.lang)}">${esc(item.contextTranslation)}</div>` : ''}
      ${item.ref ? `<div class="ctx-ref">${esc(item.ref)}</div>` : ''}</div>` : '';
  return `<div class="detail">
    <div class="d-head">${termHTML(list, item.term)}${settings.showTranslit && item.translit ? `<span class="translit">${esc(item.translit)}</span>` : ''}${item.pos ? `<span class="pos">${esc(item.pos)}</span>` : ''}${speakBtn(list, item.term, '')}</div>
    ${form}${senses}
    ${item.note ? `<div class="d-note">${esc(item.note)}</div>` : ''}
    ${ctx}
  </div>`;
}

/* ================= questions ================= */
function sameListEntries(e) { return e.list.items.filter((it) => it !== e.item).map((it) => entryOf(e.list, it)); }

/** Build up to n distractor strings, preferring the same part of speech. */
function distractors(e, textOf, correct, n = 3, extra = []) {
  const used = new Set([squash(correct)]);
  const out = [];
  for (const t of extra) { const k = squash(t); if (t && !used.has(k)) { used.add(k); out.push(t); } }
  const cands = shuffle(sameListEntries(e));
  cands.sort((a, b) => (b.item.pos === e.item.pos) - (a.item.pos === e.item.pos));
  for (const c of cands) {
    if (out.length >= n) break;
    const t = textOf(c);
    const k = t && squash(t);
    if (!t || used.has(k)) continue;
    used.add(k); out.push(t);
  }
  return out.slice(0, n);
}

function makeQuestion(e, type, dir) {
  const q = { e, type, dir, state: 'asking' };
  const { list, item } = e;
  if (type === 'choice' || type === 'write') {
    q.sense = resolveSense(e, dir);
    q.statKey = `${dir}:${q.sense}`;
    if (type === 'choice') {
      const msid = q.sense === '*' ? list.senses[0].id : q.sense;
      if (dir === 'ab') {
        const correct = meaningOf(e, msid);
        q.options = shuffle([{ text: correct, ok: true }, ...distractors(e, (c) => meaningOf(c, msid), correct).map((t) => ({ text: t }))]);
        q.optKind = 'meaning';
      } else {
        q.options = shuffle([{ text: item.term, ok: true }, ...distractors(e, (c) => c.item.term, item.term).map((t) => ({ text: t }))]);
        q.optKind = 'term';
      }
    }
  } else if (type === 'ctx-gap') {
    q.statKey = 'ctx:gap';
    const target = contextTarget(item.context);
    const others = distractors(e, (c) => contextTarget(c.item.context), target);
    q.options = shuffle([{ text: target, ok: true }, ...others.map((t) => ({ text: t }))]);
    q.optKind = 'term';
  } else if (type === 'ctx-meaning') {
    q.sense = resolveSense(e, 'ab');
    const msid = q.sense === '*' ? list.senses[0].id : q.sense;
    q.statKey = `ctx:${msid}`;
    const correct = meaningOf(e, msid);
    q.options = shuffle([{ text: correct, ok: true }, ...distractors(e, (c) => meaningOf(c, msid), correct).map((t) => ({ text: t }))]);
    q.optKind = 'meaning';
  } else if (type === 'sense-which') {
    const ds = distinctSenses(e);
    q.sense = pick(ds);
    q.statKey = 'sx:which';
    q.shown = item.meaning[q.sense];
    // every sense whose meaning equals the shown one is also correct
    q.options = list.senses.map((s) => ({ text: s.label, sid: s.id, ok: squash(meaningOf(e, s.id)) === squash(q.shown) }));
    q.optKind = 'label';
  } else if (type === 'sense-pick') {
    const ds = distinctSenses(e);
    q.sense = pick(ds);
    q.statKey = 'sx:pick';
    const correct = item.meaning[q.sense];
    const traps = ds.filter((s) => s !== q.sense).map((s) => item.meaning[s]);
    q.options = shuffle([{ text: correct, ok: true }, ...distractors(e, (c) => meaningOf(c, q.sense), correct, 3, traps).map((t) => ({ text: t }))]);
    q.optKind = 'meaning';
  }
  if (q.options && q.options.length < 2) { q.type = 'write'; delete q.options; q.dir = dir || 'ab'; q.sense = resolveSense(e, q.dir); q.statKey = `${q.dir}:${q.sense}`; }
  return q;
}

/** Grade a typed answer. */
function gradeWrite(q, input) {
  const { e } = q;
  const { item, list } = e;
  if (q.dir === 'ab') {
    const sids = q.sense === '*' ? list.senses.map((s) => s.id) : [q.sense];
    const cands = sids.flatMap((s) => alternatives(meaningOf(e, s)));
    const m = matchAny(input, cands);
    if (m) return m;
    if (q.sense !== '*') {
      const target = squash(meaningOf(e, q.sense));
      for (const s of distinctSenses(e)) {
        if (s === q.sense || squash(item.meaning[s]) === target) continue;
        if (matchAny(input, alternatives(item.meaning[s]))) return { other: s };
      }
    }
    return null;
  }
  const terms = [item.term, item.form, ...item.alts].filter(Boolean);
  const m = matchAny(input, terms);
  if (m) return m;
  if (settings.acceptTranslit && item.translit) return matchAny(input, [item.translit], translitKey);
  return null;
}

/* ================= sessions ================= */
let screen = { name: 'home' };
let session = null;
let autoTimer = null;
const AUTO_MS = 1600;

const MODES = {
  discover: { title: 'Discover', desc: 'Get to know the words: cards or the whole list.', icon: 'cards' },
  choice: { title: 'Choose', desc: 'Multiple choice. The easy way in.', icon: 'choose' },
  write: { title: 'Write', desc: 'Type the full answer.', icon: 'pen' },
  train: { title: 'Train', desc: 'Adaptive: missed words come back more often. Starts with choices, moves to typing.', icon: 'target' },
  context: { title: 'In context', desc: 'Find the word in its original sentence.', icon: 'quote' },
  senses: { title: 'Senses', desc: 'Tell the different senses of a word apart.', icon: 'layers' },
  hard: { title: 'Hard words', desc: 'Your most-missed words.', icon: 'flame' },
};

function entriesForMode(mode, entries) {
  if (mode === 'context') return entries.filter((e) => contextTarget(e.item.context));
  if (mode === 'senses') return entries.filter((e) => distinctSenses(e).length > 1);
  return entries;
}
function modeAvailable(mode, entries) {
  const ok = entriesForMode(mode, entries);
  if (mode === 'senses') return ok.length > 0;
  if (mode === 'context') return ok.length > 1;
  return entries.length > 0;
}

function startSession(mode, opts = {}) {
  const entries = entriesForMode(mode, opts.entries || pool());
  if (!entries.length) { toast('No words for this mode with the current selection.'); return; }
  entries.forEach((e) => ensureFont(e.list));
  const len = settings.sessionLength || entries.length;
  const n = mode === 'train' ? Math.max(len, Math.min(entries.length, 10)) : Math.min(len, entries.length);
  session = {
    mode, entries, n, idx: 0, results: [], recent: [], requeue: [], newCount: 0,
    queue: mode === 'train' ? null : shuffle(entries).slice(0, n),
    label: opts.label || MODES[mode].title,
    opts,
  };
  nextQuestion();
}

const randDir = () => (ui.dir === 'mix' ? pick(['ab', 'ba']) : ui.dir);
const BOX_W = [16, 8, 4, 2, 1, 0.5];

function pickTrain(s) {
  if (s.requeue.length && s.requeue[0].due <= s.idx) return s.requeue.shift();
  const now = Date.now();
  const cands = [];
  for (const e of s.entries) {
    if (s.recent.includes(e.pkey) && s.entries.length > 3) continue;
    const dir = randDir();
    const sense = resolveSense(e, dir);
    const st = getStat(e, `${dir}:${sense}`);
    let w;
    if (!st) {
      const seen = totals(e).seen || totals(e).right > 0;
      w = seen ? 6 : (s.newCount < 8 ? 3 : 0.05);
    } else {
      const days = (now - st.last) / 864e5;
      w = BOX_W[st.box] * (1 + 0.5 * Math.min(st.wrong, 6)) * (1 + days / 2 ** st.box);
    }
    cands.push({ e, dir, w, st });
  }
  if (!cands.length) return { e: pick(s.entries), dir: randDir() };
  let r = Math.random() * cands.reduce((a, c) => a + c.w, 0);
  for (const c of cands) { r -= c.w; if (r <= 0) return c; }
  return cands[cands.length - 1];
}

function nextQuestion() {
  clearTimeout(autoTimer);
  const s = session;
  s.autoPending = false;
  if (s.idx >= s.n) { screen = { name: 'summary' }; render(); return; }
  let q;
  if (s.mode === 'train') {
    const c = pickTrain(s);
    const st = getStat(c.e, `${c.dir}:${resolveSense(c.e, c.dir)}`);
    if (!st && !totals(c.e).seen) s.newCount++;
    q = makeQuestion(c.e, (st ? st.box : 0) >= 2 ? 'write' : 'choice', c.dir);
  } else {
    const e = s.queue[s.idx];
    if (s.mode === 'choice') q = makeQuestion(e, 'choice', randDir());
    else if (s.mode === 'write') q = makeQuestion(e, 'write', randDir());
    else if (s.mode === 'context') q = makeQuestion(e, Math.random() < 0.5 ? 'ctx-gap' : 'ctx-meaning', 'ab');
    else if (s.mode === 'senses') q = makeQuestion(e, Math.random() < 0.5 ? 'sense-which' : 'sense-pick', 'ab');
  }
  s.recent = [q.e.pkey, ...s.recent].slice(0, 3);
  s.q = q;
  screen = { name: 'session' };
  render();
  if (settings.autoSpeak && (q.dir === 'ab' || q.type.startsWith('sense'))) speak(q.e.item.term, q.e.list.from.lang);
}

function finishQuestion(correct, how) {
  const s = session; const q = s.q;
  q.state = 'done';
  q.correct = correct;
  q.how = how;
  q.before = record(q.e, q.statKey, correct, q.type === 'write' ? 'write' : 'choice');
  s.results.push({ e: q.e, correct });
  if (!correct && s.mode === 'train') s.requeue.push({ e: q.e, dir: q.dir, due: s.idx + 3 });
  s.idx++;
  render();
  if (correct && how !== 'close' && settings.autoNext) {
    s.autoPending = true;
    render();
    autoTimer = setTimeout(() => { if (session && session.q === q && s.autoPending) nextQuestion(); }, AUTO_MS);
  }
}

function holdQuestion() {
  clearTimeout(autoTimer);
  if (!session || !session.autoPending) return;
  session.autoPending = false;
  render();
  const fb = document.querySelector('.feedback');
  if (fb) fb.scrollIntoView({ block: 'start', behavior: 'smooth' });
}

function overrideCorrect() {
  const s = session; const q = s.q;
  if (!q || q.state !== 'done' || q.correct) return;
  const st = statFor(q.e, q.statKey);
  Object.assign(st, q.before);
  record(q.e, q.statKey, true, q.type === 'write' ? 'write' : 'choice');
  s.results[s.results.length - 1].correct = true;
  s.requeue = s.requeue.filter((r) => r.e.pkey !== q.e.pkey);
  q.correct = true; q.how = 'override';
  render();
}

/* ================= rendering ================= */
function render() {
  const app = $('#app');
  const fn = { home: renderHome, session: renderSession, summary: renderSummary, discover: renderDiscover, hard: renderHard, settings: renderSettings, remote: renderRemote }[screen.name];
  app.innerHTML = fn();
  window.scrollTo(0, 0);
  afterRender();
}

function afterRender() {
  if (screen.name === 'session') {
    const q = session.q;
    if (q.state !== 'done') {
      const inp = $('#answer');
      if (inp) inp.focus({ preventScroll: true });
    } else {
      const nb = $('#next-btn');
      if (nb) nb.focus({ preventScroll: true });
    }
  }
}

function dirLabel(dir, lists_) {
  const l = lists_[0];
  const a = l ? l.from.name : 'Term', b = l ? l.to.name : 'Meaning';
  return { ab: `${a} → ${b}`, ba: `${b} → ${a}`, mix: 'Both ways' }[dir];
}

function renderHome() {
  const all = Object.values(lists).sort((a, b) => a.title.localeCompare(b.title));
  const sel = selectedLists();
  sel.forEach(ensureFont);
  const p = pool();
  const ghReady = settings.gh.owner && settings.gh.repo;

  const listRows = all.length ? all.map((l) => {
    const es = l.items.map((it) => entryOf(l, it));
    const mastered = es.filter(isMastered).length;
    return `<label class="list-row">
      <input type="checkbox" data-change="toggle-list" value="${esc(l.id)}" ${ui.selected.includes(l.id) ? 'checked' : ''}>
      <div class="grow">
        <div class="list-title">${esc(l.title)}</div>
        <div class="list-meta">${l.items.length} words · ${esc(l.from.name)} → ${esc(l.to.name)}${l.senses.length > 1 ? ' · ' + l.senses.map((s) => esc(s.label)).join(' / ') : ''} · ${mastered} known</div>
        <div class="mini-meter"><span style="width:${(100 * mastered / l.items.length).toFixed(1)}%"></span></div>
      </div></label>`;
  }).join('') : `<div class="empty"><p><strong>No lists yet.</strong></p><p class="small">Open a list file from your phone (for example from a repository folder in the Files app), or connect a GitHub repository in Settings.</p></div>`;

  // groups
  let groupsHTML = '';
  for (const l of sel) {
    const gs = allGroups(l);
    if (gs.length < 2) continue;
    const chosen = ui.groups[l.id] || [];
    groupsHTML += `<div class="field"><div class="field-label">${sel.length > 1 ? esc(l.title) + ' · ' : ''}Sections</div><div class="chips">
      <button class="chip" data-action="group-all" data-list="${esc(l.id)}" aria-pressed="${!chosen.length}">All</button>
      ${gs.map((g) => `<button class="chip" data-action="group" data-list="${esc(l.id)}" data-group="${esc(g)}" aria-pressed="${chosen.includes(g)}">${esc(g)}</button>`).join('')}
    </div></div>`;
  }

  const senses = senseOptions();
  const cur = currentSense();
  const senseHTML = senses.length > 1 ? `<div class="field"><div class="field-label">Sense</div><div class="seg">
      ${senses.map((s) => `<button data-action="sense" data-sense="${esc(s.id)}" aria-pressed="${cur === s.id}">${esc(s.label || s.id)}</button>`).join('')}
      <button data-action="sense" data-sense="*" aria-pressed="${cur === '*'}">Any</button></div>
      <label class="toggle small"><input type="checkbox" data-change="diff-only" ${ui.diffOnly ? 'checked' : ''}> Only words whose senses differ</label></div>` : '';

  const modeBtn = (m, featured) => {
    const ok = sel.length && modeAvailable(m, p);
    return `<button class="mode ${featured ? 'featured' : ''}" data-action="mode" data-mode="${m}" ${ok ? '' : 'disabled'}>
      <span class="m-title">${ICON[MODES[m].icon]}${MODES[m].title}</span><span class="m-desc">${MODES[m].desc}</span></button>`;
  };
  const showContext = sel.some((l) => l.items.some((it) => contextTarget(it.context)));
  const showSenses = senses.length > 1;

  return `
  <header class="bar"><h1>Vocab</h1>
    <button class="icon-btn" data-action="go" data-to="settings" aria-label="Settings">${ICON.gear}</button></header>

  <section class="section">
    <h2 class="section-title">Lists</h2>
    <div class="card lists">${listRows}</div>
    <div class="btn-row">
      <label class="btn file-btn">${ICON.file}Open file<input type="file" multiple data-change="files"></label>
      ${ghReady ? `<button class="btn" data-action="go" data-to="remote">${ICON.cloud}From GitHub</button>` : `<button class="btn ghost" data-action="go" data-to="settings">Connect GitHub…</button>`}
    </div>
  </section>

  ${sel.length ? `<section class="section">
    <h2 class="section-title">Study</h2>
    ${groupsHTML}
    <div class="field"><div class="field-label">Direction</div><div class="seg">
      ${['ab', 'ba', 'mix'].map((d) => `<button data-action="dir" data-dir="${d}" aria-pressed="${ui.dir === d}">${esc(dirLabel(d, sel))}</button>`).join('')}
    </div></div>
    ${senseHTML}
    <div class="modes">
      ${modeBtn('train', true)}
      ${modeBtn('discover')}${modeBtn('choice')}${modeBtn('write')}
      ${showContext ? modeBtn('context') : ''}${showSenses ? modeBtn('senses') : ''}
      ${modeBtn('hard')}
    </div>
    <p class="selection-note">${p.length} word${p.length === 1 ? '' : 's'} selected · ${p.filter(isMastered).length} known</p>
  </section>` : ''}`;
}

function promptLabel(q) {
  const l = q.e.list;
  const sl = q.sense && q.sense !== '*' && l.senses.length > 1 ? ' · ' + senseLabel(l, q.sense) : '';
  switch (q.type) {
    case 'choice': case 'write': return esc((q.dir === 'ab' ? `${l.from.name} → ${l.to.name}` : `${l.to.name} → ${l.from.name}`) + sl);
    case 'ctx-gap': return 'Which word fills the gap?';
    case 'ctx-meaning': return esc('What does the marked word mean here?' + sl);
    case 'sense-which': return 'Which sense is this?';
    case 'sense-pick': return esc(`The ${senseLabel(l, q.sense)} sense`);
  }
  return '';
}

function promptHTML(q) {
  const { list, item } = q.e;
  const tl = settings.showTranslit && item.translit ? `<div class="sub">${esc(item.translit)}</div>` : '';
  switch (q.type) {
    case 'choice': case 'write':
      if (q.dir === 'ab') return `${speakBtn(list, item.term)}<div class="big">${termHTML(list, item.term)}</div>${tl}`;
      return `<div class="big meaning-text">${meaningHTML(list, meaningOf(q.e, q.sense))}</div>${item.pos ? `<div class="sub">${esc(item.pos)}</div>` : ''}`;
    case 'ctx-gap':
      return `${contextHTML(list, item.context, true)}${item.contextTranslation ? `<div class="question-line">${esc(item.contextTranslation)}</div>` : ''}`;
    case 'ctx-meaning':
      return `${contextHTML(list, item.context)}${item.ref ? `<div class="question-line small">${esc(item.ref)}</div>` : ''}`;
    case 'sense-which':
      return `${speakBtn(list, item.term)}<div class="big">${termHTML(list, item.term)}</div>${tl}<div class="question-line">means <strong>${meaningHTML(list, q.shown)}</strong></div>`;
    case 'sense-pick':
      return `${speakBtn(list, item.term)}<div class="big">${termHTML(list, item.term)}</div>${tl}<div class="question-line">In the <strong>${esc(senseLabel(list, q.sense))}</strong> sense, it means…</div>`;
  }
  return '';
}

function optionHTML(q, o, i) {
  const l = q.e.list;
  let cls = 'choice';
  if (q.state === 'done') { if (o.ok) cls += ' correct'; else if (q.picked === i) cls += ' wrong'; }
  const body = q.optKind === 'term' ? termHTML(l, o.text) : q.optKind === 'label' ? esc(o.text) : meaningHTML(l, o.text);
  return `<button class="${cls}" data-action="pick" data-i="${i}" ${q.state === 'done' ? 'disabled' : ''}>${body}</button>`;
}

function renderSession() {
  const s = session; const q = s.q; const l = q.e.list;
  const progressPct = (100 * s.idx / s.n).toFixed(1);
  let answer = '';
  if (q.options) {
    answer = `<div class="choices">${q.options.map((o, i) => optionHTML(q, o, i)).join('')}</div>`;
  } else {
    const isTerm = q.dir === 'ba';
    answer = `<form class="write" data-submit="answer" autocomplete="off">
      <input id="answer" class="${isTerm ? 'term' : ''}" ${isTerm ? `lang="${esc(l.from.lang)}"${fontStyle(l)}` : `lang="${esc(l.to.lang)}"`} dir="auto"
        autocomplete="off" autocorrect="off" autocapitalize="off" spellcheck="false" enterkeyhint="go"
        placeholder="${esc(isTerm ? `Type in ${l.from.name}` : `Type in ${l.to.name}`)}" value="${esc(q.input || '')}" ${q.state === 'done' ? 'readonly' : ''}>
      ${q.state === 'retry' ? `<div class="feedback warn"><div class="fb-head">${ICON.warn}That's the ${esc(senseLabel(l, q.other))} sense.</div><div class="small">What does it mean in the ${esc(senseLabel(l, q.sense))} sense? One more try.</div></div>` : ''}
    </form>`;
  }

  let fb = '';
  if (q.state === 'done') {
    const head = q.correct
      ? (q.how === 'close' ? `${ICON.check}Almost — watch the spelling` : q.how === 'override' ? `${ICON.check}Counted as correct` : `${ICON.check}Correct`)
      : `${ICON.x}${q.how === 'skip' ? 'Here it is' : 'Not quite'}`;
    const cls = q.correct ? (q.how === 'close' ? 'warn' : 'good') : 'bad';
    const yours = q.type === 'write' && q.input && !q.correct ? `<div class="fb-yours">You wrote: <s>${esc(q.input)}</s></div>` : '';
    const override = q.type === 'write' && !q.correct && q.how !== 'skip' ? ` <button class="linkish" data-action="override">I was right</button>` : '';
    const askedSense = q.sense && q.sense !== '*' ? q.sense : null;
    fb = `<div class="feedback ${cls}"><div class="fb-head">${head}</div>${yours}${override ? `<div class="small" style="margin-top:4px">Typo or synonym?${override}</div>` : ''}${detailHTML(q.e, askedSense)}</div>`;
  }

  let bar;
  if (q.state === 'done' && s.autoPending) bar = `<button class="btn" data-action="hold">Stay</button><button id="next-btn" class="btn primary auto" data-action="next" style="--dur:${AUTO_MS}ms"><span>${s.idx >= s.n ? 'See results' : 'Next'}</span></button>`;
  else if (q.state === 'done') bar = `<button id="next-btn" class="btn primary" data-action="next">${s.idx >= s.n ? 'See results' : 'Next'}</button>`;
  else if (!q.options) bar = `<button class="btn" data-action="skip">Show answer</button><button class="btn primary" data-action="check">Check</button>`;
  else bar = `<button class="btn" data-action="skip">Show answer</button>`;

  return `
  <header class="bar">
    <button class="icon-btn" data-action="quit" aria-label="Stop">${ICON.close}</button>
    <div class="meter"><span style="width:${progressPct}%"></span></div>
    <span class="count">${Math.min(s.idx + (q.state === 'done' ? 0 : 1), s.n)}/${s.n}</span>
  </header>
  <div class="q-label">${esc(s.label)} · ${promptLabel(q)}</div>
  <div class="card prompt">${promptHTML(q)}</div>
  ${answer}
  ${fb}
  <div class="actionbar"><div class="inner">${bar}</div></div>`;
}

function renderSummary() {
  const s = session;
  const right = s.results.filter((r) => r.correct).length;
  const byKey = new Map();
  for (const r of s.results) {
    const cur = byKey.get(r.e.pkey) || { e: r.e, miss: 0 };
    if (!r.correct) cur.miss++;
    byKey.set(r.e.pkey, cur);
  }
  const missed = [...byKey.values()].filter((x) => x.miss);
  return `
  <header class="bar"><h2>${esc(s.label)}</h2><button class="icon-btn" data-action="home" aria-label="Close">${ICON.close}</button></header>
  <div class="score-big">${right}/${s.results.length}</div>
  <div class="score-sub">${missed.length ? `${missed.length} word${missed.length > 1 ? 's' : ''} to review` : 'Nothing missed. Well done.'}</div>
  ${missed.length ? `<section class="section"><h2 class="section-title">Missed</h2><div class="card">
    ${missed.map(({ e }) => `<div class="missed-row">${termHTML(e.list, e.item.term)}<span class="m">${meaningHTML(e.list, primaryMeaning(e))}</span></div>`).join('')}
  </div></section>` : ''}
  <div class="actionbar"><div class="inner">
    ${missed.length ? `<button class="btn" data-action="retry-missed">Practice these</button>` : ''}
    <button class="btn primary" data-action="again">Go again</button>
  </div></div>`;
}

function renderDiscover() {
  const d = screen;
  const entries = d.entries;
  const viewSeg = `<div class="seg" style="margin-bottom:12px">
    <button data-action="disc-view" data-view="cards" aria-pressed="${d.view === 'cards'}">Cards</button>
    <button data-action="disc-view" data-view="list" aria-pressed="${d.view === 'list'}">List</button></div>`;
  const header = `<header class="bar"><button class="icon-btn" data-action="home" aria-label="Back">${ICON.back}</button><h2>Discover</h2>
    <button class="icon-btn" data-action="disc-shuffle" aria-label="Shuffle">${ICON.shuffle}</button></header>`;
  if (d.view === 'list') {
    const rows = entries.map((e) => {
      const ds = distinctSenses(e);
      const m = e.list.senses.length > 1 && ds.length > 1
        ? ds.map((sid) => `<div><span class="sl">${esc(senseLabel(e.list, sid))}</span>${meaningHTML(e.list, e.item.meaning[sid])}</div>`).join('')
        : meaningHTML(e.list, meaningOf(e, e.list.senses[0].id));
      return `<tr><td>${termHTML(e.list, e.item.term)}${settings.showTranslit && e.item.translit ? `<div class="tl">${esc(e.item.translit)}</div>` : ''}</td><td>${m}</td></tr>`;
    }).join('');
    return `${header}${viewSeg}<div class="card"><table class="word-table">${rows}</table></div>`;
  }
  const e = entries[d.idx];
  const { list, item } = e;
  const body = d.revealed
    ? detailHTML(e, null)
    : `<div class="center">${speakBtn(list, item.term, '')}<div class="term-wrap">${termHTML(list, item.term)}</div>
        ${settings.showTranslit && item.translit ? `<div class="translit">${esc(item.translit)}</div>` : ''}
        ${item.context ? `<div style="margin-top:18px">${contextHTML(list, item.context)}</div>` : ''}
        <button class="btn reveal-btn" data-action="reveal">Show meaning</button></div>`;
  return `${header}${viewSeg}
    <div class="q-label">${d.idx + 1} / ${entries.length}</div>
    <div class="card disc-card">${body}</div>
    <div class="actionbar"><div class="inner">
      <button class="btn" data-action="disc-prev" ${d.idx === 0 ? 'disabled' : ''}>${ICON.back}Back</button>
      <button class="btn primary" data-action="disc-next">${d.idx + 1 >= entries.length ? 'Done' : 'Next'}${ICON.next}</button>
    </div></div>`;
}

function renderHard() {
  const hard = pool({ diffOnly: false }).filter((e) => totals(e).wrong > 0).sort((a, b) => hardness(b) - hardness(a)).slice(0, 30);
  screen.entries = hard;
  return `<header class="bar"><button class="icon-btn" data-action="home" aria-label="Back">${ICON.back}</button><h2>Hard words</h2></header>
  ${hard.length ? `<div class="card">${hard.map((e) => {
    const t = totals(e);
    return `<div class="missed-row">${termHTML(e.list, e.item.term)}<span class="m">${meaningHTML(e.list, primaryMeaning(e))}</span><span class="stat-pill">✓${t.right} ✗${t.wrong}</span></div>`;
  }).join('')}</div>
  <div class="actionbar"><div class="inner"><button class="btn" data-action="hard-write">Write these</button><button class="btn primary" data-action="hard-train">Train these</button></div></div>`
    : `<div class="card empty"><p>No missed words yet in this selection.</p></div>`}`;
}

function renderSettings() {
  const g = settings.gh;
  const tog = (k, label) => `<label class="toggle"><input type="checkbox" data-change="setting" data-key="${k}" ${settings[k] ? 'checked' : ''}> ${label}</label>`;
  const all = Object.values(lists);
  return `<header class="bar"><button class="icon-btn" data-action="home" aria-label="Back">${ICON.back}</button><h2>Settings</h2></header>

  <section class="section"><h2 class="section-title">Practice</h2><div class="card pad">
    <div class="form-row"><label for="slen">Questions per session</label>
      <select id="slen" data-change="session-length">${[10, 20, 30, 50, 0].map((n) => `<option value="${n}" ${settings.sessionLength === n ? 'selected' : ''}>${n || 'All words'}</option>`).join('')}</select></div>
    ${tog('showTranslit', 'Show transliteration')}
    ${tog('acceptTranslit', 'Accept transliteration as a typed answer')}
    ${tog('hideMarks', 'Hide diacritics on terms (vowel points, accents)')}
    ${tog('autoSpeak', 'Read terms aloud automatically')}
    ${tog('autoNext', 'Move on automatically after a correct answer (tap “Stay” to keep a word open)')}
  </div></section>

  <section class="section"><h2 class="section-title">GitHub repository</h2><div class="card pad">
    <p class="help">Load lists straight from a repository, including a private one. Use a fine-grained personal access token with read-only “Contents” access to that repository only. The token is stored in this browser only.</p>
    <form data-submit="gh">
      <div class="form-row"><label for="gh-owner">Owner</label><input id="gh-owner" name="owner" value="${esc(g.owner)}" autocapitalize="off" autocorrect="off" spellcheck="false"></div>
      <div class="form-row"><label for="gh-repo">Repository</label><input id="gh-repo" name="repo" value="${esc(g.repo)}" autocapitalize="off" autocorrect="off" spellcheck="false"></div>
      <div class="form-row"><label for="gh-branch">Branch <span class="muted">(blank = default)</span></label><input id="gh-branch" name="branch" value="${esc(g.branch)}" autocapitalize="off" autocorrect="off" spellcheck="false"></div>
      <div class="form-row"><label for="gh-folder">Folder <span class="muted">(blank = whole repository)</span></label><input id="gh-folder" name="folder" value="${esc(g.folder)}" autocapitalize="off" autocorrect="off" spellcheck="false"></div>
      <div class="form-row"><label for="gh-token">Token <span class="muted">(blank for a public repository)</span></label><input id="gh-token" name="token" type="password" value="${esc(g.token)}" autocomplete="off"></div>
      <div class="btn-row"><button class="btn primary" type="submit">Save</button>${g.token ? '<button class="btn danger" type="button" data-action="gh-forget">Forget token</button>' : ''}</div>
    </form>
  </div></section>

  <section class="section"><h2 class="section-title">Lists on this device</h2><div class="card">
    ${all.length ? all.map((l) => `<div class="remote-row"><div class="grow"><div class="list-title">${esc(l.title)}</div><div class="list-meta">${l.items.length} words · ${l.loadedFrom && l.loadedFrom.kind === 'github' ? 'GitHub' : 'file'} · ${new Date(l.loadedAt).toLocaleDateString()}</div></div><button class="btn danger" data-action="remove-list" data-id="${esc(l.id)}">Remove</button></div>`).join('') : '<div class="empty">None.</div>'}
  </div></section>

  <section class="section"><h2 class="section-title">Progress</h2><div class="card pad">
    <p class="help">Progress is kept in this browser. Export it now and then as a backup, or to move it to another device.</p>
    <div class="btn-row">
      <button class="btn" data-action="export">Export</button>
      <label class="btn file-btn">Import<input type="file" data-change="import"></label>
      <button class="btn danger" data-action="reset">Reset</button>
    </div>
  </div></section>`;
}

function renderRemote() {
  const r = screen;
  let body;
  if (r.loading) body = `<div class="card empty">Loading…</div>`;
  else if (r.error) body = `<div class="card empty"><p>${esc(r.error)}</p><div class="btn-row"><button class="btn" data-action="remote-refresh">Try again</button><button class="btn ghost" data-action="go" data-to="settings">Settings</button></div></div>`;
  else if (!r.files.length) body = `<div class="card empty">No .json, .csv or .tsv files found${settings.gh.folder ? ' in that folder' : ''}.</div>`;
  else {
    const status = (f) => {
      const l = Object.values(lists).find((x) => x.loadedFrom && x.loadedFrom.kind === 'github' && x.loadedFrom.path === f.path);
      if (!l) return '<span class="badge new">new</span>';
      return l.loadedFrom.sha === f.sha ? '<span class="badge">loaded</span>' : '<span class="badge upd">update</span>';
    };
    body = `<div class="card">${r.files.map((f) => `<div class="remote-row"><div class="grow">${esc(f.path)}</div>${status(f)}<button class="btn" data-action="remote-load" data-path="${esc(f.path)}">Load</button></div>`).join('')}</div>
    <div class="actionbar"><div class="inner"><button class="btn primary" data-action="remote-all">Load / update all</button></div></div>`;
  }
  return `<header class="bar"><button class="icon-btn" data-action="home" aria-label="Back">${ICON.back}</button><h2>${esc(settings.gh.repo)}</h2>
    <button class="icon-btn" data-action="remote-refresh" aria-label="Refresh">${ICON.refresh}</button></header>${body}`;
}

/* ================= GitHub ================= */
async function ghFetch(path, raw = false) {
  const headers = { Accept: raw ? 'application/vnd.github.raw+json' : 'application/vnd.github+json' };
  if (settings.gh.token) headers.Authorization = 'Bearer ' + settings.gh.token;
  let res;
  try { res = await fetch('https://api.github.com' + path, { headers, cache: 'no-store' }); }
  catch (_) { throw new Error('Could not reach GitHub. Check your connection.'); }
  if (!res.ok) {
    if (res.status === 401) throw new Error('GitHub rejected the token (expired or mistyped?).');
    if (res.status === 404) throw new Error('Not found. Check owner, repository and branch, and that the token has access to this repository.');
    if (res.status === 403) throw new Error('GitHub refused the request (rate limit or missing permission).');
    throw new Error(`GitHub error ${res.status}.`);
  }
  return raw ? res.text() : res.json();
}
const repoPath = () => `/repos/${encodeURIComponent(settings.gh.owner.trim())}/${encodeURIComponent(settings.gh.repo.trim())}`;

async function loadRemoteIndex() {
  screen = { name: 'remote', loading: true, files: [] };
  render();
  try {
    let branch = settings.gh.branch.trim();
    if (!branch) branch = (await ghFetch(repoPath())).default_branch;
    const tree = await ghFetch(`${repoPath()}/git/trees/${encodeURIComponent(branch)}?recursive=1`);
    const folder = settings.gh.folder.trim().replace(/^\/+|\/+$/g, '');
    const files = tree.tree.filter((t) => t.type === 'blob' && /\.(json|csv|tsv)$/i.test(t.path) && (!folder || t.path.startsWith(folder + '/')))
      .map((t) => ({ path: t.path, sha: t.sha }));
    if (screen.name === 'remote') { screen = { name: 'remote', files, branch }; render(); }
  } catch (err) {
    if (screen.name === 'remote') { screen = { name: 'remote', error: err.message, files: [] }; render(); }
  }
}

async function loadRemoteFile(f, branch) {
  const text = await ghFetch(`${repoPath()}/contents/${f.path.split('/').map(encodeURIComponent).join('/')}?ref=${encodeURIComponent(branch)}`, true);
  const list = parseList(text, f.path);
  return addList(list, { kind: 'github', path: f.path, sha: f.sha });
}

/* ================= actions ================= */
const actions = {
  go(t) { if (t.dataset.to === 'remote') return loadRemoteIndex(); screen = { name: t.dataset.to }; render(); },
  home() { session = null; screen = { name: 'home' }; render(); },
  speak(t) { speak(t.dataset.text, t.dataset.lang); },
  dir(t) { ui.dir = t.dataset.dir; saveUI(); render(); },
  sense(t) { ui.sense = t.dataset.sense; saveUI(); render(); },
  group(t) {
    const id = t.dataset.list, g = t.dataset.group;
    const cur = ui.groups[id] || [];
    ui.groups[id] = cur.includes(g) ? cur.filter((x) => x !== g) : [...cur, g];
    saveUI(); render();
  },
  'group-all'(t) { ui.groups[t.dataset.list] = []; saveUI(); render(); },
  mode(t) {
    const m = t.dataset.mode;
    if (m === 'discover') {
      const entries = pool();
      entries.forEach((e) => ensureFont(e.list));
      screen = { name: 'discover', entries, idx: 0, revealed: false, view: 'cards' };
      return render();
    }
    if (m === 'hard') { screen = { name: 'hard' }; return render(); }
    startSession(m);
  },
  pick(t) {
    const q = session.q;
    if (q.state === 'done') return;
    const i = +t.dataset.i;
    q.picked = i;
    finishQuestion(!!q.options[i].ok, 'pick');
  },
  check() { submitAnswer(); },
  skip() { const q = session.q; if (q.state !== 'done') { q.input = ($('#answer') || {}).value || ''; finishQuestion(false, 'skip'); } },
  next() { nextQuestion(); },
  override() { overrideCorrect(); },
  hold() { holdQuestion(); },
  quit() {
    if (session && session.results.length) { screen = { name: 'summary' }; session.n = session.results.length; render(); }
    else actions.home();
  },
  again() { startSession(session.mode, session.opts); },
  'retry-missed'() {
    const missed = [...new Map(session.results.filter((r) => !r.correct).map((r) => [r.e.pkey, r.e])).values()];
    const mode = session.mode === 'context' || session.mode === 'senses' ? session.mode : 'write';
    startSession(mode, { entries: missed, label: 'Review' });
  },
  'hard-train'() { startSession('train', { entries: screen.entries, label: 'Hard words' }); },
  'hard-write'() { startSession('write', { entries: screen.entries, label: 'Hard words' }); },
  reveal() {
    const d = screen; d.revealed = true;
    const p = pstate(d.entries[d.idx]); p.seen = true; saveProgress();
    render();
  },
  'disc-next'() { const d = screen; if (d.idx + 1 >= d.entries.length) return actions.home(); d.idx++; d.revealed = false; render(); if (settings.autoSpeak) speak(d.entries[d.idx].item.term, d.entries[d.idx].list.from.lang); },
  'disc-prev'() { const d = screen; if (d.idx > 0) { d.idx--; d.revealed = false; render(); } },
  'disc-view'(t) { screen.view = t.dataset.view; render(); },
  'disc-shuffle'() { screen.entries = shuffle(screen.entries); screen.idx = 0; screen.revealed = false; render(); toast('Shuffled'); },
  'remove-list'(t) {
    const id = t.dataset.id;
    if (!confirm(`Remove “${lists[id].title}” from this device? Your progress on it is kept.`)) return;
    delete lists[id]; ui.selected = ui.selected.filter((x) => x !== id); saveLists(); saveUI(); render();
  },
  'gh-forget'() { settings.gh.token = ''; saveSettings(); render(); toast('Token removed from this device.'); },
  'remote-refresh'() { loadRemoteIndex(); },
  async 'remote-load'(t) {
    const f = screen.files.find((x) => x.path === t.dataset.path);
    t.disabled = true;
    try { await loadRemoteFile(f, screen.branch); toast(`Loaded ${f.path}`); render(); }
    catch (err) { toast(err.message, 5000); t.disabled = false; }
  },
  async 'remote-all'(t) {
    t.disabled = true;
    let ok = 0; const errs = [];
    for (const f of screen.files) {
      const l = Object.values(lists).find((x) => x.loadedFrom && x.loadedFrom.path === f.path);
      if (l && l.loadedFrom.sha === f.sha) continue;
      try { await loadRemoteFile(f, screen.branch); ok++; } catch (err) { errs.push(err.message); }
    }
    toast(errs.length ? errs[0] : ok ? `${ok} list${ok > 1 ? 's' : ''} loaded` : 'Everything is up to date', errs.length ? 6000 : 2600);
    render();
  },
  export() {
    const blob = new Blob([JSON.stringify({ app: 'vocab', version: 1, exported: new Date().toISOString(), progress }, null, 1)], { type: 'application/json' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = `vocab-progress-${new Date().toISOString().slice(0, 10)}.json`;
    document.body.appendChild(a); a.click(); a.remove();
    setTimeout(() => URL.revokeObjectURL(a.href), 5000);
  },
  reset() { if (confirm('Erase all progress on this device?')) { progress = {}; saveProgress(); render(); toast('Progress erased'); } },
};

const changes = {
  'toggle-list'(t) { ui.selected = t.checked ? [...new Set([...ui.selected, t.value])] : ui.selected.filter((x) => x !== t.value); saveUI(); render(); },
  'diff-only'(t) { ui.diffOnly = t.checked; saveUI(); render(); },
  setting(t) { settings[t.dataset.key] = t.checked; saveSettings(); },
  'session-length'(t) { settings.sessionLength = +t.value; saveSettings(); },
  async files(t) {
    const files = [...t.files];
    let ok = 0;
    for (const f of files) {
      try { addList(parseList(await f.text(), f.name), { kind: 'file', path: f.name }); ok++; }
      catch (err) { toast(err.message, 6000); }
    }
    if (ok) { toast(`${ok} list${ok > 1 ? 's' : ''} loaded`); render(); }
  },
  async import(t) {
    const f = t.files[0]; if (!f) return;
    try {
      const data = JSON.parse(await f.text());
      if (!data || typeof data.progress !== 'object') throw new Error('Not a progress file.');
      if (!confirm('Merge this progress into the progress on this device?')) return;
      for (const [k, v] of Object.entries(data.progress)) {
        const cur = progress[k];
        if (!cur) { progress[k] = v; continue; }
        for (const [sk, sv] of Object.entries(v.s || {})) if (!cur.s[sk] || cur.s[sk].last < sv.last) cur.s[sk] = sv;
        cur.seen = cur.seen || v.seen;
      }
      saveProgress(); toast('Progress imported'); render();
    } catch (err) { toast(err.message, 5000); }
  },
};

function submitAnswer() {
  const q = session.q;
  if (q.state === 'done') return nextQuestion();
  const input = ($('#answer') || {}).value || '';
  if (!input.trim()) return;
  q.input = input;
  const g = gradeWrite(q, input);
  if (g && g.other) {
    if (q.state === 'retry') { finishQuestion(false, 'wrong'); return; }
    q.state = 'retry'; q.other = g.other; q.input = '';
    render(); return;
  }
  finishQuestion(!!g, g || 'wrong');
}

document.addEventListener('click', (ev) => {
  if (session && session.autoPending && ev.target.closest('.feedback, .prompt') && !ev.target.closest('[data-action]')) { holdQuestion(); return; }
  const t = ev.target.closest('[data-action]');
  if (!t || t.disabled) return;
  ev.preventDefault();
  if (session && session.autoPending && !['next', 'hold'].includes(t.dataset.action)) holdQuestion();
  const fn = actions[t.dataset.action];
  if (fn) fn(t, ev);
});
document.addEventListener('change', (ev) => {
  const t = ev.target.closest('[data-change]');
  if (t && changes[t.dataset.change]) changes[t.dataset.change](t, ev);
});
document.addEventListener('submit', (ev) => {
  const f = ev.target.closest('[data-submit]');
  if (!f) return;
  ev.preventDefault();
  if (f.dataset.submit === 'answer') submitAnswer();
  if (f.dataset.submit === 'gh') {
    const fd = new FormData(f);
    for (const k of ['owner', 'repo', 'branch', 'folder', 'token']) settings.gh[k] = String(fd.get(k) || '').trim();
    saveSettings();
    toast('Saved');
    if (settings.gh.owner && settings.gh.repo) loadRemoteIndex(); else render();
  }
});
document.addEventListener('keydown', (ev) => {
  if (screen.name !== 'session' || !session) return;
  const q = session.q;
  const inInput = ev.target.matches('input, textarea, select');
  if (ev.key === 'Enter' && q.state === 'done' && !inInput) { ev.preventDefault(); nextQuestion(); }
  else if (q.options && q.state !== 'done' && /^[1-9]$/.test(ev.key) && !inInput) {
    const b = document.querySelector(`[data-action="pick"][data-i="${+ev.key - 1}"]`);
    if (b) b.click();
  }
});

/* clean up selections pointing at removed lists */
ui.selected = ui.selected.filter((id) => lists[id]);
render();
