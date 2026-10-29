import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, mkdir, readFile, rm, writeFile } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { buildVersion } from '../scripts/build-version.mjs';
import { preparePages } from '../scripts/pages-site.mjs';

test('版本使用北京时间、7 位源码 SHA 和构建环境', () => {
  const input = { now: new Date('2026-10-25T16:05:00Z'), sha: 'abcdef1234567890' };
  assert.equal(buildVersion({ ...input, channel: 'prod' }), 'Version:261026-0005-abcdef1-prod');
  assert.equal(buildVersion({ ...input, channel: 'test' }), 'Version:261026-0005-abcdef1-test');
  assert.throws(() => buildVersion({ ...input, channel: 'preview' }));
  assert.throws(() => buildVersion({ ...input, sha: 'unknown', channel: 'prod' }));
});

test('轮流发布两个分支，保留另一版本，移除当前版本的旧文件', async () => {
  const root = await mkdtemp(path.join(os.tmpdir(), 'dizhupai-pages-'));
  const bundle = path.join(root, 'bundle');
  const previous = path.join(root, 'previous');
  const output = path.join(root, 'output');
  const output2 = path.join(root, 'output2');
  try {
    await mkdir(bundle);
    await mkdir(path.join(previous, 'test'), { recursive: true });
    await writeFile(path.join(previous, '.git'), '不应发布的 Git 数据');
    await writeFile(path.join(previous, 'index.html'), '正式版旧');
    await writeFile(path.join(previous, 'old.js'), '正式版旧文件');
    await writeFile(path.join(previous, 'CNAME'), 'example.com');
    await writeFile(path.join(previous, 'test/index.html'), '测试版旧');
    await writeFile(path.join(previous, 'test/old.js'), '测试版旧文件');
    await writeFile(path.join(bundle, 'index.html'), '正式版新');
    await preparePages({ bundle, previous, output, channel: 'prod' });
    assert.equal(await readFile(path.join(output, 'index.html'), 'utf8'), '正式版新');
    assert.equal(await readFile(path.join(output, 'test/index.html'), 'utf8'), '测试版旧');
    assert.equal(await readFile(path.join(output, 'CNAME'), 'utf8'), 'example.com');
    await assert.rejects(readFile(path.join(output, 'old.js')));
    await assert.rejects(readFile(path.join(output, '.git')));
    await writeFile(path.join(bundle, 'index.html'), '测试版新');
    await preparePages({ bundle, previous: output, output: output2, channel: 'test' });
    assert.equal(await readFile(path.join(output2, 'index.html'), 'utf8'), '正式版新');
    assert.equal(await readFile(path.join(output2, 'test/index.html'), 'utf8'), '测试版新');
    assert.equal(await readFile(path.join(output2, '.nojekyll'), 'utf8'), '');
    await assert.rejects(readFile(path.join(output2, 'test/old.js')));
    await assert.rejects(
      preparePages({ bundle, previous: path.join(root, 'missing'), output, channel: 'test' }),
      /缺少正式版/,
    );
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});
