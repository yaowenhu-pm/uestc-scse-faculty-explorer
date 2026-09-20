const state = { faculty: [], statistics: null, search: "", grade: "", department: "", title: "", sort: "score", visible: 24 };
const $ = (selector) => document.querySelector(selector);
const componentLabels = { hardSignal: ["硬信号", 30], projects: ["项目", 20], publications: ["论文成果", 20], recognition: ["荣誉任职", 20], training: ["培养合作", 10] };
const esc = (value) => String(value ?? "").replace(/[&<>'"]/g, (char) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", "'": "&#39;", '"': "&quot;" })[char]);
const compactVerdict = (value) => String(value || "").replace(/^[SABCDE]｜[^：]+：/, "");
const normalize = (value) => String(value || "").normalize("NFKC").toLowerCase().replace(/\s+/g, "");

function initials(name) {
  const clean = String(name || "?").trim();
  return /^[A-Za-z]/.test(clean) ? clean.split(/\s+/).map((part) => part[0]).join("").slice(0, 2).toUpperCase() : clean.slice(0, 1);
}

function updateUrl() {
  const params = new URLSearchParams();
  for (const key of ["search", "grade", "department", "title", "sort"]) if (state[key] && !(key === "sort" && state[key] === "score")) params.set(key, state[key]);
  history.replaceState(null, "", `${location.pathname}${params.size ? `?${params}` : ""}${location.hash}`);
}

function filteredFaculty() {
  const needle = normalize(state.search);
  const result = state.faculty.filter((item) => {
    const haystack = normalize([item.name, item.title, ...item.departments, ...item.researchDirections, ...item.focusKeywords, ...item.hardSignals].join(" "));
    return (!needle || haystack.includes(needle))
      && (!state.grade || item.evidenceGrade === state.grade)
      && (!state.department || (state.department === "官网未列出" ? !item.departments.length : item.departments.includes(state.department)))
      && (!state.title || item.title === state.title);
  });
  return result.sort((a, b) => state.sort === "name" ? a.name.localeCompare(b.name, "zh-CN") : state.sort === "directory" ? a.directoryOrder - b.directoryOrder : b.evidenceScore - a.evidenceScore || a.directoryOrder - b.directoryOrder);
}

function renderCard(item) {
  const keywords = [...new Set([...item.researchDirections, ...item.focusKeywords])].slice(0, 5);
  return `<article class="faculty-card" tabindex="0" role="button" aria-label="查看${esc(item.name)}的证据详情" data-id="${esc(item.profileId)}">
    <div class="card-top"><div class="identity"><span class="initial" aria-hidden="true">${esc(initials(item.name))}</span><div><h3>${esc(item.name)}</h3><p>${esc(item.title)}</p></div></div><b class="badge grade-${esc(item.evidenceGrade)}" aria-label="官网证据 ${esc(item.evidenceGrade)} 级">${esc(item.evidenceGrade)}</b></div>
    <p class="card-department"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M3 21h18M6 21V4h12v17M9 8h2m2 0h2m-6 4h2m2 0h2m-5 9v-5h4v5"/></svg><span>${esc(item.departments.join(" / ") || "院系官网未列出")}</span></p>
    <div class="keywords">${keywords.length ? keywords.map((keyword) => `<span>${esc(keyword)}</span>`).join("") : "<span>官网未列研究方向</span>"}</div>
    <p class="card-verdict">${esc(compactVerdict(item.verdict))}</p>
    <div class="card-footer"><div class="card-score"><strong>${item.evidenceScore}</strong><span>/ 100 · 官网证据</span></div><b>查看详情 <span aria-hidden="true">↗</span></b></div>
  </article>`;
}

function renderFaculty() {
  const result = filteredFaculty();
  $("#result-count").textContent = `${result.length} 位教师`;
  const visible = result.slice(0, state.visible);
  $("#faculty-grid").innerHTML = visible.length ? visible.map(renderCard).join("") : $("#empty-template").innerHTML;
  $("#load-more").hidden = visible.length >= result.length;
  $("#display-count").textContent = result.length ? `已显示 ${visible.length} / ${result.length} 位教师` : "";
  $("#faculty-grid").setAttribute("aria-busy", "false");
  document.querySelectorAll(".faculty-card").forEach((card) => {
    const open = () => openDialog(state.faculty.find((item) => item.profileId === card.dataset.id));
    card.addEventListener("click", open);
    card.addEventListener("keydown", (event) => { if (event.key === "Enter" || event.key === " ") { event.preventDefault(); open(); } });
  });
  renderFilterState(); updateUrl();
}

function renderFilterState() {
  document.querySelectorAll("#grade-filter button").forEach((button) => {
    const selected = button.dataset.grade === state.grade;
    button.classList.toggle("active", selected);
    button.setAttribute("aria-pressed", String(selected));
  });
  const active = ["search", "grade", "department", "title"].filter((key) => state[key]);
  $("#filter-summary").textContent = active.length ? `${active.length} 项已选` : "全部条件";
  $("#reset-filters").disabled = !active.length && state.sort === "score";
  $("#active-filters").hidden = !active.length;
  $("#active-filters").innerHTML = active.map((key) => {
    const label = key === "search" ? `搜索：${state[key]}` : key === "grade" ? `${state[key]} 级` : state[key];
    return `<button type="button" data-clear="${key}" aria-label="移除筛选：${esc(label)}">${esc(label)}<span aria-hidden="true">×</span></button>`;
  }).join("");
}

function resetFilters() {
  Object.assign(state, { search: "", grade: "", department: "", title: "", sort: "score", visible: 24 });
  for (const key of ["search", "department", "title", "sort"]) $("#" + key).value = state[key];
  renderFaculty();
}

function openDialog(item) {
  if (!item) return;
  const components = Object.entries(item.scoreComponents).map(([key, value]) => {
    const [label, max] = componentLabels[key];
    return `<div class="component-row"><span>${label}</span><div class="component-track"><div class="component-fill" style="width:${Math.round(value / max * 100)}%"></div></div><b>${value}/${max}</b></div>`;
  }).join("");
  const evidence = item.evidenceSnippets.length ? item.evidenceSnippets.map((entry) => `<div class="evidence-item"><b>${esc(entry.type)}｜${esc(entry.conclusion)}</b><blockquote>${esc(entry.excerpt)}</blockquote></div>`).join("") : "<p>学院官网公开证据有限，暂无可展示摘录。</p>";
  $("#dialog-content").innerHTML = `<div class="dialog-hero"><div><span class="kicker">教师公开资料</span><h2 id="dialog-name">${esc(item.name)}</h2><p>${esc(item.title)} · ${esc(item.departments.join(" / ") || "院系官网未列出")}</p></div><div class="dialog-grade grade-${esc(item.evidenceGrade)}" aria-label="官网证据 ${esc(item.evidenceGrade)} 级">${esc(item.evidenceGrade)}</div></div>
    <div class="dialog-body"><div class="score-line"><strong>${item.evidenceScore}</strong><span>/ 100 · ${esc(item.evidenceLabel)}</span></div><p>${esc(compactVerdict(item.verdict))}</p>
      <div class="component-list">${components}</div>
      <section class="dialog-section"><h3>研究方向</h3><div class="keywords">${[...new Set([...item.researchDirections, ...item.focusKeywords])].map((keyword) => `<span>${esc(keyword)}</span>`).join("") || "<span>官网未明确列出</span>"}</div></section>
      <section class="dialog-section"><h3>硬核信号</h3>${item.hardSignals.length ? `<ul>${item.hardSignals.map((signal) => `<li>${esc(signal)}</li>`).join("")}</ul>` : "<p>官网未出现可核验的国家级或国际头部门槛信号。</p>"}</section>
      <section class="dialog-section"><h3>主要局限</h3><ul>${item.limitations.map((text) => `<li>${esc(text)}</li>`).join("")}</ul></section>
      <section class="dialog-section"><h3>官网依据摘录</h3>${evidence}</section>
      <div class="dialog-actions"><a class="button primary" href="${esc(item.profileUrl)}" target="_blank" rel="noreferrer">打开教师官网 ↗</a><a class="button secondary" href="./methodology.html">查看评分方法</a></div>
    </div>`;
  $("#faculty-dialog").showModal();
  $("#dialog-content").scrollTop = 0;
}

function populateFilters() {
  const departments = [...new Set(state.faculty.flatMap((item) => item.departments.length ? item.departments : ["官网未列出"]))].sort((a, b) => a.localeCompare(b, "zh-CN"));
  const titles = [...new Set(state.faculty.map((item) => item.title))].sort((a, b) => a.localeCompare(b, "zh-CN"));
  $("#department").insertAdjacentHTML("beforeend", departments.map((value) => `<option value="${esc(value)}">${esc(value)}</option>`).join(""));
  $("#title").insertAdjacentHTML("beforeend", titles.map((value) => `<option value="${esc(value)}">${esc(value)}</option>`).join(""));
}

function renderStats() {
  const stats = state.statistics;
  $("#stat-total").textContent = stats.teacherCount;
  $("#stat-s").textContent = stats.gradeDistribution.S;
  $("#stat-a").textContent = stats.gradeDistribution.A;
  $("#stat-review").textContent = stats.reviewDistribution.incomplete || 0;
  $("#snapshot-date").textContent = stats.sourceCollectedAt.slice(0, 10);
  document.querySelectorAll("#grade-filter button").forEach((button) => {
    button.querySelector(".filter-count").textContent = button.dataset.grade ? stats.gradeDistribution[button.dataset.grade] : stats.teacherCount;
  });
}

function bindControls() {
  $("#search").addEventListener("input", (event) => { state.search = event.target.value; state.visible = 24; renderFaculty(); });
  ["department", "title", "sort"].forEach((id) => $("#" + id).addEventListener("change", (event) => { state[id] = event.target.value; state.visible = 24; renderFaculty(); }));
  $("#grade-filter").addEventListener("click", (event) => {
    const button = event.target.closest("button[data-grade]"); if (!button) return;
    state.grade = button.dataset.grade; state.visible = 24;
    renderFaculty();
  });
  $("#reset-filters").addEventListener("click", resetFilters);
  $("#faculty-grid").addEventListener("click", (event) => {
    if (event.target.closest("[data-reset]")) { resetFilters(); $(".results-heading h2").focus({ preventScroll: true }); }
  });
  $("#active-filters").addEventListener("click", (event) => {
    const button = event.target.closest("button[data-clear]"); if (!button) return;
    const key = button.dataset.clear;
    state[key] = ""; state.visible = 24;
    if (key !== "grade") $("#" + key).value = "";
    renderFaculty();
    ($("#active-filters button") || $(".results-heading h2")).focus({ preventScroll: true });
  });
  $("#load-more").addEventListener("click", () => {
    const firstNew = state.visible;
    state.visible += 24; renderFaculty();
    document.querySelectorAll(".faculty-card")[firstNew]?.focus({ preventScroll: true });
  });
  $("#dialog-close").addEventListener("click", () => $("#faculty-dialog").close());
  $("#faculty-dialog").addEventListener("click", (event) => { if (event.target === $("#faculty-dialog")) $("#faculty-dialog").close(); });
  const compact = matchMedia("(max-width: 900px)");
  const syncPanel = () => { $("#filter-panel").open = !compact.matches; };
  syncPanel(); compact.addEventListener("change", syncPanel);
}

async function init() {
  const [facultyResponse, statisticsResponse] = await Promise.all([fetch("./data/faculty.public.json"), fetch("./data/statistics.json")]);
  if (!facultyResponse.ok || !statisticsResponse.ok) throw new Error("数据加载失败");
  state.faculty = await facultyResponse.json(); state.statistics = await statisticsResponse.json();
  const params = new URLSearchParams(location.search);
  for (const key of ["search", "grade", "department", "title", "sort"]) if (params.has(key)) state[key] = params.get(key);
  populateFilters(); renderStats(); bindControls();
  for (const key of ["department", "title", "sort"]) {
    if (![...$("#" + key).options].some((option) => option.value === state[key])) state[key] = key === "sort" ? "score" : "";
  }
  if (!["", "S", "A", "B", "C", "D", "E"].includes(state.grade)) state.grade = "";
  $("#search").value = state.search; $("#department").value = state.department; $("#title").value = state.title; $("#sort").value = state.sort;
  renderFaculty();
}

init().catch(() => {
  $("#result-count").textContent = "暂时无法加载";
  $("#faculty-grid").setAttribute("aria-busy", "false");
  $("#faculty-grid").innerHTML = `<div class="empty-state"><strong>教师资料暂时无法加载</strong><p>请检查网络连接后重试。</p><button class="button secondary" id="retry-load" type="button">重新加载</button></div>`;
  $("#retry-load").addEventListener("click", () => location.reload());
});
