import { relative } from "node:path";
import type { Bridge } from "nosedive-core";
import { i01a14ab1d36771eea2bc6f13bdeb0526 as editKbDocs } from "nosedive-core";
import { i01a133588bcc7f8bae725ff70d8f6800 as updateKbDocField } from "nosedive-core";
import { i01a133588b1f7d4ea13f1b5e79f02e4c as mergeKeyedEntries } from "nosedive-core";
import { i01a1335483aa776cb84df698b04adc06 as writeKbDoc } from "nosedive-core";
import { i01a13354894273b1be253424511ba82c as commitFiles } from "nosedive-core";
import { i01a19005c109715583553072f4e38dc4 as commitSubject } from "nosedive-core";

/**
 * Links the new doc at `docPath` from the doc `fromId` with `attrs`, then commits the link, the new doc and `files` in
 * one commit, `<feat>(<action>): <what>` as core's commit-subject names it.
 */
export function i01a1b13770be7a7a95b5e4ae9eed1407(
	hero: Bridge,
	version: string,
	commit: { action: string; what: string },
	link: { fromId: string; docId: string; docPath: string; attrs: Record<string, unknown> },
	files: string[] = [],
): void {
	const edit = editKbDocs(hero.dir, version);
	const key = relative(hero.dir, link.docPath).replace(/\\/g, "/");
	updateKbDocField(edit, link.fromId, "links", (links) => mergeKeyedEntries(links, { [key]: link.attrs }));
	const from = edit.doc(link.fromId);
	writeKbDoc(from.path, from.yaml, from.body);
	commitFiles(hero.dir, [link.docPath, from.path, ...files], commitSubject(hero, commit.action, commit.what, [link.docId, link.fromId]), version);
}
