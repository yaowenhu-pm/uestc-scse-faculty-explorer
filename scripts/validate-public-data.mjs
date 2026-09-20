import fs from "node:fs/promises";
import { rateAssessment, GRADES, RUBRIC_VERSION } from "./rating-rules.mjs";
import { SUBGRADES, SUBGRADE_VERSION } from "../grade-bands.js";
const read = name => fs.readFile(new URL(`../data/${name}`, import.meta.url), "utf8").then(JSON.parse);
const [faculty, statistics, evidence] = await Promise.all(["faculty.public.json", "statistics.json", "rating-evidence.json"].map(read));
const errors = [];
const check = (condition, message) => { if (!condition) errors.push(message); };
const allowed = new Set("profileId name title departments profileUrl researchDirections focusKeywords evidenceGrade evidenceSubgrade evidenceScore evidenceLabel verdict scoreComponents hardSignals highlights limitations evidenceSnippets directoryOrder collectedAt reviewStatus rubricVersion ratingBasis sourceDate ratedAt".split(" "));
const byId = new Map(evidence.assessments.map(a => [a.profileId, a]));
check(faculty.length === 189 && byId.size === 189 && evidence.assessments.length === 189, "教师/评估数量不是189");
check(new Set(faculty.map(f => f.profileId)).size === 189, "教师ID重复");
check(new Set(faculty.map(f => f.profileUrl)).size === 189, "教师官网地址重复");
for (const item of faculty) {
  check(Object.keys(item).every(k => allowed.has(k)), `${item.profileId} 非白名单字段`);
  check(/^https:\/\/www\.scse\.uestc\.edu\.cn\/info\/1081\/\d+\.htm$/.test(item.profileUrl), `${item.profileId} 来源地址非法`);
  try {
    const expected = rateAssessment(byId.get(item.profileId), item);
    for (const key of Object.keys(expected)) check(JSON.stringify(item[key]) === JSON.stringify(expected[key]), `${item.profileId} ${key} 与规则不一致`);
  } catch (error) { errors.push(error.message); }
  check(item.rubricVersion === RUBRIC_VERSION, `${item.profileId} 旧规则残留`);
  check(item.evidenceSnippets.every(e => e.sourceUrl === item.profileUrl), `${item.profileId} 摘录来源不一致`);
}
for (const [file, data] of [["faculty", faculty], ["assessments", evidence]]) {
  const text = JSON.stringify(data);
  for (const [label, pattern] of [
    ["邮箱", /[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/i],
    ["手机", /(?:\+?86[-\s]?)?1[3-9]\d{9}/],
    ["固定电话", /0\d{2,3}[-\s]?\d{7,8}/],
    ["原始HTML", /<html|\$_ts\.nsd|\$_ts\.cd/i],
    ["本地路径", /[A-Z]:\\Users\\/i],
    ["非公开字段", /"(?:email|phone|office|photoUrl|rawContentHash|biography|education|workExperience)"\s*:/],
  ]) check(!pattern.test(text), `${file} 检测到${label}`);
}
const distribution = Object.fromEntries(GRADES.map(g => [g, faculty.filter(f => f.evidenceGrade === g).length]));
check(JSON.stringify(distribution) === JSON.stringify(statistics.gradeDistribution), "分布与统计文件不一致");
const subgradeDistribution = Object.fromEntries(SUBGRADES.map(g => [g, faculty.filter(f => f.evidenceSubgrade === g).length]));
check(JSON.stringify(subgradeDistribution) === JSON.stringify(statistics.subgradeDistribution), "细分等级与统计文件不一致");
check(statistics.subgradeVersion === SUBGRADE_VERSION, "细分版本不一致");
console.log(JSON.stringify({ passed: !errors.length, teacherCount: faculty.length, distribution, errors }, null, 2));
if (errors.length) process.exitCode = 1;
