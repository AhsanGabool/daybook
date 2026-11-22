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
    return parseDay(k).toLocaleDateString(undefined, { day: "numeric", month: "short" });
  };
  const dueClass = (k, done) => { if (!k || done) return ""; const t = dayKey(); return k < t ? "overdue" : k === t ? "duetoday" : ""; };

  const AREAS = {
    editing: { label: "Video editing", c: "var(--a-editing)" },
    productivity: { label: "Productivity", c: "var(--a-productivity)" },
    learning: { label: "Learning", c: "var(--a-learning)" },
    personal: { label: "Personal", c: "var(--a-personal)" },
    health: { label: "Health", c: "var(--a-health)" },
  };
  const EDIT_STATUS = { raw: "Raw in", cutting: "Cutting", graphics: "Graphics", review: "Review", exported: "Exported" };
  const IDEA_STATUS = { someday: "Someday", next: "Next up", started: "Started" };
  const HABIT_TIME = { morning: "Morning", afternoon: "Afternoon", evening: "Evening", anytime: "Any time" };

  // ---------- storage ----------
  const LS = "daybook.v1";
  const blank = () => ({ items: {}, meta: { dirty: {}, lastServer: null, timer: null, sbUrl: "", sbKey: "" } });
  let store;
  try { store = JSON.parse(localStorage.getItem(LS)) || blank(); } catch { store = blank(); }
  store.meta = Object.assign(blank().meta, store.meta || {});
  const save = () => { try { localStorage.setItem(LS, JSON.stringify(store)); } catch (e) { toast("Couldn't save on this device: storage is full or blocked."); } };

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
  try { tab = localStorage.getItem("daybook.tab") || "today"; } catch {}

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

  // ---------- render ----------
  const TITLES = { today: "Today", tasks: "Tasks", edits: "Edits", meetings: "Meetings", learn: "Learning", ideas: "New things", routine: "Routine" };
  function render() {
    $("#today-label").textContent = new Date().toLocaleDateString(undefined, { weekday: "long", day: "numeric", month: "long" });
    $("#view-title").textContent = TITLES[tab];
    document.querySelectorAll(".tabs button").forEach((b) => { if (b.dataset.tab === tab) b.setAttribute("aria-current", "page"); else b.removeAttribute("aria-current"); });
    const focused = document.activeElement && document.activeElement.id;
    const draft = $("#note-text") ? $("#note-text").value : "";
    $("#view").innerHTML = VIEWS[tab]();
    if ($("#note-text")) $("#note-text").value = draft;
    if (focused && document.getElementById(focused)) document.getElementById(focused).focus();
    tickTimer();
  }

  const empty = (html) => `<div class="empty">${html}</div>`;
  const areaDot = (a) => `<span class="dot" style="--c:${(AREAS[a] || {}).c || "var(--muted)"}"></span>`;
  const checkBtn = (on, action, id, label) => `<button class="check ${on ? "on" : ""}" data-action="${action}" data-id="${id}" aria-label="${esc(label)}" aria-pressed="${on}"><svg viewBox="0 0 24 24"><path d="M5 12l5 5 9-10"/></svg></button>`;

  function taskRow(t) {
    const due = t.due ? `<span class="${dueClass(t.due, t.done)}">${fmtDue(t.due)}</span>` : "";
    return `<div class="row ${t.done ? "done" : ""}">
      ${checkBtn(t.done, "toggle-task", t.id, t.done ? "Mark not done" : "Mark done")}
      <button class="row-main" data-action="edit" data-id="${t.id}">
        <span class="row-title">${esc(t.title)}</span>
        <span class="row-meta">${areaDot(t.area)}<span>${esc((AREAS[t.area] || {}).label || "General")}</span>${due}</span>
      </button></div>`;
  }
  function projectRow(p) {
    const due = p.due ? `<span class="${dueClass(p.due, p.status === "exported")}">Due ${fmtDue(p.due)}</span>` : "";
    const mins = minutesFor(p.id);
    return `<div class="row">
      <button class="row-main" data-action="edit" data-id="${p.id}">
        <span class="row-title">${esc(p.title)}</span>
        <span class="row-meta">${p.client ? `<span>${esc(p.client)}</span>` : ""}${due}${mins ? `<span>${fmtMin(mins)} logged</span>` : ""}</span>
      </button>
      <button class="chip s-${p.status}" data-action="next-status" data-id="${p.id}" aria-label="Status ${esc(EDIT_STATUS[p.status])}, tap to move on">${esc(EDIT_STATUS[p.status] || "Raw in")}</button>
    </div>`;
  }
  function habitRow(h, today) {
    const on = !!(h.days || {})[today];
    const s = streak(h);
    const dots = [6, 5, 4, 3, 2, 1, 0].map((n) => `<i class="${(h.days || {})[dayKey(addDays(new Date(), -n))] ? "on" : ""}"></i>`).join("");
    return `<div class="row ${on ? "done" : ""}">
      ${checkBtn(on, "toggle-habit", h.id, on ? "Undo for today" : "Done today")}
      <button class="row-main" data-action="edit" data-id="${h.id}">
        <span class="row-title">${esc(h.title)}</span>
        <span class="row-meta"><span>${esc(HABIT_TIME[h.time] || "Any time")}</span><span class="streak">${s ? `${s}-day streak` : "No streak yet"}</span></span>
      </button>
      <span class="habit-days" aria-hidden="true">${dots}</span>
    </div>`;
  }
  function learnRow(l) {
    const total = minutesFor(l.id);
    const week = logs().filter((x) => x.refId === l.id && x.date >= weekStart()).reduce((s, x) => s + (+x.minutes || 0), 0);
    const goal = +l.goal || 0;
    const pct = goal ? Math.min(100, Math.round((week / goal) * 100)) : 0;
    return `<div class="row" style="flex-wrap:wrap">
      <button class="row-main" data-action="edit" data-id="${l.id}">
        <span class="row-title">${esc(l.title)}</span>
        <span class="row-meta">${l.source ? `<span>${esc(l.source)}</span>` : ""}<span>${fmtMin(week)} this week${goal ? ` of ${fmtMin(goal)}` : ""}</span><span>${fmtMin(total)} total</span></span>
      </button>
      <button class="pill-btn" data-action="log-learn" data-id="${l.id}">+15 min</button>
      ${goal ? `<div class="meter" style="flex-basis:100%"><i style="width:${pct}%"></i></div>` : ""}
    </div>`;
  }
  function fmtTime(t) {
    if (!t) return "";
    const [h, m] = t.split(":").map(Number);
    return new Date(2000, 0, 1, h, m).toLocaleTimeString(undefined, { hour: "numeric", minute: "2-digit" });
  }
  function meetingRow(m) {
    const today = dayKey();
    const day = m.date === today ? "Today" : fmtDue(m.date);
    return `<div class="row ${m.done ? "done" : ""}">
      <div class="mtime">${m.time ? esc(fmtTime(m.time)) : "—"}<small>${esc(day)}</small></div>
      <button class="row-main" data-action="edit" data-id="${m.id}">
        <span class="row-title">${esc(m.title)}</span>
        <span class="row-meta">${m.who ? `<span>With ${esc(m.who)}</span>` : ""}${m.place ? `<span>${esc(m.place.length > 40 ? m.place.slice(0, 40) + "…" : m.place)}</span>` : ""}${m.notes ? "<span>Has notes</span>" : ""}</span>
      </button>
      ${checkBtn(m.done, "toggle-meeting", m.id, m.done ? "Mark not done" : "Mark as held")}
    </div>`;
  }
  const byWhen = (a, b) => ((a.date || "") + (a.time || "99")).localeCompare((b.date || "") + (b.time || "99"));

  function ideaRow(i) {
    return `<div class="row">
      <button class="row-main" data-action="edit" data-id="${i.id}">
        <span class="row-title">${esc(i.title)}</span>
        ${i.notes ? `<span class="row-meta"><span>${esc(i.notes.slice(0, 90))}${i.notes.length > 90 ? "…" : ""}</span></span>` : ""}
      </button>
      <button class="chip i-${i.status}" data-action="next-idea" data-id="${i.id}" aria-label="Status ${esc(IDEA_STATUS[i.status])}, tap to change">${esc(IDEA_STATUS[i.status] || "Someday")}</button>
    </div>`;
  }
  function logRow(l) {
    const when = new Date(l.createdAt || Date.now()).toLocaleTimeString(undefined, { hour: "numeric", minute: "2-digit" });
    const ref = l.refId && store.items[l.refId] && !store.items[l.refId].deleted ? store.items[l.refId].title : "";
    return `<div class="row">
      <button class="row-main" data-action="edit" data-id="${l.id}">
        <span class="row-title log-text">${esc(l.text || "Focus session")}</span>
        <span class="row-meta">${areaDot(l.area)}<span>${l.date === dayKey() ? when : fmtDue(l.date)}</span>${l.minutes ? `<span>${fmtMin(l.minutes)}</span>` : ""}${ref ? `<span>${esc(ref)}</span>` : ""}</span>
      </button></div>`;
  }

  function focusCard() {
    const t = store.meta.timer;
    const opts = focusOptions().map((o) => `<option value="${esc(o.v)}" ${t && t.target === o.v ? "selected" : ""}>${esc(o.l)}</option>`).join("");
    if (t) {
      return `<div class="card focus running">
        <div class="focus-row"><div style="flex:1;min-width:0"><div class="focus-time" id="timer-time">0:00</div><div class="sub">${esc(focusLabel(t.target))}</div></div>
        <button class="btn" data-action="timer-stop">Stop &amp; log</button></div>
        <button class="link-btn" data-action="timer-cancel" style="align-self:flex-start">Discard session</button></div>`;
    }
    return `<div class="card focus">
      <div class="field"><label for="timer-target">Focus on</label><select id="timer-target">${opts}</select></div>
      <button class="btn" data-action="timer-start">Start focus timer</button></div>`;
  }
  function focusOptions() {
    const o = [];
    all("project").filter((p) => p.status !== "exported").forEach((p) => o.push({ v: "ref:" + p.id, l: "Edit: " + p.title }));
    all("learn").forEach((l) => o.push({ v: "ref:" + l.id, l: "Learn: " + l.title }));
    Object.entries(AREAS).forEach(([k, a]) => o.push({ v: "area:" + k, l: a.label }));
    return o;
  }
  function focusLabel(target) {
    if (!target) return "";
    if (target.startsWith("ref:")) { const it = store.items[target.slice(4)]; return it ? it.title : "Focus session"; }
    return (AREAS[target.slice(5)] || {}).label || "Focus session";
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
      const learnWeek = logs().filter((l) => l.area === "learning" && l.date >= weekStart()).reduce((s, l) => s + (+l.minutes || 0), 0);
      const days = [6, 5, 4, 3, 2, 1, 0].map((n) => { const d = addDays(new Date(), -n); return { k: dayKey(d), lbl: d.toLocaleDateString(undefined, { weekday: "narrow" }), m: minutesOn(dayKey(d)) }; });
      const max = Math.max(60, ...days.map((d) => d.m));
      const weekTotal = days.reduce((s, d) => s + d.m, 0);
      const todayLogs = logs().filter((l) => l.date === today).sort((a, b) => b.createdAt - a.createdAt);
      const meetingsToday = all("meeting").filter((m) => m.date === today).sort(byWhen);
      return `
      <section class="stats">
        <div class="card stat"><div class="num">${fmtMin(focusToday)}</div><div class="lbl">Focused today</div></div>
        <div class="card stat"><div class="num">${habitsDone}/${habits.length}</div><div class="lbl">Routine done</div></div>
        <div class="card stat"><div class="num">${doneToday}</div><div class="lbl">Tasks finished today</div></div>
        <div class="card stat"><div class="num">${fmtMin(learnWeek)}</div><div class="lbl">Learning this week</div></div>
      </section>
      <section class="section"><div class="section-head"><h2>Meetings today</h2><button class="link-btn" data-tab-go="meetings">All meetings</button></div>
        <div class="card list">${meetingsToday.length ? meetingsToday.map(meetingRow).join("") : empty("No meetings today.")}</div></section>
      <section class="section"><h2>Focus</h2>${focusCard()}</section>
      <section class="section"><h2>Last 7 days</h2>
        <div class="card week"><div class="bars">${days.map((d) => `<div class="bar ${d.k === today ? "today" : ""} ${d.m ? "has" : ""}" title="${fmtMin(d.m)}"><i style="height:${Math.max(4, (d.m / max) * 64)}px"></i><span>${d.lbl}</span></div>`).join("")}</div>
        <div class="week-foot"><span>Focused time per day</span><span>${fmtMin(weekTotal)} total</span></div></div></section>
      <section class="section"><div class="section-head"><h2>To do today</h2><button class="link-btn" data-action="new" data-type="task">Add task</button></div>
        <div class="card list">${tasks.length ? tasks.slice(0, 8).map(taskRow).join("") : empty(all("task").length ? "<b>All clear.</b> Nothing due today." : "<b>No tasks yet.</b> Tap + to add your first one.")}</div></section>
      <section class="section"><div class="section-head"><h2>Routine</h2><button class="link-btn" data-tab-go="routine">Manage</button></div>
        <div class="card list">${habits.length ? habits.map((h) => habitRow(h, today)).join("") : empty("<b>No routine yet.</b> Add habits like “Morning walk” or “Practise color grading” in Routine.")}</div></section>
      <section class="section"><div class="section-head"><h2>Edits in progress</h2><button class="link-btn" data-tab-go="edits">All edits</button></div>
        <div class="card list">${projects.length ? projects.slice(0, 4).map(projectRow).join("") : empty("<b>No edits in progress.</b> Add a video you're working on in Edits.")}</div></section>
      <section class="section"><h2>Journal</h2>
        <div class="card">
          <div class="note-input"><textarea id="note-text" rows="2" placeholder="What happened, what you learned, anything…"></textarea><button class="btn" data-action="add-note">Add</button></div>
          ${todayLogs.length ? `<div class="list" style="border-top:1px solid var(--line)">${todayLogs.map(logRow).join("")}</div>` : ""}
        </div></section>`;
    },

    tasks() {
      const today = dayKey();
      const filters = { open: "Open", today: "Due today", ...Object.fromEntries(Object.entries(AREAS).map(([k, a]) => [k, a.label])), done: "Done" };
      let list = all("task");
      if (taskFilter === "done") list = list.filter((t) => t.done).sort((a, b) => b.updatedAt - a.updatedAt);
      else {
        list = list.filter((t) => !t.done);
        if (taskFilter === "today") list = list.filter((t) => t.due && t.due <= today);
        else if (AREAS[taskFilter]) list = list.filter((t) => t.area === taskFilter);
        list.sort(byDue);
      }
      return `<div class="filters" role="group" aria-label="Filter tasks">${Object.entries(filters).map(([k, l]) => `<button class="filter" data-action="task-filter" data-f="${k}" aria-pressed="${taskFilter === k}">${esc(l)}</button>`).join("")}</div>
        <div class="card list">${list.length ? list.map(taskRow).join("") : empty(taskFilter === "done" ? "Nothing finished yet." : "<b>Nothing here.</b> Tap + to add a task.")}</div>`;
    },

    edits() {
      let list = all("project");
      const order = Object.keys(EDIT_STATUS);
      if (editFilter === "active") list = list.filter((p) => p.status !== "exported");
      else if (editFilter === "exported") list = list.filter((p) => p.status === "exported");
      list.sort((a, b) => order.indexOf(a.status) - order.indexOf(b.status) || byDue(a, b));
      const counts = order.map((s) => `<div class="card stat"><div class="num">${all("project").filter((p) => p.status === s).length}</div><div class="lbl">${EDIT_STATUS[s]}</div></div>`).join("");
      const editMin = logs().filter((l) => l.area === "editing" && l.date >= weekStart()).reduce((s, l) => s + (+l.minutes || 0), 0);
      return `<section class="stats stages">${counts}</section>
        <p class="help">${fmtMin(editMin)} of editing logged this week. Tap a status to move a video to its next stage.</p>
        <div class="filters" role="group" aria-label="Filter edits">${[["active", "In progress"], ["exported", "Exported"], ["all", "All"]].map(([k, l]) => `<button class="filter" data-action="edit-filter" data-f="${k}" aria-pressed="${editFilter === k}">${l}</button>`).join("")}</div>
        <div class="card list">${list.length ? list.map(projectRow).join("") : empty("<b>No videos here.</b> Tap + and choose “Video edit” to track one from raw footage to export.")}</div>`;
    },

    meetings() {
      const today = dayKey();
      const ms = all("meeting");
      const upcoming = ms.filter((m) => !m.done && (m.date || today) >= today).sort(byWhen);
      const past = ms.filter((m) => m.done || (m.date || today) < today).sort((a, b) => byWhen(b, a)).slice(0, 30);
      return `<section class="section"><div class="section-head"><h2>Upcoming</h2><button class="link-btn" data-action="new" data-type="meeting">Add meeting</button></div>
        <div class="card list">${upcoming.length ? upcoming.map(meetingRow).join("") : empty("<b>No meetings coming up.</b> Add client calls, team syncs or review sessions with the agenda and link.")}</div></section>
        <section class="section"><h2>Past</h2>
        <div class="card list">${past.length ? past.map(meetingRow).join("") : empty("Meetings you've held show up here, with your notes.")}</div></section>`;
    },

    learn() {
      const list = all("learn").sort((a, b) => a.createdAt - b.createdAt);
      const learnLogs = logs().filter((l) => l.area === "learning").sort((a, b) => b.createdAt - a.createdAt).slice(0, 10);
      return `<section class="section"><div class="section-head"><h2>What you're learning</h2><button class="link-btn" data-action="new" data-type="learn">Add topic</button></div>
        <div class="card list">${list.length ? list.map(learnRow).join("") : empty("<b>No topics yet.</b> Add a skill, course or book, set a weekly goal and log time with +15 min.")}</div></section>
        <section class="section"><h2>Recent learning sessions</h2><div class="card list">${learnLogs.length ? learnLogs.map(logRow).join("") : empty("Sessions you log show up here.")}</div></section>`;
    },

    ideas() {
      const order = Object.keys(IDEA_STATUS);
      const list = all("idea").sort((a, b) => order.indexOf(b.status) - order.indexOf(a.status) || b.createdAt - a.createdAt);
      return `<p class="help">Things you want to start: a channel, a skill, a side project. Tap the status to move an idea from Someday to Next up to Started.</p>
        <div class="card list">${list.length ? list.map(ideaRow).join("") : empty("<b>No ideas yet.</b> Tap + and choose “New thing to start”.")}</div>`;
    },

    routine() {
      const today = dayKey();
      const habits = all("habit").sort(byHabitTime);
      const groups = Object.keys(HABIT_TIME).map((t) => [t, habits.filter((h) => (h.time || "anytime") === t)]).filter(([, l]) => l.length);
      return `<p class="help">Your daily routine. Tick each habit off when it's done; the squares show the last 7 days.</p>
        ${groups.length ? groups.map(([t, l]) => `<section class="section"><h2>${HABIT_TIME[t]}</h2><div class="card list">${l.map((h) => habitRow(h, today)).join("")}</div></section>`).join("") : `<div class="card">${empty("<b>No habits yet.</b> Add things you do every day, like “Gym”, “Read 20 pages” or “Post a reel”.")}</div>`}
        <button class="btn ghost" data-action="new" data-type="habit">Add habit</button>`;
    },
  };
  function byDue(a, b) { return (a.due || "9999") < (b.due || "9999") ? -1 : (a.due || "9999") > (b.due || "9999") ? 1 : (a.createdAt || 0) - (b.createdAt || 0); }
  function byHabitTime(a, b) { const o = Object.keys(HABIT_TIME); return o.indexOf(a.time || "anytime") - o.indexOf(b.time || "anytime") || a.createdAt - b.createdAt; }

  // ---------- editor sheet ----------
  const areaOpts = Object.fromEntries(Object.entries(AREAS).map(([k, a]) => [k, a.label]));
  const SCHEMAS = {
    task: { name: "Task", fields: [["title", "Task", "text", true], ["area", "Area", areaOpts], ["due", "Due date", "date"], ["notes", "Notes", "textarea"]], defaults: () => ({ area: "productivity" }) },
    project: { name: "Video edit", fields: [["title", "Video title", "text", true], ["client", "Client or channel", "text"], ["status", "Stage", EDIT_STATUS], ["due", "Due date", "date"], ["notes", "Notes (brief, links, feedback)", "textarea"]], defaults: () => ({ status: "raw" }) },
    meeting: { name: "Meeting", fields: [["title", "Meeting", "text", true], ["who", "With", "text"], ["date", "Date", "date"], ["time", "Time", "time"], ["place", "Link or place", "text"], ["agenda", "Agenda", "textarea"], ["notes", "Notes & outcome", "textarea"]], defaults: () => ({ date: dayKey() }) },
    learn: { name: "Learning topic", fields: [["title", "What are you learning?", "text", true], ["source", "Course, book or link", "text"], ["goal", "Weekly goal (minutes)", "number"], ["notes", "Notes", "textarea"]], defaults: () => ({ goal: 120 }) },
    idea: { name: "New thing to start", fields: [["title", "Idea", "text", true], ["status", "Status", IDEA_STATUS], ["notes", "Why, first step, anything", "textarea"]], defaults: () => ({ status: "someday" }) },
    habit: { name: "Habit", fields: [["title", "Habit", "text", true], ["time", "Time of day", HABIT_TIME]], defaults: () => ({ time: "morning", days: {} }) },
    log: { name: "Journal entry", fields: [["text", "Entry", "textarea", true], ["area", "Area", areaOpts], ["minutes", "Minutes spent (optional)", "number"], ["date", "Date", "date"]], defaults: () => ({ area: "personal", date: dayKey() }) },
  };
  const TYPE_ICONS = {
    task: ["var(--a-productivity)", '<path d="M9 11l3 3 8-8"/><path d="M20 12v7a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h9"/>', "Something to get done"],
    project: ["var(--a-editing)", '<rect x="2" y="5" width="15" height="14" rx="2"/><path d="M17 10l5-3v10l-5-3"/>', "Track a video from raw to export"],
    meeting: ["var(--a-productivity)", '<rect x="3" y="4" width="18" height="17" rx="2"/><path d="M3 9h18M8 2v4M16 2v4"/><circle cx="12" cy="15" r="2"/>', "A call or meeting with notes"],
    learn: ["var(--a-learning)", '<path d="M2 7l10-4 10 4-10 4-10-4Z"/><path d="M6 9v5c0 1.7 2.7 3 6 3s6-1.3 6-3V9"/>', "A skill, course or book"],
    idea: ["var(--a-personal)", '<path d="M9 18h6M10 21h4"/><path d="M12 3a6 6 0 0 0-3.5 10.9c.6.4 1 1.1 1 1.8V16h5v-.3c0-.7.4-1.4 1-1.8A6 6 0 0 0 12 3Z"/>', "Something you want to begin"],
    habit: ["var(--a-health)", '<path d="M21 12a9 9 0 1 1-3-6.7"/><path d="M21 4v5h-5"/>', "Part of your daily routine"],
    log: ["var(--muted)", '<path d="M4 4h12l4 4v12H4z"/><path d="M8 12h8M8 16h5"/>', "Note what happened or time spent"],
  };

  function openSheet(html) { $("#sheet").innerHTML = `<div class="grabber"></div>${html}`; $("#sheet-wrap").hidden = false; const f = $("#sheet input, #sheet textarea"); if (f && !matchMedia("(pointer:coarse)").matches) f.focus(); }
  function closeSheet() { $("#sheet-wrap").hidden = true; $("#sheet").innerHTML = ""; }

  function openQuickAdd() {
    openSheet(`<h3>Add</h3><div class="type-grid">${Object.entries(SCHEMAS).map(([k, s]) => `<button class="type-btn" data-action="new" data-type="${k}" style="--c:${TYPE_ICONS[k][0]}"><svg viewBox="0 0 24 24">${TYPE_ICONS[k][1]}</svg><b>${s.name}</b><span>${TYPE_ICONS[k][2]}</span></button>`).join("")}</div>`);
  }

  function openEditor(type, id) {
    const s = SCHEMAS[type];
    const item = id ? store.items[id] : Object.assign({ type }, s.defaults());
    ui.editing = { type, id };
    const fields = s.fields.map(([k, label, kind, req]) => {
      const v = item[k] ?? "";
      const fid = `f-${k}`;
      let input;
      if (typeof kind === "object") input = `<select id="${fid}" name="${k}">${Object.entries(kind).map(([ov, ol]) => `<option value="${ov}" ${v === ov ? "selected" : ""}>${esc(ol)}</option>`).join("")}</select>`;
      else if (kind === "textarea") input = `<textarea id="${fid}" name="${k}" ${req ? "required" : ""}>${esc(v)}</textarea>`;
      else input = `<input id="${fid}" name="${k}" type="${kind}" value="${esc(v)}" ${req ? "required" : ""} ${kind === "number" ? 'min="0" inputmode="numeric"' : ""}>`;
      return `<div class="field"><label for="${fid}">${label}</label>${input}</div>`;
    }).join("");
    openSheet(`<h3>${id ? "Edit" : "New"} ${s.name.toLowerCase()}</h3>
      <form id="editor" class="section" novalidate>${fields}
        <div class="sheet-actions"><button type="submit" class="btn">${id ? "Save" : "Add"}</button>${id ? '<button type="button" class="btn danger" data-action="delete">Delete</button>' : ""}</div>
      </form>`);
  }

  function submitEditor(form) {
    const { type, id } = ui.editing;
    const s = SCHEMAS[type];
    const item = id ? { ...store.items[id] } : Object.assign({ id: uid(), type }, s.defaults());
    for (const [k, , kind, req] of s.fields) {
      let v = form.elements[k].value.trim();
      if (req && !v) { form.elements[k].focus(); toast("Fill in “" + s.fields.find((f) => f[0] === k)[1] + "” first."); return; }
      if (kind === "number") v = v === "" ? "" : Math.max(0, +v);
      item[k] = v;
    }
    if (type === "log" && !item.date) item.date = dayKey();
    put(item);
    closeSheet();
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
    put({ id: uid(), type: "log", text: "Focus: " + focusLabel(t.target), area, refId, minutes, date: dayKey(new Date(t.start)) });
    toast(`${fmtMin(minutes)} logged`);
  }

  // ---------- events ----------
  document.addEventListener("click", (e) => {
    const go = e.target.closest("[data-tab-go]");
    if (go) { setTab(go.dataset.tabGo); return; }
    const tb = e.target.closest("[data-tab]");
    if (tb) { setTab(tb.dataset.tab); return; }
    const el = e.target.closest("[data-action]");
    if (!el) return;
    const id = el.dataset.id, it = id && store.items[id];
    switch (el.dataset.action) {
      case "quick-add": openQuickAdd(); break;
      case "new": openEditor(el.dataset.type); break;
      case "edit": if (it) openEditor(it.type, id); break;
      case "close-sheet": closeSheet(); break;
      case "delete":
        if (el.dataset.confirm) { remove(ui.editing.id); closeSheet(); toast("Deleted"); }
        else { el.dataset.confirm = "1"; el.textContent = "Tap again to delete"; }
        break;
      case "toggle-task": it.done = !it.done; it.doneAt = it.done ? dayKey() : ""; put(it); break;
      case "toggle-meeting": it.done = !it.done; put(it); break;
      case "toggle-habit": { const k = dayKey(); it.days = { ...(it.days || {}) }; if (it.days[k]) delete it.days[k]; else it.days[k] = true; put(it); break; }
      case "next-status": { const o = Object.keys(EDIT_STATUS); it.status = o[(o.indexOf(it.status) + 1) % o.length]; put(it); toast(`${it.title}: ${EDIT_STATUS[it.status]}`); break; }
      case "next-idea": { const o = Object.keys(IDEA_STATUS); it.status = o[(o.indexOf(it.status) + 1) % o.length]; put(it); break; }
      case "log-learn": put({ id: uid(), type: "log", text: "Studied " + it.title, area: "learning", refId: id, minutes: 15, date: dayKey() }); toast("15 min logged"); break;
      case "task-filter": taskFilter = el.dataset.f; render(); break;
      case "edit-filter": editFilter = el.dataset.f; render(); break;
      case "add-note": {
        const ta = $("#note-text"); const text = ta.value.trim();
        if (!text) { ta.focus(); return; }
        ta.value = "";
        put({ id: uid(), type: "log", text, area: "personal", date: dayKey() });
        break;
      }
      case "timer-start": store.meta.timer = { start: Date.now(), target: $("#timer-target").value }; save(); render(); break;
      case "timer-stop": stopTimer(); break;
      case "timer-cancel": store.meta.timer = null; save(); render(); toast("Session discarded"); break;
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
    if (e.key === "Enter" && (e.ctrlKey || e.metaKey) && e.target.id === "note-text") $('[data-action="add-note"]').click();
  });
  document.addEventListener("change", (e) => { if (e.target.id === "import-file" && e.target.files[0]) importData(e.target.files[0]); });

  function setTab(t) { tab = t; try { localStorage.setItem("daybook.tab", t); } catch {} render(); window.scrollTo(0, 0); }

  let toastT;
  function toast(msg) { const t = $("#toast"); t.textContent = msg; t.hidden = false; clearTimeout(toastT); toastT = setTimeout(() => (t.hidden = true), 2200); }

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
    } catch (e) { toast("That file isn't a Daybook backup."); }
  }

  // ---------- sync (Supabase) ----------
  let sb = null, session = null, syncing = false, syncStarted = 0, syncRun = 0, syncState = "off", syncMsg = "", syncTimer = null;
  const cfg = () => ({
    url: (store.meta.sbUrl || (window.LT_CONFIG || {}).supabaseUrl || "").trim(),
    key: (store.meta.sbKey || (window.LT_CONFIG || {}).supabaseAnonKey || "").trim(),
  });
  function setSync(state, msg = "") { syncState = state; syncMsg = msg; $("#sync-dot").dataset.state = state; $("#sync-dot").title = { off: "Sync off: saved on this device only", ok: "Synced", syncing: "Syncing…", error: "Sync problem: " + msg }[state]; if (!$("#sheet-wrap").hidden && $("#sync-status")) $("#sync-status").textContent = syncLine(); }
  function syncLine() {
    if (!sb) return "Sync is off. Everything is saved on this device.";
    if (!session) return "Sign in to sync between your phone and PC.";
    if (syncState === "error") return "Last sync failed: " + syncMsg;
    if (syncState === "syncing") return "Syncing…";
    return `Synced as ${session.user.email}.`;
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
    if (!sb || !session) { if (manual) toast("Sign in first."); return; }
    if (syncing && Date.now() - syncStarted < 30000) return; // a sync stuck for 30 s no longer blocks new ones
    if (!navigator.onLine) { setSync("error", "you're offline; changes are kept and sync when you're back online"); return; }
    const run = ++syncRun;
    syncing = true; syncStarted = Date.now(); setSync("syncing");
    const timeout = (p) => Promise.race([p, new Promise((_, rej) => setTimeout(() => rej(new Error("the server took too long to answer")), 20000))]);
    try {
      // push
      const ids = Object.keys(store.meta.dirty);
      const sent = {};
      const rows = ids.map((id) => store.items[id]).filter(Boolean).map((it) => { sent[it.id] = it.updatedAt; return { id: it.id, user_id: session.user.id, data: it, updated_at: it.updatedAt, deleted: !!it.deleted }; });
      for (let i = 0; i < rows.length; i += 400) {
        const { error } = await timeout(sb.from("items").upsert(rows.slice(i, i + 400)));
        if (error) throw error;
      }
      for (const id of Object.keys(sent)) if (store.items[id] && store.items[id].updatedAt <= sent[id]) delete store.meta.dirty[id];
      // pull (5 s overlap so rows committed slightly out of order aren't missed)
      let since = store.meta.lastServer ? new Date(Date.parse(store.meta.lastServer) - 5000).toISOString() : null;
      for (let page = 0; page < 50; page++) {
        let q = sb.from("items").select("data,synced_at").order("synced_at", { ascending: true }).limit(1000);
        if (since) q = q.gt("synced_at", since);
        const { data, error } = await timeout(q);
        if (error) throw error;
        for (const row of data) {
          const r = row.data, local = store.items[r.id];
          if (!local || (r.updatedAt || 0) > (local.updatedAt || 0)) store.items[r.id] = r;
          if (!store.meta.lastServer || row.synced_at > store.meta.lastServer) store.meta.lastServer = row.synced_at;
        }
        if (data.length < 1000) break;
        since = data[data.length - 1].synced_at;
      }
      save();
      if ($("#sheet-wrap").hidden) render();
      setSync("ok");
      if (manual) toast("Synced");
    } catch (e) {
      const msg = e.message || String(e);
      setSync("error", /relation .*items.* does not exist|Could not find the table/i.test(msg) ? "the items table is missing; run supabase-setup.sql in Supabase" : msg);
      if (manual) toast("Sync failed: " + syncMsg);
    } finally { if (run === syncRun) syncing = false; }
  }

  async function auth(mode) {
    const email = $("#auth-email").value.trim(), password = $("#auth-pass").value;
    if (!email || password.length < 6) { toast("Enter your email and a password of at least 6 characters."); return; }
    if (!sb) { toast("Save your Supabase settings first."); return; }
    const fn = mode === "up" ? sb.auth.signUp({ email, password }) : sb.auth.signInWithPassword({ email, password });
    const { data, error } = await fn;
    if (error) { toast(error.message); return; }
    if (mode === "up" && !data.session) { toast("Check your email to confirm the account, then sign in."); return; }
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
    openSheet(`<h3>Settings</h3>
      ${installEvt && !isInstalled() ? `<button class="btn" data-action="install">Install Daybook on this device</button>` : ""}
      <section class="section"><h2>Sync</h2>
        <p class="help" id="sync-status">${esc(syncLine())}</p>
        ${signedIn ? `<div class="sheet-actions"><button class="btn" data-action="sync-now">Sync now</button><button class="btn ghost" data-action="sign-out">Sign out</button></div>` : sb ? `
          <div class="field"><label for="auth-email">Email</label><input id="auth-email" type="email" autocomplete="email"></div>
          <div class="field"><label for="auth-pass">Password</label><input id="auth-pass" type="password" autocomplete="current-password" minlength="6"></div>
          <div class="sheet-actions"><button class="btn" data-action="sign-in">Sign in</button><button class="btn ghost" data-action="sign-up">Create account</button></div>
          <p class="help">Use the same email and password on your phone and your PC.</p>` : ""}
        <details ${sb ? "" : "open"}><summary class="help" style="cursor:pointer">Supabase connection</summary>
          <div class="section" style="margin-top:10px">
            <div class="field"><label for="sb-url">Project URL</label><input id="sb-url" type="url" placeholder="https://xxxx.supabase.co" value="${esc(url)}"></div>
            <div class="field"><label for="sb-key">Anon public key</label><input id="sb-key" type="text" autocomplete="off" spellcheck="false" value="${esc(key)}"></div>
            <button class="btn ghost" data-action="save-sync">Save connection</button>
            <p class="help">Found in Supabase under Project Settings → API. Setup steps are in README.md.</p>
          </div></details>
      </section>
      <div class="divider"></div>
      <section class="section"><h2>Appearance</h2>
        <div class="filters">${[["system", "Match phone"], ["light", "Light"], ["dark", "Dark"]].map(([v, l]) => `<button class="filter" data-action="theme" data-v="${v}" aria-pressed="${theme === v}">${l}</button>`).join("")}</div>
      </section>
      <div class="divider"></div>
      <section class="section"><h2>Backup</h2>
        <div class="sheet-actions"><button class="btn ghost" data-action="export">Export backup</button><button class="btn ghost" data-action="import">Import backup</button></div>
        <input type="file" id="import-file" accept="application/json,.json" hidden>
        <p class="help">${all().length} items saved on this device.</p>
      </section>`);
  }

  window.addEventListener("online", () => syncNow());
  document.addEventListener("visibilitychange", () => { if (document.visibilityState === "visible") { render(); syncNow(); } });
  setInterval(() => { if (document.visibilityState === "visible") syncNow(); }, 60000);

  // ---------- offline ----------
  if ("serviceWorker" in navigator && location.protocol !== "file:") {
    navigator.serviceWorker.register("sw.js").catch(() => {});
  }

  render();
  initSync();
})();
