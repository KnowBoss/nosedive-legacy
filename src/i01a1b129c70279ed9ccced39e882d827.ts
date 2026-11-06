import type { ActionCall } from "nosedive-core";
import { idf324b14b9135de2893fffa8705388da } from "./idf324b14b9135de2893fffa8705388da.ts";

export async function i01a1b129c70279ed9ccced39e882d827(call: ActionCall): Promise<void> {
	switch (call.usage) {
		case "udf324b14b9135de2893fffa8705388da": // dehydrate-repo.workspace <repo> [--force]
			return idf324b14b9135de2893fffa8705388da(call.args, call.ctx);
		default:
			throw new Error(`dehydrate-repo.workspace has no impl for ${call.usage}`);
	}
}
