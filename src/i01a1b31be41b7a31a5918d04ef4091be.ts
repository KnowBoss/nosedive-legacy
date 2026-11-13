import { spawnSync } from "node:child_process";
import { existsSync, mkdirSync, mkdtempSync, rmSync, unlinkSync } from "node:fs";
import { homedir, tmpdir } from "node:os";
import { isAbsolute, join, relative, resolve } from "node:path";
import type { KbDoc, MigrationCtx } from "nosedive-core";
import { i01a1335485c67c95b7efdf2f0e03cfd6 as findBridge } from "nosedive-core";
import { i01a13354850c7ba3ba5b8ac41a7b6b11 as listKbDocs } from "nosedive-core";
import { i01a1335483aa776cb84df698b04adc06 as writeKbDoc } from "nosedive-core";
import { isDive } from "./i01a1b131e1947fa5b316b390a3be2415.ts";
import { diveLinks, MIGRATED } from "./i01a1c72ba0a67a64836f167c23ffa097.ts";
import { withSection } from "./i01a1c72ba0b57a0c80e3fdd641d001a8.ts";
import { repoDocs } from "./i01a1b131e0177e7f8518b309634ebbd8.ts";

type Doc = KbDoc & { path: string };
type Patch = { file: string; rel: string; dirty: boolean };
/** The patch memos of one repo's chain (or the hero's), their heads the dive links, and the patches they name. */
type Chain = { heads: string[]; memos: Doc[]; patches: Patch[] };
/** A chain that cannot be applied is passed over; one that could not reach origin makes the migration wait. */
class Wait extends Error {}

const QUID = /[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/;
const BRANCHES = "+refs/heads/*:refs/remotes/origin/*";
const PACKED = "+refs/nosedive/*:refs/nosedive/*";

function git(cwd: string, args: string[], env: Record<string, string> = {}): { ok: boolean; text: string } {
	const result = spawnSync("git", args, { cwd, encoding: "utf8", env: { ...process.env, ...env } });
	return { ok: result.status === 0, text: (result.status === 0 ? result.stdout : result.stderr || result.stdout || "").trim() };
}

const linksOf = (doc: Doc, rel: string): string[] =>
	(Array.isArray(doc.fm.links) ? doc.fm.links : []).flatMap((entry) =>
		Object.entries((entry ?? {}) as Record<string, { rel?: unknown } | null>).flatMap(([key, value]) => (value?.rel === rel && QUID.exec(key) ? [QUID.exec(key)![0]] : [])),
	);

/** The user's cache of a repo, as core's hydrate-repo keeps it, made when missing and fetched from origin. */
function cacheOf(hero: string, repo: Doc): string {
	const cache = join(process.env.NOSEDIVE_USER_DIR || join(homedir(), ".nosedive"), "cache", `${String(repo.fm.id)}.git`);
	const url = String((repo.fm.meta as { remotes?: { origin?: unknown } } | undefined)?.remotes?.origin ?? "");
	if (!url) throw new Wait(`${String(repo.fm.name)} has no meta.remotes.origin`);
	const origin = /^[a-z][a-z0-9+.-]*:\/\/|^[^@\s/]+@[^:\s/]+:/i.test(url) || isAbsolute(url) ? url : resolve(hero, url);
	if (!existsSync(cache)) {
		mkdirSync(cache, { recursive: true });
		git(cache, ["init", "-q", "--bare"]);
	}
	// As core's hydrate-repo sets it each time, so the cache follows the repo doc.
	git(cache, ["config", "remote.origin.url", origin]);
	git(cache, ["config", "--replace-all", "remote.origin.fetch", BRANCHES]);
	git(cache, ["config", "--add", "remote.origin.fetch", PACKED]);
	const fetched = git(cache, ["fetch", "-q", "--prune", "origin"]);
	if (!fetched.ok) throw new Wait(`cannot fetch ${String(repo.fm.name)}: ${fetched.text}`);
	return cache;
}

/** Whether origin has the ref, asked of origin itself. */
function remoteHas(dir: string, ref: string, name: string): boolean {
	const listed = git(dir, ["ls-remote", "origin", ref]);
	if (!listed.ok) throw new Wait(`cannot ask ${name}'s origin for ${ref}: ${listed.text}`);
	return listed.text !== "";
}

/** Whether origin holds `sha` at the ref, asked of origin itself. */
function remoteIs(dir: string, ref: string, name: string, sha: string): boolean {
	const listed = git(dir, ["ls-remote", "origin", ref]);
	if (!listed.ok) throw new Wait(`cannot ask ${name}'s origin for ${ref}: ${listed.text}`);
	return listed.text.split(/\s/)[0] === sha;
}

/** Applies the patches onto `base` in a scratch worktree of `repo` and pushes the result to `ref`; says why when it cannot apply, else what it pushed. */
function build(repo: string, base: string, patches: Patch[], wip: string, ref: string, name: string, identity: Record<string, string>): { sha: string } | { why: string } {
	const scratch = mkdtempSync(join(tmpdir(), "nosedive-legacy-"));
	const tree = join(scratch, "tree");
	try {
		const added = git(repo, ["worktree", "add", "-q", "--detach", tree, base]);
		if (!added.ok) return { why: `cannot check out ${base.slice(0, 12)}: ${added.text}` };
		// Uncommitted work is one commit, the last, as pack makes it: jump undoes only the top one.
		for (const patch of [...patches.filter((each) => !each.dirty), ...patches.filter((each) => each.dirty)]) {
			if (!existsSync(patch.file)) return { why: `its patch ${patch.rel} is gone` };
			// A patch whose changes the tree has already, as when the pin was moved past its landed work, is left out.
			const there = () => git(tree, ["apply", "--reverse", "--check", "--binary", "--whitespace=nowarn", patch.file]).ok;
			if (patch.dirty) {
				const applied = git(tree, ["apply", "--3way", "--index", "--binary", "--whitespace=nowarn", patch.file]);
				if (!applied.ok) {
					git(tree, ["reset", "-q", "--hard"]);
					if (!there()) return { why: `its uncommitted work no longer applies: ${firstLine(applied.text)}` };
				}
			} else {
				const applied = git(tree, ["am", "-q", "-3", "--keep-cr", "--committer-date-is-author-date", "--no-verify", patch.file], identity);
				if (!applied.ok) {
					git(tree, ["am", "--abort"]);
					if (!there()) return { why: `a patch no longer applies: ${firstLine(applied.text)}` };
				}
			}
		}
		if (patches.some((each) => each.dirty)) {
			const committed = git(tree, ["commit", "-q", "--allow-empty", "--no-verify", "-m", wip], identity);
			if (!committed.ok) return { why: `cannot commit its uncommitted work: ${committed.text}` };
		}
		const pushed = git(tree, ["push", "-q", "origin", `HEAD:${ref}`]);
		if (!pushed.ok) throw new Wait(`cannot push ${name}'s ${ref}: ${pushed.text}`);
		return { sha: git(tree, ["rev-parse", "HEAD"]).text };
	} finally {
		git(repo, ["worktree", "remove", "--force", tree]);
		rmSync(scratch, { recursive: true, force: true });
	}
}

export function i01a1b31be41b7a31a5918d04ef4091be(dir: string, ctx: MigrationCtx): string[] | undefined {
	const hero = findBridge(dir);
	if (!hero || hero.dir !== dir || !hero.id) return [];
	const docs = new Map<string, Doc>();
	for (const root of hero.roots) for (const doc of listKbDocs(root.dir)) docs.set(String(doc.fm.id), doc);
	const repos = repoDocs(hero);
	const pushed: string[] = [];
	const hanging = diveLinks(hero);
	// What each dive's migration says and which chains it spent, written once every dive is built: a wait writes nothing.
	const done: { dive: Doc; lines: string[]; spent: Chain[] }[] = [];
	try {
		for (const dive of docs.values()) {
			const meta = (dive.fm.meta ?? {}) as Record<string, unknown>;
			// A dive of legacy's hangs by a state link, over once landed, whatever its kind, a bailed one being a memo as legacy nosedive left it; work's, by its kind and `meta.outcome`.
			const hung = hanging.get(String(dive.fm.id));
			const open = hung ? hung.state !== "landed" : isDive(dive) && (meta.outcome === undefined || meta.outcome === "bailed");
			if (!open || MIGRATED.test(dive.body)) continue;
			const name = String(dive.fm.name);
			const ref = `refs/nosedive/${hero.id}/dives/${String(dive.fm.id)}`;
			const wip = `pack(${name}): work in progress`;
			const identity = { GIT_AUTHOR_NAME: "nosedive", GIT_AUTHOR_EMAIL: typeof meta.packer === "string" ? meta.packer : "noreply@nosedive.dev", GIT_COMMITTER_NAME: "nosedive", GIT_COMMITTER_EMAIL: "noreply@nosedive.dev" };
			const lines: string[] = [];
			const spent: Chain[] = [];
			const passed = (who: string, why: string, patches: Patch[]) =>
				lines.push(`- ${who}: passed over: ${why.replace(/\s*\n\s*/g, " ")}${patches.length > 0 ? `; its work needs patching by hand on jump, from ${patches.map((patch) => patch.rel).join(", ")}` : ""}`);
			const patched = (who: string, chain: Chain | undefined) => {
				const n = chain?.patches.length ?? 0;
				lines.push(`- ${who}: pushed ${n} patch${n === 1 ? "" : "es"} to ${ref}`);
			};

			// Each chain the dive links, by the repo its first memo names: `<sha12>.<repo>`, `dirty.<repo>`, or `bridge-wip.<x>`, the hero's.
			const chains = new Map<string, Chain>();
			for (const head of linksOf(dive, "patch")) {
				const chain: Chain = { heads: [head], memos: [], patches: [] };
				let owner: string | undefined;
				let lost: string | undefined;
				const seen = new Set<string>();
				for (let id: string | undefined = head; id && !seen.has(id); id = linksOf(docs.get(id)!, "next")[0]) {
					seen.add(id);
					const memo = docs.get(id);
					const file = (memo?.fm.meta as { patch?: unknown } | undefined)?.patch;
					if (!memo || typeof file !== "string") {
						ctx.out(`legacy-patches: ${name}'s patch memo ${id} is gone, so its chain is passed over`);
						lost = id;
						break;
					}
					const memoName = String(memo.fm.name);
					owner ??= memoName.startsWith("bridge-wip.") ? "" : memoName.slice(memoName.indexOf(".") + 1);
					chain.memos.push(memo);
					chain.patches.push({ file: join(dir, file), rel: file.replace(/\\/g, "/"), dirty: memoName.startsWith("dirty.") || memoName.startsWith("bridge-wip.") });
				}
				if (lost !== undefined) passed("patches", `its patch memo ${lost} is gone`, chain.patches);
				else if (owner !== undefined) {
					const all = chains.get(owner) ?? { heads: [], memos: [], patches: [] };
					all.heads.push(head);
					all.memos.push(...chain.memos);
					all.patches.push(...chain.patches);
					chains.set(owner, all);
				}
			}

			const handled = new Set<string>();
			for (const entry of (Array.isArray(dive.fm.scopes) ? dive.fm.scopes : []) as Record<string, Record<string, unknown> | null>[]) {
				for (const [repoId, scope] of Object.entries(entry ?? {})) {
					const repo = repos.find((each) => String(each.fm.id) === repoId);
					const pin = scope?.ref;
					if (!repo || typeof scope?.["work-branch"] !== "string" || typeof pin !== "string") continue;
					const repoName = String(repo.fm.name);
					handled.add(repoName);
					const chain = chains.get(repoName);
					const patches = chain?.patches ?? [];
					const cache = cacheOf(dir, repo);
					if (remoteHas(cache, ref, repoName)) {
						lines.push(`- ${repoName}: already on origin`);
						continue;
					}
					if (!git(cache, ["rev-parse", "--verify", "-q", `${pin}^{commit}`]).ok && !git(cache, ["fetch", "-q", "origin", pin]).ok) {
						ctx.out(`legacy-patches: ${name}: ${repoName}'s origin has no ${pin.slice(0, 12)}, so its work is passed over`);
						passed(repoName, `origin has no ${pin.slice(0, 12)}`, patches);
						continue;
					}
					const built = build(cache, pin, patches, wip, ref, repoName, identity);
					if ("why" in built) {
						ctx.out(`legacy-patches: ${name}: ${repoName}: ${built.why}, so it is passed over`);
						passed(repoName, built.why, patches);
						continue;
					}
					// The patches are the only copy of the work until origin is seen to hold it.
					if (!remoteIs(cache, ref, repoName, built.sha)) throw new Wait(`${repoName}'s origin does not hold ${built.sha.slice(0, 12)} at ${ref} after the push`);
					pushed.push(`${name} ${repoName} (${patches.length} patch${patches.length === 1 ? "" : "es"})`);
					patched(repoName, chain);
					if (chain) spent.push(chain);
				}
			}
			for (const [owner, chain] of chains) if (owner !== "" && !handled.has(owner)) passed(owner, "the dive has no writable scope for it", chain.patches);

			const own = chains.get("");
			if (own && own.patches.length > 0) {
				const fetched = git(dir, ["fetch", "-q", "origin"]);
				if (!fetched.ok) throw new Wait(`cannot fetch the hero: ${fetched.text}`);
				if (remoteHas(dir, ref, "the hero")) lines.push("- hero: already on origin");
				else {
					const trunk = git(dir, ["rev-parse", "--verify", "-q", "refs/remotes/origin/HEAD"]).text || git(dir, ["rev-parse", "HEAD"]).text;
					const built = build(dir, trunk, own.patches, wip, ref, "the hero", identity);
					if ("why" in built) {
						ctx.out(`legacy-patches: ${name}: the hero: ${built.why}, so it is passed over`);
						passed("hero", built.why, own.patches);
					} else {
						if (!remoteIs(dir, ref, "the hero", built.sha)) throw new Wait(`the hero's origin does not hold ${built.sha.slice(0, 12)} at ${ref} after the push`);
						pushed.push(`${name} hero (${own.patches.length} patch${own.patches.length === 1 ? "" : "es"})`);
						patched("hero", own);
						spent.push(own);
					}
				}
			}
			if (lines.length > 0) done.push({ dive, lines, spent });
		}
	} catch (err) {
		if (!(err instanceof Wait)) throw err;
		ctx.out(`legacy-patches: waiting, since ${err.message}${pushed.length ? `; pushed meanwhile: ${pushed.join(", ")}` : ""}`);
		return undefined;
	}
	for (const each of pushed) ctx.out(`legacy-patches: pushed ${each}`);

	// The framework commits what is returned, a deletion as it does a change; a file git does not track is removed and not returned.
	const changed = new Set<string>();
	const remove = (path: string) => {
		const rooted = resolve(dir, path);
		const within = relative(dir, rooted);
		if (!existsSync(rooted) || within.startsWith("..") || isAbsolute(within)) return;
		const tracked = git(dir, ["ls-files", "--error-unmatch", "--", rooted]).ok;
		unlinkSync(rooted);
		if (tracked) changed.add(rooted);
	};
	for (const { dive, lines, spent } of done) {
		const gone = new Set(spent.flatMap((chain) => chain.heads));
		if (gone.size > 0) {
			const links = (Array.isArray(dive.fm.links) ? dive.fm.links : []) as Record<string, { rel?: unknown } | null>[];
			const kept = links.filter((entry) => !Object.entries(entry ?? {}).some(([key, value]) => value?.rel === "patch" && gone.has(QUID.exec(key)?.[0] ?? "")));
			if (kept.length > 0) dive.yaml.set("links", kept);
			else dive.yaml.delete("links");
		}
		writeKbDoc(dive.path, dive.yaml, withSection(dive.body, "migrated", lines));
		changed.add(dive.path);
		for (const chain of spent) {
			for (const memo of chain.memos) {
				const file = (memo.fm.meta as { patch?: unknown } | undefined)?.patch;
				if (typeof file === "string") remove(file);
				remove(memo.path);
			}
		}
	}
	return [...changed];
}

/** The first line git says that is not a hint. */
function firstLine(text: string): string {
	return text.split(/\r?\n/).find((line) => line.trim() && !line.startsWith("hint:")) ?? text;
}
