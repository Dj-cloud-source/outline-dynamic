export function renderHomePage() {
  return `
    <!DOCTYPE html>
    <html lang="zh-CN">
    <head>
      <meta charset="UTF-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
      <meta name="robots" content="noindex,nofollow">
      <title>Client</title>
      <style>
        :root {
          color-scheme: light;
          --page-bg: #f2f2f7;
          --surface: #ffffff;
          --text: #1c1c1e;
          --muted: #6e6e73;
          --line: #d1d1d6;
          --blue: #007aff;
          --blue-dark: #0063cc;
          --green: #248a3d;
          --amber: #b26a00;
          --red: #d70015;
        }

        * {
          box-sizing: border-box;
        }

        html,
        body {
          width: 100%;
          overflow-x: hidden;
        }

        body {
          min-height: 100vh;
          margin: 0;
          padding: 58px 0 36px;
          background: var(--page-bg);
          color: var(--text);
          font-family: -apple-system, BlinkMacSystemFont, "SF Pro Text", "Segoe UI", Roboto, Helvetica, Arial, sans-serif;
        }

        .page {
          width: calc(100vw - 40px);
          max-width: 640px;
          margin: 0 auto;
        }

        .product-header {
          display: grid;
          grid-template-columns: 92px minmax(0, 1fr) auto;
          gap: 18px;
          align-items: center;
          padding: 4px 2px 28px;
          border-bottom: 1px solid var(--line);
        }

        .icon {
          width: 92px;
          height: 92px;
          display: grid;
          place-items: center;
          border-radius: 8px;
          overflow: hidden;
          background: #113d2d;
          box-shadow: 0 12px 24px rgba(17, 61, 45, 0.18);
        }

        .icon svg {
          width: 100%;
          height: 100%;
          display: block;
        }

        .title {
          margin: 0;
          font-size: 30px;
          line-height: 1.04;
          font-weight: 700;
          letter-spacing: 0;
        }

        .subtitle {
          margin: 7px 0 0;
          color: var(--muted);
          font-size: 17px;
          line-height: 1.35;
        }

        .meta-line {
          display: flex;
          flex-wrap: wrap;
          gap: 8px;
          margin-top: 12px;
          color: #8e8e93;
          font-size: 12px;
          line-height: 1;
        }

        .meta-line span:not(:first-child)::before {
          content: "";
          display: inline-block;
          width: 3px;
          height: 3px;
          margin-right: 8px;
          vertical-align: 3px;
          border-radius: 50%;
          background: #c7c7cc;
        }

        button {
          border: 0;
          cursor: pointer;
          font-family: inherit;
          font-weight: 700;
          white-space: nowrap;
          transition: background-color 0.16s ease, color 0.16s ease, opacity 0.16s ease;
        }

        button:disabled {
          cursor: default;
          opacity: 0.58;
        }

        .get-button {
          min-width: 76px;
          height: 32px;
          padding: 0 18px;
          border-radius: 999px;
          background: var(--blue);
          color: #ffffff;
          font-size: 15px;
          letter-spacing: 0;
        }

        .get-button:hover {
          background: var(--blue-dark);
        }

        .content {
          display: grid;
          gap: 18px;
          padding-top: 24px;
        }

        .section-label {
          margin: 0 0 8px 2px;
          color: #8e8e93;
          font-size: 12px;
          font-weight: 700;
          letter-spacing: 0;
        }

        .group {
          border-radius: 8px;
          border: 1px solid rgba(0, 0, 0, 0.04);
          background: rgba(255, 255, 255, 0.82);
          overflow: hidden;
          backdrop-filter: blur(18px);
        }

        .field-row {
          display: grid;
          grid-template-columns: 116px minmax(0, 1fr);
          align-items: center;
          min-height: 58px;
          padding: 0 16px;
        }

        .field-label {
          color: var(--text);
          font-size: 15px;
          font-weight: 600;
        }

        input {
          width: 100%;
          min-width: 0;
          height: 40px;
          border: 0;
          outline: none;
          background: transparent;
          color: var(--text);
          font-size: 16px;
        }

        input::placeholder {
          color: #a4a4aa;
        }

        .service-row {
          display: grid;
          grid-template-columns: minmax(0, 1fr) auto;
          gap: 16px;
          align-items: center;
          min-height: 68px;
          padding: 12px 16px;
        }

        .row-title {
          margin: 0;
          color: var(--text);
          font-size: 15px;
          font-weight: 600;
        }

        .row-detail {
          margin: 4px 0 0;
          color: var(--muted);
          font-size: 13px;
          line-height: 1.4;
        }

        .text-button {
          height: 32px;
          padding: 0 4px;
          background: transparent;
          color: var(--blue);
          font-size: 15px;
        }

        .text-button:hover {
          color: var(--blue-dark);
        }

        .account-status,
        .service-status,
        .result {
          display: none;
          border-radius: 8px;
          border: 1px solid rgba(0, 0, 0, 0.04);
          background: var(--surface);
          padding: 16px;
        }

        .status-title,
        .result-title {
          margin: 0;
          color: var(--text);
          font-size: 16px;
          font-weight: 700;
          line-height: 1.35;
        }

        .status-detail,
        .result-detail {
          margin: 5px 0 0;
          color: var(--muted);
          font-size: 13px;
          line-height: 1.45;
        }

        .status-ok .status-title {
          color: var(--green);
        }

        .status-warning .status-title {
          color: var(--amber);
        }

        .status-error .status-title,
        .status-unavailable .status-title {
          color: var(--red);
        }

        .link-box {
          margin-top: 14px;
          padding: 12px;
          border-radius: 8px;
          background: #f2f2f7;
          color: #26262a;
          font-size: 12px;
          line-height: 1.45;
          word-break: break-all;
        }

        .copy-row {
          display: flex;
          align-items: center;
          gap: 10px;
          margin-top: 12px;
        }

        .copy-btn {
          min-width: 72px;
          height: 32px;
          padding: 0 14px;
          border-radius: 999px;
          background: #e8f1ff;
          color: #0057b8;
          font-size: 15px;
        }

        .copy-btn:hover {
          background: #dceaff;
        }

        .copy-state {
          min-height: 20px;
          color: var(--muted);
          font-size: 13px;
        }

        @media (max-width: 560px) {
          body {
            padding: 28px 0 28px;
          }

          .page {
            width: calc(100vw - 32px);
          }

          .product-header {
            grid-template-columns: 78px minmax(0, 1fr);
            gap: 12px;
            padding-bottom: 24px;
          }

          .icon {
            width: 78px;
            height: 78px;
            font-size: 36px;
          }

          .title {
            font-size: 27px;
          }

          .subtitle {
            font-size: 15px;
          }

          .meta-line {
            display: none;
          }

          .get-button {
            grid-column: 2;
            justify-self: start;
            min-width: 70px;
            margin-top: 10px;
            padding: 0 14px;
          }

          .field-row {
            grid-template-columns: 1fr;
            gap: 6px;
            align-items: start;
            padding: 12px 16px;
          }

          input {
            height: 34px;
          }

          .service-row {
            grid-template-columns: 1fr;
            gap: 8px;
            min-height: 64px;
          }

          .text-button {
            justify-self: start;
            height: 26px;
            padding: 0;
          }
        }

        @media (max-width: 350px) {
          .product-header {
            grid-template-columns: 66px minmax(0, 1fr);
          }

          .icon {
            width: 66px;
            height: 66px;
            font-size: 31px;
          }

          .get-button {
            margin-top: 8px;
          }
        }
      </style>
    </head>
    <body>
      <main class="page" aria-labelledby="pageTitle">
        <header class="product-header">
          <div class="icon" aria-hidden="true">
            <svg viewBox="0 0 100 100" role="img" aria-label="Client">
              <rect width="100" height="100" rx="18" fill="#113d2d"></rect>
              <path d="M45 25a25 25 0 0 0 0 50z" fill="#5fb89b"></path>
              <path d="M55 25a25 25 0 0 1 0 50V62a12 12 0 0 0 0-24z" fill="#ffffff"></path>
            </svg>
          </div>
          <div>
            <h1 class="title" id="pageTitle">Client</h1>
            <p class="subtitle">账户连接</p>
            <div class="meta-line" aria-hidden="true">
              <span>账户</span>
              <span>服务</span>
              <span>连接</span>
            </div>
          </div>
          <button class="get-button" id="generateButton" onclick="generateLink()">获取</button>
        </header>

        <div class="content">
          <section>
            <p class="section-label">账户</p>
            <div class="group">
              <label class="field-row" for="username">
                <span class="field-label">账号或邮箱</span>
                <input type="text" id="username" placeholder="输入账号或邮箱" autocomplete="off" autocapitalize="none" spellcheck="false">
              </label>
            </div>
          </section>

          <section class="account-status" id="accountStatusBox" role="status" aria-live="polite">
            <p class="status-title" id="accountStatusTitle"></p>
            <p class="status-detail" id="accountStatusDetail"></p>
          </section>

          <section class="result" id="resultBox">
            <p class="result-title">连接链接已准备好</p>
            <p class="result-detail">复制后在客户端中打开。</p>
            <div class="link-box" id="linkText"></div>
            <div class="copy-row">
              <button class="copy-btn" onclick="copyLink()">复制</button>
              <span class="copy-state" id="copyState"></span>
            </div>
          </section>

          <section>
            <p class="section-label">状态</p>
            <div class="group service-row">
              <div>
                <p class="row-title">当前服务</p>
                <p class="row-detail" id="serviceSummary">可随时检测当前服务。</p>
              </div>
              <button class="text-button" id="checkButton" onclick="checkService()">检测</button>
            </div>
          </section>

          <section class="service-status" id="serviceStatusBox" role="status" aria-live="polite">
            <p class="status-title" id="serviceStatusTitle"></p>
            <p class="status-detail" id="serviceStatusDetail"></p>
          </section>
        </div>
      </main>

      <script>
        function setButtonLoading(button, isLoading, loadingText, defaultText) {
          button.disabled = isLoading;
          button.innerText = isLoading ? loadingText : defaultText;
        }

        function hideStatus(kind) {
          const statusBox = document.getElementById(kind + 'StatusBox');
          const statusTitle = document.getElementById(kind + 'StatusTitle');
          const statusDetail = document.getElementById(kind + 'StatusDetail');

          statusBox.style.display = 'none';
          statusBox.className = kind + '-status';
          statusTitle.innerText = '';
          statusDetail.innerText = '';
        }

        function showStatus(kind, type, title, detail) {
          const statusBox = document.getElementById(kind + 'StatusBox');
          const statusTitle = document.getElementById(kind + 'StatusTitle');
          const statusDetail = document.getElementById(kind + 'StatusDetail');

          statusBox.className = kind + '-status status-' + type;
          statusTitle.innerText = title;
          statusDetail.innerText = detail || '';
          statusBox.style.display = 'block';
        }

        function hideResult() {
          const resultBox = document.getElementById('resultBox');
          const linkText = document.getElementById('linkText');
          const copyState = document.getElementById('copyState');

          resultBox.style.display = 'none';
          linkText.innerText = '';
          copyState.innerText = '';
        }

        function normalizeServiceMessage(status, responseOk, originalMessage) {
          if (status === 'ok') {
            return {
              type: 'ok',
              title: '当前服务正常',
              detail: '可以继续获取或使用连接链接。'
            };
          }

          if (status === 'warning') {
            return {
              type: 'warning',
              title: '当前服务可能不稳定',
              detail: '如遇连接失败，请稍后再试。'
            };
          }

          if (!responseOk && originalMessage && originalMessage.includes('联系管理员')) {
            return {
              type: 'unavailable',
              title: '当前服务检测异常',
              detail: '请联系管理员处理。'
            };
          }

          return {
            type: 'unavailable',
            title: '检测暂不可用',
            detail: '请稍后重试。'
          };
        }

        async function generateLink() {
          const user = document.getElementById('username').value.trim();
          const generateButton = document.getElementById('generateButton');
          const linkText = document.getElementById('linkText');

          hideStatus('account');
          hideResult();

          if (!user) {
            showStatus('account', 'error', '请输入账号或邮箱', '确认输入后再获取链接。');
            return;
          }

          setButtonLoading(generateButton, true, '获取中', '获取');

          try {
            const response = await fetch('/api/link?user=' + encodeURIComponent(user));
            const data = await response.json();

            if (!response.ok) {
              if (response.status === 404) {
                showStatus('account', 'error', '未找到账户', '请检查账号或邮箱是否正确。');
              } else {
                showStatus('account', 'error', '暂时无法获取链接', data.message || '请稍后重试。');
              }
              return;
            }

            linkText.innerText = data.link;
            document.getElementById('resultBox').style.display = 'block';
          } catch (err) {
            showStatus('account', 'error', '暂时无法获取链接', '请稍后重试。');
          } finally {
            setButtonLoading(generateButton, false, '获取中', '获取');
          }
        }

        async function checkService() {
          const checkButton = document.getElementById('checkButton');
          const serviceSummary = document.getElementById('serviceSummary');

          hideStatus('service');
          setButtonLoading(checkButton, true, '检测中', '检测');
          serviceSummary.innerText = '正在检测服务。';

          try {
            const response = await fetch('/api/check');
            const data = await response.json();
            const normalized = normalizeServiceMessage(data.status, response.ok, data.message);

            serviceSummary.innerText = normalized.title;
            showStatus('service', normalized.type, normalized.title, normalized.detail);
          } catch (err) {
            serviceSummary.innerText = '检测暂不可用';
            showStatus('service', 'unavailable', '检测暂不可用', '请稍后重试。');
          } finally {
            setButtonLoading(checkButton, false, '检测中', '检测');
          }
        }

        async function copyLink() {
          const link = document.getElementById('linkText').innerText;
          const copyState = document.getElementById('copyState');

          try {
            await navigator.clipboard.writeText(link);
            copyState.innerText = '已复制';
          } catch (err) {
            copyState.innerText = '请手动复制链接';
          }
        }
      </script>
    </body>
    </html>
  `;
}
