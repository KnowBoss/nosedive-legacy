// dive-on-deck
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { test } from "node:test";
import { i01a1335485c67c95b7efdf2f0e03cfd6 as findBridge } from "nosedive-core";
import { digestOf, featNameOf, type KindMeta } from "nosedive-core";
import { i01a1c72ba0a67a64836f167c23ffa097 as diveOnDeck, LEGACY_ID, RENDER_SENTINELS, diveBranch, dropRenderSentinels, diveLinks, diverOf, featIdOf, heroDoc, isDive, isWip, moveLinks, openDives, parseDiveBranch, tokenOf, wip, readScopes, scopesWith } from "./i01a1c72ba0a67a64836f167c23ffa097.ts";
import { i0e2024913efd5dc8afe194f5650bda20 as jump } from "./i0e2024913efd5dc8afe194f5650bda20.ts";
import { i01a1335482f876d6808aec457f512e80 as readKbDoc } from "nosedive-core";
import { i01a18e8044c97daeb0498ee7ad07bf43 as canonicalKinds } from "nosedive-core";
import { i01a19eb470547ce5935e03ab6c97a715 as listNext } from "nosedive-core";
import { i5f74ee87748f528b9fd9b00a48c2275b as pack } from "./i5f74ee87748f528b9fd9b00a48c2275b.ts";
import { i3b8461aa9eac5f10837c2515b5231e78 as land } from "./i3b8461aa9eac5f10837c2515b5231e78.ts";
import { ia159fdc01ac85e4f831dc1c523787ce6 as bail } from "./ia159fdc01ac85e4f831dc1c523787ce6.ts";
import { declareDiveKind, loopFixture as fixture, git, tempDir } from "../test/harness.ts";

test("refuses off a dive branch, then gives the dive the hero's branch names, its home, its feat and each scope, and refuses any other", async () => {
	const f = fixture("dive-on-deck");
	const hero = findBridge(f.hero)!;
	assert.throws(() => diveOnDeck(hero, f.ctx), /the hero is on no dive branch, so no dive is on deck: `nosedive jump <feat or dive>` picks one up/);
	await jump({ ref: f.featId }, f.ctx);
	const dive = diveOnDeck(hero, f.ctx);
	assert.equal(dive.doc.fm.id, f.onDeck());
	assert.equal(dive.home, "main");
	assert.equal(dive.branch, diveBranch(tokenOf(hero, "main"), f.onDeck()));
	assert.equal(dive.feat?.fm.id, f.featId);
	assert.deepEqual(
		dive.scopes.map(({ repoId, name, trunk, branch, ours }) => ({ repoId, name, trunk, branch, ours })),
		[{ repoId: f.repoId, name: "data", trunk: "main", branch: "work/ideas", ours: true }],
	);
	assert.equal(diveOnDeck(hero, f.ctx, f.onDeck()).doc.fm.id, f.onDeck());
	assert.throws(() => diveOnDeck(hero, f.ctx, f.featId), new RegExp(`the dive on deck is [0-9a-f]{6}\\.ideas \\(${f.onDeck()}\\), not ${f.featId}`));

	// A copy of the dive branch is another branch: the diver's token is the home's, which no other home shares.
	git(f.hero, "branch", "-m", "main", "renamed");
	assert.throws(() => diveOnDeck(hero, f.ctx), /dive [0-9a-f]{6}\.ideas's home, the branch it was jumped from, is gone: recreate it/);
	git(f.hero, "branch", "-m", "renamed", "main");
});

test("work refs change independently of canonical schema versions and foreign dive names stay foreign", async () => {
	const f = fixture("canonical-scopes");
	await jump({ ref: f.featId }, f.ctx);
	const hero = findBridge(f.hero)!;
	const doc = heroDoc(hero, f.onDeck())!;
	const owner = LEGACY_ID;
	assert.equal(isDive(doc), true);
	const schema = digestOf(f.ctx.capes[1]!.kinds.dive as KindMeta);
	assert.match(schema, /^[0-9a-f]{12}$/);
	const canonical = { [owner]: { canonical: true, version: f.schemaVersion, schema } };
	assert.deepEqual((doc.fm.scopes as unknown[]).find((entry) => typeof entry === "object" && entry !== null && owner in entry), canonical);
	assert.deepEqual(readScopes(hero, doc).map((scope) => scope.repoId), [f.repoId]);
	const next = scopesWith(hero, doc, new Map([[f.repoId, "new-work-ref"], [hero.id!, "new-hero-ref"]]));
	assert.deepEqual(next.find((entry) => typeof entry === "object" && entry !== null && owner in entry), canonical);
	assert.deepEqual(next.find((entry) => typeof entry === "object" && entry !== null && f.repoId in entry), { [f.repoId]: { "work-branch": "work/ideas", ref: "new-work-ref" } });
	assert.equal(isDive({ ...doc, fm: { ...doc.fm, scopes: [] } }), true, "a dive naming no owner is legacy's, as legacy nosedive wrote them");
	assert.equal(isDive({ ...doc, fm: { ...doc.fm, scopes: [{ [f.heroId]: { canonical: true, version: f.schemaVersion } }] } }), false, "a dive of a kind the hero owns is not");
	assert.equal(isDive({ ...doc, fm: { ...doc.fm, scopes: [{ "01a15bb1-da9e-7d2d-aa82-5ee97257adc6": { canonical: true } }] } }), false, "nor is work's");
});

test("a dive as legacy nosedive wrote it hangs by its state link: found from the docs that link it, over by landed or bailed, its feat from meta.feat, meta.effort or the linking doc", () => {
	const f = fixture("dive-links");
	const hero = findBridge(f.hero)!;
	const [planned, old, bare, over, both, other] = [f.legacyDive(), f.legacyDive({ meta: ["effort: ideas", "diver: null"] }), f.legacyDive({ meta: ["diver: null"] }), f.legacyDive({ state: "bailed" }), f.legacyDive({ state: "jumped" }), f.legacyDive({ from: f.heroId })];
	// A second doc linking a dive too: the strongest state stands, and both docs hold the link.
	f.linkFrom(f.heroId, both, "packed.dive");
	const links = diveLinks(hero);
	assert.deepEqual(Object.fromEntries([...links].map(([id, { state }]) => [id, state])), { [planned]: "planned", [old]: "planned", [bare]: "planned", [over]: "bailed", [both]: "packed", [other]: "planned" });
	assert.deepEqual(links.get(both)!.by.map((doc) => doc.fm.id).sort(), [f.featId, f.heroId].sort());
	assert.deepEqual(openDives(hero).map(({ doc }) => doc.fm.id).sort(), [planned, old, bare, both, other].sort(), "a bailed dive is not open");
	assert.deepEqual(openDives(hero).find(({ doc }) => doc.fm.id === both)?.hung.state, "packed");
	assert.equal(links.get(other)!.by[0]!.fm.id, f.heroId, "linked by a doc that is no feat");
	const featOf = (id: string) => featIdOf(hero, heroDoc(hero, id)!, links.get(id)!.by);
	assert.equal(featOf(planned), f.featId, "meta.feat");
	assert.equal(featOf(old), f.featId, "meta.effort, by name");
	assert.equal(featOf(bare), f.featId, "the doc that links it, nothing written to the dive");
	assert.equal(featOf(other), f.featId, "meta.feat before the doc that links it");
	assert.equal(isDive(heroDoc(hero, planned)!), true, "kind dive, no canonical scope");
});

test("a dive's state link is moved by its state, on every doc that holds one, its other attributes kept", () => {
	const f = fixture("dive-links-move");
	const hero = findBridge(f.hero)!;
	const id = f.legacyDive({ state: "planned" });
	f.linkFrom(f.heroId, id, "planned.dive");
	const hung = diveLinks(hero).get(id)!;
	assert.deepEqual(moveLinks(hung, id, "packed").map((doc) => doc.fm.id).sort(), [f.featId, f.heroId].sort());
	assert.equal(f.relOf(f.featId, id), "packed.dive");
	assert.equal(f.relOf(f.heroId, id), "packed.dive");
	assert.deepEqual(moveLinks(diveLinks(hero).get(id)!, id, "packed"), [], "already there: nothing rewritten");
});

test("a legacy feat naming a read-only repo by its bare quid is still read", () => {
	const f = fixture("legacy-scope", { readOnly: true });
	const feat = heroDoc(findBridge(f.hero)!, f.featId)!;
	assert.deepEqual(feat.fm.scopes, [f.repoId]);
	assert.equal(isDive(feat), false);
	assert.deepEqual(readScopes(findBridge(f.hero)!, feat), [{ repoId: f.repoId }]);
});

test("a dive's diver is <email>#<token>, the token a digest of the checkout's path, its home and the email, which its branch carries", async () => {
	const f = fixture("dive-holder");
	const hero = findBridge(f.hero)!;
	assert.match(diverOf(hero, "main"), /^diver@example\.com#[0-9a-f]{12}$/);
	assert.notEqual(tokenOf(hero, "main"), tokenOf(hero, "other"), "another branch, another token");
	await jump({ ref: f.featId }, f.ctx);
	assert.deepEqual(openDives(hero).map(({ doc }) => doc.fm.id), [f.onDeck()]);
	assert.equal(parseDiveBranch(git(f.hero, "symbolic-ref", "--short", "HEAD"))?.token, tokenOf(hero, "main"));
	assert.match(f.doc(f.onDeck()), new RegExp(`\n {2}diver: ${diverOf(hero, "main").replace(/[.]/g, "\\.")}\n`));
});

test("core reads a dive as a feat only through a .feat link, so a state link leaves a commit on the dive branch ungrouped (the loop's own records name their dive)", async () => {
	const f = fixture("dive-holder-feat");
	await jump({ ref: f.featId }, f.ctx);
	assert.equal(featNameOf(findBridge(f.hero)!, []), undefined);
	assert.match(git(f.hero, "log", "-1", "--format=%s", "HEAD"), new RegExp(`^jump\\(${f.onDeck().slice(-6)}\\.ideas\\)`), "the loop's records carry the dive's name themselves");
});

test("a dive's work in progress is told by its name, in the subject pack writes now, or either it wrote before", async () => {
	const f = fixture("dive-wip");
	const hero = findBridge(f.hero)!;
	await jump({ ref: f.featId }, f.ctx);
	const dive = diveOnDeck(hero, f.ctx).doc;
	const name = String(dive.fm.name);
	assert.equal(isWip(dive, wip(dive)), true, "as pack names it");
	assert.equal(wip(dive), `pack(${name}): work in progress`);
	assert.equal(isWip(dive, `feat(ideas): pack work in progress on ${name}`), true, "as pack named it while feats grouped the loop's commits");
	assert.equal(isWip(dive, `feat(renamed): pack work in progress on ${name}`), true, "whatever the feat is called");
	assert.equal(isWip(dive, `pack: work in progress on ${name}`), true, "with no feat to name");
	assert.equal(isWip(dive, "feat(ideas): pack work in progress on ideas.other1"), false, "another dive's");
	assert.equal(isWip(dive, "pack(ideas.other1): work in progress"), false, "legacy, another dive's");
	assert.equal(isWip(dive, "add idea.md"), false);
});

const NEXT_USAGE = "ubc5113a84ba55195add71cac33f0bf20";
const DIVE_STATES = ["planned", "jumped", "packed", "landed", "bailed"] as const;
const legacyEntry = (doc: { fm: Record<string, unknown> }) => (doc.fm.scopes as Record<string, unknown>[] | undefined)?.find((entry) => LEGACY_ID in entry);

test("a hero wearing legacy, its dives as legacy nosedive wrote them: seeding gives each legacy's canonical entry and nothing else, next lists each under its linking doc in every state, and the loop still moves it", async () => {
	const f = fixture("dives-listed");
	declareDiveKind(f);
	const written = DIVE_STATES.map((state) => f.legacyDive({ state }));
	const stamped = f.plan(); // one that carries the entry already, as jump and crud mint them
	const snapshot = (id: string) => {
		const { fm, body } = readKbDoc(f.doc(id));
		return { fm: { ...fm, scopes: (fm.scopes as unknown[]).filter((entry) => !(entry && typeof entry === "object" && LEGACY_ID in entry)) }, body };
	};
	const before = new Map([...written, stamped].map((id) => [id, snapshot(id)]));
	for (const id of written) assert.equal(legacyEntry(readKbDoc(f.doc(id))), undefined, "as legacy nosedive wrote it, no entry");

	// The migration core's seed runs, called as it is: the dives are of a kind a worn cape declares.
	const said: string[] = [];
	const changed = canonicalKinds(f.hero, { capes: f.ctx.capes, out: (text) => void said.push(text) });
	assert.notEqual(changed, undefined, said.join("\n"));
	const pin = { canonical: true, version: f.schemaVersion, schema: digestOf(f.ctx.capes[1]!.kinds.dive as KindMeta) };
	for (const id of written) assert.deepEqual(legacyEntry(readKbDoc(f.doc(id))), { [LEGACY_ID]: pin }, `${id} carries legacy's entry`);
	assert.deepEqual(legacyEntry(readKbDoc(f.doc(stamped))), { [LEGACY_ID]: { canonical: true } }, "one that had an entry is left as it was");
	for (const id of [...written, stamped]) assert.deepEqual(snapshot(id), before.get(id), `${id} is otherwise as it was`);
	git(f.hero, "add", "-A");
	git(f.hero, "commit", "-qm", "migrate: canonical-kinds");
	git(f.hero, "push", "-q", "origin", "HEAD:main");

	const out: string[] = [];
	await listNext({ usage: NEXT_USAGE, args: {}, ctx: { ...f.ctx, out: (text) => void out.push(text) } });
	const listed = out.join("\n").split("\n");
	const featAt = listed.findIndex((line) => line.startsWith("ideas  "));
	assert.notEqual(featAt, -1, out.join("\n"));
	const under = listed.slice(featAt + 1, listed.findIndex((line, at) => at > featAt && !line.startsWith("  ")));
	for (const id of [...written, stamped]) assert.equal(under.filter((line) => line.includes(`${id}.md`) && /^ {2}nosedive-legacy:dive /.test(line)).length, 1, `next lists ${id} under its feat`);

	// The loop, on a dive that was stamped: jumped, packed, jumped again and landed.
	const id = written[0]!;
	await jump({ ref: id }, f.ctx);
	assert.equal(f.onDeck(), id);
	assert.deepEqual(legacyEntry(readKbDoc(f.doc(id))), { [LEGACY_ID]: pin }, "jump keeps the entry");
	const work = f.commit("idea.md", "an idea\n");
	await pack({}, f.ctx);
	assert.equal(f.relOf(f.featId, id), "packed.dive");
	assert.deepEqual(legacyEntry(readKbDoc(f.doc(id))), { [LEGACY_ID]: pin }, "pack keeps it");
	await jump({ ref: id }, f.ctx);
	assert.equal(git(f.checkout, "rev-parse", "HEAD"), work);
	await land({}, f.ctx);
	assert.equal(f.relOf(f.featId, id), "landed.dive");
	assert.deepEqual(legacyEntry(readKbDoc(f.doc(id))), { [LEGACY_ID]: pin }, "land keeps it");
});

import { createHash } from "node:crypto";
import { mkdirSync, mkdtempSync, readFileSync, rmSync, symlinkSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { unzipSync, zipSync } from "fflate";
import { removeRebuildable, stageOrphans, swapIgnored } from "./i01a1c72ba0a67a64836f167c23ffa097.ts";

test("restoring a pack never overwrites a file the destination tracks", async () => {
	const f = fixture("swap-tracked");
	await jump({ ref: f.featId }, f.ctx);
	const hero = findBridge(f.hero)!;
	const pack = join(f.hero, ".nosedive", "local", "packs", f.featId, "data.zip");
	mkdirSync(dirname(pack), { recursive: true });
	writeFileSync(pack, zipSync({ "README.md": new TextEncoder().encode("from the pack\n"), "keep.local": new TextEncoder().encode("restored\n") }));
	swapIgnored(hero, f.featId, { name: "data", dir: f.checkout });
	assert.equal(readFileSync(join(f.checkout, "README.md"), "utf8"), "data\n", "the tracked file is the tree's");
	assert.equal(readFileSync(join(f.checkout, "keep.local"), "utf8"), "restored\n", "an ignored entry comes back");
});

test("restoring a pack keeps an existing untracked file aside from the pack entry", async () => {
	const f = fixture("swap-untracked");
	await jump({ ref: f.featId }, f.ctx);
	const hero = findBridge(f.hero)!;
	const pack = join(f.hero, ".nosedive", "local", "packs", f.featId, "data.zip");
	mkdirSync(dirname(pack), { recursive: true });
	writeFileSync(pack, zipSync({ "keep.local": new TextEncoder().encode("from the pack\n") }));
	writeFileSync(join(f.checkout, ".gitignore"), "keep.local\n");
	writeFileSync(join(f.checkout, "keep.local"), "untracked work\n");
	writeFileSync(join(f.checkout, ".gitignore"), "", "utf8"); // The destination tree dropped the source branch's ignore rule.
	const orphaned = swapIgnored(hero, f.featId, { name: "data", dir: f.checkout });
	assert.equal(readFileSync(join(f.checkout, "keep.local"), "utf8"), "untracked work\n");
	assert.ok(orphaned, "the blocked pack entry is archived and reported");
	assert.equal(new TextDecoder().decode(unzipSync(new Uint8Array(readFileSync(orphaned)))["keep.local"]), "from the pack\n");
});

test("restoring a pack never follows a symlink and keeps the blocked entry aside", async () => {
	const f = fixture("swap-symlink");
	await jump({ ref: f.featId }, f.ctx);
	const hero = findBridge(f.hero)!;
	const pack = join(f.hero, ".nosedive", "local", "packs", f.featId, "data.zip");
	mkdirSync(dirname(pack), { recursive: true });
	writeFileSync(pack, zipSync({ "keep.local": new TextEncoder().encode("from the pack\n") }));
	const target = join(f.hero, "outside");
	mkdirSync(target);
	writeFileSync(join(target, "work.txt"), "outside work\n");
	symlinkSync(target, join(f.checkout, "keep.local"), "junction");
	const orphaned = swapIgnored(hero, f.featId, { name: "data", dir: f.checkout });
	assert.equal(readFileSync(join(target, "work.txt"), "utf8"), "outside work\n");
	assert.ok(orphaned, "the blocked pack entry is archived and reported");
});

test("rebuildable cleanup deletes only the staged bytes and preserves a replacement at the live path", () => {
	const f = fixture("rebuildable-stage");
	mkdirSync(f.checkout, { recursive: true });
	const path = join(f.checkout, "generated.js");
	const staged = join(mkdtempSync(join(f.checkout, ".stage-")), "generated.js");
	writeFileSync(path, "generated before\n");
	const digest = createHash("sha256").update(readFileSync(path)).digest("hex");
	assert.equal(removeRebuildable(path, staged, digest, () => writeFileSync(path, "new work\n")), true);
	assert.equal(readFileSync(path, "utf8"), "new work\n");
});

test("orphan cleanup archives the staged bytes and preserves a replacement at the live path", () => {
	const f = fixture("orphan-stage");
	mkdirSync(f.checkout, { recursive: true });
	const path = join(f.checkout, "ignored.local");
	const staging = mkdtempSync(join(f.checkout, ".stage-"));
	writeFileSync(path, "ignored before\n");
	const staged = stageOrphans(f.checkout, ["ignored.local"], staging, () => writeFileSync(path, "new work\n"));
	assert.equal(new TextDecoder().decode(staged["ignored.local"]), "ignored before\n");
	rmSync(staging, { recursive: true });
	assert.equal(readFileSync(path, "utf8"), "new work\n");
});

const LAND_ONLY = "nosedive-render-587d3f73-2534-5179-b111-ce6c83d6814d";
const READ_ONLY = "nosedive-render-c4e93002-2925-58bd-9b70-d917017a9fc7";

/** A checkout as legacy nosedive left it: worktree config on, the checkout marked non-bare there, and `pushurl` written there. */
function blockPush(dir: string, pushurl: string): void {
	git(dir, "config", "extensions.worktreeConfig", "true");
	git(dir, "config", "--worktree", "core.bare", "false");
	git(dir, "config", "--worktree", "--replace-all", "remote.origin.pushurl", pushurl);
}

const pushurls = (dir: string) => spawnSync("git", ["config", "--show-scope", "--get-all", "remote.origin.pushurl"], { cwd: dir, encoding: "utf8" }).stdout.trim();

test("drops each render sentinel legacy nosedive wrote to a checkout's worktree config, saying one line, and leaves any other pushurl", () => {
	assert.deepEqual(Object.values(RENDER_SENTINELS).sort(), ["land-only", "read-only"]);
	const make = (label: string, pushurl: string) => {
		const dir = tempDir(label);
		git(dir, "init", "-q", "-b", "main");
		git(dir, "remote", "add", "origin", "https://example.com/data.git");
		blockPush(dir, pushurl);
		return dir;
	};
	for (const [sentinel, what] of [[LAND_ONLY, "land-only"], [READ_ONLY, "read-only"]] as const) {
		const dir = make(what, sentinel);
		const said: string[] = [];
		dropRenderSentinels([{ name: "data", dir }], (line) => void said.push(line));
		assert.deepEqual(said, [`data: removed legacy nosedive's ${what} pushurl (${sentinel}) from its worktree config`]);
		assert.equal(pushurls(dir), "", "the sentinel is gone");
		assert.equal(git(dir, "config", "--worktree", "--get", "core.bare"), "false", "the rest of the worktree config is kept");
		dropRenderSentinels([{ name: "data", dir }], (line) => void said.push(line));
		assert.equal(said.length, 1, "a checkout with none says nothing");
	}

	const own = make("own", "git@example.com:mine/data.git");
	git(own, "config", "remote.origin.pushurl", LAND_ONLY);
	const said: string[] = [];
	dropRenderSentinels([{ name: "data", dir: own }, { name: "gone", dir: join(own, "missing") }], (line) => void said.push(line));
	assert.deepEqual(said, [], "another pushurl, and a sentinel outside worktree config, are left");
	assert.equal(pushurls(own), `local\t${LAND_ONLY}\nworktree\tgit@example.com:mine/data.git`);
});

test("jump, pack, bail and land drop a render sentinel from a scope's checkout before they push, so a checkout legacy nosedive left still lands", async () => {
	const f = fixture("render-sentinels");
	await jump({ ref: f.featId }, f.ctx);
	const id = f.onDeck();
	const committed = f.commit("idea.md", "an idea\n");
	blockPush(f.checkout, LAND_ONLY);
	await pack({}, f.ctx);
	assert.ok(f.err.includes(`data: removed legacy nosedive's land-only pushurl (${LAND_ONLY}) from its worktree config`));
	assert.equal(f.remoteRef(`refs/nosedive/${f.heroId}/dives/${id}`), committed, "pack pushed the work to origin");

	// A reused checkout: jump drops it, though nothing would push until land.
	blockPush(f.checkout, READ_ONLY);
	await jump({ ref: id }, f.ctx);
	assert.ok(f.err.includes(`data: removed legacy nosedive's read-only pushurl (${READ_ONLY}) from its worktree config`));
	assert.equal(pushurls(f.checkout), "");

	blockPush(f.checkout, LAND_ONLY);
	await land({}, f.ctx);
	assert.equal(pushurls(f.checkout), "");
	assert.equal(f.remoteRef("refs/heads/work/ideas"), git(f.checkout, "rev-parse", "HEAD"), "land pushed the work branch");

	const g = fixture("render-sentinels-bail");
	await jump({ ref: g.featId }, g.ctx);
	g.commit("idea.md", "an idea\n");
	blockPush(g.checkout, READ_ONLY);
	await bail({ reason: "a test" }, g.ctx);
	assert.equal(pushurls(g.checkout), "");
	assert.ok(g.err.includes(`data: removed legacy nosedive's read-only pushurl (${READ_ONLY}) from its worktree config`));
});
