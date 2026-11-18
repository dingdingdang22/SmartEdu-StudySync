import { storage } from '../../src/core/storage';
import {
  clearPendingLocalExport,
  downloadCsvViaBackground,
  getPathBasename,
  getPendingLocalExport,
  loadDirectoryHandle,
  requestDirectoryWritePermission,
  saveDirectoryHandle,
  supportsDirectoryPicker,
  writeFileToDirectoryHandle,
  type PendingLocalExportPayload
} from '../../src/core/local-export';

function esc(s: unknown): string {
  return String(s == null ? '' : s)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

async function init() {
  const root = document.getElementById('app');
  if (!root) return;

  await storage.ensureHydrated();
  const params = new URLSearchParams(window.location.search);
  const mode = params.get('mode') || 'pick';
  const pending: PendingLocalExportPayload | null = await getPendingLocalExport();
  const existingHandle = await loadDirectoryHandle();

  let statusType: 'info' | 'success' | 'error' = 'info';
  let statusText = '';
  let busy = false;

  const render = () => {
    const cfg = storage.getConfig();
    const targetPath = pending?.targetDir || cfg.localExportDir || existingHandle?.name || '';
    const hasPicker = supportsDirectoryPicker();

    let title = '📁 选择本地导出文件夹';
    let desc = '请选择用于存放学习记录 CSV 文件的本地文件夹（仅需授权一次，后续导出将直接写入该文件夹）。';
    let primaryLabel = '📁 选择本地文件夹';

    if (mode === 'reauth' && pending) {
      title = '🔓 重新确认文件夹写入权限';
      desc = `浏览器重启后需重新确认一次写入权限，确认后将直接把「${pending.filename}」写入文件夹「${existingHandle?.name || targetPath}」。`;
      primaryLabel = '🔓 授权并立即写入 CSV';
    } else if (mode === 'save' && pending) {
      title = '📁 授权本地导出文件夹';
      desc = `您填写了本地路径「${targetPath}」。受浏览器安全机制限制，请通过下方按钮选中该文件夹一次，即可直接写入且后续无需重复选择。`;
      primaryLabel = '📁 选择文件夹并立即导出';
    }

    root.innerHTML = `
      <style>
        * { box-sizing: border-box; }
        body {
          margin: 0;
          padding: 18px;
          font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Microsoft YaHei", sans-serif;
          font-size: 13px;
          color: #1e293b;
          background: #f8fafc;
        }
        .card {
          background: #ffffff;
          border: 1px solid #e2e8f0;
          border-radius: 10px;
          padding: 16px;
          box-shadow: 0 4px 16px rgba(15, 23, 42, 0.08);
        }
        .title {
          font-size: 15px;
          font-weight: 700;
          color: #0f172a;
          margin-bottom: 8px;
        }
        .desc {
          font-size: 12px;
          color: #475569;
          line-height: 1.6;
          margin-bottom: 12px;
        }
        .meta {
          background: #f1f5f9;
          border-radius: 6px;
          padding: 8px 10px;
          font-size: 12px;
          margin-bottom: 12px;
          line-height: 1.6;
        }
        .status {
          padding: 8px 10px;
          border-radius: 6px;
          font-size: 12px;
          font-weight: 600;
          margin-bottom: 12px;
        }
        .status.info { background: #e0f2fe; color: #0369a1; }
        .status.success { background: #dcfce7; color: #15803d; }
        .status.error { background: #fee2e2; color: #b91c1c; }
        .btn-row {
          display: flex;
          gap: 8px;
          flex-wrap: wrap;
        }
        .btn {
          flex: 1;
          min-width: 120px;
          padding: 8px 12px;
          border: none;
          border-radius: 6px;
          font-size: 12px;
          font-weight: 600;
          cursor: pointer;
        }
        .btn:disabled { opacity: 0.6; cursor: not-allowed; }
        .btn-primary { background: #1769aa; color: #ffffff; }
        .btn-primary:hover:not(:disabled) { background: #125387; }
        .btn-secondary { background: #e2e8f0; color: #334155; }
        .btn-secondary:hover:not(:disabled) { background: #cbd5e1; }
      </style>
      <div class="card">
        <div class="title">${esc(title)}</div>
        <div class="desc">${esc(desc)}</div>
        ${pending ? `
          <div class="meta">
            <div>智慧平台账号：<b>${esc(pending.accountName)}</b> (${esc(pending.userId)})</div>
            <div>导出文件名：<b>${esc(pending.filename)}</b></div>
            <div>导出条目：共 <b>${pending.recordCount}</b> 条目录记录（已学 ${pending.studiedCount ?? 0} 节）</div>
            ${targetPath ? `<div>目标文件夹：<b>${esc(targetPath)}</b></div>` : ''}
          </div>
        ` : ''}
        ${statusText ? `<div class="status ${esc(statusType)}">${esc(statusText)}</div>` : ''}
        <div class="btn-row">
          ${hasPicker ? `
            <button class="btn btn-primary" id="primary-btn" ${busy ? 'disabled' : ''}>${esc(primaryLabel)}</button>
          ` : `
            <div class="status error" style="width:100%;">当前浏览器不支持目录选择授权，请使用下方「浏览器另存为」导出。</div>
          `}
          ${pending ? `
            <button class="btn btn-secondary" id="saveas-btn" ${busy ? 'disabled' : ''}>📥 使用浏览器「另存为」</button>
          ` : ''}
          <button class="btn btn-secondary" id="cancel-btn" style="flex:0;min-width:72px;" ${busy ? 'disabled' : ''}>关闭</button>
        </div>
      </div>
    `;

    document.getElementById('cancel-btn')?.addEventListener('click', () => {
      window.close();
    });

    document.getElementById('saveas-btn')?.addEventListener('click', async () => {
      if (!pending || busy) return;
      busy = true;
      render();
      try {
        const res = await downloadCsvViaBackground({
          filename: pending.filename,
          csvContent: pending.csvContent,
          saveAs: true
        });
        if (res.ok) {
          await clearPendingLocalExport();
          statusType = 'success';
          statusText = `已通过浏览器保存对话框导出：${pending.filename}`;
          render();
          setTimeout(() => window.close(), 1000);
        } else {
          statusType = 'error';
          statusText = `导出失败：${res.error || '已取消'}`;
        }
      } finally {
        busy = false;
        render();
      }
    });

    document.getElementById('primary-btn')?.addEventListener('click', async () => {
      if (busy) return;
      busy = true;
      statusText = '';
      render();
      try {
        let handle = mode === 'reauth' ? existingHandle : null;
        if (mode === 'reauth' && handle) {
          const granted = await requestDirectoryWritePermission(handle);
          if (!granted) {
            handle = await (window as any).showDirectoryPicker({ mode: 'readwrite' });
          }
        } else {
          handle = await (window as any).showDirectoryPicker({ mode: 'readwrite' });
        }

        await saveDirectoryHandle(handle);

        const curCfg = storage.getConfig();
        const prevDir = String(curCfg.localExportDir || '').trim();
        const nextDir = prevDir && getPathBasename(prevDir) === handle.name ? prevDir : handle.name;
        storage.saveConfig({
          localExportDir: nextDir,
          localExportBoundName: handle.name
        });

        if (pending) {
          await writeFileToDirectoryHandle(handle, pending.filename, pending.csvContent);
          await clearPendingLocalExport();
          statusType = 'success';
          statusText = `✅ 已成功导出 ${pending.recordCount} 条记录至「${handle.name}/${pending.filename}」`;
        } else {
          statusType = 'success';
          statusText = `✅ 已授权导出文件夹「${handle.name}」，窗口即将关闭`;
        }
        render();
        setTimeout(() => window.close(), 1000);
      } catch (e: any) {
        if (e?.name === 'AbortError') {
          statusType = 'info';
          statusText = '已取消选择文件夹';
        } else {
          statusType = 'error';
          statusText = `操作失败：${e?.message || String(e)}`;
        }
      } finally {
        busy = false;
        render();
      }
    });
  };

  render();
}

void init();
