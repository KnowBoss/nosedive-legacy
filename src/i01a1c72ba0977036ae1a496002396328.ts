import type { ActionCall } from "nosedive-core";
import { i3b8461aa9eac5f10837c2515b5231e78 } from "./i3b8461aa9eac5f10837c2515b5231e78.ts";

export async function i01a1c72ba0977036ae1a496002396328(call: ActionCall): Promise<void> {
	switch (call.usage) {
		case "u3b8461aa9eac5f10837c2515b5231e78": // land [<dive>]
			return i3b8461aa9eac5f10837c2515b5231e78(call.args, call.ctx);
		default:
			throw new Error(`land has no impl for ${call.usage}`);
	}
}
