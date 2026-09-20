import test from "node:test";
import assert from "node:assert/strict";
import { departmentOptions, filteredFaculty, normalizeFilters, researchSummary } from "../faculty.js";

const faculty = (overrides = {}) => ({ profileId: "1", name: "教师", title: "教授", departments: ["信息安全系"], researchDirections: [], focusKeywords: [], hardSignals: [], evidenceGrade: "A", evidenceScore: 70, directoryOrder: 1, ...overrides });
const ids = (items) => items.map((item) => item.profileId);

test("grade order takes priority over score, with score and directory order breaking ties", () => {
  const records = [
    faculty({ profileId: "a-high", evidenceGrade: "A", evidenceScore: 99, directoryOrder: 1 }),
    faculty({ profileId: "s-low", evidenceGrade: "S", evidenceScore: 20, directoryOrder: 9 }),
    faculty({ profileId: "s-high-later", evidenceGrade: "S", evidenceScore: 81, directoryOrder: 6 }),
    faculty({ profileId: "s-high-first", evidenceGrade: "S", evidenceScore: 81, directoryOrder: 3 }),
    faculty({ profileId: "unknown", evidenceGrade: "?", evidenceScore: 100, directoryOrder: 0 }),
  ];
  const original = [...records];
  assert.deepEqual(ids(filteredFaculty(records, { sort: "score" })), ["s-high-first", "s-high-later", "s-low", "a-high", "unknown"]);
  assert.deepEqual(records, original, "sorting must not mutate public data order");
});

test("search normalizes full-width text, case, and whitespace across searchable fields", () => {
  const records = [faculty({ profileId: "ai", researchDirections: ["AI Security"] }), faculty({ profileId: "other", name: "王老师", hardSignals: ["国家级奖励"] })];
  assert.deepEqual(ids(filteredFaculty(records, { search: " ａｉ　ＳＥＣＵＲＩＴＹ " })), ["ai"]);
  assert.deepEqual(ids(filteredFaculty(records, { search: "国家级奖励" })), ["other"]);
  assert.equal(filteredFaculty(records, { search: "   " }).length, 2);
});

test("search, grade, department and title filters intersect", () => {
  const records = [
    faculty({ profileId: "match", researchDirections: ["数据安全"] }),
    faculty({ profileId: "grade", researchDirections: ["数据安全"], evidenceGrade: "B" }),
    faculty({ profileId: "department", researchDirections: ["数据安全"], departments: ["实验中心"] }),
    faculty({ profileId: "title", researchDirections: ["数据安全"], title: "研究员" }),
    faculty({ profileId: "search", researchDirections: ["计算机视觉"] }),
  ];
  assert.deepEqual(ids(filteredFaculty(records, { search: "安全", grade: "A", department: "信息安全系", title: "教授" })), ["match", "search"], "department names remain searchable");
  assert.deepEqual(ids(filteredFaculty(records, { search: "数据", grade: "A", department: "信息安全系", title: "教授" })), ["match"]);
});

test("missing departments remain filterable and department tabs use the agreed order", () => {
  const records = [faculty({ profileId: "absent", departments: undefined }), faculty({ profileId: "empty", departments: [] }), faculty({ departments: ["实验中心"] }), faculty({ departments: ["计算机软件与理论系", "信息安全系"] }), faculty({ departments: ["计算机工程与应用系"] })];
  assert.deepEqual(ids(filteredFaculty(records, { department: "官网未列出" })), ["absent", "empty"]);
  assert.deepEqual(departmentOptions(records), ["计算机工程与应用系", "计算机软件与理论系", "信息安全系", "实验中心", "官网未列出"]);
});

test("name and directory sorting remain available and deterministic on ties", () => {
  const records = [faculty({ profileId: "a2", name: "Alice", directoryOrder: 2 }), faculty({ profileId: "b", name: "Bob", directoryOrder: 0 }), faculty({ profileId: "a1", name: "Alice", directoryOrder: 1 })];
  assert.deepEqual(ids(filteredFaculty(records, { sort: "name" })), ["a1", "a2", "b"]);
  assert.deepEqual(ids(filteredFaculty(records, { sort: "directory" })), ["b", "a1", "a2"]);
});

test("invalid URL values reset safely while old score sorting links remain valid", () => {
  const records = [faculty()];
  assert.deepEqual(normalizeFilters(records, { search: "数据", grade: "Z", title: "未知", department: "未知", sort: "random" }), { search: "数据", grade: "", title: "", department: "", sort: "score" });
  assert.deepEqual(normalizeFilters(records, { grade: "A", title: "教授", department: "信息安全系", sort: "score" }), { search: "", grade: "A", title: "教授", department: "信息安全系", sort: "score" });
});

test("cards prioritize research directions, deduplicate, and use keywords only as fallback", () => {
  assert.deepEqual(researchSummary(faculty({ researchDirections: ["AI", "ＡＩ", "网络", "安全", "数据"], focusKeywords: ["关键词"] })), ["AI", "网络", "安全"]);
  assert.deepEqual(researchSummary(faculty({ researchDirections: [" "], focusKeywords: ["隐私", "隐私", "安全"] })), ["隐私", "安全"]);
});
