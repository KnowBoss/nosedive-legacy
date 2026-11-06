import type { KbDoc, MigrationCtx } from "nosedive-core";
import { i01a1335485c67c95b7efdf2f0e03cfd6 as findBridge } from "nosedive-core";
import { i01a13354850c7ba3ba5b8ac41a7b6b11 as listKbDocs } from "nosedive-core";
import { i01a1335483aa776cb84df698b04adc06 as writeKbDoc } from "nosedive-core";
import { i01a18e2a3b4b798d98068d4778a158e6 as docKind } from "nosedive-core";
import { WORK_ID } from "./i01a1b131e1947fa5b316b390a3be2415.ts";

type Doc = KbDoc & { path: string };

const STATES = ["landed", "bailed", "planned", "jumped", "packed"];
const QUID = /[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/;
/** What work's dive schema allows in meta. */
const WORK_META = new Set(["diver", "packer", "outcome", "feat"]);

const entries = (list: unknown): Record<string, unknown>[] => (Array.isArray(list) ? list.filter((entry) => entry && typeof entry === "object") : []) as Record<string, unknown>[];

export function i01a1b31bdffb73989a9e8bcd257167b5(dir: string, ctx: MigrationCtx): string[] {
	const hero = findBridge(dir);
	if (!hero || hero.dir !== dir) return [];
	const docs = new Map<string, Doc>();
	for (const root of hero.roots) for (const doc of listKbDocs(root.dir)) docs.set(String(doc.fm.id), doc);
	const changed = new Set<Doc>();

	// State links become dives.feat; each target remembers its strongest state and the first doc that linked it.
	const targets = new Map<string, { states: Set<string>; by: string }>();
	for (const [id, doc] of docs) {
		let edited = false;
		const links = entries(doc.fm.links).map((entry) =>
			Object.fromEntries(
				Object.entries(entry).map(([key, value]) => {
					const attrs = (value && typeof value === "object" ? value : {}) as Record<string, unknown>;
					const state = typeof attrs.rel === "string" ? /^(\w+)\.dive$/.exec(attrs.rel)?.[1] : undefined;
					const target = QUID.exec(key)?.[0];
					if (!state || !STATES.includes(state) || !target) return [key, value];
					const known = targets.get(target) ?? { states: new Set<string>(), by: id };
					known.states.add(state);
					targets.set(target, known);
					edited = true;
					return [key, { ...attrs, rel: "dives.feat" }];
				}),
			),
		);
		if (edited) {
			doc.yaml.set("links", links);
			changed.add(doc);
		}
	}

	const canonical = [...docs.values()].map((doc) => entries(doc.fm.scopes).find((entry) => WORK_ID in entry)).find(Boolean);
	const isWorkDive = (doc: Doc) => {
		const kind = docKind(doc);
		return kind.owner === WORK_ID && kind.name === "dive";
	};
	for (const [id, { states, by }] of targets) {
		const doc = docs.get(id);
		if (!doc) {
			ctx.out(`legacy-dives: ${id} is linked as a dive and is no doc here, so it is left out`);
			continue;
		}
		if (!isWorkDive(doc)) {
			doc.yaml.set("kind", "dive");
			const others = entries(doc.fm.scopes).filter((entry) => !Object.values(entry).some((value) => (value as { canonical?: unknown } | null)?.canonical === true));
			doc.yaml.set("scopes", [...others, canonical ?? { [WORK_ID]: { canonical: true } }]);
			changed.add(doc);
		}
		const outcome = states.has("landed") ? "landed" : states.has("bailed") ? "bailed" : undefined;
		if (outcome && doc.yaml.getIn(["meta", "outcome"]) === undefined) {
			doc.yaml.setIn(["meta", "outcome"], outcome);
			changed.add(doc);
		}
		if (!doc.yaml.hasIn(["meta", "feat"])) {
			const effort = doc.yaml.getIn(["meta", "effort"]);
			const named = typeof effort === "string" ? (docs.has(effort) ? effort : [...docs.values()].find((each) => each.fm.name === effort)?.fm.id) : undefined;
			doc.yaml.setIn(["meta", "feat"], String(named ?? by));
			changed.add(doc);
		}
	}

	// Every dive of work's, those already so included, keeps only the meta work's schema has.
	for (const doc of docs.values()) {
		if (!isWorkDive(doc) && !targets.has(String(doc.fm.id))) continue;
		const meta = doc.yaml.getIn(["meta"]) as { toJSON?: () => Record<string, unknown> } | undefined;
		const keys = Object.keys((doc.yaml.toJS() as { meta?: Record<string, unknown> }).meta ?? {}).filter((key) => !WORK_META.has(key));
		if (!meta || keys.length === 0) continue;
		const values = (doc.yaml.toJS() as { meta: Record<string, unknown> }).meta;
		const kept = keys.filter((key) => key !== "effort").map((key) => `- ${key}: ${typeof values[key] === "string" ? values[key] : JSON.stringify(values[key])}`);
		for (const key of keys) doc.yaml.deleteIn(["meta", key]);
		if (kept.length > 0) doc.body = `${doc.body.trimEnd()}\n\n## Legacy meta\n\n${kept.join("\n")}\n`;
		changed.add(doc);
	}

	for (const doc of changed) writeKbDoc(doc.path, doc.yaml, doc.body);
	if (changed.size > 0) ctx.out(`legacy-dives: ${targets.size} dive${targets.size === 1 ? "" : "s"} linked by state, ${changed.size} doc${changed.size === 1 ? "" : "s"} rewritten to work's shape`);
	return [...changed].map((doc) => doc.path);
}
