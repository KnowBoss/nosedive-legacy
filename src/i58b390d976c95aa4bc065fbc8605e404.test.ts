import assert from "node:assert/strict";
import { readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { test } from "node:test";
import { fixture, git } from "../test/harness.ts";
import { i58b390d976c95aa4bc065fbc8605e404 as note } from "./i58b390d976c95aa4bc065fbc8605e404.ts";

test("a note is a memo, scoped to the bridge repo, linked from it, in one commit", async () => {
	const f = fixture("memo");
	const before = git(f.hero, "rev-parse", "HEAD");
	await note({ gist: ["Data", "reads", "slowly"] }, f.ctx);
	assert.ok(f.out.includes("scoped to data, the bridge repo"));
	const id = /kb\/(.+)\.md/.exec(f.out.at(-1)!)![1]!;
	const doc = readFileSync(f.path(id), "utf8");
	assert.match(doc, /kind: memo/);
	assert.match(doc, new RegExp(`name: data-reads-slowly-${id.slice(-6)}`));
	assert.match(doc, /# Data reads slowly/);
	assert.match(readFileSync(join(f.hero, ".nosedive", "repos", `${f.repoId}.md`), "utf8"), new RegExp(`kb/${id}.md:\\s+rel: memo.note`));
	assert.equal(git(f.hero, "rev-list", "--count", `${before}..HEAD`), "1");
	assert.equal(git(f.hero, "status", "--porcelain"), "");
});

test("a first word ending in a colon is the kind, with a title and a body from a file", async () => {
	const f = fixture("kind");
	const body = join(f.hero, "..", "body.md");
	writeFileSync(body, "Seen twice.\n");
	await note({ gist: ["gate:", "Slow", "data"], scope: "data", title: "Slow data", body }, f.ctx);
	const id = /kb\/(.+)\.md/.exec(f.out.at(-1)!)![1]!;
	const doc = readFileSync(f.path(id), "utf8");
	assert.match(doc, /kind: gate/);
	assert.match(doc, /# Slow data\n\nSeen twice.\n$/);
	assert.match(readFileSync(join(f.hero, ".nosedive", "repos", `${f.repoId}.md`), "utf8"), /rel: gate.note/);
});

test("a kind the hero does not have is refused", async () => {
	const f = fixture("nokind");
	await assert.rejects(note({ gist: ["bug:", "x"] }, f.ctx), /this hero has no kind bug/);
});
