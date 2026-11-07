import { execFileSync } from "node:child_process";
import { assertCurrentRelease } from "./lib/deploy-identity.mjs";

const candidate = process.env.GITHUB_SHA;
const remote = execFileSync("git", ["ls-remote", "--exit-code", "origin", "refs/heads/main"], { encoding: "utf8", timeout: 30000 }).trim();
const rows = remote.split("\n").map((row) => row.split(/\s+/));
const main = rows.length === 1 && rows[0][1] === "refs/heads/main" ? rows[0][0] : undefined;
assertCurrentRelease(candidate, main);
console.log(`Current main verified: ${candidate}`);
