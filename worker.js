export default {
  async fetch(request, env, ctx) {
    // 获取用户访问的后缀名 (例如访问 /zhangsan，提取出的 userId 就是 "zhangsan")
    const requestUrl = new URL(request.url);
    const userId = requestUrl.pathname.replace('/', '');

    // ========================================================
    // 1. 【用户密钥通讯录】在这里管理你所有客户的 Outline 密钥
    // ========================================================
    const userKeys = {
      // 格式： "客户名字": "他在 Outline Manager 里的真实 ss:// 密钥",
      "zhangsan": "ss://Y2hhY2hh...填入张三的真实密钥...",
      "lisi": "ss://Y2hhY2hh...填入李四的真实密钥...",
      "wangwu": "ss://Y2hhY2hh...填入王五的真实密钥...",
      
      // 你可以无限往下加，注意上一行末尾要有逗号
    };

    // 查找该用户对应的密钥
    const outlineKey = userKeys[userId];

    // 如果客户乱输网址，或者找不到该客户，直接拒绝
    if (!outlineKey) {
      return new Response("用户不存在或链接错误", { status: 404 });
    }

    try {
      // ========================================================
      // 2. 自动化解析逻辑 (和之前一样，把 ss:// 拆成 JSON)
      // ========================================================
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

      // ========================================================
      // 3. 返回专属的 JSON 配置
      // ========================================================
      return new Response(JSON.stringify(outlineJson, null, 2), {
        headers: {
          "Content-Type": "application/json; charset=utf-8",
          "Cache-Control": "no-store",
        },
      });
    } catch (e) {
      return new Response("配置解析错误", { status: 500 });
    }
  },
};



####
