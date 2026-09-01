import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const faculty = JSON.parse(await fs.readFile(path.join(root, "data/faculty.public.json"), "utf8"));
const statistics = JSON.parse(await fs.readFile(path.join(root, "data/statistics.json"), "utf8"));
const errors = [];
const assert = (condition, message) => { if (!condition) errors.push(message); };
const grades = ["S", "A", "B", "C", "D", "E"];
const allowedKeys = new Set(["profileId", "name", "title", "departments", "profileUrl", "researchDirections", "focusKeywords", "evidenceGrade", "evidenceScore", "evidenceLabel", "verdict", "scoreComponents", "hardSignals", "highlights", "limitations", "evidenceSnippets", "directoryOrder", "collectedAt", "reviewStatus", "rubricVersion"]);

assert(faculty.length === 189, `教师数不是 189：${faculty.length}`);
assert(new Set(faculty.map((item) => item.profileId)).size === 189, "公开数据教师 ID 不唯一");
assert(new Set(faculty.map((item) => item.profileUrl)).size === 189, "公开数据官网 URL 不唯一");
for (const item of faculty) {
  assert(Object.keys(item).every((key) => allowedKeys.has(key)), `${item.profileId} 出现非白名单字段`);
  assert(grades.includes(item.evidenceGrade), `${item.profileId} 等级非法`);
  assert(Number.isFinite(item.evidenceScore) && item.evidenceScore >= 0 && item.evidenceScore <= 100, `${item.profileId} 分数非法`);
  assert(Object.values(item.scoreComponents).reduce((sum, value) => sum + value, 0) === item.evidenceScore, `${item.profileId} 分项合计不等于总分`);
  assert(/^https:\/\/www\.scse\.uestc\.edu\.cn\//.test(item.profileUrl), `${item.profileId} 官网 URL 非学院域名`);
  assert(item.evidenceSnippets.every((evidence) => evidence.sourceUrl === item.profileUrl), `${item.profileId} 依据来源不一致`);
  if (item.evidenceGrade === "S") {
    assert(item.evidenceScore >= 72, `${item.profileId} S级低于 72 分`);
    assert(item.hardSignals.some((signal) => /院士|国家级人才|会士|国家级科技奖励/.test(signal)), `${item.profileId} S级缺少门槛信号`);
  }
}
const serialized = JSON.stringify(faculty);
for (const [label, pattern] of [
  ["邮箱", /[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/i],
  ["手机", /(?:\+?86[-\s]?)?1[3-9]\d{9}/],
  ["固定电话", /0\d{2,3}[-\s]?\d{7,8}/],
  ["原始HTML", /<html|\$_ts\.nsd|\$_ts\.cd/i],
  ["本地绝对路径", /[A-Z]:\\Users\\/i],
]) assert(!pattern.test(serialized), `公开数据检测到${label}`);

const distribution = Object.fromEntries(grades.map((grade) => [grade, faculty.filter((item) => item.evidenceGrade === grade).length]));
assert(JSON.stringify(distribution) === JSON.stringify(statistics.gradeDistribution), "等级分布与统计文件不一致");
const result = { passed: errors.length === 0, teacherCount: faculty.length, distribution, errors };
console.log(JSON.stringify(result, null, 2));
if (errors.length) process.exitCode = 1;
