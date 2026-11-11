# Moroccan Culinary Challenge

A real-time multiplayer cooking game. One person opens the **host dashboard** on a laptop or TV,
everyone else joins from their phone with a 4-letter room code, and every chop, spice tweak,
flame adjustment and garnish shows up live on the host screen.

Node + Express + Socket.IO. No database, no accounts, no build step — rooms live in memory.

```
npm install
npm start
# -> http://localhost:3000          (players)
# -> http://localhost:3000/#host    (host dashboard)
```

Node 18 or newer.

---

## How a service runs

| Role | What they do |
| --- | --- |
| **Host** | Opens `/#host`, gets a 4-letter code, picks a recipe, presses **Start service**, then watches the live kitchen board and the action feed. |
| **Chef** | Opens the same URL on their phone, types a name + the room code, and cooks through four stages. |

A service is four timed stages. The server owns the clock: if a chef stalls, their stage ends
automatically with heavily reduced points and the grill moves on.

1. **Prep & Chopping** — tap CHOP while the blade is over the green band. The ingredient you need
   is highlighted; tapping a different ingredient is a mistake. 30 chops, 45 seconds.
2. **Spice Balancing** — match the recipe's proportions exactly (the mix must total 100). Submit
   when you're happy; every spice outside tolerance is a mistake.
3. **Heat & Simmering** — hold to fan the flame, release to let it fall. Stay inside the sweet spot
   for the required seconds. Over 93 for more than half a second and you burn the pot.
4. **Artisanal Plating** — the tray mixes the traditional garnishes with decoys. One wrong garnish
   is a mistake.

Scoring per stage: up to 1000 for completion, up to 600 for speed, minus 60 per mistake. First three
chefs to plate get 600 / 400 / 250 bonus. Highest total is **Master Chef of the Medina**.

## What the host sees

- Every chef's card: current stage, live progress bar, score, clean moves, mistakes, seconds left,
  medal once plated.
- A timestamped **action feed** of every mistake, stage completion, timeout, join, disconnect and
  finish — filterable to mistakes or joins only.
- Room code, copy-code and copy-join-link buttons, recipe picker, reset.

## Recipes

`public/recipes.js` holds all three dishes (Chicken Tagine, Couscous with Seven Vegetables, Atlas
Mint Tea). Each defines its ingredients and chop counts, spice targets and tolerance, heat sweet
spot and hold time, and required garnishes versus decoys. Add a dish there and it appears in the
host's recipe picker; stage times are per recipe, so you can make a dish fast and brutal or slow and
forgiving.

## Hosting it for real

Any host that keeps a Node process alive and supports WebSockets works. Serverless platforms
(Vercel/Netlify functions) do **not** — the game needs a live process holding rooms in memory.

- **Render / Railway / Koyeb**: point them at this repo, build `npm install`, start `npm start`.
  `PORT` is read from the environment. Render's free tier sleeps when idle, so wake it up before
  the party starts.
- **Fly.io**: `fly launch --dockerfile Dockerfile`, then `fly deploy`.
- **Docker anywhere**: `docker build -t moroccan-chef . && docker run -p 3000:3000 moroccan-chef`
- **Same Wi-Fi, no hosting**: run it on your laptop and let phones join at `http://<your-lan-ip>:3000`
  (find the IP with `ipconfig` on Windows, `ipconfig getifaddr en0` on macOS, `hostname -I` on Linux).
  Open `http://<your-lan-ip>:3000/#host` on the laptop itself or on the TV browser.

HTTPS is strongly recommended for phones (and required if you ever want to install it as an app),
but the game works over plain HTTP on a local network.

## Notes

- Rooms are in memory: restarting the server clears them. Empty rooms are collected after 6 idle
  hours, and up to 12 chefs fit in one kitchen.
- The room code is the only secret. Anyone with it can join, and can take over the dashboard if the
  host's tab dies (that is deliberate: a refreshed host tab reattaches instead of killing the room).
- Names are sanitised and rendered as text, socket traffic is rate limited, and the server decides
  every score. Players can still lie about their own minigame timing — it is a party game, not a
  tournament.
- `GET /health` and `GET /api/rooms` (plus `/api/room/:code` for debugging a specific room) are
  available for uptime checks.

## Tests

```
node test/flow.test.js   # real sockets: host + 3 chefs play a full service (needs a server on :3000)
node test/ui.test.js     # loads index.html + app.js in jsdom and plays all four minigames
node test/browser.test.js # real Chrome at phone size: joins, plays all four stages, checks layout
node test/demo-players.js # CODE=ABCD node ... : simulated chefs to watch the dashboard fill up
```
