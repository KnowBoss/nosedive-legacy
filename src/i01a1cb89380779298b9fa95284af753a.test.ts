import assert from "node:assert/strict";
import { readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { test } from "node:test";
import { i01a1335480c776ba8945020d0af333eb as mintUuid } from "nosedive-core";
import { i01a1335485c67c95b7efdf2f0e03cfd6 as findBridge } from "nosedive-core";
import { fixture } from "../test/harness.ts";
import { LEGACY_ID, diveLinks, openDives } from "./i01a1c72ba0a67a64836f167c23ffa097.ts";
import { i01a1b31bdffb73989a9e8bcd257167b5 as legacyDives } from "./i01a1b31bdffb73989a9e8bcd257167b5.ts";
import { i01a1cb89380779298b9fa95284af753a as restore } from "./i01a1cb89380779298b9fa95284af753a.ts";

type F = ReturnType<typeof fixture>;
const ctxOf = (out: string[]) => ({ capes: [], out: (text: string) => void out.push(text) }) as never;

/** A dive of legacy's in the shape an earlier legacy-dives left it: legacy's canonical entry, `meta.feat`, and the meta given. */
function converted(f: F, name: string, meta: string): string {
	const id = mintUuid();
	writeFileSync(f.path(id), `---\nkind: dive\nid: ${id}\nname: ${name}\ngist: "${name}"\nscopes:\n  - ${LEGACY_ID}:\n      canonical: true\n      version: abc\nmeta:\n  feat: ${f.featId}\n${meta}---\n\n# ${name}\n`);
	return id;
}

/** A hero an earlier legacy-dives converted: one dive in each state, each linked `dives.feat` from the feat. */
function convertedHero(f: F) {
	const ids = {
		landed: converted(f, "ideas.landed", "  diver: null\n  outcome: landed\n"),
		bailed: converted(f, "ideas.bailed", "  outcome: bailed\n"),
		jumped: converted(f, "ideas.jumped", "  diver: diver@example.com#0123456789ab\n"),
		packed: converted(f, "ideas.packed", "  packer: diver@example.com\n"),
		planned: converted(f, "ideas.planned", ""),
	};
	for (const [state, id] of Object.entries(ids)) f.link(f.featId, id, state === "planned" ? "rel: dives.feat, note: kept" : "rel: dives.feat");
	// A dives.feat link to a doc that is no dive of legacy's is no converted dive.
	f.link(f.featId, f.otherFeatId, "rel: dives.feat");
	return ids;
}

test("in a hero an earlier legacy-dives converted, each dives.feat link to a dive of legacy's becomes its state link again, and outcome goes", () => {
	const f = fixture("legacy-dives-restored");
	const ids = convertedHero(f);
	const out: string[] = [];

	const changed = restore(f.hero, ctxOf(out));
	assert.deepEqual(changed.sort(), [f.featId, ids.landed, ids.bailed].map((id) => f.path(id)).sort(), "the feat, and the two dives that had an outcome");
	const feat = readFileSync(f.path(f.featId), "utf8");
	for (const [state, id] of Object.entries(ids)) assert.match(feat, new RegExp(`- kb/${id}.md:\\n {6}rel: ${state}\\.dive\\n`), state);
	assert.match(feat, /rel: planned\.dive\n {6}note: kept\n/, "a link keeps its other attributes");
	assert.match(feat, new RegExp(`- kb/${f.otherFeatId}.md:\\n {6}rel: dives\\.feat\\n`), "a link to no dive stays");
	assert.match(readFileSync(f.path(ids.landed), "utf8"), new RegExp(`meta:\\n  feat: ${f.featId}\\n  diver: null\\n---`), "outcome goes, the rest of meta stays");
	assert.match(readFileSync(f.path(ids.bailed), "utf8"), new RegExp(`meta:\\n  feat: ${f.featId}\\n---`));
	assert.deepEqual(out, ["legacy-dives-restored: 5 dives linked by state again, 3 docs rewritten"]);

	const hero = findBridge(f.hero)!;
	const links = diveLinks(hero as never);
	for (const [state, id] of Object.entries(ids)) assert.equal(links.get(id)?.state, state);
	assert.deepEqual(openDives(hero as never).map(({ doc }) => String(doc.fm.id)).sort(), [ids.jumped, ids.packed, ids.planned].sort(), "the loop finds the open ones");

	assert.deepEqual(restore(f.hero, ctxOf(out)), [], "run again, it finds nothing to change");
});

test("a hero whose dives legacy-dives never converted is left as it is, as is one that wears work", () => {
	const fresh = fixture("legacy-dives-restored-fresh");
	const dive = mintUuid();
	writeFileSync(fresh.path(dive), `---\nkind: dive\nid: ${dive}\nname: ideas.open\ngist: "Open"\n---\n\n# Open\n`);
	fresh.link(fresh.featId, dive, "rel: jumped.dive");
	const before = readFileSync(fresh.path(fresh.featId), "utf8");
	const out: string[] = [];
	assert.deepEqual(restore(fresh.hero, ctxOf(out)), []);
	assert.equal(readFileSync(fresh.path(fresh.featId), "utf8"), before);
	assert.deepEqual(out, [], "it says nothing");

	const working = fixture("legacy-dives-restored-work");
	const workRepo = "01a15ba8-0bff-7ce3-83dc-e08af3633e26";
	writeFileSync(join(working.hero, ".nosedive", "repos", `${workRepo}.md`), `---\nkind: repo\nid: ${workRepo}\nname: nosedive-work\ngist: "Work"\nmeta:\n  trunk: main\n---\n\n# nosedive-work\n`);
	working.link(working.heroId, workRepo, "rel: .cape");
	convertedHero(working);
	const feat = readFileSync(working.path(working.featId), "utf8");
	assert.deepEqual(restore(working.hero, ctxOf(out)), [], "work's loop reads dives.feat");
	assert.equal(readFileSync(working.path(working.featId), "utf8"), feat);
});

test("the retired legacy-dives and this one together leave a fresh legacy hero's dives as they are", () => {
	const f = fixture("legacy-dives-restored-chain");
	const dive = mintUuid();
	writeFileSync(f.path(dive), `---\nkind: dive\nid: ${dive}\nname: ideas.open\ngist: "Open"\nmeta:\n  effort: ideas\n---\n\n# Open\n`);
	f.link(f.featId, dive, "rel: packed.dive");
	const before = [f.featId, dive].map((id) => readFileSync(f.path(id), "utf8"));
	assert.deepEqual([...legacyDives(f.hero, ctxOf([])), ...restore(f.hero, ctxOf([]))], []);
	assert.deepEqual([f.featId, dive].map((id) => readFileSync(f.path(id), "utf8")), before);
});
