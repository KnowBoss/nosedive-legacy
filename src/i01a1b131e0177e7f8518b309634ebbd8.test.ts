import assert from "node:assert/strict";
import { writeFileSync } from "node:fs";
import { join } from "node:path";
import { test } from "node:test";
import { i01a1335480c776ba8945020d0af333eb as mintUuid } from "nosedive-core";
import { i01a1335485c67c95b7efdf2f0e03cfd6 as findBridge } from "nosedive-core";
import { fixture } from "../test/harness.ts";
import { i01a1b131e0177e7f8518b309634ebbd8 as findRepo } from "./i01a1b131e0177e7f8518b309634ebbd8.ts";

test("finds a repo by quid or name, and refuses a name two repos share", () => {
	const f = fixture("find");
	const hero = findBridge(f.hero)!;
	assert.equal(String(findRepo(hero, f.repoId).fm.name), "data");
	assert.equal(String(findRepo(hero, "data").fm.id), f.repoId);
	const twin = mintUuid();
	writeFileSync(join(f.hero, ".nosedive", "repos", `${twin}.md`), `---\nkind: repo\nid: ${twin}\nname: data\ngist: "Twin"\n---\n\n# data\n`);
	assert.throws(() => findRepo(hero, "data"), /data names 2 repos/);
	assert.equal(String(findRepo(hero, twin).fm.gist), "Twin");
});
