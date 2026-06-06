import { getOutlineConnectionTarget, getOutlineKey } from "./outline-subscription.js";

const HEALTH_CHECK_KEY = "health_check";
const CHECK_HOST_API_BASE = "https://api.check-host.cc";
const CHECK_REGION = ["CN"];
const CHECK_POLL_ATTEMPTS = 5;
const CHECK_POLL_DELAY_MS = 800;
const CHECK_REQUEST_TIMEOUT_MS = 3000;
const CHECK_CACHE_KEY = "health_check_status";
const CHECK_CACHE_TTL_MS = 5 * 60 * 1000;
const PUBLIC_MESSAGES_BY_STATUS = {
  ok: new Set(["当前服务大陆连通性参考正常。"]),
  warning: new Set([
    "当前服务大陆连通性参考异常，请联系管理员。",
    "当前服务部分地区可达，连通性不稳定。",
  ]),
  unavailable: new Set([
    "检测暂不可用，请稍后重试。",
    "当前服务检测未配置，请联系管理员。",
    "当前服务检测配置异常，请联系管理员。",
  ]),
};

function delay(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function publicResult(status, message, httpStatus = 200) {
  return { status, message, httpStatus };
}

function getValidatedCachedHttpStatus(status, httpStatus) {
  const statusCode = httpStatus ?? 200;

  if (!Number.isInteger(statusCode) || statusCode < 200 || statusCode > 599) {
    return null;
  }

  if ((status === "ok" || status === "warning") && statusCode !== 200) {
    return null;
  }

  if (status === "unavailable" && statusCode !== 500 && statusCode !== 503) {
    return null;
  }

  return statusCode;
}

function summarizeTcpReport(reportData) {
  const nodes = reportData?.data && typeof reportData.data === "object"
    ? Object.values(reportData.data)
    : [];

  let reachable = 0;
  let failed = 0;

  for (const node of nodes) {
    const checks = Array.isArray(node?.checks) ? node.checks : [];

    if (checks.length === 0) {
      continue;
    }

    const latestCheck = checks[checks.length - 1];

    if (Number(latestCheck?.status) === 1) {
      reachable += 1;
    } else {
      failed += 1;
    }
  }

  return {
    reachable,
    failed,
    completed: reachable + failed,
  };
}

function buildConnectivityResult(summary) {
  if (summary.completed === 0) {
    return publicResult("unavailable", "检测暂不可用，请稍后重试。", 503);
  }

  if (summary.reachable === 0) {
    return publicResult("warning", "当前服务大陆连通性参考异常，请联系管理员。");
  }

  if (summary.failed > 0) {
    return publicResult("warning", "当前服务部分地区可达，连通性不稳定。");
  }

  return publicResult("ok", "当前服务大陆连通性参考正常。");
}

function getTargetCacheKey(target) {
  return `${target.host}:${target.port}`;
}

async function fetchWithTimeout(fetchImpl, url, init = {}, timeoutMs = CHECK_REQUEST_TIMEOUT_MS) {
  const controller = new AbortController();
  let timeoutId;

  try {
    return await Promise.race([
      fetchImpl(url, {
        ...init,
        signal: controller.signal,
      }),
      new Promise((_, reject) => {
        timeoutId = setTimeout(() => {
          controller.abort();
          reject(new Error("Request timed out"));
        }, timeoutMs);
      }),
    ]);
  } finally {
    clearTimeout(timeoutId);
  }
}

async function dispatchTcpCheck(fetchImpl, target, requestTimeoutMs) {
  const response = await fetchWithTimeout(fetchImpl, `${CHECK_HOST_API_BASE}/tcp`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      target: target.host,
      port: target.port,
      region: CHECK_REGION,
    }),
  }, requestTimeoutMs);

  if (!response.ok) {
    return null;
  }

  const data = await response.json();
  return data?.success && data?.uuid ? data.uuid : null;
}

async function pollTcpReport(fetchImpl, uuid, requestTimeoutMs) {
  let latestCompletedSummary = null;

  for (let attempt = 0; attempt < CHECK_POLL_ATTEMPTS; attempt += 1) {
    if (attempt > 0) {
      await delay(CHECK_POLL_DELAY_MS);
    }

    const response = await fetchWithTimeout(fetchImpl, `${CHECK_HOST_API_BASE}/report/${uuid}`, {}, requestTimeoutMs);

    if (!response.ok) {
      continue;
    }

    let data;
    try {
      data = await response.json();
    } catch (e) {
      continue;
    }

    const summary = summarizeTcpReport(data);

    if (summary.reachable > 0) {
      return buildConnectivityResult(summary);
    }

    if (summary.completed > 0) {
      latestCompletedSummary = summary;
    }
  }

  if (latestCompletedSummary) {
    return buildConnectivityResult(latestCompletedSummary);
  }

  return publicResult("unavailable", "检测暂不可用，请稍后重试。", 503);
}

async function readCachedResult(env, target, now) {
  if (!env.OUTLINE_META?.get) {
    return null;
  }

  try {
    const rawCachedResult = await env.OUTLINE_META.get(CHECK_CACHE_KEY);

    if (!rawCachedResult) {
      return null;
    }

    const cachedResult = JSON.parse(rawCachedResult);
    const isFresh = typeof cachedResult.checkedAt === "number"
      && now - cachedResult.checkedAt <= CHECK_CACHE_TTL_MS;
    const matchesTarget = cachedResult.target === getTargetCacheKey(target);
    const allowedMessages = PUBLIC_MESSAGES_BY_STATUS[cachedResult.status];
    const hasPublicShape = Boolean(allowedMessages)
      && allowedMessages.has(cachedResult.message);
    const httpStatus = getValidatedCachedHttpStatus(cachedResult.status, cachedResult.httpStatus);

    if (!isFresh || !matchesTarget || !hasPublicShape || !httpStatus) {
      return null;
    }

    return publicResult(cachedResult.status, cachedResult.message, httpStatus);
  } catch (e) {
    return null;
  }
}

async function writeCachedResult(env, target, result, now) {
  if (!env.OUTLINE_META?.put || result.httpStatus !== 200) {
    return;
  }

  try {
    await env.OUTLINE_META.put(CHECK_CACHE_KEY, JSON.stringify({
      status: result.status,
      message: result.message,
      httpStatus: result.httpStatus,
      checkedAt: now,
      target: getTargetCacheKey(target),
    }));
  } catch (e) {
    // 缓存失败不影响本次检测结果。
  }
}

export async function checkCurrentService(env = {}, options = {}) {
  const fetchImpl = options.fetch || fetch;
  const now = options.now ?? Date.now();
  const requestTimeoutMs = options.requestTimeoutMs ?? CHECK_REQUEST_TIMEOUT_MS;
  const outlineKey = await getOutlineKey(env, HEALTH_CHECK_KEY);

  if (!outlineKey) {
    return publicResult("unavailable", "当前服务检测未配置，请联系管理员。", 503);
  }

  let target;

  try {
    target = getOutlineConnectionTarget(outlineKey);
  } catch (e) {
    return publicResult("unavailable", "当前服务检测配置异常，请联系管理员。", 500);
  }

  if (!target.host || !Number.isInteger(target.port)) {
    return publicResult("unavailable", "当前服务检测配置异常，请联系管理员。", 500);
  }

  const cachedResult = await readCachedResult(env, target, now);

  if (cachedResult) {
    return cachedResult;
  }

  try {
    const uuid = await dispatchTcpCheck(fetchImpl, target, requestTimeoutMs);

    if (!uuid) {
      return publicResult("unavailable", "检测暂不可用，请稍后重试。", 503);
    }

    const result = await pollTcpReport(fetchImpl, uuid, requestTimeoutMs);
    await writeCachedResult(env, target, result, now);

    return result;
  } catch (e) {
    return publicResult("unavailable", "检测暂不可用，请稍后重试。", 503);
  }
}
