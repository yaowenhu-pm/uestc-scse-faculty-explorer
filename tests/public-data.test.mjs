import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs/promises";

const faculty = JSON.parse(await fs.readFile(new URL("../data/faculty.public.json", import.meta.url), "utf8"));

test("public export contains 189 unique faculty", () => {
  assert.equal(faculty.length, 189);
  assert.equal(new Set(faculty.map((item) => item.profileId)).size, 189);
});

test("public export contains no contact or raw archive fields", () => {
  const text = JSON.stringify(faculty);
  assert.doesNotMatch(text, /"(?:email|phone|office|photoUrl|rawContentHash|biography|education|workExperience)"/);
  assert.doesNotMatch(text, /[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/i);
  assert.doesNotMatch(text, /(?:\+?86[-\s]?)?1[3-9]\d{9}/);
});

test("S tier is gated by explicit top signals", () => {
  const sTier = faculty.filter((item) => item.evidenceGrade === "S");
  assert.equal(sTier.length, 4);
  for (const item of sTier) {
    assert.ok(item.evidenceScore >= 72);
    assert.ok(item.hardSignals.some((signal) => /院士|国家级人才|会士|国家级科技奖励/.test(signal)));
  }
});
