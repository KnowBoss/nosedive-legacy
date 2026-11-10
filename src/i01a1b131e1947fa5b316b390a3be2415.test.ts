import assert from "node:assert/strict";
import { readFileSync, writeFileSync } from "node:fs";
import { test } from "node:test";
import { i01a1335485c67c95b7efdf2f0e03cfd6 as findBridge } from "nosedive-core";
import { fixture, git, WORK_ID } from "../test/harness.ts";
import { LEGACY_ID } from "./i01a1c72ba0a67a64836f167c23ffa097.ts";
import { i01a1b131e1947fa5b316b390a3be2415 as heldDive } from "./i01a1b131e1947fa5b316b390a3be2415.ts";

test("the dive the hero's dive branch names, with its feat and scope refs", () => {
	const f = fixture("held");
	assert.equal(heldDive(findBridge(f.hero)!), undefined);
	const dive = f.dive(f.featId, f.first);
	const held = heldDive(findBridge(f.hero)!)!;
	assert.equal(held.id, dive);
	assert.equal(held.featId, f.featId);
	assert.deepEqual(held.scopes, [{ repoId: f.repoId, ref: f.first }]);
});

test("a dive of legacy's kind is held as one of work's is", () => {
	const f = fixture("held-legacy");
	const dive = f.dive(f.featId);
	writeFileSync(f.path(dive), readFileSync(f.path(dive), "utf8").replace(WORK_ID, LEGACY_ID));
	assert.equal(heldDive(findBridge(f.hero)!)?.id, dive);
});

test("a dive held under another token, or over, is refused", () => {
	const f = fixture("token");
	const dive = f.dive(f.featId);
	const path = f.path(dive);
	writeFileSync(path, readFileSync(path, "utf8").replace("#0123456789ab", "#ba9876543210"));
	assert.throws(() => heldDive(findBridge(f.hero)!), /is not held under this branch's token/);
	writeFileSync(path, readFileSync(path, "utf8").replace("  diver:", "  outcome: landed\n  diver:"));
	assert.throws(() => heldDive(findBridge(f.hero)!), /is over: it landed/);
});

test("a branch that names no dive of legacy's kind or work's holds nothing", () => {
	const f = fixture("kindless");
	const dive = f.dive(f.featId);
	const path = f.path(dive);
	writeFileSync(path, readFileSync(path, "utf8").replace("      canonical: true\n", "      note: none\n"));
	assert.equal(heldDive(findBridge(f.hero)!), undefined);
	void git;
});
