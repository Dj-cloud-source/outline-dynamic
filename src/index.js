import { renderHomePage } from "./home-page.js";
import { checkCurrentService } from "./service-check.js";
import {
  buildSubscriptionLink,
  convertOutlineKeyToJson,
  getOutlineKey,
  getUserIdFromPath,
  isReservedUserId,
  isValidUserId
} from "./outline-subscription.js";
import {
  buildShadowrocketSubscriptionLink,
  convertOutlineKeyToShadowrocketSubscription,
  getShadowrocketUserIdFromPath
} from "./shadowrocket-subscription.js";

const ALLOWED_METHODS = "GET, OPTIONS";

function htmlResponse(html, init = {}) {
  const headers = new Headers(init.headers || {});
  headers.set("Content-Type", "text/html; charset=utf-8");
  headers.set("Cache-Control", "no-store");
  headers.set("X-Robots-Tag", "noindex, nofollow");

  return new Response(html, {
    ...init,
    headers,
  });
}

function jsonResponse(data, init = {}) {
  const headers = new Headers(init.headers || {});
  headers.set("Content-Type", "application/json; charset=utf-8");
  headers.set("Cache-Control", "no-store");

  return new Response(JSON.stringify(data), {
    ...init,
    headers,
  });
}

function textResponse(text, init = {}) {
  const headers = new Headers(init.headers || {});
  headers.set("Content-Type", "text/plain; charset=utf-8");
  headers.set("Cache-Control", "no-store");

  return new Response(text, {
    ...init,
    headers,
  });
}

function methodNotAllowedResponse() {
  return textResponse("Method Not Allowed", {
    status: 405,
    headers: {
      "Allow": ALLOWED_METHODS,
    },
  });
}

function optionsResponse() {
  return new Response(null, {
    status: 204,
    headers: {
      "Allow": ALLOWED_METHODS,
      "Cache-Control": "no-store",
    },
  });
}

export default {
  async fetch(request, env, ctx) {
    const requestUrl = new URL(request.url);
    const path = requestUrl.pathname;

    if (request.method === "OPTIONS") {
      return optionsResponse();
    }

    if (request.method !== "GET") {
      return methodNotAllowedResponse();
    }

    // ========================================================
    // 模块 A：如果用户访问的是首页 (根目录 /)，返回交互式网页
    // ========================================================
    if (path === '/' || path === '') {
      return htmlResponse(renderHomePage());
    }

    // 校验用户名是否存在，存在才给前端返回订阅链接。
    if (path === '/api/link') {
      const userId = (requestUrl.searchParams.get('user') || '').trim();

      if (!isValidUserId(userId) || isReservedUserId(userId)) {
        return jsonResponse({ message: "用户不存在或输入错误。" }, { status: 404 });
      }

      const outlineKey = await getOutlineKey(env, userId);

      if (!outlineKey) {
        return jsonResponse({ message: "用户不存在或输入错误。" }, { status: 404 });
      }

      try {
        convertOutlineKeyToJson(outlineKey);
      } catch (e) {
        return jsonResponse({ message: "用户配置异常，请联系管理员。" }, { status: 500 });
      }

      return jsonResponse({
        link: buildSubscriptionLink(requestUrl.host, userId),
        shadowrocketLink: buildShadowrocketSubscriptionLink(requestUrl.host, userId),
      });
    }

    // 检测当前主服务连通性，不暴露真实节点地址。
    if (path === '/api/check') {
      const result = await checkCurrentService(env);

      return jsonResponse({
        status: result.status,
        message: result.message,
      }, { status: result.httpStatus });
    }

    if (path.startsWith('/api/')) {
      return jsonResponse({ message: "接口不存在。" }, { status: 404 });
    }

    if (path.startsWith('/sub/shadowrocket/')) {
      const userId = getShadowrocketUserIdFromPath(path);

      if (!isValidUserId(userId) || isReservedUserId(userId)) {
        return textResponse("用户不存在或链接错误", { status: 404 });
      }

      const outlineKey = await getOutlineKey(env, userId);

      if (!outlineKey) {
        return textResponse("用户不存在或链接错误", { status: 404 });
      }

      try {
        const subscription = convertOutlineKeyToShadowrocketSubscription(
          outlineKey,
          env.SHADOWROCKET_NODE_NAME
        );

        return textResponse(subscription);
      } catch (e) {
        return textResponse("配置解析错误", { status: 500 });
      }
    }

    // ========================================================
    // 模块 B：处理机器请求，下发真实的 JSON 订阅数据
    // ========================================================
    // 提取用户名 (例如从 /zhangsan 提取出 zhangsan)
    const userId = getUserIdFromPath(path);

    if (!userId || isReservedUserId(userId)) {
      return textResponse("用户不存在或链接错误", { status: 404 });
    }

    const outlineKey = await getOutlineKey(env, userId);

    if (!outlineKey) {
      return textResponse("用户不存在或链接错误", { status: 404 });
    }

    try {
      const outlineJson = convertOutlineKeyToJson(outlineKey);

      return new Response(JSON.stringify(outlineJson, null, 2), {
        headers: {
          "Content-Type": "application/json; charset=utf-8",
          "Cache-Control": "no-store",
        },
      });
    } catch (e) {
      return textResponse("配置解析错误", { status: 500 });
    }
  }
};
