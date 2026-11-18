#!/usr/bin/env node
/**
 * check-version.js - 插件版本一致性校验与同步防呆工具
 * 
 * 校验规则：
 * 1. package.json 中的 "version" 字段
 * 2. src/core/version.ts 中的 export const APP_VERSION 字段
 * 3. README.md 中的版本声明（当前版本：**vX.Y.Z**）
 * 三者必须严格保持一致，以保证构建产物、manifest、界面展示与项目文档绝不脱节！
 */

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const rootDir = path.resolve(__dirname, '..');

const pkgPath = path.join(rootDir, 'package.json');
const versionTsPath = path.join(rootDir, 'src', 'core', 'version.ts');
const readmePath = path.join(rootDir, 'README.md');

if (!fs.existsSync(pkgPath)) {
  console.error('[check-version] ❌ 找不到 package.json 文件');
  process.exit(1);
}

if (!fs.existsSync(versionTsPath)) {
  console.error('[check-version] ❌ 找不到 src/core/version.ts 文件');
  process.exit(1);
}

if (!fs.existsSync(readmePath)) {
  console.error('[check-version] ❌ 找不到 README.md 文件');
  process.exit(1);
}

const pkgContent = JSON.parse(fs.readFileSync(pkgPath, 'utf8'));
const pkgVersion = pkgContent.version;

const versionTsContent = fs.readFileSync(versionTsPath, 'utf8');
const match = versionTsContent.match(/export\s+const\s+APP_VERSION\s*=\s*['"]([^'"]+)['"]/);

if (!match) {
  console.error('[check-version] ❌ 未在 src/core/version.ts 中找到 APP_VERSION 常量导出');
  process.exit(1);
}

const tsVersion = match[1];

const readmeContent = fs.readFileSync(readmePath, 'utf8');
const readmeMatch = readmeContent.match(/当前版本：\*\*v([0-9]+\.[0-9]+\.[0-9]+(?:-[^*\s]+)?)\*\*/);
const readmeVersion = readmeMatch ? readmeMatch[1] : null;

const isSyncMode = process.argv.includes('--sync');

const tsMismatch = pkgVersion !== tsVersion;
const readmeMismatch = pkgVersion !== readmeVersion;

if (tsMismatch || readmeMismatch) {
  if (isSyncMode) {
    if (tsMismatch) {
      console.log(`[check-version] ⚠️ 检测到源码版本不一致: package.json(${pkgVersion}) vs version.ts(${tsVersion})`);
      const updatedTs = versionTsContent.replace(
        /export\s+const\s+APP_VERSION\s*=\s*['"][^'"]+['"]/,
        `export const APP_VERSION = '${pkgVersion}'`
      );
      fs.writeFileSync(versionTsPath, updatedTs, 'utf8');
      console.log(`[check-version] ✅ 已同步更新 src/core/version.ts 为 ${pkgVersion}`);
    }
    if (readmeMismatch) {
      if (!readmeMatch) {
        console.error('[check-version] ❌ README.md 中缺少「当前版本：**vX.Y.Z**」标记，请手动核对并同步更新 README.md');
        process.exit(1);
      }
      console.log(`[check-version] ⚠️ 检测到文档版本不一致: package.json(${pkgVersion}) vs README.md(${readmeVersion})`);
      const updatedReadme = readmeContent
        .replace(/当前版本：\*\*v[0-9]+\.[0-9]+\.[0-9]+(?:-[^*\s]+)?\*\*/, `当前版本：**v${pkgVersion}**`)
        .replace(/`VERSION v[0-9]+\.[0-9]+\.[0-9]+(?:-[^`\s]+)?`/g, `\`VERSION v${pkgVersion}\``);
      fs.writeFileSync(readmePath, updatedReadme, 'utf8');
      console.log(`[check-version] ✅ 已同步更新 README.md 版本标识为 v${pkgVersion}（如涉及功能/结构变更，请一并补充文档正文）`);
    }
    process.exit(0);
  } else {
    console.error('======================================================================');
    console.error('❌ [版本校验失败] 插件版本号或 README.md 文档版本不一致！');
    console.error(`- package.json 中的版本号:  "${pkgVersion}"`);
    console.error(`- src/core/version.ts 版本号: "${tsVersion}"`);
    console.error(`- README.md 声明的版本号:     "${readmeVersion || '未找到（需包含 当前版本：**vX.Y.Z**）'}"`);
    console.error('');
    console.error('【项目铁律】：每次发布、功能迭代或代码变更时，必须同步更新：');
    console.error('  1) package.json；2) src/core/version.ts；3) README.md！');
    console.error('可手动统一（并确保 README.md 内容与最新代码一致），或先运行：npm run version:sync');
    console.error('======================================================================');
    process.exit(1);
  }
}

console.log(`[check-version] ✅ 版本号与 README.md 一致性核查通过！当前插件版本: v${pkgVersion}`);
