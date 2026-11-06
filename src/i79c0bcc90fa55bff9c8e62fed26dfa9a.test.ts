import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { test } from "node:test";
import { fixture, git } from "../test/harness.ts";
import { i79c0bcc90fa55bff9c8e62fed26dfa9a as testNamed } from "./i79c0bcc90fa55bff9c8e62fed26dfa9a.ts";

/** A gate body that writes its ctx, without resolve, to `file`. */
const record = (file: string) => `const { writeFileSync } = await import("node:fs");\nwriteFileSync(${JSON.stringify(file)}, JSON.stringify(ctx));`;

test("a named gate runs with legacy's ctx, its declarer's scopes checked out", async () => {
	const f = fixture("named");
	const file = join(f.hero, "..", "ctx.json");
	const gate = f.gate("records", record(file), { on: f.featId });
	await testNamed({ gate: [gate.id] }, f.ctx);
	const ctx = JSON.parse(readFileSync(file, "utf8"));
	assert.equal(ctx.gateId, gate.id);
	assert.equal(ctx.introducedById, f.featId);
	assert.equal(ctx.diveId, "");
	assert.equal(ctx.bridgeRoot, f.hero);
	assert.deepEqual(ctx.repos, { data: { id: f.repoId, root: "workspace/data" } });
	assert.equal(readFileSync(join(f.checkout, "README.md"), "utf8"), "two\n");
	assert.ok(f.out.includes("1 of 1 gates passed"));
});

test("a gate's scope ref is checked out detached at it, and its own scopes win over its declarer's", async () => {
	const f = fixture("ref");
	const gate = f.gate("pinned", "return true;", { on: f.featId, scopes: `  - ${f.repoId}:\n      ref: ${f.first}` });
	await testNamed({ gate: [gate.id] }, f.ctx);
	assert.equal(git(f.checkout, "rev-parse", "HEAD"), f.first);
});

test("every gate runs, and a failure that is not flaky fails the run after the summary", async () => {
	const f = fixture("fail");
	const red = f.gate("red", "return false;", { on: f.featId });
	const thrown = f.gate("thrown", 'throw new Error("no");', { on: f.featId });
	const green = f.gate("green", "return true;", { on: f.featId });
	await assert.rejects(testNamed({ gate: [red.id, thrown.id, green.id] }, f.ctx), /2 gates failed: red, thrown/);
	assert.ok(f.out.includes("1 of 3 gates passed"));
});

test("a flaky failure warns and does not fail the run", async () => {
	const f = fixture("flaky");
	const gate = f.gate("shaky", "return false;", { on: f.featId, attrs: "rel: test.gate, test-is-flaky: true" });
	await testNamed({ gate: [gate.id] }, f.ctx);
	assert.ok(f.out.includes("failed, flaky: shaky"));
});

test("a gate with no declarer is refused unless it has its own scopes", async () => {
	const f = fixture("orphan");
	const orphan = f.gate("orphan", "return true;");
	await assert.rejects(testNamed({ gate: [orphan.id] }, f.ctx), /no doc declares orphan/);
	const free = f.gate("free", "return true;", { scopes: "  []" });
	await testNamed({ gate: [free.id] }, f.ctx);
	assert.ok(f.err.includes("nosedive: free runs with no repos"));
});

test("several declarers are refused until --via names the one meant", async () => {
	const f = fixture("via");
	const gate = f.gate("twice", "return true;", { on: f.featId });
	f.link(f.otherFeatId, gate.id, "rel: land.gate");
	f.commit("declare again");
	await assert.rejects(testNamed({ gate: [gate.id] }, f.ctx), (error: Error) => /several declaring docs: /.test(error.message) && /ideas \(/.test(error.message) && /others \(/.test(error.message));
	await testNamed({ gate: [gate.id], doc: f.otherFeatId }, f.ctx);
});

test("the held dive answers among several declarers", async () => {
	const f = fixture("held");
	const file = join(f.hero, "..", "ctx.json");
	const gate = f.gate("both", record(file), { on: f.featId });
	const dive = f.dive(f.featId);
	f.link(dive, gate.id, "rel: test.gate");
	f.commit("dive declares it");
	await testNamed({ gate: [`kb/${gate.id}.md`] }, f.ctx);
	const ctx = JSON.parse(readFileSync(file, "utf8"));
	assert.equal(ctx.introducedById, dive);
	assert.equal(ctx.diveId, dive);
	assert.equal(ctx.featId, f.featId);
});

test("ctx.resolve reads a doc by quid and throws for one there is not", async () => {
	const f = fixture("resolve");
	const gate = f.gate(
		"resolves",
		[`const feat = await ctx.resolve(${JSON.stringify(f.featId)});`, 'if (feat.fm.name !== "ideas") return false;', 'try { await ctx.resolve("00000000-0000-7000-8000-000000000000"); return false; } catch { return true; }'].join("\n"),
		{ on: f.featId },
	);
	await testNamed({ gate: [gate.id] }, f.ctx);
});

test("an uncommitted gate is named, and runs", async () => {
	const f = fixture("dirty");
	const gate = f.gate("dirty", "return true;", { on: f.featId });
	f.link(f.otherFeatId, gate.id, "rel: note");
	await testNamed({ gate: [gate.id] }, f.ctx);
	assert.ok(f.err.some((line) => /dirty's doc or script has uncommitted changes/.test(line)) === false);
	const text = readFileSync(join(f.hero, gate.script), "utf8");
	(await import("node:fs")).writeFileSync(join(f.hero, gate.script), `${text}// edited\n`);
	await testNamed({ gate: [gate.id] }, f.ctx);
	assert.ok(f.err.some((line) => /dirty's doc or script has uncommitted changes/.test(line)));
});
