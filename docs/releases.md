# 分支发布与版本号

| 分支 | 版本 | GitHub Pages 路径 |
| --- | --- | --- |
| `main` | 正式版 | `https://jessetzh.github.io/DiZhuPai/` |
| `test` | 测试版 | `https://jessetzh.github.io/DiZhuPai/test/` |

两个分支的推送都会执行检查、构建和浏览器测试。检查通过后发布。也可在对应分支手动运行工作流。拉取请求只执行检查。

GitHub Pages 每次部署都会替换整个站点。`gh-pages` 分支保存两个版本的构建快照。发布 `main` 时替换根目录并保留 `test/`。发布 `test` 时只替换 `test/`。发布任务串行执行。`gh-pages` 不触发 CI。仓库的 Pages 来源继续使用 GitHub Actions。

首次启用时，先将这些改动提交并推送到 `main`，再将 `main` 合并到 `test` 并推送。若先发布 `test` 且还没有正式版快照，工作流会从 `main` 构建正式版以保留根路径。后续发布不会重新构建另一版本。不要删除 `gh-pages`，否则会丢失保留版本的快照。

`github-pages` 环境必须允许 `main` 和 `test` 分支部署。工作流需要 `contents: write` 保存快照，并需要 `pages: write` 和 `id-token: write` 发布站点。若仓库规则限制创建或更新 `gh-pages`，需允许 GitHub Actions 写入该分支。

## Docker Hub

推送 `main` 分支时，「Docker Hub」工作流先检查格式、运行单元测试和构建，再推送镜像。也可在 `main` 分支手动运行工作流。其他分支不推送镜像。

| 触发 | 镜像标签 |
| --- | --- |
| `main` 分支推送 | `latest`、`sha-<7 位 SHA>` |
| `main` 分支手动运行 | `latest`、`sha-<7 位 SHA>` |

仓库需要 `DOCKERHUB_USERNAME` 和 `DOCKERHUB_TOKEN` 机密。镜像名为 `<DOCKERHUB_USERNAME>/dizhupai`。工作流只构建 `linux/amd64` 镜像。

`main` 推送并发布镜像后，`deploy` 任务通过 SSH 执行服务器脚本。手动运行不部署。需要 `DEPLOY_HOST`、`DEPLOY_USER` 和 `DEPLOY_SSH_PRIVATE_KEY` 机密。可选 `DEPLOY_PORT`（默认 `22`）和 `DEPLOY_SCRIPT`（默认 `/root/dizhupai/deploy.sh`）。服务器脚本负责更新运行的容器。

镜像使用 Nginx 提供静态文件，监听 80 端口：

```sh
docker run --rm -p 8080:80 <DOCKERHUB_USERNAME>/dizhupai:latest
```

设置弹窗底部显示 Canvas 绘制的版本号，例如 `Version:261026-1430-abcdef1-test`。每次打包都会按北京时间生成日期和时间，并读取当前源码的 7 位 Git SHA。`main` 默认使用 `prod`，其他分支默认使用 `test`。可用 `BUILD_CHANNEL=prod` 或 `BUILD_CHANNEL=test` 显式指定。构建同时输出 `dist/version.json`，记录完整 SHA、环境和构建时间。

开发服务器显示 `Version:dev-test`。无 Git 元数据的构建使用 `0000000` 标识未知提交，可通过 `BUILD_SHA` 提供真实 SHA。Docker 构建通过 `--build-arg BUILD_SHA="$(git rev-parse HEAD)"` 传入提交；用 `--build-arg BUILD_CHANNEL=test` 构建测试版，默认构建正式版。
