import type { GateCtx } from "nosedive-core";
import { changed } from "nosedive-core";
import { diveLinks, isOver } from "./i01a1c72ba0a67a64836f167c23ffa097.ts";

type State = NonNullable<GateCtx["before"]>;

const metaOf = (state: State) => (state.fm.meta ?? {}) as { diver?: unknown; packer?: unknown };

/** A dive is dropped once it is over, its state link landed or bailed, or never jumped (drops-recorded); one that was jumped keeps the feat it was jumped on. */
export async function i98e9ab6e1535570abad65bf95895aa3d(ctx: GateCtx): Promise<void> {
	const { before, after } = ctx;
	if (!before) return;
	const name = String(before.fm.name);
	const meta = metaOf(before);
	const state = diveLinks(ctx.bridge).get(ctx.doc.id)?.state;
	if (!after) {
		if (state && isOver(state)) return;
		if (typeof meta.diver === "string" && meta.diver) {
			throw new Error(`dive ${name} is held by ${meta.diver.split("#")[0]}: it is not over, so it is not dropped; land or bail it first`);
		}
		if (typeof meta.packer === "string" && meta.packer) {
			throw new Error(`dive ${name} was packed by ${meta.packer}, unfinished: jump it and finish it, landing or bailing it, then drop it`);
		}
		if (state === "jumped" || state === "packed") throw new Error(`dive ${name} is ${state}, unfinished: jump it and finish it, landing or bailing it, then drop it`);
		return;
	}
	// Its feat names it (dive-names-derived); moving it to another feat renames it.
	if (after.fm.name !== before.fm.name) throw new Error(`dive ${name} is named after its feat, so it takes no other name: its gist says what it is for`);
	const jumped = Boolean(meta.diver || meta.packer || (state && state !== "planned"));
	if (jumped && changed(before, after, "meta.feat")) {
		throw new Error(`dive ${name} was jumped on its feat, so it keeps it: bail it, and mint a dive on the other feat`);
	}
	// A held dive's doc changes only through the loop (turn, pack, land and bail), none of which runs crud's gates (held-dive-doc-edits).
	if (!(state && isOver(state)) && ((typeof meta.diver === "string" && meta.diver) || state === "jumped")) {
		const by = typeof meta.diver === "string" && meta.diver ? ` by ${meta.diver.split("#")[0]}` : "";
		throw new Error(`dive ${name} is held${by}, so its doc changes only through the loop: record a turn with \`pass --turn\` instead, or pack it first`);
	}
}
