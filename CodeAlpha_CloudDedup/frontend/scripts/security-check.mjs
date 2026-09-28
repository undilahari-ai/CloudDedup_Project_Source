import fs from "node:fs";
import assert from "node:assert/strict";

const rules = fs.readFileSync(new URL("../firestore.rules", import.meta.url), "utf8");
const firebaseSource = fs.readFileSync(new URL("../src/firebase.ts", import.meta.url), "utf8");
const mainSource = fs.readFileSync(new URL("../src/main.tsx", import.meta.url), "utf8");

assert.ok(rules.includes("request.auth != null"), "Rules must require authentication");
assert.ok(!rules.includes("allow read, write: if true"), "Rules must not allow public read/write");
assert.ok(rules.includes("request.auth.uid == userId"), "Rules must isolate user data");
assert.ok(rules.includes("request.resource.data.keys().hasOnly"), "Rules must validate document fields");
assert.ok(rules.includes("getAfter("), "Rules must verify atomic companion writes");
assert.ok(!mainSource.includes("VITE_API_URL"), "Frontend must not reference the removed API architecture");
assert.ok(firebaseSource.includes("initializeApp"), "Firebase initialization must remain present");

console.log("Security/source consistency checks passed.");
