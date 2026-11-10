import type { ActionCall } from "nosedive-core";
import { i5f74ee87748f528b9fd9b00a48c2275b } from "./i5f74ee87748f528b9fd9b00a48c2275b.ts";

export async function i01a1c72ba0797d52baaa1a9bba46a525(call: ActionCall): Promise<void> {
	switch (call.usage) {
		case "u5f74ee87748f528b9fd9b00a48c2275b": // pack [<dive>]
			return i5f74ee87748f528b9fd9b00a48c2275b(call.args, call.ctx);
		default:
			throw new Error(`pack has no impl for ${call.usage}`);
	}
}
