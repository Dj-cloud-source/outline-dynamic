// 用户密钥通讯录从 Cloudflare KV 绑定 OUTLINE_USERS 读取。
// KV 示例：
// Key: zhangsan
// Value: ss://完整密钥
const RESERVED_USER_IDS = new Set(["health_check"]);

export async function getOutlineKey(env = {}, userId) {
  if (!userId || !env.OUTLINE_USERS) {
    return null;
  }

  return await env.OUTLINE_USERS.get(userId);
}

export function isReservedUserId(userId) {
  return RESERVED_USER_IDS.has(userId);
}

export function getUserIdFromPath(path) {
  return decodeURIComponent(path.slice(1)).trim();
}

export function buildSubscriptionLink(host, userId) {
  const encodedUserId = encodeURIComponent(userId).replace(/%40/g, "@");
  return `ssconf://${host}/${encodedUserId}`;
}

export function getOutlineConnectionTarget(outlineKey) {
  const url = new URL(outlineKey);

  return {
    host: url.hostname,
    port: parseInt(url.port, 10),
  };
}

export function convertOutlineKeyToJson(outlineKey) {
  const url = new URL(outlineKey);
  const base64UserInfo = url.username;
  const decodedUserInfo = atob(base64UserInfo);
  const [method, password] = decodedUserInfo.split(':');

  return {
    server: url.hostname,
    server_port: parseInt(url.port),
    password: password,
    method: method
  };
}
