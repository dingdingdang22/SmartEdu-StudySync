# 国家中小学智慧教育平台自学记录同步 (SmartEdu StudySync)

> 当前版本：**v1.17.2** ｜ 开源协议：[GNU General Public License v3.0 (GPL-3.0)](./LICENSE)

**国家中小学智慧教育平台自学记录同步（SmartEdu StudySync）** 是一款配合**国家中小学智慧教育平台**（`basic.smartedu.cn`）与**自建学习系统**使用的开源浏览器扩展。安装后，它会在后台帮你统计真实有效的看课时长、同步教材目录与学习记录，支持按需开启错题与习题整理，也可以**不依赖任何后端服务直接本地导出 CSV 学习记录**；同时提供标准开放的 HTTP API 协议，方便个人开发者或机构自行开发配套后端服务。

---

## 一、 核心功能介绍

点击浏览器右上角的扩展图标，所有功能都在一个简洁的弹窗中完成，不遮挡网页上的视频画面：

### 1. 真实学习进度与时长统计
- **自动识别课程**：进入智慧教育平台看课时，自动识别当前课程名称、学段、年级和学科信息。
- **真实时长防误算**：按实际观看秒数精确累计「真实有效学习」时长。快进拖拽或反复拖动同一段进度条不会被重复计入，确保学习记录真实可靠。
- **断网也不丢记录**：遇到网络波动时，学习进度会先安全保存在本地队列中，等网络恢复后自动上传；你也可以在面板中点击**「冲刷」**按钮手动立即同步。

### 2. 教材目录自动同步
- 开始观看某一门教材的视频课程时，扩展会自动整理该教材的完整章节与课时目录并同步至自建学习系统，方便查看整本书学习进度和剩余未学课时。

### 3. 历史学习记录衔接同步
- 自动将你在智慧教育平台上已有的学习进度同步至自建学习系统，面板的**「学习记录同步」**栏会显示当前同步状态，新学与已学进度无缝衔接。

### 4. 错题本与我的习题同步（默认关闭，按需开启）
- 在面板的**「错题本与我的习题同步 (可选)」**区域，你可以按需要勾选开启：
  - **同步错题本**：自动同步你在智慧教育平台产生的错题，整理好题干、题型、难度（`易` / `较易` / `中` / `较难` / `难`）与标准答案解析，方便日后针对性复习。
  - **同步我的习题**：同步你练过的习题记录，错题与普通练习自动分开管理，互不混杂。

### 5. 多账号绑定与自动切换（最多支持 3 组）
- **适合多孩家庭或共用电脑**：最多可在扩展中绑定 **3 组**「智慧教育平台账号 ↔ 自建学习系统账号」的一对一关系。
- **切换账号自动跟随**：在智慧教育平台切换登录不同的学生账号时，扩展会自动识别并切换到对应的自建学习系统账号，无需每次在面板里重新输入密码。
- **防串号安全提醒**：如果检测到当前网页登录的学生与上次写入记录的账号不一致，扩展会主动弹窗确认，防止把一个人的学习记录误存到另一个人名下。

### 6. 顶栏状态与一键更新生效
- 控制面板最顶部会清晰展示当前版本号、智慧平台连接状态以及当前激活的自建学习系统账号。
- 当本地开发或更新包有新版本就绪时，顶栏会亮起提示并出现**「🔄 重载生效」**按钮，点击即可立即启用新版。

### 7. 学习记录本地导出（CSV，无需后端即可使用）
- 在控制面板的**「自建学习系统域名 / API 地址」**区域下方，支持填写本地文件夹路径或点击**「📁 选择目录」**授权本地目录，将当前智慧平台账号的学习记录导出为按智慧平台账号命名的 `.csv` 文件（带 UTF-8 BOM，Excel 可直接打开）。
- 导出内容仅包含学员的**教材名称**、**教材目录（章 / 节 / 课时名称）**、**目录对应视频课观看进度**以及**最后观看时间**（不含错题与习题）。

---

## 二、 新手快速上手指南

### 第 1 步：安装扩展到浏览器
- **方式 A（推荐）**：通过 Chrome Web Store 搜索 **「国家中小学智慧教育平台自学记录同步」**（或 **SmartEdu StudySync**）一键安装。
- **方式 B（源码构建安装）**：
  1. 克隆仓库并安装构建：
     ```bash
     npm install && npm run build
     ```
     构建产物位于 `.output/chrome-mv3`。
  2. 在 **Chrome** 或 **Edge** 地址栏输入 `chrome://extensions`（Edge 为 `edge://extensions`），打开右上角**「开发者模式」**。
  3. 点击**「加载已解压的扩展程序」**，选择 `.output/chrome-mv3` 目录即可完成安装。

### 第 2 步：配置自建学习系统地址（仅需本地 CSV 导出可跳过此步）
1. 点击浏览器右上角的 **国家中小学智慧教育平台自学记录同步** 扩展图标，打开控制面板。
2. 找到**「自建学习系统域名 / API 地址」**输入框，填入你的自建学习系统服务网址（例如 `https://your-domain.example`）。
3. 点击**「保存域名」**，若浏览器弹出访问该域名的权限确认窗口，请点击**「允许」**（扩展仅向你填写的这一个域名申请动态授权）。

### 第 3 步：绑定学生账号
1. 在浏览器中打开 [国家中小学智慧教育平台](https://basic.smartedu.cn) 并登录学生账号。
2. 再次点击右上角的扩展图标，在**「多用户绑定与自动激活」**的空闲槽位中，输入对应的自建学习系统学员用户名和密码。
3. 点击**「🔐 验证登录并建立一对一绑定」**，提示绑定成功后即可开始同步。

### 第 4 步：正常看课，自动同步
- 接下来像平时一样在智慧教育平台看课、做题即可，扩展会自动完成记录与同步。
- 如需同步错题或习题，只需在面板中勾选**「同步错题本」**或**「同步我的习题」**。
- 如果暂时不想同步，可以点击**「退出当前激活」**临时挂起（已绑定的槽位关系会保留，不会丢失）；如需更换账号，可在对应槽位点击**「解绑该槽位」**并输入自建学习系统密码确认解除。

---

## 三、 自建学习系统后端接口规范（开发者自建指南）

如果你希望自行开发后端服务来接收本扩展同步的学习数据，只需按照下表实现对应的 HTTPS JSON 接口即可（扩展已内置请求重试、离线队列与 Token 自动续签机制）。

### 通用请求约定
- **传输协议**：生产环境需提供 `https://` 接口（本地开发支持 `http://localhost:*` 与 `http://127.0.0.1:*`）。
- **请求头**：
  - `Content-Type: application/json`
  - `X-Dofee-Client: smartedu-monitor`
  - 需要鉴权的接口携带：`Authorization: Bearer <access_token>`

### 1. 登录与令牌续期
| 功能 | 接口路径（按优先顺序尝试） | 请求体 (JSON) | 期望响应 (HTTP 200 JSON) |
| :--- | :--- | :--- | :--- |
| **账号登录** | 1) `POST /api/v1/auth/login`<br>2) 降级 `POST /api/auth` | v1: `{ username, password }`<br>legacy: `{ action: "login", username, password }` | `{ token, refreshToken?, user?: { username } }`（兼容 `accessToken`） |
| **令牌续期** | 1) `POST /api/v1/auth/refresh`<br>2) 降级 `POST /api/auth` | v1: `{ refreshToken }`<br>legacy: `{ action: "refresh", refreshToken }` | `{ token, refreshToken? }`（Token 无效返回 `401` / `403`） |

### 2. 智慧平台 ↔ 自建系统账号一对一绑定
- **接口路径**：`/api/v2/student/smartedu-binding`
- **查询当前绑定**：`GET /api/v2/student/smartedu-binding`
  - 已绑定返回 `200`：`{ "success": true, "binding": { "username": "...", "smartedu_user_id": "...", "smartedu_display_name": "...", "bound_at": "...", "updated_at": "..." } }`
  - 未绑定返回 `404` 或 `{ "success": true, "code": "NOT_BOUND", "binding": null }`
- **建立绑定**：`POST /api/v2/student/smartedu-binding`
  - 请求体：`{ "action": "bind", "smartedu_user_id": "...", "smartedu_display_name": "..." }`
  - 响应 `200`：`{ "success": true, "already_bound": false, "binding": { ... } }`
- **验证密码解绑**：`POST /api/v2/student/smartedu-binding`
  - 请求体：`{ "action": "unbind", "password": "..." }`
  - 响应 `200`：`{ "success": true, "unbound": { ... } }`（密码错误返回 `401`/`403` 与 `{ "error": "..." }`）

### 3. 实时视频学习进度上报
- **接口路径**：`POST /api/v2/student/external-study/progress`（或兼容路径 `POST /api/v1/sync/progress`）
- **请求体示例**：
  ```json
  {
    "event": {
      "type": "heartbeat",
      "session_id": "sess_...",
      "position_seconds": 428.5,
      "duration_seconds": 810.0,
      "real_played_seconds": 420.0,
      "completion_rate": 0.519,
      "timestamp": "2026-11-18T10:00:00.000Z"
    },
    "resource": {
      "resource_id": "...",
      "title": "1.2 有理数（第一课时）",
      "subject": "Mathematics",
      "grade": 7,
      "textbook_version": "人教版",
      "chapter_title": "第一章 有理数",
      "url": "https://basic.smartedu.cn/..."
    }
  }
  ```
- **响应**：HTTP `200` / `201` 即可。

### 4. 教材目录同步
- **接口路径**：`POST /api/v2/student/external-study/catalog`
- **探测复用已有目录**（可选优化）：
  - 请求体：`{ "mode": "bind_if_exists", "teachingmaterial_id": "<tmId>", "current_resource_id": "<resId|null>" }`
  - 响应：`{ "found": true, "reused_shared_catalog": true, "total_lessons": 24 }`（若返回 `found: false`，扩展会自动抓取并上传完整目录）
- **全量上传教材目录**：
  - 请求体：`{ "source": "smartedu", "teachingmaterial_id": "...", "current_resource_id": "...", "book_meta": { "subject": "...", "subject_cn": "...", "grade": 7, "grade_cn": "七年级", "edition": "人教版", "curriculum_era": "...", "volume": "上册", "title": "..." }, "items": [ { "resource_id": "...", "title": "...", "resource_type": "national_lesson", "chapter_id": "...", "chapter_title": "...", "section_id": "...", "section_title": "...", "week_tag": "", "sort_order": 1 } ] }`
  - 响应：HTTP `200` 即可。

### 5. 历史学习记录批量导入
- **接口路径**：`POST /api/v2/student/external-study/records/import`
- **请求体**：
  ```json
  {
    "batch_id": "batch_...",
    "dry_run": false,
    "source": "platform_study_details",
    "sync_mode": "incremental",
    "fetched_at": "2026-11-18T10:00:00.000Z",
    "items": [
      {
        "resource_id": "...",
        "tm_id": "...",
        "chapter_id": "...",
        "sub_resource_id": "...",
        "resource_name": "1.1 正数和负数",
        "resource_type": "national_lesson",
        "progress": 100,
        "status": 2,
        "watched_seconds": 0,
        "platform_created_at": "...",
        "platform_updated_at": "..."
      }
    ]
  }
  ```
- **响应**：`{ "upserted": 1, "unchanged": 0, "completed_flipped": 1, "skipped": [], "errors": [] }`（注：探测端点就绪时扩展会发空 `items: []`，只要非 `404` 即判定端点已部署）。

### 6. 错题本与我的习题导入（按需开启）
- **错题本路径**：`POST /api/v2/student/wrong-questions/import`
- **我的习题路径**：`POST /api/v2/student/exercises/import`
- **请求体**：`{ "source": "smartedu", "target": "wrong_book", "dry_run": false, "username": "...", "skip_tree_mapping": true, "tree_mapping": false, "scan_date": "2026-11-18", "batch_id": "scan-...", "items": [ ... ] }`
- **响应**：`{ "mapped": 0, "inserted": 5, "updated": 0, "skipped": 0, "questions_total": 5 }`

---

## 四、 常见问题解答

- **Q：没有自己的后端服务器可以使用吗？**  
  A：可以。即使不配置自建学习系统域名，你也可以直接在智慧教育平台登录后使用**「导出记录 (CSV)」**功能，将教材目录与观看进度直接导出到本地文件夹（Excel 可直接打开）。
- **Q：为什么拖动视频进度条快进后，「真实有效学习」时间没有增加？**  
  A：这是扩展的防虚增设计，只有真实播放观看的时间才会被记录下来，重复播放同一段也不会重复计算。
- **Q：两个孩子共用同一台电脑登录不同账号，学习记录会混在一起吗？**  
  A：不会。你可以在扩展里为每个孩子分别绑定一个独立槽位；切换智慧教育平台账号时，扩展会自动切换到对应的自建学习系统账号，并在可能发生混淆时弹窗提醒确认。
- **Q：只打开控制面板，为什么显示“需打开智慧平台页”？**  
  A：课程状态、平台当前登录学生信息和实时同步操作需要读取你当前正在浏览的智慧教育平台网页。请先打开并切换到智慧教育平台标签页，再点击扩展图标即可正常显示。

---

## 五、 隐私保护与免责声明

1. **隐私安全承诺**：本扩展不会收集、保存或向无关第三方发送你的智慧教育平台密码或登录凭据；所有学习进度、目录与错题数据仅在本地处理，仅当你主动配置并授权后才同步至你本人指定的自建学习系统服务端地址。
2. **非官方工具说明**：本项目为个人学习统计与错题整理用途的开源工具，与国家中小学智慧教育平台无任何官方关联。
3. **合规使用原则**：本扩展不提供任何跳过视频校验、自动挂机刷课或绕过平台规则的功能。请遵守目标平台的服务条款与相关法律法规，因不当使用产生的后果由使用者自行承担。
4. **开源协议**：本项目采用 [GNU General Public License v3.0 (GPL-3.0)](./LICENSE) 开源发布。
