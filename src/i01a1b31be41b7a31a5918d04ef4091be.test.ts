import assert from "node:assert/strict";
import { existsSync, mkdirSync, readdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { test } from "node:test";
import { i01a1335480c776ba8945020d0af333eb as mintUuid } from "nosedive-core";
import { i01a13354894273b1be253424511ba82c as commitFiles } from "nosedive-core";
import { passedOver } from "./i01a1c72ba0a67a64836f167c23ffa097.ts";
import { fixture, git, WORK_ID } from "../test/harness.ts";
import { i01a1b31be41b7a31a5918d04ef4091be as legacyPatches } from "./i01a1b31be41b7a31a5918d04ef4091be.ts";

/** A legacy dive on data, pinned at the first commit, its packed work two patches: the second commit, then an uncommitted edit; and one bridge-wip patch of the hero's. */
function packed(label: string) {
	const f = fixture(label);
	const heroOrigin = join(f.hero, "..", "hero.git");
	git(f.hero, "init", "-q", "--bare", "-b", "main", heroOrigin);
	git(f.hero, "remote", "add", "origin", heroOrigin);
	git(f.hero, "push", "-q", "-u", "origin", "main");
	git(f.hero, "remote", "set-head", "origin", "main");
	const second = git(f.remote, "rev-parse", "main");
	const artifacts = join(f.hero, "kb", "artifacts");
	mkdirSync(artifacts, { recursive: true });
	const seed = join(f.hero, "..", "data-seed");
	writeFileSync(join(artifacts, "commit.patch"), git(seed, "format-patch", "-1", second, "--stdout", "--binary", "--no-signature") + "\n");
	writeFileSync(join(seed, "README.md"), "three\n");
	writeFileSync(join(artifacts, "dirty.patch"), git(seed, "diff", "--binary", "HEAD") + "\n");
	git(seed, "checkout", "-q", "--", "README.md");
	writeFileSync(join(artifacts, "bridge.patch"), `diff --git a/notes.md b/notes.md\nnew file mode 100644\nindex 0000000..e69de29\n--- /dev/null\n+++ b/notes.md\n@@ -0,0 +1 @@\n+a note\n`);

	const [dive, commitMemo, dirtyMemo, bridgeMemo] = [mintUuid(), mintUuid(), mintUuid(), mintUuid()];
	const memo = (id: string, name: string, file: string, next?: string) =>
		writeFileSync(f.path(id), `---\nkind: memo\nid: ${id}\nname: ${name}\ngist: "Patch"\nmeta:\n  patch: kb/artifacts/${file}\n${next ? `links:\n  - kb/${next}.md:\n      rel: next\n` : ""}---\n\n# Patch\n`);
	memo(commitMemo, `${second.slice(0, 12)}.data`, "commit.patch", dirtyMemo);
	memo(dirtyMemo, "dirty.data", "dirty.patch");
	memo(bridgeMemo, "bridge-wip.abcdef", "bridge.patch");
	writeFileSync(
		f.path(dive),
		`---\nkind: dive\nid: ${dive}\nname: ideas.packed\ngist: "Packed"\nscopes:\n  - ${f.repoId}:\n      ref: ${f.first}\n      work-branch: work/ideas\n  - ${WORK_ID}:\n      canonical: true\nmeta:\n  feat: ${f.featId}\n  diver: null\n  packer: diver@example.com\nlinks:\n  - kb/${commitMemo}.md:\n      rel: patch\n  - kb/${bridgeMemo}.md:\n      rel: patch\n---\n\n# Packed\n`,
	);
	f.commit("legacy pack");
	git(f.hero, "push", "-q");
	const heroId = /^id: (\S+)/m.exec(readFileSync(join(f.hero, ".nosedive", "config.yaml"), "utf8"))![1]!;
	return { f, dive, heroOrigin, second, ref: `refs/nosedive/${heroId}/dives/${dive}` };
}

const say = () => {
	const out: string[] = [];
	return { out, ctx: { capes: [], out: (text: string) => void out.push(text) } as never };
};

test("an open dive's patches go to its dive refs: commits onto the pin, uncommitted work as pack's WIP commit, the hero's on the hero's origin", () => {
	const { f, dive, ref, heroOrigin, second } = packed("legacy-patches");
	const { out, ctx } = say();
	assert.ok(legacyPatches(f.hero, ctx)!.includes(f.path(dive)), "the dive is written");
	assert.equal(git(f.remote, "log", "--format=%s", ref).split("\n").join("|"), "pack(ideas.packed): work in progress|second|first");
	assert.equal(git(f.remote, "show", `${ref}:README.md`), "three");
	assert.equal(git(f.remote, "rev-parse", `${ref}^`) !== second, true, "replayed by am, so a new commit");
	assert.equal(git(f.remote, "log", "-1", "--format=%an <%ae>", `${ref}^`), "Legacy Test <diver@example.com>", "a replayed commit keeps its author");
	assert.equal(git(heroOrigin, "log", "-1", "--format=%s", ref), "pack(ideas.packed): work in progress");
	assert.equal(git(heroOrigin, "show", `${ref}:notes.md`), "a note");
	assert.equal(git(heroOrigin, "rev-parse", `${ref}^`), git(heroOrigin, "rev-parse", "main"), "on the hero's trunk");
	assert.ok(out.includes("legacy-patches: pushed ideas.packed data (2 patches)"));

	const before = git(f.remote, "rev-parse", ref);
	const again = say();
	assert.deepEqual(legacyPatches(f.hero, again.ctx), []);
	assert.equal(git(f.remote, "rev-parse", ref), before, "a dive ref already there is left as it is");
	assert.equal(again.out.length, 0);
});

test("a writable scope with no patches gets its pin as its dive ref; landed dives and read-only scopes get none", () => {
	const { f, dive, ref } = packed("legacy-patches-pin");
	const path = f.path(dive);
	writeFileSync(path, readFileSync(path, "utf8").replace(/links:\n[^]*?---/, "---"));
	const other = mintUuid();
	writeFileSync(f.path(other), `---\nkind: dive\nid: ${other}\nname: ideas.landed\ngist: "Landed"\nscopes:\n  - ${f.repoId}:\n      ref: ${f.first}\n      work-branch: work/ideas\n  - ${WORK_ID}:\n      canonical: true\nmeta:\n  feat: ${f.featId}\n  outcome: landed\n---\n\n# Landed\n`);
	f.commit("no patches");
	legacyPatches(f.hero, say().ctx);
	assert.equal(git(f.remote, "rev-parse", ref), f.first);
	assert.equal(git(f.remote, "ls-remote", ".", `refs/nosedive/*/${other}`), "");
});

test("a push that fails makes it wait, recording nothing, and the next run pushes", () => {
	const { f, dive, ref } = packed("legacy-patches-wait");
	const doc = join(f.hero, ".nosedive", "repos", `${f.repoId}.md`);
	const text = readFileSync(doc, "utf8");
	writeFileSync(doc, text.replace(/origin: .*/, `origin: ${JSON.stringify(join(f.hero, "..", "nowhere.git"))}`));
	const { out, ctx } = say();
	assert.equal(legacyPatches(f.hero, ctx), undefined);
	assert.ok(out.some((line) => line.startsWith("legacy-patches: waiting, since cannot fetch data")));
	assert.equal(git(f.hero, "status", "--porcelain", "--", "kb"), "", "a wait leaves the kb as it found it");
	assert.doesNotMatch(readFileSync(f.path(dive), "utf8"), /migrated/, "and no section");
	writeFileSync(doc, text);
	assert.ok(legacyPatches(f.hero, say().ctx)!.includes(f.path(dive)));
	assert.ok(git(f.remote, "rev-parse", ref));
	assert.match(readFileSync(f.path(dive), "utf8"), /\n## \S+ migrated\n/, "tried again, it is recorded");
});

test("a patch whose changes the pin has already is left out, and the rest still go", () => {
	const { f, dive, ref, second } = packed("legacy-patches-there");
	const path = f.path(dive);
	writeFileSync(path, readFileSync(path, "utf8").replace(`ref: ${f.first}`, `ref: ${second}`));
	f.commit("pin moved past the landed commit");
	legacyPatches(f.hero, say().ctx);
	assert.equal(git(f.remote, "log", "--format=%s", ref).split("\n").join("|"), "pack(ideas.packed): work in progress|second|first");
	assert.equal(git(f.remote, "rev-parse", `${ref}^`), second, "on the pin itself");
});

test("dives hung by state links, as legacy nosedive left them, are found: an open one and a bailed memo get their refs, a landed one none, and no doc is rewritten", () => {
	const { f, dive, ref } = packed("legacy-patches-links");
	const path = f.path(dive);
	// As legacy wrote it: no canonical scope, no outcome, the feat holding a state link; bailed and landed dives memos.
	writeFileSync(path, readFileSync(path, "utf8").replace(`  - ${WORK_ID}:\n      canonical: true\n`, ""));
	f.link(f.featId, dive, "rel: packed.dive");
	const [bailed, landed] = [mintUuid(), mintUuid()];
	for (const [id, rel] of [[bailed, "bailed"], [landed, "landed"]] as const) {
		writeFileSync(f.path(id), `---\nkind: memo\nid: ${id}\nname: ideas.${rel}\ngist: "Over"\nscopes:\n  - ${f.repoId}:\n      ref: ${f.first}\n      work-branch: work/ideas\n---\n\n# Over\n`);
		f.link(f.featId, id, `rel: ${rel}.dive`);
	}
	f.commit("legacy shape");

	const changed = legacyPatches(f.hero, say().ctx)!;
	assert.equal(git(f.remote, "log", "--format=%s", ref).split("\n").join("|"), "pack(ideas.packed): work in progress|second|first", "the open one's patches");
	assert.equal(git(f.remote, "rev-parse", ref.replace(dive, bailed)), f.first, "a bailed memo's pin");
	assert.equal(git(f.remote, "ls-remote", ".", `refs/nosedive/*/${landed}`), "", "a landed one needs none");
	assert.ok(changed.includes(path) && changed.includes(f.path(bailed)), "the open dive and the bailed memo are written");
	assert.equal(changed.includes(f.path(landed)) || changed.includes(f.path(f.featId)), false, "no other doc is");
	assert.doesNotMatch(readFileSync(f.path(landed), "utf8"), /migrated/);
});

const SECTION = "\\n## \\d{4}-\\d\\d-\\d\\dT[\\d:.]+Z migrated\\n\\n";
/** The kb docs that are patch memos, by file name. */
const memosOf = (f: ReturnType<typeof packed>["f"]) => readdirSync(join(f.hero, "kb")).filter((name) => name.endsWith(".md") && /\n {2}patch: /.test(readFileSync(join(f.hero, "kb", name), "utf8")));

test("a dive whose patches are pushed gets the section, loses its patch links, memos and files in the framework's commit, and a rerun pushes nothing, even after its ref is deleted", () => {
	const { f, dive, heroOrigin, ref } = packed("legacy-patches-spent");
	const memos = memosOf(f);
	assert.equal(memos.length, 3);
	const changed = legacyPatches(f.hero, say().ctx)!;

	const text = readFileSync(f.path(dive), "utf8");
	assert.match(text, new RegExp(`${SECTION}- data: pushed 2 patches to ${ref}\\n- hero: pushed 1 patch to ${ref}\\n$`));
	assert.doesNotMatch(text, /\nlinks:|rel: patch/, "no patch link is left");
	for (const name of memos) assert.equal(existsSync(join(f.hero, "kb", name)), false, `memo ${name} is gone`);
	for (const name of ["commit", "dirty", "bridge"]) assert.equal(existsSync(join(f.hero, "kb", "artifacts", `${name}.patch`)), false, `${name}.patch is gone`);

	// What the framework does with what is returned: add and commit those paths.
	commitFiles(f.hero, changed, "migrate: legacy:legacy-patches", "test");
	assert.equal(git(f.hero, "status", "--porcelain"), "", "nothing is left over");
	assert.equal(git(f.hero, "show", "--diff-filter=D", "--name-only", "--format=", "HEAD").split("\n").length, 6, "three memos and three patch files, deleted in it");
	assert.equal(git(f.hero, "show", "--diff-filter=M", "--name-only", "--format=", "HEAD"), `kb/${dive}.md`);

	// The loop deleted the refs, as a pack with no work or a bail does.
	git(f.remote, "update-ref", "-d", ref);
	git(heroOrigin, "update-ref", "-d", ref);
	const again = say();
	assert.deepEqual(legacyPatches(f.hero, again.ctx), []);
	assert.equal(git(f.remote, "ls-remote", ".", ref), "");
	assert.equal(git(heroOrigin, "ls-remote", ".", ref), "");
	assert.equal(again.out.length, 0);
});

test("a patch that no longer applies is passed over: the dive says so and keeps that chain, the rest is pushed and removed, and a rerun builds nothing, with no network", () => {
	const { f, dive, ref } = packed("legacy-patches-over");
	const file = join(f.hero, "kb", "artifacts", "commit.patch");
	writeFileSync(file, readFileSync(file, "utf8").replace("-one", "-nothing like it"));
	f.commit("a patch that cannot apply");
	legacyPatches(f.hero, say().ctx);

	const text = readFileSync(f.path(dive), "utf8");
	assert.match(text, new RegExp(`${SECTION}- data: passed over: a patch no longer applies: [^\\n]*; its work needs patching by hand on jump, from kb/artifacts/commit\\.patch, kb/artifacts/dirty\\.patch\\n- hero: pushed 1 patch to ${ref}\\n$`));
	assert.equal(git(f.remote, "ls-remote", ".", ref), "", "nothing was pushed for it");
	assert.match(text, /rel: patch/, "its chain is still linked");
	assert.equal(memosOf(f).length, 2, "its two memos are kept, the hero's removed");
	assert.ok(existsSync(file) && existsSync(join(f.hero, "kb", "artifacts", "dirty.patch")));
	assert.equal(existsSync(join(f.hero, "kb", "artifacts", "bridge.patch")), false);
	assert.deepEqual(passedOver(text).map((line) => line.slice(0, 22)), ["data: passed over: a p"]);

	// Migrated is migrated: not built again, nor asked of origin, though origin is now out of reach.
	const doc = join(f.hero, ".nosedive", "repos", `${f.repoId}.md`);
	writeFileSync(doc, readFileSync(doc, "utf8").replace(/origin: .*/, `origin: ${JSON.stringify(join(f.hero, "..", "nowhere.git"))}`));
	const again = say();
	assert.deepEqual(legacyPatches(f.hero, again.ctx), []);
	assert.equal(again.out.length, 0);
});

test("a ref origin has already is said to be, and its patches are kept, nothing having been pushed for them", () => {
	const { f, dive, ref } = packed("legacy-patches-there-already");
	git(f.remote, "update-ref", ref, f.first);
	legacyPatches(f.hero, say().ctx);
	const text = readFileSync(f.path(dive), "utf8");
	assert.match(text, new RegExp(`${SECTION}- data: already on origin\\n- hero: pushed 1 patch to ${ref}\\n$`));
	assert.equal(git(f.remote, "rev-parse", ref), f.first, "left as it is");
	assert.match(text, /rel: patch/);
	assert.equal(memosOf(f).length, 2);
});

test("a chain whose memo is gone is passed over whole and kept, and the repo still gets its pin", () => {
	const { f, dive, ref } = packed("legacy-patches-gone");
	const dirty = memosOf(f).find((name) => /name: dirty\.data/.test(readFileSync(join(f.hero, "kb", name), "utf8")))!;
	rmSync(join(f.hero, "kb", dirty));
	f.commit("a memo lost");
	legacyPatches(f.hero, say().ctx);
	const text = readFileSync(f.path(dive), "utf8");
	assert.match(text, new RegExp(`${SECTION}- patches: passed over: its patch memo ${dirty.slice(0, -3)} is gone; its work needs patching by hand on jump, from kb/artifacts/commit\\.patch\\n- data: pushed 0 patches to ${ref}\\n- hero: pushed 1 patch to ${ref}\\n$`));
	assert.equal(git(f.remote, "rev-parse", ref), f.first);
	assert.match(text, /rel: patch/);
	assert.ok(existsSync(join(f.hero, "kb", "artifacts", "commit.patch")));
});
