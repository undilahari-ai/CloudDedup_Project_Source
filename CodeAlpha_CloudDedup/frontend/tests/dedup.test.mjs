import test from "node:test";
import assert from "node:assert/strict";
import {
  SIMILARITY_THRESHOLD,
  normalize,
  recordSimilarity,
  sha256,
  similarity
} from "../src/dedup.ts";

test("normalizes case and whitespace consistently", () => {
  assert.equal(normalize("  Hello   WORLD \n"), "hello world");
});

test("produces a stable SHA-256 hash for normalized content", async () => {
  const first = await sha256(`${normalize(" A ")}|${normalize(" B ")}`);
  const second = await sha256(`${normalize("a")}|${normalize("b")}`);
  assert.equal(first, second);
  assert.match(first, /^[a-f0-9]{64}$/);
});

test("returns 1 for identical strings", () => {
  assert.equal(similarity("cloud data", "cloud data"), 1);
});

test("keeps clearly different strings below the review threshold", () => {
  assert.ok(similarity("alpha beta", "railway ticket") < SIMILARITY_THRESHOLD);
});

test("flags a close record pair for review", () => {
  const score = recordSimilarity(
    normalize("Student cloud record"),
    normalize("Cloud computing internship record for student"),
    normalize("Student cloud records"),
    normalize("Cloud computing internship records for students")
  );
  assert.ok(score >= SIMILARITY_THRESHOLD);
});
