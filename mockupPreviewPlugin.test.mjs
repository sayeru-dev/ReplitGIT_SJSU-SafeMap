import assert from "node:assert/strict";
import { mkdtemp, mkdir, readFile, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import test from "node:test";
import { mockupPreviewPlugin } from "./mockupPreviewPlugin.ts";

async function withRoot(run) {
  const root = await mkdtemp(path.join(os.tmpdir(), "mockup-discovery-"));
  try {
    const plugin = mockupPreviewPlugin();
    plugin.configResolved({ root });
    await run(root, plugin);
  } finally {
    await rm(root, { recursive: true, force: true });
  }
}

test("discovers nested TSX previews and excludes private, hidden and non-TSX files", async () => {
  await withRoot(async (root, plugin) => {
    const files = [
      "Card.tsx", "nested/Detail.tsx", "_Private.tsx",
      "_helpers/Hidden.tsx", "nested/_Hidden.tsx", ".hidden/Secret.tsx",
      ".Secret.tsx", "notes.txt",
    ];
    for (const file of files) {
      const target = path.join(root, "src/components/mockups", file);
      await mkdir(path.dirname(target), { recursive: true });
      await writeFile(target, "export default function Preview() { return null; }");
    }
    await plugin.buildStart();
    const generatedPath = path.join(root, "src/.generated/mockup-components.ts");
    const source = await readFile(generatedPath, "utf8");
    assert.match(source, /"\.\/components\/mockups\/Card\.tsx"/);
    assert.match(source, /"\.\/components\/mockups\/nested\/Detail\.tsx"/);
    assert.match(source, /import\("\.\.\/components\/mockups\/Card\.tsx"\)/);
    assert.doesNotMatch(source, /Private|Hidden|Secret|notes/);
    await plugin.buildStart();
    assert.equal(await readFile(generatedPath, "utf8"), source);
    await rm(path.join(root, "src/components/mockups/Card.tsx"));
    await plugin.buildStart();
    assert.doesNotMatch(await readFile(generatedPath, "utf8"), /Card\.tsx/);
  });
});

test("generates an empty registry when the mockups directory is absent", async () => {
  await withRoot(async (root, plugin) => {
    await plugin.buildStart();
    const source = await readFile(
      path.join(root, "src/.generated/mockup-components.ts"), "utf8",
    );
    assert.match(source, /export const modules: ModuleMap = \{\s*\};/);
  });
});
