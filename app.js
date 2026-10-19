/* Phoned In v2: screens and storage. The reply logic lives in engine.js, chat import in importer.js. */
(() => {
'use strict';
const PI = window.PI;
const $ = s => document.querySelector(s);
const $$ = s => [...document.querySelectorAll(s)];
const esc = s => String(s == null ? '' : s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
const uid = () => Date.now().toString(36) + Math.random().toString(36).slice(2, 7);
const MAX_THREAD = 300;
const RELS = [['friend', 'Friend'], ['partner', 'Partner'], ['family', 'Family'], ['work', 'Work'], ['other', 'Other']];

/* ---------- Storage ---------- */
const KEY = 'pi2';
function load() {
  let d = null;
  try { d = JSON.parse(localStorage.getItem(KEY)); } catch (e) {}
  if (d && Array.isArray(d.people)) return d;
  d = { v: 2, people: [], style: null, manualStyle: '', you: '' };
  // Bring across v1 settings, if any
  try {
    const oldName = JSON.parse(localStorage.getItem('pi_name') || '""'), oldStyle = JSON.parse(localStorage.getItem('pi_style') || '""');
    const oldOpts = JSON.parse(localStorage.getItem('pi_opts') || 'null');
    if (oldStyle) d.manualStyle = oldStyle;
    if (oldName) d.people.push(newPerson(oldName, 'friend', oldOpts ? Object.assign(PI.defaultSettings(), oldOpts, { swear: 0 }) : null));
  } catch (e) {}
  return d;
}
let db = null;
db = load();
let saveT;
function save(now) {
  clearTimeout(saveT);
  const go = () => {
    db.people.forEach(p => { if (p.thread.length > MAX_THREAD) p.thread = p.thread.slice(-MAX_THREAD); });
    try { localStorage.setItem(KEY, JSON.stringify(db)); }
    catch (e) {
      db.people.forEach(p => { p.thread = p.thread.slice(-150); });
      try { localStorage.setItem(KEY, JSON.stringify(db)); toast('Storage was full, so older messages were trimmed'); } catch (e2) { toast('Couldn’t save: this phone’s storage is full'); }
    }
  };
  if (now) go(); else saveT = setTimeout(go, 200);
}
window.addEventListener('pagehide', () => save(true));
function newPerson(name, rel, settings) {
  return { id: uid(), name: String(name).trim().slice(0, 30), rel: rel || 'friend', created: Date.now(), settings: settings || PI.settingsFromStyle(db && db.style),
           cards: [], askAbout: [], jokes: [], ignore: [], thread: [], seen: {}, queue: [] };
}
const person = id => db.people.find(p => p.id === id);
let cur = null; // current person

/* ---------- Small helpers ---------- */
function hue(s) { let h = 0; for (const c of String(s)) h = (h * 31 + c.charCodeAt(0)) % 360; return h; }
function avatar(p, el) { el.textContent = (p.name || '?').trim().charAt(0).toUpperCase(); el.style.background = `hsl(${hue(p.name)} 52% 50%)`; }
const fmtTime = t => new Date(t).toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' });
function fmtDay(t) {
  const d = new Date(t), today = new Date(); today.setHours(0, 0, 0, 0);
  const diff = Math.round((today - new Date(d.getFullYear(), d.getMonth(), d.getDate())) / 864e5);
  if (diff === 0) return 'Today'; if (diff === 1) return 'Yesterday';
  return d.toLocaleDateString('en-GB', diff < 7 ? { weekday: 'long' } : { weekday: 'short', day: 'numeric', month: 'short', year: d.getFullYear() === today.getFullYear() ? undefined : 'numeric' });
}
function fmtWhen(t) { const day = fmtDay(t); return day === 'Today' ? fmtTime(t) : day; }

let toastT;
function toast(text, action) {
  $('#toastText').textContent = text;
  const b = $('#toastAct');
  if (action) { b.hidden = false; b.textContent = action.label; b.onclick = () => { $('#toast').hidden = true; action.fn(); }; } else b.hidden = true;
  $('#toast').hidden = false;
  clearTimeout(toastT); toastT = setTimeout(() => { $('#toast').hidden = true; }, action ? 5000 : 2400);
}
// Called directly inside a tap, so iPhones allow it
function copyText(t) {
  const fallback = () => {
    const ta = document.createElement('textarea'); ta.value = t; ta.setAttribute('readonly', ''); ta.style.position = 'fixed'; ta.style.opacity = '0';
    document.body.appendChild(ta); ta.select(); ta.setSelectionRange(0, t.length);
    let ok = false; try { ok = document.execCommand('copy'); } catch (e) {}
    ta.remove(); return ok;
  };
  if (navigator.clipboard && navigator.clipboard.writeText) return navigator.clipboard.writeText(t).then(() => true, () => fallback());
  return Promise.resolve(fallback());
}

/* ---------- Views ---------- */
function show(view) {
  ['home', 'chat', 'profile'].forEach(v => { $('#v-' + v).hidden = v !== view; });
  document.body.classList.toggle('locked', view === 'chat');
  window.scrollTo(0, 0);
}

/* ---------- People list ---------- */
function renderHome() {
  const list = $('#people');
  const ppl = db.people.slice().sort((a, b) => lastT(b) - lastT(a));
  if (!ppl.length) {
    list.innerHTML = `<div class="empty"><b>No one here yet</b>Add the person who never stops texting, or import your WhatsApp chat with them to get going faster.</div>`;
    return;
  }
  list.innerHTML = ppl.map(p => {
    const last = p.thread[p.thread.length - 1];
    const prev = last ? (last.from === 'me' ? 'You: ' : '') + last.text.replace(/\s+/g, ' ') : 'No messages yet';
    return `<button class="person" type="button" data-id="${p.id}"><span class="av" data-av="${p.id}"></span><span class="txt"><b>${esc(p.name)}</b><span class="prev">${esc(prev)}</span></span>${last ? `<time>${esc(fmtWhen(last.t))}</time>` : ''}</button>`;
  }).join('');
  list.querySelectorAll('[data-av]').forEach(el => avatar(person(el.dataset.av), el));
  list.querySelectorAll('[data-id]').forEach(b => b.onclick = () => openChat(b.dataset.id));
}
const lastT = p => (p.thread.length ? p.thread[p.thread.length - 1].t : p.created);

/* ---------- Chat ---------- */
let showAll = false;
function openChat(id) {
  cur = person(id); if (!cur) return;
  showAll = false; askOpen = false;
  avatar(cur, $('#chatAv')); $('#chatName').textContent = cur.name;
  show('chat'); renderThread(); renderDock();
}
function renderThread() {
  const el = $('#thread'), t = cur.thread;
  if (!t.length) {
    el.innerHTML = `<div class="thread-empty">Copy ${esc(cur.name)}’s latest message in WhatsApp, then tap <b>Paste their message</b>. Replies appear here.</div>`;
    return;
  }
  const start = showAll ? 0 : Math.max(0, t.length - 80);
  let html = start > 0 ? `<button class="pill ghost more" type="button" id="moreBtn">Show earlier messages</button>` : '';
  let lastDay = '';
  const lastMe = [...t].reverse().find(m => m.from === 'me');
  for (let i = start; i < t.length; i++) {
    const m = t[i], day = fmtDay(m.t);
    if (day !== lastDay) { html += `<div class="day">${esc(day)}</div>`; lastDay = day; }
    html += `<button class="msg ${m.from}" type="button" data-i="${i}">${esc(m.text)}<span class="t">${fmtTime(m.t)}${m.via === 'app' ? ' · Phoned In' : ''}</span></button>`;
    if (m === lastMe && m.hint && Date.now() - m.t < 2 * 36e5 && i === t.length - 1) html += `<div class="hintline">${esc(m.hint)}</div>`;
  }
  el.innerHTML = html;
  const more = $('#moreBtn'); if (more) more.onclick = () => { showAll = true; renderThread(); };
  el.querySelectorAll('.msg').forEach(b => b.onclick = () => msgTools(+b.dataset.i, b));
  el.scrollTop = el.scrollHeight;
}
function msgTools(i, el) {
  $$('.msg-tools').forEach(x => x.remove());
  const m = cur.thread[i]; if (!m) return;
  const tools = document.createElement('div');
  tools.className = 'msg-tools ' + m.from;
  tools.innerHTML = `<button class="pill" type="button" data-a="copy">Copy</button><button class="pill danger" type="button" data-a="del">Remove</button>`;
  el.after(tools);
  tools.querySelector('[data-a=copy]').onclick = () => { copyText(m.text); toast('Copied'); tools.remove(); };
  tools.querySelector('[data-a=del]').onclick = () => { cur.thread.splice(i, 1); save(); renderThread(); renderDock(); };
}

function addMessage(from, text, extra) {
  text = String(text || '').trim(); if (!text) return null;
  const m = Object.assign({ id: uid(), from, text, t: Date.now() }, extra || {});
  cur.thread.push(m);
  if (from === 'them') PI.noticeWords(cur, text, [db.you]);
  save();
  return m;
}
// Pasting several WhatsApp messages at once comes through as "[19/10/2026, 20:14] Dave: hi" lines
function addPasted(text) {
  const parsed = /^\s*‎?\[?\d{1,4}[\/.\-]\d{1,2}[\/.\-]\d{1,4}/.test(text) ? PI.parseChat(text) : null;
  if (parsed && parsed.msgs.length) {
    const you = (db.you || '').toLowerCase();
    parsed.msgs.forEach(m => addMessage(you && m.name.toLowerCase() === you ? 'me' : 'them', m.text));
    return parsed.msgs.length;
  }
  addMessage('them', text);
  return 1;
}

let current = null; // the suggestions on screen
function renderDock() {
  renderAsk();
  const tray = $('#tray');
  const pend = PI.pending(cur);
  if (!pend.length) { tray.hidden = true; current = null; return; }
  current = PI.suggest(cur, db.style);
  tray.hidden = false;
  $('#notes').innerHTML = current.notes.map((n, k) => `<div class="note"><span>${esc(n.text)}</span>${n.action ? `<button type="button" data-k="${k}">${esc(n.action.label)}</button>` : ''}</div>`).join('');
  $('#notes').querySelectorAll('[data-k]').forEach(b => b.onclick = () => { cur.settings.goal = current.notes[+b.dataset.k].action.goal; save(); renderDock(); });
  const serious = current.a.primary === 'serious';
  $('#banner').hidden = !serious;
  if (serious) $('#banner').textContent = 'This sounds serious, so these replies ignore your settings, skip the swearing and stay kind. It might deserve a proper chat, or a call.';
  $('#replies').innerHTML = current.replies.map((r, k) => `<button class="reply" type="button" data-k="${k}">${esc(r.text)}<span class="tag">${esc(r.tag || 'Tap to copy')}</span></button>`).join('');
  $('#replies').querySelectorAll('.reply').forEach(b => b.onclick = () => useReply(current.replies[+b.dataset.k].text));
  $('#gptBtn').href = 'https://chatgpt.com/?q=' + encodeURIComponent(PI.gptPrompt(cur, db));
}
function useReply(text) {
  const d = PI.delay(cur);
  copyText(text).then(ok => {
    const m = addMessage('me', text, { via: 'app', hint: d.text });
    renderThread(); renderDock(); renderHomeLater();
    toast(ok ? 'Copied: paste it in WhatsApp' : 'Saved, but copying failed. Tap the message to copy it.', { label: 'Undo', fn: () => { cur.thread = cur.thread.filter(x => x !== m); save(); renderThread(); renderDock(); } });
  });
}
let homeT; function renderHomeLater() { clearTimeout(homeT); homeT = setTimeout(renderHome, 300); }

$('#shuffleBtn').onclick = renderDock;
$('#gptBtn').addEventListener('click', () => { copyText(PI.gptPrompt(cur, db)); });
$('#ownBtn').onclick = async () => {
  const t = await dialog({ title: 'What did you send?', text: 'Paste or type your reply so the chat stays accurate.', input: '', ok: 'Add' });
  if (t && t.trim()) { addMessage('me', t); renderThread(); renderDock(); }
};
$('#chatBack').onclick = () => { renderHome(); show('home'); };
$('#chatWho').onclick = () => openProfile();
$('#chatTweak').onclick = () => openTweak();

$('#pasteBtn').onclick = async () => {
  let text = '';
  try { text = await navigator.clipboard.readText(); } catch (e) {}
  if (!text || !text.trim()) { openType(); toast('Press and hold in the box, then tap Paste'); return; }
  const n = addPasted(text);
  renderThread(); renderDock(); renderHomeLater();
  toast(n > 1 ? `Added ${n} messages` : 'Added');
};
function openType() { $('#typeRow').hidden = false; $('#typeBtn').setAttribute('aria-expanded', 'true'); setTimeout(() => $('#typeBox').focus(), 30); }
$('#typeBtn').onclick = () => { const open = $('#typeRow').hidden; if (open) openType(); else { $('#typeRow').hidden = true; $('#typeBtn').setAttribute('aria-expanded', 'false'); } };
$('#addThem').onclick = () => { if (!$('#typeBox').value.trim()) return; addPasted($('#typeBox').value); $('#typeBox').value = ''; $('#typeRow').hidden = true; renderThread(); renderDock(); };
$('#addMe').onclick = () => { if (!$('#typeBox').value.trim()) return; addMessage('me', $('#typeBox').value); $('#typeBox').value = ''; $('#typeRow').hidden = true; renderThread(); renderDock(); };

// Lazy mode: paste their message and copy a minimal reply in one tap
$('#lazyBtn').onclick = () => {
  let reply = '', d = null;
  const work = (async () => {
    const t = await navigator.clipboard.readText();
    if (!t || !t.trim()) throw new Error('empty');
    addPasted(t);
    d = PI.delay(cur);
    reply = PI.lazy(cur, db.style);
    if (!reply) throw new Error('none');
    return new Blob([reply], { type: 'text/plain' });
  })();
  const done = () => { addMessage('me', reply, { via: 'app', hint: d && d.text }); renderThread(); renderDock(); renderHomeLater(); toast(`Copied “${reply}”`); };
  if (window.ClipboardItem && navigator.clipboard && navigator.clipboard.write) {
    navigator.clipboard.write([new ClipboardItem({ 'text/plain': work })]).then(done).catch(async () => {
      try { await work; renderThread(); renderDock(); toast('Tap the first reply to copy it'); } catch (e) { toast('Copy their message in WhatsApp first, then tap ⚡'); }
    });
  } else {
    work.then(() => { renderThread(); renderDock(); toast('Tap the first reply to copy it'); }).catch(() => toast('Copy their message in WhatsApp first, then tap ⚡'));
  }
};

/* ---------- "Who's that?" ---------- */
let askOpen = false;
function renderAsk() {
  const el = $('#askCard');
  const q = (cur.queue || [])[0];
  if (!q) { el.hidden = true; return; }
  el.hidden = false;
  const name = esc(cur.name.split(' ')[0]);
  // Kept to one line while you're replying; tap to answer
  el.classList.toggle('compact', !askOpen);
  if (!askOpen) {
    el.innerHTML = `<p>${q.rel ? `${name} mentioned their <b>${esc(q.rel)}</b>` : `Who’s <b>‘${esc(q.label)}’</b>?`}${q.count > 1 ? `<small>${q.count}×</small>` : ''}</p>
      <button class="pill solid" type="button" id="askOpen">Tell me</button><button class="xs" type="button" id="askSkip" aria-label="Not now">×</button>`;
    $('#askOpen').onclick = () => { askOpen = true; renderAsk(); const i = el.querySelector('input:not([hidden]), [data-k]'); if (i) i.focus(); };
    $('#askSkip').onclick = () => doneAsk(q);
    return;
  }
  if (q.rel) {
    el.innerHTML = `<p>${name} mentioned their <b>${esc(q.rel)}</b>. Do you know their name?</p>
      <div class="inline"><input id="askName" placeholder="Name (optional)" maxlength="30" autocomplete="off"><button class="pill solid" type="button" id="askSave">Save</button></div>
      <div class="row-btns"><button class="link" type="button" id="askSkip">Not now</button><button class="link" type="button" id="askNever">Don’t ask about this</button></div>`;
    $('#askSave').onclick = () => {
      const nm = $('#askName').value.trim();
      cur.cards.push({ id: uid(), label: nm || `their ${q.rel}`, kind: /^(dog|cat)$/.test(q.rel) ? 'pet' : 'person', note: q.rel, rel: q.rel });
      doneAsk(q, `Saved to ${cur.name.split(' ')[0]}’s profile`);
    };
  } else {
    el.innerHTML = `<p>Who or what is <b>‘${esc(q.label)}’</b>?${q.count > 1 ? `<small>mentioned ${q.count} times</small>` : ''}</p>
      <div class="row-btns" id="askKinds">${PI.KINDS.map(([k, l]) => `<button class="pill" type="button" data-k="${k}">${l}</button>`).join('')}</div>
      <div class="inline" id="askNoteRow" hidden><input id="askNote" placeholder="A few words, e.g. his brother" maxlength="60" autocomplete="off"><button class="pill solid" type="button" id="askSave">Save</button></div>
      <div class="row-btns"><button class="link" type="button" id="askSkip">Not now</button><button class="link" type="button" id="askNever">Don’t ask about this</button></div>`;
    let kind = null;
    el.querySelectorAll('[data-k]').forEach(b => b.onclick = () => {
      kind = b.dataset.k; el.querySelectorAll('[data-k]').forEach(x => x.classList.toggle('solid', x === b));
      $('#askNoteRow').hidden = false; $('#askNote').placeholder = { person: 'A few words, e.g. his brother', pet: 'e.g. her dog', place: 'e.g. their local pub', thing: 'e.g. his football team' }[kind];
      $('#askNote').focus();
    });
    $('#askSave').onclick = () => {
      cur.cards.push({ id: uid(), label: q.label.charAt(0).toUpperCase() + q.label.slice(1), kind: kind || 'thing', note: $('#askNote').value.trim() });
      doneAsk(q, `Saved to ${cur.name.split(' ')[0]}’s profile`);
    };
  }
  $('#askSkip').onclick = () => doneAsk(q);
  $('#askNever').onclick = () => { cur.ignore.push(q.key); doneAsk(q, 'Won’t ask about that again'); };
}
function doneAsk(q, msg) {
  askOpen = false;
  cur.queue = cur.queue.filter(x => x.key !== q.key);
  if (msg) toast(msg);
  save(); renderDock();
}

/* ---------- Reply settings (shared by the chat sheet and the profile) ---------- */
function renderControls(el, p, onChange) {
  const s = p.settings, pre = 'c' + Math.random().toString(36).slice(2, 6);
  const radios = (name, list, val, fmt) => list.map(([v, l, sm]) => `<label class="chip"><input type="radio" name="${pre}-${name}" value="${v}"${String(v) === String(val) ? ' checked' : ''}><span>${fmt ? fmt(v, l, sm) : esc(l)}</span></label>`).join('');
  const bars = (v, n) => `<span class="bars" aria-hidden="true">${[1, 2, 3].map(i => `<i class="${i <= n ? 'on' : ''}"></i>`).join('')}</span>`;
  el.innerHTML = `<div class="controls">
    <div class="group"><h3 class="lbl">Tone</h3><div class="chips">${radios('tone', PI.TONES, s.tone)}</div></div>
    <div class="group"><h3 class="lbl">Goal</h3><div class="chips">${radios('goal', PI.GOALS, s.goal)}</div></div>
    <div class="group"><h3 class="lbl">Effort</h3><div class="grid3">${radios('effort', PI.EFFORTS, s.effort, (v, l, sm) => `${bars(v, v)}${esc(l)}<small>${esc(sm)}</small>`)}</div></div>
    <div class="group"><h3 class="lbl">Swearing</h3><div class="grid3">${radios('swear', PI.SWEARS, s.swear || 0, (v, l, sm) => `${bars(v, v)}${esc(l)}<small>${esc(sm)}</small>`)}</div></div>
    <div class="toggles">
      <label class="tog"><input type="checkbox" data-t="emoji"${s.emoji ? ' checked' : ''}><span>Emoji</span></label>
      <label class="tog"><input type="checkbox" data-t="sorry"${s.sorry ? ' checked' : ''}><span>“Sorry, just seen this”</span></label>
      <label class="tog"><input type="checkbox" data-t="kiss"${s.kiss ? ' checked' : ''}><span>Add an x</span></label>
      <label class="tog"><input type="checkbox" data-t="lower"${s.lower ? ' checked' : ''}><span>all lowercase</span></label>
    </div></div>`;
  el.addEventListener('change', e => {
    const t = e.target;
    if (t.type === 'radio') { const key = t.name.split('-')[1]; s[key] = key === 'effort' || key === 'swear' ? +t.value : t.value; }
    if (t.dataset.t) s[t.dataset.t] = t.checked;
    save(); onChange && onChange();
  });
}
function openTweak() {
  $('#tweakFor').textContent = `Saved for ${cur.name}. Change them any time.`;
  renderControls($('#tweakControls'), cur, renderDock);
  openModal('m-tweak');
}

/* ---------- Profile ---------- */
function openProfile() { renderProfile(); show('profile'); }
$('#profBack').onclick = () => { openChat(cur.id); };
function renderProfile() {
  const p = cur, st = PI.stats(p);
  const first = esc(p.name.split(' ')[0]);
  $('#profile').innerHTML = `
    <div class="phead"><span class="av" id="pAv"></span><input id="pName" value="${esc(p.name)}" maxlength="30" aria-label="Name"></div>
    <div class="sec"><h3>${first} is your…</h3><div class="chips" id="pRel">${RELS.map(([v, l]) => `<label class="chip"><input type="radio" name="prel" value="${v}"${p.rel === v ? ' checked' : ''}><span>${l}</span></label>`).join('')}</div></div>
    <div class="sec"><h3>Reply settings</h3><div id="pControls"></div></div>
    <div class="sec"><h3>People and things</h3><p class="fine">Who and what ${first} talks about. Replies use these, like “say hi to Gaz for me”.</p>
      <div class="items" id="pCards"></div>
      <div class="addcard"><div class="inline"><input id="cLabel" placeholder="Name, e.g. Gaz" maxlength="30" autocomplete="off"></div>
        <div class="chips" id="cKinds">${PI.KINDS.map(([k, l], i) => `<label class="chip"><input type="radio" name="ckind" value="${k}"${i === 0 ? ' checked' : ''}><span>${l}</span></label>`).join('')}</div>
        <div class="inline"><input id="cNote" placeholder="A few words, e.g. his brother" maxlength="60" autocomplete="off"><button class="pill solid" type="button" id="cAdd">Add</button></div></div>
    </div>
    <div class="sec"><h3>Things to ask about</h3><p class="fine">Write them how you’d say them to ${first}: “your knee”, “the new job”, “Max”.</p>
      <div class="items" id="pAsk"></div>
      <div class="inline"><input id="aText" placeholder="e.g. the new job" maxlength="40" autocomplete="off"><button class="pill solid" type="button" id="aAdd">Add</button></div></div>
    <div class="sec"><h3>Running jokes</h3><p class="fine">Lines you’d actually send. One gets slipped in now and then, marked ★.</p>
      <div class="items" id="pJokes"></div>
      <div class="inline"><input id="jText" placeholder="e.g. canal incident 2.0?" maxlength="80" autocomplete="off"><button class="pill solid" type="button" id="jAdd">Add</button></div></div>
    <details class="sec"><summary>Stats</summary>
      <div class="statgrid">
        <div><b>${st.themToday}</b><span>from ${first} today</span></div><div><b>${st.meToday}</b><span>from you today</span></div>
        <div><b>${st.themWeek}</b><span>from ${first} this week</span></div><div><b>${st.meWeek}</b><span>from you this week</span></div>
        <div><b>${st.chasersWeek}</b><span>“you there?” this week</span></div><div><b>${st.wordsThem} / ${st.wordsMe}</b><span>average words: theirs / yours</span></div>
        <div><b>${st.viaApp}</b><span>replies via Phoned In</span></div><div><b>${st.minutesSaved} min</b><span>of your life saved, roughly</span></div>
      </div></details>
    <div class="sec"><h3>Chat</h3><div class="row-btns">
      <button class="pill" type="button" id="pImport">Import from WhatsApp</button>
      <button class="pill" type="button" id="pClear">Clear messages</button>
      <button class="pill danger" type="button" id="pDelete">Delete ${first}</button></div></div>`;
  avatar(p, $('#pAv'));
  $('#pName').onchange = () => { const v = $('#pName').value.trim(); if (v) { p.name = v; save(); avatar(p, $('#pAv')); } else $('#pName').value = p.name; };
  $('#pRel').onchange = e => { p.rel = e.target.value; save(); };
  renderControls($('#pControls'), p);
  const list = (el, arr, fmt, remove) => {
    el.innerHTML = arr.length ? arr.map((x, i) => `<div class="item">${fmt(x)}<button type="button" data-i="${i}" aria-label="Remove">×</button></div>`).join('') : '<p class="fine">Nothing yet.</p>';
    el.querySelectorAll('[data-i]').forEach(b => b.onclick = () => { remove(+b.dataset.i); save(); renderProfile(); });
  };
  const kindName = k => (PI.KINDS.find(x => x[0] === k) || ['', 'Thing'])[1];
  list($('#pCards'), p.cards, c => `<span class="k">${kindName(c.kind)}</span><span class="v">${esc(c.label)}${c.note ? `<small>${esc(c.note)}</small>` : ''}</span>`, i => p.cards.splice(i, 1));
  list($('#pAsk'), p.askAbout, x => `<span class="v">${esc(x)}</span>`, i => p.askAbout.splice(i, 1));
  list($('#pJokes'), p.jokes, x => `<span class="v">★ ${esc(x)}</span>`, i => p.jokes.splice(i, 1));
  $('#cAdd').onclick = () => {
    const label = $('#cLabel').value.trim(); if (!label) { $('#cLabel').focus(); return; }
    p.cards.push({ id: uid(), label, kind: (document.querySelector('input[name=ckind]:checked') || {}).value || 'person', note: $('#cNote').value.trim() });
    p.queue = (p.queue || []).filter(q => q.key !== label.toLowerCase());
    save(); renderProfile();
  };
  const addTo = (input, arr) => { const v = $(input).value.trim(); if (!v) return; arr.push(v); save(); renderProfile(); };
  $('#aAdd').onclick = () => addTo('#aText', p.askAbout);
  $('#jAdd').onclick = () => addTo('#jText', p.jokes);
  ['#cNote', '#aText', '#jText'].forEach((s, k) => $(s).onkeydown = e => { if (e.key === 'Enter') [$('#cAdd'), $('#aAdd'), $('#jAdd')][k].click(); });
  $('#pImport').onclick = () => openImport(p.id);
  $('#pClear').onclick = async () => { if (await dialog({ title: `Clear ${first}’s messages?`, text: 'Their profile, notes and jokes are kept.', ok: 'Clear' })) { p.thread = []; save(); renderProfile(); toast('Messages cleared'); } };
  $('#pDelete').onclick = async () => {
    if (await dialog({ title: `Delete ${first}?`, text: 'This removes their messages, notes and jokes from this phone.', ok: 'Delete' })) {
      db.people = db.people.filter(x => x !== p); save(true); cur = null; renderHome(); show('home');
    }
  };
}

/* ---------- New person ---------- */
$('#newBtn').onclick = () => {
  $('#newName').value = '';
  $('#newRel').innerHTML = RELS.map(([v, l], i) => `<label class="chip"><input type="radio" name="nrel" value="${v}"${i === 0 ? ' checked' : ''}><span>${l}</span></label>`).join('');
  openModal('m-new'); setTimeout(() => $('#newName').focus(), 60);
};
$('#newSave').onclick = () => {
  const name = $('#newName').value.trim(); if (!name) { $('#newName').focus(); return; }
  const p = newPerson(name, (document.querySelector('input[name=nrel]:checked') || {}).value);
  db.people.push(p); save(); closeModal('m-new'); openChat(p.id);
};
$('#newName').onkeydown = e => { if (e.key === 'Enter') $('#newSave').click(); };

/* ---------- Import ---------- */
let imp = null;
function openImport(targetId) {
  imp = { targetId: targetId || null };
  $('#imp1').hidden = false; $('#imp2').hidden = true;
  openModal('m-import');
}
$('#importBtn').onclick = () => openImport(null);
$('#impPick').onclick = () => $('#impFile').click();
$('#impFile').onchange = async e => {
  const f = e.target.files && e.target.files[0]; e.target.value = '';
  if (!f) return;
  try {
    const text = await PI.readChatFile(f);
    const parsed = PI.parseChat(text);
    if (parsed.msgs.length < 2 || !parsed.names.length) throw new Error('That doesn’t look like a WhatsApp chat export.');
    imp.parsed = parsed;
    const names = parsed.names.map(n => n[0]);
    const youGuess = names.find(n => db.you && n.toLowerCase() === db.you.toLowerCase()) || (names.length === 2 && imp.targetId ? names.find(n => n.toLowerCase() !== person(imp.targetId).name.toLowerCase()) : null);
    $('#impFound').textContent = `Found ${parsed.msgs.length} messages from ${names.length} ${names.length === 1 ? 'person' : 'people'}.`;
    $('#impYou').innerHTML = names.map(n => `<label class="chip"><input type="radio" name="iyou" value="${esc(n)}"${n === youGuess ? ' checked' : ''}><span>${esc(n)}</span></label>`).join('');
    renderImpThem();
    $('#imp1').hidden = true; $('#imp2').hidden = false;
  } catch (err) { toast(err.message || 'Couldn’t read that file'); }
};
$('#impYou').onchange = renderImpThem;
function renderImpThem() {
  const names = imp.parsed.names.map(n => n[0]);
  const you = (document.querySelector('input[name=iyou]:checked') || {}).value;
  const others = names.filter(n => n !== you);
  $('#impThemWrap').hidden = others.length <= 1;
  $('#impThem').innerHTML = others.map((n, i) => `<label class="chip"><input type="radio" name="ithem" value="${esc(n)}"${i === 0 ? ' checked' : ''}><span>${esc(n)}</span></label>`).join('');
  const them = others[0] || '';
  const targets = [['new', `New person: ${them || 'them'}`]].concat(db.people.map(p => [p.id, p.name]));
  const pre = imp.targetId || (db.people.find(p => p.name.toLowerCase() === them.toLowerCase()) || {}).id || 'new';
  $('#impTarget').innerHTML = targets.map(([v, l]) => `<label class="chip"><input type="radio" name="itarget" value="${esc(v)}"${v === pre ? ' checked' : ''}><span>${esc(l)}</span></label>`).join('');
}
$('#impThem').onchange = () => {
  const them = (document.querySelector('input[name=ithem]:checked') || {}).value;
  const first = $('#impTarget').querySelector('input[value=new] + span'); if (first) first.textContent = `New person: ${them}`;
};
$('#impGo').onclick = () => {
  const you = (document.querySelector('input[name=iyou]:checked') || {}).value;
  if (!you) { toast('Pick which name is you'); return; }
  const them = (document.querySelector('input[name=ithem]:checked') || {}).value || imp.parsed.names.map(n => n[0]).find(n => n !== you);
  const target = (document.querySelector('input[name=itarget]:checked') || {}).value || 'new';
  db.you = you;
  const msgs = imp.parsed.msgs.filter(m => m.name === you || m.name === them);
  if ($('#impLearn').checked) {
    const st = PI.learnStyle(msgs.filter(m => m.name === you).map(m => m.text));
    if (st) db.style = st;
  }
  let p = target === 'new' ? null : person(target);
  if (!p) { p = newPerson(them || 'Them', 'friend', PI.settingsFromStyle(db.style)); db.people.push(p); }
  // Merge without duplicates, keep the most recent 300
  const have = new Set(p.thread.map(m => m.t + '|' + m.text));
  const add = msgs.filter(m => !have.has(m.t + '|' + m.text)).map(m => ({ id: uid(), from: m.name === you ? 'me' : 'them', text: m.text, t: m.t }));
  p.thread = p.thread.concat(add).sort((a, b) => a.t - b.t).slice(-MAX_THREAD);
  const asks = PI.frequentUnknowns(p, msgs.filter(m => m.name === them), [you]);
  p.queue = (p.queue || []).concat(asks.filter(a => !(p.queue || []).some(q => q.key === a.key)));
  save(true); closeModal('m-import');
  openChat(p.id);
  toast(`Imported ${add.length} messages${asks.length ? `. ${asks.length} names to ask about` : ''}`);
};

/* ---------- Settings & backup ---------- */
$('#setBtn').onclick = () => {
  $('#sYou').value = db.you || ''; $('#sStyle').value = db.manualStyle || '';
  renderStyleBox();
  const n = db.people.length, msgs = db.people.reduce((s, p) => s + p.thread.length, 0);
  $('#backupInfo').textContent = `${n} ${n === 1 ? 'person' : 'people'} and ${msgs} messages are stored on this phone only.`;
  openModal('m-settings');
};
function renderStyleBox() {
  const box = $('#styleBox');
  box.innerHTML = db.style
    ? `<b>How you text</b><span>Learned from ${db.style.n} of your messages: ${esc(PI.styleSummary(db.style))}.</span><div><button class="pill" type="button" id="forgetStyle">Forget this</button></div>`
    : `<b>How you text</b><span>Import a WhatsApp chat and Phoned In will learn your style from your own messages.</span>`;
  const f = $('#forgetStyle'); if (f) f.onclick = () => { db.style = null; save(); renderStyleBox(); };
}
$('#sYou').onchange = () => { db.you = $('#sYou').value.trim(); save(); };
$('#sStyle').onchange = () => { db.manualStyle = $('#sStyle').value.trim(); save(); };
function shareOrDownload(file) {
  const data = { files: [file], title: 'Phoned In backup' };
  if (navigator.canShare && navigator.canShare(data)) { navigator.share(data).catch(e => { if (e.name !== 'AbortError') download(file); }); return; }
  download(file);
}
function download(file) {
  const u = URL.createObjectURL(file), a = document.createElement('a');
  a.href = u; a.download = file.name; document.body.appendChild(a); a.click(); a.remove(); setTimeout(() => URL.revokeObjectURL(u), 10000);
}
$('#exportBtn').onclick = () => {
  db.manualStyle = $('#sStyle').value.trim(); db.you = $('#sYou').value.trim();
  shareOrDownload(new File([JSON.stringify(Object.assign({ app: 'phoned-in', exported: new Date().toISOString() }, db))], `phoned-in-backup-${new Date().toISOString().slice(0, 10)}.json`, { type: 'application/json' }));
};
$('#restoreBtn').onclick = () => $('#restoreFile').click();
$('#restoreFile').onchange = async e => {
  const f = e.target.files && e.target.files[0]; e.target.value = '';
  if (!f) return;
  try {
    const d = JSON.parse(await f.text());
    if (!d || !Array.isArray(d.people)) throw new Error('bad');
    if (!(await dialog({ title: 'Restore this backup?', text: `It has ${d.people.length} ${d.people.length === 1 ? 'person' : 'people'}. It replaces everything currently on this phone.`, ok: 'Restore' }))) return;
    db = { v: 2, people: d.people, style: d.style || null, manualStyle: d.manualStyle || '', you: d.you || '' };
    db.people.forEach(p => { p.thread = p.thread || []; p.cards = p.cards || []; p.askAbout = p.askAbout || []; p.jokes = p.jokes || []; p.ignore = p.ignore || []; p.queue = p.queue || []; p.seen = p.seen || {}; p.settings = Object.assign(PI.defaultSettings(), p.settings || {}); });
    save(true); closeModal('m-settings'); renderHome(); show('home'); toast('Backup restored');
  } catch (err) { toast('That file isn’t a Phoned In backup'); }
};

/* ---------- Modals ---------- */
function openModal(id) { $('#' + id).hidden = false; }
function closeModal(id) { const m = $('#' + id); if (m.hidden) return; m.hidden = true; if (m.onclose) m.onclose(); }
$$('.modal').forEach(m => m.addEventListener('click', e => { if (e.target.closest('[data-close]')) closeModal(m.id); }));
document.addEventListener('keydown', e => { if (e.key === 'Escape') { const open = $$('.modal').filter(m => !m.hidden).pop(); if (open) closeModal(open.id); } });
function dialog({ title, text = '', input = null, ok = 'OK' }) {
  return new Promise(res => {
    const m = $('#m-dialog'), inp = $('#dlgInput');
    $('#dlgTitle').textContent = title; $('#dlgText').textContent = text; $('#dlgText').hidden = !text;
    inp.hidden = input === null; inp.value = input || ''; $('#dlgOk').textContent = ok;
    let settled = false;
    const finish = v => { if (settled) return; settled = true; m.onclose = null; closeModal('m-dialog'); res(v); };
    m.onclose = () => { if (!settled) { settled = true; res(input === null ? false : null); } };
    $('#dlgOk').onclick = () => finish(input === null ? true : inp.value);
    $('#dlgCancel').onclick = () => finish(input === null ? false : null);
    openModal('m-dialog'); setTimeout(() => (input === null ? $('#dlgOk') : inp).focus(), 60);
  });
}
$('#m-tweak').onclose = () => {};

/* ---------- Start ---------- */
renderHome(); show('home');
if (db.people.length && !localStorage.getItem(KEY)) save(true); // first run after v1
window.PhonedIn = { db: () => db, PI };
})();
