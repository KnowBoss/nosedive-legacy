import assert from "node:assert/strict";
import { test } from "node:test";
import { fixture, git } from "../test/harness.ts";
import { iffb5aa30b4e659e68b40ad7dee378a62 as testHeld } from "./iffb5aa30b4e659e68b40ad7dee378a62.ts";

test("with no dive held, test is refused naming jump and the named form", async () => {
	const f = fixture("none");
	await assert.rejects(testHeld({}, f.ctx), /no dive is held here: `nosedive jump .*`nosedive test <gate>...`/);
});

test("test runs the held dive's own test.gate links, at the dive's scope refs", async () => {
	const f = fixture("own");
	f.gate("feat-gate", "return false;", { on: f.featId });
	const dive = f.dive(f.featId, f.first);
	const own = f.gate("dive-gate", "return true;", { on: dive });
	await testHeld({}, f.ctx);
	assert.ok(f.out.includes(`gate dive-gate (kb/${own.id}.md)`));
	assert.ok(!f.out.some((line) => line.startsWith("gate feat-gate")));
	assert.equal(git(f.checkout, "rev-parse", "HEAD"), f.first);
});

test("--full adds the feat's, its scoped repos' and its connected feats' gates, never another dive's", async () => {
	const f = fixture("full");
	// Another dive on the same feat: its gates are its own work.
	const other = f.dive(f.featId, undefined, false);
	f.gate("other-dive-gate", "return false;", { on: other });
	const dive = f.dive(f.featId);
	f.gate("dive-gate", "return true;", { on: dive });
	f.gate("feat-gate", "return true;", { on: f.featId });
	f.gate("repo-gate", "return true;", { on: f.repoId, scopes: "  []" });
	f.gate("sibling-gate", "return true;", { on: f.otherFeatId });
	await testHeld({}, f.ctx);
	assert.deepEqual(ran(f.out), ["dive-gate"]);
	f.out.length = 0;
	await testHeld({ full: true }, f.ctx);
	// The two feats connect through the root, which links both as .feat.
	assert.deepEqual(ran(f.out).sort(), ["dive-gate", "feat-gate", "sibling-gate"].sort());
});

test("--full takes the gates of the repos the dive scopes", async () => {
	const f = fixture("repos");
	const dive = f.dive(f.featId, f.first);
	f.gate("repo-gate", "return true;", { on: f.repoId, scopes: "  []" });
	await testHeld({ full: true }, f.ctx);
	assert.deepEqual(ran(f.out), ["repo-gate"]);
	void dive;
});

const ran = (out: string[]) => out.filter((line) => line.startsWith("gate ")).map((line) => line.split(" ")[1]);
