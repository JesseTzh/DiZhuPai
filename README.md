# 地主牌 · DIzhuPai

受小丑牌启发，以斗地主为原型的卡片肉鸽游戏，纯 Web 实现。

## 基本技术架构

- **前端**：原生 JavaScript（ES Modules）、HTML 与 CSS。
- **渲染**：Canvas 2D 绘制场景和动画，SVG 承载文字、键盘焦点与选牌交互区域。
- **模块**：`app/` 管理对局调度、导航与存档；`ui/` 管理页面和交互；`game/` 实现规则与状态；`engine/` 提供通用渲染能力；`cards/`、`coins/`、`shop/` 实现卡牌、金币与商店模型。
- **存储与构建**：浏览器 localStorage 保存进度，支持 JSON 导入导出；使用 esbuild 构建静态页面，通过 Nginx / Docker 部署。

## 游戏截图

![游戏首页](docs/screenshots/home.png)

![斗地主对局](docs/screenshots/game.png)

![关间玩具商店](docs/screenshots/shop.png)

## 特别鸣谢

- 小丑牌：[Balatro](https://www.playbalatro.com/)
- 美术风格：[Colorfigures](https://april-zhu.com/colorfigures)
