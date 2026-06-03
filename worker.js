export default {
  async fetch(request, env, ctx) {
    const requestUrl = new URL(request.url);
    const path = requestUrl.pathname;

    // ========================================================
    // 模块 A：如果用户访问的是首页 (根目录 /)，返回交互式网页
    // ========================================================
    if (path === '/' || path === '') {
      const html = `
        <!DOCTYPE html>
        <html lang="zh-CN">
        <head>
          <meta charset="UTF-8">
          <meta name="viewport" content="width=device-width, initial-scale=1.0">
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
            #resultBox { margin-top: 25px; display: none; padding-top: 20px; border-top: 1px dashed #eee;}
            .link-text { word-break: break-all; background: #f8f9fa; padding: 10px; border-radius: 6px; font-size: 13px; color: #d63384; margin-bottom: 15px;}
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
            
            <div id="resultBox">
              <div class="link-text" id="linkText"></div>
              <button class="copy-btn" onclick="copyLink()">一键复制链接</button>
            </div>
          </div>

          <script>
            function generateLink() {
              const user = document.getElementById('username').value.trim();
              if (!user) { 
                alert('用户名不能为空哦！'); 
                return; 
              }
              // 自动获取当前域名并拼接 ssconf 协议
              const currentHost = window.location.host;
              const finalLink = 'ssconf://' + currentHost + '/' + user;
              
              document.getElementById('linkText').innerText = finalLink;
              document.getElementById('resultBox').style.display = 'block';
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
      return new Response(html, {
        headers: { "Content-Type": "text/html; charset=utf-8" },
      });
    }

    // ========================================================
    // 模块 B：处理机器请求，下发真实的 JSON 订阅数据
    // ========================================================
    // 提取用户名 (例如从 /zhangsan 提取出 zhangsan)
    const userId = path.replace('/', '');

    // 1. 【用户密钥通讯录】在此处填入你从 Outline Manager 复制的真实密钥
    const userKeys = {
      "zhangsan": "ss://Y2hhY2hhMjAtaWV0...请替换为真实密钥1.../?outline=1",
      "lisi": "ss://Y2hhY2hhMjAtaWV0...请替换为真实密钥2.../?outline=1"
    };

    const outlineKey = userKeys[userId];

    if (!outlineKey) {
      return new Response("用户不存在或链接错误", { status: 404 });
    }

    try {
      // 2. 自动化解析逻辑
      const url = new URL(outlineKey);
      const base64UserInfo = url.username; 
      const decodedUserInfo = atob(base64UserInfo); 
      const [method, password] = decodedUserInfo.split(':');

      const outlineJson = {
        server: url.hostname,
        server_port: parseInt(url.port),
        password: password,
        method: method
      };

      // 3. 返回 JSON 格式
      return new Response(JSON.stringify(outlineJson, null, 2), {
        headers: {
          "Content-Type": "application/json; charset=utf-8",
          "Cache-Control": "no-store",
        },
      });
    } catch (e) {
      return new Response("配置解析错误", { status: 500 });
    }
  }
};
