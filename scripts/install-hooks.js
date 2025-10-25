#!/usr/bin/env node
import fs from "fs";
import path from "path";

const srcDir = path.resolve("scripts/git-hooks");
const dstDir = path.resolve(".git/hooks");

fs.mkdirSync(dstDir, { recursive: true });
for (const file of fs.readdirSync(srcDir)) {
  const src = path.join(srcDir, file);
  const dst = path.join(dstDir, file);
  fs.copyFileSync(src, dst);
  fs.chmodSync(dst, 0o755);
  console.log(`✅ Installed ${file} hook`);
}