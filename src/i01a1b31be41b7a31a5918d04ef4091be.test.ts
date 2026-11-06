import assert from "node:assert/strict";
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { test } from "node:test";
import { i01a1335480c776ba8945020d0af333eb as mintUuid } from "nosedive-core";
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
	const { f, ref, heroOrigin, second } = packed("legacy-patches");
	const { out, ctx } = say();
	assert.deepEqual(legacyPatches(f.hero, ctx), []);
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
	const { f, ref } = packed("legacy-patches-wait");
	const doc = join(f.hero, ".nosedive", "repos", `${f.repoId}.md`);
	const text = readFileSync(doc, "utf8");
	writeFileSync(doc, text.replace(/origin: .*/, `origin: ${JSON.stringify(join(f.hero, "..", "nowhere.git"))}`));
	const { out, ctx } = say();
	assert.equal(legacyPatches(f.hero, ctx), undefined);
	assert.ok(out.some((line) => line.startsWith("legacy-patches: waiting, since cannot fetch data")));
	writeFileSync(doc, text);
	assert.deepEqual(legacyPatches(f.hero, say().ctx), []);
	assert.ok(git(f.remote, "rev-parse", ref));
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
