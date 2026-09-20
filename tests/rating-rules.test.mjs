import test from "node:test";
import assert from "node:assert/strict";
import { rateAssessment, validateAssessment, verifyQuotes } from "../scripts/rating-rules.mjs";
const sample = (s, p, o, year = 2026) => {
  const evidence = [{ section: "成果", quote: "可定位的本人具体科研记录" }];
  const part = level => ({ level, reason: "经过复核的证据说明", evidence: level === 4 ? [1, 2, 3].map(n => ({ section: "成果", quote: `第${n}篇本人明确贡献的作品` })) : level ? evidence : [], ...(level === 4 ? { qualification: "papers" } : {}) });
  return { profileId: "test", signal: part(s), projects: part(p), outputs: part(o), recent: { year, evidence: year ? evidence : [] }, notes: [], reviewed: true };
};
test("grade gates apply independently of score: no S without a senior signal", () => {
  const rating = rateAssessment(sample(2, 4, 4));
  assert.equal(rating.evidenceScore, 82);
  assert.equal(rating.evidenceGrade, "A");
  assert.equal(rateAssessment(sample(3, 4, 4)).evidenceGrade, "S");
});
test("A needs two strong dimensions, even when total is 60+", () => {
  assert.equal(rateAssessment(sample(4, 2, 2)).evidenceScore, 68);
  assert.equal(rateAssessment(sample(4, 2, 2)).evidenceGrade, "B");
  assert.equal(rateAssessment(sample(1, 3, 3)).evidenceGrade, "A");
  assert.equal(rateAssessment(sample(2, 4, 2)).evidenceGrade, "B");
  assert.equal(rateAssessment(sample(2, 1, 4)).evidenceGrade, "B");
});
test("recent evidence uses fixed research years; missing years earn no points", () => {
  assert.equal(rateAssessment(sample(0, 2, 2, 2022)).scoreComponents.recency, 10);
  assert.equal(rateAssessment(sample(0, 2, 2, 2021)).scoreComponents.recency, 5);
  assert.equal(rateAssessment(sample(0, 2, 2, 2016)).scoreComponents.recency, 0);
  assert.equal(rateAssessment(sample(0, 2, 2, null)).scoreComponents.recency, 0);
  assert.throws(() => rateAssessment(sample(0, 2, 2, 2027)), /年份/);
});
test("specific records differ from aggregate claims and missing information", () => {
  assert.equal(rateAssessment(sample(0, 1, 0, null)).evidenceGrade, "C");
  assert.equal(rateAssessment(sample(0, 0, 1, null)).evidenceGrade, "D");
  assert.equal(rateAssessment(sample(0, 0, 0, null), { researchDirections: ["计算机网络"] }).evidenceGrade, "D");
  assert.equal(rateAssessment(sample(0, 0, 0, null)).evidenceGrade, "E");
  assert.equal(rateAssessment(sample(0, 0, 1, null)).scoreComponents.coverage, 0);
});
test("participating projects do not get PI points, duplicated text cannot add points", () => {
  const a = sample(0, 1, 2);
  const original = rateAssessment(a);
  a.projects.evidence.push(...Array(20).fill(a.projects.evidence[0]));
  assert.deepEqual(rateAssessment(a), original);
  assert.equal(original.scoreComponents.projects, 4);
});
test("every positive assessment requires a located source quote", () => {
  const a = sample(1, 2, 2);
  assert.equal(verifyQuotes(a, { profileId: "test", sections: { "成果": "前文可定位的本人具体科研记录后文" } }), true);
  assert.throws(() => verifyQuotes(a, { profileId: "test", sections: { "成果": "不匹配" } }), /逐字定位/);
  a.signal.evidence = [];
  assert.throws(() => validateAssessment(a), /缺少原文/);
});

test("three-work tier rejects a single repeated work or unspecified qualification", () => {
  const a = sample(0, 3, 4);
  a.outputs.evidence = Array(3).fill(a.outputs.evidence[0]);
  assert.throws(() => validateAssessment(a), /三条独立/);
  a.outputs.qualification = "research-prize";
  assert.doesNotThrow(() => validateAssessment(a));
  delete a.outputs.qualification;
  assert.throws(() => validateAssessment(a), /资格类型/);
});
