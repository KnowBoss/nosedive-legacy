import type { ActionCall } from "nosedive-core";
import { i0190147b40b25ca2b1d03135a75a3502 } from "./i0190147b40b25ca2b1d03135a75a3502.ts";

export async function i01a1b129ca537ef6973626eeeaebc87c(call: ActionCall): Promise<void> {
	switch (call.usage) {
		case "u0190147b40b25ca2b1d03135a75a3502": // record.gate --gist <gist> --feat <feat> [--name <name>] [--action <action>] [--flaky]
			return i0190147b40b25ca2b1d03135a75a3502(call.args, call.ctx);
		default:
			throw new Error(`record.gate has no impl for ${call.usage}`);
	}
}
