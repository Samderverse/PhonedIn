/* Phoned In v2: reading a WhatsApp "Export Chat" file on the phone.
   iPhone exports are a .zip containing _chat.txt; Android exports are a plain .txt. Nothing is uploaded anywhere. */
(function (root) {
'use strict';
const PI = root.PI = root.PI || {};

async function inflateRaw(bytes) {
  if (typeof DecompressionStream === 'undefined') throw new Error('This phone can’t unzip files. Update iOS, or unzip it in Files first and pick the _chat.txt inside.');
  const stream = new Blob([bytes]).stream().pipeThrough(new DecompressionStream('deflate-raw'));
  return new Uint8Array(await new Response(stream).arrayBuffer());
}

// Minimal zip reader: finds the chat text file and unzips just that
PI.readZipText = async function (buf) {
  const u8 = new Uint8Array(buf), dv = new DataView(buf);
  let eocd = -1;
  for (let i = u8.length - 22; i >= Math.max(0, u8.length - 65557); i--) if (dv.getUint32(i, true) === 0x06054b50) { eocd = i; break; }
  if (eocd < 0) throw new Error('That file isn’t a zip.');
  const count = dv.getUint16(eocd + 10, true);
  let p = dv.getUint32(eocd + 16, true);
  const entries = [];
  for (let k = 0; k < count && p + 46 <= u8.length; k++) {
    if (dv.getUint32(p, true) !== 0x02014b50) break;
    const method = dv.getUint16(p + 10, true), csize = dv.getUint32(p + 20, true);
    const nlen = dv.getUint16(p + 28, true), elen = dv.getUint16(p + 30, true), clen = dv.getUint16(p + 32, true), off = dv.getUint32(p + 42, true);
    entries.push({ name: new TextDecoder().decode(u8.subarray(p + 46, p + 46 + nlen)), method, csize, off });
    p += 46 + nlen + elen + clen;
  }
  const e = entries.find(x => /(^|\/)_chat\.txt$/i.test(x.name)) || entries.find(x => /\.txt$/i.test(x.name) && !/__MACOSX/.test(x.name));
  if (!e) throw new Error('Couldn’t find the chat inside that zip.');
  const start = e.off + 30 + dv.getUint16(e.off + 26, true) + dv.getUint16(e.off + 28, true);
  const data = u8.subarray(start, start + e.csize);
  const out = e.method === 0 ? data : e.method === 8 ? await inflateRaw(data) : null;
  if (!out) throw new Error('That zip uses a format this app can’t open.');
  return new TextDecoder('utf-8').decode(out);
};

PI.readChatFile = async function (file) {
  const buf = await file.arrayBuffer();
  const head = new Uint8Array(buf.slice(0, 4));
  const isZip = head[0] === 0x50 && head[1] === 0x4b;
  return isZip ? PI.readZipText(buf) : new TextDecoder('utf-8').decode(buf);
};

const IOS = /^\[(\d{1,4})[\/.\-](\d{1,2})[\/.\-](\d{1,4}),?\s+(\d{1,2})[:.](\d{2})(?:[:.](\d{2}))?\s*([AaPp]\.?\s?[Mm]\.?)?\]\s+([^:]{1,60}?):\s?([\s\S]*)$/;
const ANDROID = /^(\d{1,4})[\/.\-](\d{1,2})[\/.\-](\d{1,4}),?\s+(\d{1,2})[:.](\d{2})(?:[:.](\d{2}))?\s*([AaPp]\.?\s?[Mm]\.?)?\s+[-–]\s+([^:]{1,60}?):\s?([\s\S]*)$/;
const MEDIA = [[/image omitted|<Media omitted>/i, '📷 Photo'], [/video omitted/i, '🎥 Video'], [/sticker omitted/i, 'Sticker'], [/GIF omitted/i, 'GIF'],
  [/audio omitted/i, '🎤 Voice note'], [/document omitted/i, '📄 Document'], [/Contact card omitted/i, 'Contact']];
const SYSTEM = /(end-to-end encrypted|security code (changed|with)|created group|added you|changed the (subject|group)|left$|joined using|This message was deleted|You deleted this message|Missed (voice|video) call|Waiting for this message|disappearing messages)/i;

/* Returns { msgs: [{name, text, t}], names: [[name, count], …] } */
PI.parseChat = function (text) {
  const rows = [];
  for (let line of String(text).replace(/\r/g, '').split('\n')) {
    line = line.replace(/[‎‏‪-‮﻿]/g, '');
    const m = line.match(IOS) || line.match(ANDROID);
    if (m) rows.push({ a: +m[1], b: +m[2], c: +m[3], h: +m[4], mi: +m[5], s: +(m[6] || 0), ap: m[7] || '', name: m[8].trim(), text: m[9] });
    else if (rows.length) rows[rows.length - 1].text += '\n' + line;
  }
  // UK exports are day/month, US exports month/day; work out which from the dates themselves
  const ymd = rows.some(r => r.a > 31);
  const mdy = !ymd && !rows.some(r => r.a > 12) && rows.some(r => r.b > 12);
  const msgs = [];
  for (const r of rows) {
    let y, mo, d;
    if (ymd) { y = r.a; mo = r.b; d = r.c; } else if (mdy) { mo = r.a; d = r.b; y = r.c; } else { d = r.a; mo = r.b; y = r.c; }
    if (y < 100) y += 2000;
    let h = r.h;
    const pm = /p/i.test(r.ap), am = /a/i.test(r.ap);
    if (pm && h < 12) h += 12; if (am && h === 12) h = 0;
    const t = new Date(y, mo - 1, d, h, r.mi, r.s).getTime();
    let body = r.text.trim();
    if (!body || SYSTEM.test(body)) continue;
    for (const [re, label] of MEDIA) if (re.test(body)) { body = label; break; }
    if (body === '<This message was edited>') continue;
    body = body.replace(/\s*<This message was edited>$/, '');
    msgs.push({ name: r.name, text: body, t: isNaN(t) ? 0 : t });
  }
  const counts = {};
  msgs.forEach(m => { counts[m.name] = (counts[m.name] || 0) + 1; });
  return { msgs, names: Object.entries(counts).sort((a, b) => b[1] - a[1]) };
};

/* Names and topics they mention a lot, to ask about after an import */
PI.frequentUnknowns = function (person, msgs, extra) {
  const counts = {}, labels = {};
  for (const m of msgs) for (const c of (PI.isMedia(m.text) ? [] : PI.candidates(m.text, person, extra))) {
    counts[c.key] = (counts[c.key] || 0) + 1;
    if (c.strong || !labels[c.key]) labels[c.key] = c.rel || c.label;
  }
  return Object.entries(counts).filter(([, n]) => n >= 3).sort((a, b) => b[1] - a[1]).slice(0, 8)
    .map(([key, count]) => ({ key, label: labels[key], rel: /^(sister|brother|mum|mam|dad|nan|nana|grandad|grandma|boss|boyfriend|girlfriend|bf|gf|husband|wife|fiance|fiancee|partner|cousin|aunt|auntie|uncle|son|daughter|kids?|dog|cat|neighbour|housemate|flatmate|ex)$/.test(key) ? key : null, count }));
};
})(typeof window !== 'undefined' ? window : globalThis);
