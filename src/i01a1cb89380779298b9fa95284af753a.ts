import type { KbDoc, MigrationCtx } from "nosedive-core";
import { i01a1335485c67c95b7efdf2f0e03cfd6 as findBridge } from "nosedive-core";
import { i01a13354850c7ba3ba5b8ac41a7b6b11 as listKbDocs } from "nosedive-core";
import { i01a1335483aa776cb84df698b04adc06 as writeKbDoc } from "nosedive-core";
import { isDive, metaOf, type State } from "./i01a1c72ba0a67a64836f167c23ffa097.ts";
import { wearsWork } from "./i01a1b31bdffb73989a9e8bcd257167b5.ts";

type Doc = KbDoc & { path: string };

const QUID = /[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/;

/** The state a converted dive was in, read back from what legacy-dives and the loop before it left on the dive. */
function stateOf(dive: Doc): State {
	const outcome = (dive.fm.meta as { outcome?: unknown } | undefined)?.outcome;
	if (outcome === "landed" || outcome === "bailed") return outcome;
	const { diver, packer } = metaOf(dive as never);
	return diver ? "jumped" : packer ? "packed" : "planned";
}

/**
 * Undoes what an earlier legacy-dives did to a hero that wears legacy and not work, so legacy's loop finds its dives again
 * (legacy-keeps-dive-shape): each `dives.feat` link to a dive of legacy's becomes the state link it stood for, and the dive
 * loses `meta.outcome`. A hero with no such link, or one that wears work, is left as it is.
 */
export function i01a1cb89380779298b9fa95284af753a(dir: string, ctx: MigrationCtx): string[] {
	const hero = findBridge(dir);
	if (!hero || hero.dir !== dir || wearsWork(hero, ctx.capes[0])) return [];
	const docs = new Map<string, Doc>();
	for (const root of hero.roots) for (const doc of listKbDocs(root.dir)) docs.set(String(doc.fm.id), doc);
	const changed = new Set<Doc>();
	const dives = new Set<Doc>();

	for (const doc of docs.values()) {
		let edited = false;
		const links = (Array.isArray(doc.fm.links) ? doc.fm.links : []).map((entry) =>
			Object.fromEntries(
				Object.entries((entry ?? {}) as Record<string, unknown>).map(([key, value]) => {
					const attrs = (value && typeof value === "object" ? value : {}) as Record<string, unknown>;
					const dive = attrs.rel === "dives.feat" ? docs.get(QUID.exec(key)?.[0] ?? "") : undefined;
					if (!dive || !isDive(dive as never)) return [key, value];
					dives.add(dive);
					edited = true;
					return [key, { ...attrs, rel: `${stateOf(dive)}.dive` }];
				}),
			),
		);
		if (edited) {
			doc.yaml.set("links", links);
			changed.add(doc);
		}
	}

	// Only once every link is read: the outcome is what says a dive landed or bailed.
	for (const dive of dives) {
		if (!dive.yaml.hasIn(["meta", "outcome"])) continue;
		dive.yaml.deleteIn(["meta", "outcome"]);
		const meta = (dive.yaml.toJS() as { meta?: Record<string, unknown> }).meta;
		if (meta && Object.keys(meta).length === 0) dive.yaml.delete("meta");
		changed.add(dive);
	}

	for (const doc of changed) writeKbDoc(doc.path, doc.yaml, doc.body);
	if (changed.size > 0) ctx.out(`legacy-dives-restored: ${dives.size} dive${dives.size === 1 ? "" : "s"} linked by state again, ${changed.size} doc${changed.size === 1 ? "" : "s"} rewritten`);
	return [...changed].map((doc) => doc.path);
}
