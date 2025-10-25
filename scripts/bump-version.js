#!/usr/bin/env node
// ─────────────────────────────────────────────
// CareBell Auto Version Bumper
// Works on Node 20+ / Windows / Linux
// ─────────────────────────────────────────────
import fs from "fs";
import path from "path";
import { execSync } from "child_process";

const VERSION_FILE = path.resolve("shared/constants/version.js");
const BRANCH = execSync("git rev-parse --abbrev-ref HEAD").toString().trim();

// Only bump when pushing from dev
if (BRANCH !== "dev") {
  console.log(`ℹ️  Skipping version bump (branch = ${BRANCH})`);
  process.exit(0);
}

// Read current version
const file = fs.readFileSync(VERSION_FILE, "utf8");
const match = file.match(/APP_VERSION\s*=\s*"(.*?)"/);
if (!match) throw new Error("APP_VERSION not found in version.js");

let [major, minor, patch] = match[1].split(".").map(Number);

// Detect bump type (default = patch)
const commitMsg = execSync("git log -1 --pretty=%B").toString().toLowerCase();

let type = "patch";
if (commitMsg.includes("#minor")) type = "minor";
if (commitMsg.includes("#major")) type = "major";

if (type === "major") {
  major++;
  minor = 0;
  patch = 0;
} else if (type === "minor") {
  minor++;
  patch = 0;
} else {
  patch++;
}

const newVersion = `${major}.${minor}.${patch}`;
const date = new Date().toISOString();
const updated = file
  .replace(/APP_VERSION\s*=\s*".*?"/, `APP_VERSION = "${newVersion}"`)
  .replace(/BUILD_DATE\s*=\s*".*?"/, `BUILD_DATE = "${date}"`)
  .replace(/SOURCE_BRANCH\s*=\s*".*?"/, `SOURCE_BRANCH = "${BRANCH}"`);

fs.writeFileSync(VERSION_FILE, updated);
execSync(`git add ${VERSION_FILE}`);

console.log(`✅ Version bumped to ${newVersion} (${type})`);