// record-dive
import assert from "node:assert/strict";
import { test } from "node:test";
import { i01a1335485c67c95b7efdf2f0e03cfd6 as findBridge, i01a13354845c7253a55b60bba87285d8 as findKbDoc } from "nosedive-core";
import { i01a1c72ba0b57a0c80e3fdd641d001a8 as recordDive } from "./i01a1c72ba0b57a0c80e3fdd641d001a8.ts";
import { loopFixture as fixture, git } from "../test/harness.ts";

test("sets and clears meta, replaces scopes, appends a dated section, and commits the hero without pushing", () => {
	const f = fixture("record-dive");
	const hero = findBridge(f.hero)!;
	const pushed = git(f.hero, "rev-parse", "origin/main");
	const doc = findKbDoc(hero.kbDir, f.featId)!;
	recordDive(hero, doc, { action: "jump", label: "jumped", summary: "picked up", meta: { diver: "a@example.com" }, scopes: [{ [f.repoId]: { ref: "abc" } }], lines: ["- one"] }, "test");
	recordDive(hero, findKbDoc(hero.kbDir, f.featId)!, { action: "pack", label: "packed", summary: "put down", meta: { diver: null }, lines: ["- two"] }, "test");
	const text = f.doc(f.featId);
	assert.doesNotMatch(text, /meta:/, "a meta emptied is dropped");
	assert.match(text, new RegExp(`scopes:\\n {2}- ${f.repoId}:\\n {6}ref: abc\\n`));
	assert.match(text, /\n## \d{4}-\d\d-\d\dT[\d:.]+Z jumped\n\n- one\n\n## \d{4}-\d\d-\d\dT[\d:.]+Z packed\n\n- two\n$/);
	assert.equal(git(f.hero, "log", "-1", "--format=%s"), `pack(${String(doc.fm.name)}): put down`, "the command, then the doc it acted on, whatever feat the hero holds");
	assert.equal(git(f.hero, "rev-parse", "origin/main"), pushed, "not pushed");
});

test("appends after a dive written with the old `## Jumped <time>` headings, leaving them as they are", () => {
	const f = fixture("record-dive-old");
	const hero = findBridge(f.hero)!;
	const doc = findKbDoc(hero.kbDir, f.featId)!;
	doc.body += "\n## Jumped 2026-01-01T00:00:00.000Z\n\n- old\n";
	recordDive(hero, doc, { action: "bail", label: "bailed", summary: "gave up", lines: ["- new"] }, "test");
	assert.match(f.doc(f.featId), /\n## Jumped 2026-01-01T00:00:00\.000Z\n\n- old\n\n## \d{4}-\d\d-\d\dT[\d:.]+Z bailed\n\n- new\n$/);
});

test("a state moves the dive's link on its feat in the same commit, and the dive's meta it does not set is kept", () => {
	const f = fixture("record-dive-state");
	const hero = findBridge(f.hero)!;
	const id = f.legacyDive({ meta: ["effort: ideas", "priority: follow-up", "diver: null"] });
	recordDive(hero, findKbDoc(hero.kbDir, id)!, { action: "pack", label: "packed", state: "packed", summary: "put down", meta: { packer: "a@example.com" }, lines: ["- two"] }, "test");
	assert.equal(f.relOf(f.featId, id), "packed.dive");
	assert.match(f.doc(id), /\nmeta:\n {2}effort: ideas\n {2}priority: follow-up\n {2}diver: null\n {2}packer: a@example\.com\n/);
	assert.equal(git(f.hero, "status", "--porcelain"), "", "the feat's link rides the dive's commit");
	assert.equal(git(f.hero, "show", "--name-only", "--format=", "HEAD").split("\n").length, 2, "the dive and its feat");
});
