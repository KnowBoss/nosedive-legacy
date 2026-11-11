// dive-on-deck
import assert from "node:assert/strict";
import { test } from "node:test";
import { i01a1335485c67c95b7efdf2f0e03cfd6 as findBridge } from "nosedive-core";
import { digestOf, featNameOf, type KindMeta } from "nosedive-core";
import { i01a1c72ba0a67a64836f167c23ffa097 as diveOnDeck, LEGACY_ID, diveBranch, diveLinks, diverOf, featIdOf, heroDoc, isDive, isWip, moveLinks, openDives, parseDiveBranch, tokenOf, wip, readScopes, scopesWith } from "./i01a1c72ba0a67a64836f167c23ffa097.ts";
import { i0e2024913efd5dc8afe194f5650bda20 as jump } from "./i0e2024913efd5dc8afe194f5650bda20.ts";
import { loopFixture as fixture, git } from "../test/harness.ts";

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
