# 隐私政策 / Privacy Policy

**扩展名称 / Extension Name**：国家中小学智慧教育平台自学记录同步（SmartEdu StudySync）  
**最后更新 / Last Updated**：2026-11-18  

---

## 一、中文隐私政策

### 1. 概述
「国家中小学智慧教育平台自学记录同步（SmartEdu StudySync）」（以下简称“本扩展”）是一款开源浏览器辅助工具，用于配合国家中小学智慧教育平台（`basic.smartedu.cn`）使用，支持记录真实视频看课时长、同步教材目录、导出本地学习记录（CSV），并支持按用户需求将数据同步至用户自行搭建和配置的后端学习系统。

### 2. 数据采集与使用范围
本扩展严格遵循**最小必要原则**，仅在用户访问 `*.smartedu.cn`、`*.cbern.com.cn`、`*.eduyun.cn` 相关页面或主动操作扩展面板时，处理以下信息：
- **课程与学习进度数据**：当前观看的课程标题、学科/年级元数据、教材目录结构、视频播放位置与真实有效学习时长。
- **平台用户基础标识**：智慧教育平台当前登录账号的显示名称与用户 ID，用于多孩家庭/共用电脑场景下与自建学习系统账号进行一对一绑定及防串号校验。
- **错题本与习题数据（默认关闭，按需开启）**：仅当用户在扩展面板中手动勾选「同步错题本」或「同步我的习题」时，才会捕获并整理对应题目内容、题型、难度与解析用于同步。
- **自建学习系统配置与凭据**：仅当用户使用同步功能时，保存用户自行填写的后端 API 地址、用户名及登录返回的 JWT / Refresh Token，用于向用户指定的服务端上报学习记录与无感续签。

### 3. 数据存储与传输方式
- **本地存储**：所有配置、多账号绑定槽位（最多 3 组）、离线同步队列、已同步水位及本地导出目录授权句柄仅保存在您本地浏览器的 `chrome.storage.local` 与 `IndexedDB` 中。
- **定向传输**：学习进度、教材目录、以及您主动开启的错题/习题数据**仅通过 HTTPS 发送至您本人明确配置并授权的自建学习系统服务端地址**。若未配置服务端地址，数据仅在本地处理（支持纯本地 CSV 导出）。
- **本地导出**：您使用「导出记录 (CSV)」功能时，数据直接在本地生成 CSV 文件并写入您选择的本地目录或浏览器下载目录，不经过任何第三方中转服务器。

### 4. 明确不收集的内容
- 本扩展**绝不读取、保存或向任何外部服务器转发**您的国家中小学智慧教育平台登录密码或平台会话密钥（`ND_UC_AUTH` / `mac_key` 仅在本地请求智慧平台官方接口时使用）。
- 本扩展**不包含**任何第三方统计 SDK、广告跟踪代码或用户行为分析脚本，不会将任何数据出售、出租或共享给无关第三方。

### 5. 权限使用说明
- `storage`：在本地持久化您的配置、多账号绑定关系及断网暂存队列。
- `alarms`：在 Manifest V3 Service Worker 休眠唤醒间定时检查登录态有效期并调度后台同步任务。
- `downloads`：在用户主动点击「导出记录 (CSV)」时，将学习记录保存至本地下载目录。
- 主机权限（`*.smartedu.cn`、`*.cbern.com.cn`、`*.eduyun.cn`）及可选主机权限（`https://*/*`）：仅用于在智慧教育平台页面读取课程/学习记录，并在用户填写自定义自建学习系统域名时按需申请该单一域名的访问权限。

### 6. 数据删除与联系方式
您可随时在扩展面板中点击「解绑该槽位」或「退出当前激活」，或在浏览器中卸载本扩展以彻底清除所有本地存储数据。  
如对本隐私政策有任何疑问，请通过项目开源仓库提交 Issue：[https://github.com/dingdingdang22/SmartEdu-StudySync/issues](https://github.com/dingdingdang22/SmartEdu-StudySync/issues)。

---

## 二、Privacy Policy (English)

### 1. Overview
**SmartEdu StudySync (国家中小学智慧教育平台自学记录同步)** ("this extension") is an open-source browser extension designed for the National Smart Education Platform (`basic.smartedu.cn`). It tracks genuine video watching duration, synchronizes textbook catalogs, optionally syncs wrong questions/exercises, exports study records locally as CSV files, and optionally syncs data to a user-configured, self-hosted learning backend.

### 2. Data Processed
The extension operates strictly on the **minimum necessary** basis and only processes data when you visit authorized SmartEdu domains (`*.smartedu.cn`, `*.cbern.com.cn`, `*.eduyun.cn`) or interact with the extension popup:
- **Course & Study Progress**: Course title, subject/grade metadata, textbook chapter catalogs, video playback position, and genuine active playback duration.
- **Platform Account Identifier**: The display name and user ID of the currently logged-in SmartEdu account, used strictly to bind up to 3 accounts one-to-one with self-hosted learning accounts and prevent cross-account record mixing.
- **Wrong Questions & Exercises (Opt-in, Disabled by Default)**: Captured and synced only if you explicitly enable "同步错题本" (Sync Wrong Book) or "同步我的习题" (Sync My Exercises) in the popup.
- **Self-Hosted Backend Configuration & Tokens**: The backend API base URL you configure and the resulting JWT / refresh tokens for authenticated syncing.

### 3. Data Storage & Transmission
- **Local Storage**: Settings, account bindings, offline sync outbox queue, sync cursors, and local export directory handles are stored strictly locally in `chrome.storage.local` and `IndexedDB`.
- **Direct User-Configured Transmission**: Synced learning records and opt-in question data are transmitted **exclusively via HTTPS to the self-hosted backend URL explicitly configured and permitted by you**.
- **Local CSV Export**: Exported CSV files are generated completely locally on your device without passing through any third-party server.

### 4. What We Never Collect or Share
- This extension **never collects, stores, or transmits** your SmartEdu login password or SmartEdu authentication credentials (`ND_UC_AUTH` / `mac_key`) to any external or self-hosted server.
- This extension contains **no analytics, no ads, and no third-party tracking**, and never sells or shares user data with any third parties.

### 5. Permissions Justification
- `storage`: Stores user settings, account slot bindings, and the offline retry queue locally.
- `alarms`: Periodically triggers token validity checks and sync scheduling in the MV3 Service Worker.
- `downloads`: Saves locally generated study-record CSV files when triggered by the user.
- Host permissions (`*.smartedu.cn`, `*.cbern.com.cn`, `*.eduyun.cn`) & Optional host permissions (`https://*/*`): Required to interact with SmartEdu course pages and dynamically request access only to the specific self-hosted backend domain configured by the user.

### 6. Data Deletion & Contact
You can unbind accounts or log out directly in the extension popup, or uninstall the extension at any time to remove all local data.  
For privacy inquiries, please open an issue at: [https://github.com/dingdingdang22/SmartEdu-StudySync/issues](https://github.com/dingdingdang22/SmartEdu-StudySync/issues).
