// React Build Book: the class API.
// Zero dependencies. Run with `node server.js` (Node 18+).
// Serves JSON under /api and the exercise guide from ./public.

import http from "node:http";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = path.dirname(fileURLToPath(import.meta.url));
const PUBLIC_DIR = path.join(ROOT, "public");
const PORT = Number(process.env.PORT) || 3000;
const HOST = process.env.HOST || "0.0.0.0";
const MAX_DELAY_MS = 5000;

const readData = (file) => JSON.parse(fs.readFileSync(path.join(ROOT, "data", file), "utf8"));

const jokes = readData("jokes.json");
const quotes = readData("quotes.json");
const profiles = readData("profiles.json");
const products = readData("products.json");
const cities = readData("cities.json");

const jokeCategories = [...new Set(jokes.map((joke) => joke.category))];

const WEATHER_EMOJI = {
  Sunny: "☀️",
  "Partly cloudy": "⛅",
  Cloudy: "☁️",
  Rainy: "🌧️",
  Thunderstorm: "⛈️",
  Misty: "🌫️",
  Hazy: "🌫️",
  Humid: "💧",
  Snowy: "❄️",
  Windy: "💨",
};

const AVATAR_COLOURS = [
  ["#1C62CC", "#4B8DF0"],
  ["#D8382A", "#F06B4F"],
  ["#22915A", "#4CC184"],
  ["#C98A00", "#F5BE16"],
  ["#7B3FC4", "#A874EB"],
  ["#0E8A8A", "#3CC2C2"],
  ["#C2336F", "#EE6AA0"],
  ["#4A5872", "#7D8BA6"],
];

class HttpError extends Error {
  constructor(status, message) {
    super(message);
    this.status = status;
  }
}

// ---------- helpers ----------

const pickRandom = (list) => list[Math.floor(Math.random() * list.length)];

const slugify = (text) =>
  text
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");

function hashString(text) {
  let hash = 2166136261;
  for (const char of text) {
    hash ^= char.codePointAt(0);
    hash = Math.imul(hash, 16777619);
  }
  return hash >>> 0;
}

// Small seeded random generator, so the same city gives the same weather for an hour.
function seededRandom(seed) {
  let state = seed;
  return () => {
    state = (state + 0x6d2b79f5) | 0;
    let t = Math.imul(state ^ (state >>> 15), 1 | state);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function findById(list, id, label) {
  const item = list.find((entry) => entry.id === Number(id));
  if (!item) {
    throw new HttpError(404, `There is no ${label} with id "${id}". Ids go from 1 to ${list.length}.`);
  }
  return item;
}

function applyLimit(list, query) {
  const limit = Number.parseInt(query.get("limit"), 10);
  return limit > 0 ? list.slice(0, limit) : list;
}

function publicOrigin(req) {
  if (process.env.PUBLIC_URL) return process.env.PUBLIC_URL.replace(/\/+$/, "");
  const proto = String(req.headers["x-forwarded-proto"] || "http").split(",")[0].trim();
  const host = String(req.headers["x-forwarded-host"] || req.headers.host || `localhost:${PORT}`).split(",")[0].trim();
  return `${proto}://${host}`;
}

function withAvatar(profile, origin) {
  const { id, name, ...rest } = profile;
  return { id, name, avatar: `${origin}/api/avatars/${slugify(name)}.svg`, ...rest };
}

function weatherFor(city) {
  const hour = Math.floor(Date.now() / 3_600_000);
  const random = seededRandom(hashString(`${city.name}:${hour}`));
  const condition = city.conditions[Math.floor(random() * city.conditions.length)];

  let temperature = Math.round(city.temperature + (random() * 2 - 1) * city.swing);
  if (condition === "Snowy") temperature = Math.min(temperature, 1);

  const humidity = Math.min(100, Math.max(10, Math.round(city.humidity + (random() * 2 - 1) * 10)));
  const windKph = Math.round(condition === "Windy" ? 25 + random() * 20 : 4 + random() * 18);

  let feelsLike = temperature;
  if (temperature >= 26 && humidity >= 65) feelsLike += 2 + Math.round(random() * 3);
  if (windKph >= 25) feelsLike -= 2;

  return {
    city: city.name,
    country: city.country,
    temperature,
    feelsLike,
    condition,
    emoji: WEATHER_EMOJI[condition],
    humidity,
    windKph,
    updatedAt: new Date(hour * 3_600_000).toISOString(),
  };
}

function avatarSvg(name) {
  const words = name.replace(/\.svg$/i, "").split(/[-_\s]+/).filter(Boolean);
  const initials = words.map((word) => word[0]).join("").slice(0, 2).toUpperCase().replace(/[^A-Z0-9]/g, "") || "?";
  const [from, to] = AVATAR_COLOURS[hashString(words.join(" ").toLowerCase()) % AVATAR_COLOURS.length];

  return `<svg xmlns="http://www.w3.org/2000/svg" width="160" height="160" viewBox="0 0 160 160" role="img" aria-label="${initials}">
  <defs><linearGradient id="g" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="${from}"/><stop offset="1" stop-color="${to}"/></linearGradient></defs>
  <rect width="160" height="160" fill="url(#g)"/>
  <circle cx="130" cy="30" r="46" fill="#fff" opacity="0.12"/>
  <text x="80" y="80" dy="0.35em" text-anchor="middle" font-family="system-ui, -apple-system, 'Segoe UI', sans-serif" font-size="64" font-weight="700" fill="#fff">${initials}</text>
</svg>`;
}

// ---------- routes ----------
// `summary` and `example` feed the /api index. First matching path wins,
// so fixed paths like /api/jokes/random must come before /api/jokes/:id.

const routes = [
  {
    path: "/api",
    handler: ({ origin }) => ({
      message: "Welcome to the React Build Book API. Every endpoint answers GET requests with JSON.",
      guide: `${origin}/`,
      endpoints: routes
        .filter((route) => route.summary)
        .map((route) => ({ path: route.path, description: route.summary, example: `${origin}${route.example || route.path}` })),
      testingHelpers: {
        delay: "Add ?delay=2000 to any endpoint to wait 2 seconds before answering (max 5000).",
        fail: "Add ?fail=true to any endpoint to get a 500 error on purpose.",
      },
    }),
  },
  {
    path: "/api/health",
    summary: "Check that the API is running.",
    handler: () => ({ status: "ok", time: new Date().toISOString() }),
  },
  {
    path: "/api/jokes",
    summary: "All jokes. Optional filters: ?category=, ?search=, ?limit=",
    example: "/api/jokes?category=programming&limit=3",
    handler: ({ query }) => {
      const category = query.get("category")?.toLowerCase();
      const search = query.get("search")?.toLowerCase();
      let result = jokes;
      if (category) result = result.filter((joke) => joke.category === category);
      if (search) result = result.filter((joke) => `${joke.setup} ${joke.punchline}`.toLowerCase().includes(search));
      return applyLimit(result, query);
    },
  },
  {
    path: "/api/jokes/random",
    summary: "One random joke. Optional: ?category=",
    handler: ({ query }) => {
      const category = query.get("category")?.toLowerCase();
      if (!category) return pickRandom(jokes);
      if (!jokeCategories.includes(category)) {
        throw new HttpError(404, `There is no "${category}" category. Try one of: ${jokeCategories.join(", ")}.`);
      }
      return pickRandom(jokes.filter((joke) => joke.category === category));
    },
  },
  {
    path: "/api/jokes/categories",
    summary: "The list of joke categories.",
    handler: () => jokeCategories,
  },
  {
    path: "/api/jokes/:id",
    summary: "One joke by its id.",
    example: "/api/jokes/1",
    handler: ({ params }) => findById(jokes, params.id, "joke"),
  },
  {
    path: "/api/quotes",
    summary: "All quotes. Optional: ?limit=",
    handler: ({ query }) => applyLimit(quotes, query),
  },
  {
    path: "/api/quotes/random",
    summary: "One random quote.",
    handler: () => pickRandom(quotes),
  },
  {
    path: "/api/quotes/:id",
    summary: "One quote by its id.",
    example: "/api/quotes/1",
    handler: ({ params }) => findById(quotes, params.id, "quote"),
  },
  {
    path: "/api/profiles",
    summary: "Developer profiles with avatar images. Optional: ?limit=",
    handler: ({ query, origin }) => applyLimit(profiles, query).map((profile) => withAvatar(profile, origin)),
  },
  {
    path: "/api/profiles/:id",
    summary: "One profile by its id.",
    example: "/api/profiles/1",
    handler: ({ params, origin }) => withAvatar(findById(profiles, params.id, "profile"), origin),
  },
  {
    path: "/api/products",
    summary: "Campus store products with prices in rupees. Optional: ?category=",
    handler: ({ query }) => {
      const category = query.get("category")?.toLowerCase();
      return category ? products.filter((product) => product.category === category) : products;
    },
  },
  {
    path: "/api/products/:id",
    summary: "One product by its id.",
    example: "/api/products/1",
    handler: ({ params }) => findById(products, params.id, "product"),
  },
  {
    path: "/api/weather",
    summary: "Current (pretend) weather for a city. Required: ?city=",
    example: "/api/weather?city=Mumbai",
    handler: ({ query }) => {
      const name = query.get("city")?.trim();
      if (!name) throw new HttpError(400, "Add a city to the address, like /api/weather?city=Mumbai");
      const city = cities.find((entry) => entry.name.toLowerCase() === name.toLowerCase());
      if (!city) throw new HttpError(404, `No weather for "${name}". See /api/weather/cities for the cities you can use.`);
      return weatherFor(city);
    },
  },
  {
    path: "/api/weather/cities",
    summary: "The cities you can ask the weather for.",
    handler: () => cities.map((city) => city.name),
  },
  {
    path: "/api/avatars/:name",
    summary: "A generated avatar image (SVG) for any name.",
    example: "/api/avatars/riya-sharma.svg",
    contentType: "image/svg+xml; charset=utf-8",
    handler: ({ params }) => avatarSvg(params.name),
  },
];

function matchRoute(pathname) {
  const parts = pathname.split("/").filter(Boolean);
  for (const route of routes) {
    const routeParts = route.path.split("/").filter(Boolean);
    if (routeParts.length !== parts.length) continue;
    const params = {};
    const matches = routeParts.every((part, index) => {
      if (part.startsWith(":")) {
        try {
          params[part.slice(1)] = decodeURIComponent(parts[index]);
        } catch {
          throw new HttpError(400, `"${parts[index]}" isn't a valid part of an address.`);
        }
        return true;
      }
      return part === parts[index];
    });
    if (matches) return { route, params };
  }
  return { route: null, params: {} };
}

// ---------- responses ----------

function setCors(res) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET, HEAD, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");
}

function sendJson(req, res, status, body) {
  res.writeHead(status, { "Content-Type": "application/json; charset=utf-8", "Cache-Control": "no-store" });
  res.end(req.method === "HEAD" ? undefined : JSON.stringify(body, null, 2));
}

function handleApi(req, res, url) {
  if (req.method === "OPTIONS") {
    res.writeHead(204);
    return res.end();
  }
  if (req.method !== "GET" && req.method !== "HEAD") {
    return sendJson(req, res, 405, { error: "This API is read-only, so only GET requests work." });
  }

  const delay = Math.min(Math.max(Number(url.searchParams.get("delay")) || 0, 0), MAX_DELAY_MS);

  setTimeout(() => {
    try {
      if (url.searchParams.get("fail") === "true") {
        throw new HttpError(500, "Pretend server error, because the address has ?fail=true. Remove it to get real data.");
      }
      const pathname = url.pathname.replace(/\/+$/, "") || "/api";
      const { route, params } = matchRoute(pathname);
      if (!route) throw new HttpError(404, `There is no endpoint at ${pathname}. Open /api to see them all.`);

      const body = route.handler({ params, query: url.searchParams, origin: publicOrigin(req) });
      if (route.contentType) {
        res.writeHead(200, { "Content-Type": route.contentType, "Cache-Control": "public, max-age=86400" });
        return res.end(req.method === "HEAD" ? undefined : body);
      }
      sendJson(req, res, 200, body);
    } catch (error) {
      if (error instanceof HttpError) return sendJson(req, res, error.status, { error: error.message });
      console.error(error);
      sendJson(req, res, 500, { error: "Something went wrong on the server." });
    }
  }, delay);
}

const MIME_TYPES = {
  ".html": "text/html; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".svg": "image/svg+xml",
  ".png": "image/png",
  ".ico": "image/x-icon",
};

function serveStatic(req, res, pathname) {
  if (req.method !== "GET" && req.method !== "HEAD") {
    res.writeHead(405, { "Content-Type": "text/plain; charset=utf-8" });
    return res.end("Method not allowed");
  }

  let filePath;
  try {
    const relative = pathname === "/" ? "index.html" : decodeURIComponent(pathname).replace(/^\/+/, "");
    filePath = path.join(PUBLIC_DIR, relative);
  } catch {
    filePath = null;
  }

  if (!filePath || !filePath.startsWith(PUBLIC_DIR + path.sep)) {
    res.writeHead(404, { "Content-Type": "text/plain; charset=utf-8" });
    return res.end("Not found");
  }

  fs.readFile(filePath, (error, data) => {
    if (error) {
      res.writeHead(404, { "Content-Type": "text/plain; charset=utf-8" });
      return res.end("Not found");
    }
    const type = MIME_TYPES[path.extname(filePath).toLowerCase()] || "application/octet-stream";
    res.writeHead(200, { "Content-Type": type, "Cache-Control": "no-cache" });
    res.end(req.method === "HEAD" ? undefined : data);
  });
}

// ---------- server ----------

const server = http.createServer((req, res) => {
  const started = Date.now();
  const url = new URL(req.url, "http://localhost");
  const isApi = url.pathname === "/api" || url.pathname.startsWith("/api/");

  if (isApi) {
    res.on("finish", () => console.log(`${req.method} ${req.url} ${res.statusCode} ${Date.now() - started}ms`));
  }

  setCors(res);
  if (isApi) handleApi(req, res, url);
  else serveStatic(req, res, url.pathname);
});

server.listen(PORT, HOST, () => {
  console.log(`React Build Book API running at http://localhost:${PORT}`);
  console.log(`  Guide:     http://localhost:${PORT}/`);
  console.log(`  Endpoints: http://localhost:${PORT}/api`);
});
