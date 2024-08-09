## 一键部署

[![Deploy with Vercel](https://vercel.com/button)](https://vercel.com/import/project?template=https://github.com/eggacheb/haivercel)

## 接入准备

从 [海螺AI](https://hailuoai.com/) 获取token

进入海螺AI随便发起一个对话，然后F12打开开发者工具，从Application > LocalStorage中找到`_token`的值，这将作为Authorization的Bearer Token值：`Authorization: Bearer TOKEN`

![获取_token](https://github.com/LLM-Red-Team/hailuo-free-api/blob/master/doc/example-0.png)

### 多账号接入

目前似乎限制同个账号同时只能有*一路*输出，你可以通过提供多个账号的_token
每次请求服务会从中挑选一个。

## **如果没有设置环境变量API_URLS和绑定vercel的kv则无法正常启动，主页面会报404 not found**

## 2. 设置环境变量

部署后，您需要设置 `API_URLS` 环境变量：

1. 在 Vercel 仪表板中，选择您的项目。
2. 进入 "Settings" 标签。
3. 点击 "Environment Variables" 部分。
4. 添加新的环境变量：
   - 名称：`API_URLS`
   - 值为你的 API URL，多个 URL 用逗号分隔，例如：
     `https://api1.example.com/v1/audio/speech,https://api2.example.com/v1/audio/speech`
   - API URL为海螺接口地址，请参考https://linux.do/t/topic/108401
5. 点击 "Save" 来应用这些更改。
**记得在设置环境变量后重新部署您的项目，以使更改生效。**

## 3. 绑定 Vercel KV

要使用 Vercel KV 存储：

1. 在 Vercel 仪表板中，进入您的项目。
2. 点击 "Storage" 标签。
3. 在 KV 部分，点击 "Create Database"。
4. 选择适合您的区域和计划。
5. 创建完成后，Vercel 会自动添加必要的环境变量。

## 4. 上传 Token

要上传新的 token，您可以使用以下 API 端点：

```
POST /v1/token
```

请求体应包含：

```json
{
  "token": "your_token_here"
}
```

您可以使用 cURL 命令行工具或任何 API 客户端（如 Postman）来发送此请求。

示例 cURL 命令：

```bash
curl -X POST https://your-vercel-app.vercel.app/v1/token \
     -H "Content-Type: application/json" \
     -d '{"token": "your_token_here"}'
```

成功上传后，您将收到一个确认响应。

## 5. 验证部署

部署完成后：
1. 手动在vercel的设置里的Cron Jobs 触发一次 token 刷新
2. 访问 `https://your-vercel-app.vercel.app/v1/refresh-status` 来检查 token 刷新状态。



- 在阅读中的填写示例https://xxxxxx.vercel.app/?text={{speakText}}&speed={{speakSpeed/10}}&voice=YaeMiko_hailuo
- 由于vercel自带的域名被墙，可以绑自己的域名来避免被墙
- voice为发音人
- 请下载 `httpTts示例.json`用wps或者vs code之类的，把xxxxxx.vercel.app批量替换成你的vercel域名，然后在阅读的朗读设置里选择本地导入选择`httpTts示例.json`，
  或者在手机中点击`httpTts示例.json`打开方式为阅读这个软件，即可导入到阅读中


### voice

```
male-botong 思远 [兼容 tts-1 alloy]
Podcast_girl 心悦 [兼容 tts-1 echo]
boyan_new_hailuo 子轩 [兼容 tts-1 fable]
female-shaonv 灵儿 [兼容 tts-1 onyx]
YaeMiko_hailuo 语嫣 [兼容 tts-1 nova]
xiaoyi_mix_hailuo 少泽 [兼容 tts-1 shimmer]
xiaomo_sft 芷溪 [兼容 tts-1-hd alloy]
cove_test2_hailuo 浩翔（英文）
scarlett_hailuo 雅涵（英文）
Leishen2_hailuo 模仿雷电将军 [兼容 tts-1-hd echo]
Zhongli_hailuo 模仿钟离 [兼容 tts-1-hd fable]
Paimeng_hailuo 模仿派蒙 [兼容 tts-1-hd onyx]
keli_hailuo 模仿可莉 [兼容 tts-1-hd nova]
Hutao_hailuo 模仿胡桃 [兼容 tts-1-hd shimmer]
Xionger_hailuo 模仿熊二
Haimian_hailuo 模仿海绵宝宝
Robot_hunter_hailuo 模仿变形金刚
Linzhiling_hailuo 小玲玲
huafei_hailuo 拽妃
lingfeng_hailuo 东北er
male_dongbei_hailuo 老铁
Beijing_hailuo 北京er
JayChou_hailuo JayJay
Daniel_hailuo 潇然
Bingjiao_zongcai_hailuo 沉韵
female-yaoyao-hd 瑶瑶
murong_sft 晨曦
shangshen_sft 沐珊
kongchen_sft 祁辰
shenteng2_hailuo 夏洛特
Guodegang_hailuo 郭嘚嘚
yueyue_hailuo 小月月
```
