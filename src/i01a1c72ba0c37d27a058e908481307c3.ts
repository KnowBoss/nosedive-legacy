import { spawnSync } from "node:child_process";

export function i01a1c72ba0c37d27a058e908481307c3(cwd: string, ...args: string[]): { ok: boolean; text: string } {
	const result = spawnSync("git", args, { cwd, encoding: "utf8" });
	return { ok: result.status === 0, text: (result.status === 0 ? result.stdout : result.stderr || result.stdout || result.error?.message || "").trim() };
}
