import type { ActionCall } from "nosedive-core";
import { i552b992cd74d50a489e0b2c84fcc203b } from "./i552b992cd74d50a489e0b2c84fcc203b.ts";

export async function i01a1b129c3b876719f5521826bd5a66b(call: ActionCall): Promise<void> {
	switch (call.usage) {
		case "u552b992cd74d50a489e0b2c84fcc203b": // hydrate-repo.workspace <repo> [--at <ref>] [--read-only]
			return i552b992cd74d50a489e0b2c84fcc203b(call.args, call.ctx);
		default:
			throw new Error(`hydrate-repo.workspace has no impl for ${call.usage}`);
	}
}
