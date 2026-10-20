/* Phoned In: AI replies with Google Gemini (optional, free API key).
   Sends the recent chat, the person's profile, your style and your reply settings, and asks for three replies as JSON. */
(function (root) {
'use strict';
const PI = root.PI = root.PI || {};
const API = 'https://generativelanguage.googleapis.com/v1beta/models/';
// "latest" aliases first, so it keeps working when Google releases new versions; pinned names as fallbacks
const MODELS = {
  fast: ['gemini-flash-lite-latest', 'gemini-3.5-flash-lite', 'gemini-2.5-flash-lite', 'gemini-flash-latest'],
  smart: ['gemini-flash-latest', 'gemini-3.8-flash', 'gemini-2.5-flash', 'gemini-flash-lite-latest']
};
PI.AI_KEY_URL = 'https://aistudio.google.com/apikey';

PI.aiReady = db => !!(db && db.ai && db.ai.on && db.ai.key);

const ago = t => {
  const d = new Date(t), now = new Date();
  const sameDay = d.toDateString() === now.toDateString();
  const y = new Date(now); y.setDate(now.getDate() - 1);
  const hm = d.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' });
  if (sameDay) return `today ${hm}`;
  if (d.toDateString() === y.toDateString()) return `yesterday ${hm}`;
  return d.toLocaleDateString('en-GB', { weekday: 'short', day: 'numeric', month: 'short' }) + ' ' + hm;
};

PI.aiPrompt = function (person, db) {
  const s = Object.assign(PI.defaultSettings(), person.settings || {});
  const name = (person.name || 'my friend').split(' ')[0];
  const tone = (PI.TONES.find(t => t[0] === s.tone) || ['', 'Chill'])[1];
  const goal = { keep: 'keep the conversation going', wind: 'politely wind the conversation down', time: 'buy me some time; say I’ll reply properly later', subject: 'steer onto a different subject' }[s.goal];
  const length = { 1: 'as short as possible: one to four words', 2: 'one short sentence, or two', 3: 'two or three sentences' }[s.effort];
  const swear = ['no swearing at all', 'mild swearing is fine (bloody, crap, sod it)', 'swearing is fine, British style'][s.swear || 0];
  const a = PI.analyse(person);

  const system = [
    'You draft WhatsApp replies for me to copy and send to someone who texts me a lot. I choose one of your drafts and send it myself.',
    'Write exactly 3 different replies in casual British English texting, like a real person, never like an assistant.',
    `Each reply must respond to what ${name} actually said in the NEW messages: pick up the specifics (people, places, plans, things, questions) and use the earlier chat for context. Never fall back on generic filler such as "how’s your week been?" when there is something specific to respond to. Don’t ask about anything already answered in the chat, and don’t repeat things I said recently.`,
    'If there are several NEW messages, cover them in one reply.',
    'If they ask something only I can answer (am I free, do I want to, did I do something), make the 3 options take different answers, for example one yes, one no, one maybe, and say which in the tag.',
    'Don’t invent facts about my life beyond what’s in the chat or notes; keep anything you have to assume vague.',
    'Use at most one running joke across the 3 options, and only if it genuinely fits.',
    'If anything sounds serious or upsetting (illness, a death, a break-up, real distress), ignore the low-effort brief: be kind and supportive, no jokes, no swearing.',
    'Give each reply a tag of 2 to 4 words describing its angle, for example "Says yes", "Asks about the gig", "Running joke", "Keeps it short".'
  ].join('\n');

  const about = [];
  about.push(`${name} is my ${person.rel && person.rel !== 'other' ? person.rel : 'friend'}.`);
  (person.cards || []).forEach(c => about.push(`- ${c.label}${c.note ? ': ' + c.note : ''} (${c.kind || 'thing'})`));
  if ((person.askAbout || []).length) about.push(`Things I could ask about: ${person.askAbout.join('; ')}`);
  if ((person.jokes || []).length) about.push(`Our running jokes: ${person.jokes.join(' / ')}`);

  const styleBits = [PI.styleSummary(db.style), db.manualStyle].filter(Boolean).join('. ');
  const settings = [
    `Tone: ${tone}.`, `Goal: ${goal}.`, `Length: ${length}.`,
    s.lower ? 'Write in all lowercase.' : 'Normal capitalisation.',
    s.emoji ? 'An emoji is fine where natural.' : 'No emoji.',
    s.kiss ? 'End each reply with " x".' : '',
    s.sorry ? 'Open with a quick sorry for the slow reply.' : '',
    `Swearing: ${swear}.`,
    styleBits ? `How I text: ${styleBits}.` : ''
  ].filter(Boolean).join(' ');

  const pending = a.pending, pendSet = new Set(pending);
  const hist = (person.thread || []).filter(m => !pendSet.has(m)).slice(-40);
  const line = m => `[${ago(m.t)}] ${m.from === 'me' ? 'Me' : name}: ${m.text.replace(/\s+/g, ' ').slice(0, 400)}`;
  const notes = [];
  if (a.chasersToday >= 3) notes.push(`${name} has sent ${a.chasersToday} "are you there?" chasers today.`);
  if (a.longChat) notes.push('We have been texting back and forth a lot in the last hour.');

  const user = [
    `About ${name}:\n${about.join('\n')}`,
    hist.length ? `Earlier chat (oldest first):\n${hist.map(line).join('\n')}` : 'There is no earlier chat.',
    `NEW messages from ${name} to reply to:\n${pending.map(line).join('\n') || '(none)'}`,
    notes.join(' '),
    `My settings: ${settings}`
  ].filter(Boolean).join('\n\n');
  return { system, user };
};

const SCHEMA = {
  type: 'OBJECT',
  properties: { replies: { type: 'ARRAY', items: { type: 'OBJECT', properties: { text: { type: 'STRING' }, tag: { type: 'STRING' } }, required: ['text', 'tag'] } } },
  required: ['replies']
};
const SAFETY = ['HARM_CATEGORY_HARASSMENT', 'HARM_CATEGORY_HATE_SPEECH', 'HARM_CATEGORY_SEXUALLY_EXPLICIT', 'HARM_CATEGORY_DANGEROUS_CONTENT']
  .map(category => ({ category, threshold: 'BLOCK_ONLY_HIGH' }));

class AIError extends Error { constructor(code, msg) { super(msg); this.code = code; } }
PI.AIError = AIError;

async function call(model, key, body, signal) {
  let r;
  try {
    r = await fetch(`${API}${model}:generateContent?key=${encodeURIComponent(key)}`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body), signal
    });
  } catch (e) {
    if (e.name === 'AbortError') throw e;
    throw new AIError('network', 'Couldn’t reach Gemini. Check your signal.');
  }
  let j = null; try { j = await r.json(); } catch (e) {}
  if (!r.ok) {
    const msg = (j && j.error && j.error.message) || '';
    if (r.status === 404 || /not found|not supported|is not available|no longer available/i.test(msg)) throw new AIError('model', msg);
    if (r.status === 429) throw new AIError('limit', 'You’ve hit Gemini’s free limit for now. Quick replies until it resets.');
    if (/api key|API_KEY|permission|unauthori/i.test(msg) || r.status === 401 || r.status === 403) throw new AIError('key', 'Gemini didn’t accept your key. Check it in Settings.');
    if (r.status === 400 && /schema|response_schema|responseSchema|mime/i.test(msg)) throw new AIError('schema', msg);
    throw new AIError('other', msg || `Gemini returned an error (${r.status}).`);
  }
  const c = j && j.candidates && j.candidates[0];
  if (!c) throw new AIError(j && j.promptFeedback && j.promptFeedback.blockReason ? 'blocked' : 'empty', 'Gemini didn’t write anything for this one.');
  const text = ((c.content && c.content.parts) || []).map(p => p.text || '').join('');
  if (!text) throw new AIError(c.finishReason === 'SAFETY' ? 'blocked' : 'empty', 'Gemini didn’t write anything for this one.');
  return text;
}

function parse(text) {
  let t = String(text).trim().replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/, '');
  let obj = null;
  try { obj = JSON.parse(t); } catch (e) {
    const m = t.match(/\{[\s\S]*\}/); if (m) { try { obj = JSON.parse(m[0]); } catch (e2) {} }
  }
  let list = obj && (Array.isArray(obj) ? obj : obj.replies);
  if (!Array.isArray(list)) {
    // Last resort: numbered lines
    list = t.split('\n').map(l => l.replace(/^\s*\d+[.)]\s*/, '').trim()).filter(l => l && l.length < 300).map(l => ({ text: l, tag: '' }));
  }
  return list.map(x => (typeof x === 'string' ? { text: x, tag: '' } : { text: String(x.text || '').trim(), tag: String(x.tag || '').trim().slice(0, 40) }))
    .filter(x => x.text).slice(0, 3);
}

/* Returns { replies: [{text, tag}], model } or throws AIError */
PI.aiReplies = async function (person, db, signal) {
  const { system, user } = PI.aiPrompt(person, db);
  const speed = (db.ai && db.ai.speed) || 'fast';
  const order = [...new Set([db.ai.model, ...MODELS[speed]].filter(Boolean))];
  const base = {
    systemInstruction: { parts: [{ text: system }] },
    contents: [{ role: 'user', parts: [{ text: user }] }],
    generationConfig: { temperature: 0.95, maxOutputTokens: 2048, responseMimeType: 'application/json', responseSchema: SCHEMA },
    safetySettings: SAFETY
  };
  let lastErr = null;
  for (const model of order) {
    try {
      let text;
      try { text = await call(model, db.ai.key, base, signal); }
      catch (e) {
        if (e.code !== 'schema') throw e;
        const loose = JSON.parse(JSON.stringify(base)); delete loose.generationConfig.responseSchema;
        text = await call(model, db.ai.key, loose, signal);
      }
      const replies = parse(text);
      if (!replies.length) throw new AIError('empty', 'Gemini didn’t write anything for this one.');
      db.ai.model = model;
      return { replies, model };
    } catch (e) {
      if (e.name === 'AbortError') throw e;
      lastErr = e;
      if (e.code !== 'model') throw e; // only a missing model is worth trying the next one for
    }
  }
  throw lastErr || new AIError('model', 'No Gemini model was available.');
};

/* A tiny request to check the key works */
PI.aiTest = async function (db) {
  const speed = (db.ai && db.ai.speed) || 'fast';
  let lastErr = null;
  for (const model of [...new Set([db.ai.model, ...MODELS[speed]].filter(Boolean))]) {
    try {
      await call(model, db.ai.key, { contents: [{ role: 'user', parts: [{ text: 'Reply with the single word OK.' }] }], generationConfig: { maxOutputTokens: 256 } });
      db.ai.model = model; return model;
    } catch (e) { lastErr = e; if (e.code !== 'model') throw e; }
  }
  throw lastErr;
};
})(typeof window !== 'undefined' ? window : globalThis);
