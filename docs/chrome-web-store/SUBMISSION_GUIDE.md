# Chrome 应用商店（Chrome Web Store）正式提交指引

> 扩展名称：**国家中小学智慧教育平台自学记录同步**（英文：**SmartEdu StudySync**）  
> 当前版本：**v1.17.2**（Manifest V3）  
> 开源仓库：[https://github.com/dingdingdang22/SmartEdu-StudySync](https://github.com/dingdingdang22/SmartEdu-StudySync)  
> 开发者控制台入口：[https://chrome.google.com/webstore/devconsole](https://chrome.google.com/webstore/devconsole)

---

## 一、已准备就绪的上传文件清单

所有打包与审核素材均已按 Chrome Web Store 官方最新规范核验通过：

| 物料名称 | 文件路径 | 规格说明 | 用途 |
| :--- | :--- | :--- | :--- |
| **扩展安装包 (ZIP)** | `.output/smartedu-studysync-1.17.2-chrome.zip` | MV3 / 根目录直出 `manifest.json`（含 `zh_CN` & `en` 双语名称） | 后台 **Package（软件包）** 上传 |
| **商店图标** | `docs/chrome-web-store/assets/icon-128.png` | `128 × 128 px` PNG | 后台 **Store icon** 上传 |
| **展示截图 1** | `docs/chrome-web-store/assets/screenshot-1-monitor.png` | `1280 × 800 px` 24-bit 无透明通道 PNG | 后台 **Screenshots** 第 1 张 |
| **展示截图 2** | `docs/chrome-web-store/assets/screenshot-2-accounts-export.png` | `1280 × 800 px` 24-bit 无透明通道 PNG | 后台 **Screenshots** 第 2 张 |
| **小型宣传图** | `docs/chrome-web-store/assets/promo-small-440x280.png` | `440 × 280 px` 24-bit 无透明通道 PNG | 后台 **Small promo tile**（可选推荐） |
| **隐私政策文档** | `PRIVACY.md` | 中英双语完整隐私声明 | 推送至 GitHub 后作为 **Privacy policy URL** |

> **命名与合规说明**：
> - `manifest.json` 已通过原生 `_locales` 配置多语言名称：中文环境自动显示 **「国家中小学智慧教育平台自学记录同步」**，英文环境自动显示 **「SmartEdu StudySync」**。
> - 已从 `wxt.config.ts` 移除非必需的 `tabs` 权限，仅保留最小权限集 `["storage", "alarms", "downloads"]`。
> - 已在 `entrypoints/background.ts` 区分商店托管模式与本地开发模式：商店版停用 1 分钟磁盘探针闹钟并收敛标签页广播范围。

---

## 二、提审前 2 分钟前置检查

1. **推送代码与隐私政策到 GitHub**：  
   将当前更改（包含根目录 `PRIVACY.md` 与新版 `README.md`）合并并推送到 GitHub `main` 分支后，确认以下链接可**公开免登录访问**：  
   `https://github.com/dingdingdang22/SmartEdu-StudySync/blob/main/PRIVACY.md`  
   *(若仓库改为私有，请将 `PRIVACY.md` 内容发布到公开网页或 GitHub Pages。)*
2. **确认官方主页 / 支持网址**：  
   - 主页：`https://github.com/dingdingdang22/SmartEdu-StudySync`
   - 支持：`https://github.com/dingdingdang22/SmartEdu-StudySync/issues`

---

## 三、开发者后台逐项填写对照表

进入 [Chrome Web Store Developer Dashboard](https://chrome.google.com/webstore/devconsole) → 点击右上角 **「+ New Item（新增内容）」**：

### 第 1 步：上传软件包（Package）
- 点击 **Browse files**，上传：  
  `.output/smartedu-studysync-1.17.2-chrome.zip`
- 上传成功后，`manifest.json` 中的中英文名称与版本（`1.17.2`）会被自动识别。

---

### 第 2 步：商店详情（Store listing）

> 提示：由于安装包启用了 `_locales`（`zh_CN` 与 `en`），在 Store listing 右上角语言切换器中，建议分别完善 **中文（简体）** 与 **English** 两种语言条目（先填默认 `Chinese (Simplified)`，若后台提示补充 `English` 描述可一并填入下方英文版本）。

1. **Default Language（默认语言）**：选择 `Chinese (Simplified) - 中文（简体）`
2. **Category（类别）**：选择 **`Education`（教育）**
3. **Description（中文详细说明 — 请直接复制以下纯文本，不要使用 Markdown 符号）**：

```text
「国家中小学智慧教育平台自学记录同步（SmartEdu StudySync）」是一款配合国家中小学智慧教育平台（basic.smartedu.cn）与自建学习系统使用的开源浏览器扩展。

【核心功能】
1. 真实学习进度与时长统计
- 自动识别正在观看的课程标题、学段、年级与学科信息；
- 按实际播放秒数精确累计「真实有效学习」时长，拖拽快进或重复拖动进度条不会虚增计入；
- 支持离线暂存队列，遇到网络波动时先保存在本地，恢复后自动上传或点击「冲刷」手动同步。

2. 教材目录与历史进度自动同步
- 观看教材视频课程时自动整理完整章节与课时目录并同步，方便了解全书学习进度；
- 自动衔接智慧教育平台已有学习记录。

3. 多孩家庭账号绑定与自动切换（最多 3 组）
- 支持绑定最多 3 组「智慧教育平台账号 ↔ 自建学习系统账号」一对一关系；
- 切换智慧平台登录学生时自动跟随切换，并在可能发生串号时弹窗提醒确认，防止记录混淆。

4. 错题本与我的习题同步（默认关闭，按需开启）
- 可在控制面板勾选开启，自动整理错题与习题记录（含题干、题型、五档难度与答案解析）。

5. 学习记录本地导出（CSV，免后端可用）
- 即使不搭建后端服务器，也可一键导出包含教材名称、章节目录、视频观看进度与最后观看时间的 CSV 文件（UTF-8 BOM 编码，Excel 打开不乱码）。

6. 开放标准 HTTP API，支持自行开发后端
- 提供完整的登录、绑定、进度上报、教材目录及错题导入接口规范（详见 GitHub README），个人开发者可自行搭建后端学习系统对接使用。

【隐私与合规说明】
- 本扩展不会读取、保存或转发您的智慧教育平台登录密码或会话凭据；
- 所有同步数据仅发送至您本人配置并授权的自建学习系统服务端地址，或在本地导出为 CSV；
- 本扩展为开源学习统计辅助工具（GPL-3.0），不包含跳过视频校验或自动挂机刷课功能。
```

   **English Store Listing（若在语言切换中选择 English 时填入）**：
```text
SmartEdu StudySync is an open-source browser extension for the National Smart Education Platform (basic.smartedu.cn) that helps students and parents track genuine video study time, organize textbook catalogs, export study logs locally to CSV, or sync records to a self-hosted learning backend.

Key Features:
1. Genuine Study Duration Tracking: Accurately counts active video playback seconds and ignores fast-forwarding or seeking. Includes an offline retry queue.
2. Textbook Catalog & Study Record Sync: Automatically extracts textbook chapters and lessons and syncs existing study progress.
3. Multi-Account Binding (Up to 3 Pairs): One-to-one mapping between SmartEdu accounts and self-hosted learning accounts with automatic switching and mismatch guards.
4. Opt-in Wrong Book & Exercise Sync: Disabled by default; users can opt in to organize reviewed exercises and wrong questions.
5. Local CSV Export (No Backend Required): Export textbook catalogs and video watching progress directly to UTF-8 BOM CSV files on your device.
6. Open Self-Hosted API Spec: Developers can build their own backend service using the documented JSON endpoints.

Privacy Commitment:
The extension never reads, stores, or transmits your SmartEdu password or authentication cookies/keys to external servers. Synced data is sent exclusively to the HTTPS backend URL configured and authorized by you.
```

4. **Graphic assets（图形资产）**：
   - **Store icon**：上传 `docs/chrome-web-store/assets/icon-128.png`
   - **Screenshots**：上传以下两张 `1280×800` 图片（按顺序）：
     1. `docs/chrome-web-store/assets/screenshot-1-monitor.png`
     2. `docs/chrome-web-store/assets/screenshot-2-accounts-export.png`
   - **Small promo tile**：上传 `docs/chrome-web-store/assets/promo-small-440x280.png`
5. **Additional fields**：
   - **Official URL / Homepage URL**：`https://github.com/dingdingdang22/SmartEdu-StudySync`
   - **Support URL**：`https://github.com/dingdingdang22/SmartEdu-StudySync/issues`

---

### 第 3 步：隐私权做法（Privacy practices）—— 审核关键项

#### 1. Single purpose（单一用途说明）
直接复制填入：
```text
Track genuine video study duration, synchronize textbook catalogs and opt-in exercise/wrong-question records from the National Smart Education Platform (smartedu.cn) to a user-configured self-hosted learning backend, and export study progress locally as CSV files.
```

#### 2. Permission justification（权限逐项说明）

- **`storage`**：
```text
Used solely to store the user-configured self-hosted backend URL, account slot bindings (up to 3 pairs), offline study-record sync outbox queue, sync cursors, and local export preferences in chrome.storage.local so progress is preserved across restarts and network interruptions.
```

- **`alarms`**：
```text
Used in the Manifest V3 Service Worker to periodically check user-configured backend JWT token expiration for silent refresh and schedule background sync checks without keeping a persistent background page open.
```

- **`downloads`**：
```text
Used only when the user explicitly clicks "Export Records (CSV)" to save the locally generated study-progress CSV file to the user's browser download folder or trigger a "Save As" dialog.
```

- **`Host permissions` (`*.smartedu.cn`, `*.cbern.com.cn`, `*.eduyun.cn`) & `Optional host permissions` (`https://*/*`)**：
```text
Fixed host permissions are strictly limited to National Smart Education Platform domains to read the currently open course metadata, textbook catalog, and genuine video playback state.
Optional host permissions (https://*/*) are NEVER requested globally at install time; the extension dynamically requests permission only for the single HTTPS origin explicitly entered by the user as their self-hosted learning backend URL when they click "Save Domain".
```

- **Remote Code（是否使用远程托管代码）**：
  - 选择：**`No, I am not using Remote code`**

#### 3. Data usage（数据使用披露勾选）
如实勾选以下 3 项：
- [x] **`Authentication information`**：仅用于存储用户自建学习系统登录返回的 JWT / Refresh Token，不收集智慧平台密码。
- [x] **`User activity`**：用于统计当前课程视频的真实播放进度、观看时长及用户主动勾选同步的错题/习题记录。
- [x] **`Website content`**：仅在授权的 `smartedu.cn` / `cbern.com.cn` / `eduyun.cn` 页面读取课程标题、章节目录与按需开启的题目文本。

下方 **3 项合规承诺复选框** 全部勾选：
- [x] I do not sell or transfer user data to third parties, outside of the approved use cases
- [x] I do not use or transfer user data for purposes that are unrelated to my item's single purpose
- [x] I do not use or transfer user data to determine creditworthiness or for lending purposes

#### 4. Privacy policy URL（隐私政策网址）
- 填入公开可访问的 URL（推送 `PRIVACY.md` 后）：
  `https://github.com/dingdingdang22/SmartEdu-StudySync/blob/main/PRIVACY.md`

---

### 第 4 步：分发设置（Distribution）与审核备注

1. **Visibility（可见性）**：按需选择 **`Public（公开）`** 或 **`Unlisted（不公开列出）`**。
2. **Distribution（分发地区）**：勾选 **`All regions`**。
3. **Testing instructions / Notes for reviewer（测试说明）**：
```text
This extension works on the National Smart Education Platform (https://basic.smartedu.cn) either standalone for local CSV export or paired with a user's self-hosted learning backend.
1. Clicking the extension icon opens the popup where users can optionally configure their self-hosted backend HTTPS domain (triggers optional_host_permissions for that single origin only), bind up to 3 accounts, toggle optional Wrong-Book/Exercise sync (disabled by default), and export study records locally as CSV.
2. When browsing a course video page under https://basic.smartedu.cn/syncClassroom/*, the content script monitors genuine HTML5 <video> playback time (excluding seeking/fast-forwarding) and syncs textbook catalogs/progress to the user-configured backend.
3. No SmartEdu password or auth cookie/mac_key is ever transmitted to external servers. Local CSV export works completely offline via File System Access API or chrome.downloads.
```

---

## 四、后续发版维护流程

1. 修改 `package.json` 版本号后运行 `npm run version:sync`（自动同步 `src/core/version.ts` 与 `README.md`）。
2. 运行 `npm run compile && npm run build && npm run zip` 生成新版本 `.zip`（`.output/smartedu-studysync-<version>-chrome.zip`）。
3. 在开发者控制台上传新 `.zip` 重新提交审核即可。
