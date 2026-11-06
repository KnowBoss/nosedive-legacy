import { spawnSync } from "node:child_process";
import { existsSync, mkdirSync, mkdtempSync, rmSync } from "node:fs";
import { homedir, tmpdir } from "node:os";
import { isAbsolute, join, resolve } from "node:path";
import type { KbDoc, MigrationCtx } from "nosedive-core";
import { i01a1335485c67c95b7efdf2f0e03cfd6 as findBridge } from "nosedive-core";
import { i01a13354850c7ba3ba5b8ac41a7b6b11 as listKbDocs } from "nosedive-core";
import { i01a18e2a3b4b798d98068d4778a158e6 as docKind } from "nosedive-core";
import { WORK_ID } from "./i01a1b131e1947fa5b316b390a3be2415.ts";
import { repoDocs } from "./i01a1b131e0177e7f8518b309634ebbd8.ts";

type Doc = KbDoc & { path: string };
type Patch = { file: string; dirty: boolean };
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

/** Applies the patches onto `base` in a scratch worktree of `repo` and pushes the result to `ref`; says why when it cannot apply. */
function build(repo: string, base: string, patches: Patch[], wip: string, ref: string, name: string, identity: Record<string, string>): string | undefined {
	const scratch = mkdtempSync(join(tmpdir(), "nosedive-legacy-"));
	const tree = join(scratch, "tree");
	try {
		const added = git(repo, ["worktree", "add", "-q", "--detach", tree, base]);
		if (!added.ok) return `cannot check out ${base.slice(0, 12)}: ${added.text}`;
		// Uncommitted work is one commit, the last, as pack makes it: jump undoes only the top one.
		for (const patch of [...patches.filter((each) => !each.dirty), ...patches.filter((each) => each.dirty)]) {
			if (!existsSync(patch.file)) return `its patch ${patch.file} is gone`;
			if (patch.dirty) {
				const applied = git(tree, ["apply", "--index", "--binary", "--whitespace=nowarn", patch.file]);
				if (!applied.ok) return `its uncommitted work no longer applies: ${applied.text}`;
			} else {
				const applied = git(tree, ["am", "-q", "--keep-cr", "--committer-date-is-author-date", "--no-verify", patch.file], identity);
				if (!applied.ok) {
					git(tree, ["am", "--abort"]);
					return `a patch no longer applies: ${applied.text}`;
				}
			}
		}
		if (patches.some((each) => each.dirty)) {
			const committed = git(tree, ["commit", "-q", "--allow-empty", "--no-verify", "-m", wip], identity);
			if (!committed.ok) return `cannot commit its uncommitted work: ${committed.text}`;
		}
		const pushed = git(tree, ["push", "-q", "origin", `HEAD:${ref}`]);
		if (!pushed.ok) throw new Wait(`cannot push ${name}'s ${ref}: ${pushed.text}`);
		return undefined;
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
	try {
		for (const dive of docs.values()) {
			const kind = docKind(dive);
			const meta = (dive.fm.meta ?? {}) as Record<string, unknown>;
			if (kind.owner !== WORK_ID || kind.name !== "dive" || (meta.outcome !== undefined && meta.outcome !== "bailed")) continue;
			const name = String(dive.fm.name);
			const ref = `refs/nosedive/${hero.id}/dives/${String(dive.fm.id)}`;
			const wip = `pack(${name}): work in progress`;
			const identity = { GIT_AUTHOR_NAME: "nosedive", GIT_AUTHOR_EMAIL: typeof meta.packer === "string" ? meta.packer : "noreply@nosedive.dev", GIT_COMMITTER_NAME: "nosedive", GIT_COMMITTER_EMAIL: "noreply@nosedive.dev" };

			// Each chain the dive links, by the repo its first memo names: `<sha12>.<repo>`, `dirty.<repo>`, or `bridge-wip.<x>`, the hero's.
			const chains = new Map<string, Patch[]>();
			for (const head of linksOf(dive, "patch")) {
				const patches: Patch[] = [];
				let owner: string | undefined;
				const seen = new Set<string>();
				for (let id: string | undefined = head; id && !seen.has(id); id = linksOf(docs.get(id)!, "next")[0]) {
					seen.add(id);
					const memo = docs.get(id);
					const file = (memo?.fm.meta as { patch?: unknown } | undefined)?.patch;
					if (!memo || typeof file !== "string") {
						ctx.out(`legacy-patches: ${name}'s patch memo ${id} is gone, so its chain is passed over`);
						owner = undefined;
						break;
					}
					const memoName = String(memo.fm.name);
					owner ??= memoName.startsWith("bridge-wip.") ? "" : memoName.slice(memoName.indexOf(".") + 1);
					patches.push({ file: join(dir, file), dirty: memoName.startsWith("dirty.") || memoName.startsWith("bridge-wip.") });
					if (!docs.has(linksOf(memo, "next")[0] ?? "")) break;
				}
				if (owner !== undefined) chains.set(owner, [...(chains.get(owner) ?? []), ...patches]);
			}

			for (const entry of (Array.isArray(dive.fm.scopes) ? dive.fm.scopes : []) as Record<string, Record<string, unknown> | null>[]) {
				for (const [repoId, scope] of Object.entries(entry ?? {})) {
					const repo = repos.find((each) => String(each.fm.id) === repoId);
					const pin = scope?.ref;
					if (!repo || typeof scope?.["work-branch"] !== "string" || typeof pin !== "string") continue;
					const repoName = String(repo.fm.name);
					const cache = cacheOf(dir, repo);
					if (remoteHas(cache, ref, repoName)) continue;
					if (!git(cache, ["rev-parse", "--verify", "-q", `${pin}^{commit}`]).ok && !git(cache, ["fetch", "-q", "origin", pin]).ok) {
						ctx.out(`legacy-patches: ${name}: ${repoName}'s origin has no ${pin.slice(0, 12)}, so its work is passed over`);
						continue;
					}
					const patches = chains.get(repoName) ?? [];
					const why = build(cache, pin, patches, wip, ref, repoName, identity);
					if (why) ctx.out(`legacy-patches: ${name}: ${repoName}: ${why}, so it is passed over`);
					else pushed.push(`${name} ${repoName} (${patches.length} patch${patches.length === 1 ? "" : "es"})`);
				}
			}

			const own = chains.get("");
			if (own && own.length > 0) {
				const fetched = git(dir, ["fetch", "-q", "origin"]);
				if (!fetched.ok) throw new Wait(`cannot fetch the hero: ${fetched.text}`);
				if (remoteHas(dir, ref, "the hero")) continue;
				const trunk = git(dir, ["rev-parse", "--verify", "-q", "refs/remotes/origin/HEAD"]).text || git(dir, ["rev-parse", "HEAD"]).text;
				const why = build(dir, trunk, own, wip, ref, "the hero", identity);
				if (why) ctx.out(`legacy-patches: ${name}: the hero: ${why}, so it is passed over`);
				else pushed.push(`${name} hero (${own.length} patch${own.length === 1 ? "" : "es"})`);
			}
		}
	} catch (err) {
		if (!(err instanceof Wait)) throw err;
		ctx.out(`legacy-patches: waiting, since ${err.message}${pushed.length ? `; pushed meanwhile: ${pushed.join(", ")}` : ""}`);
		return undefined;
	}
	for (const each of pushed) ctx.out(`legacy-patches: pushed ${each}`);
	return [];
}
