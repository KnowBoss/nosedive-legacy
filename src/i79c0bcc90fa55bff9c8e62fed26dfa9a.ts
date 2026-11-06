import { existsSync } from "node:fs";
import { resolve } from "node:path";
import type { Args, Ctx } from "nosedive-core";
import { i01a1335485c67c95b7efdf2f0e03cfd6 as findBridge } from "nosedive-core";
import { i01a1b131e1947fa5b316b390a3be2415 as heldDive } from "./i01a1b131e1947fa5b316b390a3be2415.ts";
import { heroDocs, linksOf, scriptOf, i01a1b131e31f7b329bc1c4389343491a as runGates, type Doc, type Selected } from "./i01a1b131e31f7b329bc1c4389343491a.ts";

const QUID = /[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/i;

/** The named gates, in order, each with the one doc declaring it, narrowed by --via and answered by the held dive. */
export async function i79c0bcc90fa55bff9c8e62fed26dfa9a(args: Args, ctx: Ctx): Promise<void> {
	const hero = findBridge(ctx.cwd);
	if (!hero?.workspace) throw new Error("test works in a hero repo, and this is not one");
	const docs = heroDocs(hero);
	const dive = heldDive(hero);
	const find = (ref: string, what: string): Doc => {
		const path = resolve(ctx.cwd, ref);
		const id = (existsSync(path) ? QUID.exec(path.replace(/.*[\\/]/, "")) : QUID.exec(ref))?.[0]?.toLowerCase();
		const doc = id ? docs.get(id) : undefined;
		if (!doc) throw new Error(`${what} ${ref} is no doc in this hero`);
		return doc;
	};
	const via = typeof args.doc === "string" ? reachable(docs, find(args.doc, "--via")) : undefined;
	const selected: Selected[] = [];
	for (const ref of [args.gate].flat() as string[]) {
		const gate = find(ref, "gate");
		const name = String(gate.fm.name);
		if (!scriptOf(gate)) throw new Error(`${name} has no meta.test-script, so it is no gate`);
		let declared = [...docs.values()].flatMap((doc) => linksOf(doc).filter((link) => link.id === String(gate.fm.id) && link.rel.endsWith(".gate")).map((link) => ({ doc, link })));
		if (via) {
			declared = declared.filter(({ doc }) => via.has(String(doc.fm.id)));
			if (declared.length === 0 && !("scopes" in gate.fm)) throw new Error(`no doc that ${String(args.doc)} reaches declares ${name}`);
		}
		const own = dive && declared.find(({ doc }) => String(doc.fm.id) === dive.id);
		if (own) declared = [own];
		if (declared.length > 1) {
			throw new Error(`${name} has several declaring docs: ${declared.map(({ doc }) => `${String(doc.fm.name)} (${String(doc.fm.id)})`).join(", ")}; use --via <doc> to pick one`);
		}
		if (declared.length === 0 && !("scopes" in gate.fm)) {
			throw new Error(`no doc declares ${name}, so it has no scopes to inherit: declare it on a feat with a .gate link, or give it scopes: [] if it needs no repo`);
		}
		const [found] = declared;
		selected.push({ gate, by: found?.doc, flaky: found?.link.attrs["test-is-flaky"] === true });
	}
	await runGates(hero, selected, dive, ctx);
}

/** The doc and every doc its links reach. */
function reachable(docs: Map<string, Doc>, from: Doc): Set<string> {
	const reached = new Set([String(from.fm.id)]);
	const queue = [from];
	while (queue.length) {
		for (const link of linksOf(queue.shift()!)) {
			const doc = docs.get(link.id);
			if (doc && !reached.has(link.id)) (reached.add(link.id), queue.push(doc));
		}
	}
	return reached;
}
