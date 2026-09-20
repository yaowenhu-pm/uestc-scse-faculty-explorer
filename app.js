import { asArray, departmentOptions, filteredFaculty, GRADES, normalizeFilters, researchSummary, titleOptions } from "./faculty.js?v=full-list-v1";
import { displayGrade, GRADE_FILTER_OPTIONS, gradeFilterLabel, subgradeOf } from "./grade-bands.js?v=subgrades-v2";

const state = { faculty: [], search: "", grade: "", department: "", title: "", sort: "score" };
const $ = (selector) => document.querySelector(selector);
const componentLabels = { hardSignal: ["研究荣誉", 30], projects: ["科研项目", 25], publications: ["代表成果", 25], recency: ["近年记录", 10], coverage: ["证据覆盖", 10] };
const esc = (value) => String(value ?? "").replace(/[&<>'"]/g, (char) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", "'": "&#39;", '"': "&quot;" })[char]);
const compactVerdict = (value) => String(value || "").replace(/^[SABCDE]｜[^：]+：/, "");
let dialogOpener = null;

function updateUrl() {
  const params = new URLSearchParams();
  for (const key of ["search", "grade", "department", "title", "sort"]) if (state[key] && !(key === "sort" && state[key] === "score")) params.set(key, state[key]);
  history.replaceState(null, "", `${location.pathname}${params.size ? `?${params}` : ""}${location.hash}`);
}

function readUrl() {
  const params = new URLSearchParams(location.search);
  Object.assign(state, normalizeFilters(state.faculty, Object.fromEntries(params)));
  syncControls();
}

function syncControls() {
  for (const key of ["search", "grade", "title", "sort"]) $("#" + key).value = state[key];
}

function renderCard(item) {
  const grade = GRADES.includes(item.evidenceGrade) ? item.evidenceGrade : "";
  const badge = displayGrade(subgradeOf(item));
  const directions = researchSummary(item);
  const research = (directions.length > 2 ? [directions.slice(0, 2).join(" · "), directions[2]] : directions).map(esc).join("<br>");
  return `<article class="faculty-card" tabindex="0" role="button" aria-label="查看${esc(item.name)}的证据详情" data-id="${esc(item.profileId)}" data-grade="${grade}">
    <div class="card-top"><div class="card-identity"><h2>${esc(item.name)}</h2><span class="card-title">${esc(item.title)}</span></div><b class="badge grade-${grade}" aria-label="公开证据 ${badge} 级">${badge}</b></div>
    <p class="card-department">${esc(asArray(item.departments).join(" / ") || "院系官网未列出")}</p>
    <p class="card-research">${research || "官网未列研究方向"}</p>
  </article>`;
}

function renderFaculty() {
  const result = filteredFaculty(state.faculty, state);
  $("#result-count").textContent = `${result.length} 位教师`;
  $("#faculty-grid").innerHTML = result.length ? result.map(renderCard).join("") : $("#empty-template").innerHTML;
  $("#faculty-grid").setAttribute("aria-busy", "false");
  renderFilterState();
  updateUrl();
}

function renderFilterState() {
  document.querySelectorAll("#department-filter button[data-department]").forEach((button) => {
    const selected = button.dataset.department === state.department;
    button.classList.toggle("active", selected);
    button.setAttribute("aria-pressed", String(selected));
  });
  const active = ["search", "grade", "department", "title"].filter((key) => state[key]);
  $("#reset-filters").hidden = !active.length && state.sort === "score";
  $("#active-filters").hidden = !active.length;
  $("#active-filters").innerHTML = active.map((key) => {
    const label = key === "search" ? `搜索：${state[key]}` : key === "grade" ? gradeFilterLabel(state[key]) : state[key];
    return `<button type="button" data-clear="${key}" aria-label="移除筛选：${esc(label)}">${esc(label)}<span aria-hidden="true">×</span></button>`;
  }).join("");
}

function resetFilters() {
  Object.assign(state, { search: "", grade: "", department: "", title: "", sort: "score" });
  syncControls();
  renderFaculty();
}

function safeProfileUrl(value) {
  try {
    const url = new URL(value);
    return ["https:", "http:"].includes(url.protocol) ? url.href : "";
  } catch { return ""; }
}

function openDialog(item, opener) {
  if (!item) return;
  dialogOpener = opener;
  const grade = GRADES.includes(item.evidenceGrade) ? item.evidenceGrade : "";
  const badge = displayGrade(subgradeOf(item));
  const components = Object.entries(item.scoreComponents || {}).filter(([key]) => componentLabels[key]).map(([key, rawValue]) => {
    const [label, max] = componentLabels[key];
    const value = Number.isFinite(Number(rawValue)) ? Number(rawValue) : 0;
    const percentage = Math.min(100, Math.max(0, Math.round(value / max * 100)));
    return `<div class="component-row"><span>${label}</span><div class="component-track"><div class="component-fill" style="width:${percentage}%"></div></div><b>${esc(value)}/${max}</b></div>`;
  }).join("");
  const snippets = [...asArray(item.evidenceSnippets).reduce((byQuote, entry) => {
    const previous = byQuote.get(entry.excerpt);
    if (previous) {
      previous.type += ` · ${entry.type}`;
      if (!previous.conclusion.includes(entry.conclusion)) previous.conclusion += ` ${entry.conclusion}`;
    } else byQuote.set(entry.excerpt, { ...entry });
    return byQuote;
  }, new Map()).values()];
  const groups = [...snippets.reduce((byReason, entry) => {
    const key = JSON.stringify([entry.type, entry.conclusion]);
    if (!byReason.has(key)) byReason.set(key, { ...entry, excerpts: [] });
    byReason.get(key).excerpts.push(entry.excerpt);
    return byReason;
  }, new Map()).values()];
  const evidence = groups.length ? groups.map((entry) => `<div class="evidence-item"><b>${esc(entry.type)}｜${esc(entry.conclusion)}</b>${entry.excerpts.map(excerpt => `<blockquote>${esc(excerpt)}</blockquote>`).join("")}</div>`).join("") : "<p>学院官网公开证据有限，暂无可展示摘录。</p>";
  const profileUrl = safeProfileUrl(item.profileUrl);
  $("#dialog-content").innerHTML = `<div class="dialog-hero"><div><span class="kicker">教师公开资料</span><h2 id="dialog-name">${esc(item.name)}</h2><p>${esc(item.title)} · ${esc(asArray(item.departments).join(" / ") || "院系官网未列出")}</p></div><div class="dialog-grade grade-${grade}" aria-label="公开证据 ${badge} 级">${badge}</div></div>
    <div class="dialog-body"><div class="score-line"><strong>${esc(item.evidenceScore)}</strong><span>/ 100 · ${esc(item.evidenceLabel)}</span></div><p>${esc(compactVerdict(item.verdict))}</p>
      <div class="component-list">${components}</div>
      <section class="dialog-section"><h3>研究方向</h3><div class="keywords">${[...new Set([...asArray(item.researchDirections), ...asArray(item.focusKeywords)])].map((keyword) => `<span>${esc(keyword)}</span>`).join("") || "<span>官网未明确列出</span>"}</div></section>
      <section class="dialog-section"><h3>主要局限</h3><ul>${asArray(item.limitations).map((text) => `<li>${esc(text)}</li>`).join("")}</ul></section>
      <section class="dialog-section"><h3>官网依据摘录</h3><p>官网快照 ${esc(item.sourceDate)} · 规则 v2 · ${esc(item.reviewStatus)}</p>${evidence}</section>
      <div class="dialog-actions">${profileUrl ? `<a class="button primary" href="${esc(profileUrl)}" target="_blank" rel="noopener noreferrer">打开教师官网 ↗</a>` : ""}<a class="button secondary" href="./methodology.html">查看评分方法</a></div>
    </div>`;
  $("#faculty-dialog").showModal();
  $("#dialog-content").scrollTop = 0;
  $("#dialog-close").focus({ preventScroll: true });
}

function populateFilters() {
  $("#grade").innerHTML = `<option value="">证据等级</option>${GRADE_FILTER_OPTIONS.map(({ value, label }) => `<option value="${esc(value)}">${esc(label)}</option>`).join("")}`;
  $("#department-filter").innerHTML = ["", ...departmentOptions(state.faculty)].map((value) => `<button class="department-tab" type="button" data-department="${esc(value)}" aria-pressed="false">${esc(value || "全部")}</button>`).join("");
  $("#title").innerHTML = `<option value="">全部职称</option>${titleOptions(state.faculty).map((value) => `<option value="${esc(value)}">${esc(value)}</option>`).join("")}`;
}

function bindControls() {
  $("#search").addEventListener("input", (event) => { state.search = event.target.value; renderFaculty(); });
  ["grade", "title", "sort"].forEach((id) => $("#" + id).addEventListener("change", (event) => { state[id] = event.target.value; renderFaculty(); }));
  $("#department-filter").addEventListener("click", (event) => {
    const button = event.target.closest("button[data-department]");
    if (!button) return;
    state.department = button.dataset.department;
    renderFaculty();
  });
  $("#reset-filters").addEventListener("click", () => { resetFilters(); $("#results-title").focus({ preventScroll: true }); });
  $("#faculty-grid").addEventListener("click", (event) => {
    if (event.target.closest("[data-reset]")) { resetFilters(); $("#results-title").focus({ preventScroll: true }); return; }
    const card = event.target.closest(".faculty-card");
    if (card) openDialog(state.faculty.find((item) => String(item.profileId) === card.dataset.id), card);
  });
  $("#faculty-grid").addEventListener("keydown", (event) => {
    const card = event.target.closest(".faculty-card");
    if (card && (event.key === "Enter" || event.key === " ")) { event.preventDefault(); card.click(); }
  });
  $("#active-filters").addEventListener("click", (event) => {
    const button = event.target.closest("button[data-clear]");
    if (!button || !["search", "grade", "department", "title"].includes(button.dataset.clear)) return;
    state[button.dataset.clear] = "";
    syncControls();
    renderFaculty();
    ($("#active-filters button") || $("#results-title")).focus({ preventScroll: true });
  });
  $("#dialog-close").addEventListener("click", () => $("#faculty-dialog").close());
  $("#faculty-dialog").addEventListener("click", (event) => {
    if (event.target !== $("#faculty-dialog")) return;
    const { top, right, bottom, left } = event.target.getBoundingClientRect();
    if (event.clientX < left || event.clientX > right || event.clientY < top || event.clientY > bottom) event.target.close();
  });
  $("#faculty-dialog").addEventListener("close", () => {
    (dialogOpener?.isConnected ? dialogOpener : $("#results-title")).focus({ preventScroll: true });
    dialogOpener = null;
  });
  window.addEventListener("popstate", () => { readUrl(); renderFaculty(); });
}

async function init() {
  const response = await fetch("./data/faculty.public.json", { cache: "no-cache" });
  if (!response.ok) throw new Error("数据加载失败");
  state.faculty = await response.json();
  if (!Array.isArray(state.faculty)) throw new Error("数据格式错误");
  populateFilters();
  readUrl();
  bindControls();
  renderFaculty();
}

init().catch(() => {
  $("#result-count").textContent = "暂时无法加载";
  $("#faculty-grid").setAttribute("aria-busy", "false");
  $("#faculty-grid").innerHTML = `<div class="empty-state"><strong>教师资料暂时无法加载</strong><p>请检查网络连接后重试。</p><button class="button secondary" id="retry-load" type="button">重新加载</button></div>`;
  $("#retry-load").addEventListener("click", () => location.reload());
});
