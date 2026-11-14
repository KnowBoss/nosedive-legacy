import type { Args, Ctx } from "nosedive-core";
import { i01a1335485c67c95b7efdf2f0e03cfd6 as findBridge } from "nosedive-core";
import { i01a18e2a3b4b798d98068d4778a158e6 as docKind } from "nosedive-core";
import { i01a1b131e1947fa5b316b390a3be2415 as heldDive } from "./i01a1b131e1947fa5b316b390a3be2415.ts";
import { heroDocs, linksOf, scriptOf, i01a1b131e31f7b329bc1c4389343491a as runGates, type Doc, type Selected } from "./i01a1b131e31f7b329bc1c4389343491a.ts";

/** The held dive's test.gate links; with `full`, those of its feat, its scoped repos and every feat its feat reaches by .feat links. */
export async function iffb5aa30b4e659e68b40ad7dee378a62(args: Args, ctx: Ctx): Promise<void> {
	const hero = findBridge(ctx.cwd);
	if (!hero?.workspace) throw new Error("test works in a hero repo, and this is not one");
	const dive = heldDive(hero);
	if (!dive) throw new Error("no dive is held here: `nosedive jump <feat or dive>` picks one up, or name the gates: `nosedive test <gate>...`");
	const docs = heroDocs(hero);
	const declarers: Doc[] = [dive.doc];
	if (args.full) {
		for (const scope of dive.scopes) declarers.push(docs.get(scope.repoId)!);
		for (const id of reachedFeats(docs, dive.featId)) declarers.push(docs.get(id)!);
	}
	const selected: Selected[] = [];
	const seen = new Set<string>();
	for (const by of declarers) {
		for (const link of linksOf(by)) {
			if (link.rel !== "test.gate" || seen.has(link.id)) continue;
			seen.add(link.id);
			const gate = docs.get(link.id);
			if (!gate || !scriptOf(gate)) throw new Error(`${String(by.fm.name)} declares gate ${link.id}, which is no doc with a meta.test-script`);
			selected.push({ gate, by, flaky: link.attrs["test-is-flaky"] === true });
		}
	}
	await runGates(hero, selected, dive, ctx);
}

/** The feat and every doc reached from it through links whose rel's role is .feat, either way, never into a dive. */
export function reachedFeats(docs: Map<string, Doc>, featId: string | undefined): string[] {
	if (!featId || !docs.has(featId)) return [];
	const edges = new Map<string, Set<string>>();
	const edge = (from: string, to: string) => edges.set(from, (edges.get(from) ?? new Set()).add(to));
	for (const [id, doc] of docs) for (const link of linksOf(doc)) if (link.rel.endsWith(".feat")) (edge(id, link.id), edge(link.id, id));
	const reached = new Set([featId]);
	const queue = [featId];
	while (queue.length) {
		for (const next of edges.get(queue.shift()!) ?? []) {
			const doc = docs.get(next);
			if (reached.has(next) || !doc || docKind(doc).name === "dive") continue;
			reached.add(next);
			queue.push(next);
		}
	}
	return [...reached];
}
