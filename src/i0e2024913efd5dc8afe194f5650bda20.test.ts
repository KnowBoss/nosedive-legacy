// jump [<ref>]
import assert from "node:assert/strict";
import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { test } from "node:test";
import { i0e2024913efd5dc8afe194f5650bda20 as jump } from "./i0e2024913efd5dc8afe194f5650bda20.ts";
import { i5f74ee87748f528b9fd9b00a48c2275b as pack } from "./i5f74ee87748f528b9fd9b00a48c2275b.ts";
import { i3b8461aa9eac5f10837c2515b5231e78 as land } from "./i3b8461aa9eac5f10837c2515b5231e78.ts";
import { ia159fdc01ac85e4f831dc1c523787ce6 as bail } from "./ia159fdc01ac85e4f831dc1c523787ce6.ts";
import { i01a1335480c776ba8945020d0af333eb as mintUuid } from "nosedive-core";
import { i01a1335482f876d6808aec457f512e80 as readKbDoc } from "nosedive-core";
import { loopFixture as fixture, git } from "../test/harness.ts";
import { i01a1335485c67c95b7efdf2f0e03cfd6 as findBridge } from "nosedive-core";
import { LEGACY_ID, diveBranch, tokenOf } from "./i01a1c72ba0a67a64836f167c23ffa097.ts";

/** The dive branch a dive jumped from the hero's main has. */
const branchOf = (f: ReturnType<typeof fixture>, id: string) => diveBranch(tokenOf(findBridge(f.hero)!, "main"), id);
/** What jump ends with, naming the dive's brief (jump-starts-the-work). */
const nudge = (brief: string) => `Now do the dive's work, from its brief, ${brief}, to its feat's Done when; pack or land it only when the pilot asks.`;

test("a feat the root reaches gets a dive with its scopes, naming the feat and linked from it as jumped.dive, the hero and its scope on its dive branch, held by this checkout, its bookkeeping on the home it was jumped from", async () => {
	const f = fixture("jump-feat");
	await jump({ ref: f.featId }, f.ctx);
	const id = f.onDeck();
	const dive = f.doc(id);
	const trunk = git(f.remote, "rev-parse", "main");
	assert.match(dive, new RegExp(`^---\\nkind: dive\\nid: ${id}\\nname: ${id.slice(-6)}\\.ideas\\n`));
	assert.match(dive, new RegExp(`scopes:\\n {2}- ${f.repoId}:\\n {6}work-branch: work/ideas\\n`));
	assert.match(dive, new RegExp(`\\nmeta:\\n {2}feat: ${f.featId}\\n {2}diver: diver@example\\.com#[0-9a-f]{12}\\n`));
	assert.doesNotMatch(dive, /\nlinks:/, "a dive links nothing back");
	assert.match(dive, /\n## \d{4}-\d\d-\d\dT[\d:.]+Z jumped\n\ndiver@example\.com picked it up\.\n\n- data: workspace\/data on \w+, working work\/ideas\n$/);
	assert.match(f.doc(f.featId), new RegExp(`- kb/${id}\\.md:\\n {6}rel: jumped\\.dive\\n`));
	assert.doesNotMatch(f.doc(id) + f.doc(f.featId), /dives\.feat|outcome/, "no dives.feat link, no outcome");
	assert.equal(git(f.checkout, "symbolic-ref", "--short", "HEAD"), branchOf(f, id), "the scope on the dive branch");
	assert.equal(git(f.hero, "symbolic-ref", "--short", "HEAD"), branchOf(f, id), "and the hero");
	assert.equal(git(f.hero, "rev-parse", "main"), git(f.hero, "rev-parse", "HEAD"), "cut from its home after the jump record");
	assert.equal(git(f.checkout, "rev-parse", "HEAD"), trunk, "with no work branch yet, it starts at trunk");
	assert.match(git(f.hero, "log", "-1", "--format=%s"), /^jump\([0-9a-f]{6}\.ideas\): diver@example\.com picked it up$/, "the command first, then the dive it acted on");
	assert.equal(git(f.hero, "log", "-1", "--format=%(trailers:only,unfold)"), "Co-Authored-By: nosedive test <noreply@nosedive.dev>", "which says nosedive made it, once");
	assert.equal(git(f.hero, "status", "--porcelain"), "", "the feat's link rides the same commit");
	assert.equal(git(f.hero, "rev-parse", "HEAD"), git(f.hero, "ls-remote", "origin", "refs/heads/main").split("\t")[0], "the bookkeeping pushed to the home's upstream");
	assert.deepEqual(f.out.slice(-4), [`dive  kb/${id}.md`, `feat  kb/${f.featId}.md`, "data  workspace/data", nudge(`kb/${f.featId}.md`)], "the feat its brief, as it was jumped bare");
});

test("jump's usage, which --help --more prints, says what it does with uncommitted changes and that it ends with the nudge", () => {
	const body = readFileSync(new URL("../kb/01a1c72b-a06b-7cfd-9e5f-710dc60e4a37.md", import.meta.url), "utf8");
	const usage = /(?:^|\n)## Usage\n([\s\S]*?)(?=\n## |$)/.exec(body)![1]!;
	assert.match(usage, /off a dive branch, an unclean hero tree is refused \(jump-needs-clean-tree\)/);
	assert.match(usage, /a scope checkout jump would move that has uncommitted changes or untracked files is refused, each named, before anything moves/);
	assert.match(usage, /A checkout already where the dive wants it, as on a dive branch, is left as it is/);
	assert.match(usage, /pack's work-in-progress commit on this dive is undone, so packed work comes back uncommitted/);
	assert.match(usage, /to do the dive's work now, from its brief to its feat's Done when, and to pack or land it only when the pilot asks/);
});

test("the whole loop runs on a hero that wears legacy and not work: jump a feat, pack, jump again and land, then jump and bail a planned dive", async () => {
	const f = fixture("loop-legacy-alone");
	assert.deepEqual(f.ctx.capes.map((cape) => cape.id), ["01a1336b-c0b8-7cde-b7c6-285196062297", LEGACY_ID], "core and legacy, no work");
	await jump({ ref: f.featId }, f.ctx);
	const id = f.onDeck();
	assert.match(f.doc(id), new RegExp(`\\n {2}- ${LEGACY_ID}:\\n {6}canonical: true\\n {6}version: ${f.schemaVersion}\\n`), "a dive of legacy's kind, pinned");
	const work = f.commit("idea.md", "an idea\n");
	await pack({}, f.ctx);
	assert.equal(git(f.hero, "symbolic-ref", "--short", "HEAD"), "main", "packed, the hero home");
	await jump({ ref: id }, f.ctx);
	assert.equal(f.onDeck(), id);
	assert.equal(git(f.checkout, "rev-parse", "HEAD"), work, "its work back");
	await land({}, f.ctx);
	assert.equal(f.relOf(f.featId, id), "landed.dive", "the feat's link says how it ended");
	assert.doesNotMatch(f.doc(id), /outcome/);
	assert.equal(git(f.remote, "log", "-1", "--format=%s", "work/ideas"), "add idea.md", "its work on its feat's branch");
	const planned = f.plan("Try another way");
	assert.equal(f.relOf(f.featId, planned), "planned.dive");
	await jump({ ref: planned }, f.ctx);
	assert.equal(f.relOf(f.featId, planned), "jumped.dive");
	await bail({ reason: "a dead end" }, f.ctx);
	assert.equal(f.relOf(f.featId, planned), "bailed.dive");
	assert.doesNotMatch(f.doc(planned), /outcome/);
	assert.equal(git(f.hero, "symbolic-ref", "--short", "HEAD"), "main", "bailed, the hero home");
});

test("a dive named feat first, as dives were before names went hex first, is jumped by its quid and keeps its name, and every jump ends with the nudge naming its brief", async () => {
	const f = fixture("jump-old-name");
	const id = f.plan();
	const old = `ideas.${id.slice(-6)}`;
	await jump({ ref: id }, f.ctx);
	assert.equal(f.onDeck(), id);
	assert.match(f.doc(id), new RegExp(`\\nname: ${old.replace(".", "\\.")}\\n`), "its name kept");
	assert.equal(git(f.hero, "log", "-1", "--format=%s"), `jump(${old}): diver@example.com picked it up`);
	assert.equal(f.out.at(-1), nudge(`kb/${id}.md`), "a planned dive its own brief");

	f.out.length = 0;
	await jump({}, f.ctx);
	assert.equal(f.out.at(-1), nudge(`kb/${id}.md`), "on its branch too");

	writeFileSync(join(f.checkout, "draft.md"), "draft\n");
	await pack({}, f.ctx);
	f.out.length = 0;
	await jump({ ref: `kb/${id}.md` }, f.ctx);
	assert.equal(git(f.checkout, "status", "--porcelain"), "?? draft.md", "its old-named work in progress undone");
	assert.equal(f.out.at(-1), nudge(`kb/${id}.md`), "and resumed");
});

test("takes a doc's path as next prints it, a feat's or a dive's, for its quid (listed-paths-accepted)", async () => {
	const f = fixture("jump-listed-path");
	await jump({ ref: `kb/${f.featId}.md` }, f.ctx);
	const id = f.onDeck();
	await pack({}, f.ctx);
	await jump({ ref: `kb\\${id.toUpperCase()}.md` }, f.ctx);
	assert.equal(f.onDeck(), id, "the dive by its Windows path, in any case");
	await pack({}, f.ctx);
	await assert.rejects(jump({ ref: "kb/nope.md" }, f.ctx), /no doc kb\/nope\.md in the hero/);
});

test("a hero with a branch named nosedive still gets its dive branch, which is one segment", async () => {
	const f = fixture("jump-nosedive-branch");
	git(f.hero, "branch", "nosedive");
	await jump({ ref: f.featId }, f.ctx);
	const id = f.onDeck();
	assert.match(branchOf(f, id), new RegExp(`^nosedive-[0-9a-f]{12}-${id}$`));
	assert.equal(git(f.hero, "symbolic-ref", "--short", "HEAD"), branchOf(f, id));
	assert.equal(git(f.checkout, "symbolic-ref", "--short", "HEAD"), branchOf(f, id));
});

test("refuses a second dive while on a dive branch or holding one, a doc that is neither feat nor dive, and a dive another checkout holds; jumping the dive on deck again records nothing", async () => {
	const f = fixture("jump-refusals");
	await assert.rejects(jump({ ref: f.repoId }, f.ctx), /data is no feat: nothing reaches it from a root of the hero through a .feat link; link it from a feat first/);
	await jump({ ref: f.featId }, f.ctx);
	const id = f.onDeck();
	await assert.rejects(jump({ ref: f.featId, sure: true }, f.ctx), new RegExp(`the hero is on dive ${id.slice(-6)}\\.ideas \\(${id}\\)'s branch: pack, land or bail it first`));

	// Off its dive branch, the checkout still holds it: only that dive can be jumped.
	git(f.hero, "switch", "-q", "main");
	await assert.rejects(jump({ ref: f.featId, sure: true }, f.ctx), new RegExp(`this checkout has dive branch ${branchOf(f, id).replace(/\//g, "\\/")}: switch to it, then pack, land or bail it first`));
	await jump({ ref: id }, f.ctx);
	assert.equal(git(f.hero, "symbolic-ref", "--short", "HEAD"), branchOf(f, id), "back onto it");

	const other = join(f.hero, "..", "other-checkout");
	git(f.hero, "worktree", "add", "-q", "-b", "other", other, "main");
	git(other, "branch", "-q", "-u", "origin/main");
	await assert.rejects(jump({ ref: id }, { ...f.ctx, cwd: other }), new RegExp(`dive ${id.slice(-6)}\\.ideas is held by diver@example\\.com in another checkout of the hero: pack it there \\(held-by-checkout\\)`));
	git(f.hero, "config", "user.email", "other@example.com");
	await assert.rejects(jump({ ref: id }, { ...f.ctx, cwd: other }), new RegExp(`dive ${id.slice(-6)}\\.ideas is held by diver@example\\.com \\(held-by-checkout\\)$`));
	git(f.hero, "config", "user.email", "diver@example.com");

	const before = git(f.hero, "rev-parse", "HEAD");
	writeFileSync(join(f.checkout, "draft.md"), "mine\n");
	await jump({}, f.ctx);
	assert.equal(git(f.hero, "rev-parse", "HEAD"), before, "nothing recorded");
	assert.equal(git(f.checkout, "status", "--porcelain"), "?? draft.md", "its checkout is the diver's to change");
});

for (const outcome of ["landed", "bailed"] as const) {
	test(`a ${outcome} dive is refused on every path, before anything changes: by its quid, as a leftover branch's dive, and on that branch`, async () => {
		const f = fixture(`jump-over-${outcome}`);
		await jump({ ref: f.featId }, f.ctx);
		const id = f.onDeck();
		const branch = branchOf(f, id);
		f.commit("idea.md", "an idea\n");
		if (outcome === "landed") await land({}, f.ctx);
		else await bail({ reason: "a test" }, f.ctx);
		const over = `dive ${id.slice(-6)}\\.ideas is over: it ${outcome}`;
		await assert.rejects(jump({ ref: id }, f.ctx), new RegExp(`${over}$`), "named by its quid, no branch left");

		const leave = new RegExp(`${over}; to leave its branch, switch to its home, main, the branch it was jumped from, and delete ${branch}$`);
		const refusedAsWas = async (args: { ref?: string }) => {
			const on = git(f.hero, "symbolic-ref", "--short", "HEAD");
			const tip = git(f.hero, "rev-parse", branch);
			const scope = git(f.checkout, "rev-parse", "HEAD");
			await assert.rejects(jump(args, f.ctx), leave);
			assert.equal(git(f.hero, "symbolic-ref", "--short", "HEAD"), on, "the hero's branch unchanged");
			assert.equal(git(f.hero, "rev-parse", branch), tip, "the leftover branch where it was");
			assert.equal(git(f.checkout, "rev-parse", "HEAD"), scope, "the scope checkout where it was");
		};
		git(f.hero, "branch", "-q", branch, "HEAD");
		await refusedAsWas({ ref: id });
		git(f.hero, "switch", "-q", branch);
		await refusedAsWas({});
	});
}

test("a dive minted from another clone sharing the home's upstream is found once fetched, and refused as held there; a dirty hero is refused before anything", async () => {
	const f = fixture("jump-stale");
	const other = join(f.hero, "..", "other-clone");
	git(f.hero, "clone", "-q", git(f.hero, "remote", "get-url", "origin"), other);
	git(other, "config", "user.name", "Work Test");
	git(other, "config", "user.email", "diver@example.com");
	await jump({ ref: f.featId }, { ...f.ctx, cwd: other });
	// The dive is the doc jump's bookkeeping added beside the feat.
	const id = git(other, "diff", "--name-only", "HEAD^", "HEAD").split("\n").map((path) => /([0-9a-f-]{36})\.md$/.exec(path)?.[1]).find((each) => each && each !== f.featId)!;

	writeFileSync(join(f.hero, "scratch.md"), "mine\n");
	await assert.rejects(jump({ ref: id }, f.ctx), /the hero has uncommitted changes, and jump switches its branch: commit them first \(jump-needs-clean-tree\)/);
	git(f.hero, "clean", "-qf");
	await assert.rejects(jump({ ref: id }, f.ctx), new RegExp(`dive ${id.slice(-6)}\\.ideas is held by diver@example\\.com in another checkout of the hero: pack it there`));
	assert.equal(git(f.hero, "rev-parse", "main"), git(other, "rev-parse", "main"), "main fast-forwarded to the other clone's record");
});

test("without a ref, takes the one dive waiting for the pilot, and refuses when none is", async () => {
	const f = fixture("jump-bare");
	await assert.rejects(jump({}, f.ctx), /^Error: no dive waits for you here: `nosedive jump <feat or dive>` names one$/, "no dive is open, and none is named");
	await jump({ ref: f.featId }, f.ctx);
	const id = f.onDeck();
	await pack({}, f.ctx);
	await jump({}, f.ctx);
	assert.equal(f.onDeck(), id);
});

test("a bare jump that finds several waiting, or none, names every open dive with its state, core's next listing none of them", async () => {
	const f = fixture("jump-bare-several");
	const mine = [`feat: ${f.featId}`, "diver: null", "packer: diver@example.com"];
	const theirs = [`feat: ${f.featId}`, "diver: null", "packer: someone@example.com"];
	const [planned, packed, away, held] = [f.legacyDive(), f.legacyDive({ state: "packed", meta: mine }), f.legacyDive({ state: "packed", meta: theirs }), f.legacyDive({ state: "jumped", meta: [`feat: ${f.featId}`, "diver: someone@example.com#0123456789ab"] })];
	const over = f.legacyDive({ state: "landed", meta: [`feat: ${f.featId}`] });
	await assert.rejects(jump({}, f.ctx), (error: Error) => {
		assert.match(error.message, /^2 dives wait for you, so name one:\n/);
		assert.match(error.message, new RegExp(`ideas\\.${planned.slice(-6)} \\(${planned}\\): planned\\n`));
		assert.match(error.message, new RegExp(`ideas\\.${packed.slice(-6)} \\(${packed}\\): packed, packed by diver@example\\.com$`));
		assert.doesNotMatch(error.message, new RegExp(`${away}|${held}|${over}`), "what another packed or holds, or is over, does not wait");
		return true;
	});

	// With nothing waiting for this checkout, every open dive is named, the one held elsewhere and the one packed by another among them.
	git(f.hero, "config", "user.email", "third@example.com");
	for (const id of [planned, packed]) {
		const path = join(f.hero, "kb", `${id}.md`);
		writeFileSync(path, readFileSync(path, "utf8").replace(/\nmeta:\n[^]*?---/, `\nmeta:\n  feat: ${f.featId}\n  diver: null\n  packer: someone@example.com\n---`));
	}
	git(f.hero, "commit", "-qam", "packed by someone else");
	git(f.hero, "push", "-q");
	await assert.rejects(jump({}, f.ctx), (error: Error) => {
		assert.match(error.message, /^no dive waits for you here: `nosedive jump <feat or dive>` names one; the hero's open dives:\n/);
		for (const id of [planned, packed, away]) assert.match(error.message, new RegExp(`\\(${id}\\): ${id === planned ? "planned" : "packed"}, packed by someone@example\\.com`));
		assert.match(error.message, new RegExp(`\\(${held}\\): jumped, held by someone@example\\.com`));
		assert.doesNotMatch(error.message, new RegExp(over), "a dive that is over is not open");
		return true;
	});
});

test("a dive written by legacy nosedive is jumped, packed, jumped again and landed, its meta read as it was and its feat's link moved at each step", async () => {
	const f = fixture("legacy-shape-loop");
	// As record.dive wrote it before `meta.feat`: the feat named by `effort`, and a key of the pilot's own.
	const id = f.legacyDive({ meta: ["effort: ideas", "priority: follow-up", "diver: null"] });
	const meta = () => readKbDoc(f.doc(id)).fm.meta as Record<string, unknown>;
	const { effort, priority } = meta();
	const linksBefore = f.doc(f.featId);
	assert.equal(f.relOf(f.featId, id), "planned.dive");

	await jump({}, f.ctx);
	assert.equal(f.onDeck(), id, "found by its planned.dive link, with no ref");
	assert.equal(f.relOf(f.featId, id), "jumped.dive");
	assert.deepEqual(meta(), { effort, priority, diver: `diver@example.com#${tokenOf(findBridge(f.hero)!, "main")}` }, "its own meta untouched, a feat not made up for it");
	assert.match(f.doc(id), new RegExp(`scopes:\\n {2}- ${f.repoId}:\\n {6}work-branch: work/ideas\\n`), "its scope as legacy wrote it, its pin gone while the dive has no ref");
	assert.doesNotMatch(f.doc(id), /canonical/, "no kind pin written to it");
	assert.equal(git(f.checkout, "symbolic-ref", "--short", "HEAD"), branchOf(f, id));

	const work = f.commit("idea.md", "an idea\n");
	await pack({}, f.ctx);
	assert.equal(f.relOf(f.featId, id), "packed.dive");
	assert.deepEqual(meta(), { effort, priority, packer: "diver@example.com" });
	assert.equal(f.remoteRef(`refs/nosedive/${f.heroId}/dives/${id}`), work);

	await jump({}, f.ctx);
	assert.equal(f.onDeck(), id);
	assert.equal(f.relOf(f.featId, id), "jumped.dive");
	assert.deepEqual(Object.keys(meta()).sort(), ["diver", "effort", "priority"], "the packer cleared");
	assert.equal(git(f.checkout, "rev-parse", "HEAD"), work);

	await land({}, f.ctx);
	assert.equal(f.relOf(f.featId, id), "landed.dive");
	assert.deepEqual(meta(), { effort, priority });
	assert.equal(git(f.remote, "log", "-1", "--format=%(trailers:key=Nosedive-Feat,valueonly)", "work/ideas"), f.featId, "the feat effort names, found from the dive");
	assert.doesNotMatch(f.doc(id) + f.doc(f.featId), /dives\.feat|outcome/);
	assert.equal(f.doc(f.featId).replace(/rel: landed\.dive/, "rel: planned.dive"), linksBefore, "only the link's rel moved in the feat");
	assert.throws(() => f.onDeck());
	await assert.rejects(jump({ ref: id }, f.ctx), /is over: it landed$/);
});

test("a dive written by legacy nosedive is bailed, its link moved to bailed.dive and its meta kept; one with no feat named takes the doc that links it", async () => {
	const f = fixture("legacy-shape-bail");
	const note = ["feat: " + f.featId, "diver: null", "note: kept"];
	const id = f.legacyDive({ state: "jumped", meta: note });
	await jump({ ref: id }, f.ctx);
	assert.equal(f.relOf(f.featId, id), "jumped.dive", "a jumped one, its diver null: picked up again");
	f.commit("idea.md", "an idea\n");
	await bail({ reason: "a dead end" }, f.ctx);
	assert.equal(f.relOf(f.featId, id), "bailed.dive");
	assert.deepEqual((readKbDoc(f.doc(id)).fm.meta as Record<string, unknown>), { feat: f.featId, note: "kept" });
	assert.equal(f.remoteRef(`refs/nosedive/${f.heroId}/dives/${id}`) !== "", true, "what it held is kept");

	const bare = f.legacyDive({ state: "planned", meta: ["diver: null"] });
	await jump({ ref: bare }, f.ctx);
	f.commit("more.md", "more\n");
	await land({}, f.ctx);
	assert.equal(f.relOf(f.featId, bare), "landed.dive");
	assert.equal(git(f.remote, "log", "-1", "--format=%(trailers:key=Nosedive-Feat,valueonly)", "work/ideas"), f.featId, "the feat is the doc that links it");
	assert.equal(readKbDoc(f.doc(bare)).fm.meta, undefined, "a meta emptied is dropped");
});

test("a dive that a doc other than its feat links, as an effort or a bug may, is found and moved on that doc", async () => {
	const f = fixture("legacy-shape-linker");
	const id = f.legacyDive({ from: f.heroId, meta: [`feat: ${f.featId}`, "diver: null"] });
	await jump({}, f.ctx);
	assert.equal(f.relOf(f.heroId, id), "jumped.dive");
	await pack({}, f.ctx);
	assert.equal(f.relOf(f.heroId, id), "packed.dive");
	assert.equal(f.relOf(f.featId, id), undefined, "the feat never linked it");
});

test("jump refuses a bare attempt at a feat that links any dive by a state link, naming each and its state", async () => {
	const f = fixture("legacy-shape-feat");
	const [open, over] = [f.legacyDive(), f.legacyDive({ state: "bailed" })];
	await assert.rejects(jump({ ref: f.featId, sure: true }, f.ctx), (error: Error) => {
		assert.match(error.message, /ideas has 2 dives on it \(kb\/\S+\.md \(planned\), kb\/\S+\.md \(bailed\)\), so a bare jump would start it over, --sure or not/);
		assert.ok(error.message.includes(`kb/${open}.md (planned)`) && error.message.includes(`kb/${over}.md (bailed)`));
		return true;
	});
});

test("picks packed work up on its work branch's new tip", async () => {
	const f = fixture("jump-rebase");
	await jump({ ref: f.featId }, f.ctx);
	const id = f.onDeck();
	f.commit("idea.md", "mine\n");
	await pack({}, f.ctx);

	// Someone else lands on the work branch meanwhile.
	const other = join(f.hero, "..", "other");
	git(f.hero, "clone", "-q", f.remote, other);
	writeFileSync(join(other, "theirs.md"), "theirs\n");
	git(other, "add", "-A");
	git(other, "-c", "user.name=O", "-c", "user.email=o@example.com", "commit", "-q", "-m", "theirs");
	git(other, "push", "-q", "origin", "HEAD:refs/heads/work/ideas");
	const tip = git(other, "rev-parse", "HEAD");

	await jump({ ref: id }, f.ctx);
	assert.equal(git(f.checkout, "rev-parse", "HEAD^"), tip, "the work sits on the branch's tip");
	assert.equal(git(f.checkout, "log", "-1", "--format=%s"), "add idea.md");
	assert.match(f.doc(id), /, working work\/ideas; rebased onto work\/ideas\n$/);
});

test("replays the dive's hero work on its bookkeeping, and refuses while the home holds commits its upstream lacks", async () => {
	const f = fixture("jump-hero");
	await jump({ ref: f.featId }, f.ctx);
	const id = f.onDeck();
	writeFileSync(join(f.hero, "kb", "note.md"), "a note\n");
	git(f.hero, "add", "-A");
	git(f.hero, "commit", "-q", "-m", "a note");
	writeFileSync(join(f.hero, "kb", "draft.md"), "half\n");
	await pack({}, f.ctx);
	assert.equal(existsSync(join(f.hero, "kb", "note.md")), false, "the hero is back home");
	assert.equal(git(f.hero, "symbolic-ref", "--short", "HEAD"), "main");

	await jump({ ref: id }, f.ctx);
	assert.equal(git(f.hero, "log", "-1", "--format=%s"), "a note");
	assert.match(git(f.hero, "log", "-1", "--format=%s", "HEAD^"), /^jump\([0-9a-f]{6}\.ideas\): diver@example\.com picked it up$/);
	assert.equal(git(f.hero, "status", "--porcelain"), "?? kb/draft.md", "uncommitted again");
	assert.match(f.doc(id), /\n- hero: 2 commits replayed\n$/);

	git(f.hero, "add", "-A");
	git(f.hero, "commit", "-q", "-m", "a draft");
	await land({}, f.ctx);
	git(f.hero, "commit", "-q", "--allow-empty", "-m", "stray");
	await assert.rejects(jump({ ref: f.featId, sure: true }, f.ctx), /main holds 1 commit origin\/main lacks: push it first/);
});

test("moves a checkout left from other work, keeping commits origin lacks on an orphan ref, and refuses one with uncommitted changes", async () => {
	const f = fixture("jump-orphan");
	await jump({ ref: f.featId }, f.ctx);
	f.commit("idea.md", "an idea\n");
	await land({}, f.ctx);
	const stray = f.commit("stray.md", "stray\n");

	writeFileSync(join(f.checkout, "draft.md"), "draft\n");
	await assert.rejects(jump({ ref: f.featId }, f.ctx), /ideas has a dive on it \(\S+ \(landed\)\), so a bare jump would start it over/);
	const planned = f.plan();
	await assert.rejects(jump({ ref: planned }, f.ctx), /jump would lose work, so nothing moved:\n {2}workspace\/data has uncommitted changes or untracked files/);
	git(f.checkout, "clean", "-qf");

	await jump({ ref: planned }, f.ctx);
	const id = f.onDeck();
	assert.equal(id, planned);
	assert.equal(f.remoteRef(`refs/nosedive/${f.heroId}/orphans/${stray}`), stray);
	assert.equal(git(f.checkout, "symbolic-ref", "--short", "HEAD"), branchOf(f, id));
	assert.equal(git(f.checkout, "rev-parse", "HEAD"), f.remoteRef("refs/heads/work/ideas"), "a feat's dives stack on its work branch");
	assert.match(f.doc(id), new RegExp(`; its 1 commit origin lacked kept on refs/nosedive/${f.heroId}/orphans/${stray}\\n$`));
});

test("a feat under a hero's second root gets its dive in that root's directory, and packs and jumps again", async () => {
	const f = fixture("jump-roots", { roots: true });
	await jump({ ref: f.featId }, f.ctx);
	const id = f.onDeck();
	assert.match(f.doc(id), /^---\nkind: dive\n/, "minted beside its feat in ./docs");
	assert.match(f.doc(f.featId), new RegExp(`- docs/${id}\\.md:\\n {6}rel: jumped\\.dive\\n`));
	await pack({}, f.ctx);
	await jump({ ref: id }, f.ctx);
	assert.equal(f.onDeck(), id);
	assert.equal(git(f.hero, "status", "--porcelain"), "");
});

test("pack, jump and land preserve the canonical version while work refs keep their lease meaning", async () => {
	const f = fixture("canonical-loop");
	await jump({ ref: f.featId }, f.ctx);
	const id = f.onDeck();
	const versionLine = `      version: ${f.schemaVersion}`;
	assert.ok(f.doc(id).includes(versionLine));
	const commit = f.commit("work.txt", "one\n");
	await pack({}, f.ctx);
	assert.ok(f.doc(id).includes(versionLine));
	assert.match(f.doc(id), new RegExp(`ref: ${commit}`));
	await jump({ ref: id }, f.ctx);
	assert.ok(f.doc(id).includes(versionLine));
	assert.match(f.doc(id), new RegExp(`ref: ${commit}`));
	await land({}, f.ctx);
	assert.ok(f.doc(id).includes(versionLine), "land never rewrites a schema version");
});

test("a meta entry beside the canonical one survives jump, pack and land untouched while work scopes still work", async () => {
	const f = fixture("meta-scope");
	await jump({ ref: f.featId }, f.ctx);
	const id = f.onDeck();
	const meta = `  - ${mintUuid()}:\n      version: 0123abc\n      schema: 0123456789ab\n      meta:\n        note: kept\n`;
	writeFileSync(join(f.hero, "kb", `${id}.md`), f.doc(id).replace("\nscopes:\n", `\nscopes:\n${meta}`));
	git(f.hero, "commit", "-qam", "meta entry");
	git(f.hero, "push", "-q", "origin", "HEAD:main");
	const canonical = `      canonical: true\n      version: ${f.schemaVersion}\n`;
	const intact = () => {
		assert.ok(f.doc(id).includes(meta), "the meta entry is carried as it was");
		assert.ok(f.doc(id).includes(canonical), "the canonical entry is carried as it was");
	};
	intact();
	const commit = f.commit("work.txt", "one\n");
	await pack({}, f.ctx);
	intact();
	assert.match(f.doc(id), new RegExp(`ref: ${commit}`));
	await jump({ ref: id }, f.ctx);
	intact();
	assert.equal(git(f.checkout, "rev-parse", "HEAD"), commit);
	await land({}, f.ctx);
	intact();
});

test("an unpublished dive schema refuses before jump moves a scope", async () => {
	const f = fixture("unpublished-dive");
	newSchema(f);
	await assert.rejects(jump({ ref: f.featId }, f.ctx), /land|push/);
	assert.equal(existsSync(f.checkout), false);
});

test("a dive schema on the feat's work branch is accepted and pinned", async () => {
	const f = fixture("work-branch-dive");
	const version = newSchema(f);
	git(f.schemaRepo, "push", "-q", "origin", "HEAD:refs/heads/work/ideas");
	await jump({ ref: f.featId }, f.ctx);
	assert.ok(f.doc(f.onDeck()).includes(`      version: ${version}\n`));
	assert.match(f.doc(f.onDeck()), /\n {6}schema: [0-9a-f]{12}\n/);
});

/** Commits a change to the dive schema's repo that origin's trunk lacks, and makes it the kind's version. */
function newSchema(f: ReturnType<typeof fixture>): string {
	writeFileSync(join(f.schemaRepo, "schema.txt"), "new schema\n");
	git(f.schemaRepo, "add", "schema.txt");
	git(f.schemaRepo, "commit", "-q", "-m", "new schema");
	const version = git(f.schemaRepo, "rev-parse", "HEAD");
	(f.ctx.capes[1]!.kinds.dive as { version: string }).version = version;
	return version;
}

test("refuses a home with no upstream, so no record is stranded in a local branch", async () => {
	const f = fixture("jump-upstream");
	git(f.hero, "switch", "-q", "-c", "local-only");
	await assert.rejects(jump({ ref: f.featId }, f.ctx), /local-only has no upstream, so the dive's records would be stranded here: push it first, as `git push -u origin local-only`$/);
	assert.equal(git(f.hero, "symbolic-ref", "--short", "HEAD"), "local-only", "nothing moved");
});

test("a dive jumped from a pushed branch keeps every record and its hero work there, trunk untouched, and the loop returns to it", async () => {
	const f = fixture("jump-home");
	const trunk = git(f.hero, "rev-parse", "origin/main");
	git(f.hero, "switch", "-q", "-c", "spec");
	writeFileSync(join(f.hero, "SPEC.md"), "the spec\n");
	git(f.hero, "add", "SPEC.md");
	git(f.hero, "commit", "-q", "-m", "spec");
	git(f.hero, "push", "-q", "-u", "origin", "spec");
	await jump({ ref: f.featId }, f.ctx);
	const id = f.onDeck();
	assert.equal(git(f.hero, "ls-remote", "origin", "refs/heads/main").split("\t")[0], trunk, "trunk on origin never moved");
	assert.match(git(f.hero, "log", "-1", "--format=%s", "origin/spec"), /^jump\([0-9a-f]{6}\.ideas\)/, "the record is on the home's upstream");
	writeFileSync(join(f.hero, "NOTE.md"), "hero work\n");
	git(f.hero, "add", "NOTE.md");
	git(f.hero, "commit", "-q", "-m", "hero note");
	await pack({}, f.ctx);
	assert.equal(git(f.hero, "symbolic-ref", "--short", "HEAD"), "spec", "back home");
	assert.equal(git(f.hero, "log", "--format=%s", "spec").includes("hero note"), false, "the work waits on the dive's ref");
	await jump({ ref: id }, f.ctx);
	assert.equal(git(f.hero, "log", "-1", "--format=%s"), "hero note", "replayed on the dive branch");
	await land({}, f.ctx);
	assert.equal(git(f.hero, "symbolic-ref", "--short", "HEAD"), "spec");
	assert.deepEqual(git(f.hero, "log", "-3", "--format=%s", "origin/spec").split("\n").map((line) => line.split(":")[0]), [`land(${id.slice(-6)}.ideas)`, "hero note", `jump(${id.slice(-6)}.ideas)`], "the hero's work bookended on the home's upstream");
	assert.equal(git(f.hero, "ls-remote", "origin", "refs/heads/main").split("\t")[0], trunk, "and still not on trunk");
});

test("a dive this checkout holds whose branch is gone is jumped again without a record, its packed hero work replayed; on its branch, a jump sets a lost scope checkout up again", async () => {
	const f = fixture("jump-lost");
	await jump({ ref: f.featId }, f.ctx);
	const id = f.onDeck();
	const work = f.commit("idea.md", "an idea\n");
	git(f.checkout, "push", "-q", "origin", `HEAD:refs/heads/work/ideas`);

	// The scope checkout lost: jumping the dive on deck puts it back, the dive branch's commit kept.
	const cache = git(f.checkout, "rev-parse", "--git-common-dir");
	git(cache, "worktree", "remove", "--force", f.checkout);
	const records = git(f.hero, "rev-list", "--count", "HEAD");
	await jump({}, f.ctx);
	assert.equal(git(f.hero, "rev-list", "--count", "HEAD"), records, "nothing recorded");
	assert.equal(git(f.checkout, "rev-parse", "HEAD"), work, "the scope back at the dive's work");

	// The hero's dive branch lost: jumping the dive cuts it again from home.
	const branch = git(f.hero, "symbolic-ref", "--short", "HEAD");
	git(f.hero, "switch", "-q", "main");
	git(f.hero, "branch", "-q", "-D", branch);
	const before = git(f.hero, "rev-parse", "main");
	await jump({ ref: id }, f.ctx);
	assert.equal(git(f.hero, "symbolic-ref", "--short", "HEAD"), branch, "on its branch again");
	assert.equal(git(f.hero, "rev-parse", "main"), before, "no record");
});

test("a dive legacy left held by a bare email is taken over by a checkout of that email, and refused to anyone else (legacy-bare-diver)", async () => {
	const f = fixture("jump-bare-diver");
	await jump({ ref: f.featId }, f.ctx);
	const id = f.onDeck();
	await pack({}, f.ctx);
	const path = join(f.hero, "kb", `${id}.md`);
	const bare = (email: string) => {
		const text = f.doc(id).replace(/\n  packer: [^\n]+\n/, "\n").replace(/\n  diver: [^\n]*\n/, "\n");
		assert.ok(text.includes("\nmeta:\n"), "the packed dive has meta");
		writeFileSync(path, text.replace("\nmeta:\n", `\nmeta:\n  diver: ${email}\n`));
		git(f.hero, "commit", "-qam", `legacy diver ${email}`);
		git(f.hero, "push", "-q");
	};
	bare("someone@example.com");
	await assert.rejects(jump({ ref: id }, f.ctx), /is held by someone@example\.com, in no checkout in particular: only a checkout whose git user\.email is someone@example\.com can take it over \(legacy-bare-diver\)/);
	bare("diver@example.com");
	await jump({ ref: id }, f.ctx);
	assert.equal(f.onDeck(), id);
	assert.match(f.doc(id), /\n  diver: diver@example\.com#[0-9a-f]{12}\n/);
});

test("a dive that still has patch links is warned of on stderr from them, after the paths and before the nudge, whatever its sections say; a dive with none is not", async () => {
	const f = fixture("jump-migrated");
	const over = f.legacyDive();
	const pushed = f.legacyDive();
	// A chain of two patches, and a chain whose head memo is gone.
	const [first, second, gone] = [mintUuid(), mintUuid(), mintUuid()];
	for (const [id, file] of [[first, "a"], [second, "b"]] as const) {
		writeFileSync(join(f.hero, "kb", `${id}.md`), `---\nkind: memo\nid: ${id}\nname: ${file}.data\ngist: "Patch"\nmeta:\n  patch: kb/artifacts/${file}.patch\n---\n\n# Patch\n`);
	}
	f.linkFrom(first, second, "next");
	f.linkFrom(over, first, "patch");
	f.linkFrom(over, gone, "patch");
	// Its section says nothing of what was passed over, and has no `passed over` line, as one of an older migration might: the links are what is read.
	const path = join(f.hero, "kb", `${pushed}.md`);
	writeFileSync(path, `${readFileSync(path, "utf8")}\n## 2026-11-12T10:00:00.000Z migrated\n\n- data: passed over: a patch no longer applies: patch failed; its work needs patching by hand on jump, from kb/artifacts/z.patch\n`);
	git(f.hero, "add", "-A");
	git(f.hero, "commit", "-q", "-m", "patch links");
	git(f.hero, "push", "-q", "origin", "HEAD:main");

	await jump({ ref: pushed }, f.ctx);
	assert.deepEqual(f.err, [], "pushed work needs nothing said");
	await pack({}, f.ctx);

	f.out.length = 0;
	await jump({ ref: over }, f.ctx);
	const by = "apply it by hand, then remove the dive's patch links";
	assert.deepEqual(f.err, [
		`warning: work legacy-patches passed over is left in kb/artifacts/a.patch, kb/artifacts/b.patch; ${by}`,
		`warning: work legacy-patches passed over is left in no patch file, and its chain breaks at memo ${gone}, so its later patches are not known; ${by}`,
	]);
	assert.equal(f.out.at(-1), nudge(`kb/${over}.md`), "the nudge stays last");
	assert.ok(f.out.some((line) => line.startsWith("dive  ")), "after the paths");
});
