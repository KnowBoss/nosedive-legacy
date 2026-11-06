import type { ActionCall } from "nosedive-core";
import { iffb5aa30b4e659e68b40ad7dee378a62 } from "./iffb5aa30b4e659e68b40ad7dee378a62.ts";
import { i79c0bcc90fa55bff9c8e62fed26dfa9a } from "./i79c0bcc90fa55bff9c8e62fed26dfa9a.ts";

export async function i01a1b129c08179e5abdcc058f6a359a4(call: ActionCall): Promise<void> {
	switch (call.usage) {
		case "uffb5aa30b4e659e68b40ad7dee378a62": // test [--full]
			return iffb5aa30b4e659e68b40ad7dee378a62(call.args, call.ctx);
		case "u79c0bcc90fa55bff9c8e62fed26dfa9a": // test <gate>... [--via <doc>]
			return i79c0bcc90fa55bff9c8e62fed26dfa9a(call.args, call.ctx);
		default:
			throw new Error(`test has no impl for ${call.usage}`);
	}
}
