import { GRADES, matchesGrade, validGradeFilter } from "./grade-bands.js";
export { GRADES } from "./grade-bands.js";
export const INITIAL_VISIBLE = 6;
export const LOAD_INCREMENT = 12;
export const MISSING_DEPARTMENT = "官网未列出";
const SORTS = ["score", "name", "directory"];
const DEPARTMENT_ORDER = ["计算机工程与应用系", "计算机软件与理论系", "信息安全系", "实验中心", "计算机国家级实验教学示范中心"];

export const asArray = (value) => Array.isArray(value) ? value : [];
export const normalize = (value) => String(value ?? "").normalize("NFKC").toLocaleLowerCase("zh-CN").replace(/\s+/g, "");
const nonemptyStrings = (value) => asArray(value).map((item) => String(item ?? "").trim()).filter(Boolean);
const departmentsOf = (item) => nonemptyStrings(item.departments);
const directoryOrder = (item) => Number.isFinite(Number(item.directoryOrder)) ? Number(item.directoryOrder) : Number.MAX_SAFE_INTEGER;
const evidenceScore = (item) => Number.isFinite(Number(item.evidenceScore)) ? Number(item.evidenceScore) : 0;
const gradeOrder = (item) => GRADES.includes(item.evidenceGrade) ? GRADES.indexOf(item.evidenceGrade) : GRADES.length;

export function departmentOptions(faculty) {
  const values = [...new Set(faculty.flatMap((item) => departmentsOf(item).length ? departmentsOf(item) : [MISSING_DEPARTMENT]))];
  return values.sort((a, b) => {
    const first = DEPARTMENT_ORDER.includes(a) ? DEPARTMENT_ORDER.indexOf(a) : DEPARTMENT_ORDER.length;
    const second = DEPARTMENT_ORDER.includes(b) ? DEPARTMENT_ORDER.indexOf(b) : DEPARTMENT_ORDER.length;
    return first - second || (a === MISSING_DEPARTMENT ? 1 : b === MISSING_DEPARTMENT ? -1 : a.localeCompare(b, "zh-CN"));
  });
}

export function titleOptions(faculty) {
  return [...new Set(faculty.map((item) => String(item.title ?? "").trim()).filter(Boolean))].sort((a, b) => a.localeCompare(b, "zh-CN"));
}

export function normalizeFilters(faculty, filters = {}) {
  return {
    search: String(filters.search ?? ""),
    grade: validGradeFilter(filters.grade) ? filters.grade : "",
    department: departmentOptions(faculty).includes(filters.department) ? filters.department : "",
    title: titleOptions(faculty).includes(filters.title) ? filters.title : "",
    sort: SORTS.includes(filters.sort) ? filters.sort : "score",
  };
}

export function filteredFaculty(faculty, filters = {}) {
  const needle = normalize(filters.search);
  return faculty.filter((item) => {
    const departments = departmentsOf(item);
    const haystack = normalize([item.name, item.title, ...departments, ...asArray(item.researchDirections), ...asArray(item.focusKeywords), ...asArray(item.hardSignals)].join(" "));
    return (!needle || haystack.includes(needle))
      && matchesGrade(item, filters.grade)
      && (!filters.department || (filters.department === MISSING_DEPARTMENT ? !departments.length : departments.includes(filters.department)))
      && (!filters.title || item.title === filters.title);
  }).sort((a, b) => {
    if (filters.sort === "name") return String(a.name ?? "").localeCompare(String(b.name ?? ""), "zh-CN") || directoryOrder(a) - directoryOrder(b);
    if (filters.sort === "directory") return directoryOrder(a) - directoryOrder(b);
    return gradeOrder(a) - gradeOrder(b) || evidenceScore(b) - evidenceScore(a) || directoryOrder(a) - directoryOrder(b);
  });
}

export function researchSummary(item, limit = 3) {
  const directions = nonemptyStrings(item.researchDirections);
  const values = directions.length ? directions : nonemptyStrings(item.focusKeywords);
  const seen = new Set();
  return values.filter((value) => {
    const key = normalize(value);
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  }).slice(0, limit);
}
