import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { test } from "node:test";
import { fixture, git } from "../test/harness.ts";
import { i0190147b40b25ca2b1d03135a75a3502 as recordGate } from "./i0190147b40b25ca2b1d03135a75a3502.ts";
import { i79c0bcc90fa55bff9c8e62fed26dfa9a as testNamed } from "./i79c0bcc90fa55bff9c8e62fed26dfa9a.ts";

test("mints a gate, its failing stub and its test.gate link on the feat in one commit", async () => {
	const f = fixture("record");
	const before = git(f.hero, "rev-parse", "HEAD");
	await recordGate({ gist: "Data says two", feat: f.featId, name: "data-says-two" }, f.ctx);
	const id = /kb\/(.+)\.md/.exec(f.out[0]!)![1]!;
	assert.equal(git(f.hero, "rev-list", "--count", `${before}..HEAD`), "1");
	assert.equal(git(f.hero, "status", "--porcelain"), "");
	const doc = readFileSync(f.path(id), "utf8");
	assert.match(doc, /kind: gate/);
	assert.match(doc, new RegExp(`test-script: kb/artifacts/${id}.mjs`));
	assert.match(readFileSync(f.path(f.featId), "utf8"), new RegExp(`kb/${id}.md:\\s+rel: test.gate`));
	assert.match(readFileSync(join(f.hero, "kb", "artifacts", `${id}.mjs`), "utf8"), /return false;/);
	await assert.rejects(testNamed({ gate: [id] }, f.ctx), /1 gate failed: data-says-two/);
});

test("--action land --flaky links it land.gate, flaky", async () => {
	const f = fixture("land");
	await recordGate({ gist: "Lands", feat: `kb/${f.featId}.md`, action: "land", flaky: true }, f.ctx);
	const id = /kb\/(.+)\.md/.exec(f.out[0]!)![1]!;
	assert.match(readFileSync(f.path(f.featId), "utf8"), new RegExp(`kb/${id}.md:\\s+rel: land.gate\\s+test-is-flaky: true`));
});

test("a doc that is no feat is refused", async () => {
	const f = fixture("nofeat");
	await assert.rejects(recordGate({ gist: "x", feat: f.repoId }, f.ctx), /is no feat of this hero/);
});
