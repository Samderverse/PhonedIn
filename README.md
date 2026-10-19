# Phoned In

Replies for when you can't be bothered. Paste a text from someone who always wants to chat, pick a tone, and get three ready-made replies to copy back into WhatsApp. Free, works offline, and nothing leaves your phone.

**Open it:** https://YOUR-GITHUB-NAME.github.io/PhonedIn/

## How it works

1. Copy their message in WhatsApp, open Phoned In and tap **Paste**.
2. The app reads what kind of message it is (a hello, "how are you?", a question, "did you see…?", plans, good news, a moan, a "you there??" chaser, a link or photo, a thank you, something funny, or an essay).
3. Pick a **tone** (Warm, Chill, Dry, Excited, Busy, Cheeky), a **goal** (Keep it going, Wind it down, Buy time, Change the subject) and an **effort** level (Minimal, Normal, Proper effort).
4. Optional extras: emoji, a "sorry, just seen this" opener, a kiss, all lowercase.
5. Tap **Get replies**, tap one to copy it, and paste it into WhatsApp. **Shuffle** gives three more.

Replies come from a hand-written bank on the phone, so they're instant and free. They react to the type of message, not its exact words.

### Needs a proper answer?

**Ask ChatGPT** opens ChatGPT (a free account is fine) with the message, your tone, goal and style already written in, asking for three replies. The request is also copied, so if ChatGPT opens empty you can just paste it. Adding a few **earlier messages** gives ChatGPT more to go on, and **Settings › How you usually text** helps its replies sound like you.

### Built-in common sense

- Replies never agree to plans or promise anything for you. They keep it vague ("let me check what I've got on").
- If a message sounds serious (someone's ill, a death, a break-up, losing a job), the app ignores the low-effort settings, suggests kind replies only, and says it might deserve a proper chat.

## Install on iPhone

1. Open the link in **Safari**.
2. Tap **⋯** (or Share), then **Share › Add to Home Screen**, and keep **Open as Web App** on.
3. Tap **Add**.

## Put it on GitHub

1. Create a public repository called `PhonedIn`.
2. Upload everything in this folder, including the `icons` folder, and commit.
3. **Settings › Pages**: deploy from the `main` branch, `/ (root)` folder.
4. After a minute or two the link appears at the top of the Pages screen.

## Files

| File | Purpose |
|---|---|
| `index.html` | The page |
| `styles.css` | Design, light and dark |
| `app.js` | Message detection, the reply bank, the ChatGPT request |
| `sw.js` | Lets it open instantly and work with no signal |
| `manifest.webmanifest` | Home-screen name, icon and full-screen settings |
| `icons/` | App icons |

## Changing the replies

All the replies are plain lists near the top of `app.js` (`CORE`, `MINIMAL`, `GOAL`, `EXTRA`, `SORRY`), grouped by message type and tone. Add, remove or reword lines to taste. `{n}` is replaced by their name if you've set one in Settings.

After changing any file, bump `const VERSION = 'pi-v1'` in `sw.js` (to `pi-v2` and so on) so phones pick up the new copy, then close and reopen the app twice.

## Privacy

Names, settings and messages stay in the phone's browser storage. Nothing is sent anywhere unless you tap Ask ChatGPT, which sends that one request to ChatGPT.
