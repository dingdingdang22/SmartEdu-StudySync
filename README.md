# SmartEdu-DoFee 学习进度监控器 (方案 C 现代化重构版)

> 当前版本：**v1.16.5** ｜ 开源协议：[GNU General Public License v3.0 (GPL-3.0)](./LICENSE)

基于 **WXT (Next-Gen Web Extension Framework) + TypeScript + Vite** 构建的 Manifest V3 浏览器扩展工程。

---

## 一、 项目背景与架构升级

本项目是对原 `smartedu-monitor` 的现代化重构，彻底解决了原生散装开发模式下**“每次修改代码都需要手动在扩展管理页面刷新 + 手动刷新测试网页”**的痛点。

### 架构演进对比

| 维度 | 原项目 (`smartedu-monitor`) | 本项目 (`smartedu-dofee-plugin`) |
| :--- | :--- | :--- |
| **工程底座** | 纯原生无构建，靠文件首尾字符串拼接 | **WXT + Vite + TypeScript 5** 现代工程化脚手架 |
| **模块机制** | IIFE 闭包，依赖 `manifest.json` 数组顺序与全局变量 | **标准 ES Module (ESM)**，类型安全，显式依赖 |
| **代码热更 (HMR)** | 无热更，必须每次手动在 `chrome://extensions` 点击刷新 | **内置全自动 HMR**（保存代码即刻毫秒级自动重载/刷新） |
| **执行世界管理** | 手写 `manifest.json` 中的 `world: "MAIN"` | 声明式入口 (`sniffer.content.ts` 自动声明 `MAIN` 世界) |
| **打包产物** | 平铺脚本，易受加载顺序和作用域污染影响 | **Rollup/Vite 树摇优化**，生成高内聚规范包 (`.output/chrome-mv3`) |

---

## 二、 目录结构规范

```text
smartedu-dofee-plugin/
├── entrypoints/                      # 扩展顶层声明式入口 (由 WXT 自动识别生成 manifest)
│   ├── background.ts                 # Service Worker 调度中枢 (alarms 保活/白名单跨域代理/心跳)
│   ├── sniffer.content.ts            # 主世界拦截嗅探器 (world: 'MAIN', runAt: 'document_start')
│   ├── monitor.content.ts            # 隔离世界主装配脚本 (runAt: 'document_end')
│   └── popup/                        # 浏览器顶部工具栏下拉弹窗 (课时监控、多账号绑定与配置管理)
├── src/                              # 业务与核心源码层
│   ├── core/                         # 核心算法、鉴权与数据通信
│   │   ├── auth.ts                   # JWT 解析、单飞互斥续签锁与断网自愈
│   │   ├── import-user-guard.ts      # 智慧平台用户一致性守卫 (防串号污染)
│   │   ├── question-source.ts        # 题库 CDN、ZIP Range 解压、QTI 解析、双树映射严防门
│   │   ├── request.ts                # 跨环境网络网关 (SW 代理免 CORS + 自动 401 续签)
│   │   ├── smartedu-binding.ts       # dofee 账号与智慧平台用户 1:1 绑定客户端
│   │   ├── storage.ts                # 类型安全配置管理、多槽位激活、离线队列、幂等时间桶
│   │   ├── uploader.ts               # 学习进度向自建服务端上报与队列冲刷
│   │   └── version.ts                # 插件版本中心与编译期构建身份标识
│   ├── adapters/                     # 平台 DOM 与选择器适配层 (抗版本漂移)
│   │   ├── smartedu-adapter.ts       # 播放器页面课时 ID 识别与课程上下文提取
│   │   └── wrong-question-adapter.ts # 错题本/习题库页面自适应判断、卡片信息提取、Fiber 扫描
│   ├── features/                     # 具体业务域
│   │   ├── catalog-sync.ts           # 播放视频自动提取教材完整待学目录并推送
│   │   ├── video-monitor.ts          # 真实播放行为监控（秒级去重防拖拽/刷时长）
│   │   ├── portal-heartbeat.ts       # 智慧平台主页在线心跳与登录态同步
│   │   ├── study-record-sync.ts      # 智慧平台学习记录体检、dry_run 预览与增量同步
│   │   ├── wrong-question-sync.ts    # 错题增量提取与静默同步
│   │   ├── wrong-question-probe.ts   # 错题页面路由监控与自动探测调度
│   │   └── my-questions-export.ts    # 习题库提取导出工具 (JSON/Markdown/HTML)
│   └── ui/                           # 无头状态控制器与 Popup 快照提供模块
├── scripts/                          # 工程门禁与回归验证脚本
│   ├── check-version.js              # package.json / version.ts / README.md 三方版本核验门禁
│   ├── verify-auth.mjs               # 鉴权续签与防清空守卫单元断言
│   └── verify-update.mjs             # 磁盘版本探针防洗白回归断言
├── wxt.config.ts                     # WXT 配置文件 (最小化权限、环境动态域名权限、构建选项)
├── tsconfig.json                     # TypeScript 配置
└── package.json                      # 依赖与脚本
```

---

## 三、 本地开发、权限规范与打包发布

### 1. 安装依赖
项目 `.npmrc` 默认使用 npm 官方源，不锁定区域镜像。国内网络环境如需加速，可在本地通过命令行指定镜像源（或临时取消 `.npmrc` 内的注释）：
```bash
npm install
```

### 2. 启动开发模式（享受自动重载）
在项目根目录运行：
```bash
npm run dev
```
运行后，WXT 会：
1. 在 `.output/chrome-mv3` 输出带 HMR 客户端的开发构建产物；
2. 启动本地 HMR WebSocket 守护服务；
3. **在浏览器中加载扩展**：打开 Chrome / Edge 的 `chrome://extensions`，开启“开发者模式”，点击**“加载已解压的扩展程序”**，选中构建产物目录：
   ```text
   ./.output/chrome-mv3
   ```
4. **配置自建服务端地址**：
   - 开源版本默认**不预置**任何私有后端域名（服务端地址为空）；
   - 点击浏览器顶部工具栏扩展图标，在下拉弹窗的「**DOFFEE网站域名 / API 地址**」中输入您自建的后端 API 地址（如 `https://your-domain.example`，开发态 `npm run dev` 下支持 `http://localhost:8787` 本地联调），点击「保存域名」并授予域名访问权限后即可使用。

### 3. 生产打包构建
当需要公开发布或提交浏览器扩展商店审核时，运行：
```bash
npm run build
# 或生成商店上传压缩包：
npm run zip
```
生产构建具备以下合规保障：
- 仅声明实际使用的最小权限：`storage`、`alarms`、`tabs`（不包含未使用的 `declarativeNetRequest`）；
- `host_permissions` 与 `optional_host_permissions` 在生产模式下会自动剥离 `localhost` 与 `127.0.0.1`，仅保留平台必需域名与用户按需授权的 `https://*/*`；
- 剥离 HMR 调试客户端，输出标准化构建产物至 `.output/chrome-mv3`。

---

## 四、 核心业务红线保障

本重构版本 100% 继承并忠实遵循原项目确立的全部铁律与契约：
1. **入库约束（严防双树映射）**：
   - 在 `src/core/question-source.ts` 和各同步链路上完整保留 `assertNoTreeMapping` 防线，严禁 `textbook_node_id`、`chapter_path`、`topic_names` 等映射列流出插件。
2. **难易度中文五级**：
   - 难度严格统一归一化为中文标准五级：`易` / `较易` / `中` / `较难` / `难`。
3. **真实播放行为防刷**：
   - 保留基于秒级覆盖桶（`watchedSecondBuckets`）的物理播放时长去重机制，过滤拖拽快进与重复刷时长。
4. **双世界隔离与隐私保护契约**：
   - 主世界嗅探器通过 `world: 'MAIN'` 早期截获 SPA 接口数据，通过 `postMessage` 与 DOM 属性镜像向隔离世界同步紧凑数据；
   - 不持久化、不向第三方服务端转发智慧平台凭据（`access_token` / `mac_key`），仅在客户端本地用于本人学习数据与错题同步；
   - Service Worker 跨域代理 `BG_HTTP_REQUEST` 严格校验扩展来源与白名单域名，防止越权代理。

---

## 五、 版本号管理与项目铁律

> **【项目铁律】代码变更、版本递增与 `README.md` 同步铁律**
>
> 1. 只要对工程代码、配置或权限进行了实质性改动、Bug 修复或优化升级，**必须根据 SemVer 语义化规范同步递增 `package.json` 与 `src/core/version.ts` 的版本号**；
> 2. **将更新 `README.md` 作为项目铁律**：每次代码变更或版本更新时，必须同步更新 `README.md` 的版本声明（`当前版本：**vX.Y.Z**`）以及受影响的目录结构、功能描述、UI 名称与配置/发布说明，严禁文档与代码脱节；
> 3. 每次修改收尾必须执行 `npm run compile` 与 `npm run build` 完成门禁校验与构建闭环。

1. **界面顶端版本透视**：
   - 点击浏览器顶部工具栏的扩展图标即可展开统一操作弹窗，面板最顶部设置高对比度深色状态栏，显著显示 `VERSION v1.16.5`；
   - 检测到后台/磁盘存在新版本构建时，状态栏自动切换为琥珀金提醒并亮起 `新版已就绪: 🔄 重载生效` 按钮，点击即可一键重载生效。
2. **构建门禁与三核自动校验**：
   - `package.json`、`src/core/version.ts` 与 `README.md` 三核绑定；
   - 运行 `npm run compile` 或 `npm run build` 时，前置自动触发 `scripts/check-version.js`，三方版本号任一不一致直接拦截构建；
   - 支持一键同步版本标识：`npm run version:sync`。
3. **详细规范与 SOP**：
   - 请查阅根目录 [VERSION_GUIDE.md](./VERSION_GUIDE.md)。

---

## 六、 开源协议与免责声明

- **开源协议**：本项目基于 [GNU General Public License v3.0 (GPL-3.0)](./LICENSE) 开源发布。
- **合规免责声明**：
  1. 本项目为个人学习记录统计、错题整理与技术研究用途的非官方浏览器扩展工具，与国家中小学智慧教育平台没有任何官方关联；
  2. 本项目**不提供**任何跳过播放校验、自动刷课、代学作弊或绕过平台安全机制的功能，所有播放时长统计均基于物理秒级去重；
  3. 使用者应严格遵守目标平台的服务条款与相关法律法规，任何因不当使用本项目产生的后果由使用者自行承担。
