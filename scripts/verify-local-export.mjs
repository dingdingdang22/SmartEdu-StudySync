/**
 * verify-local-export.mjs - 本地学习记录 CSV 导出功能单元与集成验证套件
 */

import assert from 'node:assert';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import esbuild from 'esbuild';

const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'smartedu-local-export-test-'));

async function loadTsModule(relPath) {
  const outFile = path.join(tmpDir, path.basename(relPath, '.ts') + '.mjs');
  await esbuild.build({
    entryPoints: [path.resolve(relPath)],
    outfile: outFile,
    bundle: true,
    format: 'esm',
    platform: 'browser',
    target: 'es2022',
    logLevel: 'silent'
  });
  return import(pathToFileURL(outFile).href);
}

try {
  console.log('🧪 开始验证本地学习记录 CSV 导出模块...\n');

  const exportMod = await loadTsModule('src/features/study-record-export.ts');
  const localExportMod = await loadTsModule('src/core/local-export.ts');
  const syncMod = await loadTsModule('src/features/study-record-sync.ts');

  // 1. 文件名按智慧平台账号命名与非法字符清理
  console.log('▶ [测试 1] 按智慧平台账号命名 CSV 文件与非法字符清理');
  assert.strictEqual(
    exportMod.buildAccountCsvFilename({ user_id: '123456', display_name: '张三' }),
    '张三_123456.csv'
  );
  assert.strictEqual(
    exportMod.buildAccountCsvFilename({ user_id: '987654', display_name: '用户987654' }),
    '用户987654.csv'
  );
  assert.strictEqual(
    exportMod.buildAccountCsvFilename({ user_id: '1001', display_name: '李四/A:B*C?' }),
    '李四_A_B_C__1001.csv'
  );
  console.log('   ✅ 账号命名与非法字符清理通过');

  // 2. CSV 转义与 UTF-8 BOM + 最后观看时间格式化
  console.log('▶ [测试 2] CSV RFC 4180 转义、时间格式化与 BOM');
  assert.strictEqual(exportMod.csvEscape('普通文本'), '普通文本');
  assert.strictEqual(exportMod.csvEscape('含,逗号'), '"含,逗号"');
  assert.strictEqual(exportMod.csvEscape('含"引号"'), '"含""引号"""');
  assert.strictEqual(exportMod.csvEscape('多行\n文本'), '"多行\n文本"');
  assert.match(exportMod.formatCsvDateTime('2026-11-18T10:15:30.000Z'), /^\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2}$/);
  assert.match(exportMod.formatCsvDateTime('1763460930'), /^\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2}$/);
  assert.match(exportMod.formatCsvDateTime('1763460930000'), /^\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2}$/);
  assert.strictEqual(exportMod.formatCsvDateTime(''), '');
  console.log('   ✅ CSV 转义与时间格式化通过');

  // 3. 教材名称 + 教材目录 + 视频课观看进度 + 最后观看时间合并导出
  console.log('▶ [测试 3] 教材名称、教材目录与视频课观看进度合并导出');
  const rows = exportMod.mergeTextbookCatalogWithProgress({
    identity: { user_id: 'u_001', display_name: '王小明' },
    platformItems: [
      {
        resource_id: 'RES-111',
        tm_id: 'tm-math-7a',
        resource_name: '1.1 正数和负数',
        progress: 100,
        status: 2,
        watched_seconds: 620,
        platform_updated_at: '2026-11-18T08:00:00.000Z'
      },
      {
        resource_id: 'res-222',
        tm_id: 'tm-math-7a',
        resource_name: '1.2 有理数',
        progress: 45,
        status: 1,
        watched_seconds: 280,
        platform_updated_at: '2026-11-18T09:30:00.000Z'
      }
    ],
    localItems: [
      {
        resource_id: 'res-222',
        tm_id: 'tm-math-7a',
        title: '1.2 有理数',
        subject: 'Mathematics',
        grade: 7,
        textbook_version: '人教版',
        chapter_title: '第一章 有理数',
        url: 'https://basic.smartedu.cn/syncClassroom/classActivity?activityId=res-222',
        duration_seconds: 600,
        position_seconds: 290,
        real_played_seconds: 250,
        completion_rate: 0.42,
        completed: false,
        last_session_id: 's1',
        last_session_seconds: 250,
        first_watched_at: '2026-11-18T09:20:00.000Z',
        updated_at: '2026-11-18T09:35:00.000Z'
      }
    ],
    catalogsByTmId: {
      'tm-math-7a': {
        source: 'smartedu',
        teachingmaterial_id: 'tm-math-7a',
        current_resource_id: null,
        book_meta: {
          subject: 'Mathematics',
          subject_cn: '数学',
          grade: 7,
          grade_cn: '七年级',
          edition: '人教版',
          curriculum_era: '新教材',
          volume: '上册',
          title: '数学 · 七年级 · 人教版 · 上册'
        },
        items: [
          {
            resource_id: 'res-111',
            title: '1.1 正数和负数',
            resource_type: 'national_lesson',
            chapter_id: 'ch1',
            chapter_title: '第一章 有理数',
            section_id: 'sec1',
            section_title: '1.1 正数和负数'
          },
          {
            resource_id: 'res-222',
            title: '1.2 有理数',
            resource_type: 'national_lesson',
            chapter_id: 'ch1',
            chapter_title: '第一章 有理数',
            section_id: 'sec2',
            section_title: '1.2 有理数'
          },
          {
            resource_id: 'res-333',
            title: '1.3 有理数的加减法',
            resource_type: 'national_lesson',
            chapter_id: 'ch1',
            chapter_title: '第一章 有理数',
            section_id: 'sec3',
            section_title: '1.3 有理数的加减法'
          }
        ]
      }
    }
  });

  assert.strictEqual(rows.length, 3, '应导出教材完整目录的 3 条记录');
  assert.strictEqual(rows[0].textbookTitle, '数学 · 七年级 · 人教版 · 上册');
  assert.strictEqual(rows[0].statusText, '已完成');
  assert.strictEqual(rows[0].progressPct, 100);
  assert.strictEqual(rows[0].watchedSeconds, 620);

  assert.strictEqual(rows[1].statusText, '进行中');
  assert.strictEqual(rows[1].progressPct, 45);
  assert.strictEqual(rows[1].watchedSeconds, 280);
  assert.strictEqual(rows[1].realPlayedSeconds, '250');
  assert.strictEqual(rows[1].durationSeconds, '600');
  assert.strictEqual(rows[1].updatedAt, exportMod.formatCsvDateTime('2026-11-18T09:35:00.000Z'));

  assert.strictEqual(rows[2].lessonTitle, '1.3 有理数的加减法');
  assert.strictEqual(rows[2].statusText, '未学习');
  assert.strictEqual(rows[2].progressPct, 0);
  assert.strictEqual(rows[2].updatedAt, '');

  const csvText = exportMod.buildCsvTextFromRows(rows);
  assert.ok(csvText.startsWith('\uFEFF'), 'CSV 必须以 UTF-8 BOM 开头');
  assert.ok(csvText.includes('教材名称,教材目录(章),教材目录(节),课时名称,学习状态,观看进度(%),观看时长(秒),本地有效学习(秒),视频总时长(秒),最后观看时间'), 'CSV 必须包含完整表头');
  console.log('   ✅ 教材目录、观看进度与最后观看时间导出验证通过');

  // 4. 错题本与习题类资源过滤（绝不导出错题和习题）
  console.log('▶ [测试 4] 错题本/习题/非课时资源过滤验证');
  const parsed = syncMod.studyRecordSync.parseRecords([
    { resource_id: 'r1', resource_name: '正常视频课', resource_type: 'national_lesson', progress: 80, status: 1, ext_info: '{}' },
    { resource_id: 'r2', resource_name: '教材浏览', resource_type: 'teachingmaterials', progress: 10, status: 1, ext_info: '{}' },
    { resource_id: 'r3', resource_name: 'PDF阅读', resource_type: 'assets_document', progress: 10, status: 1, ext_info: '{}' },
    { resource_id: 'r4', resource_name: '错题本记录', resource_type: 'wrong_question', progress: 100, status: 2, ext_info: '{}' },
    { resource_id: 'r5', resource_name: '我的习题', resource_type: 'my_exercise', progress: 100, status: 2, ext_info: '{}' }
  ], { allowMissingTmId: true });
  assert.strictEqual(parsed.items.length, 1);
  assert.strictEqual(parsed.items[0].resource_id, 'r1');
  console.log('   ✅ 错题、习题及非课时资源已严格过滤');

  // 5. 本地路径解析与相对路径规范化
  console.log('▶ [测试 5] 本地路径分类与规范化验证');
  assert.strictEqual(localExportMod.isAbsoluteFsPath('D:\\学习记录'), true);
  assert.strictEqual(localExportMod.isAbsoluteFsPath('C:/Users/stu/records'), true);
  assert.strictEqual(localExportMod.isAbsoluteFsPath('/Users/stu/records'), true);
  assert.strictEqual(localExportMod.isAbsoluteFsPath('\\\\NAS\\study'), true);
  assert.strictEqual(localExportMod.isAbsoluteFsPath('smartedu-records'), false);
  assert.strictEqual(localExportMod.getPathBasename('D:\\学习记录\\2026\\'), '2026');
  assert.strictEqual(localExportMod.normalizeRelativeDownloadDir('..\\evil\\sub/dir'), 'evil/sub/dir');
  assert.strictEqual(localExportMod.normalizeRelativeDownloadDir(''), 'smartedu-records');
  assert.strictEqual(localExportMod.doesDirMatchBoundHandle('D:\\学习记录', '学习记录'), true);
  assert.strictEqual(localExportMod.doesDirMatchBoundHandle('D:\\新目录', '学习记录'), false);
  console.log('   ✅ 本地路径解析与安全规范化通过');

  console.log('\n🎉 所有本地导出验证测试全部通过！');
} finally {
  fs.rmSync(tmpDir, { recursive: true, force: true });
}
