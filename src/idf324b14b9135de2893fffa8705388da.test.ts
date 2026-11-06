import assert from "node:assert/strict";
import { existsSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { test } from "node:test";
import { fixture } from "../test/harness.ts";
import { i552b992cd74d50a489e0b2c84fcc203b as hydrate } from "./i552b992cd74d50a489e0b2c84fcc203b.ts";
import { idf324b14b9135de2893fffa8705388da as dehydrate } from "./idf324b14b9135de2893fffa8705388da.ts";

test("dehydrates a clean checkout, and refuses one holding changes until --force", async () => {
	const f = fixture("dehydrate");
	await hydrate({ repo: "data" }, f.ctx);
	await dehydrate({ repo: "data" }, f.ctx);
	assert.equal(existsSync(f.checkout), false);

	await hydrate({ repo: "data" }, f.ctx);
	writeFileSync(join(f.checkout, "README.md"), "changed\n");
	await assert.rejects(dehydrate({ repo: "data" }, f.ctx));
	assert.equal(existsSync(f.checkout), true);
	await dehydrate({ repo: "data", force: true }, f.ctx);
	assert.equal(existsSync(f.checkout), false);
	assert.ok(f.out.includes("workspace/data: removed"));
});
