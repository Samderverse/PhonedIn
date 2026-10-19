/* Phoned In: quick replies for texts you can't be bothered to answer properly.
   Everything runs on the phone. The only thing that leaves it is the optional "Ask ChatGPT" link. */
(() => {
'use strict';

const $ = s => document.querySelector(s);
const store = {
  get(k, d) { try { const v = JSON.parse(localStorage.getItem(k)); return v === null ? d : v; } catch (e) { return d; } },
  set(k, v) { try { localStorage.setItem(k, JSON.stringify(v)); } catch (e) {} }
};
const pick = a => a[Math.floor(Math.random() * a.length)];
const esc = s => String(s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));

/* ---------- Options ---------- */
const TONES = [
  ['warm', 'Warm'], ['chill', 'Chill'], ['dry', 'Dry'], ['excited', 'Excited'], ['busy', 'Busy'], ['cheeky', 'Cheeky']
];
const GOALS = [
  ['keep', 'Keep it going'], ['wind', 'Wind it down'], ['time', 'Buy time'], ['subject', 'Change the subject']
];
const EFFORTS = [
  [1, 'Minimal', 'a word or two'], [2, 'Normal', 'a line or two'], [3, 'Proper effort', 'a bit more']
];

/* ---------- Reading their message ---------- */
const RX = {
  serious: /\b(passed away|died|funeral|hospital|a ?& ?e\b|cancer|diagnos|miscarr|depress|panic attack|anxiety attack|suicid|self.?harm|can'?t cope|cannot cope|broke up|broken up|dumped me|split up|divorc|lost my job|made redundant|got sacked|been sacked|accident|in pieces|heartbroken)/i,
  needy: /(\byou there\b|\bhello+\s*\?|^\W*\?+\W*$|\bignoring me\b|\banswer me\b|\bwhy (aren'?t|are ?n'?t|r) (you|u) (replying|answering|texting)|\bhelloo+|\bhelo+\b|\bhey+\s*\?+|\boi+\b|\bearth to\b|\bwhere (are|r) (you|u)\b)/i,
  bad: /\b(sad|upset|awful|terrible|rubbish day|bad day|rough day|shit day|crap day|worst|fed up|so tired|knackered|exhausted|shattered|stressed|stressful|ill\b|sick\b|poorly|unwell|cold\b|flu\b|covid|headache|migraine|crying|cried|annoyed|fuming|raging|hate (my|this|it)|gutted|nightmare|ugh+|ffs|can'?t be bothered)/i,
  good: /\b(got the job|passed|i got in|engaged|pregnant|promot|good news|great news|guess what|so happy|so excited|amazing news|we won|i won|finally did it|new job|new house|got the keys|booked|smashed it|nailed it)\b|!!/i,
  plans: /\b(tonight|tomorrow|tmrw|tmw|this weekend|the weekend|next week|saturday|sunday|friday|monday|tuesday|wednesday|thursday|fancy|are you free|you free|free on|meet up|meetup|catch up|pub\b|drink|drinks|coffee|lunch|dinner|tea\b|come over|come round|pop round|plans\b|going out|night out|cinema|gig\b)/i,
  seen: /\b(did|have|has) (you|u|ya) (see|seen|watch|watched|hear|heard|catch|caught|read)\b|\bdid (you|u) know\b/i,
  howareyou: /\b(how are (you|u)|how r (u|you)|how('?s| is) (it going|things|life|you|ur day|your day)|you (ok|alright|good)\b|u (ok|alright|good)\b|wyd\b|what (are )?(you|u) up to|what('?s| is) up|wassup|sup\b|how have you been|how('?ve| have) (you|u) been)/i,
  photo: /(\bhttps?:\/\/|\bwww\.|image omitted|video omitted|photo omitted|sticker omitted|gif omitted|\btiktok|\binstagram|\breel\b|\blook at (this|these)|\bcheck (this|it) out|\bseen this|\bwatch this|\[photo\]|\[image\])/i,
  thanks: /\b(thanks|thank you|thank u|ty\b|cheers|appreciate it|you'?re the best|ur the best)\b/i,
  funny: /(\bhaha|\blol\b|\blmao|\blmfao|\brofl|😂|🤣|💀|\bdead\b|\bcrying\b(?=.*(😂|🤣|lol|haha)))/i,
  greeting: /^\s*(hi+|hey+|hiya|heya|hello|hellooo*|alright|morning|good morning|evening|yo+|oi oi)\b[\s!.,]*\S{0,20}\s*$/i,
  question: /\?\s*$|\?\s|^\s*(who|what|when|where|why|how|do|did|does|are|is|can|could|will|would|should|have|has|was|were|any)\b/i
};
const LABELS = {
  serious: 'something serious', needy: 'a "you there?" chaser', bad: 'a moan or bad news', good: 'good news', plans: 'plans',
  howareyou: 'a "how are you?"', photo: 'a link or photo', thanks: 'a thank you', funny: 'something funny', greeting: 'a hello',
  question: 'a question', seen: 'a "did you see…?"', long: 'an essay', default: 'general chat'
};
function detect(text) {
  const t = text.trim();
  if (!t) return null;
  if (RX.serious.test(t)) return 'serious';
  if (RX.needy.test(t)) return 'needy';
  if (RX.bad.test(t)) return 'bad';
  if (RX.good.test(t)) return 'good';
  if (RX.seen.test(t)) return 'seen';
  if (RX.plans.test(t)) return 'plans';
  if (RX.howareyou.test(t)) return 'howareyou';
  if (RX.photo.test(t)) return 'photo';
  if (RX.thanks.test(t)) return 'thanks';
  if (RX.funny.test(t)) return 'funny';
  if (t.length > 280) return 'long';
  if (RX.greeting.test(t)) return 'greeting';
  if (RX.question.test(t)) return 'question';
  return 'default';
}

/* ---------- The reply bank ---------- */
// {n} becomes " Dave" when you've set their name, or nothing when you haven't
const CORE = {
  greeting: {
    warm: ['hey{n}! good to hear from you', 'hiya{n}! how are you doing?', 'ah hello{n}!'],
    chill: ['hey{n}', 'alright{n}', 'hiya', 'heya{n}'],
    dry: ['hello', 'yes, hi', 'greetings', 'oh, hello'],
    excited: ['HEY{n}!!', 'omg hiya!!', 'hello hello!'],
    busy: ['hey{n}, bit of a manic one today', 'hiya, can’t chat long'],
    cheeky: ['oh look who it is', 'well well well{n}', 'to what do I owe the pleasure?']
  },
  howareyou: {
    warm: ['I’m good thanks! how are you doing?', 'not bad at all, how about you?', 'yeah really good thanks, you?'],
    chill: ['yeah not bad, you?', 'all good here, you?', 'can’t complain, you?', 'same old, you?'],
    dry: ['alive', 'surviving', 'fine. you?', 'functioning, mostly'],
    excited: ['really good actually!! you?', 'honestly great, how are YOU?'],
    busy: ['good but swamped, you?', 'all good, just mad busy', 'not bad, bit hectic'],
    cheeky: ['better now you’ve messaged', 'living the dream, obviously', 'thriving, as always']
  },
  question: {
    warm: ['ooh good question, let me have a think', 'hmm not sure, what do you reckon?', 'ah good question!'],
    chill: ['hmm not sure tbh', 'good question', 'honestly no idea', 'hmm, could be'],
    dry: ['unclear', 'no comment', 'the jury’s still out', 'hard to say'],
    excited: ['ooh good question!!', 'hmm let me think about that one!'],
    busy: ['will have to get back to you on that', 'can I answer that one later?'],
    cheeky: ['that’s classified', 'depends who’s asking', 'I could tell you, but then…']
  },
  seen: {
    warm: ['no, I missed it! was it good?', 'ooh no, tell me about it', 'not yet! any good?'],
    chill: ['nah missed it, any good?', 'no, was it good?', 'not yet, worth it?'],
    dry: ['I have not. I suspect I’ll survive', 'no. should I have?', 'missed it, tragically'],
    excited: ['no!! was it good?!', 'not yet, tell me everything!'],
    busy: ['not yet, will have a look later', 'missed it, been flat out'],
    cheeky: ['no, I have a life', 'I’ll pretend I did']
  },
  plans: {
    warm: ['that sounds lovely, let me check what I’ve got on', 'would be nice to catch up, let me have a look'],
    chill: ['could do, let me see', 'maybe, what time were you thinking?', 'possibly, let me check'],
    dry: ['I’ll consult the diary', 'potentially', 'noted. pending review'],
    excited: ['ooh that sounds fun! let me check I’m free', 'ooh go on then, let me check my diary'],
    busy: ['not sure I can this time, it’s a bit hectic', 'let me check what I’ve got on and get back to you'],
    cheeky: ['only if you’re buying', 'depends, is there food involved?', 'I’ll check my very busy social calendar']
  },
  good: {
    warm: ['that’s brilliant, so pleased for you!', 'aw amazing news, well done!', 'that’s so good to hear!'],
    chill: ['ah nice one!', 'love that', 'get in!', 'oh nice!'],
    dry: ['congrats, I’ll allow it', 'well done. obviously', 'not bad, not bad'],
    excited: ['NO WAY that’s amazing!!', 'omg congratulations!!!', 'yesss that’s brilliant!!'],
    busy: ['amazing, well done!', 'brilliant news, congrats!'],
    cheeky: ['about time something went your way', 'look at you go', 'who even are you'],
  },
  bad: {
    warm: ['aw no, sorry you’re having a rough time', 'oh no, that sounds rubbish. you ok?', 'aw that’s not nice, hope you’re ok'],
    chill: ['ah that’s rubbish', 'aw no, hope it gets better', 'ugh, that sucks'],
    dry: ['that’s grim', 'ugh, rough', 'sounds bleak'],
    excited: ['aw no, that’s rubbish! hope it picks up', 'oh no! sending hugs'],
    busy: ['aw that’s rubbish, hope you’re ok', 'sorry to hear that, hope it picks up'],
    cheeky: ['oh no, need me to fight someone?', 'sending emergency biscuits', 'that calls for a takeaway']
  },
  serious: { // tone is ignored for these
    warm: ['oh no, I’m really sorry. are you ok?', 'that’s awful, I’m so sorry. I’m here if you want to talk', 'I’m so sorry, that’s really hard. do you want to chat later?', 'oh mate, I’m really sorry. how are you doing?']
  },
  needy: {
    warm: ['sorry! here now, what’s up?', 'sorry, been a bit all over the place today', 'sorry, I’m here!'],
    chill: ['here, sorry!', 'sorry, was busy. what’s up?', 'yep here'],
    dry: ['I live', 'yes, I’m here', 'still alive, don’t worry'],
    excited: ['I’m here!! sorry!', 'sorry sorry! what’s happening?'],
    busy: ['sorry, mad day', 'sorry, been flat out today'],
    cheeky: ['patience is a virtue', 'missed me that much?', 'I was gone for five minutes']
  },
  photo: {
    warm: ['aw that’s lovely', 'ah I love that', 'that’s brilliant'],
    chill: ['ha nice', 'love it', 'class', 'quality'],
    dry: ['I’ve seen it', 'noted', 'yes, I saw'],
    excited: ['omg I love this!!', 'this is amazing'],
    busy: ['ha brilliant, will look properly later', 'love it'],
    cheeky: ['frame it', 'content.', 'you’ve outdone yourself']
  },
  thanks: {
    warm: ['any time!', 'no problem at all', 'of course, any time'],
    chill: ['no worries', 'no probs', 'nw'],
    dry: ['you’re welcome, I suppose', 'I accept payment in biscuits'],
    excited: ['of course!!', 'any time!!'],
    busy: ['no problem!', 'no worries!'],
    cheeky: ['you owe me one', 'I’ll add it to your tab']
  },
  funny: {
    warm: ['haha love that', 'that’s brilliant', 'haha you’re funny'],
    chill: ['haha', 'dead', 'ha love it', 'that’s class'],
    dry: ['hilarious', 'I laughed. internally', 'a solid 6/10'],
    excited: ['HAHA stop', 'I’m crying', 'this is so funny'],
    busy: ['haha brilliant'],
    cheeky: ['you think you’re funny don’t you', 'I’ll allow it']
  },
  long: {
    warm: ['oh wow, that’s a lot. how are you feeling about it all?', 'sounds like a lot going on, you ok?'],
    chill: ['wow, that’s a lot', 'blimey, what a saga', 'that’s mad'],
    dry: ['that’s a novel', 'I’ll wait for the audiobook', 'chapter one was gripping'],
    excited: ['omg that’s so much!!', 'wow, what a story!'],
    busy: ['sorry, will read this properly later!', 'that’s a lot, can we chat properly later?'],
    cheeky: ['tldr?', 'this needs chapters', 'I’ve made a brew for this one']
  },
  default: {
    warm: ['aw that’s nice', 'ah fair enough', 'aw love that'],
    chill: ['ah fair', 'nice one', 'ha yeah', 'fair enough', 'ah right'],
    dry: ['ok', 'noted', 'riveting', 'fascinating'],
    excited: ['ooh!', 'love that!', 'oh nice!!'],
    busy: ['ah nice, will message properly later', 'ah fair enough'],
    cheeky: ['bold of you', 'interesting choice', 'if you say so']
  }
};
const MINIMAL = {
  greeting: ['hey', 'hiya', 'alright', 'hi'],
  howareyou: ['good u?', 'not bad, you?', 'fine ta', 'yeah good'],
  question: ['hmm not sure', 'maybe', 'dunno tbh', 'possibly'],
  seen: ['nah, any good?', 'missed it', 'not yet', 'no?'],
  plans: ['maybe!', 'could do', 'will see', 'possibly'],
  good: ['nice one!', 'amazing', 'congrats!', 'get in'],
  bad: ['aw no', 'ah rubbish', 'oh no', 'ugh'],
  needy: ['here!', 'sorry!', 'alive', 'yep'],
  photo: ['ha love', 'class', 'nice', 'love it'],
  thanks: ['nw', 'no probs', 'anytime', 'np'],
  funny: ['haha', 'dead', 'ha', 'lol'],
  long: ['wow', 'blimey', 'no way', 'mad'],
  default: ['ha yeah', 'nice', 'fair', 'ah right', 'ok']
};
const GOAL = {
  keep: {
    warm: ['how’s your week been?', 'what have you been up to?', 'how are things with you?'],
    chill: ['what you up to?', 'anything happening your end?', 'what’s new?'],
    dry: ['what’s new in your world', 'how’s life treating you'],
    excited: ['what else is new?!', 'tell me everything!', 'what are you up to this week?!'],
    busy: ['how’s things with you?'],
    cheeky: ['anyway, what trouble have you been getting into?', 'what’s the gossip?']
  },
  wind: {
    warm: ['anyway, I’d better crack on. speak soon!', 'gonna get my head down now, chat tomorrow', 'right, I’m off, speak soon'],
    chill: ['anyway, catch you later', 'right, I’m off. speak soon', 'gonna crash, laters'],
    dry: ['anyway. that’s enough socialising for one day', 'right, signing off'],
    excited: ['ok gotta dash, speak soon!!', 'right I’m off, chat soon!'],
    busy: ['gotta run, speak later!', 'need to crack on, speak soon'],
    cheeky: ['right, I’m off before you start another essay', 'I’m logging off, try not to miss me']
  },
  time: {
    warm: ['can I message you properly later?', 'let me get back to you properly tonight'],
    chill: ['will message you later', 'speak properly later?', 'will get back to you in a bit'],
    dry: ['I’ll get back to you. at some point'],
    excited: ['will message properly later, promise!'],
    busy: ['mad busy right now, will reply properly later', 'swamped, will message tonight'],
    cheeky: ['I’ll pencil you in for later', 'my people will get back to your people']
  },
  subject: {
    warm: ['anyway, how’s work been?', 'seen anything good on telly lately?', 'anyway, any plans for the weekend?'],
    chill: ['random, but watched anything good lately?', 'anyway, how’s the week going?'],
    dry: ['anyway. weather, eh?', 'in other news, how’s work'],
    excited: ['ooh random, but have you got plans for the weekend?!'],
    busy: ['anyway, how’s things?'],
    cheeky: ['anyway, more importantly, what’s for tea?', 'anyway, enough about that. biscuits: thoughts?']
  }
};
// "Proper effort" adds one of these between the reaction and the goal
const EXTRA = {
  warm: ['hope you’re doing ok', 'it feels like ages', 'hope the week’s been kind to you'],
  chill: ['been a long week here', 'not much going on this end', 'been a quiet one here'],
  dry: ['nothing to report here, obviously', 'my life remains thrilling', 'all quiet on my end'],
  excited: ['feels like ages!', 'it’s been too long!'],
  busy: ['it’s been non-stop here', 'work’s been mental'],
  cheeky: ['I’ve been very busy and important', 'my social calendar is rammed, obviously']
};
const SORRY = ['sorry, only just seen this!', 'sorry, just seen this', 'ah sorry, phone’s been on silent', 'sorry, been a bit useless with my phone today'];
const SHORT_GOAL = { wind: ['laters', 'speak soon', 'night!'], time: ['will message later', 'speak later'] };
const EMOJI = {
  warm: ['😊', '🙂', '☺️'], chill: ['👍', '😅', '🙌'], dry: ['🙃', '👀'], excited: ['🎉', '😍', '🥳'], busy: ['🙈', '😅'], cheeky: ['😏', '😜', '😉'],
  bad: ['💛', '🫶', '🫂'], serious: ['💛'], funny: ['😂', '🤣', '💀'], good: ['🎉', '🙌', '🥳'], photo: ['😍', '🙌'], thanks: ['🙌', '😊']
};
const HAS_EMOJI = /\p{Extended_Pictographic}/u;

/* ---------- Building replies ---------- */
function polish(s, o) {
  s = s.replace(/\{n\}/g, o.name ? ' ' + o.name : '').replace(/\s+([,.!?])/g, '$1').replace(/\s{2,}/g, ' ').trim();
  if (o.lower) return s.toLowerCase();
  // Sentence case, and a capital "I"
  s = s.replace(/(^|[.!?]\s+)([a-z])/g, (m, a, b) => a + b.toUpperCase()).replace(/\bi\b/g, 'I').replace(/\bi’/g, 'I’');
  if (o.name) s = s.replace(new RegExp('\\b' + o.name.toLowerCase().replace(/[.*+?^${}()|[\]\\]/g, '\\$&') + '\\b', 'g'), o.name);
  return s;
}
function join(parts) {
  return parts.filter(Boolean).map((p, i, a) => (i < a.length - 1 && !/[.!?…)]$/.test(p) ? p + '.' : p)).join(' ');
}
function linesFor(bank, cat, tone) {
  const c = bank[cat] || bank.default;
  return c[tone] || c.warm || c.chill;
}
function buildOne(cat, o, used = new Set()) {
  const serious = cat === 'serious';
  const tone = serious ? 'warm' : o.tone;
  const effort = serious ? Math.max(2, o.effort) : o.effort;
  const goal = serious ? 'keep' : o.goal;
  const parts = [];
  if (o.sorry && cat !== 'needy' && !serious) parts.push(pick(SORRY));
  if (effort === 1) {
    const mpool = MINIMAL[cat] || MINIMAL.default, mfresh = mpool.filter(l => !used.has(l));
    const m = pick(mfresh.length ? mfresh : mpool); used.add(m); parts.push(m);
    if (goal === 'wind' || goal === 'time') parts.push(pick(SHORT_GOAL[goal]));
  } else {
    // Prefer a reaction the other suggestions haven't used, so the three options feel different
    const pool = linesFor(CORE, cat, tone), fresh = pool.filter(l => !used.has(l));
    const first = pick(fresh.length ? fresh : pool);
    used.add(first); parts.push(first);
    if (effort === 3 && !serious && !/\?$/.test(first)) parts.push(pick(EXTRA[tone] || EXTRA.chill));
    // A "how are you" core already asks back, and serious replies don't need a chirpy follow-up
    const asksAlready = parts.some(p => /\?$/.test(p));
    if (!serious && !(goal === 'keep' && asksAlready)) parts.push(pick(linesFor(GOAL, goal, tone)));
    if (serious && effort === 3) parts.push('want me to give you a ring?');
  }
  let s = polish(join(parts), o);
  if (o.emoji && !HAS_EMOJI.test(s) && Math.random() < 0.8) {
    const set = EMOJI[cat] && cat !== 'default' ? EMOJI[cat] : EMOJI[tone];
    s += ' ' + pick(set);
  }
  if (o.kiss) s += ' x';
  return s;
}
function buildReplies(cat, o, n = 3) {
  const out = new Set(), used = new Set();
  for (let i = 0; i < 40 && out.size < n; i++) out.add(buildOne(cat, o, used));
  return [...out];
}

/* ---------- ChatGPT request ---------- */
function gptPrompt(o) {
  const msg = $('#msg').value.trim(), ctx = $('#ctx').value.trim(), style = store.get('pi_style', '').trim();
  const tone = TONES.find(t => t[0] === o.tone)[1].toLowerCase();
  const goal = { keep: 'keep the conversation going', wind: 'politely wind the conversation down', time: 'buy me some time and say I’ll reply properly later', subject: 'steer onto a different subject' }[o.goal];
  const len = { 1: 'as short as possible, one to four words', 2: 'one short sentence or two', 3: 'two or three sentences' }[o.effort];
  const lines = [
    `Help me reply to a text message from ${o.name ? 'my friend ' + o.name : 'a friend'}.`,
    ctx ? `Earlier in the chat:\n"""\n${ctx}\n"""` : '',
    `Their latest message:\n"""\n${msg || '(paste their message here)'}\n"""`,
    `Write 3 different replies I can copy and paste. Tone: ${tone}. Goal: ${goal}. Length: ${len}.`,
    `Style: casual British texting, like a real person, not an assistant. ${o.lower ? 'All lowercase. ' : ''}${o.emoji ? 'An emoji is fine. ' : 'No emoji. '}${o.kiss ? 'End with an x. ' : ''}${o.sorry ? 'Start with a quick sorry for the slow reply. ' : ''}Don’t agree to plans or promise anything on my behalf.`,
    style ? `How I usually text: ${style}` : '',
    'If their message sounds serious or upsetting, ignore the low-effort brief and suggest kind, supportive replies instead.',
    'Reply with just the 3 options, numbered, nothing else.'
  ];
  return lines.filter(Boolean).join('\n\n');
}

/* ---------- UI ---------- */
let toastT;
function toast(t) {
  const el = $('#toast'); el.textContent = t; el.hidden = false;
  clearTimeout(toastT); toastT = setTimeout(() => { el.hidden = true; }, 2000);
}
async function copyText(t) {
  try { await navigator.clipboard.writeText(t); return true; } catch (e) {
    const ta = document.createElement('textarea'); ta.value = t; ta.setAttribute('readonly', ''); ta.style.position = 'fixed'; ta.style.opacity = '0';
    document.body.appendChild(ta); ta.select(); ta.setSelectionRange(0, t.length);
    let ok = false; try { ok = document.execCommand('copy'); } catch (err) {}
    ta.remove(); return ok;
  }
}
function radios(el, name, list, current, render) {
  el.innerHTML = list.map(([v, label, small]) => `<label class="chip"><input type="radio" name="${name}" value="${v}"${String(v) === String(current) ? ' checked' : ''}><span>${render ? render(v, label, small) : esc(label)}</span></label>`).join('');
}
const opts = () => ({
  tone: (document.querySelector('input[name=tone]:checked') || {}).value || 'chill',
  goal: (document.querySelector('input[name=goal]:checked') || {}).value || 'keep',
  effort: +((document.querySelector('input[name=effort]:checked') || {}).value || 2),
  emoji: $('#tEmoji').checked, sorry: $('#tSorry').checked, kiss: $('#tKiss').checked, lower: $('#tLower').checked,
  name: store.get('pi_name', '').trim()
});

const saved = store.get('pi_opts', {});
radios($('#tones'), 'tone', TONES, saved.tone || 'chill');
radios($('#goals'), 'goal', GOALS, saved.goal || 'keep');
radios($('#efforts'), 'effort', EFFORTS, saved.effort || 2, (v, label, small) =>
  `<span class="bars" aria-hidden="true">${[1, 2, 3].map(i => `<i class="${i <= v ? 'on' : ''}"></i>`).join('')}</span>${esc(label)}<small>${esc(small)}</small>`);
$('#tEmoji').checked = !!saved.emoji; $('#tSorry').checked = !!saved.sorry; $('#tKiss').checked = !!saved.kiss; $('#tLower').checked = saved.lower !== false;

function saveOpts() {
  const o = opts(); store.set('pi_opts', { tone: o.tone, goal: o.goal, effort: o.effort, emoji: o.emoji, sorry: o.sorry, kiss: o.kiss, lower: o.lower });
  $('#effortName').textContent = '';
  updateGpt();
  if (!$('#results').hidden) generate();
}
document.querySelector('.controls').addEventListener('change', saveOpts);

function updateDetect() {
  const cat = detect($('#msg').value);
  const name = store.get('pi_name', '').trim();
  $('#fromLabel').textContent = name ? `${name} said` : 'Their message';
  $('#detect').innerHTML = cat ? `Sounds like <b>${LABELS[cat]}</b>` : '';
}
let typing;
$('#msg').addEventListener('input', () => { clearTimeout(typing); typing = setTimeout(() => { updateDetect(); updateGpt(); }, 250); });
$('#ctx').addEventListener('input', () => { clearTimeout(typing); typing = setTimeout(updateGpt, 250); });

function generate() {
  const text = $('#msg').value;
  if (!text.trim()) { toast('Paste their message first'); $('#msg').focus(); return; }
  const cat = detect(text), o = opts();
  const replies = buildReplies(cat, o);
  const banner = $('#banner');
  if (cat === 'serious') {
    banner.hidden = false;
    banner.textContent = 'This one sounds serious, so these replies ignore your settings and stay kind. It might deserve a proper chat, or a call.';
  } else banner.hidden = true;
  $('#replies').innerHTML = replies.map(r => `<button class="reply" type="button">${esc(r)}<span class="tag">Tap to copy</span></button>`).join('');
  $('#replies').querySelectorAll('.reply').forEach((b, i) => b.onclick = async () => {
    const ok = await copyText(replies[i]);
    document.querySelectorAll('.reply').forEach(x => { x.classList.remove('copied'); x.querySelector('.tag').textContent = 'Tap to copy'; });
    if (ok) { b.classList.add('copied'); b.querySelector('.tag').textContent = 'Copied: paste it in WhatsApp'; }
    else toast('Couldn’t copy. Press and hold the text instead.');
  });
  $('#results').hidden = false;
}
$('#goBtn').onclick = () => { generate(); $('#results').scrollIntoView({ behavior: 'smooth', block: 'start' }); };
$('#shuffleBtn').onclick = generate;

$('#pasteBtn').onclick = async () => {
  try {
    const t = await navigator.clipboard.readText();
    if (t) { $('#msg').value = t; updateDetect(); updateGpt(); toast('Pasted'); return; }
  } catch (e) {}
  $('#msg').focus(); toast('Press and hold in the box, then tap Paste');
};
$('#clearBtn').onclick = () => { $('#msg').value = ''; $('#ctx').value = ''; $('#results').hidden = true; updateDetect(); updateGpt(); $('#msg').focus(); };
$('#ctxBtn').onclick = () => {
  const open = $('#ctxWrap').hidden; $('#ctxWrap').hidden = !open;
  $('#ctxBtn').setAttribute('aria-expanded', open); $('#ctxBtn').textContent = open ? '− Earlier messages' : '+ Earlier messages';
};

function updateGpt() { $('#gptBtn').href = 'https://chatgpt.com/?q=' + encodeURIComponent(gptPrompt(opts())); }
$('#gptBtn').addEventListener('click', e => {
  if (!$('#msg').value.trim()) { e.preventDefault(); toast('Paste their message first'); return; }
  updateGpt();
  copyText(gptPrompt(opts())); // also on the clipboard, in case ChatGPT opens empty
});
$('#gptCopy').onclick = async () => {
  if (!$('#msg').value.trim()) { toast('Paste their message first'); return; }
  toast((await copyText(gptPrompt(opts()))) ? 'Copied. Paste it into ChatGPT' : 'Couldn’t copy on this phone');
};

/* Settings */
const modal = $('#settings');
$('#setBtn').onclick = () => { $('#sName').value = store.get('pi_name', ''); $('#sStyle').value = store.get('pi_style', ''); modal.hidden = false; setTimeout(() => $('#sName').focus(), 50); };
function closeSettings() {
  store.set('pi_name', $('#sName').value.trim()); store.set('pi_style', $('#sStyle').value.trim());
  modal.hidden = true; updateDetect(); updateGpt(); if (!$('#results').hidden) generate();
}
modal.addEventListener('click', e => { if (e.target.closest('[data-close]')) closeSettings(); });
document.addEventListener('keydown', e => { if (e.key === 'Escape' && !modal.hidden) closeSettings(); });

updateDetect(); updateGpt();

// For testing in a browser console
window.PhonedIn = { detect, buildReplies };
})();
