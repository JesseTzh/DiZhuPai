import test from 'node:test';
import assert from 'node:assert/strict';
import { readdir, readFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { build } from 'esbuild';

const root = fileURLToPath(new URL('../', import.meta.url));
const source = path.join(root, 'src');
async function sourceFiles(directory) {
  const entries = await readdir(directory, { withFileTypes: true });
  return (
    await Promise.all(
      entries.map((entry) => {
        const file = path.join(directory, entry.name);
        return entry.isDirectory() ? sourceFiles(file) : /\.(js|css)$/.test(file) ? [file] : [];
      }),
    )
  ).flat();
}

test('handwritten modules stay small and application entry only assembles components', async () => {
  for (const file of await sourceFiles(source)) {
    const name = path.relative(root, file);
    const limit = name === 'src/main.js' ? 160 : 400;
    const lines = (await readFile(file, 'utf8')).trimEnd().split('\n').length;
    assert.ok(lines <= limit, `${name}: ${lines} lines exceeds ${limit}; split by responsibility`);
  }
});

test('engine stays independent, domain logic avoids UI, and module imports remain acyclic', async () => {
  const files = (await sourceFiles(source)).filter((file) => file.endsWith('.js'));
  const { metafile } = await build({
    absWorkingDir: root,
    entryPoints: files,
    outdir: 'test-results/architecture',
    outbase: source,
    bundle: true,
    write: false,
    metafile: true,
    logLevel: 'silent',
  });
  const graph = Object.fromEntries(
    Object.entries(metafile.inputs).map(([name, input]) => [
      name,
      input.imports.filter((item) => !item.external).map((item) => item.path),
    ]),
  );
  const domain = new Set([
    'src/game/rules.js',
    'src/game/economy.js',
    'src/game/state.js',
    'src/game/save.js',
    'src/game/items.js',
    'src/game/random.js',
  ]);
  const visiting = new Set(),
    visited = new Set();
  function visit(name) {
    assert.ok(!visiting.has(name), `Circular import through ${[...visiting, name].join(' → ')}`);
    if (visited.has(name)) return;
    visiting.add(name);
    for (const dependency of graph[name] || []) {
      if (name.startsWith('src/engine/'))
        assert.ok(dependency.startsWith('src/engine/'), `${name} must not import ${dependency}`);
      if (domain.has(name))
        assert.ok(
          !/^src\/(app|ui|shop|engine)\//.test(dependency),
          `${name} must not import ${dependency}`,
        );
      visit(dependency);
    }
    visiting.delete(name);
    visited.add(name);
  }
  Object.keys(graph).forEach(visit);
});
