import type { Bridge, KbDoc } from "nosedive-core";
import { i01a138b2b8ee703cab227b010f588b6a as locateKbDoc } from "nosedive-core";
import { i01a18e2a3b4b798d98068d4778a158e6 as docKind } from "nosedive-core";
import { git, repoDocs } from "./i01a1b131e0177e7f8518b309634ebbd8.ts";
import { LEGACY_ID } from "./i01a1c72ba0a67a64836f167c23ffa097.ts";

/** Work's seeded id, which owns work's dive kind. */
export const WORK_ID = "01a15bb1-da9e-7d2d-aa82-5ee97257adc6";

export type Scope = { repoId: string; ref?: string };
export type HeldDive = { id: string; doc: KbDoc & { path: string }; featId: string | undefined; scopes: Scope[] };

/** A dive branch, as legacy's loop and work's both name it: `nosedive-<holder token>-<dive id>`. */
const DIVE_BRANCH = /^nosedive-([0-9a-f]{12})-([0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12})$/;

/** Whether a doc is of legacy's dive kind or of work's, so a hero wearing both tests a dive whichever loop jumped it. */
export function isDive(doc: { fm: Record<string, unknown>; path: string }): boolean {
	const kind = docKind(doc);
	return (kind.owner === LEGACY_ID || kind.owner === WORK_ID) && kind.name === "dive";
}

/** The doc's scope entries keyed by a repo the hero registers, each with its pinned ref. */
export function scopesOf(hero: Bridge, doc: { fm: Record<string, unknown> }): Scope[] {
	const registered = new Set(repoDocs(hero).map((repo) => String(repo.fm.id)));
	const entries = (Array.isArray(doc.fm.scopes) ? doc.fm.scopes : []).flatMap((entry): [string, unknown][] =>
		typeof entry === "string" ? [[entry, undefined]] : entry && typeof entry === "object" ? Object.entries(entry) : [],
	);
	return entries
		.filter(([repoId]) => registered.has(repoId))
		.map(([repoId, value]) => {
			const ref = (value as Record<string, unknown> | null | undefined)?.ref;
			return typeof ref === "string" ? { repoId, ref } : { repoId };
		});
}

/** The dive the hero's branch names, open and held under that branch's token, or nothing when the hero is on no dive branch. */
export function i01a1b131e1947fa5b316b390a3be2415(hero: Bridge): HeldDive | undefined {
	const parsed = DIVE_BRANCH.exec(git(hero.dir, "symbolic-ref", "-q", "--short", "HEAD").text);
	if (!parsed) return undefined;
	const [, token, id] = parsed as unknown as [string, string, string];
	const found = locateKbDoc(hero, id);
	if (!found || found.repoDir !== hero.dir || !isDive(found)) return undefined;
	const name = String(found.fm.name);
	const meta = (found.fm.meta ?? {}) as Record<string, unknown>;
	if (typeof meta.outcome === "string") throw new Error(`dive ${name} is over: it ${meta.outcome}`);
	if (typeof meta.diver !== "string" || meta.diver.split("#")[1] !== token) throw new Error(`dive ${name} is not held under this branch's token`);
	return { id, doc: found, featId: typeof meta.feat === "string" ? meta.feat : undefined, scopes: scopesOf(hero, found) };
}
