import assert from "node:assert/strict";
import { test } from "node:test";
import { fixture, git } from "../test/harness.ts";
import { i552b992cd74d50a489e0b2c84fcc203b as hydrate } from "./i552b992cd74d50a489e0b2c84fcc203b.ts";

test("hydrates a repo by name detached at trunk, and --read-only changes nothing", async () => {
	const f = fixture("trunk");
	await hydrate({ repo: "data", readOnly: true }, f.ctx);
	assert.equal(git(f.checkout, "rev-parse", "HEAD"), git(f.remote, "rev-parse", "main"));
	assert.equal(git(f.checkout, "rev-parse", "--abbrev-ref", "HEAD"), "HEAD");
});

test("hydrates a repo by quid detached at --at, and leaves an existing checkout where it is", async () => {
	const f = fixture("at");
	await hydrate({ repo: f.repoId, ref: f.first }, f.ctx);
	assert.equal(git(f.checkout, "rev-parse", "HEAD"), f.first);
	await hydrate({ repo: "data", ref: "main" }, f.ctx);
	assert.equal(git(f.checkout, "rev-parse", "HEAD"), f.first);
	assert.ok(f.err.some((line) => /workspace\/data is at .*, not main, and is left there/.test(line)));
});

test("a repo the hero does not register is refused", async () => {
	const f = fixture("unknown");
	await assert.rejects(hydrate({ repo: "nope" }, f.ctx), /no repo nope is registered in this hero/);
});
