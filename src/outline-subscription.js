// 用户密钥通讯录从 Cloudflare KV 绑定 OUTLINE_USERS 读取。
// KV 示例：
// Key: zhangsan
// Value: ss://完整密钥
const RESERVED_USER_IDS = new Set(["health_check"]);
const MAX_USER_ID_LENGTH = 256;

export async function getOutlineKey(env = {}, userId) {
  if (!isValidUserId(userId) || !env.OUTLINE_USERS) {
    return null;
  }

  try {
    return await env.OUTLINE_USERS.get(userId);
  } catch (e) {
    return null;
  }
}

export function isReservedUserId(userId) {
  return RESERVED_USER_IDS.has(userId);
}

export function getUserIdFromPath(path) {
  try {
    const userId = decodeURIComponent(path.slice(1)).trim();
    return isValidUserId(userId) ? userId : null;
  } catch (e) {
    return null;
  }
}

export function isValidUserId(userId) {
  return typeof userId === "string"
    && userId.length > 0
    && userId.length <= MAX_USER_ID_LENGTH
    && !userId.includes("/");
}

export function buildSubscriptionLink(host, userId) {
  const encodedUserId = encodeURIComponent(userId).replace(/%40/g, "@");
  return `ssconf://${host}/${encodedUserId}`;
}

export function getOutlineConnectionTarget(outlineKey) {
  const url = parseOutlineUrl(outlineKey);
  parseOutlineCredentials(url.username);

  return {
    host: url.hostname,
    port: parseInt(url.port, 10),
  };
}

function parseOutlineUrl(outlineKey) {
  const url = new URL(outlineKey);

  if (url.protocol !== "ss:") {
    throw new Error("Invalid Outline key protocol");
  }

  if (!url.hostname) {
    throw new Error("Invalid Outline key hostname");
  }

  if (!url.port || !/^\d+$/.test(url.port)) {
    throw new Error("Invalid Outline key port");
  }

  const port = parseInt(url.port, 10);

  if (!Number.isInteger(port) || port < 1 || port > 65535) {
    throw new Error("Invalid Outline key port");
  }

  if (!url.username) {
    throw new Error("Invalid Outline key credentials");
  }

  return url;
}

function decodeOutlineUserInfo(base64UserInfo) {
  const decodedBase64 = decodeURIComponent(base64UserInfo)
    .replace(/-/g, "+")
    .replace(/_/g, "/");
  const paddingLength = (4 - (decodedBase64.length % 4)) % 4;
  const paddedBase64 = decodedBase64 + "=".repeat(paddingLength);
  const binaryUserInfo = atob(paddedBase64);
  const userInfoBytes = Uint8Array.from(binaryUserInfo, (char) => char.charCodeAt(0));

  return new TextDecoder("utf-8", { fatal: true }).decode(userInfoBytes);
}

function parseOutlineCredentials(base64UserInfo) {
  const decodedUserInfo = decodeOutlineUserInfo(base64UserInfo);
  const separatorIndex = decodedUserInfo.indexOf(':');

  if (separatorIndex <= 0 || separatorIndex === decodedUserInfo.length - 1) {
    throw new Error("Invalid Outline key credentials");
  }

  const method = decodedUserInfo.slice(0, separatorIndex);
  const password = decodedUserInfo.slice(separatorIndex + 1);

  if (!method.trim() || !password) {
    throw new Error("Invalid Outline key credentials");
  }

  return { method, password };
}

export function convertOutlineKeyToJson(outlineKey) {
  const url = parseOutlineUrl(outlineKey);
  const { method, password } = parseOutlineCredentials(url.username);

  return {
    server: url.hostname,
    server_port: parseInt(url.port, 10),
    password: password,
    method: method
  };
}
