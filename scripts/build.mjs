import { build } from 'esbuild';
import { copyFile, mkdir, readFile, writeFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import { currentBuildInfo } from './build-version.mjs';

const root = fileURLToPath(new URL('../', import.meta.url));
const source = path.join(root, 'src');
const output = path.join(root, 'dist');
const outputAssets = path.join(output, 'assets');
const buildInfo = currentBuildInfo(root);
const gameSounds = await Promise.all(
  ['deal', 'knock', 'shuffle', 'hover', 'win'].map(
    async (name) =>
      'data:audio/mpeg;base64,' +
      (await readFile(path.join(source, 'assets/sound', name + '.mp3'))).toString('base64'),
  ),
);
await mkdir(outputAssets, { recursive: true });
await mkdir(path.join(outputAssets, 'sound'), { recursive: true });
// The BGM stays external files: inlining several minutes of audio would bloat the bundle.
for (const name of ['theme-1.m4a', 'theme-2.m4a']) {
  await copyFile(path.join(source, 'assets/sound', name), path.join(outputAssets, 'sound', name));
}
for (const name of ['favicon.svg', 'favicon.png', 'apple-touch-icon.png']) {
  await copyFile(path.join(source, 'assets', name), path.join(outputAssets, name));
}
// Keep the HTML documents small and readable. Bundled JavaScript and CSS remain
// external files so the generated pages have the same structure as the source templates.
const pages = [
  ['index.html', 'main.js', 'index.css'],
  ['performance.html', 'performance.js', 'performance.css'],
];
for (const [page, entry, cssName] of pages) {
  const bundle = await build({
    entryPoints: [path.join(source, entry)],
    bundle: true,
    write: false,
    format: 'iife',
    target: 'es2022',
    charset: 'utf8',
    legalComments: 'inline',
    define: {
      __GAME_SOUNDS__: JSON.stringify(gameSounds),
      __BUILD_VERSION__: JSON.stringify(buildInfo.version),
    },
  });
  let html = await readFile(path.join(source, page), 'utf8');
  const css = [];
  for (const match of [
    ...html.matchAll(/<link\s+rel="stylesheet"\s+href="\.\/(.*?)"\s*\/?\s*>/g),
  ]) {
    css.push(await readFile(path.join(source, match[1]), 'utf8'));
    html = html.replace(match[0], '');
  }
  await writeFile(path.join(outputAssets, cssName), css.join('\n'), 'utf8');
  const jsName = entry.replace(/\.js$/, '.bundle.js');
  await writeFile(path.join(outputAssets, jsName), bundle.outputFiles[0].text, 'utf8');
  html = html.replace(
    `<script type="module" src="./${entry}"></script>`,
    `<script defer src="./assets/${jsName}"></script>`,
  );
  html = html.replace('</head>', `  <link rel="stylesheet" href="./assets/${cssName}">\n</head>`);
  html = html.replace(/^[ \t]+$/gm, '');
  await writeFile(path.join(output, page), html);
  console.log(`Built ${page} with assets/${jsName} and assets/${cssName}`);
}
await writeFile(path.join(output, 'version.json'), JSON.stringify(buildInfo, null, 2) + '\n');
console.log(buildInfo.version);
