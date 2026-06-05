export function renderHomePage() {
  return `
        <!DOCTYPE html>
        <html lang="zh-CN">
        <head>
          <meta charset="UTF-8">
          <meta name="viewport" content="width=device-width, initial-scale=1.0">
          <meta name="robots" content="noindex,nofollow">
          <title>获取专属节点订阅</title>
          <style>
            body { font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif; display: flex; justify-content: center; align-items: center; height: 100vh; background-color: #f4f5f7; margin: 0; }
            .container { background: white; padding: 40px 30px; border-radius: 12px; box-shadow: 0 8px 16px rgba(0,0,0,0.05); text-align: center; max-width: 350px; width: 90%; }
            h2 { margin-top: 0; color: #333; font-size: 20px;}
            p { color: #666; font-size: 14px; margin-bottom: 20px;}
            input { box-sizing: border-box; padding: 12px; width: 100%; margin-bottom: 20px; border: 1px solid #ddd; border-radius: 6px; font-size: 16px; outline: none; transition: border-color 0.2s;}
            input:focus { border-color: #007aff; }
            button { width: 100%; padding: 12px; background-color: #007aff; color: white; border: none; border-radius: 6px; cursor: pointer; font-size: 16px; font-weight: bold; transition: background-color 0.2s;}
            button:hover { background-color: #005bb5; }
            .secondary-btn { margin-top: 10px; background-color: #5856d6; }
            .secondary-btn:hover { background-color: #3f3db5; }
            #resultBox { margin-top: 25px; display: none; padding-top: 20px; border-top: 1px dashed #eee;}
            .link-text { word-break: break-all; background: #f8f9fa; padding: 10px; border-radius: 6px; font-size: 13px; color: #d63384; margin-bottom: 15px;}
            .error-text { margin-top: 14px; color: #d93025; font-size: 13px; display: none; }
            .status-text { margin-top: 14px; color: #555; font-size: 13px; display: none; }
            .status-ok { color: #1f8f4d; }
            .status-warning, .status-unavailable { color: #d93025; }
            .copy-btn { background-color: #34c759; }
            .copy-btn:hover { background-color: #28a745; }
          </style>
        </head>
        <body>
          <div class="container">
            <h2>欢迎使用节点服务</h2>
            <p>请输入管理员分配给您的专属用户名</p>
            <input type="text" id="username" placeholder="例如：zhangsan" autocomplete="off">
            <button onclick="generateLink()">生成我的专属链接</button>
            <button class="secondary-btn" onclick="checkService()">检测当前服务</button>
            <div class="error-text" id="errorText"></div>
            <div class="status-text" id="serviceStatus"></div>
            
            <div id="resultBox">
              <div class="link-text" id="linkText"></div>
              <button class="copy-btn" onclick="copyLink()">一键复制链接</button>
            </div>
          </div>

          <script>
            async function generateLink() {
              const user = document.getElementById('username').value.trim();
              const errorText = document.getElementById('errorText');
              const resultBox = document.getElementById('resultBox');
              const linkText = document.getElementById('linkText');

              errorText.style.display = 'none';
              resultBox.style.display = 'none';
              linkText.innerText = '';

              if (!user) { 
                errorText.innerText = '用户名不能为空。';
                errorText.style.display = 'block';
                return; 
              }

              try {
                const response = await fetch('/api/link?user=' + encodeURIComponent(user));
                const data = await response.json();

                if (!response.ok) {
                  errorText.innerText = data.message || '用户不存在或输入错误。';
                  errorText.style.display = 'block';
                  return;
                }

                linkText.innerText = data.link;
                resultBox.style.display = 'block';
              } catch (err) {
                errorText.innerText = '生成失败，请稍后重试。';
                errorText.style.display = 'block';
              }
            }

            function showServiceStatus(message, status) {
              const serviceStatus = document.getElementById('serviceStatus');
              serviceStatus.className = 'status-text';
              if (status) {
                serviceStatus.classList.add('status-' + status);
              }
              serviceStatus.innerText = message;
              serviceStatus.style.display = 'block';
            }

            async function checkService() {
              showServiceStatus('当前服务检测中...', 'pending');

              try {
                const response = await fetch('/api/check');
                const data = await response.json();

                showServiceStatus(data.message || '检测暂不可用，请稍后重试。', data.status || (response.ok ? 'ok' : 'unavailable'));
              } catch (err) {
                showServiceStatus('检测暂不可用，请稍后重试。', 'unavailable');
              }
            }

            function copyLink() {
              const link = document.getElementById('linkText').innerText;
              navigator.clipboard.writeText(link).then(() => {
                alert('✅ 复制成功！\\n请立即打开 Outline 客户端添加。');
              }).catch(err => {
                alert('复制失败，请手动长按上方链接复制。');
              });
            }
          </script>
        </body>
        </html>
      `;
}
