import { existsSync, mkdirSync, writeFileSync } from "node:fs";
import { join, relative, resolve } from "node:path";
import type { Args, Ctx } from "nosedive-core";
import { i01a1335485c67c95b7efdf2f0e03cfd6 as findBridge } from "nosedive-core";
import { i01a147171f057d019118aaa1f269f5fd as findKind } from "nosedive-core";
import { i01a1901e263b7209a4b5f39a71c568b3 as featWalk } from "nosedive-core";
import { i01a1335480c776ba8945020d0af333eb as mintUuid } from "nosedive-core";
import { i01a141f869c07c4da8288927a559c8ae as mintKbDoc } from "nosedive-core";
import { i01a1b13770be7a7a95b5e4ae9eed1407 as linkNewDoc } from "./i01a1b13770be7a7a95b5e4ae9eed1407.ts";

const QUID = /[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/i;

/** A stub that fails, so an unwritten gate is red, as legacy's record.gate wrote it. */
function stub(script: string): string {
	return [
		"export async function run(ctx) {",
		"\t// Minted by `nosedive record.gate` and deliberately failing: return false (or throw) when what it proves does not hold.",
		`\tconsole.error(\`gate \${ctx.gateId} is unimplemented: write the check in ${script}\`);`,
		"\treturn false;",
		"}",
		"",
	].join("\n");
}

export async function i0190147b40b25ca2b1d03135a75a3502(args: Args, ctx: Ctx): Promise<void> {
	const hero = findBridge(ctx.cwd);
	if (!hero) throw new Error("record.gate works in a hero repo, and this is not one");
	if (!findKind("gate", hero, ctx.capes)) throw new Error("this hero has no gate kind to mint a gate of");
	const action = args.action === undefined ? "test" : String(args.action);
	if (action !== "test" && action !== "land") throw new Error(`--action is test or land, not ${action}`);
	const featRef = String(args.feat);
	const path = resolve(ctx.cwd, featRef);
	const featId = (existsSync(path) ? QUID.exec(path.replace(/.*[\\/]/, "")) : QUID.exec(featRef))?.[0]?.toLowerCase();
	if (!featId || !featWalk(hero).feats.has(featId)) throw new Error(`${featRef} is no feat of this hero`);

	const id = mintUuid();
	const script = `${relative(hero.dir, join(hero.kbDir, "artifacts")).replace(/\\/g, "/")}/${id}.mjs`;
	const doc = mintKbDoc(hero.kbDir, { kind: "gate", id, gist: String(args.gist), ...(typeof args.name === "string" ? { name: args.name } : {}), meta: { "test-script": script } });
	mkdirSync(join(hero.kbDir, "artifacts"), { recursive: true });
	writeFileSync(join(hero.dir, script), stub(script));
	const attrs: Record<string, unknown> = { rel: `${action}.gate`, ...(args.flaky === true ? { "test-is-flaky": true } : {}) };
	linkNewDoc(hero, ctx.capes[0]!.version, { action: "record.gate", what: doc.name }, { fromId: featId, docId: id, docPath: doc.path, attrs }, [join(hero.dir, script)]);
	ctx.out(relative(hero.dir, doc.path).replace(/\\/g, "/"));
	ctx.out(`write its check in ${script}, then run it: nosedive test ${id}`);
}
