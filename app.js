/* Daybook — offline-first personal tracker with optional Supabase sync. */
(() => {
  "use strict";

  // ---------- helpers ----------
  const $ = (s, r = document) => r.querySelector(s);
  const esc = (s) => String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
  const uid = () => (crypto.randomUUID ? crypto.randomUUID() : Date.now().toString(36) + Math.random().toString(36).slice(2));
  const pad = (n) => String(n).padStart(2, "0");
  const dayKey = (d = new Date()) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
  const addDays = (d, n) => { const x = new Date(d); x.setDate(x.getDate() + n); return x; };
  const parseDay = (k) => { const [y, m, d] = k.split("-").map(Number); return new Date(y, m - 1, d); };
  const fmtMin = (m) => { m = Math.round(m || 0); if (m < 60) return `${m}m`; const h = Math.floor(m / 60), r = m % 60; return r ? `${h}h ${r}m` : `${h}h`; };
  const fmtDue = (k) => {
    if (!k) return "";
    const t = dayKey(), diff = Math.round((parseDay(k) - parseDay(t)) / 864e5);
    if (diff === 0) return "Today"; if (diff === 1) return "Tomorrow"; if (diff === -1) return "Yesterday";
    if (diff > 1 && diff < 7) return parseDay(k).toLocaleDateString(undefined, { weekday: "long" });
    return parseDay(k).toLocaleDateString(undefined, { day: "numeric", month: "short" });
  };
  const dueClass = (k, done) => { if (!k || done) return ""; const t = dayKey(); return k < t ? "overdue" : k === t ? "duetoday" : ""; };
  const haptic = (ms = 8) => { try { navigator.vibrate && navigator.vibrate(ms); } catch {} };

  // Icon paths (24px grid, stroke)
  const I = {
    sun: '<circle cx="12" cy="12" r="4"/><path d="M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4"/>',
    check: '<path d="M5 12.5l4.5 4.5L19 7.5"/>',
    task: '<circle cx="12" cy="12" r="9"/><path d="M8 12.5l2.8 2.8L16.5 9.5"/>',
    video: '<rect x="2.5" y="5.5" width="14" height="13" rx="3"/><path d="M16.5 10l5-3v10l-5-3"/>',
    meeting: '<rect x="3" y="4.5" width="18" height="16" rx="3"/><path d="M3 9.5h18M8 2.5v4M16 2.5v4"/>',
    learn: '<path d="M2 8l10-4.5L22 8l-10 4.5L2 8Z"/><path d="M6 10v5c0 1.7 2.7 3 6 3s6-1.3 6-3v-5"/>',
    idea: '<path d="M9 18h6M10 21h4"/><path d="M12 3a6 6 0 0 0-3.5 10.9c.6.4 1 1.1 1 1.8V16h5v-.3c0-.7.4-1.4 1-1.8A6 6 0 0 0 12 3Z"/>',
    routine: '<path d="M20.5 12a8.5 8.5 0 1 1-2.6-6.1"/><path d="M20.5 4v4.5H16"/>',
    note: '<path d="M14 3H6a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V9l-6-6Z"/><path d="M14 3v6h6M8 13h8M8 17h5"/>',
    flame: '<path d="M12 22c4 0 7-2.7 7-7 0-3-1.6-5.2-3.2-6.8-.5 1.7-1.6 2.8-2.8 2.8 0-3.5-1.5-6.6-4-8-.2 3.5-4 5.8-4 11 0 4.3 3 8 7 8Z"/>',
    clock: '<circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/>',
    up: '<path d="M12 19V5M5.5 11.5L12 5l6.5 6.5"/>',
    chev: '<path d="M9 5l7 7-7 7"/>',
    play: '<path d="M7 4.5v15l12-7.5-12-7.5Z"/>',
    gear: '<path d="M12 15.5a3.5 3.5 0 1 0 0-7 3.5 3.5 0 0 0 0 7Z"/><path d="M19.4 15a1.7 1.7 0 0 0 .3 1.8l.1.1a2 2 0 1 1-2.8 2.8l-.1-.1a1.7 1.7 0 0 0-1.8-.3 1.7 1.7 0 0 0-1 1.5V21a2 2 0 1 1-4 0v-.1a1.7 1.7 0 0 0-1.1-1.5 1.7 1.7 0 0 0-1.8.3l-.1.1a2 2 0 1 1-2.8-2.8l.1-.1a1.7 1.7 0 0 0 .3-1.8 1.7 1.7 0 0 0-1.5-1H3a2 2 0 1 1 0-4h.1a1.7 1.7 0 0 0 1.5-1.1 1.7 1.7 0 0 0-.3-1.8l-.1-.1a2 2 0 1 1 2.8-2.8l.1.1a1.7 1.7 0 0 0 1.8.3H9a1.7 1.7 0 0 0 1-1.5V3a2 2 0 1 1 4 0v.1a1.7 1.7 0 0 0 1 1.5 1.7 1.7 0 0 0 1.8-.3l.1-.1a2 2 0 1 1 2.8 2.8l-.1.1a1.7 1.7 0 0 0-.3 1.8V9a1.7 1.7 0 0 0 1.5 1H21a2 2 0 1 1 0 4h-.1a1.7 1.7 0 0 0-1.5 1Z"/>',
  };
  const ico = (k) => `<svg viewBox="0 0 24 24" aria-hidden="true">${I[k]}</svg>`;

  const AREAS = {
    editing: { label: "Video editing", c: "var(--orange)" },
    productivity: { label: "Productivity", c: "var(--blue)" },
    learning: { label: "Learning", c: "var(--purple)" },
    personal: { label: "Personal", c: "var(--pink)" },
    health: { label: "Health", c: "var(--green)" },
  };
  const EDIT_STATUS = { raw: "Raw in", cutting: "Cutting", graphics: "Graphics", review: "Review", exported: "Exported" };
  const STATUS_COLOR = { raw: "var(--fg-2)", cutting: "var(--orange)", graphics: "var(--purple)", review: "var(--pink)", exported: "var(--green)" };
  const IDEA_STATUS = { someday: "Someday", next: "Next up", started: "Started" };
  const HABIT_TIME = { morning: "Morning", afternoon: "Afternoon", evening: "Evening", anytime: "Any time" };
  const FOCUS_GOAL = 120;
  const GROW_KEYS = ["routine", "learn", "ideas"];

  // ---------- storage ----------
  const LS = "daybook.v1";
  const blank = () => ({ items: {}, meta: { dirty: {}, lastServer: null, timer: null, sbUrl: "", sbKey: "" } });
  let store;
  try { store = JSON.parse(localStorage.getItem(LS)) || blank(); } catch { store = blank(); }
  store.meta = Object.assign(blank().meta, store.meta || {});
  const save = () => { try { localStorage.setItem(LS, JSON.stringify(store)); } catch (e) { toast("Couldn't save on this device: storage is full or blocked.", false); } };

  const all = (type) => Object.values(store.items).filter((i) => !i.deleted && (!type || i.type === type));
  function put(item, quiet) {
    item.updatedAt = Date.now();
    if (!item.createdAt) item.createdAt = item.updatedAt;
    store.items[item.id] = item;
    store.meta.dirty[item.id] = 1;
    save();
    if (!quiet) render();
    scheduleSync();
    return item;
  }
  function remove(id) { const it = store.items[id]; if (it) { it.deleted = true; put(it); } }

  // ---------- state ----------
  let tab = "today";
  let taskFilter = "open";
  let editFilter = "active";
  const ui = {};
  let growTab = "routine";
  try { tab = localStorage.getItem("daybook.tab") || "today"; growTab = localStorage.getItem("daybook.grow") || "routine"; } catch {}
  if (GROW_KEYS.includes(tab)) { growTab = tab; tab = "grow"; }
  if (!["today", "tasks", "edits", "meetings", "grow"].includes(tab)) tab = "today";
  if (!GROW_KEYS.includes(growTab)) growTab = "routine";

  // ---------- derived ----------
  const logs = () => all("log");
  const minutesOn = (day, pred = () => true) => logs().filter((l) => l.date === day && pred(l)).reduce((s, l) => s + (+l.minutes || 0), 0);
  const minutesFor = (refId) => logs().filter((l) => l.refId === refId).reduce((s, l) => s + (+l.minutes || 0), 0);
  function weekStart() { const d = new Date(); const wd = (d.getDay() + 6) % 7; return dayKey(addDays(d, -wd)); }
  function streak(h) {
    const days = h.days || {};
    let d = new Date(); if (!days[dayKey(d)]) d = addDays(d, -1);
    let n = 0; while (days[dayKey(d)]) { n++; d = addDays(d, -1); }
    return n;
  }
  function greeting() { const h = new Date().getHours(); return h < 5 ? "Good night" : h < 12 ? "Good morning" : h < 17 ? "Good afternoon" : "Good evening"; }

  // ---------- render ----------
  const TITLES = { today: "Today", tasks: "Tasks", edits: "Edits", meetings: "Meetings", grow: "Grow" };
  const GROW = { routine: "Routine", learn: "Learning", ideas: "Ideas" };
  function render(animate) {
    const now = new Date();
    $("#today-label").textContent = tab === "today" ? `${greeting()} · ${now.toLocaleDateString(undefined, { weekday: "long", day: "numeric", month: "long" })}` : now.toLocaleDateString(undefined, { weekday: "long", day: "numeric", month: "long" });
    $("#view-title").textContent = TITLES[tab];
    document.querySelectorAll(".dock button").forEach((b) => { if (b.dataset.tab === tab) b.setAttribute("aria-current", "page"); else b.removeAttribute("aria-current"); });
    const focused = document.activeElement && document.activeElement.id;
    const draft = $("#note-text") ? $("#note-text").value : "";
    const v = $("#view");
    v.innerHTML = VIEWS[tab]();
    if (animate) { v.classList.remove("enter"); void v.offsetWidth; v.classList.add("enter"); }
    if ($("#note-text")) $("#note-text").value = draft;
    if (focused && document.getElementById(focused)) document.getElementById(focused).focus();
    tickTimer();
    requestAnimationFrame(() => document.querySelectorAll(".rings .val").forEach((c) => (c.style.strokeDashoffset = c.dataset.off)));
  }

  const empty = (icon, title, text) => `<div class="empty"><div class="empty-ico">${ico(icon)}</div><div class="empty-txt"><b>${title}</b>${text ? `<span>${text}</span>` : ""}</div></div>`;
  const areaDot = (a) => `<span class="dot" style="--c:${(AREAS[a] || {}).c || "var(--fg-3)"}"></span>`;
  const checkBtn = (on, action, id, label, color) => `<button class="check ${on ? "on" : ""}" ${color ? `style="--cc:${color}"` : ""} data-action="${action}" data-id="${id}" aria-label="${esc(label)}" aria-pressed="${on}">${ico("check")}</button>`;
  const sectionHead = (title, btn) => `<div class="section-head"><h2>${title}</h2>${btn || ""}</div>`;

  function taskRow(t) {
    const due = t.due ? `<span class="${dueClass(t.due, t.done)}">${fmtDue(t.due)}</span>` : "";
    return `<div class="row ${t.done ? "done" : ""}">
      ${checkBtn(t.done, "toggle-task", t.id, t.done ? "Mark not done" : "Mark done", (AREAS[t.area] || {}).c)}
      <button class="row-main" data-action="edit" data-id="${t.id}">
        <span class="row-title">${esc(t.title)}</span>
        <span class="row-meta">${areaDot(t.area)}<span>${esc((AREAS[t.area] || {}).label || "General")}</span>${due}</span>
      </button></div>`;
  }
  function projectRow(p) {
    const due = p.due ? `<span class="${dueClass(p.due, p.status === "exported")}">Due ${fmtDue(p.due)}</span>` : "";
    const mins = minutesFor(p.id);
    return `<div class="row">
      <span class="tile-ico" style="--c:${STATUS_COLOR[p.status] || "var(--orange)"};width:30px;height:30px;border-radius:8px">${ico("video")}</span>
      <button class="row-main" data-action="edit" data-id="${p.id}">
        <span class="row-title">${esc(p.title)}</span>
        <span class="row-meta">${p.client ? `<span>${esc(p.client)}</span>` : ""}${due}${mins ? `<span>${fmtMin(mins)}</span>` : ""}${!p.client && !due && !mins ? "<span>Tap the stage to move it on</span>" : ""}</span>
      </button>
      <button class="chip s-${p.status}" data-action="next-status" data-id="${p.id}" aria-label="Stage ${esc(EDIT_STATUS[p.status])}, tap to move on">${esc(EDIT_STATUS[p.status] || "Raw in")}</button>
    </div>`;
  }
  function habitRow(h, today) {
    const on = !!(h.days || {})[today];
    const s = streak(h);
    const dots = [6, 5, 4, 3, 2, 1, 0].map((n) => `<i class="${(h.days || {})[dayKey(addDays(new Date(), -n))] ? "on" : ""}"></i>`).join("");
    return `<div class="row ${on ? "done" : ""}">
      ${checkBtn(on, "toggle-habit", h.id, on ? "Undo for today" : "Done today", "var(--green)")}
      <button class="row-main" data-action="edit" data-id="${h.id}">
        <span class="row-title">${esc(h.title)}</span>
        <span class="row-meta"><span>${esc(HABIT_TIME[h.time] || "Any time")}</span>${s ? `<span class="streak">${ico("flame")}${s} day${s > 1 ? "s" : ""}</span>` : "<span>Start a streak today</span>"}</span>
      </button>
      <span class="habit-days" aria-hidden="true">${dots}</span>
    </div>`;
  }
  function learnRow(l) {
    const total = minutesFor(l.id);
    const week = logs().filter((x) => x.refId === l.id && x.date >= weekStart()).reduce((s, x) => s + (+x.minutes || 0), 0);
    const goal = +l.goal || 0;
    const pct = goal ? Math.min(100, Math.round((week / goal) * 100)) : 0;
    return `<div class="row" style="flex-wrap:wrap;row-gap:10px">
      <span class="tile-ico" style="--c:var(--purple)">${ico("learn")}</span>
      <button class="row-main" data-action="edit" data-id="${l.id}">
        <span class="row-title">${esc(l.title)}</span>
        <span class="row-meta"><span>${fmtMin(week)}${goal ? ` of ${fmtMin(goal)}` : ""} this week</span><span>${fmtMin(total)} total</span></span>
      </button>
      <button class="pill-btn" style="--c:var(--purple)" data-action="log-learn" data-id="${l.id}">+15 min</button>
      ${goal ? `<div class="meter" style="flex-basis:100%;margin-left:42px"><i style="width:${pct}%"></i></div>` : ""}
    </div>`;
  }
  function ideaRow(i) {
    return `<div class="row">
      <span class="tile-ico" style="--c:var(--yellow)">${ico("idea")}</span>
      <button class="row-main" data-action="edit" data-id="${i.id}">
        <span class="row-title">${esc(i.title)}</span>
        ${i.notes ? `<span class="row-meta"><span>${esc(i.notes.slice(0, 80))}${i.notes.length > 80 ? "…" : ""}</span></span>` : ""}
      </button>
      <button class="chip i-${i.status}" data-action="next-idea" data-id="${i.id}" aria-label="Status ${esc(IDEA_STATUS[i.status])}, tap to change">${esc(IDEA_STATUS[i.status] || "Someday")}</button>
    </div>`;
  }
  function logRow(l) {
    const when = new Date(l.createdAt || Date.now()).toLocaleTimeString(undefined, { hour: "numeric", minute: "2-digit" });
    const ref = l.refId && store.items[l.refId] && !store.items[l.refId].deleted ? store.items[l.refId].title : "";
    return `<div class="row">
      ${areaDot(l.area)}
      <button class="row-main" data-action="edit" data-id="${l.id}">
        <span class="row-title log-text">${esc(l.text || "Focus session")}</span>
        <span class="row-meta"><span>${l.date === dayKey() ? when : fmtDue(l.date)}</span>${l.minutes ? `<span>${fmtMin(l.minutes)}</span>` : ""}${ref ? `<span>${esc(ref)}</span>` : ""}</span>
      </button></div>`;
  }
  function fmtTime(t) {
    if (!t) return "";
    const [h, m] = t.split(":").map(Number);
    return new Date(2000, 0, 1, h, m).toLocaleTimeString(undefined, { hour: "numeric", minute: "2-digit" });
  }
  function meetingRow(m) {
    const day = m.date === dayKey() ? "Today" : fmtDue(m.date);
    return `<div class="row ${m.done ? "done" : ""}">
      ${checkBtn(m.done, "toggle-meeting", m.id, m.done ? "Mark not held" : "Mark as held", "var(--blue)")}
      <button class="row-main" data-action="edit" data-id="${m.id}">
        <span class="row-title">${esc(m.title)}</span>
        <span class="row-meta"><span>${esc(day)}${m.time ? ", " + esc(fmtTime(m.time)) : ""}</span>${m.who ? `<span>${esc(m.who)}</span>` : ""}${m.notes ? "<span>Notes</span>" : ""}</span>
      </button>
    </div>`;
  }
  const byWhen = (a, b) => ((a.date || "") + (a.time || "99")).localeCompare((b.date || "") + (b.time || "99"));

  function focusCard() {
    const t = store.meta.timer;
    if (t) {
      return `<div class="card focus">
        <div class="focus-row"><div style="flex:1;min-width:0"><div class="focus-time" id="timer-time">0:00</div><div class="sub"><span class="focus-dot"></span>${esc(focusLabel(t.target))}</div></div>
        <button class="btn small" data-action="timer-stop">Done</button></div>
        <button class="link-btn" data-action="timer-cancel" style="align-self:flex-start;font-size:15px;color:var(--red)">Discard</button></div>`;
    }
    const opts = focusOptions().map((o) => `<option value="${esc(o.v)}">${esc(o.l)}</option>`).join("");
    return `<div class="card">
      <div class="field" style="padding:4px 18px"><label for="timer-target">Focus on</label><select id="timer-target">${opts}</select></div>
      <div style="padding:0 16px 16px"><button class="btn" style="width:100%" data-action="timer-start">Start focus timer</button></div></div>`;
  }
  function focusOptions() {
    const o = [];
    all("project").filter((p) => p.status !== "exported").forEach((p) => o.push({ v: "ref:" + p.id, l: p.title }));
    all("learn").forEach((l) => o.push({ v: "ref:" + l.id, l: l.title }));
    Object.entries(AREAS).forEach(([k, a]) => o.push({ v: "area:" + k, l: a.label }));
    return o;
  }
  function focusLabel(target) {
    if (!target) return "";
    if (target.startsWith("ref:")) { const it = store.items[target.slice(4)]; return it ? it.title : "Focus session"; }
    return (AREAS[target.slice(5)] || {}).label || "Focus session";
  }

  function ringsCard(focusToday, habitsDone, habitsTotal, tasksDone, tasksDue) {
    const rings = [
      { r: 52, w: 11, g: 1, p: focusToday / FOCUS_GOAL },
      { r: 38, w: 11, g: 2, p: habitsTotal ? habitsDone / habitsTotal : 0 },
      { r: 24, w: 11, g: 3, p: tasksDue ? tasksDone / tasksDue : 0 },
    ];
    const defs = [1, 2, 3].map((n) => `<linearGradient id="rg${n}" x1="0" y1="0" x2="1" y2="1"><stop offset="0" style="stop-color:var(--ring-${n})"/><stop offset="1" style="stop-color:var(--ring-${n}b)"/></linearGradient>`).join("");
    const svg = rings.map(({ r, w, g, p }) => {
      const len = 2 * Math.PI * r, off = len * (1 - Math.min(1, Math.max(0, p)));
      return `<circle class="trk" cx="60" cy="60" r="${r}" stroke-width="${w}"/><circle class="val" cx="60" cy="60" r="${r}" stroke="url(#rg${g})" stroke-width="${w}" stroke-dasharray="${len.toFixed(1)}" stroke-dashoffset="${len.toFixed(1)}" data-off="${(p > 0 ? Math.min(off, len - .01) : len).toFixed(1)}"/>`;
    }).join("");
    const row = (n, k, v, of) => `<div class="legend-row"><span class="sw" style="--c:linear-gradient(135deg,var(--ring-${n}),var(--ring-${n}b))"></span><span class="k">${k}</span><span class="v">${v}<small> / ${of}</small></span></div>`;
    return `<div class="card rings-card">
      <div class="rings"><svg viewBox="0 0 120 120" role="img" aria-label="Today's progress: focus, routine and tasks"><defs>${defs}</defs>${svg}</svg></div>
      <div class="legend">
        ${row(1, "Focus", fmtMin(focusToday), fmtMin(FOCUS_GOAL))}
        ${row(2, "Routine", habitsDone, habitsTotal)}
        ${row(3, "Tasks", tasksDone, tasksDue)}
      </div></div>`;
  }

  const VIEWS = {
    today() {
      const today = dayKey();
      const tasks = all("task").filter((t) => !t.done && (!t.due || t.due <= today)).sort(byDue);
      const doneToday = all("task").filter((t) => t.done && t.doneAt === today).length;
      const habits = all("habit").sort(byHabitTime);
      const habitsDone = habits.filter((h) => (h.days || {})[today]).length;
      const focusToday = minutesOn(today);
      const projects = all("project").filter((p) => p.status !== "exported").sort(byDue);
      const days = [6, 5, 4, 3, 2, 1, 0].map((n) => { const d = addDays(new Date(), -n); return { k: dayKey(d), lbl: d.toLocaleDateString(undefined, { weekday: "narrow" }), m: minutesOn(dayKey(d)) }; });
      const max = Math.max(60, ...days.map((d) => d.m));
      const weekTotal = days.reduce((s, d) => s + d.m, 0);
      const todayLogs = logs().filter((l) => l.date === today).sort((a, b) => b.createdAt - a.createdAt);
      const meetingsToday = all("meeting").filter((m) => m.date === today).sort(byWhen);
      const dueTotal = doneToday + tasks.filter((t) => t.due).length;
      return `
      ${ringsCard(focusToday, habitsDone, habits.length, doneToday, Math.max(dueTotal, doneToday))}
      <section class="section">${sectionHead("To do", `<button class="link-btn" data-action="new" data-type="task">Add</button>`)}
        <div class="card list">${tasks.length ? tasks.slice(0, 8).map(taskRow).join("") : empty("task", all("task").length ? "All clear" : "Nothing to do yet", all("task").length ? "Nothing due today. Enjoy it." : "Tap + to add your first task.")}</div></section>
      ${meetingsToday.length ? `<section class="section">${sectionHead("Meetings", `<button class="link-btn" data-tab-go="meetings">See all</button>`)}
        <div class="card list">${meetingsToday.map(meetingRow).join("")}</div></section>` : ""}
      <section class="section">${sectionHead("Routine", `<button class="link-btn" data-tab-go="routine">Edit</button>`)}
        <div class="card list">${habits.length ? habits.map((h) => habitRow(h, today)).join("") : empty("routine", "Build your routine", "Add daily habits like a morning walk or practising colour grading.")}</div></section>
      <section class="section">${sectionHead("Focus")}${focusCard()}</section>
      ${projects.length ? `<section class="section">${sectionHead("Edits in progress", `<button class="link-btn" data-tab-go="edits">See all</button>`)}
        <div class="card list">${projects.slice(0, 4).map(projectRow).join("")}</div></section>` : ""}
      <section class="section">${sectionHead("This week")}
        <div class="card week"><div class="bars">${days.map((d, i) => `<div class="bar ${d.k === today ? "today" : ""} ${d.m ? "has" : ""}" title="${fmtMin(d.m)}"><i style="height:${Math.max(6, (d.m / max) * 66)}px;animation-delay:${i * 40}ms"></i><span>${d.lbl}</span></div>`).join("")}</div>
        <div class="week-foot"><span>Focused time</span><span>${fmtMin(weekTotal)} total</span></div></div></section>
      <section class="section">${sectionHead("Journal")}
        <div class="card list plain">
          <div class="note-input"><textarea id="note-text" rows="1" placeholder="How's your day going?"></textarea><button class="send press" data-action="add-note" aria-label="Add to journal">${ico("up")}</button></div>
          ${todayLogs.map(logRow).join("")}
        </div></section>`;
    },

    tasks() {
      const today = dayKey();
      const filters = { open: "All", today: "Today", ...Object.fromEntries(Object.entries(AREAS).map(([k, a]) => [k, a.label])), done: "Completed" };
      let list = all("task");
      if (taskFilter === "done") list = list.filter((t) => t.done).sort((a, b) => b.updatedAt - a.updatedAt);
      else {
        list = list.filter((t) => !t.done);
        if (taskFilter === "today") list = list.filter((t) => t.due && t.due <= today);
        else if (AREAS[taskFilter]) list = list.filter((t) => t.area === taskFilter);
        list.sort(byDue);
      }
      return `<div class="filters" role="group" aria-label="Filter tasks">${Object.entries(filters).map(([k, l]) => `<button class="filter" data-action="task-filter" data-f="${k}" aria-pressed="${taskFilter === k}">${esc(l)}</button>`).join("")}</div>
        <div class="card list">${list.length ? list.map(taskRow).join("") : taskFilter === "done" ? empty("task", "Nothing completed yet", "Ticked-off tasks land here.") : empty("task", "You're all caught up", "Tap + to add a task.")}</div>`;
    },

    edits() {
      let list = all("project");
      const order = Object.keys(EDIT_STATUS);
      if (editFilter === "active") list = list.filter((p) => p.status !== "exported");
      else if (editFilter === "exported") list = list.filter((p) => p.status === "exported");
      list.sort((a, b) => order.indexOf(a.status) - order.indexOf(b.status) || byDue(a, b));
      const pipeline = order.map((s) => { const n = all("project").filter((p) => p.status === s).length; return `<div class="stage ${n ? "has" : ""}" style="--c:${STATUS_COLOR[s]}"><b>${n}</b><span>${EDIT_STATUS[s]}</span></div>`; }).join("");
      const editMin = logs().filter((l) => l.area === "editing" && l.date >= weekStart()).reduce((s, l) => s + (+l.minutes || 0), 0);
      return `<div class="card pipeline">${pipeline}</div>
        <div class="seg" role="group" aria-label="Filter edits">${[["active", "In progress"], ["exported", "Exported"], ["all", "All"]].map(([k, l]) => `<button data-action="edit-filter" data-f="${k}" aria-pressed="${editFilter === k}">${l}</button>`).join("")}</div>
        <div class="card list">${list.length ? list.map(projectRow).join("") : empty("video", "No videos here", "Tap + and choose Video edit to track one from raw footage to export.")}</div>
        <p class="help">${fmtMin(editMin)} of editing this week. Tap a stage to move a video on.</p>`;
    },

    meetings() {
      const today = dayKey();
      const ms = all("meeting");
      const upcoming = ms.filter((m) => !m.done && (m.date || today) >= today).sort(byWhen);
      const past = ms.filter((m) => m.done || (m.date || today) < today).sort((a, b) => byWhen(b, a)).slice(0, 30);
      return `<section class="section">${sectionHead("Upcoming", `<button class="link-btn" data-action="new" data-type="meeting">Add</button>`)}
        <div class="card list">${upcoming.length ? upcoming.map(meetingRow).join("") : empty("meeting", "No meetings coming up", "Add client calls, team syncs or review sessions.")}</div></section>
        ${past.length ? `<section class="section">${sectionHead("Past")}<div class="card list">${past.map(meetingRow).join("")}</div></section>` : ""}`;
    },

    learn() {
      const list = all("learn").sort((a, b) => a.createdAt - b.createdAt);
      const learnLogs = logs().filter((l) => l.area === "learning").sort((a, b) => b.createdAt - a.createdAt).slice(0, 10);
      return `<section class="section">${sectionHead("Topics", `<button class="link-btn" data-action="new" data-type="learn">Add</button>`)}
        <div class="card list">${list.length ? list.map(learnRow).join("") : empty("learn", "What are you learning?", "Add a skill, course or book and set a weekly goal.")}</div></section>
        ${learnLogs.length ? `<section class="section">${sectionHead("Recent sessions")}<div class="card list">${learnLogs.map(logRow).join("")}</div></section>` : ""}`;
    },

    ideas() {
      const order = Object.keys(IDEA_STATUS);
      const list = all("idea").sort((a, b) => order.indexOf(b.status) - order.indexOf(a.status) || b.createdAt - a.createdAt);
      return `<div class="card list">${list.length ? list.map(ideaRow).join("") : empty("idea", "Your idea list is empty", "A channel, a skill, a side project: note it here.")}</div>
        <p class="help">Tap the label to move an idea from Someday to Next up to Started.</p>`;
    },

    routine() {
      const today = dayKey();
      const habits = all("habit").sort(byHabitTime);
      const groups = Object.keys(HABIT_TIME).map((t) => [t, habits.filter((h) => (h.time || "anytime") === t)]).filter(([, l]) => l.length);
      return `${groups.length ? groups.map(([t, l]) => `<section class="section">${sectionHead(HABIT_TIME[t])}<div class="card list">${l.map((h) => habitRow(h, today)).join("")}</div></section>`).join("") : `<div class="card">${empty("routine", "No habits yet", "Add things you do every day, like the gym or reading 20 pages.")}</div>`}
        <button class="btn ghost" data-action="new" data-type="habit">Add habit</button>`;
    },
  };
  VIEWS.grow = () => `<div class="seg" role="group" aria-label="Grow sections">${Object.entries(GROW).map(([k, l]) => `<button data-tab-go="${k}" aria-pressed="${growTab === k}">${l}</button>`).join("")}</div>${VIEWS[growTab]()}`;
  function byDue(a, b) { return (a.due || "9999") < (b.due || "9999") ? -1 : (a.due || "9999") > (b.due || "9999") ? 1 : (a.createdAt || 0) - (b.createdAt || 0); }
  function byHabitTime(a, b) { const o = Object.keys(HABIT_TIME); return o.indexOf(a.time || "anytime") - o.indexOf(b.time || "anytime") || a.createdAt - b.createdAt; }

  // ---------- editor sheet ----------
  const areaOpts = Object.fromEntries(Object.entries(AREAS).map(([k, a]) => [k, a.label]));
  const SCHEMAS = {
    task: { name: "Task", fields: [["title", "Task", "text", true], ["area", "Area", areaOpts], ["due", "Due", "date"], ["notes", "Notes", "textarea"]], defaults: () => ({ area: "productivity" }) },
    project: { name: "Video edit", fields: [["title", "Video title", "text", true], ["client", "Client", "text"], ["status", "Stage", EDIT_STATUS], ["due", "Due", "date"], ["notes", "Notes, brief, feedback", "textarea"]], defaults: () => ({ status: "raw" }) },
    meeting: { name: "Meeting", fields: [["title", "Meeting", "text", true], ["who", "With", "text"], ["date", "Date", "date"], ["time", "Time", "time"], ["place", "Link or place", "text"], ["agenda", "Agenda", "textarea"], ["notes", "Notes & outcome", "textarea"]], defaults: () => ({ date: dayKey() }) },
    learn: { name: "Learning", fields: [["title", "What are you learning?", "text", true], ["source", "Source", "text"], ["goal", "Weekly goal (min)", "number"], ["notes", "Notes", "textarea"]], defaults: () => ({ goal: 120 }) },
    idea: { name: "Idea", fields: [["title", "Your idea", "text", true], ["status", "Status", IDEA_STATUS], ["notes", "Why, first step, anything", "textarea"]], defaults: () => ({ status: "someday" }) },
    habit: { name: "Habit", fields: [["title", "Habit", "text", true], ["time", "Time of day", HABIT_TIME]], defaults: () => ({ time: "morning", days: {} }) },
    log: { name: "Journal", fields: [["text", "What happened?", "textarea", true], ["area", "Area", areaOpts], ["minutes", "Minutes spent", "number"], ["date", "Date", "date"]], defaults: () => ({ area: "personal", date: dayKey() }) },
  };
  const TYPE_META = {
    task: ["var(--blue)", "task", "Something to get done"],
    project: ["var(--orange)", "video", "Raw footage to export"],
    meeting: ["var(--teal)", "meeting", "A call, with notes"],
    learn: ["var(--purple)", "learn", "A skill, course or book"],
    idea: ["var(--yellow)", "idea", "Something to start"],
    habit: ["var(--green)", "routine", "Part of your day"],
    log: ["var(--pink)", "note", "Write down what happened or time spent"],
  };

  // Sheet with spring open/close and swipe-down to dismiss
  let closingT;
  function openSheet(html) {
    clearTimeout(closingT);
    const wrap = $("#sheet-wrap"), sheet = $("#sheet");
    sheet.innerHTML = html; sheet.style.transform = ""; sheet.scrollTop = 0;
    wrap.hidden = false;
    requestAnimationFrame(() => requestAnimationFrame(() => wrap.classList.add("open")));
    const f = $("#sheet .field.title input, #sheet .field.area textarea");
    if (f && !matchMedia("(pointer:coarse)").matches) setTimeout(() => f.focus(), 250);
  }
  function closeSheet() {
    const wrap = $("#sheet-wrap");
    if (wrap.hidden) return;
    wrap.classList.remove("open"); $("#sheet").style.transform = "";
    closingT = setTimeout(() => { wrap.hidden = true; $("#sheet").innerHTML = ""; }, 380);
  }
  (() => {
    let y0 = null, dy = 0;
    const sheet = $("#sheet");
    sheet.addEventListener("pointerdown", (e) => { if (!e.target.closest(".sheet-head") || e.target.closest("button")) return; y0 = e.clientY; dy = 0; sheet.classList.add("dragging"); sheet.setPointerCapture(e.pointerId); });
    sheet.addEventListener("pointermove", (e) => { if (y0 === null) return; dy = Math.max(0, e.clientY - y0); sheet.style.transform = `translateY(${dy}px)`; });
    const end = () => { if (y0 === null) return; y0 = null; sheet.classList.remove("dragging"); if (dy > 110) closeSheet(); else sheet.style.transform = ""; };
    sheet.addEventListener("pointerup", end); sheet.addEventListener("pointercancel", end);
  })();
  const sheetHead = (title, left, right) => `<div class="sheet-head">${left || "<span></span>"}<h3>${title}</h3>${right || "<span></span>"}</div>`;
  const cancelBtn = `<button class="link-btn left" data-action="close-sheet">Cancel</button>`;
  const doneBtn = `<button class="link-btn right" data-action="close-sheet">Done</button>`;

  function openQuickAdd() {
    openSheet(`${sheetHead("New", cancelBtn)}
      <div class="type-grid">${Object.entries(SCHEMAS).map(([k, s]) => `<button class="type-btn" data-action="new" data-type="${k}"><span class="tile-ico" style="--c:${TYPE_META[k][0]}">${ico(TYPE_META[k][1])}</span><span><b>${s.name}</b><span>${TYPE_META[k][2]}</span></span></button>`).join("")}</div>`);
  }

  function openEditor(type, id) {
    const s = SCHEMAS[type];
    const item = id ? store.items[id] : Object.assign({ type }, s.defaults());
    ui.editing = { type, id };
    const short = [], long = [];
    s.fields.forEach(([k, label, kind, req], i) => {
      const v = item[k] ?? "";
      const fid = `f-${k}`;
      if (kind === "textarea") { long.push(`<div class="form"><div class="field area"><label for="${fid}">${label}</label><textarea id="${fid}" name="${k}" ${req ? "required" : ""} placeholder="${req ? "Type here" : "Optional"}">${esc(v)}</textarea></div></div>`); return; }
      let input;
      if (typeof kind === "object") input = `<select id="${fid}" name="${k}">${Object.entries(kind).map(([ov, ol]) => `<option value="${ov}" ${v === ov ? "selected" : ""}>${esc(ol)}</option>`).join("")}</select>`;
      else input = `<input id="${fid}" name="${k}" type="${kind}" value="${esc(v)}" ${req ? 'required placeholder="' + label + '"' : 'placeholder="Optional"'} ${kind === "number" ? 'min="0" inputmode="numeric"' : ""} ${kind === "text" && !req ? 'autocomplete="off"' : ""}>`;
      short.push(`<div class="field ${i === 0 && req ? "title" : ""}"><label for="${fid}">${label}</label>${input}</div>`);
    });
    openSheet(`<form id="editor" novalidate style="display:contents">
      ${sheetHead(id ? s.name : "New " + s.name.toLowerCase(), cancelBtn, `<button type="submit" class="link-btn right">${id ? "Save" : "Add"}</button>`)}
      ${short.length ? `<div class="form">${short.join("")}</div>` : ""}
      ${long.join("")}
      ${id ? '<button type="button" class="btn danger" data-action="delete">Delete</button>' : ""}
      </form>`);
  }

  function submitEditor(form) {
    const { type, id } = ui.editing;
    const s = SCHEMAS[type];
    const item = id ? { ...store.items[id] } : Object.assign({ id: uid(), type }, s.defaults());
    for (const [k, label, kind, req] of s.fields) {
      let v = form.elements[k].value.trim();
      if (req && !v) { form.elements[k].focus(); toast(`Add a ${label.toLowerCase().replace("?", "")} first`, false); return; }
      if (kind === "number") v = v === "" ? "" : Math.max(0, +v);
      item[k] = v;
    }
    if (type === "log" && !item.date) item.date = dayKey();
    put(item);
    closeSheet();
    haptic();
    toast(id ? "Saved" : `${s.name} added`);
  }

  // ---------- focus timer ----------
  let timerInt = null;
  function tickTimer() {
    clearInterval(timerInt);
    const t = store.meta.timer;
    if (!t) return;
    const draw = () => {
      const el = $("#timer-time"); if (!el) return;
      const s = Math.floor((Date.now() - t.start) / 1000);
      const h = Math.floor(s / 3600), m = Math.floor((s % 3600) / 60), ss = s % 60;
      el.textContent = h ? `${h}:${pad(m)}:${pad(ss)}` : `${m}:${pad(ss)}`;
    };
    draw();
    timerInt = setInterval(draw, 1000);
  }
  function stopTimer() {
    const t = store.meta.timer; if (!t) return;
    const minutes = Math.max(1, Math.round((Date.now() - t.start) / 60000));
    let area = "productivity", refId = "";
    if (t.target.startsWith("ref:")) { refId = t.target.slice(4); const it = store.items[refId]; area = it && it.type === "learn" ? "learning" : "editing"; }
    else area = t.target.slice(5);
    store.meta.timer = null;
    put({ id: uid(), type: "log", text: "Focused on " + focusLabel(t.target), area, refId, minutes, date: dayKey(new Date(t.start)) });
    haptic(15);
    toast(`${fmtMin(minutes)} of focus logged`);
  }

  // ---------- events ----------
  function popCheck(id) { requestAnimationFrame(() => { const b = document.querySelector(`.check[data-id="${id}"]`); if (b) b.classList.add("pop"); }); }
  document.addEventListener("click", (e) => {
    const go = e.target.closest("[data-tab-go]");
    if (go) { setTab(go.dataset.tabGo); return; }
    const tb = e.target.closest("[data-tab]");
    if (tb) { setTab(tb.dataset.tab); return; }
    const el = e.target.closest("[data-action]");
    if (!el) return;
    const id = el.dataset.id, it = id && store.items[id];
    switch (el.dataset.action) {
      case "quick-add": haptic(); openQuickAdd(); break;
      case "new": openEditor(el.dataset.type); break;
      case "edit": if (it) openEditor(it.type, id); break;
      case "close-sheet": closeSheet(); break;
      case "delete":
        if (el.dataset.confirm) { remove(ui.editing.id); closeSheet(); toast("Deleted"); }
        else { el.dataset.confirm = "1"; el.textContent = "Tap again to delete"; haptic(20); }
        break;
      case "toggle-task": it.done = !it.done; it.doneAt = it.done ? dayKey() : ""; put(it); if (it.done) { haptic(); popCheck(id); } break;
      case "toggle-meeting": it.done = !it.done; put(it); if (it.done) { haptic(); popCheck(id); } break;
      case "toggle-habit": { const k = dayKey(); it.days = { ...(it.days || {}) }; if (it.days[k]) delete it.days[k]; else { it.days[k] = true; haptic(); } put(it); if (it.days[k]) popCheck(id); break; }
      case "next-status": { const o = Object.keys(EDIT_STATUS); it.status = o[(o.indexOf(it.status) + 1) % o.length]; put(it); haptic(); toast(`Moved to ${EDIT_STATUS[it.status]}`); break; }
      case "next-idea": { const o = Object.keys(IDEA_STATUS); it.status = o[(o.indexOf(it.status) + 1) % o.length]; put(it); haptic(); break; }
      case "log-learn": put({ id: uid(), type: "log", text: "Studied " + it.title, area: "learning", refId: id, minutes: 15, date: dayKey() }); haptic(); toast("15 minutes logged"); break;
      case "task-filter": taskFilter = el.dataset.f; render(); break;
      case "edit-filter": editFilter = el.dataset.f; render(); break;
      case "add-note": {
        const ta = $("#note-text"); const text = ta.value.trim();
        if (!text) { ta.focus(); return; }
        ta.value = "";
        put({ id: uid(), type: "log", text, area: "personal", date: dayKey() });
        haptic(); toast("Added to journal");
        break;
      }
      case "timer-start": store.meta.timer = { start: Date.now(), target: $("#timer-target").value }; save(); render(); haptic(); break;
      case "timer-stop": stopTimer(); break;
      case "timer-cancel": store.meta.timer = null; save(); render(); toast("Session discarded", false); break;
      case "settings": openSettings(); break;
      case "save-sync": saveSyncConfig(); break;
      case "sign-in": auth("in"); break;
      case "sign-up": auth("up"); break;
      case "sign-out": signOut(); break;
      case "sync-now": syncNow(true); break;
      case "export": exportData(); break;
      case "import": $("#import-file").click(); break;
      case "install": doInstall(); break;
      case "theme": setTheme(el.dataset.v); break;
    }
  });
  document.addEventListener("submit", (e) => { if (e.target.id === "editor") { e.preventDefault(); submitEditor(e.target); } });
  document.addEventListener("keydown", (e) => {
    if (e.key === "Escape" && !$("#sheet-wrap").hidden) closeSheet();
    if (e.key === "Enter" && !e.shiftKey && e.target.id === "note-text") { e.preventDefault(); $('[data-action="add-note"]').click(); }
  });
  document.addEventListener("input", (e) => { if (e.target.id === "note-text") { e.target.style.height = "auto"; e.target.style.height = Math.min(160, e.target.scrollHeight) + "px"; } });
  document.addEventListener("change", (e) => { if (e.target.id === "import-file" && e.target.files[0]) importData(e.target.files[0]); });
  window.addEventListener("scroll", () => $(".top").classList.toggle("scrolled", window.scrollY > 8), { passive: true });

  function setTab(t) {
    if (GROW_KEYS.includes(t)) { const same = tab === "grow" && growTab === t; growTab = t; t = "grow"; try { localStorage.setItem("daybook.grow", growTab); } catch {} if (!same) { tab = ""; } }
    if (t === tab) { window.scrollTo({ top: 0, behavior: "smooth" }); return; }
    tab = t; try { localStorage.setItem("daybook.tab", t); } catch {}
    window.scrollTo(0, 0); render(true);
  }

  let toastT;
  function toast(msg, ok = true) {
    const t = $("#toast");
    t.innerHTML = `${ok ? ico("check") : ""}<span>${esc(msg)}</span>`;
    t.hidden = false;
    requestAnimationFrame(() => t.classList.add("show"));
    clearTimeout(toastT);
    toastT = setTimeout(() => { t.classList.remove("show"); }, 2200);
  }

  // ---------- theme ----------
  function setTheme(v) { try { localStorage.setItem("daybook.theme", v); } catch {} applyTheme(); openSettings(); }
  function applyTheme() { let v = "system"; try { v = localStorage.getItem("daybook.theme") || "system"; } catch {} if (v === "system") document.documentElement.removeAttribute("data-theme"); else document.documentElement.setAttribute("data-theme", v); }
  applyTheme();

  // ---------- install ----------
  let installEvt = null;
  window.addEventListener("beforeinstallprompt", (e) => { e.preventDefault(); installEvt = e; });
  async function doInstall() { if (!installEvt) return; installEvt.prompt(); await installEvt.userChoice; installEvt = null; closeSheet(); }
  const isInstalled = () => matchMedia("(display-mode: standalone)").matches;

  // ---------- backup ----------
  function exportData() {
    const data = JSON.stringify({ app: "daybook", version: 1, exportedAt: new Date().toISOString(), items: all() }, null, 2);
    const a = document.createElement("a");
    a.href = URL.createObjectURL(new Blob([data], { type: "application/json" }));
    a.download = `daybook-backup-${dayKey()}.json`;
    document.body.appendChild(a); a.click(); a.remove();
    setTimeout(() => URL.revokeObjectURL(a.href), 4000);
  }
  async function importData(file) {
    try {
      const data = JSON.parse(await file.text());
      if (!Array.isArray(data.items)) throw new Error("not a Daybook backup");
      let n = 0;
      for (const it of data.items) {
        if (!it || !it.id || !it.type) continue;
        const local = store.items[it.id];
        if (!local || (it.updatedAt || 0) > (local.updatedAt || 0)) { store.items[it.id] = it; store.meta.dirty[it.id] = 1; n++; }
      }
      save(); render(); scheduleSync(); closeSheet();
      toast(`Imported ${n} item${n === 1 ? "" : "s"}`);
    } catch (e) { toast("That file isn't a Daybook backup", false); }
  }

  // ---------- sync (Supabase) ----------
  let sb = null, session = null, syncing = false, syncStarted = 0, syncRun = 0, syncState = "off", syncMsg = "", syncTimer = null;
  const cfg = () => ({
    url: (store.meta.sbUrl || (window.LT_CONFIG || {}).supabaseUrl || "").trim(),
    key: (store.meta.sbKey || (window.LT_CONFIG || {}).supabaseAnonKey || "").trim(),
  });
  function setSync(state, msg = "") {
    syncState = state; syncMsg = msg;
    const b = $("#sync-dot"); b.dataset.state = state;
    b.title = { off: "Sync off: saved on this device only", ok: "Synced", syncing: "Syncing…", error: "Sync problem: " + msg }[state];
    if (!$("#sheet-wrap").hidden && $("#sync-status")) $("#sync-status").textContent = syncLine();
  }
  function syncLine() {
    if (!sb) return "Sync is off. Everything is saved on this device.";
    if (!session) return "Sign in to keep your phone and computer in sync.";
    if (syncState === "error") return "Couldn't sync: " + syncMsg;
    if (syncState === "syncing") return "Syncing…";
    return "Up to date";
  }

  async function initSync() {
    const { url, key } = cfg();
    sb = null; session = null;
    if (!url || !key || !window.supabase) { setSync("off"); return; }
    try {
      sb = window.supabase.createClient(url, key, { auth: { persistSession: true, autoRefreshToken: true, storageKey: "daybook.auth" } });
      const { data } = await sb.auth.getSession();
      session = data.session;
      // Never call Supabase from inside this callback directly: it holds the auth lock and the call would hang.
      sb.auth.onAuthStateChange((_evt, s) => { session = s; setTimeout(() => { if (s) syncNow(); else setSync("off"); }, 0); });
      if (session) syncNow(); else setSync("off");
    } catch (e) { sb = null; setSync("error", e.message || "bad settings"); }
  }
  function scheduleSync() { clearTimeout(syncTimer); syncTimer = setTimeout(() => syncNow(), 1500); }

  async function syncNow(manual) {
    if (!sb || !session) { if (manual) toast("Sign in first", false); return; }
    if (syncing && Date.now() - syncStarted < 30000) return; // a sync stuck for 30 s no longer blocks new ones
    if (!navigator.onLine) { setSync("error", "you're offline. Changes are kept and sync when you're back online."); return; }
    const run = ++syncRun;
    syncing = true; syncStarted = Date.now(); setSync("syncing");
    const timeout = (p) => Promise.race([p, new Promise((_, rej) => setTimeout(() => rej(new Error("the server took too long to answer")), 20000))]);
    try {
      const ids = Object.keys(store.meta.dirty);
      const sent = {};
      const rows = ids.map((id) => store.items[id]).filter(Boolean).map((it) => { sent[it.id] = it.updatedAt; return { id: it.id, user_id: session.user.id, data: it, updated_at: it.updatedAt, deleted: !!it.deleted }; });
      for (let i = 0; i < rows.length; i += 400) {
        const { error } = await timeout(sb.from("items").upsert(rows.slice(i, i + 400)));
        if (error) throw error;
      }
      for (const id of Object.keys(sent)) if (store.items[id] && store.items[id].updatedAt <= sent[id]) delete store.meta.dirty[id];
      let since = store.meta.lastServer ? new Date(Date.parse(store.meta.lastServer) - 5000).toISOString() : null;
      let changed = false;
      for (let page = 0; page < 50; page++) {
        let q = sb.from("items").select("data,synced_at").order("synced_at", { ascending: true }).limit(1000);
        if (since) q = q.gt("synced_at", since);
        const { data, error } = await timeout(q);
        if (error) throw error;
        for (const row of data) {
          const r = row.data, local = store.items[r.id];
          if (!local || (r.updatedAt || 0) > (local.updatedAt || 0)) { store.items[r.id] = r; changed = true; }
          if (!store.meta.lastServer || row.synced_at > store.meta.lastServer) store.meta.lastServer = row.synced_at;
        }
        if (data.length < 1000) break;
        since = data[data.length - 1].synced_at;
      }
      save();
      if (changed && $("#sheet-wrap").hidden) render();
      setSync("ok");
      if (manual) toast("Up to date");
    } catch (e) {
      const msg = e.message || String(e);
      setSync("error", /relation .*items.* does not exist|Could not find the table/i.test(msg) ? "the items table is missing. Run supabase-setup.sql in Supabase." : msg);
      if (manual) toast("Couldn't sync", false);
    } finally { if (run === syncRun) syncing = false; }
  }

  async function auth(mode) {
    const email = $("#auth-email").value.trim(), password = $("#auth-pass").value;
    if (!email || password.length < 6) { toast("Enter your email and a 6+ character password", false); return; }
    if (!sb) { toast("Save your Supabase settings first", false); return; }
    const btn = document.querySelector(`[data-action="sign-${mode}"]`); if (btn) { btn.disabled = true; btn.textContent = mode === "up" ? "Creating…" : "Signing in…"; }
    const fn = mode === "up" ? sb.auth.signUp({ email, password }) : sb.auth.signInWithPassword({ email, password });
    const { data, error } = await fn;
    if (error) { toast(error.message, false); openSettings(); return; }
    if (mode === "up" && !data.session) { toast("Check your email to confirm, then sign in"); openSettings(); return; }
    session = data.session; closeSheet(); toast("Signed in. Syncing…"); setTimeout(() => syncNow(), 0);
  }
  async function signOut() { if (sb) await sb.auth.signOut(); session = null; setSync("off"); openSettings(); toast("Signed out. Your data stays on this device."); }
  function saveSyncConfig() {
    store.meta.sbUrl = $("#sb-url").value.trim();
    store.meta.sbKey = $("#sb-key").value.trim();
    store.meta.lastServer = null;
    save();
    initSync().then(openSettings);
  }

  function openSettings() {
    const { url, key } = cfg();
    let theme = "system"; try { theme = localStorage.getItem("daybook.theme") || "system"; } catch {}
    const signedIn = sb && session;
    openSheet(`${sheetHead("Settings", "", doneBtn)}
      ${installEvt && !isInstalled() ? `<button class="btn" data-action="install">Install Daybook on this phone</button>` : ""}
      <div class="group-label">Sync</div>
      ${signedIn ? `<div class="form">
          <div class="settings-row"><span class="tile-ico" style="--c:var(--green)">${ico("check")}</span><div style="flex:1;min-width:0"><div style="font-weight:500;overflow-wrap:anywhere">${esc(session.user.email)}</div><div class="help" style="padding:0" id="sync-status">${esc(syncLine())}</div></div></div>
        </div>
        <div class="sheet-actions"><button class="btn ghost" data-action="sync-now">Sync now</button><button class="btn danger" data-action="sign-out">Sign out</button></div>`
      : sb ? `<div class="form">
          <div class="field"><label for="auth-email">Email</label><input id="auth-email" type="email" autocomplete="email" placeholder="you@example.com"></div>
          <div class="field"><label for="auth-pass">Password</label><input id="auth-pass" type="password" autocomplete="current-password" minlength="6" placeholder="6+ characters"></div>
        </div>
        <div class="sheet-actions"><button class="btn" data-action="sign-in">Sign in</button><button class="btn ghost" data-action="sign-up">Create account</button></div>
        <p class="help" id="sync-status">${esc(syncLine())} Use the same email and password on every device.</p>`
      : `<p class="help" id="sync-status">${esc(syncLine())}</p>`}
      <div class="group-label">Appearance</div>
      <div class="seg" role="group" aria-label="Appearance">${[["system", "Automatic"], ["light", "Light"], ["dark", "Dark"]].map(([v, l]) => `<button data-action="theme" data-v="${v}" aria-pressed="${theme === v}">${l}</button>`).join("")}</div>
      <div class="group-label">Backup</div>
      <div class="sheet-actions"><button class="btn ghost" data-action="export">Export</button><button class="btn ghost" data-action="import">Import</button></div>
      <input type="file" id="import-file" accept="application/json,.json" hidden>
      <p class="help">${all().length} items on this device.</p>
      <details ${sb ? "" : "open"}><summary class="help">Advanced: Supabase connection</summary>
        <div class="form" style="margin-top:10px">
          <div class="field"><label for="sb-url">Project URL</label><input id="sb-url" type="url" placeholder="https://xxxx.supabase.co" value="${esc(url)}"></div>
          <div class="field"><label for="sb-key">Anon key</label><input id="sb-key" type="text" autocomplete="off" spellcheck="false" value="${esc(key)}"></div>
        </div>
        <button class="btn ghost" style="width:100%;margin-top:10px" data-action="save-sync">Save connection</button>
      </details>`);
  }

  window.addEventListener("online", () => syncNow());
  document.addEventListener("visibilitychange", () => { if (document.visibilityState === "visible") { render(); syncNow(); } });
  setInterval(() => { if (document.visibilityState === "visible") syncNow(); }, 60000);

  // ---------- offline ----------
  if ("serviceWorker" in navigator && location.protocol !== "file:") {
    navigator.serviceWorker.register("sw.js").catch(() => {});
  }

  render(true);
  initSync();
})();
