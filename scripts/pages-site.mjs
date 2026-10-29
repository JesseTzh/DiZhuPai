import { cp, mkdir, readdir, rm, stat, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { pathToFileURL } from 'node:url';

const exists = async (file) =>
  stat(file).then(
    () => true,
    () => false,
  );

// Pages 每次替换整个站点。先复制已发布内容，再替换当前分支的目录。
export async function preparePages({ bundle, previous, output, channel }) {
  if (!['prod', 'test'].includes(channel)) throw new Error('发布环境必须是 prod 或 test');
  if (!(await exists(path.join(bundle, 'index.html')))) throw new Error('缺少构建入口');
  await rm(output, { recursive: true, force: true });
  await mkdir(output, { recursive: true });
  if (await exists(previous)) {
    for (const name of await readdir(previous)) {
      if (name === '.git') continue;
      await cp(path.join(previous, name), path.join(output, name), { recursive: true });
    }
  }
  if (channel === 'prod') {
    for (const name of await readdir(output)) {
      if (name === 'test' || name === 'CNAME') continue;
      await rm(path.join(output, name), { recursive: true, force: true });
    }
  } else {
    if (!(await exists(path.join(output, 'index.html')))) {
      throw new Error('缺少正式版，请先完成 main 分支发布');
    }
    await rm(path.join(output, 'test'), { recursive: true, force: true });
  }
  const target = channel === 'test' ? path.join(output, 'test') : output;
  await cp(bundle, target, { recursive: true });
  await writeFile(path.join(output, '.nojekyll'), '');
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const [bundle, previous, output, channel] = process.argv.slice(2);
  await preparePages({ bundle, previous, output, channel });
}
