import assert from "node:assert/strict";
import { rmSync } from "node:fs";
import { join } from "node:path";
import { test } from "node:test";
import { i01a1335485c67c95b7efdf2f0e03cfd6 as findBridge } from "nosedive-core";
import { fixture } from "../test/harness.ts";
import { heroDocs, i01a1b131e31f7b329bc1c4389343491a as runGates } from "./i01a1b131e31f7b329bc1c4389343491a.ts";

test("selecting no gates fails", async () => {
	const f = fixture("none");
	await assert.rejects(runGates(findBridge(f.hero)!, [], undefined, f.ctx), /no gates were selected/);
});

test("a gate whose script is missing fails, and the rest still run", async () => {
	const f = fixture("missing");
	const gone = f.gate("gone", "return true;", { on: f.featId });
	const kept = f.gate("kept", "return true;", { on: f.featId });
	rmSync(join(f.hero, gone.script));
	const hero = findBridge(f.hero)!;
	const docs = heroDocs(hero);
	const by = docs.get(f.featId)!;
	await assert.rejects(
		runGates(hero, [{ gate: docs.get(gone.id)!, by, flaky: false }, { gate: docs.get(kept.id)!, by, flaky: false }], undefined, f.ctx),
		/1 gate failed: gone/,
	);
	assert.ok(f.out.includes("1 of 2 gates passed"));
});

test("the first gate to claim a repo decides its ref, and a later one wanting another is named", async () => {
	const f = fixture("claims");
	const pinned = f.gate("pinned", "return true;", { scopes: `  - ${f.repoId}:\n      ref: ${f.first}` });
	const trunk = f.gate("trunk", "return true;", { on: f.featId });
	const hero = findBridge(f.hero)!;
	const docs = heroDocs(hero);
	await runGates(hero, [{ gate: docs.get(pinned.id)!, by: undefined, flaky: false }, { gate: docs.get(trunk.id)!, by: docs.get(f.featId), flaky: false }], undefined, f.ctx);
	assert.ok(f.err.some((line) => line === `nosedive: trunk wants data at trunk, but pinned checked it out at ${f.first} first`));
});
