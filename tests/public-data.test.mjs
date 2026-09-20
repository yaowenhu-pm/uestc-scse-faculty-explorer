import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs/promises";
import { rateAssessment } from "../scripts/rating-rules.mjs";

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

test("all published scores and gates reproduce from reviewed evidence", async () => {
  const { assessments } = JSON.parse(await fs.readFile(new URL("../data/rating-evidence.json", import.meta.url), "utf8"));
  assert.equal(assessments.length, faculty.length);
  const byId = new Map(assessments.map(a => [a.profileId, a]));
  for (const item of faculty) {
    const expected = rateAssessment(byId.get(item.profileId), item);
    assert.equal(item.evidenceGrade, expected.evidenceGrade);
    assert.equal(item.evidenceSubgrade, expected.evidenceSubgrade);
    assert.equal(item.evidenceScore, expected.evidenceScore);
    assert.deepEqual(item.ratingBasis, expected.ratingBasis);
  }
});
