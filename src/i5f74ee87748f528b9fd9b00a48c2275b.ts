import type { Args, Ctx } from "nosedive-core";
import { i01a1335485c67c95b7efdf2f0e03cfd6 as findBridge } from "nosedive-core";
import { i01a1c72ba0a67a64836f167c23ffa097 as diveOnDeck, emailOf, heroDoc, pushRecord, putDown, readOnlyRefusals, scopesWith } from "./i01a1c72ba0a67a64836f167c23ffa097.ts";
import { i01a1c72ba0b57a0c80e3fdd641d001a8 as recordDive } from "./i01a1c72ba0b57a0c80e3fdd641d001a8.ts";

export async function i5f74ee87748f528b9fd9b00a48c2275b(args: Args, ctx: Ctx): Promise<void> {
	const hero = findBridge(ctx.cwd);
	if (!hero?.workspace) throw new Error("pack works in a hero repo, and this is not one");
	const dive = diveOnDeck(hero, ctx, typeof args.dive === "string" ? args.dive : undefined);
	const me = emailOf(hero);
	const refused = readOnlyRefusals(dive);
	if (refused.length > 0) throw new Error(`read-only scopes hold work with nowhere to go, so nothing was packed:\n  ${refused.join("\n  ")}`);

	const { puts, refs, own } = putDown(dive, ctx.capes[0]!.version);
	const lines = puts.map((put) => (put.sha ? `- ${put.name}: ${put.commits.length} commit${put.commits.length === 1 ? "" : "s"} kept on ${own} at ${put.sha.slice(0, 7)}` : `- ${put.name}: no work`));
	const id = String(dive.doc.fm.id);
	pushRecord(hero, () => {
		const doc = heroDoc(hero, id)!;
		recordDive(hero, doc, { action: "pack", label: "packed", state: "packed", summary: `${me} put it down`, meta: { diver: null, packer: me }, scopes: scopesWith(hero, doc, refs), lines: [`${me} put it down.`, "", ...lines] }, ctx.capes[0]!.version);
	});
	ctx.out(`packed ${String(dive.doc.fm.name)}${lines.length > 0 ? `\n${lines.join("\n")}` : ""}`);
}
