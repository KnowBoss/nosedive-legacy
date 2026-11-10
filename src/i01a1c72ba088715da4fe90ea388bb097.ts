import type { ActionCall } from "nosedive-core";
import { ia159fdc01ac85e4f831dc1c523787ce6 } from "./ia159fdc01ac85e4f831dc1c523787ce6.ts";

export async function i01a1c72ba088715da4fe90ea388bb097(call: ActionCall): Promise<void> {
	switch (call.usage) {
		case "ua159fdc01ac85e4f831dc1c523787ce6": // bail [<dive>] --reason <why>
			return ia159fdc01ac85e4f831dc1c523787ce6(call.args, call.ctx);
		default:
			throw new Error(`bail has no impl for ${call.usage}`);
	}
}
