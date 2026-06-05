import { getOutlineConnectionTarget, getOutlineKey } from "./outline-subscription.js";

const HEALTH_CHECK_KEY = "health_check";
const CHECK_HOST_API_BASE = "https://api.check-host.cc";
const CHECK_REGION = ["CN"];
const CHECK_POLL_ATTEMPTS = 5;
const CHECK_POLL_DELAY_MS = 800;

function delay(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function publicResult(status, message, httpStatus = 200) {
  return { status, message, httpStatus };
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
    return publicResult("warning", "当前服务疑似异常，请联系管理员。");
  }

  if (summary.failed > 0) {
    return publicResult("warning", "当前服务部分地区可达，连通性不稳定。");
  }

  return publicResult("ok", "当前服务连通性正常。");
}

async function dispatchTcpCheck(fetchImpl, target) {
  const response = await fetchImpl(`${CHECK_HOST_API_BASE}/tcp`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      target: target.host,
      port: target.port,
      region: CHECK_REGION,
    }),
  });

  if (!response.ok) {
    return null;
  }

  const data = await response.json();
  return data?.success && data?.uuid ? data.uuid : null;
}

async function pollTcpReport(fetchImpl, uuid) {
  let latestCompletedSummary = null;

  for (let attempt = 0; attempt < CHECK_POLL_ATTEMPTS; attempt += 1) {
    if (attempt > 0) {
      await delay(CHECK_POLL_DELAY_MS);
    }

    const response = await fetchImpl(`${CHECK_HOST_API_BASE}/report/${uuid}`);

    if (!response.ok) {
      continue;
    }

    const data = await response.json();
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

export async function checkCurrentService(env = {}, options = {}) {
  const fetchImpl = options.fetch || fetch;
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

  try {
    const uuid = await dispatchTcpCheck(fetchImpl, target);

    if (!uuid) {
      return publicResult("unavailable", "检测暂不可用，请稍后重试。", 503);
    }

    return await pollTcpReport(fetchImpl, uuid);
  } catch (e) {
    return publicResult("unavailable", "检测暂不可用，请稍后重试。", 503);
  }
}
