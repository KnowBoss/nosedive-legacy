import assert from "node:assert/strict";
import { readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { test } from "node:test";
import { i01a1335480c776ba8945020d0af333eb as mintUuid } from "nosedive-core";
import { fixture, git, WORK_ID } from "../test/harness.ts";
import { LEGACY_ID } from "./i01a1c72ba0a67a64836f167c23ffa097.ts";
import { i01a1b31bdffb73989a9e8bcd257167b5 as legacyDives } from "./i01a1b31bdffb73989a9e8bcd257167b5.ts";

/** Registers work's repo and makes the hero wear it, as core's legacy-capes does for a hero it converts. */
function wearWork(f: ReturnType<typeof fixture>) {
	const workRepo = "01a15ba8-0bff-7ce3-83dc-e08af3633e26";
	writeFileSync(join(f.hero, ".nosedive", "repos", `${workRepo}.md`), `---\nkind: repo\nid: ${workRepo}\nname: nosedive-work\ngist: "Work"\nmeta:\n  trunk: main\n---\n\n# nosedive-work\n`);
	f.link(f.heroId, workRepo, "rel: .cape");
}

/** Dives as legacy nosedive wrote them: two landed and bailed as memos, one open with legacy meta, each hung from the feat by its state link. */
function legacyHero(f: ReturnType<typeof fixture>, canonical: string) {
	const [landed, open, bailed] = [mintUuid(), mintUuid(), mintUuid()];
	writeFileSync(f.path(landed), `---\nkind: memo\nid: ${landed}\nname: ideas.landed\ngist: "Landed"\nmeta:\n  diver: null\n---\n\n# Landed\n`);
	writeFileSync(f.path(bailed), `---\nkind: memo\nid: ${bailed}\nname: ideas.bailed\ngist: "Bailed"\n---\n\n# Bailed\n`);
	writeFileSync(f.path(open), `---\nkind: dive\nid: ${open}\nname: ideas.open\ngist: "Open"\nscopes:\n  - ${canonical}:\n      canonical: true\n      version: abc\nmeta:\n  effort: others\n  priority: follow-up\n  diver: someone@example.com\n---\n\n# Open\n`);
	f.link(f.featId, landed, "rel: landed.dive");
	f.link(f.featId, open, "rel: planned.dive, note: kept");
	f.link(f.featId, bailed, "rel: bailed.dive");
	f.link(f.featId, f.otherFeatId, "rel: context.dive");
	return { landed, open, bailed };
}

/** Every file of the hero's kb, as it is. */
const snapshot = (f: ReturnType<typeof fixture>) => git(f.hero, "ls-files", "-mo", "--exclude-standard") + "\n" + [f.featId, f.otherFeatId, f.heroId].map((id) => readFileSync(f.path(id), "utf8")).join("\n");

test("in a hero that wears legacy and not work the migration is retired: it changes no doc, dives as legacy nosedive wrote them included, and says nothing", () => {
	const f = fixture("legacy-dives-retired");
	const { landed, open, bailed } = legacyHero(f, LEGACY_ID);
	const out: string[] = [];
	const ctx = { capes: [], out: (text: string) => void out.push(text) } as never;
	const before = [landed, open, bailed].map((id) => readFileSync(f.path(id), "utf8"));
	const heroBefore = snapshot(f);

	assert.deepEqual(legacyDives(f.hero, ctx), [], "no doc rewritten");
	assert.deepEqual([landed, open, bailed].map((id) => readFileSync(f.path(id), "utf8")), before, "the dives, memos and open, as they were");
	assert.equal(snapshot(f), heroBefore, "the links too: state links stay state links");
	assert.match(readFileSync(f.path(f.featId), "utf8"), new RegExp(`rel: planned\\.dive\\n {6}note: kept`));
	assert.equal(out.length, 0);
});

test("in a hero wearing work, state links become dives.feat, memo-dives become work's dives with their outcome, and legacy meta moves to feat or body", () => {
	const f = fixture("legacy-dives");
	wearWork(f);
	const { landed, open, bailed } = legacyHero(f, WORK_ID);
	const out: string[] = [];
	const ctx = { capes: [], out: (text: string) => void out.push(text) } as never;

	assert.equal(legacyDives(f.hero, ctx).length, 4);
	const feat = readFileSync(f.path(f.featId), "utf8");
	for (const id of [landed, open, bailed]) assert.match(feat, new RegExp(`- kb/${id}.md:\\n {6}rel: dives.feat\\n`));
	assert.match(feat, /rel: dives.feat\n {6}note: kept\n/, "a link keeps its other attributes");
	assert.match(feat, new RegExp(`- kb/${f.otherFeatId}.md:\\n {6}rel: context.dive\\n`), "other .dive rels stay");

	const memo = readFileSync(f.path(landed), "utf8");
	assert.match(memo, /^---\nkind: dive\n/);
	assert.match(memo, new RegExp(`scopes:\\n  - ${WORK_ID}:\\n      canonical: true\\n      version: abc\\n`), "work's canonical entry, copied from a dive of work's");
	assert.match(memo, new RegExp(`meta:\\n  diver: null\\n  outcome: landed\\n  feat: ${f.featId}\\n`));
	assert.match(readFileSync(f.path(bailed), "utf8"), /\n  outcome: bailed\n/);

	const dive = readFileSync(f.path(open), "utf8");
	assert.match(dive, new RegExp(`meta:\\n  diver: someone@example.com\\n  feat: ${f.otherFeatId}\\n---`), "effort names the feat, by name; the diver is kept");
	assert.doesNotMatch(dive, /outcome/);
	assert.match(dive, /\n## Legacy meta\n\n- priority: follow-up\n$/);
	assert.ok(out.some((line) => line.startsWith("legacy-dives: 3 dives linked by state") && line.endsWith("to work's shape")));

	assert.deepEqual(legacyDives(f.hero, ctx), [], "run again, it finds nothing to change");
});

test("in a hero wearing work too, memo-dives become work's dives, which its loop reads, and a dive of work's is left work's", () => {
	const f = fixture("legacy-dives-work");
	wearWork(f);
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
