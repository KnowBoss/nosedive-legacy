import assert from "node:assert/strict";
import { chmodSync, existsSync, mkdirSync, readdirSync, readFileSync, renameSync, rmSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { test } from "node:test";
import { i01a1335480c776ba8945020d0af333eb as mintUuid } from "nosedive-core";
import { i01a13354894273b1be253424511ba82c as commitFiles } from "nosedive-core";
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

	// Migrated is migrated: not built again, nor asked of origin, though origin is now out of reach.
	const doc = join(f.hero, ".nosedive", "repos", `${f.repoId}.md`);
	writeFileSync(doc, readFileSync(doc, "utf8").replace(/origin: .*/, `origin: ${JSON.stringify(join(f.hero, "..", "nowhere.git"))}`));
	const again = say();
	assert.deepEqual(legacyPatches(f.hero, again.ctx), []);
	assert.equal(again.out.length, 0);
});

test("a ref origin has already is said to be, and its patches are spent as pushed ones are, nothing having been pushed for them", () => {
	const { f, dive, ref } = packed("legacy-patches-there-already");
	git(f.remote, "update-ref", ref, f.first);
	legacyPatches(f.hero, say().ctx);
	const text = readFileSync(f.path(dive), "utf8");
	assert.match(text, new RegExp(`${SECTION}- data: already on origin\\n- hero: pushed 1 patch to ${ref}\\n$`));
	assert.equal(git(f.remote, "rev-parse", ref), f.first, "left as it is");
	assert.doesNotMatch(text, /rel: patch/, "no patch link is left");
	assert.equal(memosOf(f).length, 0, "its memos are removed with the hero's");
	for (const name of ["commit", "dirty", "bridge"]) assert.equal(existsSync(join(f.hero, "kb", "artifacts", `${name}.patch`)), false, `${name}.patch is gone`);
});

test("a hero ref origin has already is spent too", () => {
	const { f, dive, ref, heroOrigin } = packed("legacy-patches-hero-already");
	git(heroOrigin, "update-ref", ref, git(heroOrigin, "rev-parse", "main"));
	legacyPatches(f.hero, say().ctx);
	assert.match(readFileSync(f.path(dive), "utf8"), new RegExp(`${SECTION}- data: pushed 2 patches to ${ref}\\n- hero: already on origin\\n$`));
	assert.equal(memosOf(f).length, 0);
	assert.equal(existsSync(join(f.hero, "kb", "artifacts", "bridge.patch")), false);
});

/** The id of the patch memo named so. */
const memoNamed = (f: ReturnType<typeof packed>["f"], name: string) => memosOf(f).find((file) => new RegExp(`\\nname: ${name.replace(".", "\\.")}\\n`).test(readFileSync(join(f.hero, "kb", file), "utf8")))!.slice(0, -3);

test("a chain that breaks at a missing memo passes its whole repo over, every chain of it, saying where it breaks and naming the patches found; nothing of that repo is pushed or removed, the hero's still is", () => {
	const { f, dive, ref } = packed("legacy-patches-gone");
	const [dirty, commit] = [memoNamed(f, "dirty.data"), memoNamed(f, `${git(f.remote, "rev-parse", "main").slice(0, 12)}.data`)];
	rmSync(join(f.hero, "kb", `${dirty}.md`));
	// A second chain of data's, which is whole, and is passed over with the broken one.
	const other = mintUuid();
	writeFileSync(f.path(other), `---\nkind: memo\nid: ${other}\nname: dirty.data\ngist: "Patch"\nmeta:\n  patch: kb/artifacts/dirty.patch\n---\n\n# Patch\n`);
	f.link(dive, other, "rel: patch");
	f.commit("a memo lost");
	const { out, ctx } = say();
	legacyPatches(f.hero, ctx);
	const text = readFileSync(f.path(dive), "utf8");
	assert.match(text, new RegExp(`${SECTION}- data: passed over: its patch chain breaks at memo ${dirty}, so its later patches are not known; its work needs patching by hand on jump, from kb/artifacts/dirty\\.patch, kb/artifacts/commit\\.patch\\n- hero: pushed 1 patch to ${ref}\\n$`));
	assert.ok(out.includes(`legacy-patches: ideas.packed's patch memo ${dirty} is gone, so its repo is passed over`));
	assert.equal(git(f.remote, "ls-remote", ".", ref), "", "not even its pin is pushed");
	assert.match(text, new RegExp(`${commit}\\.md:\\n\\s+rel: patch`), "its chains stay linked");
	assert.match(text, new RegExp(`${other}\\.md:\\n\\s+rel: patch`));
	assert.ok(existsSync(join(f.hero, "kb", "artifacts", "commit.patch")) && existsSync(join(f.hero, "kb", "artifacts", "dirty.patch")));
	assert.equal(existsSync(f.path(commit)) && existsSync(f.path(other)), true);
});

test("a chain whose first memo is gone is of no known repo, so every repo of the dive and the hero are passed over, and nothing is pushed or removed", () => {
	const { f, dive, ref, heroOrigin } = packed("legacy-patches-gone-all");
	const commit = memoNamed(f, `${git(f.remote, "rev-parse", "main").slice(0, 12)}.data`);
	rmSync(join(f.hero, "kb", `${commit}.md`));
	f.commit("a head lost");
	const { out, ctx } = say();
	legacyPatches(f.hero, ctx);
	const text = readFileSync(f.path(dive), "utf8");
	const why = `its patch chain breaks at memo ${commit}, so its later patches are not known`;
	assert.match(text, new RegExp(`${SECTION}- data: passed over: ${why}\\n- hero: passed over: ${why}; its work needs patching by hand on jump, from kb/artifacts/bridge\\.patch\\n$`));
	assert.ok(out.includes(`legacy-patches: ideas.packed's patch memo ${commit} is gone, so every repo of the dive and the hero are passed over`));
	assert.equal(git(f.remote, "ls-remote", ".", ref), "");
	assert.equal(git(heroOrigin, "ls-remote", ".", ref), "");
	assert.equal(memosOf(f).length, 2, "the memos left are kept");
	assert.ok(existsSync(join(f.hero, "kb", "artifacts", "bridge.patch")));
});

test("a dive the migration waits on has the dives it finished before recorded, and committed by the migration itself, which returns nothing; the next run does the rest", () => {
	const { f, dive, heroOrigin } = packed("legacy-patches-part");
	// The first dive has data's work only; the second, minted later, the hero's too.
	const bridge = memoNamed(f, "bridge-wip.abcdef");
	writeFileSync(f.path(dive), readFileSync(f.path(dive), "utf8").replace(new RegExp(`  - kb/${bridge}\\.md:\\n      rel: patch\\n`), ""));
	const [second, bridge2] = [mintUuid(), mintUuid()];
	writeFileSync(join(f.hero, "kb", "artifacts", "bridge2.patch"), readFileSync(join(f.hero, "kb", "artifacts", "bridge.patch"), "utf8"));
	writeFileSync(f.path(bridge2), `---\nkind: memo\nid: ${bridge2}\nname: bridge-wip.second\ngist: "Patch"\nmeta:\n  patch: kb/artifacts/bridge2.patch\n---\n\n# Patch\n`);
	writeFileSync(f.path(second), readFileSync(f.path(dive), "utf8").replace(`id: ${dive}`, `id: ${second}`).replace("name: ideas.packed", "name: ideas.second").replace(/links:\n[^]*?---/, `links:\n  - kb/${bridge2}.md:\n      rel: patch\n---`));
	f.commit("two dives");
	const away = `${heroOrigin}-away`;
	renameSync(heroOrigin, away);

	const { out, ctx } = say();
	assert.equal(legacyPatches(f.hero, ctx), undefined);
	assert.ok(out.some((line) => line.startsWith("legacy-patches: waiting, since cannot fetch the hero")));
	assert.match(readFileSync(f.path(dive), "utf8"), new RegExp(`${SECTION}- data: pushed 2 patches to `), "the dive finished is recorded");
	assert.equal(git(f.hero, "log", "-1", "--format=%s"), "migrate: legacy:legacy-patches (in part)");
	assert.equal(git(f.hero, "status", "--porcelain", "--", "kb"), "", "and committed");
	assert.equal(existsSync(join(f.hero, "kb", "artifacts", "commit.patch")), false, "its patches are removed");
	assert.doesNotMatch(readFileSync(f.path(second), "utf8"), /migrated/, "the waiting one gets nothing");
	assert.ok(existsSync(f.path(bridge2)));

	renameSync(away, heroOrigin);
	const rest = legacyPatches(f.hero, say().ctx)!;
	assert.ok(rest.includes(f.path(second)));
	assert.match(readFileSync(f.path(second), "utf8"), new RegExp(`${SECTION}- data: already on origin\\n- hero: pushed 1 patch to `));
	assert.equal(existsSync(f.path(bridge2)), false);
});

test("a scratch check-out that fails is a wait, recording nothing, not a pass-over", () => {
	const { f, dive } = packed("legacy-patches-checkout");
	// A cache of data whose first commit lacks its file: cloned, then the blob of README.md at that commit deleted.
	const cache = join(process.env.NOSEDIVE_USER_DIR!, "cache", `${f.repoId}.git`);
	git(f.hero, "clone", "-q", "--bare", f.remote, cache);
	const blob = git(f.remote, "rev-parse", `${f.first}:README.md`);
	const loose = join(cache, "objects", blob.slice(0, 2), blob.slice(2));
	chmodSync(loose, 0o666);
	rmSync(loose);
	const { out, ctx } = say();
	assert.equal(legacyPatches(f.hero, ctx), undefined);
	assert.ok(out.some((line) => line.startsWith("legacy-patches: waiting, since cannot check out")), out.join("\n"));
	assert.doesNotMatch(readFileSync(f.path(dive), "utf8"), /migrated/);
});

test("uncommitted work that cannot be committed is a wait, recording nothing, not a pass-over", () => {
	const { f, dive, second } = packed("legacy-patches-commit");
	// The chain is the uncommitted work alone, on a pin that has what it was made on, so only its commit is tried.
	const [dirty, commit] = [memoNamed(f, "dirty.data"), memoNamed(f, `${second.slice(0, 12)}.data`)];
	writeFileSync(f.path(dive), readFileSync(f.path(dive), "utf8").replace(`kb/${commit}.md`, `kb/${dirty}.md`).replace(`ref: ${f.first}`, `ref: ${second}`));
	f.commit("dirty head");
	const keep = { count: process.env.GIT_CONFIG_COUNT, k0: process.env.GIT_CONFIG_KEY_0, v0: process.env.GIT_CONFIG_VALUE_0, k1: process.env.GIT_CONFIG_KEY_1, v1: process.env.GIT_CONFIG_VALUE_1 };
	Object.assign(process.env, { GIT_CONFIG_COUNT: "2", GIT_CONFIG_KEY_0: "commit.gpgsign", GIT_CONFIG_VALUE_0: "true", GIT_CONFIG_KEY_1: "gpg.program", GIT_CONFIG_VALUE_1: "no-such-gpg-program" });
	const { out, ctx } = say();
	try {
		assert.equal(legacyPatches(f.hero, ctx), undefined);
	} finally {
		for (const [name, value] of [["GIT_CONFIG_COUNT", keep.count], ["GIT_CONFIG_KEY_0", keep.k0], ["GIT_CONFIG_VALUE_0", keep.v0], ["GIT_CONFIG_KEY_1", keep.k1], ["GIT_CONFIG_VALUE_1", keep.v1]] as const) {
			if (value === undefined) delete process.env[name];
			else process.env[name] = value;
		}
	}
	assert.ok(out.some((line) => line.startsWith("legacy-patches: waiting, since cannot commit data's uncommitted work")), out.join("\n"));
	assert.doesNotMatch(readFileSync(f.path(dive), "utf8"), /migrated/);
});

test("a section headed otherwise than as record-dive heads one is not a migrated one: `## DB migrated` does not keep a dive from being migrated", () => {
	const { f, dive, ref } = packed("legacy-patches-heading");
	const path = f.path(dive);
	writeFileSync(path, `${readFileSync(path, "utf8")}\n## DB migrated\n\nNotes on moving the database.\n`);
	f.commit("a heading that looks migrated");
	assert.ok(legacyPatches(f.hero, say().ctx)!.includes(path));
	assert.ok(git(f.remote, "rev-parse", ref), "the dive is built");
	assert.match(readFileSync(path, "utf8"), new RegExp(`${SECTION}- data: pushed 2 patches`));
});

test("a links entry holding a spent patch head and other keys keeps the other keys", () => {
	const { f, dive } = packed("legacy-patches-entry");
	const commit = memoNamed(f, `${git(f.remote, "rev-parse", "main").slice(0, 12)}.data`);
	const path = f.path(dive);
	writeFileSync(path, readFileSync(path, "utf8").replace(`  - kb/${commit}.md:\n      rel: patch\n`, `  - kb/${commit}.md:\n      rel: patch\n    kb/${f.featId}.md:\n      rel: related\n`));
	f.commit("a shared entry");
	legacyPatches(f.hero, say().ctx);
	const text = readFileSync(path, "utf8");
	assert.match(text, new RegExp(`kb/${f.featId}\\.md:\\n\\s+rel: related`), "the other key stays");
	assert.doesNotMatch(text, /rel: patch/);
	assert.equal(text.includes(`kb/${commit}.md`), false, "the spent head goes");
});
