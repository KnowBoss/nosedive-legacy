import { existsSync } from "node:fs";
import { relative } from "node:path";
import type { Args, Ctx } from "nosedive-core";
import { i01a1335485c67c95b7efdf2f0e03cfd6 as findBridge } from "nosedive-core";
import { i01a13c760de87562b4738946402010b8 as checkoutPath } from "nosedive-core";
import { i01a17fba20d673c5b8dd8551943369a2 as dehydrateRepo } from "nosedive-core";
import { git, i01a1b131e0177e7f8518b309634ebbd8 as findRepo } from "./i01a1b131e0177e7f8518b309634ebbd8.ts";

export async function idf324b14b9135de2893fffa8705388da(args: Args, ctx: Ctx): Promise<void> {
	const hero = findBridge(ctx.cwd);
	if (!hero?.workspace) throw new Error("dehydrate-repo.workspace works in a hero repo, and this is not one");
	const repo = findRepo(hero, String(args.repo));
	const dir = checkoutPath(hero, String(repo.fm.name));
	if (args.force !== true || !existsSync(dir)) return dehydrateRepo(hero, repo, ctx);
	// --force is legacy's: what the checkout holds that origin lacks goes with it.
	const cache = git(dir, "rev-parse", "--path-format=absolute", "--git-common-dir").text;
	const removed = git(cache, "worktree", "remove", "--force", "--force", dir);
	if (!removed.ok) throw new Error(`cannot remove ${dir}: ${removed.text}`);
	ctx.out(`${relative(hero.dir, dir).replace(/\\/g, "/")}: removed`);
}
