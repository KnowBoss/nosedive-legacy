import { spawnSync } from "node:child_process";
import { existsSync } from "node:fs";
import { relative } from "node:path";
import type { Bridge, KbDoc } from "nosedive-core";
import { i01a13354850c7ba3ba5b8ac41a7b6b11 as listKbDocs } from "nosedive-core";
import { i01a13c760de87562b4738946402010b8 as checkoutPath } from "nosedive-core";
import { i01a15baf13e27bd88dc880d4871f2210 as hydrateRepo } from "nosedive-core";

export type RepoDoc = KbDoc & { path: string };
type Say = { out(text: string): void; err(text: string): void };

const QUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** Every repo doc the hero registers. */
export function repoDocs(hero: Bridge): RepoDoc[] {
	return hero.reposDir && existsSync(hero.reposDir) ? listKbDocs(hero.reposDir) : [];
}

/** The repo the hero registers by `ref`, its quid or exact name. */
export function i01a1b131e0177e7f8518b309634ebbd8(hero: Bridge, ref: string): RepoDoc {
	const repos = repoDocs(hero);
	const found = QUID.test(ref) ? repos.filter((doc) => String(doc.fm.id) === ref.toLowerCase()) : repos.filter((doc) => doc.fm.name === ref);
	if (found.length === 1) return found[0]!;
	if (found.length > 1) throw new Error(`${ref} names ${found.length} repos: ${found.map((doc) => String(doc.fm.id)).join(", ")}; name one by its quid`);
	throw new Error(`no repo ${ref} is registered in this hero`);
}

export function git(cwd: string, ...args: string[]): { ok: boolean; text: string } {
	const result = spawnSync("git", args, { cwd, encoding: "utf8" });
	return { ok: result.status === 0, text: (result.status === 0 ? result.stdout : result.stderr || result.stdout || "").trim() };
}

/**
 * The repo's checkout, made with core's hydrate-repo when missing and then detached at `ref` when given; an existing one
 * is left where it is, saying when it is not at `ref`. Returns its directory, its hero-relative root and its commit.
 */
export function checkoutAt(hero: Bridge, repo: RepoDoc, ref: string | undefined, say: Say): { dir: string; root: string; head: string } {
	const dir = checkoutPath(hero, String(repo.fm.name));
	const root = relative(hero.dir, dir).replace(/\\/g, "/");
	if (existsSync(dir)) {
		const head = git(dir, "rev-parse", "HEAD").text;
		if (ref && git(dir, "rev-parse", "--verify", "-q", `${ref}^{commit}`).text !== head) say.err(`nosedive: ${root} is at ${head.slice(0, 12)}, not ${ref}, and is left there`);
		return { dir, root, head };
	}
	hydrateRepo(hero, repo, say);
	if (ref) {
		let target = ref;
		if (!git(dir, "rev-parse", "--verify", "-q", `${ref}^{commit}`).ok) {
			const fetched = git(dir, "fetch", "-q", "origin", ref);
			if (!fetched.ok) throw new Error(`${root}: cannot fetch ${ref} from origin: ${fetched.text}`);
			target = "FETCH_HEAD";
		}
		const moved = git(dir, "checkout", "-q", "--detach", target);
		if (!moved.ok) throw new Error(`${root}: cannot check out ${ref}: ${moved.text}`);
	}
	const head = git(dir, "rev-parse", "HEAD").text;
	if (ref) say.out(`${root}: detached at ${ref} ${head.slice(0, 12)}`);
	return { dir, root, head };
}
