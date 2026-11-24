import type { Args, Ctx } from "nosedive-core";
import { i01a1335485c67c95b7efdf2f0e03cfd6 as findBridge } from "nosedive-core";
import { i01a1c72ba0a67a64836f167c23ffa097 as diveOnDeck, dropRenderSentinels, emailOf, putDown, scopesWith } from "./i01a1c72ba0a67a64836f167c23ffa097.ts";

export async function ia159fdc01ac85e4f831dc1c523787ce6(args: Args, ctx: Ctx): Promise<void> {
	const reason = String(args.reason ?? "").trim();
	if (!reason) throw new Error("bail needs a reason: --reason <why>");
	const hero = findBridge(ctx.cwd);
	if (!hero?.workspace) throw new Error("bail works in a hero repo, and this is not one");
	const dive = diveOnDeck(hero, ctx, typeof args.dive === "string" ? args.dive : undefined);
	const me = emailOf(hero);
	// Before any push is planned: a checkout legacy nosedive left can block every push to origin (render-sentinels-dropped).
	dropRenderSentinels(dive.scopes.filter((scope) => scope.ours), ctx.err);

	await putDown(dive, ctx.capes[0]!.version, "bail", ({ puts, refs, own }) => {
		const lines = [`${me} bailed: ${reason}`, "", ...puts.map((put) => `- ${put.name}: ${put.sha ? `held ${[...put.commits].reverse().join("; ")}, kept on ${own}` : "held no commits"}`)];
		return { action: "bail", label: "bailed", state: "bailed", summary: reason, meta: { diver: null }, scopes: scopesWith(hero, dive.doc, refs), lines };
	});
	ctx.out(`bailed ${String(dive.doc.fm.name)}`);
}
