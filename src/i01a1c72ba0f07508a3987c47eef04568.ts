import type { ActionCall } from "nosedive-core";
import { i98e9ab6e1535570abad65bf95895aa3d } from "./i98e9ab6e1535570abad65bf95895aa3d.ts";
import { i7c5c26ef056c5803a6607b86db00c4d0 } from "./i7c5c26ef056c5803a6607b86db00c4d0.ts";

export async function i01a1c72ba0f07508a3987c47eef04568(call: ActionCall): Promise<void> {
	switch (call.usage) {
		case "u98e9ab6e1535570abad65bf95895aa3d": // before crud dive
			return i98e9ab6e1535570abad65bf95895aa3d(call.gate!);
		case "u7c5c26ef056c5803a6607b86db00c4d0": // after crud dive
			return i7c5c26ef056c5803a6607b86db00c4d0(call.gate!);
		default:
			throw new Error(`dive-shape has no impl for ${call.usage}`);
	}
}
