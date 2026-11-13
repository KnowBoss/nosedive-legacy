import type { GateCtx } from "nosedive-core";
import { i01a13354845c7253a55b60bba87285d8 as findKbDoc } from "nosedive-core";
import { i01a13354894273b1be253424511ba82c as commitFiles } from "nosedive-core";
import { i01a1335483aa776cb84df698b04adc06 as writeKbDoc } from "nosedive-core";
import { diveLinks, moveLinks, type State } from "./i01a1c72ba0a67a64836f167c23ffa097.ts";

export type Hero = GateCtx["bridge"];
export type Doc = NonNullable<ReturnType<typeof findKbDoc>>;

export type Change = {
	/** Names the commit: `<action>(<dive name>): <summary>`, the loop's command first. */
	action: string;
	/** Names the section: `## <iso time> <label>`. */
	label: string;
	summary: string;
	/** The state the dive's link moves to, on every doc that holds one: jump, pack, land and bail move it. */
	state?: State;
	/** Fields of `meta` to set; null clears one. */
	meta?: Record<string, unknown>;
	/** The dive's scopes, replaced whole. */
	scopes?: unknown[];
	lines: string[];
	/** Other hero files the same commit carries. */
	also?: string[];
};

/** `version` is the core's, named in the co-author trailer of the commit. */
export function i01a1c72ba0b57a0c80e3fdd641d001a8(hero: Hero, doc: Doc, change: Change, version: string): void {
	for (const [key, value] of Object.entries(change.meta ?? {})) {
		if (value === null) doc.yaml.deleteIn(["meta", key]);
		else doc.yaml.setIn(["meta", key], value);
	}
	const meta = (doc.yaml.toJS() as { meta?: Record<string, unknown> }).meta;
	if (meta && Object.keys(meta).length === 0) doc.yaml.delete("meta");
	if (change.scopes) doc.yaml.set("scopes", change.scopes);
	const body = withSection(doc.body, change.label, change.lines);
	writeKbDoc(doc.path, doc.yaml, body);
	doc.body = body;
	const linkers = change.state ? moveLinks(diveLinks(hero).get(String(doc.fm.id)) ?? { state: change.state, by: [] }, String(doc.fm.id), change.state) : [];
	commitFiles(hero.dir, [...new Set([doc.path, ...linkers.map((linker) => linker.path), ...(change.also ?? [])])], `${change.action}(${String(doc.fm.name)}): ${change.summary}`, version);
}

/** A body with a `## <iso time> <label>` section appended, as every record of a dive heads its own. */
export function withSection(body: string, label: string, lines: string[]): string {
	return `${body.replace(/\n*$/, "\n")}\n## ${new Date().toISOString()} ${label}\n\n${lines.join("\n")}\n`;
}
