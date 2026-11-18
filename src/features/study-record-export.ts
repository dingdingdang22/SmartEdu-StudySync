/**
 * study-record-export.ts - 智慧平台学员学习记录本地 CSV 导出模块
 *
 * 导出内容严格限定为学员课程学习记录：
 * 1. 教材名称
 * 2. 教材目录（章 / 节 / 课时名称）
 * 3. 目录对应视频课观看进度（学习状态 / 观看进度 / 观看时长 / 本地有效学习时长 / 最近学习时间）
 *
 * 绝不导出错题本（wrong_questions）与习题本（my_exercises）。
 */

import { SmartEduAdapter } from '../adapters/smartedu-adapter';
import { readSmarteduIdentity, type SmarteduIdentity } from '../core/import-user-guard';
import { questionSource } from '../core/question-source';
import { storage, type LocalStudyRecord, type SyncedCatalogMeta } from '../core/storage';
import { catalogSync, type FullCatalogPayload } from './catalog-sync';
import { studyRecordSync } from './study-record-sync';

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const PLACEHOLDER_TEXTBOOK_TITLES = new Set(['已绑定教材', '智慧教育平台同步教材']);

const SUBJECT_EN_TO_CN: Record<string, string> = {
  Chinese: '语文',
  Mathematics: '数学',
  English: '英语',
  Physics: '物理',
  Chemistry: '化学',
  Biology: '生物',
  Politics: '道德与法治',
  History: '历史',
  Geography: '地理',
  Science: '科学'
};

const GRADE_NUM_TO_CN: Record<number, string> = {
  1: '一年级', 2: '二年级', 3: '三年级', 4: '四年级', 5: '五年级', 6: '六年级',
  7: '七年级', 8: '八年级', 9: '九年级',
  10: '高一', 11: '高二', 12: '高三'
};

function pickNonPlaceholderTitle(...candidates: Array<string | undefined | null>): string {
  for (const c of candidates) {
    const s = String(c || '').trim();
    if (s && !PLACEHOLDER_TEXTBOOK_TITLES.has(s)) return s;
  }
  return '';
}

function inferBookTitleFromLocalItems(tmId: string, localItems: LocalStudyRecord[]): string {
  for (const l of localItems || []) {
    if (String(l?.tm_id || '').trim().toLowerCase() !== tmId.toLowerCase()) continue;
    const subj = l.subject ? (SUBJECT_EN_TO_CN[l.subject] || l.subject) : '';
    const grade = typeof l.grade === 'number' ? (GRADE_NUM_TO_CN[l.grade] || `${l.grade}年级`) : '';
    const ver = String(l.textbook_version || '').trim();
    const joined = [subj, grade, ver].filter(Boolean).join(' · ');
    if (joined) return joined;
  }
  return '';
}

export const STUDY_CSV_HEADERS = [
  '智慧平台账号',
  '智慧平台用户ID',
  '教材名称',
  '教材目录(章)',
  '教材目录(节)',
  '课时名称',
  '学习状态',
  '观看进度(%)',
  '观看时长(秒)',
  '本地有效学习(秒)',
  '视频总时长(秒)',
  '最后观看时间',
  '教材ID',
  '课时ID'
] as const;

export interface PlatformStudyItem {
  resource_id: string;
  tm_id?: string;
  chapter_id?: string;
  sub_resource_id?: string;
  resource_name?: string;
  resource_type?: string;
  progress?: number;
  status?: number;
  watched_seconds?: number;
  platform_created_at?: string;
  platform_updated_at?: string;
}

export interface StudyCsvRow {
  accountName: string;
  userId: string;
  textbookTitle: string;
  chapterTitle: string;
  sectionTitle: string;
  lessonTitle: string;
  statusText: '已完成' | '进行中' | '未学习';
  progressPct: number;
  watchedSeconds: number;
  realPlayedSeconds: string;
  durationSeconds: string;
  updatedAt: string;
  tmId: string;
  resourceId: string;
}

export interface StudyCsvExportResult {
  ok: boolean;
  filename?: string;
  csvContent?: string;
  recordCount?: number;
  studiedCount?: number;
  textbookCount?: number;
  accountName?: string;
  userId?: string;
  warnings?: string[];
  error?: string;
}

/**
 * RFC 4180 CSV 单元格转义
 */
export function csvEscape(value: unknown): string {
  const s = value === null || value === undefined ? '' : String(value);
  if (/[",\r\n]/.test(s)) {
    return '"' + s.replace(/"/g, '""') + '"';
  }
  return s;
}

/**
 * 清理文件名中的非法系统字符
 */
export function sanitizeFilenameSegment(raw: string): string {
  return String(raw || '')
    .replace(/[<>:"/\\|?*\x00-\x1f]/g, '_')
    .replace(/\s+/g, ' ')
    .trim()
    .replace(/^\.+|\.+$/g, '');
}

/**
 * 按智慧平台账号生成导出文件名（例如：张三_12345678.csv 或 用户12345678.csv）
 */
export function buildAccountCsvFilename(identity: SmarteduIdentity): string {
  const uid = sanitizeFilenameSegment(identity.user_id || 'unknown');
  const rawName = sanitizeFilenameSegment(identity.display_name || '');
  if (!rawName || rawName === `用户${uid}` || rawName.includes(uid)) {
    const base = rawName || `用户${uid}`;
    return `${base}.csv`;
  }
  return `${rawName}_${uid}.csv`;
}

function parseTimestampMs(raw?: string | number | null): number {
  const s = String(raw ?? '').trim();
  if (!s) return Number.NaN;
  if (/^\d{10}$/.test(s)) return Number(s) * 1000;
  if (/^\d{13}$/.test(s)) return Number(s);
  return Date.parse(s);
}

/**
 * 将 ISO 或平台时间字符串/时间戳格式化为本地可读时间 YYYY-MM-DD HH:mm:ss
 */
export function formatCsvDateTime(raw?: string | number | null): string {
  const s = String(raw ?? '').trim();
  if (!s) return '';
  const ts = parseTimestampMs(s);
  if (Number.isNaN(ts)) return s;
  const d = new Date(ts);
  const p = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())} ${p(d.getHours())}:${p(d.getMinutes())}:${p(d.getSeconds())}`;
}

function pickLatestIsoTime(a?: string, b?: string): string {
  const sa = String(a || '').trim();
  const sb = String(b || '').trim();
  if (!sa) return sb;
  if (!sb) return sa;
  const ta = parseTimestampMs(sa);
  const tb = parseTimestampMs(sb);
  if (!Number.isNaN(ta) && !Number.isNaN(tb)) {
    return ta >= tb ? sa : sb;
  }
  return sa >= sb ? sa : sb;
}

function resolveProgressRowValues(
  platform?: PlatformStudyItem,
  local?: LocalStudyRecord
): {
  statusText: '已完成' | '进行中' | '未学习';
  progressPct: number;
  watchedSeconds: number;
  realPlayedSeconds: string;
  durationSeconds: string;
  updatedAt: string;
} {
  if (!platform && !local) {
    return {
      statusText: '未学习',
      progressPct: 0,
      watchedSeconds: 0,
      realPlayedSeconds: '',
      durationSeconds: '',
      updatedAt: ''
    };
  }

  const platformStatus = Number(platform?.status || 0);
  const platformPct = Math.max(0, Math.min(100, Math.round(Number(platform?.progress || 0))));
  const localPct = local ? Math.max(0, Math.min(100, Math.round((Number(local.completion_rate) || 0) * 100))) : 0;
  const isCompleted = Boolean(platformStatus >= 2 || platformPct >= 100 || local?.completed);

  const progressPct = isCompleted
    ? 100
    : Math.max(platformPct, localPct);

  const platformSec = Math.max(0, Math.round(Number(platform?.watched_seconds || 0)));
  const localPosSec = local ? Math.max(0, Math.round(Number(local.position_seconds || 0))) : 0;
  const watchedSeconds = platformSec > 0 ? platformSec : localPosSec;

  const realPlayedSeconds = local && local.real_played_seconds >= 0
    ? String(Math.round(local.real_played_seconds))
    : '';
  const durationSeconds = local && local.duration_seconds > 0
    ? String(Math.round(local.duration_seconds))
    : '';
  const updatedAt = formatCsvDateTime(
    pickLatestIsoTime(platform?.platform_updated_at || platform?.platform_created_at, local?.updated_at)
  );

  return {
    statusText: isCompleted ? '已完成' : '进行中',
    progressPct,
    watchedSeconds,
    realPlayedSeconds,
    durationSeconds,
    updatedAt
  };
}

/**
 * 将教材目录与平台/本地视频观看进度合并为有序的学习记录行
 */
export function mergeTextbookCatalogWithProgress(opts: {
  identity: SmarteduIdentity;
  platformItems: PlatformStudyItem[];
  localItems: LocalStudyRecord[];
  catalogsByTmId: Record<string, FullCatalogPayload>;
  cachedCatalogMeta?: Record<string, SyncedCatalogMeta>;
}): StudyCsvRow[] {
  const { identity, platformItems, localItems, catalogsByTmId, cachedCatalogMeta = {} } = opts;
  const accountName = identity.display_name || `用户${identity.user_id}`;
  const userId = identity.user_id;

  const platformByResId = new Map<string, PlatformStudyItem>();
  for (const p of platformItems || []) {
    const rid = String(p?.resource_id || '').trim().toLowerCase();
    if (!rid) continue;
    const prev = platformByResId.get(rid);
    if (!prev || String(p.platform_updated_at || '') > String(prev.platform_updated_at || '')) {
      platformByResId.set(rid, p);
    }
  }

  const localByResId = new Map<string, LocalStudyRecord>();
  for (const l of localItems || []) {
    const rid = String(l?.resource_id || '').trim().toLowerCase();
    if (!rid) continue;
    const prev = localByResId.get(rid);
    if (!prev || String(l.updated_at || '') > String(prev.updated_at || '')) {
      localByResId.set(rid, l);
    }
  }

  const consumedResourceIds = new Set<string>();
  const rows: StudyCsvRow[] = [];

  // 1. 按教材目录顺序输出（教材名称 + 章 + 节 + 课时 + 对应视频课观看进度）
  const tmIds = Object.keys(catalogsByTmId);
  for (const tmId of tmIds) {
    const cat = catalogsByTmId[tmId];
    if (!cat) continue;
    const cachedTitle = String(cachedCatalogMeta[tmId]?.textbookTitle || '').trim();
    const rawCatTitle = String(cat.book_meta?.title || '').trim();
    const textbookTitle =
      pickNonPlaceholderTitle(rawCatTitle, cachedTitle, inferBookTitleFromLocalItems(tmId, localItems)) ||
      `教材 (${tmId.slice(0, 8)})`;

    for (const item of cat.items || []) {
      const ridRaw = String(item.resource_id || '').trim();
      const ridKey = ridRaw.toLowerCase();
      if (!ridKey) continue;
      consumedResourceIds.add(ridKey);

      const p = platformByResId.get(ridKey);
      const l = localByResId.get(ridKey);
      const val = resolveProgressRowValues(p, l);

      rows.push({
        accountName,
        userId,
        textbookTitle,
        chapterTitle: String(item.chapter_title || '默认章节').trim(),
        sectionTitle: String(item.section_title || '默认小节').trim(),
        lessonTitle: String(item.title || p?.resource_name || l?.title || ridRaw).trim(),
        statusText: val.statusText,
        progressPct: val.progressPct,
        watchedSeconds: val.watchedSeconds,
        realPlayedSeconds: val.realPlayedSeconds,
        durationSeconds: val.durationSeconds,
        updatedAt: val.updatedAt,
        tmId,
        resourceId: ridRaw
      });
    }
  }

  // 2. 补充未能匹配到目录树（或目录拉取降级）的已学课时记录
  const allStudiedResIds = new Set<string>([
    ...platformByResId.keys(),
    ...localByResId.keys()
  ]);

  const orphanRows: StudyCsvRow[] = [];
  for (const ridKey of allStudiedResIds) {
    if (consumedResourceIds.has(ridKey)) continue;
    const p = platformByResId.get(ridKey);
    const l = localByResId.get(ridKey);
    const ridRaw = String(p?.resource_id || l?.resource_id || ridKey).trim();
    const tmId = String(p?.tm_id || l?.tm_id || '').trim();
    const cachedTitle = tmId ? String(cachedCatalogMeta[tmId]?.textbookTitle || '').trim() : '';
    const catTitle = tmId && catalogsByTmId[tmId]?.book_meta?.title ? String(catalogsByTmId[tmId].book_meta.title).trim() : '';
    const textbookTitle =
      pickNonPlaceholderTitle(catTitle, cachedTitle, tmId ? inferBookTitleFromLocalItems(tmId, localItems) : '') ||
      (tmId ? `教材 (${tmId.slice(0, 8)})` : '未归属教材');
    const val = resolveProgressRowValues(p, l);

    orphanRows.push({
      accountName,
      userId,
      textbookTitle,
      chapterTitle: String(l?.chapter_title || p?.chapter_id || '-').trim(),
      sectionTitle: '-',
      lessonTitle: String(p?.resource_name || l?.title || ridRaw).trim(),
      statusText: val.statusText,
      progressPct: val.progressPct,
      watchedSeconds: val.watchedSeconds,
      realPlayedSeconds: val.realPlayedSeconds,
      durationSeconds: val.durationSeconds,
      updatedAt: val.updatedAt,
      tmId,
      resourceId: ridRaw
    });
  }

  orphanRows.sort((a, b) => a.textbookTitle.localeCompare(b.textbookTitle, 'zh-CN') || b.updatedAt.localeCompare(a.updatedAt));
  return rows.concat(orphanRows);
}

/**
 * 将结构化行数组生成带 UTF-8 BOM 的 CSV 文本（确保 Windows Excel 直接打开中文不乱码）
 */
export function buildCsvTextFromRows(rows: StudyCsvRow[]): string {
  const lines: string[] = [];
  lines.push(STUDY_CSV_HEADERS.map(csvEscape).join(','));
  for (const r of rows) {
    lines.push([
      r.accountName,
      r.userId,
      r.textbookTitle,
      r.chapterTitle,
      r.sectionTitle,
      r.lessonTitle,
      r.statusText,
      r.progressPct,
      r.watchedSeconds,
      r.realPlayedSeconds,
      r.durationSeconds,
      r.updatedAt,
      r.tmId,
      r.resourceId
    ].map(csvEscape).join(','));
  }
  return '\uFEFF' + lines.join('\r\n') + '\r\n';
}

export class StudyRecordExportManager {
  async exportCurrentAccountStudyCsv(): Promise<StudyCsvExportResult> {
    const identity = readSmarteduIdentity();
    const ucAuth = questionSource.extractUcAuthFromStorage();
    if (!identity?.user_id || !ucAuth?.access_token) {
      return {
        ok: false,
        error: '未检测到智慧平台登录态，请先在智慧平台登录学生账号后再导出'
      };
    }

    const warnings: string[] = [];

    // 1. 拉取平台学习记录（仅 ykt 课程域，不碰错题与习题）
    const platformRes = await studyRecordSync.fetchRecordsForLocalExport();
    const localItems = storage.getLocalStudyHistory(identity.user_id);

    if (!platformRes.ok && localItems.length === 0) {
      return { ok: false, error: platformRes.error || '拉取平台学习记录失败' };
    }
    if (!platformRes.ok && localItems.length > 0) {
      warnings.push(`平台记录拉取异常（${platformRes.error}），本次仅导出本地已缓存的观看进度`);
    }

    const platformItems: PlatformStudyItem[] = platformRes.ok ? platformRes.items : [];

    // 2. 补齐缺少 tm_id 的课时所属教材（限制最多 10 条并发反查，避免过多请求）
    const missingTmItems = platformItems.filter((it) => !it.tm_id && it.resource_id).slice(0, 10);
    if (missingTmItems.length > 0) {
      await Promise.all(
        missingTmItems.map(async (it) => {
          try {
            const resolved = await catalogSync.resolveTmIdFromCurrentLesson(it.resource_id);
            if (resolved) it.tm_id = resolved;
          } catch (e) {}
        })
      );
    }

    // 3. 汇总涉及的教材 tm_id（学习记录中的 tm_id + 当前学习页的 tm_id）
    const tmIdSet = new Set<string>();
    for (const p of platformItems) {
      if (p.tm_id && UUID_RE.test(p.tm_id)) tmIdSet.add(p.tm_id);
    }
    for (const l of localItems) {
      if (l.tm_id && UUID_RE.test(l.tm_id)) tmIdSet.add(l.tm_id);
    }

    let currentPageTmId = '';
    try {
      if (SmartEduAdapter.isStudentSelfStudyPage()) {
        const idInfo = SmartEduAdapter.extractResourceIdentifiers();
        let pageTm = idInfo.tm_id || idInfo.teachingmaterialId;
        if (!pageTm && idInfo.resourceId) {
          pageTm = (await catalogSync.resolveTmIdFromCurrentLesson(idInfo.resourceId)) || '';
        }
        if (pageTm && UUID_RE.test(pageTm)) {
          currentPageTmId = pageTm;
          // 仅当已有该教材学习记录或当前页面正处于课程学习页时纳入
          if (tmIdSet.size === 0 || tmIdSet.has(pageTm)) {
            tmIdSet.add(pageTm);
          }
        }
      }
    } catch (e) {}

    // 4. 并发拉取每本教材的完整目录（树 + 分片）
    const catalogsByTmId: Record<string, FullCatalogPayload> = {};
    const tmIds = Array.from(tmIdSet);
    const concurrency = 3;
    let idx = 0;
    const worker = async () => {
      while (idx < tmIds.length) {
        const tmId = tmIds[idx++];
        try {
          const cat = await catalogSync.fetchFullCatalogFromCdn(tmId, null, {
            ignorePageContext: tmId !== currentPageTmId
          });
          catalogsByTmId[tmId] = cat;
        } catch (e: any) {
          warnings.push(`教材目录 [${tmId.slice(0, 8)}] 拉取失败，已降级按课时条目导出`);
        }
      }
    };
    await Promise.all(Array.from({ length: Math.min(concurrency, tmIds.length) }, () => worker()));

    // 5. 合并教材名称、教材目录与视频课观看进度
    const cachedCatalogMeta = storage.getSyncedCatalogMap();
    const rows = mergeTextbookCatalogWithProgress({
      identity,
      platformItems,
      localItems,
      catalogsByTmId,
      cachedCatalogMeta
    });

    if (rows.length === 0) {
      return {
        ok: false,
        error: `当前智慧平台账号「${identity.display_name}」暂无学习记录可导出`
      };
    }

    const csvContent = buildCsvTextFromRows(rows);
    const filename = buildAccountCsvFilename(identity);
    const studiedCount = rows.filter((r) => r.statusText !== '未学习').length;

    return {
      ok: true,
      filename,
      csvContent,
      recordCount: rows.length,
      studiedCount,
      textbookCount: new Set(rows.map((r) => r.textbookTitle)).size,
      accountName: identity.display_name,
      userId: identity.user_id,
      warnings
    };
  }
}

export const studyRecordExport = new StudyRecordExportManager();
