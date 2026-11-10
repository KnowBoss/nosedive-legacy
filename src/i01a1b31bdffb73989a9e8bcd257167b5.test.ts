import assert from "node:assert/strict";
import { readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { test } from "node:test";
import { i01a1335480c776ba8945020d0af333eb as mintUuid } from "nosedive-core";
import { fixture, WORK_ID } from "../test/harness.ts";
import { LEGACY_ID } from "./i01a1c72ba0a67a64836f167c23ffa097.ts";
import { i01a1b31bdffb73989a9e8bcd257167b5 as legacyDives } from "./i01a1b31bdffb73989a9e8bcd257167b5.ts";

test("state links become dives.feat, memo-dives become legacy's dives with their outcome, and legacy meta moves to feat or body", () => {
	const f = fixture("legacy-dives");
	const [landed, open, bailed] = [mintUuid(), mintUuid(), mintUuid()];
	writeFileSync(f.path(landed), `---\nkind: memo\nid: ${landed}\nname: ideas.landed\ngist: "Landed"\nmeta:\n  diver: null\n---\n\n# Landed\n`);
	writeFileSync(f.path(bailed), `---\nkind: memo\nid: ${bailed}\nname: ideas.bailed\ngist: "Bailed"\n---\n\n# Bailed\n`);
	writeFileSync(f.path(open), `---\nkind: dive\nid: ${open}\nname: ideas.open\ngist: "Open"\nscopes:\n  - ${LEGACY_ID}:\n      canonical: true\n      version: abc\nmeta:\n  effort: others\n  priority: follow-up\n  diver: someone@example.com\n---\n\n# Open\n`);
	f.link(f.featId, landed, "rel: landed.dive");
	f.link(f.featId, open, "rel: planned.dive, note: kept");
	f.link(f.featId, bailed, "rel: bailed.dive");
	f.link(f.featId, f.otherFeatId, "rel: context.dive");
	const out: string[] = [];
	const ctx = { capes: [], out: (text: string) => void out.push(text) } as never;

	assert.equal(legacyDives(f.hero, ctx).length, 4);
	const feat = readFileSync(f.path(f.featId), "utf8");
	for (const id of [landed, open, bailed]) assert.match(feat, new RegExp(`- kb/${id}.md:\\n {6}rel: dives.feat\\n`));
	assert.match(feat, /rel: dives.feat\n {6}note: kept\n/, "a link keeps its other attributes");
	assert.match(feat, new RegExp(`- kb/${f.otherFeatId}.md:\\n {6}rel: context.dive\\n`), "other .dive rels stay");

	const memo = readFileSync(f.path(landed), "utf8");
	assert.match(memo, /^---\nkind: dive\n/);
	assert.match(memo, new RegExp(`scopes:\\n  - ${LEGACY_ID}:\\n      canonical: true\\n      version: abc\\n`), "legacy's canonical entry, copied from a dive of legacy's");
	assert.match(memo, new RegExp(`meta:\\n  diver: null\\n  outcome: landed\\n  feat: ${f.featId}\\n`));
	assert.match(readFileSync(f.path(bailed), "utf8"), /\n  outcome: bailed\n/);

	const dive = readFileSync(f.path(open), "utf8");
	assert.match(dive, new RegExp(`meta:\\n  diver: someone@example.com\\n  feat: ${f.otherFeatId}\\n---`), "effort names the feat, by name; the diver is kept");
	assert.doesNotMatch(dive, /outcome/);
	assert.match(dive, /\n## Legacy meta\n\n- priority: follow-up\n$/);
	assert.ok(out.some((line) => line.startsWith("legacy-dives: 3 dives linked by state") && line.endsWith("to legacy's shape")));

	assert.deepEqual(legacyDives(f.hero, ctx), [], "run again, it finds nothing to change");
});

test("in a hero wearing work too, memo-dives become work's dives, which its loop reads, and a dive of work's is left work's", () => {
	const f = fixture("legacy-dives-work");
	const workRepo = "01a15ba8-0bff-7ce3-83dc-e08af3633e26";
	writeFileSync(join(f.hero, ".nosedive", "repos", `${workRepo}.md`), `---\nkind: repo\nid: ${workRepo}\nname: nosedive-work\ngist: "Work"\nmeta:\n  trunk: main\n---\n\n# nosedive-work\n`);
	f.link(f.heroId, workRepo, "rel: .cape");
	const [landed, open] = [mintUuid(), mintUuid()];
	writeFileSync(f.path(landed), `---\nkind: memo\nid: ${landed}\nname: ideas.landed\ngist: "Landed"\n---\n\n# Landed\n`);
	writeFileSync(f.path(open), `---\nkind: dive\nid: ${open}\nname: ideas.open\ngist: "Open"\nscopes:\n  - ${WORK_ID}:\n      canonical: true\n      version: abc\nmeta:\n  feat: ${f.featId}\n---\n\n# Open\n`);
	f.link(f.featId, landed, "rel: landed.dive");
	f.link(f.featId, open, "rel: jumped.dive");
	const out: string[] = [];
	legacyDives(f.hero, { capes: [], out: (text: string) => void out.push(text) } as never);
	for (const id of [landed, open]) assert.match(readFileSync(f.path(id), "utf8"), new RegExp(`scopes:\\n  - ${WORK_ID}:\\n      canonical: true\\n      version: abc\\n`));
	assert.ok(out.some((line) => line.endsWith("to work's shape")));
});
