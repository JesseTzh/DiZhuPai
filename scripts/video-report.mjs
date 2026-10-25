// 汇总浏览器测试的 1080p 录像、截图与结果为离线报告 test-results/report/index.html,
// CI 上传在 playwright-results 工件里,下载解压后用 Chrome/Edge 打开即可回放(WebM 编码)。
import { appendFile, mkdir, readFile, readdir, stat, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = fileURLToPath(new URL('../', import.meta.url));
const resultsDir = path.join(root, 'test-results');
const videoDir = path.join(resultsDir, 'videos');

// 与 ci.yml 的运行顺序一致;failed.txt 由工作流在脚本失败时追加脚本名。
const scripts = [
  ['entry-browser', '入场序列(桌面 + 移动视口)'],
  ['interactions-browser', '交互、悬停与弹层'],
  ['home-browser', '首页与金币物理动画'],
  ['save-browser', '存档管理'],
  ['browser', '对局主流程'],
  ['gameplay-browser', '玩法规则(顺子/压牌/炸弹/王炸/赖子/过牌/收牌)'],
  ['shop-browser', '商店流程'],
  ['mobile-game-browser', '手机端触控对局(390×844 竖屏)'],
  ['ui-pages', '页面结构与音效'],
  ['responsive-browser', '响应式布局(手机/小窗/笔记本/全高清)'],
  ['performance-browser', '性能采样(只留指标,不录像)'],
];
const jsonEvidence = {
  browser: 'browser-report.json',
  'ui-pages': 'ui-pages-report.json',
  'responsive-browser': 'responsive-report.json',
  'performance-browser': 'performance-report.json',
};

const esc = (text) => String(text).replace(/[&<>"']/g, (ch) => `&#${ch.charCodeAt(0)};`);
const exists = async (target) => !!(await stat(target).catch(() => false));
const listDir = async (dir) => ((await exists(dir)) ? readdir(dir) : []);

const failed = new Set(
  (await readFile(path.join(resultsDir, 'failed.txt'), 'utf8').catch(() => ''))
    .split('\n')
    .map((line) => line.trim())
    .filter(Boolean),
);

// 已收尾的录像在 videos/<名字>.webm;断言中断时视频尚未改名,收在 videos/<名字>/ 子目录里,
// 同样已随浏览器关闭写完,一并纳入报告并标记为"中断段"。
const videos = [];
for (const entry of await listDir(videoDir)) {
  const full = path.join(videoDir, entry);
  if ((await stat(full)).isDirectory()) {
    for (const file of (await readdir(full)).filter((name) => name.endsWith('.webm')))
      videos.push({ name: entry, src: `../videos/${entry}/${file}`, leftover: true });
  } else if (entry.endsWith('.webm')) {
    videos.push({ name: entry.replace(/\.webm$/, ''), src: `../videos/${entry}` });
  }
}
const scriptOf = (name) => scripts.find(([key]) => name === key || name.startsWith(`${key}-`))?.[0];
const scriptOrder = new Map(scripts.map(([key], index) => [key, index]));
videos.sort(
  (a, b) =>
    (scriptOrder.get(scriptOf(a.name)) ?? 99) - (scriptOrder.get(scriptOf(b.name)) ?? 99) ||
    a.name.localeCompare(b.name),
);

const shots = (await listDir(resultsDir)).filter((file) => file.endsWith('.png')).sort();

let perfRuns = [];
try {
  perfRuns =
    JSON.parse(await readFile(path.join(resultsDir, 'performance-report.json'), 'utf8')).runs ?? [];
} catch {}

const hasVideo = (key) =>
  videos.some((video) => video.name === key || video.name.startsWith(`${key}-`));
const rows = [];
for (const [key, label] of scripts) {
  const evidence =
    hasVideo(key) ||
    (jsonEvidence[key] && (await exists(path.join(resultsDir, jsonEvidence[key]))));
  const status = failed.has(key) ? 'fail' : evidence ? 'pass' : 'skip';
  rows.push({
    key,
    label,
    status,
    videos: videos.filter((video) => video.name === key || video.name.startsWith(`${key}-`)),
  });
}

const badge = { fail: '失败', pass: '通过', skip: '未运行' };
const runLink =
  process.env.GITHUB_SERVER_URL && process.env.GITHUB_REPOSITORY && process.env.GITHUB_RUN_ID
    ? ` · <a href="${process.env.GITHUB_SERVER_URL}/${process.env.GITHUB_REPOSITORY}/actions/runs/${process.env.GITHUB_RUN_ID}">本次 CI 运行</a>`
    : '';
const banner = rows.some((row) => row.status === 'fail')
  ? `<div class="banner">以下脚本失败:${rows
      .filter((row) => row.status === 'fail')
      .map((row) => `<strong>${esc(row.key)}</strong>`)
      .join('、')},详情见录像与 CI 日志。</div>`
  : '';

const statusTable = `<table><thead><tr><th>脚本</th><th>内容</th><th>状态</th><th>录像</th></tr></thead><tbody>${rows
  .map(
    (row) =>
      `<tr><td><code>${esc(row.key)}</code></td><td>${esc(row.label)}</td>` +
      `<td><span class="badge ${row.status}">${badge[row.status]}</span></td>` +
      `<td>${row.videos.map((video) => `<a href="${esc(video.src)}">${esc(path.basename(video.src))}</a>`).join('<br>') || '—'}</td></tr>`,
  )
  .join('')}</tbody></table>`;

const videoSections = rows
  .filter((row) => row.videos.length > 0)
  .map(
    (row) =>
      `<section><h3><code>${esc(row.key)}</code> <span class="badge ${row.status}">${badge[row.status]}</span></h3>` +
      row.videos
        .map(
          (video) =>
            `<p class="src">${esc(video.src)}${video.leftover ? ' · 断言中断前的录制段' : ''}</p>` +
            `<video controls preload="metadata" src="${esc(video.src)}"></video>`,
        )
        .join('') +
      `</section>`,
  )
  .join('');

const gallery = shots.length
  ? `<div class="gallery">${shots
      .map(
        (file) =>
          `<figure><a href="../${esc(file)}" target="_blank"><img loading="lazy" src="../${esc(file)}" alt="${esc(file)}"></a><figcaption>${esc(file)}</figcaption></figure>`,
      )
      .join('')}</div>`
  : '<p>暂无截图。</p>';

const perfTable = perfRuns.length
  ? `<table><thead><tr><th>DPR</th><th>负载</th><th>FPS</th><th>最慢 1s</th><th>P99 ms</th><th>基线 FPS</th></tr></thead><tbody>${perfRuns
      .map(
        (run) =>
          `<tr><td>${run.scale}×</td><td>${run.density}×</td><td>${run.fps.toFixed(1)}</td>` +
          `<td>${run.minWindowFps.toFixed(1)}</td><td>${run.p99Ms.toFixed(1)}</td><td>${run.baselineFps.toFixed(1)}</td></tr>`,
      )
      .join('')}</tbody></table>`
  : '<p>暂无性能数据。</p>';

const html = `<!doctype html>
<html lang="zh-CN">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>地主牌 · Playwright 录像报告</title>
<style>
  :root { color-scheme: light dark; }
  body { margin: 0 auto; padding: 24px; max-width: 1080px; font: 15px/1.6 system-ui, -apple-system, sans-serif; }
  h1 { font-size: 22px; } h2 { font-size: 18px; margin-top: 36px; } h3 { font-size: 16px; margin: 24px 0 8px; }
  .meta { color: #777; } .banner { margin: 16px 0; padding: 10px 14px; border-radius: 8px; background: #fdecea; color: #8c1d18; }
  .badge { display: inline-block; padding: 1px 10px; border-radius: 99px; font-size: 12px; }
  .badge.pass { background: #e3f5e8; color: #116329; } .badge.fail { background: #fdecea; color: #8c1d18; }
  .badge.skip { background: #eee; color: #555; }
  table { border-collapse: collapse; width: 100%; margin: 12px 0; }
  th, td { border: 1px solid #ddd; padding: 6px 10px; text-align: left; }
  video { width: 100%; max-width: 960px; border-radius: 8px; background: #000; }
  .src { color: #777; font-size: 12px; margin: 4px 0; }
  .gallery { display: grid; grid-template-columns: repeat(auto-fill, minmax(220px, 1fr)); gap: 12px; }
  figure { margin: 0; } img { width: 100%; border-radius: 8px; border: 1px solid #ddd; }
  figcaption { font-size: 12px; color: #777; word-break: break-all; }
  footer { margin-top: 40px; color: #777; font-size: 13px; }
  @media (prefers-color-scheme: dark) {
    th, td, img { border-color: #444; } .banner { background: #47151a; color: #f5b0ae; }
    .badge.pass { background: #12351d; color: #7ee2a0; } .badge.fail { background: #47151a; color: #f5b0ae; }
    .badge.skip { background: #333; color: #aaa; }
  }
</style>
</head>
<body>
<h1>地主牌 · Playwright 浏览器测试录像</h1>
<p class="meta">生成于 ${new Date().toLocaleString('zh-CN')}${runLink} · 录像画布与各脚本视口一致(桌面 1920×1080,手机 390×844)(WebM)</p>
${banner}
<h2>结果总览</h2>
${statusTable}
<h2>录像回放</h2>
${videoSections || '<p>暂无录像。</p>'}
<h2>截图</h2>
${gallery}
<h2>性能采样</h2>
${perfTable}
<footer>视频为 WebM 编码,请用 Chrome / Edge 打开本报告;桌面脚本以 1920×1080 视口满幅录制,手机脚本按 390×844 竖屏原尺寸录制,画布与视口一致、无黑边补齐。</footer>
</body>
</html>
`;

await mkdir(path.join(resultsDir, 'report'), { recursive: true });
await writeFile(path.join(resultsDir, 'report', 'index.html'), html);

if (process.env.GITHUB_STEP_SUMMARY) {
  const lines = [
    '## 🎬 Playwright 浏览器测试录像',
    '',
    '| 脚本 | 状态 | 录像 |',
    '| --- | --- | --- |',
    ...rows.map(
      (row) =>
        `| \`${row.key}\` | ${failed.has(row.key) ? '❌ 失败' : row.status === 'pass' ? '✅ 通过' : '⏭️ 未运行'} | ${row.videos.length || '—'} |`,
    ),
    '',
    '录像与截图在 Artifact **playwright-results** 里,下载解压后打开 `report/index.html` 回放(WebM 请用 Chrome/Edge 打开)。',
    '',
  ];
  await appendFile(process.env.GITHUB_STEP_SUMMARY, lines.join('\n'));
}

const counted = rows.map((row) => `${row.key}=${badge[row.status]}`).join(' ');
console.log(
  `录像 ${videos.length} 段、截图 ${shots.length} 张;报告已写入 test-results/report/index.html`,
);
console.log(counted);
