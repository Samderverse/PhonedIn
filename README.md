# Phoned In

Replies for when you can't be bothered. Keep a chat for each person who never stops texting, paste their messages in, and get replies that fit the conversation, the person and the way you text. Copy one back into your messaging app. Free, works offline, and nothing leaves your phone.

**Open it:** https://YOUR-GITHUB-NAME.github.io/PhonedIn/

## How it works

1. **Add a person**, or **import your WhatsApp chat** with them.
2. In your messaging app, copy their latest message. In Phoned In, open their chat and tap **Paste their message**. Paste a few in a row if they've sent several.
3. Three replies appear. Tap one to copy it, then paste it into your messaging app. **Shuffle** gives three more.
4. **⚡ Lazy mode** does it in one tap: it pastes their message and copies a minimal reply straight away.

The chat on screen mirrors the real one, so replies take the whole conversation into account.

## What makes the replies fit

- **Context:** it answers several messages at once ("aw no about work! and could do, let me check"), never repeats what you've sent recently, and stays gentle for a day after they mention something rough.
- **Chasers:** it notices a third "you there??" in a day and suggests buying time, and on the cheekier tones it has a line or two for the occasion.
- **Long chats:** after a lot of back-and-forth it suggests winding it down.
- **Strategic delay:** after you copy a reply, it suggests how long to wait before sending so you don't look keen.
- **Your style:** importing a chat teaches it how you text (message length, lowercase, full stops, favourite emoji, "haha" or "lol", kisses, words like "mate"), and replies are adjusted to match.
- **Their profile:** people, pets, places and things they talk about, things to ask about, and your running jokes. Replies use them, like "say hi to Gaz for me", "any news on the new car?" or ★ a running joke now and then.
- **"Who's that?":** when they keep mentioning a name the app doesn't know, it asks once, in a single line you can ignore. Tap **Tell me** to say who or what it is, and it's saved to their profile.
- **Swearing:** Off, Mild (bloody, crap) or Full, set for each person. Serious messages never swear.
- **Serious messages:** if something sounds serious (a death, hospital, a break-up), replies ignore the low-effort settings and stay kind, with a nudge that it might deserve a proper chat.
- **Never commits you:** replies don't agree to plans or promise anything for you.

## ✨ AI replies with Gemini (optional, free)

Quick replies are built in and work offline, but they can only react to the *type* of message. Switch on Gemini and replies respond to what was actually said, using the whole recent chat.

**Set up (about 2 minutes):**
1. Go to [aistudio.google.com/apikey](https://aistudio.google.com/apikey) and sign in with a Google account.
2. Tap **Create API key** and copy it.
3. In Phoned In, open **Settings › AI replies**, paste the key and tap **Test**.

Then in any chat, replies come from Gemini, tagged with their angle ("✨ Says yes", "✨ Asks about Gaz"). When they ask you something, the three options cover different answers. The **AI replies / Quick replies** switch above the suggestions flips between Gemini and the built-in replies, and **Shuffle** asks Gemini for three more.

- **Fast** uses Gemini Flash-Lite and **Smarter** uses Gemini Flash. The app uses Google's "latest" model names, so it keeps working when Google releases new versions.
- It's free within Google's daily limits. If you hit the limit, the app shows quick replies until it resets.
- **Privacy:** with Gemini on, the recent messages in a chat, your notes about that person and your texting style are sent to Google. Google may use free-tier data to improve its products. Quick replies and lazy mode never leave the phone. Your key stays on the phone and isn't included in backups.

## Ask ChatGPT

For messages that need a real answer, **Ask ChatGPT** opens ChatGPT (a free account is fine) with a ready-written request: the recent chat, what you know about them, their running jokes, your texting style and your chosen tone. The request is also copied, so if ChatGPT opens empty you can paste it in.

## Import a WhatsApp chat (iPhone)

1. In WhatsApp, open the chat and tap their name at the top.
2. Scroll down, tap **Export Chat**, then **Without Media**, then **Save to Files**.
3. In Phoned In, tap **Import a WhatsApp chat** and pick that file.
4. Choose which name is you. The last 300 messages are kept, your style is learned, and the names they mention most are queued up to ask about.

Android exports (plain .txt files) work too.

## Install on iPhone

1. Open the link in **Safari**.
2. Tap **⋯** (or Share), then **Share › Add to Home Screen**, and keep **Open as Web App** on.
3. Tap **Add**.

## Put it on GitHub

Upload everything in this folder, including the `icons` folder, to the `PhonedIn` repository and commit. Files with the same names replace the old ones; v2.1 adds `ai.js`. GitHub Pages picks it up within a minute or two.

## Files

| File | Purpose |
|---|---|
| `index.html` | The screens |
| `styles.css` | Design, light and dark |
| `app.js` | People, chats, profiles, settings, backup |
| `engine.js` | The reply bank and all the reply logic |
| `importer.js` | Reading WhatsApp exports and learning your style |
| `ai.js` | Optional AI replies with Gemini |
| `words.js` | Everyday English words, used to spot names and topics |
| `sw.js` | Lets it open instantly and work with no signal |
| `manifest.webmanifest` | Home-screen name, icon and full-screen settings |
| `icons/` | App icons |

## Changing the replies

The replies are plain lists near the top of `engine.js`: `CORE` (reactions by message type and tone), `MINIMAL`, `SWEAR`, `GOAL`, `EXTRA`, `ALSO`, `HOOKS` and more. Add or reword lines to taste. `{n}` is their name and `{x}` is a profile item.

After changing any file, bump `const VERSION = 'pi-v3'` in `sw.js` (to `pi-v4` and so on) so phones pick up the new copy, then close and reopen the app twice.

## Privacy

Everything (people, chats, profiles, your style) is stored in the phone's browser storage. Nothing is sent anywhere unless you switch on Gemini (see above) or tap Ask ChatGPT. **Settings › Export backup** saves a copy to Files. Deleting the home-screen app deletes its data, so export a backup now and then.

## Version history

- **v2.1:** optional AI replies with Gemini that read the whole chat, AI/Quick switch, answer-aware options.
- **v2.0:** people and chats, context-aware replies, profiles with people, things to ask about and running jokes, "Who's that?", swearing levels, WhatsApp import and style learning, lazy mode, strategic delay, low-key stats, smarter ChatGPT request, backup.
- **v1.0:** paste a message, pick a tone, copy a reply.
