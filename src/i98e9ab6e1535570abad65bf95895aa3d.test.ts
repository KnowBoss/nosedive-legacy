// before crud dive
import assert from "node:assert/strict";
import { test } from "node:test";
import { i01a1335485c67c95b7efdf2f0e03cfd6 as findBridge } from "nosedive-core";
import { loopFixture as fixture } from "../test/harness.ts";
import { i98e9ab6e1535570abad65bf95895aa3d as before } from "./i98e9ab6e1535570abad65bf95895aa3d.ts";

const state = (meta: Record<string, unknown>) => ({ fm: { name: "ideas.briefed", meta }, body: "" });

/** A hero with a dive hung from its feat by `state`, and the gate's ctx for crud on it. */
function dive(label: string, state = "planned") {
	const f = fixture(label);
	const id = f.legacyDive({ state });
	return { f, ctx: (rest: Record<string, unknown>) => ({ bridge: findBridge(f.hero)!, doc: { id }, ...rest }) as never };
}

test("a dive not yet jumped may change its feat; a jumped one, by its link or its meta, keeps it", async () => {
	const { ctx } = dive("shape-before-feat");
	await before(ctx({ before: state({ feat: "a" }), after: state({ feat: "b" }) }));
	await assert.rejects(before(ctx({ before: state({ feat: "a", packer: "diver@example.com" }), after: state({ feat: "b" }) })), /dive ideas\.briefed was jumped on its feat, so it keeps it/);
	await before(ctx({ before: state({ feat: "a", packer: "diver@example.com" }), after: state({ feat: "a", packer: null }) }));
	for (const rel of ["jumped", "packed"]) {
		const jumped = dive(`shape-before-${rel}`, rel);
		await assert.rejects(before(jumped.ctx({ before: state({ feat: "a" }), after: state({ feat: "b" }) })), /was jumped on its feat, so it keeps it/, "a state link says it was jumped, whatever its meta");
	}
});

test("a dive takes no name but the one its feat gives it", async () => {
	const { ctx } = dive("shape-before-name");
	const named = (name: string) => ({ fm: { name, meta: { feat: "a" } }, body: "" });
	await assert.rejects(before(ctx({ before: named("ideas.briefed"), after: named("my-name") })), /dive ideas\.briefed is named after its feat, so it takes no other name/);
	await before(ctx({ before: named("ideas.briefed"), after: named("ideas.briefed") }));
});

test("a dive held or packed is not dropped; one over by its link, one never jumped, or a mint, passes", async () => {
	const planned = dive("shape-before-drop");
	await assert.rejects(before(planned.ctx({ before: state({ feat: "a", diver: "diver@example.com#0123456789ab" }) })), /dive ideas\.briefed is held by diver@example\.com: it is not over, so it is not dropped; land or bail it first/);
	await assert.rejects(before(planned.ctx({ before: state({ feat: "a", diver: null, packer: "diver@example.com" }) })), /dive ideas\.briefed was packed by diver@example\.com, unfinished: jump it and finish it/);
	await before(planned.ctx({ before: state({ feat: "a" }) }));
	await before({ after: state({ feat: "a" }) } as never);
	for (const rel of ["jumped", "packed"]) {
		const open = dive(`shape-before-drop-${rel}`, rel);
		await assert.rejects(before(open.ctx({ before: state({ feat: "a", diver: null }) })), new RegExp(`dive ideas\\.briefed is ${rel}, unfinished: jump it and finish it, landing or bailing it, then drop it`), "an open link says it is not over, whatever its meta");
	}
	for (const rel of ["landed", "bailed"]) {
		const over = dive(`shape-before-drop-${rel}`, rel);
		await before(over.ctx({ before: state({ feat: "a", diver: null, packer: "diver@example.com" }) }));
	}
});

test("any edit of a held dive is refused, saying to record a turn or pack it; a packed, over or unjumped one is edited", async () => {
	const held = dive("shape-before-held-edit");
	const heldMeta = { feat: "a", diver: "diver@example.com#0123456789ab" };
	await assert.rejects(before(held.ctx({ before: state(heldMeta), after: state(heldMeta) })), /dive ideas\.briefed is held by diver@example\.com, so its doc changes only through the loop: record a turn with `pass --turn` instead, or pack it first/);
	const jumped = dive("shape-before-held-link", "jumped");
	await assert.rejects(before(jumped.ctx({ before: state({ feat: "a" }), after: state({ feat: "a" }) })), /dive ideas\.briefed is held, so its doc changes only through the loop/, "a jumped link holds it, whatever its meta");
	for (const [rel, meta] of [["packed", { feat: "a", diver: null, packer: "diver@example.com" }], ["landed", { feat: "a", diver: "diver@example.com#0123456789ab" }], ["bailed", { feat: "a", diver: "diver@example.com#0123456789ab" }], ["planned", { feat: "a" }]] as const) {
		const open = dive(`shape-before-edit-${rel}`, rel);
		await before(open.ctx({ before: state(meta), after: state(meta) }));
	}
});
