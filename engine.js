/* Phoned In v2 reply engine. Pure functions with no page code, so it can be tested on its own.
   Everything runs on the phone. */
(function (root) {
'use strict';
const PI = root.PI = root.PI || {};
const COMMON = root.PI_COMMON || new Set();
const KNOWN = root.PI_KNOWN || COMMON;

let rand = Math.random;
PI.setRandom = f => { rand = f || Math.random; };
const pick = a => a[Math.floor(rand() * a.length)];
const chance = p => rand() < p;
const now = () => Date.now();

/* ---------- Options ---------- */
PI.TONES = [['warm', 'Warm'], ['chill', 'Chill'], ['dry', 'Dry'], ['excited', 'Excited'], ['busy', 'Busy'], ['cheeky', 'Cheeky']];
PI.GOALS = [['keep', 'Keep it going'], ['wind', 'Wind it down'], ['time', 'Buy time'], ['subject', 'Change the subject']];
PI.EFFORTS = [[1, 'Minimal', 'a word or two'], [2, 'Normal', 'a line or two'], [3, 'Proper effort', 'a bit more']];
PI.SWEARS = [[0, 'Off', 'clean'], [1, 'Mild', 'bloody, crap'], [2, 'Full', 'the works']];
PI.KINDS = [['person', 'Person'], ['pet', 'Pet'], ['place', 'Place'], ['thing', 'Thing']];
PI.defaultSettings = () => ({ tone: 'chill', goal: 'keep', effort: 2, emoji: false, sorry: false, kiss: false, lower: true, swear: 0 });

/* ---------- Reading a message ---------- */
const RX = {
  serious: /\b(passed away|died|funeral|hospital|a ?& ?e\b|cancer|diagnos|miscarr|depress|panic attack|anxiety attack|suicid|self.?harm|can'?t cope|cannot cope|broke up|broken up|dumped me|split up|divorc|lost my job|made redundant|got sacked|been sacked|accident|in pieces|heartbroken)/i,
  needy: /(\byou there\b|\bu there\b|\bhello+\s*\?|^\W*\?+\W*$|\bignoring me\b|\banswer me\b|\bwhy (aren'?t|are ?n'?t|r) (you|u) (replying|answering|texting)|\bhelloo+|\bhelo+\b|\bhey+\s*\?+|\boi+\b|\bearth to\b|\bwhere (are|r) (you|u)\b)/i,
  bad: /\b(sad|upset|awful|terrible|rubbish day|bad day|rough day|shit day|crap day|worst|fed up|so tired|knackered|exhausted|shattered|stressed|stressful|ill\b|sick\b|poorly|unwell|cold\b|flu\b|covid|headache|migraine|crying|cried|annoyed|fuming|raging|hate (my|this|it)|gutted|nightmare|ugh+|ffs|can'?t be bothered)/i,
  good: /\b(got the job|passed|i got in|engaged|pregnant|promot|good news|great news|guess what|so happy|so excited|amazing news|we won|i won|finally did it|new job|new house|got the keys|booked|smashed it|nailed it)\b|!!/i,
  seen: /\b(did|have|has) (you|u|ya) (see|seen|watch|watched|hear|heard|catch|caught|read)\b|\bdid (you|u) know\b/i,
  plans: /\b(tonight|tomorrow|tmrw|tmw|this weekend|the weekend|next week|saturday|sunday|friday|monday|tuesday|wednesday|thursday|fancy|are you free|you free|free on|meet up|meetup|catch up|pub\b|drink|drinks|coffee|lunch|dinner|tea\b|come over|come round|pop round|plans\b|going out|night out|cinema|gig\b)/i,
  howareyou: /\b(how are (you|u)|how r (u|you)|how('?s| is) (it going|things|life|you|ur day|your day)|you (ok|alright|good)\b|u (ok|alright|good)\b|wyd\b|what (are )?(you|u) up to|what('?s| is) up|wassup|sup\b|how have you been|how('?ve| have) (you|u) been)/i,
  photo: /(\bhttps?:\/\/|\bwww\.|image omitted|video omitted|photo omitted|sticker omitted|gif omitted|\btiktok|\binstagram|\breel\b|\blook at (this|these)|\bcheck (this|it) out|\bseen this|\bwatch this|\[photo\]|\[image\])/i,
  thanks: /\b(thanks|thank you|thank u|ty\b|cheers|appreciate it|you'?re the best|ur the best)\b/i,
  funny: /(\bhaha|\blol\b|\blmao|\blmfao|\brofl|😂|🤣|💀|\bdead\b)/i,
  greeting: /^\s*(hi+|hey+|hiya|heya|hello|hellooo*|alright|morning|good morning|evening|yo+|oi oi)\b[\s!.,]*\S{0,20}\s*$/i,
  question: /\?\s*$|\?\s|^\s*(who|what|when|where|why|how|do|did|does|are|is|can|could|will|would|should|have|has|was|were|any)\b/i
};
PI.LABELS = {
  serious: 'something serious', needy: 'a "you there?" chaser', bad: 'a moan or bad news', good: 'good news', plans: 'plans',
  seen: 'a "did you see…?"', howareyou: 'a "how are you?"', photo: 'a link or photo', thanks: 'a thank you', funny: 'something funny',
  greeting: 'a hello', question: 'a question', long: 'an essay', default: 'general chat'
};
PI.detect = function (text) {
  const t = String(text || '').trim();
  if (!t) return null;
  for (const c of ['serious', 'needy', 'bad', 'good', 'seen', 'plans', 'howareyou', 'photo', 'thanks', 'funny']) if (RX[c].test(t)) return c;
  if (t.length > 280) return 'long';
  if (RX.greeting.test(t)) return 'greeting';
  if (RX.question.test(t)) return 'question';
  return 'default';
};
// Which message to answer first when several arrive at once
const PRIORITY = ['serious', 'bad', 'good', 'plans', 'seen', 'question', 'howareyou', 'photo', 'funny', 'thanks', 'long', 'greeting', 'needy', 'default'];

/* ---------- The reply bank ---------- */
// {n} becomes their name; {x} is filled in by profile hooks
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
    cheeky: ['about time something went your way', 'look at you go', 'who even are you']
  },
  bad: {
    warm: ['aw no, sorry you’re having a rough time', 'oh no, that sounds rubbish. you ok?', 'aw that’s not nice, hope you’re ok'],
    chill: ['ah that’s rubbish', 'aw no, hope it gets better', 'ugh, that sucks'],
    dry: ['that’s grim', 'ugh, rough', 'sounds bleak'],
    excited: ['aw no, that’s rubbish! hope it picks up', 'oh no! sending hugs'],
    busy: ['aw that’s rubbish, hope you’re ok', 'sorry to hear that, hope it picks up'],
    cheeky: ['oh no, need me to fight someone?', 'sending emergency biscuits', 'that calls for a takeaway']
  },
  serious: {
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
  greeting: ['hey', 'hiya', 'alright', 'hi'], howareyou: ['good u?', 'not bad, you?', 'fine ta', 'yeah good'],
  question: ['hmm not sure', 'maybe', 'dunno tbh', 'possibly'], seen: ['nah, any good?', 'missed it', 'not yet', 'no?'],
  plans: ['maybe!', 'could do', 'will see', 'possibly'], good: ['nice one!', 'amazing', 'congrats!', 'get in'],
  bad: ['aw no', 'ah rubbish', 'oh no', 'ugh'], needy: ['here!', 'sorry!', 'alive', 'yep'],
  photo: ['ha love', 'class', 'nice', 'love it'], thanks: ['nw', 'no probs', 'anytime', 'np'],
  funny: ['haha', 'dead', 'ha', 'lol'], long: ['wow', 'blimey', 'no way', 'mad'], default: ['ha yeah', 'nice', 'fair', 'ah right', 'ok']
};
// Swearing lines, mixed in at the chosen level. Never used for serious messages.
const SWEAR = {
  1: {
    greeting: ['alright you', 'oh bloody hell, it’s you'], howareyou: ['knackered, but alive. you?', 'bloody shattered, you?'],
    question: ['bloody hell, no idea', 'god knows tbh'], seen: ['nah, any bloody good?', 'no, was it crap?'],
    plans: ['go on then, sod it, let me check', 'bloody hell, let me check the diary'], good: ['bloody brilliant!', 'get in, you legend!'],
    bad: ['ah that’s crap', 'bloody hell, that’s rough', 'sod that, sounds rubbish'], needy: ['bloody hell, I’m here!', 'calm down, I’m here 😂'],
    photo: ['bloody love that', 'that’s bloody brilliant'], thanks: ['no bother, you muppet', 'don’t be daft'],
    funny: ['bloody hell 😂', 'you daft sod'], long: ['bloody hell, what a saga', 'crikey, that’s a lot'], default: ['fair play', 'bloody hell', 'sod it, fair enough']
  },
  2: {
    greeting: ['alright you knob', 'oh fuck, it’s you 😂'], howareyou: ['fucking knackered, you?', 'shit, but alive. you?'],
    question: ['fuck knows tbh', 'no fucking idea'], seen: ['nah, any fucking good?', 'no, was it shit?'],
    plans: ['go on then, fuck it, let me check', 'shit, let me check what I’ve got on'], good: ['fucking get in!', 'that’s fucking brilliant'],
    bad: ['ah that’s shit', 'fucking hell, that’s grim', 'ffs, that’s rubbish'], needy: ['fucking hell, I’m here! 😂', 'chill, I’m here ffs'],
    photo: ['that’s fucking class', 'love that shit'], thanks: ['no bother, you knob', 'don’t be soft'],
    funny: ['fucking hell 😂', 'I’m dead, that’s fucking brilliant'], long: ['fucking hell, what a saga', 'shit, that’s a lot'], default: ['fair fucking play', 'fucking hell', 'shit, fair enough']
  }
};
const SWAPS = {
  1: [[/\brubbish\b/, 'crap'], [/\bblimey\b/, 'bloody hell'], [/\bwow\b/, 'bloody hell'], [/\breally good\b/, 'bloody good'], [/\bthat’s mad\b/, 'that’s bloody mad']],
  2: [[/\brubbish\b/, 'shit'], [/\bthat sucks\b/, 'that’s shit'], [/\bblimey\b/, 'fucking hell'], [/\bwow\b/, 'fucking hell'], [/\bno way\b/, 'no fucking way'], [/\bbrilliant\b/, 'fucking brilliant'], [/\bugh\b/, 'ffs']]
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
const EXTRA = {
  warm: ['hope you’re doing ok', 'it feels like ages', 'hope the week’s been kind to you'],
  chill: ['been a long week here', 'not much going on this end', 'been a quiet one here'],
  dry: ['nothing to report here, obviously', 'my life remains thrilling', 'all quiet on my end'],
  excited: ['feels like ages!', 'it’s been too long!'],
  busy: ['it’s been non-stop here', 'work’s been mental'],
  cheeky: ['I’ve been very busy and important', 'my social calendar is rammed, obviously']
};
// A short second clause when several messages arrive at once ("…and yeah, let me check about friday")
const ALSO = {
  howareyou: ['all good here btw', 'I’m good btw'], plans: ['and let me check what I’ve got on', 'and could do, let me check'],
  seen: ['and no, haven’t seen it yet'], good: ['and congrats btw!', 'and nice news btw'], bad: ['and sorry about earlier', 'hope you’re feeling better btw'],
  question: ['not sure about the other thing tbh'], photo: ['and love that btw', 'and the pic is class'], funny: ['and that was funny btw'], thanks: ['and no worries']
};
const SORRY = ['sorry, only just seen this!', 'sorry, just seen this', 'ah sorry, phone’s been on silent', 'sorry, been a bit useless with my phone today'];
const SHORT_GOAL = { wind: ['laters', 'speak soon', 'night!'], time: ['will message later', 'speak later'] };
const ESCALATE = ['{c} messages in {m}, you ok? 😂', 'alright alright, I’m here', 'I see you’ve been busy', 'calm down, I’m here 😂', 'blimey, someone’s keen'];
const HOOKS = {
  person: ['say hi to {x} for me', 'how’s {x} getting on?', 'ah, how is {x}?'],
  pet: ['give {x} a fuss from me', 'how’s {x} doing?'],
  place: ['ooh, {x}', '{x}? nice'],
  thing: ['how’s {x} going?', 'any news on {x}?']
};
const ASK = ['how’s {x}?', 'any news on {x}?', 'how’s {x} doing?'];
const EMOJI = {
  warm: ['😊', '🙂', '☺️'], chill: ['👍', '😅', '🙌'], dry: ['🙃', '👀'], excited: ['🎉', '😍', '🥳'], busy: ['🙈', '😅'], cheeky: ['😏', '😜', '😉'],
  bad: ['💛', '🫶', '🫂'], serious: ['💛'], funny: ['😂', '🤣', '💀'], good: ['🎉', '🙌', '🥳'], photo: ['😍', '🙌'], thanks: ['🙌', '😊']
};
const HAS_EMOJI = /\p{Extended_Pictographic}/u;
const PETS = ['mate', 'pal', 'bro', 'babe', 'hun', 'lad', 'love', 'chuck', 'pet'];

/* ---------- Reading the thread ---------- */
const HOUR = 36e5;
PI.pending = function (person) {
  const t = person.thread || [], out = [];
  for (let i = t.length - 1; i >= 0 && t[i].from === 'them'; i--) out.unshift(t[i]);
  return out.slice(-6);
};
PI.analyse = function (person, at = now()) {
  const t = person.thread || [];
  const pending = PI.pending(person);
  const cats = pending.map(m => PI.detect(m.text)).filter(Boolean);
  const uniq = [...new Set(cats)].sort((a, b) => PRIORITY.indexOf(a) - PRIORITY.indexOf(b));
  const primary = uniq[0] || null;
  const secondary = uniq.find(c => c !== primary && ALSO[c]) || null;
  const dayStart = new Date(at); dayStart.setHours(0, 0, 0, 0);
  const theirs = t.filter(m => m.from === 'them');
  const chasersToday = theirs.filter(m => m.t >= dayStart.getTime() && PI.detect(m.text) === 'needy').length;
  const burst = theirs.filter(m => m.t >= at - 30 * 6e4);
  const burstMins = burst.length > 1 ? Math.max(1, Math.round((burst[burst.length - 1].t - burst[0].t) / 6e4)) : 0;
  const recentBad = t.some(m => m.from === 'them' && m.t >= at - 24 * HOUR && ['bad', 'serious'].includes(PI.detect(m.text)));
  const recentSerious = t.some(m => m.from === 'them' && m.t >= at - 48 * HOUR && PI.detect(m.text) === 'serious');
  const myHour = t.filter(m => m.from === 'me' && m.t >= at - HOUR).length;
  return { pending, cats, primary, secondary, hasNeedy: uniq.includes('needy'), chasersToday, burst: burst.length, burstMins, recentBad, recentSerious, longChat: myHour >= 8 };
};

/* ---------- Building replies ---------- */
function fill(s, o) {
  return s.replace(/\{n\}/g, o.name ? ' ' + o.name : '').replace(/\{x\}/g, o.x || '').replace(/\{c\}/g, o.c || '').replace(/\{m\}/g, o.m || '');
}
function polish(s, o, style) {
  s = fill(s, o).replace(/\s+([,.!?])/g, '$1').replace(/\s{2,}/g, ' ').trim();
  if (style && style.laugh && style.laugh !== 'haha') s = s.replace(/\bhaha\b/gi, style.laugh);
  if (o.lower) s = s.toLowerCase();
  else {
    s = s.replace(/(^|[.!?]\s+)([a-z])/g, (m, a, b) => a + b.toUpperCase()).replace(/\bi\b/g, 'I').replace(/\bi’/g, 'I’');
    for (const nm of o.keepCase || []) if (nm) s = s.replace(new RegExp('\\b' + nm.toLowerCase().replace(/[.*+?^${}()|[\]\\]/g, '\\$&') + '\\b', 'g'), nm);
  }
  if (style && style.stopRate < 0.15) s = s.replace(/\.$/, '');
  return s;
}
function join(parts) {
  return parts.filter(Boolean).map((p, i, a) => (i < a.length - 1 && !/[.!?…)😂🤣]$/u.test(p) ? p + '.' : p)).join(' ');
}
function lines(bank, cat, tone) { const c = bank[cat] || bank.default; return c[tone] || c.warm || c.chill; }
function fresh(pool, used, recent) {
  const f = pool.filter(l => !used.has(l) && !recent.includes(l.replace(/\{.\}/g, '').toLowerCase().trim().slice(0, 18)));
  if (f.length) return f;
  const g = pool.filter(l => !used.has(l));
  return g.length ? g : pool;
}
function swearify(s, level) {
  if (!level || /\b(fuck\w*|shit\w*|bloody|crap|sod|ffs|bugger|knob|arse)\b/i.test(s)) return s; // already sweary
  for (const [re, to] of SWAPS[level]) if (re.test(s) && chance(0.6)) { s = s.replace(re, to); break; }
  return s;
}
function addPet(s, style) {
  if (!style || !style.pet || !chance(0.3) || /\?/.test(s) || HAS_EMOJI.test(s) || s.length > 40) return s;
  return s.replace(/([!.]*)$/, `, ${style.pet}$1`);
}

/* Builds up to n distinct suggestions for the messages waiting in a person's chat */
PI.suggest = function (person, style, opts = {}, n = 3) {
  const a = PI.analyse(person, opts.at);
  const s = Object.assign(PI.defaultSettings(), person.settings || {}, opts.override || {});
  const notes = [];
  if (!a.primary) return { replies: [], notes, a, settings: s };
  const serious = a.primary === 'serious';
  let tone = serious ? 'warm' : s.tone;
  if (!serious && a.recentBad && (tone === 'cheeky' || tone === 'dry')) { tone = 'chill'; notes.push({ text: 'Keeping it gentle: they mentioned something rough recently' }); }
  const effort = serious ? Math.max(2, s.effort) : s.effort;
  const goal = serious ? 'keep' : s.goal;
  const swear = serious || a.recentSerious ? 0 : s.swear;
  if (!serious && a.hasNeedy && a.chasersToday >= 3) notes.push({ text: `That’s chaser number ${a.chasersToday} today`, action: goal !== 'time' ? { goal: 'time', label: 'Buy time' } : null });
  if (!serious && a.longChat) notes.push({ text: 'You’ve been at this a while', action: goal !== 'wind' ? { goal: 'wind', label: 'Wind it down' } : null });

  const recent = (person.thread || []).filter(m => m.from === 'me').slice(-30).map(m => m.text.toLowerCase()).join(' | ');
  const o = { name: person.useName === false ? '' : (person.name || '').split(' ')[0], lower: s.lower, keepCase: [] };
  o.keepCase.push(o.name);
  const pendingText = a.pending.map(m => m.text).join(' \n ');
  // Profile knowledge mentioned in their messages
  const mentioned = (person.cards || []).filter(c => c.label && new RegExp('\\b' + c.label.replace(/[.*+?^${}()|[\]\\]/g, '\\$&') + '\\b', 'i').test(pendingText));
  mentioned.forEach(c => o.keepCase.push(c.label));
  (person.askAbout || []).forEach(x => o.keepCase.push(x));
  const askable = (person.askAbout || []).filter(x => !recent.includes(x.toLowerCase()));
  const jokes = (person.jokes || []).filter(j => !recent.includes(j.toLowerCase().slice(0, 20)));

  const used = new Set(), out = [], seenText = new Set();
  const plan = [];
  // Decide what makes each option different: plain, with a profile hook, with a running joke, with escalation
  if (mentioned.length && !serious) plan.push('hook');
  if (!serious && effort >= 2 && a.hasNeedy && a.burst >= 4 && ['cheeky', 'chill', 'dry'].includes(tone)) plan.push('escalate');
  if (jokes.length && !serious && !a.recentBad && ['cheeky', 'chill', 'excited', 'dry'].includes(tone) && (goal === 'keep' || goal === 'subject') && chance(0.6)) plan.push('joke');
  while (plan.length < n) plan.push('plain');

  for (let k = 0; k < 40 && out.length < n; k++) {
    const mode = plan[out.length] || 'plain';
    const parts = [];
    let tag = '';
    if (s.sorry && !a.hasNeedy && !serious) parts.push(pick(SORRY));
    else if (a.hasNeedy && a.primary !== 'needy' && !serious) parts.push(pick(['sorry, was busy!', 'sorry, only just seen these', 'sorry!']));
    if (mode === 'escalate') {
      const mins = Math.max(a.burstMins, 1);
      parts.push(fill(pick(ESCALATE), { c: String(a.burst), m: mins === 1 ? 'a minute' : `${mins} minutes` }));
      tag = 'For the chasers';
    } else if (effort === 1) {
      const mp = fresh(MINIMAL[a.primary] || MINIMAL.default, used, recent), m = pick(mp);
      used.add(m); parts.push(m);
      if (goal === 'wind' || goal === 'time') parts.push(pick(SHORT_GOAL[goal]));
    } else {
      let pool = lines(CORE, a.primary, tone);
      if (swear && SWEAR[swear][a.primary] && !serious) pool = pool.concat(SWEAR[swear][a.primary], SWEAR[swear][a.primary]);
      const first = pick(fresh(pool, used, recent));
      used.add(first); parts.push(swearify(first, swear));
      if (a.secondary && !serious) parts.push(pick(ALSO[a.secondary]));
      if (mode === 'hook') { const c = pick(mentioned); parts.push(fill(pick(HOOKS[c.kind] || HOOKS.thing), { x: c.label })); tag = `Uses what you know about ${c.label}`; }
      if (effort === 3 && !serious && !/\?$/.test(first) && mode === 'plain') parts.push(pick(EXTRA[tone] || EXTRA.chill));
      const asks = parts.some(p => /\?$/.test(p));
      if (mode === 'joke') { parts.push(pick(jokes)); tag = '★ Running joke'; }
      else if (!serious && !(goal === 'keep' && asks) && mode !== 'hook') {
        if ((goal === 'keep' || goal === 'subject') && askable.length && chance(goal === 'subject' ? 0.7 : 0.45)) {
          const x = pick(askable); parts.push(fill(pick(ASK), { x })); tag = tag || 'Asks about something in their profile';
        } else parts.push(pick(lines(GOAL, goal, tone)));
      }
      if (serious && effort === 3) parts.push('want me to give you a ring?');
    }
    let text = polish(join(parts.map((p, i) => (i === 0 ? addPet(p, style) : p))), o, style);
    if (s.emoji && !HAS_EMOJI.test(text) && chance(0.8)) {
      const own = style && style.topEmoji && style.topEmoji.length && chance(0.6) && !serious ? style.topEmoji : null;
      text += ' ' + pick(own || (EMOJI[a.primary] && a.primary !== 'default' ? EMOJI[a.primary] : EMOJI[tone]));
    }
    if (s.kiss) text += ' x';
    if (seenText.has(text)) continue;
    seenText.add(text); out.push({ text, tag });
  }
  return { replies: out, notes, a, settings: s, tone };
};

/* Minimal one-tap reply for lazy mode */
PI.lazy = function (person, style) {
  const s = Object.assign(PI.defaultSettings(), person.settings || {});
  const r = PI.suggest(person, style, { override: { effort: PI.analyse(person).primary === 'serious' ? 2 : 1, sorry: false } }, 1);
  return r.replies[0] ? r.replies[0].text : '';
};

/* How long to wait before sending, so you don't look keen */
PI.delay = function (person) {
  const a = PI.analyse(person);
  if (a.primary === 'serious') return { mins: 0, text: 'This one’s worth replying to now' };
  const s = Object.assign(PI.defaultSettings(), person.settings || {});
  let base = { busy: 25, dry: 15, cheeky: 12, chill: 10, warm: 5, excited: 3 }[s.tone] || 10;
  base += Math.min(a.burst, 8) * 3;
  const mins = Math.max(2, Math.min(90, Math.round(base * (0.7 + rand() * 0.6))));
  return { mins, text: `Wait about ${mins} min before sending, so you don’t look keen` };
};

/* ---------- Things worth asking about ---------- */
const SLANG = new Set(('lol lmao lmfao rofl omg omfg tbh tbf imo idk idc cba ngl wyd wbu hbu btw brb gtg ttyl smh fml ffs pmsl ' +
  'innit knackered shattered brew cuppa telly footy bev bevs sesh nan nana grandad mum mam dad bro bruv mate mates lad lads lass gaff ' +
  'quid skint minging grim mental proper sound buzzing mint boss chuffed gutted gobsmacked bloody blimey crikey bugger sod arse knob ' +
  'muppet daft soft nowt owt summat yous ye aye nah naa yeah yeh yep yup nope okay okey kk haha hahaha hehe heh ahh aww awww ugh ' +
  'hmm hmmm oooh ooh yay woo omw ily ilysm xoxo xxx tho thx cheers ta tara hiya heya ello alright alrite gonna wanna gotta dunno ' +
  'kinda sorta lemme gimme ya yer ur u r ppl pls plz bday hun babe babes hon wee bairn brekkie takeaway chippy spoons uni').split(' '));
const CAP_STOP = new Set(('i im ive ill id monday tuesday wednesday thursday friday saturday sunday january february march april may june july ' +
  'august september october november december christmas easter xmas god jesus ok okay tv uk usa omg lol english british netflix amazon ' +
  'google youtube instagram facebook whatsapp tiktok iphone apple bbc itv covid').split(' '));
const RELATIONS = 'sister|brother|mum|mam|dad|nan|nana|grandad|grandma|boss|boyfriend|girlfriend|bf|gf|husband|wife|fiance|fiancee|partner|cousin|aunt|auntie|uncle|son|daughter|kids?|dog|cat|neighbour|housemate|flatmate|ex';
const REL_RX = new RegExp(`\\bmy (${RELATIONS})\\b`, 'gi');

function isCommon(w) {
  if (KNOWN.has(w) || SLANG.has(w)) return true;
  for (const suf of ['s', 'es', 'ed', 'ing', 'ly', 'er', 'y', 'in']) {
    if (!w.endsWith(suf) || w.length - suf.length < 3) continue;
    const base = w.slice(0, -suf.length);
    if (KNOWN.has(base) || KNOWN.has(base + 'e') || KNOWN.has(base + 'g')) return true; // fumes→fume, fuming→fume, goin→going
  }
  return false;
}
PI.isMedia = t => /^(📷 Photo|🎥 Video|Sticker|GIF|🎤 Voice note|📄 Document|Contact)$/.test(String(t).trim());
function knownSet(person, extra) {
  const k = new Set();
  const add = s => String(s || '').toLowerCase().split(/[^a-z0-9’']+/).filter(Boolean).forEach(x => k.add(x));
  add(person.name); (person.cards || []).forEach(c => { add(c.label); if (c.rel) k.add(c.rel); });
  (person.askAbout || []).forEach(add); (person.ignore || []).forEach(x => k.add(x));
  (extra || []).forEach(add);
  return k;
}
/* Words and phrases in a message that might be names or topics. Returns [{key, label, rel?, strong}] */
PI.candidates = function (text, person, extra) {
  const out = [], known = knownSet(person, extra), seen = new Set();
  const s = String(text || '');
  let m;
  REL_RX.lastIndex = 0;
  while ((m = REL_RX.exec(s))) {
    const rel = m[1].toLowerCase();
    if (!known.has(rel) && !seen.has(rel)) { seen.add(rel); out.push({ key: rel, label: rel, rel, strong: true }); }
  }
  const re = /[\p{L}][\p{L}'’&-]*/gu;
  while ((m = re.exec(s))) {
    let raw = m[0].replace(/['’]s$/i, '').replace(/['’-]+$/, '');
    const w = raw.toLowerCase().replace(/['’]/g, '');
    if (w.length < 3 || known.has(w) || seen.has(w)) continue;
    const before = s.slice(0, m.index).replace(/\s+$/, '');
    const sentenceStart = !before || /[.!?\n]$/.test(before);
    const capWord = /^[A-Z][a-z]/.test(raw) && !CAP_STOP.has(w);
    const cap = capWord && !sentenceStart; // a capital mid-sentence is a strong sign of a name
    const startName = capWord && sentenceStart && !COMMON.has(w); // "Ellie says hi": a weaker sign, needs to come up twice
    if (!cap && !startName && isCommon(w)) continue;
    if (CAP_STOP.has(w)) continue;
    if (/^(https?|www)/.test(w)) continue;
    seen.add(w);
    out.push({ key: w, label: /^[a-z]/.test(raw) && !cap ? raw : raw, strong: cap });
  }
  return out;
};
/* Update a person's word counts with a new message from them, and queue anything worth asking about */
PI.noticeWords = function (person, text, extra) {
  person.seen = person.seen || {}; person.queue = person.queue || [];
  if (PI.isMedia(text)) return;
  for (const c of PI.candidates(text, person, extra)) {
    person.seen[c.key] = (person.seen[c.key] || 0) + 1;
    const count = person.seen[c.key];
    if ((c.strong || count >= 2) && !person.queue.some(q => q.key === c.key)) {
      const label = c.rel ? c.rel : (/^[a-z]/.test(c.label) && c.strong ? c.label : c.label);
      person.queue.push({ key: c.key, label, rel: c.rel || null, count });
    } else { const q = person.queue.find(q => q.key === c.key); if (q) q.count = count; }
  }
  if (person.queue.length > 12) person.queue = person.queue.slice(-12);
};

/* ---------- Your texting style ---------- */
PI.learnStyle = function (texts) {
  const msgs = texts.map(t => String(t).trim()).filter(t => t && !/omitted$|^‎/.test(t) && !/deleted this message|message was deleted/i.test(t));
  if (msgs.length < 5) return null;
  const words = msgs.map(t => t.split(/\s+/).filter(Boolean).length);
  const avgWords = words.reduce((a, b) => a + b, 0) / msgs.length;
  const letters = msgs.filter(t => /[a-z]/i.test(t));
  const lowerRate = letters.filter(t => t === t.toLowerCase()).length / Math.max(1, letters.length);
  const stopRate = msgs.filter(t => /[a-z0-9]\.$/i.test(t)).length / msgs.length;
  const emojiRe = /\p{Extended_Pictographic}/gu;
  const emojiMsgs = msgs.filter(t => emojiRe.test(t)); emojiRe.lastIndex = 0;
  const counts = {};
  msgs.forEach(t => (t.match(emojiRe) || []).forEach(e => { counts[e] = (counts[e] || 0) + 1; }));
  const topEmoji = Object.entries(counts).sort((a, b) => b[1] - a[1]).slice(0, 3).map(e => e[0]);
  const kissRate = msgs.filter(t => /(^|\s)x+$/i.test(t.replace(/\p{Extended_Pictographic}/gu, '').trim())).length / msgs.length;
  const laughs = { haha: 0, hahaha: 0, lol: 0, '😂': 0, lmao: 0 };
  msgs.forEach(t => { const l = t.toLowerCase(); if (/\bhahaha+\b/.test(l)) laughs.hahaha++; else if (/\bhaha\b/.test(l)) laughs.haha++; if (/\blol\b/.test(l)) laughs.lol++; if (/\blmao\b/.test(l)) laughs.lmao++; if (l.includes('😂')) laughs['😂']++; });
  const laugh = Object.entries(laughs).sort((a, b) => b[1] - a[1])[0];
  const petCounts = PETS.map(p => [p, msgs.filter(t => new RegExp(`\\b${p}\\b`, 'i').test(t)).length]).sort((a, b) => b[1] - a[1]);
  const pet = petCounts[0][1] / msgs.length >= 0.04 ? petCounts[0][0] : null;
  return {
    n: msgs.length, avgWords: Math.round(avgWords * 10) / 10, lowerRate: +lowerRate.toFixed(2), stopRate: +stopRate.toFixed(2),
    emojiRate: +(emojiMsgs.length / msgs.length).toFixed(2), topEmoji, kissRate: +kissRate.toFixed(2),
    laugh: laugh[1] >= 2 ? laugh[0] : 'haha', pet
  };
};
PI.styleSummary = function (st) {
  if (!st) return '';
  const bits = [];
  bits.push(st.avgWords <= 5 ? `short messages (about ${Math.round(st.avgWords)} words)` : st.avgWords <= 12 ? `medium-length messages (about ${Math.round(st.avgWords)} words)` : 'longer messages');
  if (st.lowerRate > 0.6) bits.push('mostly lowercase');
  if (st.stopRate < 0.15) bits.push('rarely uses full stops');
  if (st.laugh) bits.push(`laughs with "${st.laugh}"`);
  if (st.emojiRate > 0.15 && st.topEmoji.length) bits.push(`often uses ${st.topEmoji.join(' ')}`);
  else if (st.emojiRate < 0.05) bits.push('hardly uses emoji');
  if (st.kissRate > 0.25) bits.push('often signs off with x');
  if (st.pet) bits.push(`says "${st.pet}" a lot`);
  return bits.join(', ');
};
PI.settingsFromStyle = function (st, base) {
  const s = Object.assign(PI.defaultSettings(), base || {});
  if (!st) return s;
  s.lower = st.lowerRate > 0.6; s.kiss = st.kissRate > 0.3; s.emoji = st.emojiRate > 0.25;
  s.effort = st.avgWords <= 2.5 ? 1 : st.avgWords <= 12 ? 2 : 3;
  return s;
};

/* ---------- Stats (kept low-key in the profile) ---------- */
PI.stats = function (person, at = now()) {
  const t = person.thread || [];
  const d0 = new Date(at); d0.setHours(0, 0, 0, 0);
  const w0 = at - 7 * 24 * HOUR;
  const them = t.filter(m => m.from === 'them'), me = t.filter(m => m.from === 'me');
  const words = a => (a.length ? Math.round(a.reduce((s, m) => s + m.text.split(/\s+/).filter(Boolean).length, 0) / a.length * 10) / 10 : 0);
  const viaApp = me.filter(m => m.via === 'app');
  return {
    themToday: them.filter(m => m.t >= d0.getTime()).length, meToday: me.filter(m => m.t >= d0.getTime()).length,
    themWeek: them.filter(m => m.t >= w0).length, meWeek: me.filter(m => m.t >= w0).length,
    chasersWeek: them.filter(m => m.t >= w0 && PI.detect(m.text) === 'needy').length,
    wordsThem: words(them), wordsMe: words(me), viaApp: viaApp.length, minutesSaved: Math.round(viaApp.length * 0.75)
  };
};

/* ---------- ChatGPT request ---------- */
PI.gptPrompt = function (person, global, override) {
  const s = Object.assign(PI.defaultSettings(), person.settings || {}, override || {});
  const name = (person.name || 'a friend').split(' ')[0];
  const tone = PI.TONES.find(t => t[0] === s.tone)[1].toLowerCase();
  const goal = { keep: 'keep the conversation going', wind: 'politely wind the conversation down', time: 'buy me some time and say I’ll reply properly later', subject: 'steer onto a different subject' }[s.goal];
  const len = { 1: 'as short as possible, one to four words', 2: 'one short sentence or two', 3: 'two or three sentences' }[s.effort];
  const swear = ['No swearing.', 'Mild swearing is fine (bloody, crap, sod it).', 'Swearing is fine.'][s.swear || 0];
  const about = [];
  if (person.rel && person.rel !== 'friend') about.push(`They’re my ${person.rel}.`);
  (person.cards || []).forEach(c => about.push(`- ${c.label}${c.note ? ': ' + c.note : ''}${c.kind && c.kind !== 'thing' ? ` (${c.kind})` : ''}`));
  if ((person.askAbout || []).length) about.push(`Things I can ask them about: ${person.askAbout.join(', ')}.`);
  if ((person.jokes || []).length) about.push(`Our running jokes (use one only if it fits naturally): ${person.jokes.join(' / ')}`);
  const pending = PI.pending(person);
  const history = (person.thread || []).slice(0, (person.thread || []).length - pending.length).slice(-15)
    .map(m => `${m.from === 'me' ? 'Me' : name}: ${m.text.replace(/\s+/g, ' ').slice(0, 300)}`);
  const latest = pending.map(m => m.text).join('\n') || '(paste their message here)';
  const styleBits = [PI.styleSummary(global && global.style), global && global.manualStyle].filter(Boolean).join('. ');
  const build = h => [
    `Help me reply to WhatsApp messages from ${name}.`,
    about.length ? `About ${name}:\n${about.join('\n')}` : '',
    h.length ? `Recent chat, oldest first:\n${h.join('\n')}` : '',
    `${name}’s latest message${pending.length > 1 ? 's' : ''}:\n"""\n${latest}\n"""`,
    `Write 3 different replies I can copy and paste${pending.length > 1 ? ', each covering everything they said' : ''}. Tone: ${tone}. Goal: ${goal}. Length: ${len}.`,
    `Style: casual British texting, like a real person, not an assistant. ${s.lower ? 'All lowercase. ' : ''}${s.emoji ? 'An emoji is fine. ' : 'No emoji. '}${s.kiss ? 'End with an x. ' : ''}${s.sorry ? 'Start with a quick sorry for the slow reply. ' : ''}${swear} Don’t agree to plans or promise anything on my behalf.`,
    styleBits ? `How I usually text: ${styleBits}.` : '',
    'If their message sounds serious or upsetting, ignore the low-effort brief and suggest kind, supportive replies instead, with no swearing.',
    'Reply with just the 3 options, numbered, nothing else.'
  ].filter(Boolean).join('\n\n');
  let h = history, p = build(h);
  while (p.length > 3800 && h.length) { h = h.slice(1); p = build(h); }
  return p;
};
})(typeof window !== 'undefined' ? window : globalThis);
