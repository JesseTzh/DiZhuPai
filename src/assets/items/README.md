# 道具玩具美术资源

本目录是道具（玩具）美术的唯一源码入口：程序化 3D 模型、商店展示动画、顶栏 2D 图标与摆放配置，**一个道具一个文件**。商店柜台（`shop/scene.js`）、游戏桌面（`game/table-items.js`）和顶栏（`ui/topbar-art.js`）共用同一份几何体，不依赖 DOM 或交互状态。

| 文件          | 内容                                                                       |
| ------------- | -------------------------------------------------------------------------- |
| `palettes.js` | 玩具配色，浅/中/深三色一组                                                 |
| `frog.js`     | 好运青蛙（赖子）：模型、动画、图标、摆放                                   |
| `hand.js`     | 五指玩具手（三带二）：同上                                                 |
| `dragon.js`   | 中国龙玩具（大顺）：同上                                                   |
| `index.js`    | 注册表 `TOYS` 与统一出口：`buildToy` / `toyGeometry` / `toyPose` / `blend` |

## 每个道具文件导出的字段

| 字段             | 含义                                                                                                      |
| ---------------- | --------------------------------------------------------------------------------------------------------- |
| `REST`           | 静止姿势；展示动画结束必须回到这组数值，绘制才会停帧                                                      |
| `tablePose`      | 游戏桌面的姿势覆盖（如龙的抬头）；`null` 表示用 `REST`                                                    |
| `duration`       | 商店 hover 展示动画时长（秒）                                                                             |
| `pose(t)`        | 展示动画：时间 t → 姿势                                                                                   |
| `build(m, pose)` | 3D 模型：向 model 工厂添加凸体部件                                                                        |
| `icon`           | 顶栏 48×48 canvas 图标的路径层 `[path, fill]`（底座由调用方绘制）                                         |
| `shop`           | 柜台摆放：位置 `x/y`、缩放 `s`、底座 `standHalf/standExtend`、价签偏移 `priceOffset`、收回时长 `withdraw` |
| `table`          | 游戏桌面摆放坐标 `u/v`（world 单位）                                                                      |

## 约定

- 坐标为 toy units（≈ 1 cm × 3），+y 朝观众、z 朝上。桌面与柜台通过映射变换摆放，模型代码不感知场景。
- 部件是凸体 `{points, faces, palette:[浅,中,深]}`，由 `engine/stage3d.js` 的 `orb` / `rod` / `tube` 等图元构建；命名色（`'green'` 等）查 `palettes.js`。
- 道具 id 会在 DOM 中生成 `.toy-<id>`、`#table-item-<id>` 等选择器，并进入商店 SVG 的 `id=` 命名空间——避开引擎 SVG 滤镜已占用的 id（如 `hand`，`shop/scene.js` 有改名规避）。
- 商店 tooltip 默认居中；需要逐道具微调位置时在 `src/styles/shop.css` 加 `.toy-<id>` 规则（frog/dragon 有偏移，hand 用默认）。
- 数据（名称、价格、描述、效果文案）在 `src/game/items.js`；效果到玩法开关的映射由该文件的 `rule` 字段声明，`state.js` / `save.js` 按字段消费，不写死 id。

## 已知联动（未参数化）

- 赖子牌美术（`src/assets/cards/wild.js`）就是青蛙主题：frog 道具的 `rule` 是 `wildCard`；若新增 wild 类道具需同步该美术与 `game/wild-reveal.js`。
- 桌面摆放区域固定在钱袋角落（`game/table-items.js`），新道具的 `table.u/v` 需挑选不与钱袋、出牌区重叠的空位。

## 新增一个道具

1. 复制本目录任一道具文件为 `src/assets/items/<id>.js`，填写模型、动画、图标与摆放；
2. 在 `index.js` 注册（import + 加入 `TOYS`）；
3. 在 `src/game/items.js` 添加数据（名称、价格、描述与可选 `rule`）；
4. 需要时在 `src/styles/shop.css` 加 `.toy-<id>` tooltip 微调；
5. 运行 `npm test` 与 `npm run test:shop`——桌面几何与商店 DOM 契约测试会自动覆盖新道具。
