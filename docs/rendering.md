# 渲染管线

项目用原生 Canvas 2D 绘制整个 3D 场景，用一层薄 SVG 承接点击与可访问性标注。本文描述一帧画面如何从对局状态变成像素；模块职责边界见 [architecture.md](architecture.md)。

## 总览

| 层 | 文件 | 角色 |
| --- | --- | --- |
| 帧驱动 | `src/engine/figure.js` | 唯一的动画/重绘调度循环（rAF + 60ms 定时器兜底） |
| 渲染器外壳 | `src/engine/canvas-renderer.js` | 异步加载后端、重放最新状态、页面离开时释放 |
| 场景绘制 | `src/game/cpu-renderer.js` | 组装一帧：相机、布局、排序、绘制、交互外壳 |
| 布局描述 | `src/game/scene-frame.js` | 纯数据：每张牌/钱袋/金币/标签的位姿，不含任何绘制调用 |
| 画布基类 | `src/engine/cpu-canvas.js` | 投影、路径、多边形、阴影、贴图、纸纹等图元 |
| 游戏模型 | `src/game/model-canvas.js` | 牌、金币、钱袋的几何与绘制，位于 `CPUCanvas` 之上 |
| 相机 | `src/engine/camera.js` | 朝向固定的斜二测投影（可选透视）、深度排序键 |
| 光照 | `src/engine/shading.js` | 三色阶平面着色、可见性判定、阴影方向 |
| 交互外壳 | `src/engine/svg-dom.js` | `patchSvg` 对 overlay 做最小 DOM 补丁 |
| 倍率 | `src/engine/render-pixel-ratio.js` | 渲染像素比设置（`?dpr=` / 本地存储） |

历史上存在 SVG 保留模式后端（`engine/stage3d.js`、`engine/primitives.js` 输出 SVG 字符串），首页美术与牌面资产仍以 SVG 定义；对局页实际走 Canvas 后端（`#fig[data-renderer="cpu"]`），SVG 字符串后端不再用于整帧场景。

## 一帧的流程

入口是 `ui.render()`（`figure.js`），它调用 `renderScene(st, PALS[st.pal])`，最终到达 `cpu-renderer.js` 的 `draw(st, material)`：

1. **相机** — `setCameraPitch(pitch, distance)`：首页俯视 90°、对局 68°；入场动画期间透视距离从很大收敛到 1800，静止时透视保持开启。
2. **布局** — `sceneFrame(st)` 产出 `{ cards, bags, coins, labels }`。发牌、赖子翻面、收牌、出牌、入场坠落等动画全部在这里把「逻辑状态 + 时间」换算成位姿，渲染器不再插值。
3. **取景** — `fitScene` 把桌面世界坐标的包围盒投影后适配 SVG viewBox，顶栏在场时按其下沿重定位画面中心。
4. **画布复位** — `canvas.begin()` 按 `renderPixelRatio()` 设置画布物理尺寸（乘渲染倍率，独立于 devicePixelRatio），清屏并把 viewBox 变换写入 ctx。
5. **桌面** — 桌面投影阴影、侧壁（按法线取色）、桌面多边形与纹理线（`table-geometry.js` 按材质缓存）。
6. **收集部件** — 遍历 `frame.cards / bags / coins` 与桌上的道具，每项：算几何（牌为 `cardGeometry`，两圈轮廓 + 局部坐标系）、把投影轮廓加入**阴影合批**、往 `parts` 推 `{ at, box, draw }`。命中区域和标签累积成 SVG overlay 字符串。
7. **单次阴影冲洗** — `flushShadows(B)`：所有桌面阴影是不透明平色，合到一个 `Path2D` 里做一次裁剪、一次填充，与逐个填充像素等价（`cpu-canvas.js`）。道具阴影带模糊，单独绘制。
8. **画家排序** — `parts.sort(paintOrder)`：先按分离盒（`sepOrder`，x/y/z 任何一轴不相交即定序），否则按深度 `depthOf` 回到从前向后。
9. **绘制部件** — 依次 `part.draw()`：`canvas.card`（轮廓壳 + 贴图 + 描边）、`canvas.sack`（三层蒙皮 + 织纹 + 袋口金币）、`canvas.coin`（侧面按法线着色 + 端面贴图）、道具多面体。
10. **纸纹** — `canvas.finish(grain)` 用预生成的 64×64 噪声图案以 `source-atop` 叠一层纸面颗粒。
11. **交互外壳** — overlay 字符串与上一帧相同则跳过，否则 `patchSvg` 做属性级增量补丁（命中环、余牌数、标签、`data-hover` 进度）。

静止场景不重绘：`ui.invalidate()` 只请求下一帧画一次，`ui.animate(step)` 驱动连续动画并在所有步骤结束后停表。手牌悬停有独立的小循环（`cpu-renderer.js`），80ms 进 / 50ms 出，进度缓存为数值键。

## 相机、可见性与着色

- **投影**（`camera.js`）：世界 x/y/z（z 向上）固定朝向 45°、可变俯仰；`P(x,y,z)` 返回屏幕坐标，无透视时是纯仿射。`Dv` 给位移向量的屏幕方向，`depthOf` 给朝向观察者的深度。
- **可见性**：面法线旋转到视基座后分量和为正即朝向观察者。该查询与「法线点乘光照」都被折叠成单个世界空间向量（`visDot`、`lightDots`），`setCameraPitch` / `setLight` 时刷新——热路径上每次查询只是一次点乘、零分配（`camera.js` ↔ `shading.js`）。
- **三色着色**（`shading.js`）：每个调色板 `{l,m,d}` 三档，`step3` 在阈值 ±0.18 内平滑过渡，旋转中的面不会跳色。室外物件随方位光 `tone`，室内/小道具用固定光 `toneI`。回归测试保证折叠点积与 `rotV` 参考实现逐点一致（`tests/rendering.test.mjs`）。
- **投影阴影**：把轮廓压到地面、沿光向偏移 0.45×高度后取凸包（`hull`），方向由方位角推导。

## 贴图与透视

- 牌面/牌背/金币印花在启动时由 SVG 栅格成离屏 canvas（`rasterArt`，`game/cpu-art.js`），之后全部走 `drawImage` 位图搬运，不再每帧重放矢量。
- `image()`（`cpu-canvas.js`）：无透视时直接一次仿射 `drawImage`；有透视时先投影四角，若最佳仿射拟合与真实四角的偏差 < 0.25 视图单位（金币、徽章等小印花），仍走单次仿射，否则细分三角形逐格贴图（`perspectiveImage`，宽幅牌面 3×3 网格）。三角形之间用亚像素外扩与纹素 gutter 消除接缝。

## 缓存清单

| 缓存 | 位置 | 失效条件 |
| --- | --- | --- |
| 桌面几何/纹理 | `table-geometry.js` | 按材质键常驻 |
| 道具模型 | `table-items.js` | 按道具 id 常驻 |
| 钱袋蒙皮 | `model-canvas.js` `sackGeometry` | 键 `fillShow:squash:punchT` 变化（鼓瘪动画本身需要重建） |
| 静止金币几何 | `model-canvas.js` `restCoins`（WeakMap） | 金币位姿改变即失效 |
| 印花位图 | `game/cpu-art.js` | 进程内单例 |
| 渲染倍率 | `render-pixel-ratio.js` | URL / 存储对象变化或设置事件 |
| overlay DOM | `svg-dom.js` `patchSvg` | 字符串比对不同才补丁 |

## 性能

2026-10 优化（1280×720、DPR 2×、headless Chrome，`tests/.render-profile.mjs` 采样 `renderMs`）：

| 负载 | 优化前 | 优化后 |
| --- | --- | --- |
| 发牌 / 出牌 / 转账 | 6.0 / 5.9 / 6.8 ms | 4.8 / 4.6 / 5.4 ms |
| 钱袋 / 金币物理 / 选牌 | 8.2 / 9.0 / 8.9 ms | 6.7 / 6.8 / 6.9 ms |
| 全负载叠加 | 10.5 ms | 8.2 ms |

手段：每帧 URL/存储解析改缓存（`render-pixel-ratio.js`）；可见性与光照查询折叠为单点乘；桌面阴影合批为一次填充；小印花透视贴图走仿射快速路径、宽幅细分从 4×4 降到 3×3；静止牌复用同一位姿几何；渲染器缓存稳定 DOM 锚点。CPU 剖面（`tests/.render-cpuprofile.mjs`）中 `triangle`、`clip`、`vis` 从热点榜消失。

测量工具（均不进 `npm test`）：`.render-profile.mjs` 分负载采样 JS 渲染耗时；`.render-cpuprofile.mjs` 输出函数级自采样剖面；`.render-visual-diff.mjs` 对两个构建的固定种子截图做逐像素对比。`npm run test:performance` 是正式门禁：真机前台跑严格 60Hz 阈值，headless 只做冒烟（见 `tests/performance-browser.mjs`）。
