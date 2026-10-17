# Swapp UI prototype (design reference)

A self-contained, click-through mockup of the app's screens: signup, Buy grid, product view,
Sell, Requests (channels), Inbox and chat. It uses fake data stored in the browser's
`localStorage` and does **not** talk to Supabase or the Next.js app.

Use it as the visual and interaction reference when building the real pages in `src/app/`.
The backend functions for each screen are listed in the main README ("How the backend works").

**Run it:** open `prototype/index.html` in a browser. No server or install needed.

**Edit it:** change `app.ts`, then recompile `app.js`:

```
npx -p typescript@5 tsc -p prototype
```

(`app.js` is committed so the page works without a build step.) Heads-up: the committed `app.js`
has a few small hand edits that aren't in `app.ts` (sign-up demo-code handling, a caption variable),
so recompiling will drop them. Copy them into `app.ts` first if you start editing.

Not for real users: its login is a demo (passwords in `localStorage`, codes shown on screen).
Known styling bug: the selected "All" chip is white on near-white.
