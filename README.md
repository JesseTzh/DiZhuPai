<h1 align="center">地主牌</h1>

<p align="center">DIzhuPai · 受小丑牌启发，以斗地主为原型的卡片肉鸽游戏，纯 Web 实现。</p>

<p align="center"><a href="https://jessetzh.github.io/DiZhuPai/">在线试玩 →</a></p>

## 金币规则

- 新游戏有 500 金币。电脑金币无限。
- 过牌费用是本轮双方最后一次出牌总点数的绝对差。多张牌逐张求和。本轮尚未出牌的一方按 0 点计算。
- 3 至 K 计 3 至 13 点，A 计 14 点，2 计 15 点，小王计 18 点，大王计 20 点。点数不改变牌的大小顺序。
- 过牌或使用小老鼠收牌后，本轮计数清零。口罩仍可免除每小局第一次过牌费用。
- 玩家金币不足时，扣除剩余金币并结束整场。电脑过牌时，玩家获得对应金币。
- 旧存档保留玩家现有金币，电脑金币改为无限。

## 基本技术架构

- **前端**：原生 JavaScript（ES Modules）、HTML 与 CSS。
- **渲染**：Canvas 2D 绘制场景和动画，SVG 承载文字、键盘焦点与选牌交互区域。
- **模块**：`app/` 管理对局调度、导航与存档；`ui/` 管理页面和交互；`game/` 实现规则与状态；`engine/` 提供通用渲染能力；`cards/`、`coins/`、`shop/` 实现卡牌、金币与商店模型。
- **存储与构建**：浏览器 localStorage 保存进度，支持 JSON 导入导出；使用 esbuild 构建静态页面，通过 GitHub Pages / Nginx / Docker 部署。

## 文档目录

- [代码结构与开发约定](docs/architecture.md)
- [渲染管线](docs/rendering.md)
- [杂货铺道具](docs/items.md)
- [分支发布与版本号](docs/releases.md)

## 游戏截图

<table>
  <tr>
    <td align="center"><img src="docs/screenshots/home.png" alt="游戏首页" width="100%" /><br /><sub>游戏首页</sub></td>
    <td align="center"><img src="docs/screenshots/game.png" alt="斗地主对局" width="100%" /><br /><sub>斗地主对局</sub></td>
  </tr>
  <tr>
    <td align="center"><img src="docs/screenshots/shop.png" alt="关间道具商店" width="100%" /><br /><sub>关间道具商店</sub></td>
    <td align="center"><img src="docs/screenshots/performance.png" alt="性能测试页" width="100%" /><br /><sub>性能测试页</sub></td>
  </tr>
</table>

## 特别鸣谢

- 小丑牌：[Balatro](https://www.playbalatro.com/)
- 美术风格：[Colorfigures](https://april-zhu.com/colorfigures)
