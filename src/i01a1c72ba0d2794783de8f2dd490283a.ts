import type { ActionCall } from "nosedive-core";
import { i6164926c34715ab39455948b647cbb0e } from "./i6164926c34715ab39455948b647cbb0e.ts";

export async function i01a1c72ba0d2794783de8f2dd490283a(call: ActionCall): Promise<void> {
	switch (call.usage) {
		case "u6164926c34715ab39455948b647cbb0e": { // pass --turn <dive> [<summary>] [--next <gist>] [--label <label>]
			if (!call.gate) throw new Error("turn runs through pass");
			// GateCtx does not carry stdin; the action call owns that input.
			const args = { ...call.gate.args };
			if (args.summary === "-") args.summary = await call.ctx.stdin();
			return i6164926c34715ab39455948b647cbb0e({ ...call.gate, args });
		}
		default:
			throw new Error(`turn has no impl for ${call.usage}`);
	}
}
