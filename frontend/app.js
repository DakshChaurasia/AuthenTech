(() => {
  "use strict";
  const $ = (id) => document.getElementById(id);
  const qsa = (s, r = document) => [...r.querySelectorAll(s)];
  const clamp = (v, a = 0, b = 1) => Math.min(b, Math.max(a, v));
  const lerp = (a, b, t) => a + (b - a) * t;
  const smooth = (t) => { t = clamp(t); return t * t * (3 - 2 * t); };
  const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
  const reduce = matchMedia("(prefers-reduced-motion: reduce)").matches;
  // Backend URL comes from config.js ("" = same origin, used when running locally).
  const API = String(window.AUTHENTECH_API || "").replace(/\/+$/, "");

  /* ───────────── hero compare slider ───────────── */
  const stage = $("stage"), tagR = $("tagR"), tagA = $("tagA");
  // Slider is manual only and starts in the middle. Tags are fixed in their corners; each one only
  // fades out when the divider has moved past it (so it never labels the wrong image).
  let x = 50, W = 1, dragging = false, edge = { r: 0, a: 0 };

  function measure() {
    W = stage.clientWidth;
    edge.r = tagR.offsetLeft + tagR.offsetWidth;  // right edge of the "authentic" tag
    edge.a = tagA.offsetLeft;                     // left edge of the "AI generated" tag
  }
  function renderSlider() {
    stage.style.setProperty("--x", x + "%");
    const lineX = (x / 100) * W;
    tagR.classList.toggle("off", lineX < edge.r + 16);
    tagA.classList.toggle("off", lineX > edge.a - 16);
  }
  function pointerToX(e) {
    const r = stage.getBoundingClientRect();
    return clamp(((e.clientX - r.left) / r.width) * 100, 0, 100);
  }
  stage.addEventListener("pointerdown", (e) => {
    if (e.target.closest("a")) return;
    dragging = true; stage.setPointerCapture(e.pointerId); x = pointerToX(e); renderSlider();
  });
  stage.addEventListener("pointermove", (e) => { if (dragging) { x = pointerToX(e); renderSlider(); } });
  const endDrag = () => { dragging = false; };
  stage.addEventListener("pointerup", endDrag);
  stage.addEventListener("pointercancel", endDrag);
  stage.addEventListener("keydown", () => {});
  addEventListener("resize", () => { measure(); renderSlider(); sizeRail(); onScroll(); });

  /* ───────────── scroll rail (custom scrollbar) ───────────── */
  const rail = $("rail"), thumb = $("thumb"), pct = $("pct");
  let railH = 1, thumbH = 52, railDrag = false;
  function sizeRail() { railH = rail.clientHeight; thumbH = thumb.offsetHeight; }
  const maxScroll = () => Math.max(1, document.documentElement.scrollHeight - innerHeight);
  function railToScroll(e) {
    const r = rail.getBoundingClientRect();
    const t = clamp((e.clientY - r.top - thumbH / 2) / (r.height - thumbH));
    window.scrollTo({ top: t * maxScroll(), behavior: "instant" });
  }
  rail.addEventListener("pointerdown", (e) => { railDrag = true; rail.classList.add("drag"); rail.setPointerCapture(e.pointerId); railToScroll(e); });
  rail.addEventListener("pointermove", (e) => { if (railDrag) railToScroll(e); });
  const endRail = () => { railDrag = false; rail.classList.remove("drag"); };
  rail.addEventListener("pointerup", endRail); rail.addEventListener("pointercancel", endRail);

  /* ───────────── scroll-driven effects ───────────── */
  const heroWrap = $("heroWrap"), mskew = $("mskew"), bigword = $("bigword"), steps = $("steps");
  const stepItems = qsa("li", steps), detectSec = $("detect");
  let lastY = scrollY, vel = 0, ticking = false;

  function onScroll() {
    const y = scrollY, vh = innerHeight;
    // hero shrink progress
    const p = clamp(y / Math.max(1, heroWrap.offsetHeight - vh)) || 0;
    stage.style.setProperty("--p", p.toFixed(4));
    // rail
    const prog = clamp(y / maxScroll()) || 0;
    thumb.style.top = prog * (railH - thumbH) + "px";
    pct.textContent = String(Math.round(prog * 100)).padStart(2, "0");
    // marquee skew by velocity
    vel = lerp(vel, y - lastY, 0.4); lastY = y;
    if (!reduce) mskew.style.transform = `skewX(${clamp(-vel * 0.3, -14, 14).toFixed(2)}deg)`;
    // parallax giant word
    const dr = detectSec.getBoundingClientRect();
    if (!reduce && dr.bottom > 0 && dr.top < vh) bigword.style.transform = `translateX(${(-dr.top * 0.45).toFixed(1)}px)`;
    // steps line fill
    const sr = steps.getBoundingClientRect();
    const fill = clamp((vh * 0.72 - sr.top) / sr.height);
    steps.style.setProperty("--fill", fill.toFixed(3));
    stepItems.forEach((li, i) => li.classList.toggle("on", fill > (i + 0.15) / stepItems.length - 0.05));
    ticking = false;
  }
  addEventListener("scroll", () => { if (!ticking) { ticking = true; requestAnimationFrame(onScroll); } }, { passive: true });
  // decay velocity skew when scrolling stops
  setInterval(() => { if (Math.abs(vel) > 0.05 && scrollY === lastY) { vel *= 0.6; if (!reduce) mskew.style.transform = `skewX(${clamp(-vel * 0.3, -14, 14).toFixed(2)}deg)`; } }, 60);

  /* ───────────── reveal + scramble ───────────── */
  const GLYPHS = "ABCDEF0123456789#%&<>/\\";
  function scramble(el) {
    const final = el.dataset.final || (el.dataset.final = el.textContent);
    if (reduce) { el.textContent = final; return; }
    const t0 = performance.now(), dur = 700;
    (function tick(now) {
      const k = clamp((now - t0) / dur);
      el.textContent = [...final].map((c, i) => (c === " " || i < k * final.length) ? c : GLYPHS[Math.floor(Math.random() * GLYPHS.length)]).join("");
      if (k < 1) requestAnimationFrame(tick); else el.textContent = final;
    })(t0);
  }
  const io = new IntersectionObserver((entries) => {
    entries.forEach((en) => {
      if (!en.isIntersecting) return;
      const el = en.target;
      // stagger siblings
      const idx = [...el.parentElement.children].filter((c) => c.classList.contains("rv")).indexOf(el);
      setTimeout(() => el.classList.add("in"), Math.max(0, idx) * 140);
      if (el.hasAttribute("data-scramble")) scramble(el);
      io.unobserve(el);
    });
  }, { threshold: 0.18 });
  qsa(".rv").forEach((el) => io.observe(el));

  /* ───────────── slabs / panel ───────────── */
  const acc = $("acc"), slabs = qsa(".slab", acc), panel = $("panel"), stash = $("stash");
  const MODES = {
    image: { title: "IMAGE SCAN", ico: "🖼️", text: "Click to choose an image, or drop it here", hint: "JPG · PNG · WEBP — up to 50 MB", accept: "image/*", max: 50, note: "Image results are estimates and can be less reliable on tiny, heavily compressed or edited pictures.", noun: "Image" },
    video: { title: "VIDEO SCAN", ico: "🎬", text: "Click to choose a video, or drop it here", hint: "MP4 · MOV · WEBM — up to 1 min · 500 MB", accept: "video/*", max: 500, note: "Video is checked by sampling frames across the clip with the image models and averaging the results.", noun: "Video" },
    text: { title: "TEXT SCAN", note: "AI-text detection is unreliable, especially for short, edited or non-native-English text. Never use it as sole proof.", noun: "Text" },
  };
  const MODEL_NAMES = {
    "Ateeqq/ai-vs-human-image-detector": "Image model A",
    "buildborderless/CommunityForensics-DeepfakeDet-ViT": "Image model B",
    "ShantanuT01/vanguard-ai-text-detector": "Text model A",
    "fakespot-ai/roberta-base-ai-text-detection-v1": "Text model B",
  };
  const STEPS = {
    image: ["decoding image", "normalizing pixels", "model A · extracting features", "model B · extracting features", "calibrating scores", "fusing verdict"],
    video: ["decoding video", "sampling frames", "model A · scanning frames", "model B · scanning frames", "calibrating scores", "fusing verdict"],
    text: ["tokenizing text", "splitting into chunks", "model A · scoring chunks", "model B · scoring chunks", "averaging scores", "fusing verdict"],
  };
  const UP_ICON = '<svg viewBox="0 0 64 64" fill="none" stroke="currentColor" stroke-width="2.4" aria-hidden="true"><path d="M32 44V12M20 24l12-12 12 12"/><path d="M10 40v12h44V40"/></svg>';
  let mode = null, file = null, previewUrl = null, busy = false;
  const el = (id) => $(id);

  // spotlight follows pointer
  slabs.forEach((s) => s.addEventListener("pointermove", (e) => {
    const r = s.getBoundingClientRect();
    s.style.setProperty("--mx", e.clientX - r.left + "px"); s.style.setProperty("--my", e.clientY - r.top + "px");
  }));

  function resetPanel() {
    file = null;
    if (previewUrl) URL.revokeObjectURL(previewUrl); previewUrl = null;
    el("file").value = ""; el("text").value = ""; el("count").textContent = "0 words";
    el("preview").replaceChildren(); ["preview", "result", "error", "log"].forEach((i) => (el(i).hidden = true));
    el("analyze").disabled = true; panel.classList.remove("scanning", "finishing");
  }

  /* Height and width must grow together from the card's CURRENT size: pin the section's height, switch the
     layout (widths animate via CSS flex), then animate the height to its new value. */
  let collapsedH = null, morphTimer = 0, closeTimer = 0;
  function morph(change, targetH) {
    if (reduce) { change(); return; }
    const h0 = acc.offsetHeight;
    acc.style.transition = "none"; acc.style.height = h0 + "px";
    change();
    const h1 = targetH();
    if (!h1 || Math.abs(h1 - h0) < 2) { acc.style.height = ""; acc.style.transition = ""; return; }
    void acc.offsetHeight; // lock in the starting height before animating
    acc.style.transition = "height .85s cubic-bezier(.77, 0, .18, 1)";
    acc.style.height = h1 + "px";
    clearTimeout(morphTimer);
    morphTimer = setTimeout(() => { acc.style.height = ""; acc.style.transition = ""; }, 920);
  }

  function openMode(m) {
    if (busy) return;
    clearTimeout(closeTimer);
    const slab = slabs.find((s) => s.dataset.mode === m);
    const wasCollapsed = !acc.dataset.open;
    if (wasCollapsed && !acc.style.height) collapsedH = acc.offsetHeight;
    const apply = () => {
      mode = m; acc.dataset.open = m;
      slabs.forEach((s) => { const o = s === slab; s.classList.toggle("open", o); s.setAttribute("aria-expanded", o); });
      resetPanel();
      slab.querySelector(".slab-panel").appendChild(panel);
      const cfg = MODES[m];
      el("pKicker").textContent = "// SCAN MODE 0" + (slabs.indexOf(slab) + 1);
      el("pTitle").textContent = cfg.title;
      el("uploadBox").hidden = m === "text"; el("textBox").hidden = m !== "text";
      if (m !== "text") {
        el("dropIco").innerHTML = UP_ICON; el("dropText").textContent = cfg.text; el("dropHint").textContent = cfg.hint; el("file").accept = cfg.accept;
      }
    };
    if (wasCollapsed) morph(apply, () => panel.offsetHeight); else apply();
    setTimeout(() => acc.scrollIntoView({ behavior: reduce ? "auto" : "smooth", block: "center" }), reduce ? 0 : 750);
  }
  function closeMode() {
    if (busy || !mode) return;
    morph(() => {
      mode = null; delete acc.dataset.open;
      slabs.forEach((s) => { s.classList.remove("open"); s.setAttribute("aria-expanded", "false"); });
    }, () => collapsedH);
    // keep the panel in place while the card fades/shrinks, then put it away
    clearTimeout(closeTimer);
    closeTimer = setTimeout(() => { resetPanel(); stash.appendChild(panel); }, reduce ? 0 : 700);
  }
  addEventListener("resize", () => { collapsedH = null; });
  slabs.forEach((s) => {
    s.addEventListener("click", (e) => { if (!s.classList.contains("open") && !e.target.closest(".panel")) openMode(s.dataset.mode); });
    s.addEventListener("keydown", (e) => { if ((e.key === "Enter" || e.key === " ") && e.target === s && !s.classList.contains("open")) { e.preventDefault(); openMode(s.dataset.mode); } });
  });
  el("pClose").onclick = closeMode;
  addEventListener("keydown", (e) => { if (e.key === "Escape" && mode) closeMode(); });

  /* file + text input */
  const showError = (msg) => { el("error").textContent = msg; el("error").hidden = false; };
  function setFile(f) {
    const cfg = MODES[mode];
    el("error").hidden = true; el("result").hidden = true;
    if (!f) return;
    if (!f.type.startsWith(mode + "/")) return showError(`Please choose a ${mode} file.`);
    if (f.size > cfg.max * 1024 * 1024) return showError(`File is too large (max ${cfg.max} MB).`);
    file = f;
    if (previewUrl) URL.revokeObjectURL(previewUrl);
    previewUrl = URL.createObjectURL(f);
    const media = document.createElement(mode === "image" ? "img" : "video");
    media.src = previewUrl;
    if (mode === "video") {
      media.controls = true; media.muted = true;
      media.onloadedmetadata = () => {
        if (media.duration > 60.5) { file = null; el("analyze").disabled = true; showError(`This video is ${Math.round(media.duration)} seconds long. Maximum is 1 minute.`); }
      };
    } else media.alt = "Selected image preview";
    const frame = document.createElement("div"); frame.className = "pv-frame"; frame.append(media);
    const name = document.createElement("div"); name.className = "fname"; name.textContent = f.name;
    el("preview").replaceChildren(frame, name); el("preview").hidden = false;
    el("analyze").disabled = false;
  }
  el("file").onchange = (e) => setFile(e.target.files[0]);
  const drop = el("drop");
  ["dragenter", "dragover"].forEach((ev) => drop.addEventListener(ev, (e) => { e.preventDefault(); drop.classList.add("over"); }));
  ["dragleave", "drop"].forEach((ev) => drop.addEventListener(ev, (e) => { e.preventDefault(); drop.classList.remove("over"); }));
  drop.addEventListener("drop", (e) => setFile(e.dataTransfer.files[0]));
  const words = (s) => (s.trim() ? s.trim().split(/\s+/).length : 0);
  el("text").oninput = () => { const n = words(el("text").value); el("count").textContent = `${n} word${n === 1 ? "" : "s"}`; el("analyze").disabled = n === 0; };

  /* ───────────── flow animation (canvas) ───────────── */
  const Flow = (() => {
    const cv = el("flow"), ctx = cv.getContext("2d");
    let w = 0, h = 0, dpr = 1, parts = [], raf = 0, state = "off", tFinish = 0, finishAI = false, done = null, tStart = 0;
    const NODE = () => ({ x: w * 0.9, y: h * 0.5 });
    function size() {
      const r = cv.parentElement.getBoundingClientRect();
      dpr = Math.min(2, devicePixelRatio || 1); w = r.width; h = r.height;
      cv.width = w * dpr; cv.height = h * dpr; ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    }
    function spawn(p, init) {
      p.x = init ? Math.random() * w * 0.9 : -20; p.y0 = h * (0.12 + Math.random() * 0.76); p.amp = 8 + Math.random() * 46;
      p.ph = Math.random() * 6.28; p.sp = 1.6 + Math.random() * 2.6; p.f = 0.004 + Math.random() * 0.009; p.px = p.x; p.py = p.y0; p.c = Math.random() < 0.12;
    }
    const pos = (p) => {
      const k = smooth((p.x - w * 0.5) / (w * 0.4)); const n = NODE();
      return [p.x, lerp(p.y0, n.y, k) + Math.sin(p.x * p.f + p.ph + performance.now() / 500) * p.amp * (1 - k)];
    };
    function gate(gx, label, t) {
      ctx.save(); ctx.strokeStyle = `rgba(118,185,0,${0.35 + 0.25 * Math.sin(t / 300 + gx)})`; ctx.setLineDash([6, 8]); ctx.lineWidth = 1;
      ctx.beginPath(); ctx.moveTo(gx, h * 0.08); ctx.lineTo(gx, h * 0.92); ctx.stroke(); ctx.setLineDash([]);
      ctx.fillStyle = "#76b900"; ctx.font = "500 11px 'JetBrains Mono', monospace"; ctx.fillText(label, gx + 8, h * 0.08 + 12); ctx.restore();
    }
    function frame(now) {
      if (state === "off") return;
      ctx.globalCompositeOperation = "destination-out"; ctx.fillStyle = "rgba(0,0,0,.2)"; ctx.fillRect(0, 0, w, h); ctx.globalCompositeOperation = "source-over";
      gate(w * 0.3, "MODEL A", now); gate(w * 0.5, "MODEL B", now);
      const n = NODE(), fin = state === "finishing", ft = fin ? clamp((now - tFinish) / 1500) : 0;
      for (const p of parts) {
        p.px = p.x; p.py = pos(p)[1];
        p.x += p.sp * (fin ? 1 + ft * 3 : 1) * (1 + smooth((p.x - w * 0.3) / (w * 0.6)) * 0.8);
        const [px, py] = pos(p);
        if (p.x > n.x - 6) { fin ? (p.x = n.x + 999) : spawn(p, false); continue; }
        ctx.strokeStyle = p.c ? "rgba(255,255,255,.9)" : "rgba(166,238,26,.85)"; ctx.lineWidth = p.c ? 2 : 1.4;
        ctx.beginPath(); ctx.moveTo(p.px, p.py); ctx.lineTo(px, py); ctx.stroke();
      }
      // verdict node
      const pulse = 1 + 0.2 * Math.sin(now / 160);
      const col = fin && ft > 0.45 ? (finishAI ? "255,77,77" : "166,238,26") : "166,238,26";
      ctx.strokeStyle = `rgba(${col},.9)`; ctx.lineWidth = 2; ctx.beginPath(); ctx.arc(n.x, n.y, 14 * pulse, 0, 6.283); ctx.stroke();
      ctx.fillStyle = `rgba(${col},.85)`; ctx.beginPath(); ctx.arc(n.x, n.y, 5, 0, 6.283); ctx.fill();
      if (fin && ft > 0.45) { // shock ring
        const r = (ft - 0.45) / 0.55; ctx.strokeStyle = `rgba(${col},${1 - r})`; ctx.lineWidth = 3; ctx.beginPath(); ctx.arc(n.x, n.y, 14 + r * Math.max(w, h) * 0.6, 0, 6.283); ctx.stroke();
      }
      if (fin && ft >= 1) { state = "off"; ctx.clearRect(0, 0, w, h); done && done(); return; }
      raf = requestAnimationFrame(frame);
    }
    return {
      start() {
        if (reduce) return;
        size(); ctx.clearRect(0, 0, w, h); state = "run"; tStart = performance.now();
        parts = Array.from({ length: Math.round(clamp(w / 7, 60, 170)) }, () => { const p = {}; spawn(p, true); return p; });
        cancelAnimationFrame(raf); raf = requestAnimationFrame(frame);
      },
      finish(ai) {
        if (reduce || state === "off") return Promise.resolve();
        return new Promise((res) => { finishAI = ai; tFinish = performance.now(); state = "finishing"; done = res; });
      },
      stop() { state = "off"; cancelAnimationFrame(raf); ctx.clearRect(0, 0, w, h); },
    };
  })();

  /* ───────────── terminal log ───────────── */
  const Log = (() => {
    const box = el("log"); let timer = 0;
    const add = (t, ok) => { const d = document.createElement("div"); d.textContent = "> " + t; if (ok) d.className = "ok"; box.append(d); while (box.children.length > 5) box.firstChild.remove(); };
    return {
      start(list) { box.replaceChildren(); box.hidden = false; let i = 0; add(list[i++]); timer = setInterval(() => { add(list[Math.min(i, list.length - 1)] + (i >= list.length ? " …" : "")); i++; }, 620); },
      stop(ok) { clearInterval(timer); if (ok) add("verdict ready", true); },
      hide() { clearInterval(timer); box.hidden = true; },
    };
  })();

  /* ───────────── analyze ───────────── */
  async function analyze() {
    if (busy) return;
    el("error").hidden = true; el("result").hidden = true;
    const body = new FormData();
    if (mode === "text") body.append("text", el("text").value); else body.append("file", file);
    busy = true; el("analyze").disabled = true; panel.classList.add("scanning");
    Flow.start(); Log.start(STEPS[mode]);
    let data = null, err = null;
    try {
      const [res] = await Promise.all([fetch(`${API}/api/${mode}`, { method: "POST", body }), sleep(reduce ? 300 : 2600)]);
      data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(typeof data.detail === "string" ? data.detail : "Something went wrong. Please try again.");
    } catch (e) { err = e; }
    if (err) {
      Flow.stop(); Log.hide(); panel.classList.remove("scanning");
      showError(err.message === "Failed to fetch"
        ? (API ? "The AuthenTech detection server is offline right now (it runs on the site owner's computer). Please try again later."
               : "Could not reach the AuthenTech server. Is it running?")
        : err.message);
    } else {
      Log.stop(true); panel.classList.add("finishing");
      await Flow.finish(data.verdict === "AI Generated");
      panel.classList.remove("scanning", "finishing"); renderResult(data);
    }
    busy = false;
    el("analyze").disabled = mode === "text" ? words(el("text").value) === 0 : !file;
  }
  el("analyze").onclick = analyze;
  el("again").onclick = () => { resetPanel(); acc.scrollIntoView({ behavior: reduce ? "auto" : "smooth", block: "center" }); };

  function renderResult(d) {
    const ai = d.verdict === "AI Generated", cfg = MODES[mode];
    const v = el("rVerdict");
    v.textContent = ai ? `AI Generated${mode === "text" ? " Text" : " " + cfg.noun}` : `Authentic${mode === "text" ? " Text" : " " + cfg.noun}`;
    v.className = "r-verdict " + (ai ? "ai" : "authentic"); void v.offsetWidth; v.classList.add("glitch");
    // counter
    const out = el("rConf"), t0 = performance.now(), dur = reduce ? 1 : 1100;
    (function tick(now) { const k = clamp((now - t0) / dur); out.textContent = (d.confidence * (1 - Math.pow(1 - k, 3))).toFixed(1); if (k < 1) requestAnimationFrame(tick); else out.textContent = d.confidence.toFixed(1); })(t0);
    // segmented meter
    const seg = el("seg"); seg.style.setProperty("--c", ai ? "var(--ai)" : "var(--g)");
    seg.replaceChildren(...Array.from({ length: 25 }, () => document.createElement("i")));
    const lit = Math.round((d.confidence / 100) * 25);
    [...seg.children].forEach((b, i) => { if (i < lit) setTimeout(() => b.classList.add("on"), reduce ? 0 : 45 * i + 150); });
    // rows
    const rows = Object.entries(d.models).map(([k, p]) => [`${MODEL_NAMES[k] || k} · chance AI`, p + "%"]);
    if (d.frames_analyzed) rows.push(["Frames analyzed", d.frames_analyzed]);
    if (d.words_analyzed) rows.push(["Words analyzed", d.words_analyzed]);
    el("rRows").replaceChildren(...rows.map(([a, b]) => { const r = document.createElement("div"), l = document.createElement("span"), n = document.createElement("b"); l.textContent = a; n.textContent = b; r.append(l, n); return r; }));
    el("rNote").textContent = cfg.note;
    el("result").hidden = false;
    setTimeout(() => el("result").scrollIntoView({ behavior: reduce ? "auto" : "smooth", block: "center" }), 120);
  }

  /* ───────────── click ripple ───────────── */
  addEventListener("pointerdown", (e) => {
    if (reduce) return;
    ["", "r2"].forEach((cls) => {
      const r = document.createElement("span");
      r.className = ("ripple " + cls).trim(); r.style.left = e.clientX + "px"; r.style.top = e.clientY + "px";
      document.body.append(r); setTimeout(() => r.remove(), 1200);
    });
  });

  /* init */
  function init() { measure(); renderSlider(); sizeRail(); onScroll(); }
  init();
  (document.fonts && document.fonts.ready ? document.fonts.ready : Promise.resolve()).then(init);
  addEventListener("load", init);
})();
