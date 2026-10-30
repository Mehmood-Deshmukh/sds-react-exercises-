# React Build Book

Interactive React exercises for Unit 2, plus the small JSON API the exercises fetch from.
One Node.js server hosts both:

- **`/`** is the exercise guide students work through: ten builds, from `npm create vite` to a capstone.
- **`/api/...`** is the read-only API (jokes, quotes, profiles, products, weather, avatars).

Students never see or need the server code. They only need the address you deploy it to.

## What's inside

```
react-exercises/
├── server.js                 the whole API + static file server (no dependencies)
├── package.json
├── data/                     the JSON the API serves; edit freely
│   ├── jokes.json            50 jokes in 6 categories
│   ├── quotes.json
│   ├── profiles.json
│   ├── products.json         campus store, prices in ₹
│   └── cities.json           weather settings per city
├── public/                   the guide, served at /
│   ├── index.html            all exercise text and code samples
│   ├── app.js                progress, hints, quizzes, live previews, API explorer
│   ├── styles.css            guide styles
│   └── starter.css           styles students paste into their own project
└── instructor-solutions/
    └── capstone/             reference solution for Build 9 (not served publicly)
```

## Run it locally

```bash
cd react-exercises
npm start              # or: node server.js
```

Open http://localhost:3000. Use `npm run dev` to restart automatically when you edit `server.js`.

## Deploy

You need Node 18 or newer. There are no dependencies, so `npm install` isn't required (running it does no harm).

| Setting | Value |
|---|---|
| Start command | `npm start` |
| Port | read from `PORT` (defaults to 3000) |
| Host | read from `HOST` (defaults to `0.0.0.0`) |
| `PUBLIC_URL` (optional) | the public address, e.g. `https://react-api.example.com`. Only needed if the avatar links in `/api/profiles` come out wrong behind your proxy. |

- **Render / Railway / similar:** create a Node web service from this folder, start command `npm start`.
- **Your own server:** `pm2 start server.js --name react-build-book`, then point nginx (or similar) at the port.

Free hosting tiers often put the app to sleep when it's idle, so the first request after a pause can take up to a minute. Open the site a few minutes before class.

## Share it with students

Send them the deployed address, e.g. `https://react-api.example.com`. When the guide is opened from there, it fills that address into every API link and into the `src/api.js` file students create in Build 0. If the guide is hosted somewhere else, students can paste the API address into the box at the top of the page.

Students' ticks and quiz progress are stored in their own browser (localStorage). Nothing is sent to the server.

## Endpoints

All are `GET` and answer JSON. CORS is open (`*`), so students' `localhost:5173` apps can call it.

| Endpoint | Returns |
|---|---|
| `/api` | list of endpoints |
| `/api/health` | `{ "status": "ok" }` |
| `/api/jokes` | all jokes; filters `?category=` `?search=` `?limit=` |
| `/api/jokes/random` | one joke; optional `?category=` |
| `/api/jokes/categories` | `["programming", "react", ...]` |
| `/api/jokes/:id` | one joke, or 404 |
| `/api/quotes`, `/api/quotes/random`, `/api/quotes/:id` | quotes |
| `/api/profiles`, `/api/profiles/:id` | developer profiles with avatar URLs |
| `/api/products`, `/api/products/:id` | campus store items; optional `?category=` |
| `/api/weather?city=Mumbai` | made-up weather (stable per city for an hour); 400/404 for missing or unknown city |
| `/api/weather/cities` | city names |
| `/api/avatars/riya-sharma.svg` | generated SVG avatar for any name |

Two helpers work on every endpoint, for teaching loading and error states:

- `?delay=2000` waits that many milliseconds before answering (max 5000).
- `?fail=true` returns a 500 with an `error` message.

## Editing the exercises

- **Text and steps** are plain HTML in `public/index.html`. Each build is a `<section class="build c-colour" id="build-N">`, and each `<li class="step">` gets a "Done" checkbox automatically. A build counts as finished when all of its steps are ticked.
- **Code samples** live in `<script type="text/plain" data-code="jsx" data-file="src/...">` blocks, so you can write JSX without escaping `<` and `>`. `{{API_URL}}` is replaced with the API address. Blocks marked `data-solution` are complete files.
- **Live previews** ("Finished model") are drawn by `public/app.js`, which mirrors the solution markup. If you change a solution's markup, change its preview too.
- **Data** is in `data/*.json`. Restart the server after editing.

The solution code was checked by building it in a fresh `npm create vite@latest` project (Vite 8, React 19) and linting it with the template's oxlint setup, with no warnings.

## Capstone reference solution

`instructor-solutions/capstone/` holds `App.jsx` and three components. To run it, drop them into a student-style project that already has `src/api.js`, plus `JokeCard.jsx` (Build 3) and `Footer.jsx` (Build 1) in `src/components/`. Only `public/` is served, so students can't reach these files through the server. Don't put this folder anywhere else students can see it, such as a public Git repo.
