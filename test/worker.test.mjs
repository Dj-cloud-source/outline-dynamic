import assert from "node:assert/strict";
import test from "node:test";
import vm from "node:vm";

import { renderHomePage } from "../src/home-page.js";
import worker from "../src/index.js";
import { checkCurrentService } from "../src/service-check.js";

const TEST_HOST = "203.0.113.10";
const TEST_PORT = 50440;
const TEST_USER_INFO = "chacha20-ietf-poly1305:testpass";

function encodeUserInfo(userInfo) {
  return btoa(userInfo).replace(/=/g, "");
}

function encodeUtf8UserInfo(userInfo) {
  const bytes = new TextEncoder().encode(userInfo);
  let binaryUserInfo = "";

  for (const byte of bytes) {
    binaryUserInfo += String.fromCharCode(byte);
  }

  return btoa(binaryUserInfo).replace(/=/g, "");
}

function makeOutlineKey(host = TEST_HOST, port = TEST_PORT, userInfo = TEST_USER_INFO) {
  const encodedUserInfo = encodeUserInfo(userInfo);
  return `ss://${encodedUserInfo}@${host}:${port}/?outline=1`;
}

function makeOutlineKeyWithEncodedUserInfo(encodedUserInfo, host = TEST_HOST, port = TEST_PORT) {
  return `ss://${encodedUserInfo}@${host}:${port}/?outline=1`;
}

function decodeBase64Url(encodedValue) {
  const base64Value = encodedValue
    .replace(/-/g, "+")
    .replace(/_/g, "/");
  const paddingLength = (4 - (base64Value.length % 4)) % 4;
  const binaryValue = atob(base64Value + "=".repeat(paddingLength));
  const bytes = Uint8Array.from(binaryValue, (char) => char.charCodeAt(0));

  return new TextDecoder().decode(bytes);
}

function parseShadowrocketNode(node) {
  const url = new URL(node);

  return {
    protocol: url.protocol,
    credentials: decodeBase64Url(url.username),
    host: url.hostname,
    port: Number(url.port),
    nodeName: decodeURIComponent(url.hash.slice(1)),
  };
}

function makeInvalidOutlineKeys() {
  const encodedUserInfo = encodeUserInfo(TEST_USER_INFO);

  return [
    ["non-ss protocol", "https://example.com"],
    ["missing port", `ss://${encodedUserInfo}@${TEST_HOST}/?outline=1`],
    ["zero port", makeOutlineKey(TEST_HOST, 0)],
    ["overflow port", makeOutlineKey(TEST_HOST, 65536)],
    ["invalid base64", makeOutlineKeyWithEncodedUserInfo("not!base64")],
    ["missing separator", makeOutlineKey(TEST_HOST, TEST_PORT, "chacha20-ietf-poly1305")],
    ["missing method", makeOutlineKey(TEST_HOST, TEST_PORT, ":testpass")],
    ["missing password", makeOutlineKey(TEST_HOST, TEST_PORT, "chacha20-ietf-poly1305:")],
  ];
}

function makeEnv(records, metaRecords = null) {
  const env = {
    OUTLINE_USERS: {
      get: async (key) => records[key] || null,
    },
  };

  if (metaRecords) {
    env.OUTLINE_META = {
      get: async (key) => metaRecords[key] || null,
      put: async (key, value) => {
        metaRecords[key] = value;
      },
    };
  }

  return env;
}

function jsonResponse(data, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: {
      "Content-Type": "application/json; charset=utf-8",
    },
  });
}

function withMockFetch(t, handler) {
  const originalFetch = globalThis.fetch;
  globalThis.fetch = handler;
  t.after(() => {
    globalThis.fetch = originalFetch;
  });
}

function withHealthyCheckMock(t) {
  const calls = {
    tcp: 0,
    report: 0,
  };

  withMockFetch(t, async (url) => {
    const requestUrl = String(url);

    if (requestUrl === "https://api.check-host.cc/tcp") {
      calls.tcp += 1;

      return jsonResponse({
        success: true,
        uuid: `healthy-${calls.tcp}`,
      });
    }

    if (requestUrl.startsWith("https://api.check-host.cc/report/healthy-")) {
      calls.report += 1;

      return jsonResponse({
        data: {
          "CN-BJ-Test": {
            checks: [
              {
                status: 1,
              },
            ],
          },
        },
      });
    }

    throw new Error(`Unexpected fetch: ${url}`);
  });

  return calls;
}

function makeElement(id) {
  return {
    id,
    value: "",
    innerText: "",
    className: "",
    disabled: false,
    style: {
      display: "none",
    },
  };
}

function createHomePageRuntime(fetchImpl) {
  const html = renderHomePage();
  const script = html.match(/<script>([\s\S]*?)<\/script>/)?.[1];
  const elements = {};
  const documentListeners = new Map();
  const document = {
    getElementById: (id) => {
      if (!elements[id]) {
        elements[id] = makeElement(id);
      }

      return elements[id];
    },
    addEventListener: (type, listener, options) => {
      const listeners = documentListeners.get(type) || [];
      listeners.push({ listener, options });
      documentListeners.set(type, listeners);
    },
  };
  const context = {
    AbortController,
    document,
    fetch: fetchImpl,
    navigator: {
      clipboard: {
        writeText: async () => {},
      },
    },
    Response,
  };

  assert.ok(script);
  vm.createContext(context);
  vm.runInContext(script, context);
  [
    "username",
    "generateButton",
    "accountStatusBox",
    "accountStatusTitle",
    "accountStatusDetail",
    "resultBox",
    "outlineLinkText",
    "shadowrocketLinkText",
    "outlineCopyState",
    "shadowrocketCopyState",
    "checkButton",
    "serviceSummary",
    "serviceStatusBox",
    "serviceStatusTitle",
    "serviceStatusDetail",
  ].forEach((id) => document.getElementById(id));

  return { context, elements, documentListeners };
}

test("/api/link returns subscription links and hides unknown users", async () => {
  const env = makeEnv({
    wenju2: makeOutlineKey(),
    "haytao0726@gmail.com": makeOutlineKey(),
  });

  let response = await worker.fetch(new Request("https://wenj.online/api/link?user=wenju2"), env);
  assert.equal(response.status, 200);
  assert.deepEqual(await response.json(), {
    link: "ssconf://wenj.online/wenju2",
    shadowrocketLink: "https://wenj.online/sub/shadowrocket/wenju2",
  });

  response = await worker.fetch(new Request("https://wenj.online/api/link?user=haytao0726%40gmail.com"), env);
  assert.equal(response.status, 200);
  assert.deepEqual(await response.json(), {
    link: "ssconf://wenj.online/haytao0726@gmail.com",
    shadowrocketLink: "https://wenj.online/sub/shadowrocket/haytao0726@gmail.com",
  });

  response = await worker.fetch(new Request("https://wenj.online/api/link?user=missing"), env);
  assert.equal(response.status, 404);
  assert.deepEqual(await response.json(), {
    message: "用户不存在或输入错误。",
  });
});

test("Worker only allows GET and OPTIONS requests", async () => {
  const env = makeEnv({
    wenju2: makeOutlineKey(),
  });

  for (const path of ["/api/link?user=wenju2", "/sub/shadowrocket/wenju2", "/wenju2"]) {
    for (const method of ["HEAD", "POST", "PUT", "PATCH", "DELETE"]) {
      const response = await worker.fetch(new Request(`https://wenj.online${path}`, {
        method,
      }), env);
      const text = await response.text();

      assert.equal(response.status, 405, `${method} ${path}`);
      assert.equal(response.headers.get("Allow"), "GET, OPTIONS", `${method} ${path}`);
      assert.equal(response.headers.get("Cache-Control"), "no-store", `${method} ${path}`);
      assert.equal(text.includes(TEST_HOST), false, `${method} ${path}`);
      assert.equal(text.includes("testpass"), false, `${method} ${path}`);
      assert.equal(text.includes("chacha20-ietf-poly1305"), false, `${method} ${path}`);
    }
  }

  const response = await worker.fetch(new Request("https://wenj.online/api/link?user=wenju2", {
    method: "OPTIONS",
  }), env);

  assert.equal(response.status, 204);
  assert.equal(response.headers.get("Allow"), "GET, OPTIONS");
  assert.equal(response.headers.get("Cache-Control"), "no-store");
});

test("unknown API subpaths return JSON 404 instead of subscription text", async () => {
  for (const path of ["/api/link/", "/api/check/", "/api/link/foo", "/api/check/foo", "/api/unknown"]) {
    const response = await worker.fetch(new Request(`https://wenj.online${path}`), makeEnv({}));

    assert.equal(response.status, 404, path);
    assert.match(response.headers.get("Content-Type"), /application\/json/, path);
    assert.deepEqual(await response.json(), {
      message: "接口不存在。",
    }, path);
  }
});

test("invalid user ids are rejected before KV lookup", async () => {
  let kvReads = 0;
  const env = {
    OUTLINE_USERS: {
      get: async () => {
        kvReads += 1;
        return makeOutlineKey();
      },
    },
  };
  const tooLongUserId = "x".repeat(257);
  const cases = [
    ["https://wenj.online/api/link?user=a%2Fb", "json"],
    [`https://wenj.online/api/link?user=${tooLongUserId}`, "json"],
    ["https://wenj.online/sub/shadowrocket/a%2Fb", "text"],
    [`https://wenj.online/sub/shadowrocket/${tooLongUserId}`, "text"],
    ["https://wenj.online/a%2Fb", "text"],
    ["https://wenj.online/a/b", "text"],
    [`https://wenj.online/${tooLongUserId}`, "text"],
  ];

  for (const [url, responseType] of cases) {
    const response = await worker.fetch(new Request(url), env);

    assert.equal(response.status, 404, url);
    assert.equal(response.headers.get("Cache-Control"), "no-store", url);

    if (responseType === "json") {
      assert.deepEqual(await response.json(), {
        message: "用户不存在或输入错误。",
      }, url);
    } else {
      assert.equal(await response.text(), "用户不存在或链接错误", url);
    }
  }

  assert.equal(kvReads, 0);
});

test("/api/link rejects invalid Outline key values before generating links", async () => {
  const env = makeEnv({
    broken: "not-a-valid-outline-key",
  });

  const response = await worker.fetch(new Request("https://wenj.online/api/link?user=broken"), env);

  assert.equal(response.status, 500);
  assert.deepEqual(await response.json(), {
    message: "用户配置异常，请联系管理员。",
  });
});

test("/api/link rejects malformed Outline key variants", async () => {
  for (const [name, outlineKey] of makeInvalidOutlineKeys()) {
    const env = makeEnv({
      broken: outlineKey,
    });

    const response = await worker.fetch(new Request("https://wenj.online/api/link?user=broken"), env);

    assert.equal(response.status, 500, name);
    assert.deepEqual(await response.json(), {
      message: "用户配置异常，请联系管理员。",
    }, name);
  }
});

test("subscription endpoint converts Outline keys to JSON", async () => {
  const env = makeEnv({
    wenju2: makeOutlineKey(),
    "haytao0726@gmail.com": makeOutlineKey(),
  });

  let response = await worker.fetch(new Request("https://wenj.online/wenju2"), env);
  assert.equal(response.status, 200);
  assert.deepEqual(await response.json(), {
    server: TEST_HOST,
    server_port: TEST_PORT,
    password: "testpass",
    method: "chacha20-ietf-poly1305",
  });

  response = await worker.fetch(new Request("https://wenj.online/haytao0726%40gmail.com"), env);
  assert.equal(response.status, 200);
  assert.equal((await response.json()).server, TEST_HOST);
});

test("subscription endpoint preserves passwords containing colons", async () => {
  const env = makeEnv({
    colonpass: makeOutlineKey(TEST_HOST, TEST_PORT, "chacha20-ietf-poly1305:pass:with:colon"),
  });

  const response = await worker.fetch(new Request("https://wenj.online/colonpass"), env);

  assert.equal(response.status, 200);
  assert.deepEqual(await response.json(), {
    server: TEST_HOST,
    server_port: TEST_PORT,
    password: "pass:with:colon",
    method: "chacha20-ietf-poly1305",
  });
});

test("subscription endpoint decodes UTF-8 Outline credentials", async () => {
  const env = makeEnv({
    unicodepass: makeOutlineKeyWithEncodedUserInfo(encodeUtf8UserInfo("chacha20-ietf-poly1305:密码")),
  });

  const response = await worker.fetch(new Request("https://wenj.online/unicodepass"), env);

  assert.equal(response.status, 200);
  assert.deepEqual(await response.json(), {
    server: TEST_HOST,
    server_port: TEST_PORT,
    password: "密码",
    method: "chacha20-ietf-poly1305",
  });
});

test("shadowrocket subscription endpoint returns a dynamic ss subscription", async () => {
  const env = makeEnv({
    wenju2: makeOutlineKey(),
    "haytao0726@gmail.com": makeOutlineKeyWithEncodedUserInfo(
      encodeUtf8UserInfo("chacha20-ietf-poly1305:密码")
    ),
  });
  env.SHADOWROCKET_NODE_NAME = "Wenj VPN";

  let response = await worker.fetch(new Request("https://wenj.online/sub/shadowrocket/wenju2"), env);
  let body = await response.text();
  let node = parseShadowrocketNode(body);

  assert.equal(response.status, 200);
  assert.match(response.headers.get("Content-Type"), /text\/plain/);
  assert.equal(response.headers.get("Cache-Control"), "no-store");
  assert.deepEqual(node, {
    protocol: "ss:",
    credentials: TEST_USER_INFO,
    host: TEST_HOST,
    port: TEST_PORT,
    nodeName: "Wenj VPN",
  });

  response = await worker.fetch(new Request("https://wenj.online/sub/shadowrocket/haytao0726%40gmail.com"), env);
  body = await response.text();
  node = parseShadowrocketNode(body);

  assert.equal(response.status, 200);
  assert.equal(node.credentials, "chacha20-ietf-poly1305:密码");
  assert.equal(node.nodeName, "Wenj VPN");
});

test("shadowrocket subscription endpoint hides missing and reserved users", async () => {
  const tooLongUserId = "x".repeat(257);
  let kvReads = 0;
  const env = {
    OUTLINE_USERS: {
      get: async () => {
        kvReads += 1;
        return makeOutlineKey();
      },
    },
  };

  for (const url of [
    "https://wenj.online/sub/shadowrocket/a%2Fb",
    `https://wenj.online/sub/shadowrocket/${tooLongUserId}`,
    "https://wenj.online/sub/shadowrocket/health_check",
  ]) {
    const response = await worker.fetch(new Request(url), env);

    assert.equal(response.status, 404, url);
    assert.equal(response.headers.get("Cache-Control"), "no-store", url);
    assert.equal(await response.text(), "用户不存在或链接错误", url);
  }

  assert.equal(kvReads, 0);

  const missingResponse = await worker.fetch(
    new Request("https://wenj.online/sub/shadowrocket/missing"),
    makeEnv({})
  );

  assert.equal(missingResponse.status, 404);
  assert.equal(await missingResponse.text(), "用户不存在或链接错误");
});

test("shadowrocket subscription endpoint rejects malformed Outline key variants", async () => {
  for (const [name, outlineKey] of makeInvalidOutlineKeys()) {
    const env = makeEnv({
      broken: outlineKey,
    });

    const response = await worker.fetch(new Request("https://wenj.online/sub/shadowrocket/broken"), env);
    const body = await response.text();

    assert.equal(response.status, 500, name);
    assert.equal(response.headers.get("Cache-Control"), "no-store", name);
    assert.equal(body, "配置解析错误", name);
    assert.equal(body.includes(TEST_HOST), false, name);
    assert.equal(body.includes("testpass"), false, name);
    assert.equal(body.includes("chacha20-ietf-poly1305"), false, name);
  }
});

test("subscription endpoint rejects malformed Outline key variants", async () => {
  for (const [name, outlineKey] of makeInvalidOutlineKeys()) {
    const env = makeEnv({
      broken: outlineKey,
    });

    const response = await worker.fetch(new Request("https://wenj.online/broken"), env);

    assert.equal(response.status, 500, name);
    assert.equal(response.headers.get("Cache-Control"), "no-store", name);
    assert.equal(await response.text(), "配置解析错误", name);
  }
});

test("subscription endpoint rejects malformed encoded paths", async () => {
  const response = await worker.fetch(new Request("https://wenj.online/%E0%A4%A"), makeEnv({}));

  assert.equal(response.status, 404);
  assert.equal(response.headers.get("Cache-Control"), "no-store");
  assert.equal(await response.text(), "用户不存在或链接错误");
});

test("subscription endpoint sends no-store headers on missing users", async () => {
  const response = await worker.fetch(new Request("https://wenj.online/missing"), makeEnv({}));

  assert.equal(response.status, 404);
  assert.equal(response.headers.get("Cache-Control"), "no-store");
  assert.match(response.headers.get("Content-Type"), /text\/plain/);
  assert.equal(await response.text(), "用户不存在或链接错误");
});

test("KV read failures are handled without exposing internal errors", async (t) => {
  const env = {
    OUTLINE_USERS: {
      get: async () => {
        throw new Error("KV unavailable");
      },
    },
  };
  let fetchCalled = false;

  withMockFetch(t, async () => {
    fetchCalled = true;
    throw new Error("fetch should not be called");
  });

  let response = await worker.fetch(new Request("https://wenj.online/api/link?user=wenju2"), env);
  assert.equal(response.status, 404);
  assert.deepEqual(await response.json(), {
    message: "用户不存在或输入错误。",
  });

  response = await worker.fetch(new Request("https://wenj.online/wenju2"), env);
  assert.equal(response.status, 404);
  assert.equal(await response.text(), "用户不存在或链接错误");

  response = await worker.fetch(new Request("https://wenj.online/api/check"), env);
  assert.equal(response.status, 503);
  assert.deepEqual(await response.json(), {
    status: "unavailable",
    message: "当前服务检测未配置，请联系管理员。",
  });
  assert.equal(fetchCalled, false);
});

test("/api/check reports healthy service without exposing target", async (t) => {
  const metaRecords = {};
  const env = makeEnv({
    health_check: makeOutlineKey(),
  }, metaRecords);
  const fetchCalls = [];

  withMockFetch(t, async (url, init) => {
    fetchCalls.push({ url: String(url), init });

    if (String(url) === "https://api.check-host.cc/tcp") {
      return jsonResponse({
        success: true,
        uuid: "check-1",
      });
    }

    if (String(url) === "https://api.check-host.cc/report/check-1") {
      return jsonResponse({
        data: {
          "CN-BJ-Test": {
            checks: [
              {
                status: 1,
                connectiontime: 35,
              },
            ],
          },
        },
      });
    }

    throw new Error(`Unexpected fetch: ${url}`);
  });

  const response = await worker.fetch(new Request("https://wenj.online/api/check"), env);
  const body = await response.json();

  assert.equal(response.status, 200);
  assert.deepEqual(body, {
    status: "ok",
    message: "当前服务大陆连通性参考正常。",
  });
  assert.equal(JSON.stringify(body).includes(TEST_HOST), false);

  const dispatchedBody = JSON.parse(fetchCalls[0].init.body);
  assert.deepEqual(dispatchedBody, {
    target: TEST_HOST,
    port: TEST_PORT,
    region: ["CN"],
  });
  assert.equal(typeof metaRecords.health_check_status, "string");
});

test("health_check is reserved from public subscription access", async (t) => {
  const env = makeEnv({
    health_check: makeOutlineKey(),
  });

  withMockFetch(t, async (url) => {
    if (String(url) === "https://api.check-host.cc/tcp") {
      return jsonResponse({
        success: true,
        uuid: "reserved-check",
      });
    }

    if (String(url) === "https://api.check-host.cc/report/reserved-check") {
      return jsonResponse({
        data: {
          "CN-BJ-Test": {
            checks: [
              {
                status: 1,
              },
            ],
          },
        },
      });
    }

    throw new Error(`Unexpected fetch: ${url}`);
  });

  let response = await worker.fetch(new Request("https://wenj.online/api/link?user=health_check"), env);
  assert.equal(response.status, 404);
  assert.deepEqual(await response.json(), {
    message: "用户不存在或输入错误。",
  });

  response = await worker.fetch(new Request("https://wenj.online/health_check"), env);
  assert.equal(response.status, 404);
  assert.equal(await response.text(), "用户不存在或链接错误");

  response = await worker.fetch(new Request("https://wenj.online/api/check"), env);
  assert.equal(response.status, 200);
  assert.deepEqual(await response.json(), {
    status: "ok",
    message: "当前服务大陆连通性参考正常。",
  });
});

test("/api/check rejects invalid health_check keys before third-party checks", async (t) => {
  const env = makeEnv({
    health_check: makeOutlineKeyWithEncodedUserInfo("not!base64"),
  });
  let fetchCalled = false;

  withMockFetch(t, async () => {
    fetchCalled = true;
    throw new Error("fetch should not be called");
  });

  const response = await worker.fetch(new Request("https://wenj.online/api/check"), env);

  assert.equal(response.status, 500);
  assert.deepEqual(await response.json(), {
    status: "unavailable",
    message: "当前服务检测配置异常，请联系管理员。",
  });
  assert.equal(fetchCalled, false);
});

test("/api/check returns cached status from OUTLINE_META without calling third-party API", async (t) => {
  const env = makeEnv({
    health_check: makeOutlineKey(),
  }, {
    health_check_status: JSON.stringify({
      status: "ok",
      message: "当前服务大陆连通性参考正常。",
      httpStatus: 200,
      checkedAt: Date.now(),
      target: `${TEST_HOST}:${TEST_PORT}`,
    }),
  });
  let fetchCalled = false;

  withMockFetch(t, async () => {
    fetchCalled = true;
    throw new Error("fetch should not be called on cache hit");
  });

  const response = await worker.fetch(new Request("https://wenj.online/api/check"), env);
  const body = await response.json();

  assert.equal(response.status, 200);
  assert.deepEqual(body, {
    status: "ok",
    message: "当前服务大陆连通性参考正常。",
  });
  assert.equal(fetchCalled, false);
  assert.equal(JSON.stringify(body).includes(TEST_HOST), false);
});

test("/api/check ignores invalid or unsafe cached status values", async (t) => {
  const now = Date.now();
  const badCaches = [
    "not-json",
    JSON.stringify({
      status: "hacked",
      message: "当前服务大陆连通性参考正常。",
      httpStatus: 200,
      checkedAt: now,
      target: `${TEST_HOST}:${TEST_PORT}`,
    }),
    JSON.stringify({
      status: "ok",
      message: "当前服务大陆连通性参考正常。",
      httpStatus: 999,
      checkedAt: now,
      target: `${TEST_HOST}:${TEST_PORT}`,
    }),
    JSON.stringify({
      status: "ok",
      message: "当前服务大陆连通性参考正常。",
      httpStatus: "abc",
      checkedAt: now,
      target: `${TEST_HOST}:${TEST_PORT}`,
    }),
    JSON.stringify({
      status: "ok",
      message: `当前服务 ${TEST_HOST}:${TEST_PORT} 正常。`,
      httpStatus: 200,
      checkedAt: now,
      target: `${TEST_HOST}:${TEST_PORT}`,
    }),
    JSON.stringify({
      status: "unavailable",
      message: "检测暂不可用，请稍后重试。",
      httpStatus: 200,
      checkedAt: now,
      target: `${TEST_HOST}:${TEST_PORT}`,
    }),
    JSON.stringify({
      status: "unavailable",
      message: "检测暂不可用，请稍后重试。",
      httpStatus: 503,
      checkedAt: now,
      ttlMs: 5 * 60 * 1000,
      target: `${TEST_HOST}:${TEST_PORT}`,
    }),
    JSON.stringify({
      status: "unavailable",
      message: "检测暂不可用，请稍后重试。",
      httpStatus: 503,
      checkedAt: now,
      target: `${TEST_HOST}:${TEST_PORT}`,
    }),
  ];
  const calls = withHealthyCheckMock(t);

  for (const rawCache of badCaches) {
    const env = makeEnv({
      health_check: makeOutlineKey(),
    }, {
      health_check_status: rawCache,
    });

    const response = await worker.fetch(new Request("https://wenj.online/api/check"), env);
    const body = await response.json();

    assert.equal(response.status, 200);
    assert.deepEqual(body, {
      status: "ok",
      message: "当前服务大陆连通性参考正常。",
    });
    assert.equal(JSON.stringify(body).includes(TEST_HOST), false);
  }

  assert.equal(calls.tcp, badCaches.length);
});

test("/api/check ignores stale or target-mismatched cache entries", async (t) => {
  const now = Date.now();
  const staleCache = JSON.stringify({
    status: "ok",
    message: "当前服务大陆连通性参考正常。",
    httpStatus: 200,
    checkedAt: now - (5 * 60 * 1000) - 1,
    target: `${TEST_HOST}:${TEST_PORT}`,
  });
  const mismatchedTargetCache = JSON.stringify({
    status: "ok",
    message: "当前服务大陆连通性参考正常。",
    httpStatus: 200,
    checkedAt: now,
    target: "203.0.113.11:50440",
  });
  const futureCache = JSON.stringify({
    status: "ok",
    message: "当前服务大陆连通性参考正常。",
    httpStatus: 200,
    checkedAt: now + 60 * 1000,
    target: `${TEST_HOST}:${TEST_PORT}`,
  });
  const calls = withHealthyCheckMock(t);

  for (const rawCache of [staleCache, mismatchedTargetCache, futureCache]) {
    const env = makeEnv({
      health_check: makeOutlineKey(),
    }, {
      health_check_status: rawCache,
    });

    const response = await worker.fetch(new Request("https://wenj.online/api/check"), env);

    assert.equal(response.status, 200);
    assert.deepEqual(await response.json(), {
      status: "ok",
      message: "当前服务大陆连通性参考正常。",
    });
  }

  assert.equal(calls.tcp, 3);
});

test("/api/check ignores expired negative cache entries", async (t) => {
  const now = Date.now();
  const env = makeEnv({
    health_check: makeOutlineKey(),
  }, {
    health_check_status: JSON.stringify({
      status: "unavailable",
      message: "检测暂不可用，请稍后重试。",
      httpStatus: 503,
      checkedAt: now - (60 * 1000) - 1,
      ttlMs: 60 * 1000,
      target: `${TEST_HOST}:${TEST_PORT}`,
    }),
  });
  const calls = withHealthyCheckMock(t);

  const response = await worker.fetch(new Request("https://wenj.online/api/check"), env);

  assert.equal(response.status, 200);
  assert.deepEqual(await response.json(), {
    status: "ok",
    message: "当前服务大陆连通性参考正常。",
  });
  assert.equal(calls.tcp, 1);
});

test("/api/check still responds when cache writes fail", async (t) => {
  const env = {
    OUTLINE_USERS: {
      get: async (key) => key === "health_check" ? makeOutlineKey() : null,
    },
    OUTLINE_META: {
      get: async () => null,
      put: async () => {
        throw new Error("cache write failed");
      },
    },
  };

  withHealthyCheckMock(t);

  const response = await worker.fetch(new Request("https://wenj.online/api/check"), env);

  assert.equal(response.status, 200);
  assert.deepEqual(await response.json(), {
    status: "ok",
    message: "当前服务大陆连通性参考正常。",
  });
});

test("/api/check ignores cache read failures and runs a fresh check", async (t) => {
  let cacheWrite = null;
  const env = {
    OUTLINE_USERS: {
      get: async (key) => key === "health_check" ? makeOutlineKey() : null,
    },
    OUTLINE_META: {
      get: async () => {
        throw new Error("cache read failed");
      },
      put: async (key, value) => {
        cacheWrite = { key, value };
      },
    },
  };
  const calls = withHealthyCheckMock(t);

  const response = await worker.fetch(new Request("https://wenj.online/api/check"), env);

  assert.equal(response.status, 200);
  assert.deepEqual(await response.json(), {
    status: "ok",
    message: "当前服务大陆连通性参考正常。",
  });
  assert.equal(calls.tcp, 1);
  assert.equal(cacheWrite.key, "health_check_status");
});

test("/api/check treats reports without explicit status as unavailable", async (t) => {
  const metaRecords = {};
  const env = makeEnv({
    health_check: makeOutlineKey(),
  }, metaRecords);
  const calls = {
    tcp: 0,
    report: 0,
  };

  withMockFetch(t, async (url) => {
    if (String(url) === "https://api.check-host.cc/tcp") {
      calls.tcp += 1;

      return jsonResponse({
        success: true,
        uuid: "empty-status",
      });
    }

    if (String(url) === "https://api.check-host.cc/report/empty-status") {
      calls.report += 1;

      return jsonResponse({
        data: {
          "CN-BJ-Test": {
            checks: [{}],
          },
        },
      });
    }

    throw new Error(`Unexpected fetch: ${url}`);
  });

  const result = await checkCurrentService(env, {
    pollDelayMs: 0,
  });

  assert.deepEqual(result, {
    status: "unavailable",
    message: "检测暂不可用，请稍后重试。",
    httpStatus: 503,
  });
  assert.equal(calls.tcp, 1);
  assert.equal(calls.report, 5);

  const cachedResult = JSON.parse(metaRecords.health_check_status);
  assert.equal(cachedResult.status, "unavailable");
  assert.equal(cachedResult.httpStatus, 503);
  assert.equal(cachedResult.ttlMs, 60 * 1000);
});

test("/api/check retries polling when a report response is not JSON", async (t) => {
  const env = makeEnv({
    health_check: makeOutlineKey(),
  });
  let reportCalls = 0;

  withMockFetch(t, async (url) => {
    if (String(url) === "https://api.check-host.cc/tcp") {
      return jsonResponse({
        success: true,
        uuid: "bad-json-report",
      });
    }

    if (String(url) === "https://api.check-host.cc/report/bad-json-report") {
      reportCalls += 1;

      if (reportCalls === 1) {
        return new Response("not-json", {
          status: 200,
          headers: {
            "Content-Type": "application/json; charset=utf-8",
          },
        });
      }

      return jsonResponse({
        data: {
          "CN-BJ-Test": {
            checks: [
              {
                status: 1,
              },
            ],
          },
        },
      });
    }

    throw new Error(`Unexpected fetch: ${url}`);
  });

  const result = await checkCurrentService(env, {
    pollDelayMs: 0,
  });

  assert.deepEqual(result, {
    status: "ok",
    message: "当前服务大陆连通性参考正常。",
    httpStatus: 200,
  });
  assert.equal(reportCalls, 2);
});

test("/api/check retries polling when a report fetch fails once", async (t) => {
  const env = makeEnv({
    health_check: makeOutlineKey(),
  });
  let reportCalls = 0;

  withMockFetch(t, async (url) => {
    if (String(url) === "https://api.check-host.cc/tcp") {
      return jsonResponse({
        success: true,
        uuid: "failed-report-fetch",
      });
    }

    if (String(url) === "https://api.check-host.cc/report/failed-report-fetch") {
      reportCalls += 1;

      if (reportCalls === 1) {
        throw new Error("transient report fetch failure");
      }

      return jsonResponse({
        data: {
          "CN-BJ-Test": {
            checks: [
              {
                status: 1,
              },
            ],
          },
        },
      });
    }

    throw new Error(`Unexpected fetch: ${url}`);
  });

  const result = await checkCurrentService(env, {
    pollDelayMs: 0,
  });

  assert.deepEqual(result, {
    status: "ok",
    message: "当前服务大陆连通性参考正常。",
    httpStatus: 200,
  });
  assert.equal(reportCalls, 2);
});

test("/api/check caches third-party dispatch failures briefly", async (t) => {
  const metaRecords = {};
  const env = makeEnv({
    health_check: makeOutlineKey(),
  }, metaRecords);
  let tcpCalls = 0;

  withMockFetch(t, async (url) => {
    if (String(url) === "https://api.check-host.cc/tcp") {
      tcpCalls += 1;
      return jsonResponse({ success: false }, 503);
    }

    throw new Error(`Unexpected fetch: ${url}`);
  });

  let response = await worker.fetch(new Request("https://wenj.online/api/check"), env);
  assert.equal(response.status, 503);
  assert.deepEqual(await response.json(), {
    status: "unavailable",
    message: "检测暂不可用，请稍后重试。",
  });

  response = await worker.fetch(new Request("https://wenj.online/api/check"), env);
  assert.equal(response.status, 503);
  assert.deepEqual(await response.json(), {
    status: "unavailable",
    message: "检测暂不可用，请稍后重试。",
  });

  const cachedResult = JSON.parse(metaRecords.health_check_status);
  assert.equal(tcpCalls, 1);
  assert.equal(cachedResult.status, "unavailable");
  assert.equal(cachedResult.ttlMs, 60 * 1000);
});

test("/api/check coalesces concurrent cache misses for the same target", async (t) => {
  const env = makeEnv({
    health_check: makeOutlineKey(),
  });
  const calls = {
    tcp: 0,
    report: 0,
  };

  withMockFetch(t, async (url) => {
    if (String(url) === "https://api.check-host.cc/tcp") {
      calls.tcp += 1;

      return jsonResponse({
        success: true,
        uuid: "coalesced-check",
      });
    }

    if (String(url) === "https://api.check-host.cc/report/coalesced-check") {
      calls.report += 1;
      await new Promise((resolve) => setTimeout(resolve, 25));

      return jsonResponse({
        data: {
          "CN-BJ-Test": {
            checks: [
              {
                status: 1,
              },
            ],
          },
        },
      });
    }

    throw new Error(`Unexpected fetch: ${url}`);
  });

  const responses = await Promise.all(Array.from({ length: 6 }, () => (
    worker.fetch(new Request("https://wenj.online/api/check"), env)
  )));

  for (const response of responses) {
    assert.equal(response.status, 200);
    assert.deepEqual(await response.json(), {
      status: "ok",
      message: "当前服务大陆连通性参考正常。",
    });
  }

  assert.equal(calls.tcp, 1);
  assert.equal(calls.report, 1);
});

test("/api/check reports unstable service when China TCP nodes are partially reachable", async (t) => {
  const env = makeEnv({
    health_check: makeOutlineKey(),
  });

  withMockFetch(t, async (url) => {
    if (String(url) === "https://api.check-host.cc/tcp") {
      return jsonResponse({
        success: true,
        uuid: "check-partial",
      });
    }

    if (String(url) === "https://api.check-host.cc/report/check-partial") {
      return jsonResponse({
        data: {
          "CN-BJ-Test": {
            checks: [
              {
                status: 1,
              },
            ],
          },
          "CN-SH-Test": {
            checks: [
              {
                status: 0,
                errortext: "Connection timed out",
              },
            ],
          },
        },
      });
    }

    throw new Error(`Unexpected fetch: ${url}`);
  });

  const response = await worker.fetch(new Request("https://wenj.online/api/check"), env);
  const body = await response.json();

  assert.equal(response.status, 200);
  assert.deepEqual(body, {
    status: "warning",
    message: "当前服务部分地区可达，连通性不稳定。",
  });
});

test("service check times out slow third-party requests", async () => {
  const env = makeEnv({
    health_check: makeOutlineKey(),
  });

  const result = await checkCurrentService(env, {
    requestTimeoutMs: 10,
    fetch: async () => new Promise(() => {}),
  });

  assert.deepEqual(result, {
    status: "unavailable",
    message: "检测暂不可用，请稍后重试。",
    httpStatus: 503,
  });
});

test("service check times out slow JSON bodies and releases in-flight checks", async () => {
  const env = makeEnv({
    health_check: makeOutlineKey(),
  }, {});
  const encoder = new TextEncoder();
  let mode = "slow-body";
  let tcpCalls = 0;

  const fetchImpl = async (url) => {
    if (String(url) === "https://api.check-host.cc/tcp") {
      tcpCalls += 1;

      if (mode === "slow-body") {
        return new Response(new ReadableStream({
          start(controller) {
            controller.enqueue(encoder.encode('{"success":true,"uuid":"slow-body"'));
          },
        }), {
          status: 200,
          headers: {
            "Content-Type": "application/json; charset=utf-8",
          },
        });
      }

      return jsonResponse({
        success: true,
        uuid: "fresh-after-slow-body",
      });
    }

    if (String(url) === "https://api.check-host.cc/report/fresh-after-slow-body") {
      return jsonResponse({
        data: {
          "CN-BJ-Test": {
            checks: [
              {
                status: 1,
              },
            ],
          },
        },
      });
    }

    throw new Error(`Unexpected fetch: ${url}`);
  };

  let result = await checkCurrentService(env, {
    fetch: fetchImpl,
    requestTimeoutMs: 10,
    pollDelayMs: 0,
  });

  assert.deepEqual(result, {
    status: "unavailable",
    message: "检测暂不可用，请稍后重试。",
    httpStatus: 503,
  });

  mode = "healthy";
  result = await checkCurrentService(env, {
    fetch: fetchImpl,
    requestTimeoutMs: 10,
    pollDelayMs: 0,
    now: Date.now() + 60 * 1000 + 1,
  });

  assert.deepEqual(result, {
    status: "ok",
    message: "当前服务大陆连通性参考正常。",
    httpStatus: 200,
  });
  assert.equal(tcpCalls, 2);
});

test("service check reports warning when China TCP nodes fail", async (t) => {
  const env = makeEnv({
    health_check: makeOutlineKey(),
  });

  withMockFetch(t, async (url) => {
    if (String(url) === "https://api.check-host.cc/tcp") {
      return jsonResponse({
        success: true,
        uuid: "check-2",
      });
    }

    if (String(url) === "https://api.check-host.cc/report/check-2") {
      return jsonResponse({
        data: {
          "CN-SH-Test": {
            checks: [
              {
                status: 0,
                errortext: "Connection timed out",
              },
            ],
          },
        },
      });
    }

    throw new Error(`Unexpected fetch: ${url}`);
  });

  const result = await checkCurrentService(env, {
    pollDelayMs: 0,
  });

  assert.deepEqual(result, {
    status: "warning",
    message: "当前服务大陆连通性参考异常，请联系管理员。",
    httpStatus: 200,
  });
  assert.equal(JSON.stringify(result).includes(TEST_HOST), false);
});

test("/api/check returns unavailable when health_check is missing", async (t) => {
  const env = makeEnv({});
  let fetchCalled = false;

  withMockFetch(t, async () => {
    fetchCalled = true;
    throw new Error("fetch should not be called");
  });

  const response = await worker.fetch(new Request("https://wenj.online/api/check"), env);
  const body = await response.json();

  assert.equal(response.status, 503);
  assert.deepEqual(body, {
    status: "unavailable",
    message: "当前服务检测未配置，请联系管理员。",
  });
  assert.equal(fetchCalled, false);
});

test("home page includes stale-result and accessibility safeguards", () => {
  const html = renderHomePage();

  assert.match(html, /content="width=device-width, initial-scale=1, maximum-scale=1, user-scalable=no, viewport-fit=cover"/);
  assert.match(html, /touch-action: pan-x pan-y/);
  assert.match(html, /button:focus-visible,\s*input:focus-visible/);
  assert.match(html, /--group-border: #38383a/);
  assert.match(html, /\.get-button \{[\s\S]*min-height: 40px/);
  assert.match(html, /\.text-button \{[\s\S]*min-height: 40px/);
  assert.match(html, /\.copy-btn \{[\s\S]*min-height: 40px/);
  assert.match(html, /id="generateButton" onclick="generateLink\(\)">获取链接<\/button>/);
  assert.match(html, /inputmode="email" oninput="handleUsernameInput\(\)"/);
  assert.match(html, /class="result" id="resultBox" role="status" aria-live="polite"/);
  assert.match(html, /Outline 订阅链接/);
  assert.match(html, /小火箭订阅链接/);
  assert.match(html, /id="outlineLinkText"/);
  assert.match(html, /id="shadowrocketLinkText"/);
  assert.match(html, /id="outlineCopyState"><\/span>/);
  assert.match(html, /id="shadowrocketCopyState"><\/span>/);
  assert.match(html, /let activeLinkRequest = null/);
  assert.match(html, /activeLinkRequest\.abort\(\)/);
  assert.match(html, /new AbortController\(\)/);
  assert.match(html, /event\.isComposing/);
  assert.match(html, /activeLinkRequest !== controller \|\| err\.name === 'AbortError'/);
  assert.match(html, /if \(generateButton\.disabled\)/);
  assert.match(html, /if \(checkButton\.disabled\)/);
});

test("home page blocks iOS pinch zoom without blocking single-touch scrolling", () => {
  const { documentListeners } = createHomePageRuntime(async () => jsonResponse({}));

  for (const eventType of ["gesturestart", "gesturechange"]) {
    const [{ listener, options }] = documentListeners.get(eventType);
    let prevented = false;

    listener({
      preventDefault: () => {
        prevented = true;
      },
    });

    assert.equal(prevented, true, eventType);
    assert.equal(options.passive, false, eventType);
  }

  for (const eventType of ["touchstart", "touchmove"]) {
    const [{ listener, options }] = documentListeners.get(eventType);
    let singleTouchPrevented = false;
    let multiTouchPrevented = false;

    listener({
      touches: [{}],
      preventDefault: () => {
        singleTouchPrevented = true;
      },
    });
    listener({
      touches: [{}, {}],
      preventDefault: () => {
        multiTouchPrevented = true;
      },
    });

    assert.equal(singleTouchPrevented, false, eventType);
    assert.equal(multiTouchPrevented, true, eventType);
    assert.equal(options.passive, false, eventType);
  }
});

test("home page ignores IME Enter and duplicate link submissions", async () => {
  let fetchCalls = 0;
  let resolveFetch;
  const { context, elements } = createHomePageRuntime(async () => {
    fetchCalls += 1;

    return await new Promise((resolve) => {
      resolveFetch = () => resolve(jsonResponse({
        link: "ssconf://wenj.online/wenju2",
        shadowrocketLink: "https://wenj.online/sub/shadowrocket/wenju2",
      }));
    });
  });

  elements.username.value = "wenju2";
  let prevented = false;
  context.handleUsernameKeydown({
    key: "Enter",
    isComposing: true,
    preventDefault: () => {
      prevented = true;
    },
  });
  assert.equal(fetchCalls, 0);
  assert.equal(prevented, false);

  const firstRequest = context.generateLink();
  const secondRequest = context.generateLink();

  assert.equal(fetchCalls, 1);
  assert.equal(elements.generateButton.disabled, true);

  resolveFetch();
  await Promise.all([firstRequest, secondRequest]);

  assert.equal(elements.generateButton.disabled, false);
  assert.equal(elements.outlineLinkText.innerText, "ssconf://wenj.online/wenju2");
  assert.equal(elements.shadowrocketLinkText.innerText, "https://wenj.online/sub/shadowrocket/wenju2");

  let copiedLink = null;
  context.navigator.clipboard.writeText = async (text) => {
    copiedLink = text;
  };
  await context.copyLink("shadowrocketLinkText", "shadowrocketCopyState");

  assert.equal(copiedLink, "https://wenj.online/sub/shadowrocket/wenju2");
  assert.equal(elements.shadowrocketCopyState.innerText, "已复制");
});

test("home page keeps stale aborted link errors from replacing new input state", async () => {
  let resolveFetch;
  const { context, elements } = createHomePageRuntime(async () => (
    await new Promise((resolve) => {
      resolveFetch = () => resolve(new Response("not-json", {
        status: 200,
        headers: {
          "Content-Type": "application/json; charset=utf-8",
        },
      }));
    })
  ));

  elements.username.value = "old-user";
  const request = context.generateLink();

  context.handleUsernameInput();
  resolveFetch();
  await request;

  assert.equal(elements.accountStatusBox.style.display, "none");
  assert.equal(elements.accountStatusTitle.innerText, "");
  assert.equal(elements.resultBox.style.display, "none");
});
