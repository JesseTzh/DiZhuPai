import { mkdir, readdir, rename, rm } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = fileURLToPath(new URL('../', import.meta.url));
export const videoDir = path.join(root, 'test-results', 'videos');
// CI 报告统一按 1080p 回放;viewport 保持各脚本原值,录制器会把画面等比缩放进视频并补边。
const videoSize = { width: 1920, height: 1080 };

// 以入口脚本命名视频:home-browser 被 save-browser 复用时,两次运行各自落盘互不覆盖。
export const videoName = () => path.basename(process.argv[1] ?? 'browser', '.mjs');

// 打开一个录制 1080p webm 的页面;视频在页面/浏览器关闭后才写完,之后调用 save() 固定命名。
// save() 只做搬运,失败时降级为告警,避免掩盖测试本身的断言错误。
export async function openRecording(browser, name, options = {}) {
  const dir = path.join(videoDir, name);
  await mkdir(dir, { recursive: true });
  const page = await browser.newPage({ ...options, recordVideo: { dir, size: videoSize } });
  return {
    page,
    save: async () => {
      try {
        const files = (await readdir(dir)).filter((file) => file.endsWith('.webm'));
        if (files.length !== 1) {
          console.warn(`[video] ${name}: 预期 1 个 webm,实际 ${files.length} 个`);
          return;
        }
        await rename(path.join(dir, files[0]), path.join(videoDir, `${name}.webm`));
        await rm(dir, { recursive: true, force: true });
      } catch (error) {
        console.warn(`[video] ${name}: 录像收尾失败 ${error.message}`);
      }
    },
  };
}
