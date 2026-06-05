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
          --soft-line: #e5e5ea;
          --blue: #007aff;
          --blue-dark: #0063cc;
          --green: #248a3d;
          --amber: #b26a00;
          --red: #d70015;
        }

        * {
          box-sizing: border-box;
        }

        body {
          min-height: 100vh;
          margin: 0;
          display: flex;
          align-items: center;
          justify-content: center;
          padding: 24px 14px;
          background: var(--page-bg);
          color: var(--text);
          font-family: -apple-system, BlinkMacSystemFont, "SF Pro Text", "Segoe UI", Roboto, Helvetica, Arial, sans-serif;
        }

        .shell {
          width: min(100%, 430px);
        }

        .panel {
          width: 100%;
          padding: 28px;
          border: 1px solid rgba(0, 0, 0, 0.05);
          border-radius: 8px;
          background: var(--surface);
          box-shadow: 0 18px 48px rgba(0, 0, 0, 0.08);
        }

        .app-header {
          display: grid;
          grid-template-columns: 74px 1fr;
          gap: 16px;
          align-items: center;
          padding-bottom: 22px;
          border-bottom: 1px solid var(--soft-line);
        }

        .app-icon {
          width: 74px;
          height: 74px;
          display: grid;
          place-items: center;
          border-radius: 18px;
          background:
            radial-gradient(circle at 28% 22%, rgba(255, 255, 255, 0.62), transparent 28%),
            linear-gradient(145deg, #1b8cff 0%, #3157d5 58%, #6247d6 100%);
          color: #ffffff;
          font-size: 34px;
          font-weight: 700;
          line-height: 1;
          box-shadow: inset 0 0 0 1px rgba(255, 255, 255, 0.28), 0 10px 22px rgba(0, 122, 255, 0.24);
        }

        .app-title {
          margin: 0;
          font-size: 26px;
          line-height: 1.08;
          font-weight: 700;
        }

        .app-subtitle {
          margin: 6px 0 0;
          color: var(--muted);
          font-size: 15px;
          line-height: 1.35;
        }

        .form-area {
          padding-top: 22px;
        }

        label {
          display: block;
          margin-bottom: 8px;
          color: var(--muted);
          font-size: 13px;
          font-weight: 600;
        }

        input {
          width: 100%;
          height: 48px;
          padding: 0 14px;
          border: 1px solid var(--line);
          border-radius: 8px;
          outline: none;
          background: #ffffff;
          color: var(--text);
          font-size: 16px;
          transition: border-color 0.16s ease, box-shadow 0.16s ease;
        }

        input:focus {
          border-color: var(--blue);
          box-shadow: 0 0 0 4px rgba(0, 122, 255, 0.14);
        }

        .actions {
          display: grid;
          grid-template-columns: 1fr 1fr;
          gap: 10px;
          margin-top: 14px;
        }

        button {
          height: 44px;
          border: 0;
          border-radius: 999px;
          cursor: pointer;
          font-size: 15px;
          font-weight: 700;
          transition: background-color 0.16s ease, color 0.16s ease, transform 0.16s ease;
        }

        button:hover {
          transform: translateY(-1px);
        }

        button:disabled {
          cursor: default;
          opacity: 0.62;
          transform: none;
        }

        .primary-btn {
          background: var(--blue);
          color: #ffffff;
        }

        .primary-btn:hover {
          background: var(--blue-dark);
        }

        .secondary-btn {
          background: #e8f1ff;
          color: #0057b8;
        }

        .secondary-btn:hover {
          background: #dceaff;
        }

        .message,
        .result-box {
          display: none;
          margin-top: 18px;
          padding-top: 18px;
          border-top: 1px solid var(--soft-line);
        }

        .message-title,
        .result-title {
          margin: 0;
          font-size: 15px;
          font-weight: 700;
          line-height: 1.4;
        }

        .message-detail,
        .result-detail {
          margin: 4px 0 0;
          color: var(--muted);
          font-size: 13px;
          line-height: 1.45;
        }

        .message-ok .message-title {
          color: var(--green);
        }

        .message-warning .message-title {
          color: var(--amber);
        }

        .message-error .message-title,
        .message-unavailable .message-title {
          color: var(--red);
        }

        .link-value {
          margin-top: 12px;
          padding: 12px;
          border: 1px solid var(--soft-line);
          border-radius: 8px;
          background: #f9f9fb;
          color: #26262a;
          font-size: 13px;
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
          width: 116px;
          background: #30d158;
          color: #ffffff;
        }

        .copy-btn:hover {
          background: #27b84b;
        }

        .copy-state {
          min-height: 20px;
          color: var(--muted);
          font-size: 13px;
        }

        @media (max-width: 420px) {
          body {
            align-items: flex-start;
            padding-top: 18px;
          }

          .panel {
            padding: 22px;
          }

          .app-header {
            grid-template-columns: 64px 1fr;
            gap: 14px;
          }

          .app-icon {
            width: 64px;
            height: 64px;
            border-radius: 16px;
            font-size: 30px;
          }

          .app-title {
            font-size: 23px;
          }

          .actions {
            grid-template-columns: 1fr;
          }
        }
      </style>
    </head>
    <body>
      <main class="shell">
        <section class="panel" aria-labelledby="pageTitle">
          <div class="app-header">
            <div class="app-icon" aria-hidden="true">C</div>
            <div>
              <h1 class="app-title" id="pageTitle">Client</h1>
              <p class="app-subtitle">账户连接</p>
            </div>
          </div>

          <div class="form-area">
            <label for="username">账号或邮箱</label>
            <input type="text" id="username" placeholder="输入账号或邮箱" autocomplete="off" autocapitalize="none" spellcheck="false">

            <div class="actions">
              <button class="primary-btn" id="generateButton" onclick="generateLink()">获取链接</button>
              <button class="secondary-btn" id="checkButton" onclick="checkService()">检测服务</button>
            </div>

            <div class="message" id="messageBox" role="status" aria-live="polite">
              <p class="message-title" id="messageTitle"></p>
              <p class="message-detail" id="messageDetail"></p>
            </div>

            <div class="result-box" id="resultBox">
              <p class="result-title">连接链接已准备好</p>
              <p class="result-detail">复制后在客户端中打开。</p>
              <div class="link-value" id="linkText"></div>
              <div class="copy-row">
                <button class="copy-btn" onclick="copyLink()">复制链接</button>
                <span class="copy-state" id="copyState"></span>
              </div>
            </div>
          </div>
        </section>
      </main>

      <script>
        function setButtonLoading(button, isLoading, loadingText, defaultText) {
          button.disabled = isLoading;
          button.innerText = isLoading ? loadingText : defaultText;
        }

        function hideMessage() {
          const messageBox = document.getElementById('messageBox');
          const messageTitle = document.getElementById('messageTitle');
          const messageDetail = document.getElementById('messageDetail');

          messageBox.style.display = 'none';
          messageBox.className = 'message';
          messageTitle.innerText = '';
          messageDetail.innerText = '';
        }

        function showMessage(type, title, detail) {
          const messageBox = document.getElementById('messageBox');
          const messageTitle = document.getElementById('messageTitle');
          const messageDetail = document.getElementById('messageDetail');

          messageBox.className = 'message message-' + type;
          messageTitle.innerText = title;
          messageDetail.innerText = detail || '';
          messageBox.style.display = 'block';
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

          hideMessage();
          hideResult();

          if (!user) {
            showMessage('error', '请输入账号或邮箱', '确认输入后再获取链接。');
            return;
          }

          setButtonLoading(generateButton, true, '获取中...', '获取链接');

          try {
            const response = await fetch('/api/link?user=' + encodeURIComponent(user));
            const data = await response.json();

            if (!response.ok) {
              if (response.status === 404) {
                showMessage('error', '未找到账户', '请检查账号或邮箱是否正确。');
              } else {
                showMessage('error', '暂时无法获取链接', data.message || '请稍后重试。');
              }
              return;
            }

            linkText.innerText = data.link;
            document.getElementById('resultBox').style.display = 'block';
          } catch (err) {
            showMessage('error', '暂时无法获取链接', '请稍后重试。');
          } finally {
            setButtonLoading(generateButton, false, '获取中...', '获取链接');
          }
        }

        async function checkService() {
          const checkButton = document.getElementById('checkButton');

          hideMessage();
          setButtonLoading(checkButton, true, '检测中...', '检测服务');
          showMessage('warning', '正在检测服务', '通常需要几秒钟。');

          try {
            const response = await fetch('/api/check');
            const data = await response.json();
            const normalized = normalizeServiceMessage(data.status, response.ok, data.message);

            showMessage(normalized.type, normalized.title, normalized.detail);
          } catch (err) {
            showMessage('unavailable', '检测暂不可用', '请稍后重试。');
          } finally {
            setButtonLoading(checkButton, false, '检测中...', '检测服务');
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
