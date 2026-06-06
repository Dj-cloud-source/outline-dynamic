# Outline Dynamic Key

基于 Cloudflare Worker + KV 的 Outline 动态密钥分发服务。

## 功能

- 用户输入用户名后生成 `ssconf://` 专属链接
- 用户不存在时提示错误，不生成无效链接
- Outline 原始 `ss://` 密钥保存在 Cloudflare KV，不写进代码
- 服务器迁移时只需要修改 KV 的 Value，客户手里的链接可以不变
- 支持普通用户名，也支持邮箱形式的用户名
- 支持 `/api/check` 检测当前服务连通性，并用 KV 短期缓存检测结果

## 架构

```text
用户浏览器
  -> Worker 首页 /
  -> /api/link?user=用户名
  -> Worker 查询 KV
  -> 返回 ssconf://your-domain.example/用户名

Outline Client
  -> 请求 https://your-domain.example/用户名
  -> Worker 查询 KV
  -> 将 ss:// 密钥转换为 Outline JSON
  -> 返回给 Outline Client

运维或前端
  -> /api/check
  -> Worker 从 OUTLINE_USERS 读取 health_check
  -> 调用第三方 TCP 检测
  -> 将公开状态短期写入 OUTLINE_META
```

## Cloudflare KV 配置

创建两个 KV namespace，并绑定到 Worker。

绑定变量名必须是：

```text
OUTLINE_USERS
OUTLINE_META
```

`OUTLINE_USERS` 中每个用户一条记录：

```text
Key: demo-user
Value: ss://从 Outline Manager 复制的完整密钥
```

邮箱用户名示例：

```text
Key: alice@example.com
Value: ss://从 Outline Manager 复制的完整密钥
```

注意：

- `Key` 是客户输入的用户名
- `Value` 必须是完整的 `ss://.../?outline=1` 密钥
- `Key` 不要带空格，不要包含 `/`
- `Key` 最长 256 个字符
- 不需要写 JSON
- 不需要加引号

`OUTLINE_USERS` 还可以配置一个保留 Key，用于服务检测：

```text
Key: health_check
Value: ss://用于检测当前 Outline 服务的完整密钥
```

`health_check` 不会作为公开用户订阅下发，只用于 `/api/check` 解析目标主机和端口。`OUTLINE_META` 用来保存 `health_check_status` 等非敏感缓存数据，可以先保持为空，由 Worker 自动写入。

## wrangler.toml

`wrangler.toml` 需要包含 KV 绑定，否则通过 GitHub 自动部署或 `wrangler deploy` 时可能丢失绑定。

示例：

```toml
name = "outline-dynamic"
main = "src/index.js"
compatibility_date = "2026-06-03"

[[kv_namespaces]]
binding = "OUTLINE_USERS"
id = "your_outline_users_kv_namespace_id"

[[kv_namespaces]]
binding = "OUTLINE_META"
id = "your_outline_meta_kv_namespace_id"
```

其中 `id` 填 Cloudflare KV namespace ID。Namespace ID 不是 Outline 密钥，但公开仓库中仍建议使用占位值，不要提交真实账户资源信息。

## 使用方法

客户打开 Worker 绑定的域名首页，输入用户名。

如果 KV 中存在：

```text
Key: demo-user
```

页面会生成：

```text
ssconf://your-domain.example/demo-user
```

如果 KV 中存在：

```text
Key: alice@example.com
```

页面会生成：

```text
ssconf://your-domain.example/alice@example.com
```

客户将生成的 `ssconf://` 链接导入 Outline Client 即可。

## 运维

新增用户：

```text
新增 KV 记录
Key: 新用户名
Value: 对应用户的完整 ss:// 密钥
```

修改用户密钥：

```text
找到对应 Key，修改 Value
```

删除用户：

```text
删除对应 Key
```

更换 Outline 服务器：

```text
将对应用户的 Value 改成新服务器的 ss:// 密钥
```

只要 `Key` 不变，客户手里的 `ssconf://` 链接通常不需要重新发放。

## 自动化更新 KV

如果不想手动在 Cloudflare Dashboard 修改 KV，也可以使用外部自动化工具调用 Cloudflare API 更新 KV。

典型流程：

```text
Hermes / 自动化脚本
  -> 调用 Cloudflare KV API
  -> 更新 OUTLINE_USERS 中指定 Key 的 Value
  -> 客户手里的 ssconf:// 链接保持不变
```

注意：

- API Token 不要写进代码或 README
- Account ID、Namespace ID、真实用户名、真实密钥不要提交到公开仓库
- 自动化工具只需要更新 `OUTLINE_USERS` 中指定 Key 的 Value，不需要修改 Worker 代码
- 自动化工具不要生成包含 `/` 的用户名 Key
- 不要把客户用户名写入 `health_check`，它是服务检测保留 Key
- 只要 Key 不变，客户链接不需要重新发放

## 注意事项

- 真实 `ss://` 密钥只应保存在 Cloudflare KV 中
- 不要把真实密钥、真实邮箱、真实服务器 IP 写进 README 或公开仓库
- 如果所有用户都提示不存在，优先检查 Worker 的 KV binding 是否为 `OUTLINE_USERS`
- 如果 `/api/check` 提示未配置，检查 `OUTLINE_USERS` 中是否存在 `health_check`
- 如果 `/api/check` 频繁不可用，检查 `OUTLINE_META` binding 是否存在，以及第三方检测服务是否可达
- 如果使用 GitHub 自动部署，必须把 KV binding 写进 `wrangler.toml`
- `ssconf://` 链接只是配置领取地址，真正的 Outline 服务器地址在 KV 的 `ss://` Value 中

## License

MIT License
