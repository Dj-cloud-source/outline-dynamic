import { convertOutlineKeyToJson } from "./outline-subscription.js";

const DEFAULT_SHADOWROCKET_NODE_NAME = "Outline";

function encodeUtf8Base64Url(text) {
  const bytes = new TextEncoder().encode(text);
  let binary = "";

  for (const byte of bytes) {
    binary += String.fromCharCode(byte);
  }

  return btoa(binary)
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/g, "");
}

export function buildShadowrocketSubscriptionLink(host, userId) {
  const encodedUserId = encodeURIComponent(userId).replace(/%40/g, "@");
  return `https://${host}/sub/shadowrocket/${encodedUserId}`;
}

export function getShadowrocketUserIdFromPath(path) {
  const prefix = "/sub/shadowrocket/";

  if (!path.startsWith(prefix)) {
    return null;
  }

  try {
    return decodeURIComponent(path.slice(prefix.length)).trim() || null;
  } catch (e) {
    return null;
  }
}

export function convertOutlineKeyToShadowrocketSubscription(outlineKey, nodeName) {
  const outlineJson = convertOutlineKeyToJson(outlineKey);
  const credentials = `${outlineJson.method}:${outlineJson.password}`;
  const encodedCredentials = encodeUtf8Base64Url(credentials);
  const displayName = String(nodeName || DEFAULT_SHADOWROCKET_NODE_NAME).trim()
    || DEFAULT_SHADOWROCKET_NODE_NAME;
  const encodedNodeName = encodeURIComponent(displayName);

  return `ss://${encodedCredentials}@${outlineJson.server}:${outlineJson.server_port}#${encodedNodeName}`;
}
