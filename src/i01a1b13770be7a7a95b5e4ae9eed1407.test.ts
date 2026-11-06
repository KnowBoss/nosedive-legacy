import assert from "node:assert/strict";
import { readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { test } from "node:test";
import { i01a1335480c776ba8945020d0af333eb as mintUuid } from "nosedive-core";
import { i01a1335485c67c95b7efdf2f0e03cfd6 as findBridge } from "nosedive-core";
import { fixture, git } from "../test/harness.ts";
import { i01a1b13770be7a7a95b5e4ae9eed1407 as linkNewDoc } from "./i01a1b13770be7a7a95b5e4ae9eed1407.ts";

test("links a new doc from an existing one and commits both with the files beside them, naming the feat", () => {
	const f = fixture("link");
	const id = mintUuid();
	const path = f.path(id);
	writeFileSync(path, `---\nkind: memo\nid: ${id}\nname: new\ngist: "New"\n---\n\n# New\n`);
	const extra = join(f.hero, "kb", "artifacts", "extra.txt");
	writeFileSync(extra, "extra\n");
	linkNewDoc(findBridge(f.hero)!, "test", { action: "note", what: "new" }, { fromId: f.featId, docId: id, docPath: path, attrs: { rel: "memo.note" } }, [extra]);
	assert.equal(git(f.hero, "status", "--porcelain"), "");
	assert.match(git(f.hero, "log", "-1", "--format=%s"), /^feat\(ideas\): note new$/);
	assert.match(readFileSync(f.path(f.featId), "utf8"), new RegExp(`- kb/${id}.md:\\s+rel: memo.note`));
	assert.equal(git(f.hero, "show", "--name-only", "--format=", "HEAD").split("\n").length, 3);
});
