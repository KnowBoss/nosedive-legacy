import type { ActionCall } from "nosedive-core";
import { i58b390d976c95aa4bc065fbc8605e404 } from "./i58b390d976c95aa4bc065fbc8605e404.ts";

export async function i01a1b13078b173229a3b1e21f7e12c20(call: ActionCall): Promise<void> {
	switch (call.usage) {
		case "u58b390d976c95aa4bc065fbc8605e404": // note <gist>... [--scope <repo>] [--title <title>] [--body <source>]
			return i58b390d976c95aa4bc065fbc8605e404(call.args, call.ctx);
		default:
			throw new Error(`note has no impl for ${call.usage}`);
	}
}
