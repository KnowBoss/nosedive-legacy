// jump [<ref>] --sure
import assert from "node:assert/strict";
import { readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { test } from "node:test";
import { ia65e6ec583fa51079af219fd79e4ad87 as jumpSure } from "./ia65e6ec583fa51079af219fd79e4ad87.ts";
import { i0e2024913efd5dc8afe194f5650bda20 as jump } from "./i0e2024913efd5dc8afe194f5650bda20.ts";
import { i5f74ee87748f528b9fd9b00a48c2275b as pack } from "./i5f74ee87748f528b9fd9b00a48c2275b.ts";
import { i3b8461aa9eac5f10837c2515b5231e78 as land } from "./i3b8461aa9eac5f10837c2515b5231e78.ts";
import { loopFixture as fixture, git } from "../test/harness.ts";

test("a durable feat is jumped only --sure", async () => {
	const f = fixture("sure-durable");
	// The memo kind made durable again: its doc no longer says how one is dropped.
	const kind = git(f.hero, "ls-files", ".nosedive/kinds").split("\n")[0]!;
	writeFileSync(join(f.hero, kind), readFileSync(join(f.hero, kind), "utf8").replace(/\n## Drop when\n[^]*$/, "\n"));
	git(f.hero, "commit", "-qam", "memos last");
	git(f.hero, "push", "-q", "origin", "HEAD:main");
	await assert.rejects(jump({ ref: f.featId }, f.ctx), /ideas is durable, so next does not list it: jump it --sure to start a dive on it anyway \(sure-off-fringe\)/);
	await jumpSure({ ref: f.featId }, f.ctx);
	assert.match(f.doc(f.onDeck()), /\n {2}feat: /);
});

test("a feat with a dive is not jumped bare, --sure or not, the refusal naming how to plan a briefed dive, which jumps (feat-jumps-bare)", async () => {
	const f = fixture("sure-attempt");
	await jump({ ref: f.featId }, f.ctx);
	const first = f.onDeck();
	assert.match(f.doc(first), /\ngist: "?An attempt to complete ideas"?\n/);
	await pack({}, f.ctx);
	const refusal = new RegExp(`ideas has a dive on it \\(kb/${first}\\.md\\), so a bare jump would start it over, --sure or not: finish and drop it first, or plan another dive saying what it does, then jump that:\\n {2}nosedive crud nosedive-legacy:dive <gist> --meta:feat ${f.featId} --section:Brief -\\n {2}nosedive jump <dive>$`);
	await assert.rejects(jump({ ref: f.featId }, f.ctx), refusal);
	await assert.rejects(jumpSure({ ref: f.featId }, f.ctx), refusal);
	const second = f.plan();
	await jump({ ref: second }, f.ctx);
	assert.equal(f.onDeck(), second, "a second dive on the feat, beside the packed one");
	await land({}, f.ctx);
	await jump({ ref: first }, f.ctx);
	assert.equal(f.onDeck(), first, "the packed one is jumped again by its packer, no --sure needed");
});

test("work another email packed is taken over only --sure, its work in progress included", async () => {
	const f = fixture("sure-take-over");
	await jump({ ref: f.featId }, f.ctx);
	const id = f.onDeck();
	writeFileSync(join(f.checkout, "half.md"), "half done\n");
	await pack({}, f.ctx);

	git(f.hero, "config", "user.email", "taker@example.com");
	await assert.rejects(jump({ ref: id }, f.ctx), new RegExp(`dive ${id.slice(-6)}\\.ideas was packed by diver@example\\.com: jump it --sure to take it over, its work in progress included \\(take-over-with-sure\\)`));
	await jumpSure({ ref: id }, f.ctx);
	assert.equal(f.onDeck(), id);
	assert.equal(readFileSync(join(f.checkout, "half.md"), "utf8"), "half done\n", "their work in progress, uncommitted again");
	assert.match(f.doc(id), /\n {2}diver: taker@example\.com#[0-9a-f]{12}\n/);
});
