# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## 项目概述

基于 Cloudflare Worker + KV 的 Outline 动态密钥分发服务。用户输入用户名后获取 `ssconf://` 专属链接，Outline Client 通过该链接获取真实的 `ss://` 密钥 JSON。真实密钥只保存在 Cloudflare KV 中，永远不会写进代码或响应给浏览器。

## 常用命令

```bash
# 运行所有测试
node --test test/worker.test.mjs

# 部署到 Cloudflare
npx wrangler deploy
```

本项目没有 `package.json`，零依赖，不需要 `npm install`。使用 Node.js 内置的 `node:test` 和 `node:assert` 测试框架。

## 架构

### 路由（`src/index.js`）

单入口 Worker，所有请求进入 `fetch(request, env, ctx)`，按 pathname 分发：

| 路由 | 功能 | 响应类型 |
|---|---|---|
| `GET /` | 返回交互式 HTML 首页 | `text/html` |
| `GET /api/link?user=xxx` | 查询 KV，若用户存在返回 `ssconf://` 链接 | `application/json` |
| `GET /api/check` | 通过 check-host.cc 检测 Outline 服务器 TCP 连通性（中国大陆节点） | `application/json` |
| `GET /:userId` | Outline Client 机器请求，返回 Outline JSON 订阅数据 | `application/json` |

### 模块职责

- **`src/outline-subscription.js`** — 核心逻辑层。从 KV 读取 `ss://` 密钥、校验和解析密钥格式、将 `ss://` URL 转换为 Outline JSON（`{server, server_port, password, method}`）。关键函数：`getOutlineKey()`, `convertOutlineKeyToJson()`, `getUserIdFromPath()`, `buildSubscriptionLink()`, `isReservedUserId()`。

- **`src/service-check.js`** — 服务连通性检测。使用 `check-host.cc` TCP API 检测 Outline 服务器在中国大陆节点的可达性。包含 5 分钟 KV 缓存（`OUTLINE_META`），缓存读取时对状态、消息、HTTP 状态码进行白名单校验防止投毒。

- **`src/home-page.js`** — 纯 HTML/CSS/JS 首页模板。包含 Apple 风格 UI、深色模式适配、键盘交互（Enter 触发查询）、客户端状态管理（loading/error/success/warning）。响应式布局。

### KV 绑定

- **`OUTLINE_USERS`** — 用户密钥通讯录。Key 是用户名，Value 是完整的 `ss://` 密钥字符串。
- **`OUTLINE_META`** — 元数据存储（目前仅用于健康检测结果缓存）。Key 为 `health_check_status`。

### 关键设计决策

- **`health_check` 是保留用户名**：在 `outline-subscription.js` 的 `RESERVED_USER_IDS` Set 中定义，该用户无法通过 `/api/link` 或订阅端点对外暴露，仅供内部 `check-host.cc` 检测使用。
- **错误信息统一且不暴露内部细节**：所有 404 返回"用户不存在或输入错误"，500 返回"配置解析错误"或"配置异常"，从不泄露服务器地址、端口、KV 错误原因。
- **安全响应头**：所有响应设置 `X-Content-Type-Options: nosniff`, `X-Frame-Options: DENY`, `Referrer-Policy: no-referrer`, `Strict-Transport-Security`, `Cache-Control: no-store`, `X-Robots-Tag: noindex, nofollow`。
- **URL-safe base64 兼容**：`decodeOutlineUserInfo` 将 `-` 替换为 `+`、`_` 替换为 `/` 再补 padding，兼容 URL-safe base64 编码的密钥凭据。
- **测试中使用 mock KV**：`makeEnv(records, metaRecords)` 构造假的 KV binding 对象，不需要连接 Cloudflare。测试覆盖了合法/非法的 Outline 密钥格式、缓存有效性验证、第三方 API mock（`withMockFetch`）、超时处理、保留用户名隔离等。

### AGENTS.md

项目的 `AGENTS.md` 约束了 Agent 行为：
- 使用中文交流
- 修改文件前先分析问题、给出方案，等待明确确认后才可修改
- 仅在 `/goal` 模式下可自主修改文件和运行测试
- 禁止删除文件、安装依赖、执行 `git push`、修改项目目录外内容
- 修改代码后需运行测试
