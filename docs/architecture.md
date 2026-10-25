# 代码结构与开发约定

项目采用原生 ES Modules、Canvas 2D 和 SVG 交互外壳，无框架、CDN 或 WebGPU 后端。新增功能先找到下表对应模块，保持入口只做组装。

## 职责分布

| 位置 | 职责 |
| --- | --- |
| `src/main.js` | 创建状态、连接控制器和页面、保留 `window.gameApp` 调试接口 |
| `src/app/game-controller.js` | 玩家操作、电脑计时、发牌/转账/关间动画、恢复对局；通过回调通知视图 |
| `src/app/navigation.js` | 首页/存档/设置/牌桌切换、浏览器历史、页面焦点、音效启停与随机种子入口 |
| `src/app/save-session.js` | 单槽存档、本地存储、自动保存去重、导入提交与导出 |
| `src/ui/*-screen.js` | 设置页、存档页的 DOM 与事件；存档解析委托给 `game/save.js` |
| `src/ui/game-view.js`、`game-keyboard.js` | 对局 HUD、按钮、结算、商店反馈及键盘绑定 |
| `src/ui/home-art.js`、`home-title.js`、`home-models.js` | 首页动画/碰撞、标题笔画数据、真实模型预绘制 |
| `src/game/rules.js`、`state.js`、`items.js`、`random.js` | 纯规则、对局状态变化、道具定义、种子随机派生；不接触 DOM、计时器和存储 |
| `src/game/save.js` | 存档格式、严格校验、序列化、恢复归一化及旧存档迁移 |
| `src/game/scene.js`、`scene-frame.js`、`transfer.js` | 动画状态推进、场景布局描述、金币转账轨迹 |
| `src/game/cpu-renderer.js`、`model-canvas.js`、`table-geometry.js` | 场景排序/命中外壳、牌/金币/钱袋绘制、桌面几何 |
| `src/engine/` | 通用相机、数学、光照、Canvas/SVG 图元、渲染生命周期和动画调度 |
| `src/cards/`、`coins/`、`shop/` | 牌模型、金币/钱袋物理与几何、商店视图和玩具美术 |
| `src/assets/` | 原始牌面美术、栅格化工具、音效；牌面导出规则见 `cards/README.md` |
| `src/performance.js`、`ui/performance.js` | 独立性能页及采样面板，复用真实场景和模型 |
| `src/styles/` | `game.css` 对局/菜单，`settings.css` 设置，`home-layout.css` 首页基础布局，`home.css` 首页美术/存档，其他按功能命名 |

## 依赖与状态边界

- `main → app / ui → game / cards / coins / shop → engine / assets` 表示主要调用方向。`engine` 只依赖自身；具体业务模型放在 `game/model-canvas.js`，不回塞到通用 Canvas。
- `game/rules.js`、`state.js`、`save.js`、`items.js`、`random.js` 不依赖 `app`、`ui`、`shop` 或 `engine`；所有模块禁止循环导入。跨模块协作用显式参数、返回值或回调，不新增全局服务对象。
- 随机种子经 `?seed=` 或首页输入框指定后随存档保存；`deal`/`enterShop` 按（种子, 用途, 局数）派生独立随机流，同一种子加相同决策可整场复现，未指定时保持真随机。浏览器测试统一用固定种子 `dizhupai-347` 访问。
- `game` 保存可持久化规则状态，`visual` 保存动画状态；定时器、操作锁、动画进度和音频不写入存档。恢复时保留状态对象引用，重置动画并取消过期电脑任务。
- `save-session` 管理三个栏位与当前栏位，`save.js` 负责数据可信性；导入须先校验，覆盖已有栏位须确认，删除须二次点击。写入失败保留现有对局并提示导出。
- `scene-frame` 描述布局，不绘制、不加载资源；`ModelCanvas` 复用 `CPUCanvas` 投影与图元。游戏、首页模型和性能页共用模型实现，避免复制绘制算法。
- 动画任务交给 `mountFigure().animate()`，重绘交给 `ui.render()`；不要为业务动画另建帧循环。首页动画、手牌悬浮和性能采样有独立生命周期，离开页面或暂停后停止相应绘制。

## 文件与验证约束

- 手写 JS/CSS 每文件最多 **400 行**，`main.js` 最多 **160 行**；接近上限时按职责拆分。不要靠压缩行数、无意义转发模块或 `utils.js` 杂物箱绕过。完整职责可小于上限，不要求机械拆碎。
- 样式按页面归属放置，响应式规则跟随所属模块。HTML 显式声明 CSS 顺序，首页基础布局先于 `home.css`，避免跨文件重复覆盖。保留首页旧布局规则时需注意最终美术样式的覆盖关系。
- `src/index.html`、`src/performance.html` 是开发入口，`npm run dev` 直接服务 `src/`。`npm run build` 将发布 HTML 和 JS/CSS bundle 输出到 `dist/`，不提交到 Git；牌面 SVG 和总览通过 `npm run assets:cards` 更新。Docker 多阶段构建执行发布命令，再将 `dist/` 交给 Nginx；`.agents/skills/` 不参与应用构建。
- `npm test` 自动检查文件行数、引擎/规则依赖边界和循环导入，并验证规则、存档与渲染。提交前另跑 `npm run build`、`npm run format:check`；涉及交互跑 `test:home`、`test:browser`、`test:shop`，涉及性能再跑 `test:performance`。
- 新增模块或改变职责边界时同步更新本页。生成素材和构建产物不受手写 JS/CSS 行数限制；调整限制必须说明职责与原因。

`window.gameApp` / `window.performanceApp` 仅用于调试；`ready()` 等待渲染器初始化。`window.cardPerformance` 区分真实 rAF 采样和同步提交耗时，后者不能当作 FPS。
