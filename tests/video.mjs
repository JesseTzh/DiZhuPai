import { mkdir, readdir, rename, rm } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = fileURLToPath(new URL('../', import.meta.url));
export const videoDir = path.join(root, 'test-results', 'videos');
// 桌面脚本统一用这个视口,录出来的视频画布即满幅 1080p。
export const FULL_HD = { width: 1920, height: 1080 };
// 手机脚本统一用这个横屏视口。19.5:9 = 13:6;录制器只写偶数尺寸(奇数宽会被向下取整,
// 845 就变成了 844),所以取偶数档 858×396,画布与视口一致即精确 19.5:9 满幅横屏录像。
export const PHONE_LANDSCAPE = { width: 858, height: 396 };

// 以入口脚本命名视频,合并后的脚本按自身名字落盘。
export const videoName = () => path.basename(process.argv[1] ?? 'browser', '.mjs');

// 打开一个录制 webm 的页面;视频在页面/浏览器关闭后才写完,之后调用 save() 固定命名。
// Playwright 的录制器只把 viewport 帧"等比缩小装进"视频画布(从不放大),再把余下部分
// 补成灰边,所以画布必须与 viewport 完全一致视频才是满幅:桌面脚本传 1920×1080 视口
// 得到完整 1080p;移动视口脚本(如 entry 的手机段)按 858×396 横屏原样录制(精确 19.5:9)。
// save() 只做搬运,失败时降级为告警,避免掩盖测试本身的断言错误。
export async function openRecording(browser, name, options = {}) {
  const dir = path.join(videoDir, name);
  await mkdir(dir, { recursive: true });
  const viewport = options.viewport ?? FULL_HD;
  const page = await browser.newPage({
    ...options,
    viewport,
    recordVideo: { dir, size: viewport },
  });
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
