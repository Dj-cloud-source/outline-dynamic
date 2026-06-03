# Outline-dynamic
# Outline Dynamic Key

A simple Cloudflare Worker for serving dynamic Outline access keys.

## Features

- Dynamic key delivery
- Per-user access links
- Easy server migration
- No need to redistribute keys

## Usage

Import the following link into Outline Client:

```text
ssconf://your-worker.workers.dev/username
```

Example:

```text
ssconf://your-worker.workers.dev/demo
```

## Deployment

1. Create a Cloudflare Worker
2. Deploy the source code
3. Configure your users and access keys
4. Share the generated links

## License

MIT


# Outline 动态密钥

基于 Cloudflare Worker 的 Outline 动态密钥解析服务。

## 功能特性

- 动态分发 Outline 密钥
- 支持用户独立链接
- 服务器迁移无需重新发放密钥
- 降低运维成本
- 兼容 Outline Client

## 使用方法

将以下链接导入 Outline 客户端：

```text
ssconf://your-worker.workers.dev/username
```

示例：

```text
ssconf://your-worker.workers.dev/demo
```

## 部署流程

1. 创建 Cloudflare Worker
2. 部署项目代码
3. 配置用户和对应密钥
4. 分享动态订阅链接

## 应用场景

当服务器 IP 更换或重建时，只需更新后端配置，用户无需重新导入密钥即可继续使用。

## 许可证

MIT License
