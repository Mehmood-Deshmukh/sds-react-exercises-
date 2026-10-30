// React Build Book: guide interactivity.
// Plain JavaScript, no build step. The previews deliberately mirror the
// React solutions (same markup and class names) so they look identical.

(() => {
  "use strict";

  // ---------- small helpers ----------

  const $ = (selector, root = document) => root.querySelector(selector);
  const $$ = (selector, root = document) => Array.from(root.querySelectorAll(selector));

  const store = {
    get(key, fallback) {
      try {
        const raw = localStorage.getItem(key);
        return raw === null ? fallback : JSON.parse(raw);
      } catch {
        return fallback;
      }
    },
    set(key, value) {
      try {
        localStorage.setItem(key, JSON.stringify(value));
      } catch {}
    },
    remove(key) {
      try {
        localStorage.removeItem(key);
      } catch {}
    },
  };

  const clean = (children) => children.flat(Infinity).filter((child) => child != null && child !== false);

  // h("button", { class: "btn", onclick: fn }, "Label") builds a DOM element.
  function h(tag, props, ...children) {
    const el = document.createElement(tag);
    for (const [key, value] of Object.entries(props || {})) {
      if (value === false || value == null) continue;
      if (key === "class") el.className = value;
      else if (key.startsWith("on")) el.addEventListener(key.slice(2), value);
      else el.setAttribute(key, value === true ? "" : value);
    }
    el.append(...clean(children));
    return el;
  }

  // Replace an element's children but keep keyboard focus on the same control.
  function patch(el, ...children) {
    const controls = () => $$("button, input, select", el);
    const index = controls().indexOf(document.activeElement);
    el.replaceChildren(...clean(children));
    if (index >= 0) {
      const list = controls();
      list[Math.min(index, list.length - 1)]?.focus();
    }
  }

  // ---------- API address ----------

  const DEFAULT_API = /^https?:$/.test(location.protocol) ? location.origin : "http://localhost:3000";
  const apiInput = $("#api-url");
  const apiStatus = $("#api-status");
  const onApiChange = [];

  function normaliseUrl(value) {
    let url = value.trim().replace(/\/+$/, "");
    if (url && !/^https?:\/\//i.test(url)) url = `http://${url}`;
    return url;
  }

  let apiUrl = normaliseUrl(store.get("rbb-api", "") || DEFAULT_API);
  apiInput.value = apiUrl;

  function applyApiUrl() {
    const next = normaliseUrl(apiInput.value) || DEFAULT_API;
    apiInput.value = next;
    if (next === apiUrl) return;
    apiUrl = next;
    if (next === DEFAULT_API) store.remove("rbb-api");
    else store.set("rbb-api", next);
    onApiChange.forEach((callback) => callback());
  }

  $("#api-form").addEventListener("submit", (event) => {
    event.preventDefault();
    applyApiUrl();
  });
  apiInput.addEventListener("change", applyApiUrl);

  let healthRun = 0;
  async function checkHealth() {
    const run = ++healthRun;
    setStatus("", "Checking");
    try {
      const response = await fetch(`${apiUrl}/api/health`, { cache: "no-store" });
      if (run !== healthRun) return;
      setStatus(response.ok ? "is-ok" : "is-down", response.ok ? "Connected" : "Not responding");
    } catch {
      if (run === healthRun) setStatus("is-down", "Can't reach it");
    }
  }

  function setStatus(modifier, text) {
    apiStatus.className = `api-status ${modifier}`;
    apiStatus.textContent = text;
  }

  onApiChange.push(checkHealth);

  async function getJson(path) {
    const response = await fetch(apiUrl + path);
    const data = await response.json().catch(() => ({}));
    if (!response.ok) throw new Error(data.error || `The API answered with status ${response.status}.`);
    return data;
  }

  function apiErrorText(error) {
    return error instanceof TypeError
      ? `Can't reach the API at ${apiUrl}. Check the address at the top of the page.`
      : error.message;
  }

  function fillApiLinks() {
    for (const link of $$("a[data-api]")) {
      link.href = apiUrl + link.dataset.api;
      link.textContent = apiUrl + link.dataset.api;
    }
  }

  onApiChange.push(fillApiLinks);

  // ---------- code blocks ----------

  const codeTemplates = new Map();
  const canHighlight = () => typeof window.Prism?.highlightElement === "function";

  function highlight(code) {
    if (canHighlight()) window.Prism.highlightElement(code);
  }

  function setupCodeBlocks() {
    for (const source of $$('script[type="text/plain"][data-code]')) {
      const lang = source.dataset.code;
      const label = source.dataset.file || (lang === "bash" ? "Terminal" : "");
      const code = h("code", { class: `language-${lang}` });
      const copyButton = h("button", { class: "copy-btn", type: "button" }, "Copy");
      const figure = h(
        "figure",
        { class: "codeblock" },
        h("figcaption", { class: "codeblock-head" }, h("span", {}, label), copyButton),
        h("pre", { tabindex: "0" }, code)
      );

      copyButton.addEventListener("click", () => copyText(code.textContent, copyButton));
      codeTemplates.set(code, source.textContent.replace(/^\s*\n/, "").replace(/\s+$/, ""));

      if (source.dataset.src) {
        figure.classList.add("is-tall");
        loadCodeFile(code, source.dataset.src);
      }
      source.replaceWith(figure);
    }
    refreshCode();
  }

  function refreshCode() {
    for (const [code, template] of codeTemplates) {
      code.textContent = template.replaceAll("{{API_URL}}", apiUrl);
      highlight(code);
    }
  }

  onApiChange.push(refreshCode);

  async function loadCodeFile(code, file) {
    for (const url of [file, `${apiUrl}/${file}`]) {
      try {
        const response = await fetch(url);
        if (!response.ok) continue;
        codeTemplates.set(code, (await response.text()).trim());
        refreshCode();
        return;
      } catch {}
    }
    codeTemplates.set(code, `/* Couldn't load the starter styles here.\n   Open ${apiUrl}/starter.css and copy them from there. */`);
    refreshCode();
  }

  async function copyText(text, button) {
    let copied = false;
    try {
      await navigator.clipboard.writeText(text);
      copied = true;
    } catch {
      const area = h("textarea", { style: "position:fixed;opacity:0" });
      area.value = text;
      document.body.append(area);
      area.select();
      try {
        copied = document.execCommand("copy");
      } catch {}
      area.remove();
    }
    button.textContent = copied ? "Copied" : "Select and copy by hand";
    setTimeout(() => (button.textContent = "Copy"), 1800);
  }

  // ---------- builds, steps and progress ----------

  const builds = $$(".build[id^='build-']").map((section) => ({
    section,
    number: section.id.replace("build-", ""),
    title: $(".build-title", section).textContent.trim(),
    colour: Array.from(section.classList).find((name) => name.startsWith("c-")),
    steps: $$(".step", section),
  }));

  const progress = store.get("rbb-progress", {});
  const stepKey = (build, index) => `b${build.number}s${index + 1}`;
  const isComplete = (build) => build.steps.length > 0 && build.steps.every((_, index) => progress[stepKey(build, index)]);

  function setupProgressUI() {
    const row = $("#brickrow");
    const toc = $("#toc-builds");
    for (const build of builds) {
      build.brick = h("a", { class: `brick ${build.colour}`, href: `#${build.section.id}` }, build.number);
      row.append(h("li", {}, build.brick));

      build.tocLink = h(
        "a",
        { class: `toc-link ${build.colour}`, href: `#${build.section.id}` },
        h("span", { class: "toc-brick", "aria-hidden": "true" }),
        build.title
      );
      toc.append(h("li", {}, build.tocLink));
    }
  }

  function setupSteps() {
    for (const build of builds) {
      build.steps.forEach((step, index) => {
        const key = stepKey(build, index);
        const title = $(".step-title", step);
        const checkbox = h("input", { type: "checkbox", "aria-label": `Done: ${title.textContent.trim()}` });
        checkbox.checked = Boolean(progress[key]);

        const head = h("div", { class: "step-head" });
        title.replaceWith(head);
        head.append(title, h("label", { class: "step-check" }, checkbox, "Done"));
        step.classList.toggle("is-done", checkbox.checked);

        checkbox.addEventListener("change", () => {
          if (checkbox.checked) progress[key] = true;
          else delete progress[key];
          store.set("rbb-progress", progress);
          step.classList.toggle("is-done", checkbox.checked);
          updateProgress(build);
        });
      });
    }
  }

  function updateProgress(changedBuild) {
    let finished = 0;
    for (const build of builds) {
      const complete = isComplete(build);
      if (complete) finished += 1;
      build.brick.classList.toggle("is-done", complete);
      build.tocLink.classList.toggle("is-done", complete);
      build.brick.setAttribute("aria-label", `Build ${build.number}: ${build.title}${complete ? ", finished" : ""}`);
      if (build === changedBuild && complete && !build.wasComplete) celebrate(build);
      build.wasComplete = complete;
    }
    $("#progress-text").textContent =
      finished === builds.length
        ? `All ${builds.length} builds finished. Go and show someone your Joke Hub.`
        : `${finished} of ${builds.length} builds finished`;
  }

  let toastTimer;
  function celebrate(build) {
    build.brick.classList.remove("snap");
    void build.brick.offsetWidth;
    build.brick.classList.add("snap");

    const toast = $("#toast");
    toast.className = `toast ${build.colour}`;
    toast.replaceChildren(
      h("span", { class: `brick is-done ${build.colour}`, "aria-hidden": "true" }, build.number),
      `Build ${build.number} finished: ${build.title}`
    );
    void toast.offsetWidth;
    toast.classList.add("is-visible");
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => toast.classList.remove("is-visible"), 3500);
  }

  // ---------- hints and quizzes ----------

  function setupHints() {
    for (const box of $$(".hints")) {
      const items = $$(".hint-list > li", box);
      const button = $(".hint-btn", box);
      let shown = 0;
      items.forEach((item) => (item.hidden = true));

      const update = () => {
        const done = shown >= items.length;
        button.setAttribute("aria-disabled", String(done));
        button.textContent = done ? "That's every hint" : `Show hint ${shown + 1} of ${items.length}`;
      };

      button.addEventListener("click", () => {
        if (shown >= items.length) return;
        items[shown].hidden = false;
        shown += 1;
        update();
      });
      update();
    }
  }

  function setupQuizzes() {
    for (const quiz of $$(".quiz")) {
      const options = $$(".quiz-opt", quiz);
      const feedback = $(".quiz-feedback", quiz);
      const explain = $(".quiz-explain", quiz);
      explain.hidden = true;

      for (const option of options) {
        option.addEventListener("click", () => {
          if (option.getAttribute("aria-disabled") === "true") return;
          const right = option.hasAttribute("data-correct");
          option.classList.add(right ? "is-right" : "is-wrong");
          option.setAttribute("aria-disabled", "true");
          feedback.className = `quiz-feedback ${right ? "is-right" : "is-wrong"}`;
          feedback.textContent = right ? "Right." : "Not quite. Try another one.";
          if (right) {
            explain.hidden = false;
            options.forEach((other) => other.setAttribute("aria-disabled", "true"));
          }
        });
      }
    }
  }

  // ---------- live previews ----------
  // Each preview gets the .app element to draw into and returns a cleanup
  // function, just like a React effect.

  function showPreviewError(app, error) {
    app.replaceChildren(h("p", { class: "error" }, apiErrorText(error)));
  }

  function jokeCard({ setup, punchline }) {
    const card = h("article", { class: "card" });
    let showPunchline = false;
    let likes = 0;

    const draw = () =>
      patch(
        card,
        h("p", { class: "setup" }, setup),
        showPunchline && h("p", { class: "punchline" }, punchline),
        h(
          "div",
          { class: "row" },
          h("button", { class: "btn", type: "button", onclick: () => { showPunchline = !showPunchline; draw(); } },
            showPunchline ? "Hide punchline" : "Show punchline"),
          h("button", { class: "btn btn-secondary", type: "button", onclick: () => { likes += 1; draw(); } }, `❤️ ${likes}`)
        )
      );

    draw();
    return card;
  }

  const previews = {
    profiles(app) {
      let alive = true;
      getJson("/api/profiles?limit=4")
        .then((people) => {
          if (!alive) return;
          app.replaceChildren(
            h("section", { class: "grid" },
              people.map((person) =>
                h("article", { class: "card profile-card" },
                  h("img", { class: "avatar", src: person.avatar, alt: person.name }),
                  h("h3", {}, person.name),
                  h("p", { class: "muted" }, person.role),
                  h("span", { class: "badge" }, `📍 ${person.city}`)
                )
              )
            )
          );
        })
        .catch((error) => alive && showPreviewError(app, error));
      return () => (alive = false);
    },

    jokeCards(app) {
      app.replaceChildren(
        h("div", { class: "grid" },
          jokeCard({ setup: "Why do programmers prefer dark mode?", punchline: "Because light attracts bugs." }),
          jokeCard({ setup: "Why did the React developer bring a ladder to work?", punchline: "To lift the state up." })
        )
      );
    },

    randomJoke(app) {
      let alive = true;

      function draw(joke) {
        if (joke === null) return patch(app, h("p", { class: "card muted" }, "Loading a joke…"));
        patch(app,
          h("article", { class: "card" },
            h("span", { class: "badge" }, joke.category),
            h("p", { class: "setup" }, joke.setup),
            h("p", { class: "punchline" }, joke.punchline),
            h("button", { class: "btn", type: "button", onclick: load }, "Another joke")
          )
        );
      }

      function load() {
        const hadFocus = app.contains(document.activeElement);
        draw(null);
        getJson("/api/jokes/random")
          .then((joke) => {
            if (!alive) return;
            draw(joke);
            if (hadFocus) $("button", app)?.focus();
          })
          .catch((error) => alive && showPreviewError(app, error));
      }

      load();
      return () => (alive = false);
    },

    weather(app) {
      let alive = true;
      let cities = [];
      let city = "Mumbai";
      let weather = null;

      function draw() {
        patch(app,
          h("section", { class: "card stack" },
            h("select", { class: "input", "aria-label": "City", onchange: handleCityChange },
              cities.map((name) => h("option", { value: name, selected: name === city }, name))
            ),
            weather === null
              ? h("p", { class: "muted" }, "Loading weather…")
              : h("div", {},
                  h("p", { class: "big" }, `${weather.emoji} ${weather.temperature}°C`),
                  h("p", {}, `${weather.condition} in ${weather.city}, ${weather.country}`),
                  h("div", { class: "row" },
                    h("span", { class: "badge" }, `Feels like ${weather.feelsLike}°C`),
                    h("span", { class: "badge" }, `💧 ${weather.humidity}%`),
                    h("span", { class: "badge" }, `💨 ${weather.windKph} km/h`)
                  )
                )
          )
        );
      }

      function handleCityChange(event) {
        city = event.target.value;
        weather = null;
        draw();
        loadWeather();
      }

      function loadWeather() {
        const asked = city;
        getJson(`/api/weather?city=${encodeURIComponent(asked)}`)
          .then((data) => {
            if (!alive || asked !== city) return;
            weather = data;
            draw();
          })
          .catch((error) => alive && showPreviewError(app, error));
      }

      getJson("/api/weather/cities")
        .then((data) => {
          if (!alive) return;
          cities = data;
          draw();
        })
        .catch((error) => alive && showPreviewError(app, error));
      loadWeather();
      draw();
      return () => (alive = false);
    },

    search(app) {
      let alive = true;
      let jokes = [];
      let query = "";

      const count = h("p", { class: "muted" });
      const list = h("ul", { class: "list" });
      const input = h("input", {
        class: "input",
        type: "search",
        placeholder: "Search jokes, like “bug”",
        "aria-label": "Search jokes",
        oninput: (event) => {
          query = event.target.value;
          drawList();
        },
      });
      app.replaceChildren(h("section", { class: "stack" }, input, count, list));

      function drawList() {
        const search = query.toLowerCase();
        const visible = jokes.filter((joke) => `${joke.setup} ${joke.punchline}`.toLowerCase().includes(search));
        count.textContent = `Showing ${visible.length} of ${jokes.length} jokes`;
        list.replaceChildren(
          ...visible.map((joke) =>
            h("li", { class: "card" }, h("p", { class: "setup" }, joke.setup), h("p", { class: "punchline" }, joke.punchline))
          )
        );
      }

      getJson("/api/jokes")
        .then((data) => {
          if (!alive) return;
          jokes = data;
          drawList();
        })
        .catch((error) => alive && showPreviewError(app, error));
      drawList();
      return () => (alive = false);
    },

    store(app) {
      let alive = true;
      let products = [];
      let cart = [];

      function addToCart(product) {
        const alreadyInCart = cart.some((item) => item.id === product.id);
        cart = alreadyInCart
          ? cart.map((item) => (item.id === product.id ? { ...item, quantity: item.quantity + 1 } : item))
          : [...cart, { ...product, quantity: 1 }];
        draw();
      }

      function removeFromCart(id) {
        cart = cart.filter((item) => item.id !== id);
        draw();
      }

      function draw() {
        const itemCount = cart.reduce((sum, item) => sum + item.quantity, 0);
        const total = cart.reduce((sum, item) => sum + item.price * item.quantity, 0);

        patch(app,
          h("section", { class: "store" },
            h("div", { class: "grid" },
              products.map((product) =>
                h("article", { class: "card stack" },
                  h("span", { class: "emoji" }, product.emoji),
                  h("h3", {}, product.name),
                  h("p", { class: "muted" }, `₹${product.price}`),
                  h("button", { class: "btn", type: "button", onclick: () => addToCart(product) }, "Add to cart")
                )
              )
            ),
            h("aside", { class: "card" },
              h("h3", {}, "🛒 Your cart"),
              cart.length === 0 && h("p", { class: "muted" }, "Nothing here yet. Add something tasty."),
              h("ul", { class: "list" },
                cart.map((item) =>
                  h("li", { class: "cart-item" },
                    h("span", {}, `${item.emoji} ${item.name} × ${item.quantity}`),
                    h("span", {}, `₹${item.price * item.quantity}`),
                    h("button", { class: "btn btn-secondary btn-small", type: "button", onclick: () => removeFromCart(item.id) }, "Remove")
                  )
                )
              ),
              h("p", { class: "cart-total" }, `${itemCount} items, ₹${total}`)
            )
          )
        );
      }

      getJson("/api/products")
        .then((data) => {
          if (!alive) return;
          products = data;
          draw();
        })
        .catch((error) => alive && showPreviewError(app, error));
      return () => (alive = false);
    },

    quote(app) {
      let alive = true;
      let quote = null;
      let paused = false;
      let onScreen = false;
      let timerId = null;

      function draw() {
        patch(app,
          h("section", { class: "card" },
            quote === null
              ? h("p", { class: "muted" }, "Finding a quote…")
              : h("blockquote", { class: "quote" }, h("p", {}, `“${quote.text}”`), h("footer", {}, quote.author)),
            h("button", {
              class: "btn btn-secondary",
              type: "button",
              onclick: () => {
                paused = !paused;
                draw();
                syncTimer();
              },
            }, paused ? "▶ Resume" : "⏸ Pause")
          )
        );
      }

      function loadQuote() {
        getJson("/api/quotes/random")
          .then((data) => {
            if (!alive) return;
            quote = data;
            draw();
          })
          .catch((error) => alive && showPreviewError(app, error));
      }

      // Same idea as the effect in the build, plus: no timer while scrolled away.
      function syncTimer() {
        clearInterval(timerId);
        timerId = null;
        if (!alive || paused || !onScreen) return;
        loadQuote();
        timerId = setInterval(loadQuote, 10000);
      }

      const observer = new IntersectionObserver(([entry]) => {
        onScreen = entry.isIntersecting;
        syncTimer();
      });
      observer.observe(app);
      draw();

      return () => {
        alive = false;
        clearInterval(timerId);
        observer.disconnect();
      };
    },

    hub(app) {
      let alive = true;
      let categories = [];
      let category = "any";
      let joke = null;
      let showPunchline = false;
      let loading = false;
      let favourites = store.get("rbb-hub-favourites", []);

      function setFavourites(next) {
        favourites = next;
        store.set("rbb-hub-favourites", favourites);
        draw();
      }

      function getJoke() {
        loading = true;
        draw();
        const query = category === "any" ? "" : `?category=${encodeURIComponent(category)}`;
        getJson(`/api/jokes/random${query}`)
          .then((data) => {
            if (!alive) return;
            joke = data;
            showPunchline = false;
            loading = false;
            draw();
          })
          .catch((error) => alive && showPreviewError(app, error));
      }

      function draw() {
        const saved = joke !== null && favourites.some((item) => item.id === joke.id);

        patch(app,
          h("header", { class: "header row", style: "justify-content: space-between" },
            h("h1", { style: "margin: 0" }, "😂 Joke Hub"),
            h("span", { class: "badge" }, `⭐ ${favourites.length} saved`)
          ),
          h("div", { class: "main" },
            h("section", { class: "card stack" },
              h("div", { class: "row" },
                ["any", ...categories].map((name) =>
                  h("button", {
                    class: name === category ? "chip active" : "chip",
                    type: "button",
                    "aria-pressed": String(name === category),
                    onclick: () => {
                      category = name;
                      draw();
                    },
                  }, name)
                )
              ),
              h("div", { class: "row" },
                h("button", { class: "btn", type: "button", onclick: getJoke, disabled: loading }, loading ? "Loading…" : "Get a joke")
              )
            ),
            joke !== null &&
              h("article", { class: "card" },
                h("span", { class: "badge" }, joke.category),
                h("p", { class: "setup" }, joke.setup),
                showPunchline && h("p", { class: "punchline" }, joke.punchline),
                h("div", { class: "row" },
                  h("button", { class: "btn", type: "button", onclick: () => { showPunchline = !showPunchline; draw(); } },
                    showPunchline ? "Hide punchline" : "Show punchline"),
                  h("button", {
                    class: "btn btn-secondary",
                    type: "button",
                    disabled: saved,
                    onclick: () => setFavourites([...favourites, joke]),
                  }, saved ? "⭐ Saved" : "⭐ Save")
                )
              ),
            h("section", { class: "stack" },
              h("h3", {}, "Favourites"),
              favourites.length === 0
                ? h("p", { class: "muted" }, "No favourites yet. Save a joke you like.")
                : h("ul", { class: "list" },
                    favourites.map((item) =>
                      h("li", { class: "card cart-item" },
                        h("div", {}, h("p", { class: "setup" }, item.setup), h("p", { class: "punchline", style: "margin: 0" }, item.punchline)),
                        h("button", {
                          class: "btn btn-secondary btn-small",
                          type: "button",
                          onclick: () => setFavourites(favourites.filter((saved) => saved.id !== item.id)),
                        }, "Remove")
                      )
                    )
                  )
            )
          )
        );
      }

      getJson("/api/jokes/categories")
        .then((data) => {
          if (!alive) return;
          categories = data;
          draw();
        })
        .catch((error) => alive && showPreviewError(app, error));
      draw();
      return () => (alive = false);
    },
  };

  function setupPreviews() {
    const mounted = [];
    const observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (!entry.isIntersecting) continue;
          observer.unobserve(entry.target);
          const preview = mounted.find((item) => item.figure === entry.target);
          mount(preview);
        }
      },
      { rootMargin: "300px 0px" }
    );

    function mount(preview) {
      preview.cleanup?.();
      preview.cleanup = null;
      preview.started = true;
      preview.app.replaceChildren(h("p", { class: "muted" }, "Loading…"));
      preview.cleanup = previews[preview.kind](preview.app) || null;
    }

    for (const figure of $$("figure.model")) {
      const kind = figure.dataset.preview;
      const isStatic = kind === "static";
      const template = $("template", figure);
      const app = h("div", { class: "app" });
      const note = figure.dataset.note || (isStatic ? "What your page should look like." : "Live, using the class API.");
      const reload = !isStatic && h("button", { class: "browser-reload", type: "button" }, "Reload");

      figure.replaceChildren(
        h("figcaption", { class: "model-caption" }, h("strong", {}, "Finished model"), h("span", {}, note)),
        h("div", { class: "browser" },
          h("div", { class: "browser-bar" }, h("span", {}, "localhost:5173"), reload),
          h("div", { class: "browser-view" }, app)
        )
      );

      if (isStatic) {
        if (template) app.append(template.content.cloneNode(true));
        continue;
      }

      const preview = { figure, kind, app, cleanup: null, started: false };
      mounted.push(preview);
      reload.addEventListener("click", () => mount(preview));
      observer.observe(figure);
    }

    for (const el of $$("[data-year]")) el.textContent = new Date().getFullYear();

    onApiChange.push(() => mounted.filter((preview) => preview.started).forEach(mount));
  }

  // ---------- API explorer ----------

  const ENDPOINTS = [
    { path: "/api/jokes/random", about: "One random joke.", fields: [{ name: "category", placeholder: "food" }] },
    {
      path: "/api/jokes",
      about: "All 50 jokes. Narrow them down with category, search and limit.",
      fields: [
        { name: "category", placeholder: "programming" },
        { name: "search", placeholder: "bug" },
        { name: "limit", placeholder: "5" },
      ],
    },
    { path: "/api/jokes/categories", about: "The joke categories." },
    { path: "/api/jokes/:id", about: "One joke by its id.", fields: [{ name: "id", value: "1", inPath: true }] },
    { path: "/api/quotes/random", about: "One random quote." },
    { path: "/api/quotes", about: "All quotes.", fields: [{ name: "limit", placeholder: "5" }] },
    { path: "/api/profiles", about: "Developer profiles. Each has an avatar image address.", fields: [{ name: "limit", placeholder: "4" }] },
    { path: "/api/profiles/:id", about: "One profile by its id.", fields: [{ name: "id", value: "1", inPath: true }] },
    { path: "/api/products", about: "Campus store products. Prices are in rupees.", fields: [{ name: "category", placeholder: "food" }] },
    { path: "/api/weather", about: "Made-up weather for a city. city is required.", fields: [{ name: "city", value: "Mumbai" }] },
    { path: "/api/weather/cities", about: "The cities the weather endpoint knows." },
    { path: "/api/avatars/:name", about: "A generated avatar image for any name.", fields: [{ name: "name", value: "riya-sharma.svg", inPath: true }] },
  ];

  function setupExplorer() {
    const root = $("#endpoints");
    const refreshers = [];

    for (const endpoint of ENDPOINTS) {
      const fields = endpoint.fields || [];
      const inputs = {};
      const urlBox = h("div", { class: "endpoint-url" });
      const openLink = h("a", { class: "gbtn", target: "_blank", rel: "noopener" }, "Open in a new tab");
      const sendButton = h("button", { class: "gbtn gbtn-primary", type: "button" }, "Send request");
      const response = h("div", { class: "response", hidden: true, "aria-live": "polite" });

      const buildUrl = () => {
        let path = endpoint.path;
        const query = new URLSearchParams();
        for (const field of fields) {
          const value = inputs[field.name].value.trim();
          if (field.inPath) path = path.replace(`:${field.name}`, encodeURIComponent(value || field.value));
          else if (value) query.set(field.name, value);
        }
        const search = query.toString();
        return `${apiUrl}${path}${search ? `?${search}` : ""}`;
      };

      const refresh = () => {
        const url = buildUrl();
        urlBox.textContent = url;
        openLink.href = url;
      };

      const paramRow = fields.length > 0 &&
        h("div", { class: "params" },
          fields.map((field) => {
            inputs[field.name] = h("input", {
              class: "field",
              value: field.value || "",
              placeholder: field.placeholder ? `e.g. ${field.placeholder}` : "",
              spellcheck: "false",
              oninput: refresh,
            });
            return h("label", { class: "param" }, field.name, inputs[field.name]);
          })
        );

      sendButton.addEventListener("click", async () => {
        const url = buildUrl();
        const started = performance.now();
        response.hidden = false;
        response.replaceChildren(h("p", { class: "response-wait" }, "Waiting for the API…"));

        try {
          const res = await fetch(url, { cache: "no-store" });
          const ms = Math.round(performance.now() - started);
          const type = res.headers.get("content-type") || "";
          const head = h("figcaption", { class: "codeblock-head" },
            h("span", { class: "response-meta" },
              h("span", { class: res.ok ? "status-ok" : "status-bad" }, `${res.status} ${res.ok ? "OK" : "Error"}`),
              h("span", {}, `${ms} ms`)
            )
          );

          if (type.includes("svg")) {
            response.replaceChildren(h("figure", { class: "codeblock" }, head, h("img", { src: url, alt: "Avatar returned by the API" })));
            return;
          }

          const text = await res.text();
          let pretty = text;
          try {
            pretty = JSON.stringify(JSON.parse(text), null, 2);
          } catch {}
          const code = h("code", { class: "language-json" }, pretty);
          response.replaceChildren(h("figure", { class: "codeblock" }, head, h("pre", { tabindex: "0" }, code)));
          highlight(code);
        } catch (error) {
          response.replaceChildren(h("p", { class: "response-wait status-bad" }, apiErrorText(error)));
        }
      });

      root.append(
        h("details", { class: "endpoint" },
          h("summary", {},
            h("span", { class: "method" }, "GET"),
            h("span", { class: "endpoint-path" }, endpoint.path),
            h("span", { class: "endpoint-about" }, endpoint.about)
          ),
          h("div", { class: "endpoint-body" },
            paramRow,
            urlBox,
            h("div", { class: "endpoint-actions" }, sendButton, openLink),
            response
          )
        )
      );

      refresh();
      refreshers.push(refresh);
    }

    onApiChange.push(() => refreshers.forEach((refresh) => refresh()));
  }

  // ---------- sidebar highlight ----------

  function setupScrollSpy() {
    const links = new Map();
    for (const build of builds) links.set(build.section, build.tocLink);
    for (const link of $$(".toc-link[href='#api'], .toc-link[href='#help']")) {
      links.set($(link.getAttribute("href")), link);
    }

    const observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (!entry.isIntersecting) continue;
          for (const link of links.values()) link.classList.remove("is-current");
          links.get(entry.target)?.classList.add("is-current");
        }
      },
      { rootMargin: "-25% 0px -65% 0px" }
    );
    for (const section of links.keys()) observer.observe(section);
  }

  // ---------- theme ----------

  $("#theme-toggle").addEventListener("click", () => {
    const root = document.documentElement;
    const current = root.dataset.theme || (matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light");
    const next = current === "dark" ? "light" : "dark";
    root.dataset.theme = next;
    store.set("rbb-theme", next);
  });

  // ---------- start ----------

  setupCodeBlocks();
  fillApiLinks();
  setupProgressUI();
  setupSteps();
  updateProgress();
  setupHints();
  setupQuizzes();
  setupPreviews();
  setupExplorer();
  setupScrollSpy();
  checkHealth();
})();
