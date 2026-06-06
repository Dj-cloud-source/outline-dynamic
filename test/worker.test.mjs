import assert from "node:assert/strict";
import test from "node:test";

import worker from "../src/index.js";
import { checkCurrentService } from "../src/service-check.js";

const TEST_HOST = "203.0.113.10";
const TEST_PORT = 50440;
const TEST_USER_INFO = "chacha20-ietf-poly1305:testpass";

function encodeUserInfo(userInfo) {
  return btoa(userInfo).replace(/=/g, "");
}

function makeOutlineKey(host = TEST_HOST, port = TEST_PORT, userInfo = TEST_USER_INFO) {
  const encodedUserInfo = encodeUserInfo(userInfo);
  return `ss://${encodedUserInfo}@${host}:${port}/?outline=1`;
}

function makeOutlineKeyWithEncodedUserInfo(encodedUserInfo, host = TEST_HOST, port = TEST_PORT) {
  return `ss://${encodedUserInfo}@${host}:${port}/?outline=1`;
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

test("/api/link returns subscription links and hides unknown users", async () => {
  const env = makeEnv({
    wenju2: makeOutlineKey(),
    "haytao0726@gmail.com": makeOutlineKey(),
  });

  let response = await worker.fetch(new Request("https://wenj.online/api/link?user=wenju2"), env);
  assert.equal(response.status, 200);
  assert.deepEqual(await response.json(), {
    link: "ssconf://wenj.online/wenju2",
  });

  response = await worker.fetch(new Request("https://wenj.online/api/link?user=haytao0726%40gmail.com"), env);
  assert.equal(response.status, 200);
  assert.deepEqual(await response.json(), {
    link: "ssconf://wenj.online/haytao0726@gmail.com",
  });

  response = await worker.fetch(new Request("https://wenj.online/api/link?user=missing"), env);
  assert.equal(response.status, 404);
  assert.deepEqual(await response.json(), {
    message: "用户不存在或输入错误。",
  });
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

test("subscription endpoint rejects malformed Outline key variants", async () => {
  for (const [name, outlineKey] of makeInvalidOutlineKeys()) {
    const env = makeEnv({
      broken: outlineKey,
    });

    const response = await worker.fetch(new Request("https://wenj.online/broken"), env);

    assert.equal(response.status, 500, name);
    assert.equal(await response.text(), "配置解析错误", name);
  }
});

test("subscription endpoint rejects malformed encoded paths", async () => {
  const response = await worker.fetch(new Request("https://wenj.online/%E0%A4%A"), makeEnv({}));

  assert.equal(response.status, 404);
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
  const calls = withHealthyCheckMock(t);

  for (const rawCache of [staleCache, mismatchedTargetCache]) {
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

  assert.equal(calls.tcp, 2);
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

test("/api/check reports warning when China TCP nodes fail", async (t) => {
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

  const response = await worker.fetch(new Request("https://wenj.online/api/check"), env);
  const body = await response.json();

  assert.equal(response.status, 200);
  assert.deepEqual(body, {
    status: "warning",
    message: "当前服务大陆连通性参考异常，请联系管理员。",
  });
  assert.equal(JSON.stringify(body).includes(TEST_HOST), false);
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
