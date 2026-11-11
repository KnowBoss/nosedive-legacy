import assert from "node:assert/strict";
import { readFileSync, writeFileSync } from "node:fs";
import { test } from "node:test";
import { i01a1335485c67c95b7efdf2f0e03cfd6 as findBridge } from "nosedive-core";
import { i01a1335480c776ba8945020d0af333eb as mintUuid } from "nosedive-core";
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

/** A dive as legacy nosedive wrote it, held by this checkout's token and hung from the feat by a `jumped.dive` link, its hero on the dive's branch. */
function legacyHeld(label: string, meta = "effort: ideas") {
	const f = fixture(label);
	const id = mintUuid();
	const token = "0123456789ab";
	writeFileSync(f.path(id), `---\nkind: dive\nid: ${id}\nname: ideas.${id.slice(-6)}\ngist: "A dive"\nscopes:\n  - ${f.repoId}:\n      ref: ${f.first}\n      work-branch: work/ideas\nmeta:\n  ${meta}\n  diver: diver@example.com#${token}\n---\n\n# Dive\n`);
	f.link(f.featId, id, "rel: jumped.dive");
	f.commit("a legacy dive");
	git(f.hero, "checkout", "-q", "-b", `nosedive-${token}-${id}`);
	return { f, id };
}

test("a dive as legacy nosedive wrote it is held by its state link, its feat from meta.effort or the doc that links it, and over once landed or bailed, even as the memo legacy left", () => {
	const { f, id } = legacyHeld("held-state");
	const held = heldDive(findBridge(f.hero)!)!;
	assert.equal(held.id, id);
	assert.equal(held.featId, f.featId, "meta.effort names it, by name");
	assert.deepEqual(held.scopes, [{ repoId: f.repoId, ref: f.first }]);

	const bare = legacyHeld("held-state-bare", "priority: follow-up");
	assert.equal(heldDive(findBridge(bare.f.hero)!)?.featId, bare.f.featId, "no feat named: the doc that links it");

	for (const state of ["landed", "bailed"]) {
		writeFileSync(f.path(f.featId), readFileSync(f.path(f.featId), "utf8").replace(/rel: \w+\.dive/, `rel: ${state}.dive`));
		assert.throws(() => heldDive(findBridge(f.hero)!), new RegExp(`is over: it ${state}`));
	}
	writeFileSync(f.path(id), readFileSync(f.path(id), "utf8").replace("kind: dive", "kind: memo"));
	assert.throws(() => heldDive(findBridge(f.hero)!), /is over: it bailed/, "a memo, as legacy nosedive's land and bail left it");
});

test("a dive held under another token, or over, is refused", () => {
	const f = fixture("token");
	const dive = f.dive(f.featId);
	const path = f.path(dive);
	writeFileSync(path, readFileSync(path, "utf8").replace("#0123456789ab", "#ba9876543210"));
	assert.throws(() => heldDive(findBridge(f.hero)!), /is not held under this branch's token/);
	writeFileSync(path, readFileSync(path, "utf8").replace("  diver:", "  outcome: landed\n  diver:"));
	assert.throws(() => heldDive(findBridge(f.hero)!), /is over: it landed/, "work's dive is over by its outcome, which has no state link");
});

test("a branch that names no dive of legacy's kind or work's holds nothing", () => {
	const f = fixture("kindless");
	const dive = f.dive(f.featId);
	const path = f.path(dive);
	writeFileSync(path, readFileSync(path, "utf8").replace(`  - ${WORK_ID}:\n      canonical: true\n`, `  - ${mintUuid()}:\n      canonical: true\n`));
	assert.equal(heldDive(findBridge(f.hero)!), undefined, "a dive of another owner's kind");
	void git;
});
