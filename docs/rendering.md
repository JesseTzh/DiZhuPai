# 渲染管线

项目用原生 Canvas 2D 绘制整个 3D 场景，用一层薄 SVG 承接点击与可访问性标注。本文描述一帧画面如何从对局状态变成像素；模块职责边界见 [architecture.md](architecture.md)。

## 总览

| 层 | 文件 | 角色 |
| --- | --- | --- |
| 帧驱动 | `src/engine/figure.js` | 唯一的动画/重绘调度循环（rAF + 60ms 定时器兜底） |
| 渲染器外壳 | `src/engine/canvas-renderer.js` | 异步加载后端、重放最新状态、页面离开时释放 |
| 场景编排 | `src/game/cpu-renderer.js` | 组装一帧：相机、取景、底层、部件、排序、纸纹、交互外壳 |
| 布局描述 | `src/game/scene-frame.js` | 纯数据：每张牌/钱袋/金币/标签的位姿，不含任何绘制调用 |
| 部件收集 | `src/game/scene-parts.js` | 把布局变成带缓存键的画家部件，并累积阴影与命中区域 |
| 桌面底层 | `src/game/table-layer.js` | 桌面阴影、侧壁、桌面、纹理与道具软阴影 |
| 交互标注 | `src/game/scene-overlay.js` | 命中环、余牌数、赖子、钱袋、道具、标签的 SVG 片段 |
| 悬停 | `src/game/hover.js` | 手牌悬停进度：按时间戳求值（80ms 进 / 50ms 出） |
| 精灵缓存 | `src/engine/sprite-cache.js` | 保留连续两帧不变的部件位图，并按键缓存投影结果 |
| 画布基类 | `src/engine/cpu-canvas.js` | 投影、路径、多边形、阴影、贴图、纸纹等图元 |
| 游戏模型 | `src/game/model-canvas.js` | 牌、金币、钱袋的几何与绘制，位于 `CPUCanvas` 之上 |
| 相机 | `src/engine/camera.js` | 朝向固定的斜二测投影（可选透视）、深度排序键 |
| 光照 | `src/engine/shading.js` | 三色阶平面着色、可见性判定、阴影方向 |
| 交互外壳 | `src/engine/svg-dom.js` | `patchSvg` 对 overlay 做最小 DOM 补丁 |
| 倍率 | `src/engine/render-pixel-ratio.js` | 渲染像素比设置（`?dpr=` / 本地存储） |

SVG 字符串图元（`engine/stage3d.js`、`engine/primitives.js`）仍服务商店、道具美术与牌面资产；对局页只走 Canvas 后端（`#fig[data-renderer="cpu"]`）。金币与钱袋旧的 SVG 整帧场景（`coinScene`、`sackSvg`、`coinSvg` 等）和未被引用的 `coins/renderer.js`、`coins/cpu-renderer.js` 已删除，金币模块只保留物理与几何。

## 一帧的流程

入口是 `ui.render()`（`figure.js`），它调用 `renderScene(st, PALS[st.pal])`，最终到达 `cpu-renderer.js` 的 `draw(st, material)`：

1. **相机与取景** — `aim()`：`setCameraPitch(pitch, distance)`（首页俯视 90°、对局 68°；入场动画期间透视距离从很大收敛到 1800，静止时透视保持开启），再由 `fitScene` 把桌面包围盒适配 SVG viewBox，顶栏在场时按其下沿重定位画面中心。
2. **布局** — `sceneFrame(st)` 产出 `{ cards, bags, coins, labels }`。发牌、赖子翻面、收牌、出牌、入场坠落等动画全部在这里把「逻辑状态 + 时间」换算成位姿，渲染器不再插值。
3. **画布复位** — `canvas.begin()` 按 `renderPixelRatio()` 设置画布物理尺寸（乘渲染倍率，独立于 devicePixelRatio），清屏并写入 viewBox 变换。随后 `sprites.begin(view)`：`view` 由 `viewKey()`（俯仰、透视距离、原点、光照）与 `transformKey()`（画布尺寸、缩放、平移）拼成，任何一项变化都清空精灵。
4. **按钮锚点** — 由手牌与出牌区的投影边缘求出按钮中线与间隙，结果按 `view` 与手牌数缓存。
5. **桌面底层** — `paintTable`（`table-layer.js`）：桌面阴影、侧壁、桌面多边形与纹理线、道具模糊软阴影。整层作为一个全画布精灵保留，相机静止时每帧只是一次位图搬运。
6. **收集部件** — `cardParts / bagParts / coinParts / itemParts`（`scene-parts.js`）。每个部件是 `{ at, key, extent, draw }`：`key` 写明除视图外决定像素的全部输入（牌：贴图、位姿、选中、余牌数；钱袋：形状键、位置、配色、每枚金币的模式与位姿；道具：id 与摆位），`null` 表示每帧都变。投影阴影轮廓与命中路径按 `key` 记忆，加入**阴影合批**与 overlay。
7. **单次阴影冲洗** — `flushShadows(B)`：所有部件阴影是不透明平色，合到一个 `Path2D` 里做一次裁剪、一次填充。
8. **画家排序** — `parts.sort(paintOrder)`：按部件中心的深度 `depthOf` 从后往前。分离盒 `sepOrder` 只在单个道具内部排序零件时使用。
9. **绘制部件** — `sprites.draw(canvas, key, extent, draw)`：键已有精灵则按整数像素偏移搬运；上一帧直接画过同一键则先画进精灵再搬运；否则直接画。部件本身：`canvas.card`（轮廓壳 + 贴图 + 描边）、`canvas.sack`（三层蒙皮 + 织纹 + 袋口金币）、`canvas.coin`（侧面按法线着色 + 端面贴图）、道具多面体。
10. **纸纹** — `canvas.finish(grain)` 用预生成的 64×64 噪声图案以 `source-atop` 叠一层纸面颗粒（始终画在主画布上，不进精灵）。
11. **交互外壳** — overlay 字符串与上一帧相同则跳过，否则 `patchSvg` 做属性级增量补丁（命中环、余牌数、标签、`data-hover` 进度）。

静止场景不重绘：`ui.invalidate()` 只请求下一帧画一次，`ui.animate(step)` 驱动连续动画并在所有步骤结束后停表。渲染器创建时拿到 `figure` 的 `ui` 作为宿主：悬停、窗口缩放、渲染设置与纸纹滑杆都只调用 `host.invalidate()`，不再另开 rAF 循环，因此悬停与其他动画同时进行时每帧只画一次。悬停进度是时间的函数（`hover.js`），绘制时按当前时间取值，仍在移动则再请求一帧。

## 精灵缓存

`SpriteCache`（`engine/sprite-cache.js`）把「连续两帧键相同」的部件画进独立的设备像素画布：

- 精灵保留主画布变换的亚像素相位，只在整数像素位置搬运；`source-over` 满足结合律，所以搬运结果与直接绘制一致。
- 只在键第二次出现时建精灵，移动中的部件（键每帧变化）不付额外代价；一帧没用到的精灵立即释放，画布进入复用池（上限 48）。
- `extent` 可以是函数，只在建精灵时求值；牌按板材八个角点、钱袋按蒙皮与可见金币、道具按顶点求视图包围盒，再外扩描边余量。
- 唯一可见差异：相邻牌共线的轮廓边。Chrome 的 GPU 画布按多重采样合成重叠边缘，精灵是已解析的半透明边，叠加后这一行抗锯齿像素略深。固定种子对局画面中差异像素约 0.07%，肉眼不可辨。

## 相机、可见性与着色

- **投影**（`camera.js`）：世界 x/y/z（z 向上）固定朝向 45°、可变俯仰；`P(x,y,z)` 返回屏幕坐标，无透视时是纯仿射。`Dv` 给位移向量的屏幕方向，`depthOf` 给朝向观察者的深度。
- **可见性**：面法线旋转到视基座后分量和为正即朝向观察者。该查询与「法线点乘光照」都被折叠成单个世界空间向量（`visDot`、`lightDots`），`setCameraPitch` / `setLight` 时刷新——热路径上每次查询只是一次点乘、零分配（`camera.js` ↔ `shading.js`）。
- **三色着色**（`shading.js`）：每个调色板 `{l,m,d}` 三档，`step3` 在阈值 ±0.18 内平滑过渡，旋转中的面不会跳色。室外物件随方位光 `tone`，室内/小道具用固定光 `toneI`。回归测试保证折叠点积与 `rotV` 参考实现逐点一致（`tests/rendering.test.mjs`）。
- **投影阴影**：把轮廓压到地面、沿光向偏移 0.45×高度后取凸包（`hull`），方向由方位角推导。

## 贴图与透视

- 牌面/牌背/金币印花在启动时由 SVG 栅格成离屏 canvas（`rasterArt`，`game/cpu-art.js`），之后全部走 `drawImage` 位图搬运，不再每帧重放矢量。
- `image()`（`cpu-canvas.js`）：无透视时直接一次仿射 `drawImage`；有透视时先投影四角，若最佳仿射拟合与真实四角的偏差 < 0.25 视图单位（金币、徽章等小印花），仍走单次仿射，否则分格贴图（`perspectiveImage`，宽幅牌面 3×3 网格）。每格一次仿射 `drawImage`，变换取四角对边的平均并以格心为中心；相邻格互相重叠一个纹素来消除接缝，不再逐三角形裁剪（旧实现每张牌 18 次 clip + drawImage，现在 9 次 drawImage、0 次 clip），外缘由调用方的牌面轮廓裁剪。

## 缓存清单

| 缓存 | 位置 | 失效条件 |
| --- | --- | --- |
| 部件精灵与投影记忆 | `sprite-cache.js` | 视图键变化，或部件一帧未出现 |
| 按钮锚点 | `cpu-renderer.js` `anchorControls` | 视图键、手牌数或布局缩放变化 |
| 桌面几何/纹理 | `table-geometry.js` | 按材质键常驻 |
| 道具模型 | `table-items.js` | 按道具 id 与摆位常驻 |
| 钱袋蒙皮 | `model-canvas.js` `sackGeometry` | 键 `fillShow:squash:punchT` 变化（鼓瘪动画本身需要重建） |
| 袋口底面与金币堆 | `model-canvas.js` `mouths`（WeakMap） | 随钱袋形状对象释放 |
| 静止金币几何 | `model-canvas.js` `restCoins`（WeakMap） | 金币位姿改变即失效 |
| 调色解析 | `shading.js` `rgb` | 常驻（输入只有调色板常量） |
| 印花位图 | `game/cpu-art.js` | 进程内单例 |
| 渲染倍率 | `render-pixel-ratio.js` | URL / 存储对象变化或设置事件 |
| overlay DOM | `svg-dom.js` `patchSvg` | 字符串比对不同才补丁 |

## 性能

### 2026-10 第二轮：保留精灵与绘制合批

整帧耗时（1280×720、DPR 2×、headless Chrome，`tests/.render-bench.mjs`：每个绘制帧后强制回读画布，计入 GPU 裁剪、模糊与搬运）：

| 负载 | 优化前 | 优化后 |
| --- | --- | --- |
| 发牌 / 出牌 / 转账 | 9.2 / 8.0 / 8.2 ms | 5.3 / 4.5 / 4.5 ms |
| 钱袋 / 金币物理 / 选牌 | 8.8 / 8.3 / 8.4 ms | 7.0 / 5.7 / 5.1 ms |
| 全负载叠加 | 11.8 ms | 8.9 ms |
| 对局中划过手牌（悬停） | 9.6 ms | 5.3 ms |

DPR 4× 下全负载 13.3 → 9.6 ms、悬停 10.8 → 7.1 ms。只计 JS 的 `renderMs`（`.render-profile.mjs`）：发牌 4.8 → 2.4、出牌 4.6 → 1.7、转账 5.2 → 2.4、全负载 7.0 → 4.7 ms。

手段：

- 桌面底层、静止的牌、钱袋与道具改为保留精灵；阴影轮廓、命中路径按部件键记忆。
- 透视贴图去掉逐三角形裁剪，改为每格一次仿射贴图。
- 牌堆侧边纸层合成一条路径一次描边（原来最多 53 次）。
- `skin()` 每个顶点只投影一次，直接写入分色路径，不再为每个面建 `Path2D`；金币侧面相邻同色面合并填充。
- 袋口底面与金币堆按形状缓存；织纹采样共用一次半径求值（前向差分求法线）；`mix()` 缓存调色板解析。
- 悬停并入 `figure` 帧驱动，消除与其他动画并行时的双重绘制。

画面对比（`.render-visual-diff.mjs`，固定种子静止牌桌）：96.7% 像素完全相同，3.2% 为亚像素级差异（通道和 ≤ 24），0.06% 超出，最大通道和 61，来源是格子贴图的亚像素重采样。手机横屏另有约 16 个像素在钱袋轮廓处：前向差分让个别织纹采样点的可见性翻转。

### 2026-10 第一轮

1280×720、DPR 2×、headless Chrome，`tests/.render-profile.mjs` 采样 `renderMs`：

| 负载 | 优化前 | 优化后 |
| --- | --- | --- |
| 发牌 / 出牌 / 转账 | 6.0 / 5.9 / 6.8 ms | 4.8 / 4.6 / 5.4 ms |
| 钱袋 / 金币物理 / 选牌 | 8.2 / 9.0 / 8.9 ms | 6.7 / 6.8 / 6.9 ms |
| 全负载叠加 | 10.5 ms | 8.2 ms |

手段：每帧 URL/存储解析改缓存（`render-pixel-ratio.js`）；可见性与光照查询折叠为单点乘；桌面阴影合批为一次填充；小印花透视贴图走仿射快速路径、宽幅细分从 4×4 降到 3×3；静止牌复用同一位姿几何；渲染器缓存稳定 DOM 锚点。

### 测量工具

均不进 `npm test`，需先 `npm run dev`：

- `.render-bench.mjs [base…]`：整帧耗时（含光栅），可同时传多个服务地址做前后对比。
- `.render-profile.mjs`：分负载采样 JS 渲染耗时。
- `.render-cpuprofile.mjs`：函数级自采样剖面，`LOAD=deal` 等只剖析一种动画。
- `.render-visual-diff.mjs before after`：两个构建的固定种子截图逐像素对比。

`npm run test:performance` 是正式门禁：真机前台跑严格 60Hz 阈值，headless 只做冒烟（见 `tests/performance-browser.mjs`）。
