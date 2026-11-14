// land [<dive>]
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { test } from "node:test";
import { i0e2024913efd5dc8afe194f5650bda20 as jump } from "./i0e2024913efd5dc8afe194f5650bda20.ts";
import { i5f74ee87748f528b9fd9b00a48c2275b as pack } from "./i5f74ee87748f528b9fd9b00a48c2275b.ts";
import { i3b8461aa9eac5f10837c2515b5231e78 as land } from "./i3b8461aa9eac5f10837c2515b5231e78.ts";
import { loopFixture as fixture, git, mintUuid } from "../test/harness.ts";

const nosedive = "Co-Authored-By: nosedive test <noreply@nosedive.dev>";

test("stamps and pushes the work to its feat's branch and the hero's to its home between its jump and land records, deletes the dive's refs and branches, leaves the checkout detached and the hero home, and ends the dive", async () => {
	const f = fixture("land");
	await jump({ ref: f.featId }, f.ctx);
	const id = f.onDeck();
	for (const [file, trailer] of [["old.md", "Co-Authored-By: nosedive 0.0.1 <noreply@nosedive.dev>"], ["ann.md", "Co-Authored-By: Ann <ann@example.com>"]]) {
		writeFileSync(join(f.checkout, file), "x\n");
		git(f.checkout, "add", "-A");
		git(f.checkout, "commit", "-q", "-m", `add ${file}\n\n${trailer}`);
	}
	f.commit("idea.md", "an idea\n");
	const author = git(f.checkout, "log", "-1", "--format=%an %ae %aI");
	writeFileSync(join(f.hero, "kb", "note.md"), "a note\n");
	git(f.hero, "add", "-A");
	git(f.hero, "commit", "-q", "-m", "a note");
	await pack({}, f.ctx);
	git(f.remote, "update-ref", `refs/nosedive/dives/${f.heroId}/main/${id}`, git(f.checkout, "rev-parse", "HEAD"));
	assert.match(git(f.hero, "log", "-1", "--format=%s"), /^pack\([0-9a-f]{6}\.ideas\): diver@example\.com put it down$/);
	assert.equal(git(f.hero, "log", "-1", "--format=%(trailers:only,unfold)"), nosedive, "pack's record says nosedive made it");
	await jump({ ref: id }, f.ctx);

	await land({}, f.ctx);
	const head = git(f.checkout, "rev-parse", "HEAD");
	assert.equal(f.remoteRef("refs/heads/work/ideas"), head);
	const trailers = `Nosedive-Dive: ${id}\nNosedive-Feat: ${f.featId}\n${nosedive}`;
	assert.equal(git(f.checkout, "log", "-1", "--format=%(trailers:only,unfold)"), trailers);
	assert.equal(git(f.checkout, "log", "-1", "--format=%(trailers:only,unfold)", "HEAD~2"), `Co-Authored-By: nosedive 0.0.1 <noreply@nosedive.dev>\nNosedive-Dive: ${id}\nNosedive-Feat: ${f.featId}`, "a commit that has a nosedive co-author gets no second");
	assert.equal(git(f.checkout, "log", "-1", "--format=%(trailers:only,unfold)", "HEAD~1"), `Co-Authored-By: Ann <ann@example.com>\n${trailers}`, "another's does not stand in for it");
	assert.match(git(f.hero, "log", "-1", "--format=%s"), /^land\([0-9a-f]{6}\.ideas\): diver@example\.com landed it$/);
	assert.equal(git(f.hero, "log", "-1", "--format=%(trailers:only,unfold)"), nosedive);
	assert.equal(git(f.checkout, "log", "-1", "--format=%s"), "add idea.md");
	assert.equal(git(f.checkout, "log", "-1", "--format=%an %ae %aI"), author, "the same author");
	assert.equal(git(f.remote, "for-each-ref", "refs/nosedive"), "", "the dive's refs are gone, under its old name too");
	assert.equal(git(f.hero, "ls-remote", "origin", `refs/nosedive/${f.heroId}/dives/*`), "", "the hero's too");
	const trunk = git(f.hero, "ls-remote", "origin", "refs/heads/main").split("\t")[0];
	assert.equal(git(f.hero, "rev-parse", "HEAD"), trunk, "the hero's work and record are on trunk");
	assert.equal(git(f.hero, "log", "-1", "--format=%(trailers:only,unfold)", "HEAD^"), trailers, "the hero's work is stamped too");
	assert.match(git(f.hero, "log", "-1", "--format=%s", "HEAD~2"), /^jump\([0-9a-f]{6}\.ideas\): /, "bookended by the jump and land records");
	assert.equal(git(f.hero, "symbolic-ref", "--short", "HEAD"), "main", "the hero back home");
	assert.equal(git(f.hero, "branch", "--list", `nosedive-*-${id}`), "", "its dive branch gone");
	assert.match(f.doc(id), new RegExp(`\\nmeta:\\n {2}feat: [0-9a-f-]{36}\\n---[^]*\\n## \\d{4}-\\d\\d-\\d\\dT[\\d:.]+Z landed\\n\\ndiver@example\\.com landed it\\.\\n\\n- data: pushed ${head.slice(0, 7)} to work/ideas\\n- hero: 1 commit onto main\\n$`));
	assert.doesNotMatch(f.doc(id), /Land report/, "a dive with no gates lands with no report");
	assert.doesNotMatch(f.doc(id), /ref:/, "its refs are gone, so is their record");
	assert.doesNotMatch(f.doc(id), /outcome/, "how it ended is its feat's link, not its meta");
	assert.equal(f.relOf(f.featId, id), "landed.dive");
	assert.equal(spawnSync("git", ["symbolic-ref", "-q", "HEAD"], { cwd: f.checkout }).status, 1, "detached");
	assert.equal(git(f.checkout, "branch", "--list", `*/${id}`), "", "its branch is gone");

	await jump({ ref: f.plan() }, f.ctx);
	assert.equal(git(f.checkout, "rev-parse", "HEAD"), head, "a feat's dives stack on its branch");
});

test("refuses uncommitted changes, and a branch that moved past the work", async () => {
	const f = fixture("land-refusals");
	await jump({ ref: f.featId }, f.ctx);
	f.commit("idea.md", "an idea\n");
	writeFileSync(join(f.checkout, "draft.md"), "draft\n");
	await assert.rejects(land({}, f.ctx), /nothing was landed:\n {2}workspace\/data has uncommitted changes: commit them first/);
	git(f.checkout, "clean", "-qf");

	const other = join(f.hero, "..", "other");
	git(f.hero, "clone", "-q", f.remote, other);
	git(other, "-c", "user.name=O", "-c", "user.email=o@example.com", "commit", "-q", "--allow-empty", "-m", "theirs");
	git(other, "push", "-q", "origin", "HEAD:refs/heads/work/ideas");
	await assert.rejects(land({}, f.ctx), new RegExp(`work/ideas in data has moved to \\w{7}, which this dive's work does not contain: pack, then jump ${f.onDeck()}`));
	assert.equal(f.remoteRef("refs/heads/work/ideas"), git(other, "rev-parse", "HEAD"));
});

type Loop = ReturnType<typeof fixture>;

/** A gate doc and its script, on disk and uncommitted: the script logs its name, then runs `body` as run(ctx). Returns its id. */
function gate(f: Loop, name: string, body = "", options: { script?: boolean } = {}): string {
	const id = mintUuid();
	const script = `kb/artifacts/${id}.mjs`;
	mkdirSync(join(f.hero, "kb", "artifacts"), { recursive: true });
	writeFileSync(join(f.hero, script), `import { appendFileSync } from "node:fs";\nexport async function run(ctx) {\nappendFileSync(ctx.bridgeRoot + "/../order.log", "${name}\\n");\n${body}\n}\n`);
	const meta = options.script === false ? "" : `meta:\n  test-script: ${script}\n`;
	writeFileSync(join(f.hero, "kb", `${id}.md`), `---\nkind: memo\nid: ${id}\nname: ${name}\ngist: "${name}"\n${meta}---\n\n# ${name}\n`);
	return id;
}

/** Adds a link from the doc at `file` to a gate. */
function declare(file: string, to: string, attrs: string): void {
	const text = readFileSync(file, "utf8");
	const entry = `  - kb/${to}.md:\n${attrs.split(", ").map((attr) => `      ${attr}\n`).join("")}`;
	writeFileSync(file, /\nlinks:\n/.test(text) ? text.replace(/\nlinks:\n/, `\nlinks:\n${entry}`) : text.replace(/\n---\n\n#/, `\nlinks:\n${entry}---\n\n#`));
}

const commitAll = (f: Loop, message: string) => {
	git(f.hero, "add", "-A");
	git(f.hero, "commit", "-q", "-m", message);
};
const order = (f: Loop) => (existsSync(join(f.hero, "..", "order.log")) ? readFileSync(join(f.hero, "..", "order.log"), "utf8").trim().split("\n") : []);

test("runs the land.gates of the dive, its repos, its feat and the feats it reaches, tallest first, before pushing, and reports each above the outcome", async () => {
	const f = fixture("land-gates");
	await jump({ ref: f.featId }, f.ctx);
	const id = f.onDeck();
	f.commit("idea.md", "an idea\n");
	const [onDive, onRepo, onFeat, onRoot, shared, plain, notLand] = ["on-dive", "on-repo", "on-feat", "on-root", "shared", "plain", "not-land"].map((name) => gate(f, name, name === "on-root" ? `console.error("shaky stderr"); return false;` : ""));
	const dive = join(f.hero, "kb", `${id}.md`);
	declare(dive, onDive, "rel: land.gate, gate-height: 5");
	declare(dive, shared, "rel: land.gate, gate-height: 1");
	declare(dive, notLand, "rel: test.gate, gate-height: 99");
	declare(join(f.hero, ".nosedive", "repos", `${f.repoId}.md`), onRepo, "rel: land.gate, gate-height: 5");
	declare(join(f.hero, "kb", `${f.featId}.md`), shared, "rel: land.gate, gate-height: 10");
	declare(join(f.hero, "kb", `${f.featId}.md`), plain, "rel: land.gate");
	declare(join(f.hero, "kb", `${f.featId}.md`), onFeat, "rel: land.gate, gate-height: 3");
	// The root is reached from the feat along its work.feat link.
	declare(join(f.hero, "kb", `${f.heroId}.md`), onRoot, "rel: land.gate, gate-height: 2, test-is-flaky: true");
	commitAll(f, "gates");

	await land({}, f.ctx);
	assert.deepEqual(order(f), ["on-dive", "on-repo", "on-feat", "on-root", "shared", "plain"], "tallest first, ties as found, a gate reached twice at its first link's height");
	assert.equal(f.remoteRef("refs/heads/work/ideas"), git(f.checkout, "rev-parse", "HEAD"), "a flaky failure does not block");
	const doc = f.doc(id);
	assert.match(doc, new RegExp(`\\n## Land report \\d{4}-\\d\\d-\\d\\dT[\\d:.]+Z\\n\\n- \\[on-dive\\]\\(${onDive}\\.md\\): passed in \\d+ms\\n- \\[on-repo\\]`));
	assert.match(doc, /\[on-root\]\([^)]*\): failed \(flaky, a warning\) in \d+ms\n\n {2}script: kb\/artifacts\/[^\n]*\.mjs\n\n {2}```\n {2}shaky stderr\n {2}```\n/);
	assert.doesNotMatch(doc, /not-land/);
	assert.ok(doc.indexOf("## Land report") < doc.indexOf(" landed\n"), "the report stands above the outcome");
});

test("one blocking failure pushes nothing, leaves the dive held and reports the failing gate's script and stderr", async () => {
	const f = fixture("land-gate-fails");
	await jump({ ref: f.featId }, f.ctx);
	const id = f.onDeck();
	f.commit("idea.md", "an idea\n");
	const [good, bad] = [gate(f, "good"), gate(f, "bad", `console.error("it broke"); throw new Error("bad news");`)];
	declare(join(f.hero, "kb", `${id}.md`), good, "rel: land.gate, gate-height: 2");
	declare(join(f.hero, "kb", `${id}.md`), bad, "rel: land.gate, gate-height: 1");
	commitAll(f, "gates");

	await assert.rejects(land({}, f.ctx), /nothing was landed: 1 gate failed: bad/);
	assert.deepEqual(order(f), ["good", "bad"], "the rest still ran");
	assert.equal(f.remoteRef("refs/heads/work/ideas"), "", "nothing was pushed");
	assert.equal(f.onDeck(), id, "the dive is still held");
	assert.equal(git(f.hero, "status", "--porcelain"), "", "the report is committed");
	assert.match(f.doc(id), new RegExp(`## Land report [^\\n]+\\n\\n- \\[good\\]\\(${good}\\.md\\): passed in \\d+ms\\n- \\[bad\\]\\(${bad}\\.md\\): failed in \\d+ms\\n\\n {2}script: kb/artifacts/${bad}\\.mjs\\n\\n {2}\`\`\`\\n[^]*it broke[^]*bad news[^]*\\n {2}\`\`\`\\n$`));
	assert.doesNotMatch(f.doc(id), / landed\n/);
});

test("refuses, before running anything, a gate with no test-script and one whose doc or script is uncommitted, naming each", async () => {
	const f = fixture("land-gate-refusals");
	await jump({ ref: f.featId }, f.ctx);
	const id = f.onDeck();
	f.commit("idea.md", "an idea\n");
	const [fine, bare, edited, newer] = [gate(f, "fine"), gate(f, "bare", "", { script: false }), gate(f, "edited"), gate(f, "newer")];
	for (const gateId of [fine, bare, edited, newer]) declare(join(f.hero, "kb", `${id}.md`), gateId, "rel: land.gate");
	commitAll(f, "gates");
	writeFileSync(join(f.hero, "kb", "artifacts", `${edited}.mjs`), "export async function run() {}\n");
	writeFileSync(join(f.hero, "kb", `${newer}.md`), `${readFileSync(join(f.hero, "kb", `${newer}.md`), "utf8")}\nmore\n`);
	await assert.rejects(land({}, f.ctx), (error: Error) => {
		assert.match(error.message, /^nothing was landed:/);
		assert.match(error.message, /gate bare has no meta\.test-script/);
		assert.match(error.message, /gate edited's doc or script has uncommitted changes/);
		assert.match(error.message, /gate newer's doc or script has uncommitted changes/);
		assert.doesNotMatch(error.message, /gate fine/);
		return true;
	});
	assert.deepEqual(order(f), [], "no gate ran");
	assert.equal(f.remoteRef("refs/heads/work/ideas"), "");
	assert.doesNotMatch(f.doc(id), /Land report/);
});

test("gates run against the dive's checkouts as they stand, unpushed work and all", async () => {
	const f = fixture("land-gate-live");
	await jump({ ref: f.featId }, f.ctx);
	const id = f.onDeck();
	f.commit("idea.md", "an idea\n");
	const seen = gate(f, "seen", `const { spawnSync } = await import("node:child_process");
const root = ctx.bridgeRoot + "/" + ctx.repos.data.root;
const tree = spawnSync("git", ["rev-parse", "HEAD^{tree}"], { cwd: root, encoding: "utf8" }).stdout.trim();
appendFileSync(ctx.bridgeRoot + "/../seen.log", [ctx.repos.data.root, ctx.repos.data.id, ctx.diveId, tree].join(" "));`);
	declare(join(f.hero, "kb", `${id}.md`), seen, "rel: land.gate");
	commitAll(f, "gates");
	await land({}, f.ctx);
	const [root, repo, dive, tree] = readFileSync(join(f.hero, "..", "seen.log"), "utf8").split(" ");
	assert.equal(root, "workspace/data");
	assert.equal(repo, f.repoId);
	assert.equal(dive, id);
	assert.equal(tree, git(f.remote, "rev-parse", "refs/heads/work/ideas^{tree}"), "the tree the gate saw is the one pushed");
});
