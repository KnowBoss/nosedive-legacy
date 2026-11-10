import type { ActionCall } from "nosedive-core";
import { i0e2024913efd5dc8afe194f5650bda20 } from "./i0e2024913efd5dc8afe194f5650bda20.ts";
import { ia65e6ec583fa51079af219fd79e4ad87 } from "./ia65e6ec583fa51079af219fd79e4ad87.ts";

export async function i01a1c72ba06b7cfd9e5f710dc60e4a37(call: ActionCall): Promise<void> {
	switch (call.usage) {
		case "u0e2024913efd5dc8afe194f5650bda20": // jump [<ref>]
			return i0e2024913efd5dc8afe194f5650bda20(call.args, call.ctx);
		case "ua65e6ec583fa51079af219fd79e4ad87": // jump [<ref>] --sure
			return ia65e6ec583fa51079af219fd79e4ad87(call.args, call.ctx);
		default:
			throw new Error(`jump has no impl for ${call.usage}`);
	}
}
