import assert from "node:assert/strict";
import test from "node:test";

import worker from "../src/index.js";
import { checkCurrentService } from "../src/service-check.js";

function makeOutlineKey(host = "104.248.220.53", port = 50440) {
  const encodedUserInfo = btoa("chacha20-ietf-poly1305:testpass").replace(/=/g, "");
  return `ss://${encodedUserInfo}@${host}:${port}/?outline=1`;
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

test("subscription endpoint converts Outline keys to JSON", async () => {
  const env = makeEnv({
    wenju2: makeOutlineKey(),
    "haytao0726@gmail.com": makeOutlineKey(),
  });

  let response = await worker.fetch(new Request("https://wenj.online/wenju2"), env);
  assert.equal(response.status, 200);
  assert.deepEqual(await response.json(), {
    server: "104.248.220.53",
    server_port: 50440,
    password: "testpass",
    method: "chacha20-ietf-poly1305",
  });

  response = await worker.fetch(new Request("https://wenj.online/haytao0726%40gmail.com"), env);
  assert.equal(response.status, 200);
  assert.equal((await response.json()).server, "104.248.220.53");
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
  assert.equal(JSON.stringify(body).includes("104.248.220.53"), false);

  const dispatchedBody = JSON.parse(fetchCalls[0].init.body);
  assert.deepEqual(dispatchedBody, {
    target: "104.248.220.53",
    port: 50440,
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

test("/api/check returns cached status from OUTLINE_META without calling third-party API", async (t) => {
  const env = makeEnv({
    health_check: makeOutlineKey(),
  }, {
    health_check_status: JSON.stringify({
      status: "ok",
      message: "当前服务大陆连通性参考正常。",
      httpStatus: 200,
      checkedAt: Date.now(),
      target: "104.248.220.53:50440",
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
  assert.equal(JSON.stringify(body).includes("104.248.220.53"), false);
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
  assert.equal(JSON.stringify(body).includes("104.248.220.53"), false);
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
