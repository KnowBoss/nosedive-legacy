import { appendFileSync } from "node:fs";
import { relative } from "node:path";
import type { Args, Ctx } from "nosedive-core";
import { i01a1335485c67c95b7efdf2f0e03cfd6 as findBridge } from "nosedive-core";
import { i01a147171f057d019118aaa1f269f5fd as findKind } from "nosedive-core";
import { i01a1335480c776ba8945020d0af333eb as mintUuid } from "nosedive-core";
import { i01a141f869c07c4da8288927a559c8ae as mintKbDoc } from "nosedive-core";
import { i01a1471723807d6e8ef228ad9472fff7 as readText } from "nosedive-core";
import { i01a1b131e0177e7f8518b309634ebbd8 as findRepo } from "./i01a1b131e0177e7f8518b309634ebbd8.ts";
import { i01a1b13770be7a7a95b5e4ae9eed1407 as linkNewDoc } from "./i01a1b13770be7a7a95b5e4ae9eed1407.ts";

const SLUG = /^[a-z0-9]+(-[a-z0-9]+)*$/;

export async function i58b390d976c95aa4bc065fbc8605e404(args: Args, ctx: Ctx): Promise<void> {
	const hero = findBridge(ctx.cwd);
	if (!hero) throw new Error("note works in a hero repo, and this is not one");
	const words = [args.gist].flat().map(String);
	const kind = words[0]?.endsWith(":") && SLUG.test(words[0].slice(0, -1)) ? words.shift()!.slice(0, -1) : "memo";
	const gist = words.join(" ").trim();
	if (!gist) throw new Error("a note needs a gist");
	if (!findKind(kind, hero, ctx.capes)) throw new Error(`this hero has no kind ${kind}`);
	let scope = typeof args.scope === "string" ? args.scope : undefined;
	if (!scope) {
		const bridge = hero.config.bridge;
		if (typeof bridge !== "string") throw new Error("name the repo the note is about with --scope <repo>: this hero's config names no bridge repo");
		scope = bridge;
	}
	const repo = findRepo(hero, scope);
	if (!args.scope) ctx.out(`scoped to ${String(repo.fm.name)}, the bridge repo`);

	const id = mintUuid();
	const slug = gist.toLowerCase().replace(/[^a-z0-9]+/g, " ").trim().split(" ").filter(Boolean).slice(0, 6).join("-");
	const name = `${slug}-${id.slice(-6)}`;
	const title = typeof args.title === "string" ? args.title : slug.charAt(0).toUpperCase() + slug.slice(1).replace(/-/g, " ");
	const doc = mintKbDoc(hero.kbDir, { kind, id, name, gist, title });
	if (typeof args.body === "string") appendFileSync(doc.path, `\n${(await readText(args.body, ctx)).trimEnd()}\n`);
	linkNewDoc(hero, ctx.capes[0]!.version, { action: "note", what: name }, { fromId: String(repo.fm.id), docId: id, docPath: doc.path, attrs: { rel: `${kind}.note` } });
	ctx.out(relative(hero.dir, doc.path).replace(/\\/g, "/"));
}
