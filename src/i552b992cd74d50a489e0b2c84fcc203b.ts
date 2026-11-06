import type { Args, Ctx } from "nosedive-core";
import { i01a1335485c67c95b7efdf2f0e03cfd6 as findBridge } from "nosedive-core";
import { checkoutAt, i01a1b131e0177e7f8518b309634ebbd8 as findRepo } from "./i01a1b131e0177e7f8518b309634ebbd8.ts";

export async function i552b992cd74d50a489e0b2c84fcc203b(args: Args, ctx: Ctx): Promise<void> {
	const hero = findBridge(ctx.cwd);
	if (!hero?.workspace) throw new Error("hydrate-repo.workspace works in a hero repo, and this is not one");
	checkoutAt(hero, findRepo(hero, String(args.repo)), typeof args.at === "string" ? args.at : undefined, ctx);
}
