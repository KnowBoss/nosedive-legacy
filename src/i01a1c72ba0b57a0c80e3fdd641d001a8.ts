import type { GateCtx, KbDoc } from "nosedive-core";
import { i01a13354845c7253a55b60bba87285d8 as findKbDoc } from "nosedive-core";
import { kingsmetal } from "nosedive-core";
import { type State } from "./i01a1c72ba0a67a64836f167c23ffa097.ts";

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
};

/** The dive doc's new text and the commit's message for a change, as of the doc given: nothing is written, so the caller can commit it off to the side. */
export function i01a1c72ba0b57a0c80e3fdd641d001a8(doc: KbDoc, change: Change): { text: string; message: string } {
	for (const [key, value] of Object.entries(change.meta ?? {})) {
		if (value === null) doc.yaml.deleteIn(["meta", key]);
		else doc.yaml.setIn(["meta", key], value);
	}
	const meta = (doc.yaml.toJS() as { meta?: Record<string, unknown> }).meta;
	if (meta && Object.keys(meta).length === 0) doc.yaml.delete("meta");
	if (change.scopes) doc.yaml.set("scopes", change.scopes);
	const body = withSection(doc.body, change.label, change.lines);
	kingsmetal(doc.yaml);
	return { text: `---\n${doc.yaml.toString({ lineWidth: 0 })}---\n${body}`, message: `${change.action}(${String(doc.fm.name)}): ${change.summary}` };
}

/** The text and message for a section appended to the exact doc read from a planned parent; writes no file or ref. */
export function sectionChange(doc: KbDoc, heading: string, lines: string[], message: { action: string; summary: string }): { text: string; message: string } {
	const body = `${doc.body.replace(/\n*$/, "\n")}\n${heading}\n\n${lines.join("\n")}\n`;
	return { text: `---\n${doc.yaml.toString({ lineWidth: 0 })}---\n${body}`, message: `${message.action}(${String(doc.fm.name)}): ${message.summary}` };
}

/** A body with a `## <iso time> <label>` section appended, as every record of a dive heads its own. */
export function withSection(body: string, label: string, lines: string[]): string {
	return `${body.replace(/\n*$/, "\n")}\n## ${new Date().toISOString()} ${label}\n\n${lines.join("\n")}\n`;
}
