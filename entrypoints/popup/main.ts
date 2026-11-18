import './style.css';
import { storage, type MonitorConfig } from '../../src/core/storage';
import { uploader } from '../../src/core/uploader';
import { smarteduBinding } from '../../src/core/smartedu-binding';
import { DISPLAY_VERSION } from '../../src/core/version';
import type { DiagnosticSnapshot } from '../../src/ui/diagnostic-panel';
import type { UserSwitchPrompt } from '../../src/core/import-user-guard';

interface ToastState {
  type: 'info' | 'success' | 'warn' | 'error';
  text: string;
}

interface UnbindModalState {
  username: string;
  smarteduName: string;
  token: string;
  error: string;
  busy: boolean;
}

interface SwitchConfirmModalState {
  prompt: UserSwitchPrompt;
  retryAction: string;
  retryPayload: any;
}

function esc(s: unknown): string {
  return String(s == null ? '' : s)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

const SUBJECT_CN_MAP: Record<string, string> = {
  Chinese: '语文',
  Mathematics: '数学',
  English: '英语',
  Physics: '物理',
  Chemistry: '化学',
  Biology: '生物',
  Politics: '道德与法治',
  History: '历史',
  Geography: '地理'
};

const GRADE_CN_MAP: Record<number, string> = {
  1: '一年级', 2: '二年级', 3: '三年级', 4: '四年级', 5: '五年级', 6: '六年级',
  7: '七年级', 8: '八年级', 9: '九年级',
  10: '高一', 11: '高二', 12: '高三'
};

function formatCourseMeta(info: any): string {
  if (!info) return '-';
  const title = String(info.title || '').trim();
  const navSkip = new Set(['首页', '课程教学', '学生自主学习', '同步课程', '课程学习', '国家中小学智慧教育平台']);
  if (Array.isArray(info.breadcrumb) && info.breadcrumb.length > 0) {
    const tags = info.breadcrumb
      .map((t: any) => String(t || '').trim())
      .filter((t: string) => t && !navSkip.has(t) && t !== title);
    if (tags.length > 0) {
      return tags.join(' · ');
    }
  }
  const gradeNum = info.grade ? Number(info.grade) : 0;
  const stage = gradeNum ? (gradeNum <= 6 ? '小学' : gradeNum <= 9 ? '初中' : '高中') : '';
  const gradeCn = gradeNum ? (GRADE_CN_MAP[gradeNum] || `${gradeNum}年级`) : '';
  const subjectCn = info.subject ? (SUBJECT_CN_MAP[info.subject] || String(info.subject)) : '';
  const ver = String(info.textbookVersion || '').trim();
  const parts = [stage, gradeCn, subjectCn, ver].filter(Boolean);
  return parts.length > 0 ? parts.join(' · ') : '-';
}

function sendRuntimeMessage(payload: any): Promise<any> {
  return new Promise((resolve) => {
    try {
      if (typeof chrome === 'undefined' || !chrome.runtime?.id) {
        resolve(null);
        return;
      }
      chrome.runtime.sendMessage(payload, (res) => {
        if (chrome.runtime.lastError) {
          resolve(null);
          return;
        }
        resolve(res ?? null);
      });
    } catch {
      resolve(null);
    }
  });
}

function sendTabMessage(tabId: number, payload: any): Promise<any> {
  return new Promise((resolve) => {
    try {
      chrome.tabs.sendMessage(tabId, payload, (res) => {
        if (chrome.runtime.lastError) {
          resolve(null);
          return;
        }
        resolve(res ?? null);
      });
    } catch {
      resolve(null);
    }
  });
}

class PopupController {
  private rootEl: HTMLElement;

  private activeTabId: number | null = null;
  private activeTabUrl = '';
  private tabConnected = false;
  private streamPort: chrome.runtime.Port | null = null;

  private diagSnap: DiagnosticSnapshot | null = null;
  private config: MonitorConfig = storage.getConfig();

  private isUpdateReady = false;
  private pendingVersion: string | null = null;

  private toast: ToastState | null = null;
  private unbindModal: UnbindModalState | null = null;
  private switchModal: SwitchConfirmModalState | null = null;
  private busyActions = new Set<string>();

  constructor(rootEl: HTMLElement) {
    this.rootEl = rootEl;
  }

  async init(): Promise<void> {
    this.config = await storage.ensureHydrated();

    // 监听后台或其他标签页的配置更新
    storage.onConfigChange((cfg) => {
      this.config = cfg;
      this.render();
    });

    // 拉取 SW 更新态
    const updateRes = await sendRuntimeMessage({ type: 'GET_UPDATE_STATE' });
    if (updateRes && updateRes.isUpdateReady) {
      this.isUpdateReady = true;
      this.pendingVersion = updateRes.version || '最新版';
    }

    // 查找当前窗口活跃标签页并建立连接
    await this.connectActiveTab();

    this.render();
  }

  private async connectActiveTab(): Promise<void> {
    try {
      const tabs = await chrome.tabs.query({ active: true, currentWindow: true });
      const tab = tabs && tabs[0];
      if (!tab || typeof tab.id !== 'number') return;

      this.activeTabId = tab.id;
      this.activeTabUrl = tab.url || '';

      const snap = await sendTabMessage(tab.id, { type: 'POPUP_GET_SNAPSHOT' });
      if (snap && snap.ok) {
        this.applyTabSnapshot(snap);
        this.tabConnected = true;
        this.openStreamPort(tab.id);
      }
    } catch {
      this.tabConnected = false;
    }
  }

  private openStreamPort(tabId: number): void {
    try {
      this.streamPort?.disconnect();
      const port = chrome.tabs.connect(tabId, { name: 'POPUP_STREAM' });
      this.streamPort = port;
      port.onMessage.addListener((msg: any) => {
        if (msg?.type === 'POPUP_SNAPSHOT_PUSH' && msg.data) {
          this.applyTabSnapshot(msg.data);
          // 若当前未打开任何表单焦点，仅增量刷新实时区域以保持输入与滚动位置
          if (!this.patchLiveMonitorNodes()) {
            this.render();
          }
        }
      });
      port.onDisconnect.addListener(() => {
        this.streamPort = null;
      });
    } catch {
      this.streamPort = null;
    }
  }

  private applyTabSnapshot(data: any): void {
    if (data.diagnostic) {
      this.diagSnap = data.diagnostic as DiagnosticSnapshot;
      if (this.diagSnap.isUpdateReady) {
        this.isUpdateReady = true;
        this.pendingVersion = this.diagSnap.pendingVersion || this.pendingVersion || '最新版';
      }
    }
    if (data.config) {
      this.config = data.config as MonitorConfig;
    }
  }

  private showToast(type: ToastState['type'], text: string): void {
    this.toast = { type, text };
    this.render();
  }

  private async runTabAction(action: string, payload: any = {}): Promise<any> {
    if (!this.tabConnected || this.activeTabId === null) {
      this.showToast('warn', '当前标签页未连接智慧平台，请先打开国家中小学智慧教育平台页面');
      return null;
    }
    this.busyActions.add(action);
    this.render();
    try {
      const res = await sendTabMessage(this.activeTabId, {
        type: 'POPUP_RUN_ACTION',
        action,
        payload
      });
      if (res?.needUserSwitchConfirm && res.switchPrompt) {
        this.switchModal = {
          prompt: res.switchPrompt,
          retryAction: action,
          retryPayload: payload
        };
        return res;
      }
      // 动作完成后主动拉取最新快照
      const snap = await sendTabMessage(this.activeTabId, { type: 'POPUP_GET_SNAPSHOT' });
      if (snap?.ok) this.applyTabSnapshot(snap);
      return res;
    } finally {
      this.busyActions.delete(action);
      this.render();
    }
  }

  private async notifyTabConfigChanged(extra: Record<string, any> = {}): Promise<void> {
    if (this.tabConnected && this.activeTabId !== null) {
      await sendTabMessage(this.activeTabId, {
        type: 'POPUP_RUN_ACTION',
        action: 'REFRESH_CONFIG_CHANGED',
        payload: extra
      });
      const snap = await sendTabMessage(this.activeTabId, { type: 'POPUP_GET_SNAPSHOT' });
      if (snap?.ok) this.applyTabSnapshot(snap);
    }
  }

  /**
   * 增量刷新实时跳动的视频进度与流水日志，避免全量重建 DOM 导致输入框失焦或滚动跳回顶部。
   * 返回 false 表示需要走全量 render（例如当前不在 monitor tab 或节点不存在）。
   */
  private patchLiveMonitorNodes(): boolean {
    if (this.unbindModal || this.switchModal) return false;
    const statusEl = document.getElementById('monitor-status');
    if (!statusEl || !this.diagSnap) return false;

    const vs = this.diagSnap.videoState;
    if (!vs.hasVideo) {
      statusEl.textContent = '等待进入视频课时...';
      statusEl.style.color = '#eab308';
    } else if (vs.paused) {
      statusEl.textContent = '视频已暂停';
      statusEl.style.color = '#ca8a04';
    } else {
      statusEl.textContent = '正在学习监听中';
      statusEl.style.color = '#16a34a';
    }

    const titleEl = document.getElementById('course-title');
    const metaEl = document.getElementById('course-meta');
    const progEl = document.getElementById('play-progress');
    const realEl = document.getElementById('real-time');
    const flushBtn = document.getElementById('flush-btn');

    if (vs.resourceInfo) {
      if (titleEl) {
        const nextTitle = vs.resourceInfo.title || '获取中...';
        titleEl.textContent = nextTitle;
        titleEl.title = nextTitle;
      }
      if (metaEl) metaEl.textContent = formatCourseMeta(vs.resourceInfo);
    }
    if (progEl) progEl.textContent = `${vs.currentTime}s / ${vs.duration}s`;
    if (realEl) realEl.textContent = `${vs.realPlayedSeconds} 秒`;
    if (flushBtn) flushBtn.textContent = `冲刷 (${this.diagSnap.queueLength})`;

    const wrongStatusEl = document.getElementById('wrong-sync-status');
    const wrongCountEl = document.getElementById('wrong-sync-count');
    const wrongTimeEl = document.getElementById('wrong-sync-time');
    if (wrongStatusEl) {
      wrongStatusEl.textContent = this.diagSnap.wrongSync.statusText;
      wrongStatusEl.style.color = this.diagSnap.wrongSync.statusColor;
    }
    if (wrongCountEl) wrongCountEl.textContent = `${this.diagSnap.wrongSync.syncedCount} 道`;
    if (wrongTimeEl) wrongTimeEl.textContent = this.diagSnap.wrongSync.lastSyncTime;

    // 同步上下文栏点状态
    const ctxDot = document.getElementById('ctx-dot');
    if (ctxDot) {
      ctxDot.className = `context-dot ${vs.hasVideo && !vs.paused ? 'playing' : 'connected'}`;
    }
    return true;
  }

  private render(): void {
    const bodyEl = document.getElementById('popup-scroll-body');
    const prevScrollTop = bodyEl ? bodyEl.scrollTop : 0;

    // 保留尚未提交的输入框草稿
    const draftUser = (document.getElementById('new-slot-user') as HTMLInputElement | null)?.value;
    const draftPwd = (document.getElementById('new-slot-pwd') as HTMLInputElement | null)?.value;
    const draftUrl = (document.getElementById('cfg-url') as HTMLInputElement | null)?.value;

    const currentSmartedu = this.diagSnap?.currentSmartedu || null;
    const vs = this.diagSnap?.videoState;
    const contextLabel = this.tabConnected
      ? (currentSmartedu
        ? `已连接智慧平台 · ${currentSmartedu.display_name}`
        : '已连接智慧平台（未检测到平台登录）')
      : '未打开智慧平台页面（仅管理通用配置）';
    const dotClass = this.tabConnected
      ? (vs?.hasVideo && !vs.paused ? 'playing' : 'connected')
      : '';

    const activeAccountLabel = this.config.dofeeUsername
      ? `激活: ${this.config.dofeeUsername}`
      : '未激活 dofee';

    this.rootEl.innerHTML = `
      <div class="card-top-bar ${this.isUpdateReady ? 'update-ready' : ''}">
        <div class="top-version-badge">
          <span class="top-version-label">VERSION</span>
          <span class="top-version-value">${esc(DISPLAY_VERSION)}</span>
        </div>
        ${this.isUpdateReady ? `
          <div class="top-update-pill">
            <span class="top-indicator-dot pulse-amber"></span>
            <span style="color:#fef3c7;font-weight:700;">新版已就绪:</span>
            <button class="top-action-btn" id="top-reload-btn" title="重载扩展并刷新当前页启用新版">🔄 重载生效</button>
          </div>
        ` : ''}
      </div>

      <div class="context-bar">
        <span class="context-pill">
          <span class="context-dot ${dotClass}" id="ctx-dot"></span>
          <span>${esc(contextLabel)}</span>
        </span>
        <span style="font-weight:600;color:${this.config.dofeeUsername ? '#15803d' : '#d97706'};">${esc(activeAccountLabel)}</span>
      </div>

      ${this.toast ? `
        <div class="toast-banner ${esc(this.toast.type)}">
          <span>${esc(this.toast.text)}</span>
          <span class="toast-close" id="toast-close">✕</span>
        </div>
      ` : ''}

      <div class="panel-body" id="popup-scroll-body">
        ${this.renderMonitorTab()}
      </div>

      ${this.renderUnbindModal()}
      ${this.renderSwitchModal()}
    `;

    // 恢复输入草稿与滚动位置
    const newBodyEl = document.getElementById('popup-scroll-body');
    if (newBodyEl && prevScrollTop > 0) newBodyEl.scrollTop = prevScrollTop;

    const restoreInput = (id: string, val: string | undefined) => {
      if (val === undefined) return;
      const el = document.getElementById(id) as HTMLInputElement | null;
      if (el) el.value = val;
    };
    restoreInput('new-slot-user', draftUser);
    restoreInput('new-slot-pwd', draftPwd);
    restoreInput('cfg-url', draftUrl);

    this.bindEvents();
  }

  private renderMonitorTab(): string {
    const config = this.config;
    const diag = this.diagSnap;
    const vs = diag?.videoState;
    const currentSmartedu = diag?.currentSmartedu || null;
    const slots = storage.getBoundAccounts();
    const activeSlot = slots.find((s) => currentSmartedu && s.smarteduUserId === currentSmartedu.user_id);
    const isCurrentSmarteduBound = Boolean(activeSlot);

    const vsStatusText = !this.tabConnected
      ? '需打开智慧平台页'
      : !vs?.hasVideo
      ? '等待进入视频课时...'
      : vs.paused
      ? '视频已暂停'
      : '正在学习监听中';
    const vsStatusColor = !this.tabConnected
      ? '#64748b'
      : !vs?.hasVideo
      ? '#eab308'
      : vs.paused
      ? '#ca8a04'
      : '#16a34a';

    const courseTitle = vs?.resourceInfo?.title || '-';
    const courseMeta = formatCourseMeta(vs?.resourceInfo);

    let slotsHtml = '';
    for (let i = 0; i < 3; i++) {
      const slot = slots[i];
      if (slot) {
        const isSlotActive = activeSlot && activeSlot.dofeeUsername === slot.dofeeUsername;
        slotsHtml += `
          <div class="slot-card ${isSlotActive ? 'active' : ''}">
            <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:4px;">
              <span style="font-weight:700;font-size:12px;color:#1e293b;">槽位 #${i + 1}：dofee2 [${esc(slot.dofeeUsername)}]</span>
              <span class="${isSlotActive ? 'slot-badge-active' : 'slot-badge-idle'}">
                ${isSlotActive ? '🟢 当前激活' : '⚪ 待命'}
              </span>
            </div>
            <div style="font-size:11px;color:#475569;margin-bottom:6px;">
              绑定智慧用户: <b style="color:#0f172a;">${esc(slot.smarteduDisplayName || '用户' + slot.smarteduUserId)}</b> (${esc(slot.smarteduUserId.slice(0, 8))}…)
            </div>
            <div style="display:flex;justify-content:flex-end;">
              <button class="btn btn-danger slot-unbind-btn" style="flex:0;min-width:88px;padding:4px 10px;font-size:11px;"
                data-username="${esc(slot.dofeeUsername)}"
                data-smartedu="${esc(slot.smarteduDisplayName || slot.smarteduUserId)}"
                data-token="${esc(slot.dofeeJwtToken)}">
                解绑该槽位
              </button>
            </div>
          </div>
        `;
      } else {
        const isFirstVacant = i === slots.length;
        const canBindCurrent = isFirstVacant && currentSmartedu && !isCurrentSmarteduBound;
        slotsHtml += `
          <div class="slot-card" style="border-style:dashed;">
            <div style="display:flex;justify-content:space-between;align-items:center;">
              <span style="font-weight:600;font-size:12px;color:#64748b;">槽位 #${i + 1} (空闲待绑)</span>
              <span class="slot-badge-idle">空闲</span>
            </div>
            ${canBindCurrent ? `
              <div style="margin-top:8px;padding-top:8px;border-top:1px dashed #cbd5e1;">
                <div style="font-size:11px;color:#0369a1;font-weight:600;margin-bottom:6px;">
                  绑定当前登录用户 [${esc(currentSmartedu!.display_name)}] 到该槽位:
                </div>
                <input type="text" class="input-field" id="new-slot-user" placeholder="输入 dofee2 学员用户名">
                <input type="password" class="input-field" id="new-slot-pwd" placeholder="输入 dofee2 账户密码">
                <button class="btn btn-primary" id="new-slot-bind-btn" style="width:100%;padding:6px 0;" ${this.busyActions.has('BIND_SLOT') ? 'disabled' : ''}>
                  ${this.busyActions.has('BIND_SLOT') ? '绑定处理中...' : '🔐 验证登录并建立一对一绑定'}
                </button>
              </div>
            ` : `
              <div style="font-size:11px;color:#94a3b8;margin-top:6px;">
                ${!this.tabConnected ? '请在智慧平台页面登录后绑定新槽位' : (!currentSmartedu ? '请先在智慧平台登录学生账号后绑定' : (isCurrentSmarteduBound ? '当前智慧平台账号已绑定其他槽位' : '等待前序槽位完成绑定'))}
              </div>
            `}
          </div>
        `;
      }
    }

    const wrongStatusText = diag ? diag.wrongSync.statusText : (config.syncWrongBook || config.syncMyExercises ? '已开启（打开智慧平台页运行）' : '已关闭 (请在上方勾选开启)');
    const wrongStatusColor = diag ? diag.wrongSync.statusColor : '#64748b';

    return `
      <!-- 课时状态 -->
      <div class="section">
        <div class="section-title">当前课时状态</div>
        <div class="info-row"><span>状态:</span><span class="info-val" id="monitor-status" style="color:${vsStatusColor};">${esc(vsStatusText)}</span></div>
        <div class="info-row"><span>课程标题:</span><span class="info-val" id="course-title" title="${esc(courseTitle)}">${esc(courseTitle)}</span></div>
        <div class="info-row"><span>学科/年级:</span><span class="info-val" id="course-meta">${esc(courseMeta)}</span></div>
        <div class="info-row"><span>播放进度:</span><span class="info-val" id="play-progress">${vs?.currentTime || 0}s / ${vs?.duration || 0}s</span></div>
        <div class="info-row"><span>真实有效学习:</span><span class="info-val" id="real-time" style="color:#16a34a;">${vs?.realPlayedSeconds || 0} 秒</span></div>
      </div>

      <!-- 错题本与我的习题同步 (可选) -->
      <div class="section">
        <div class="section-title">错题本与我的习题同步 (可选)</div>
        <div class="sync-opt-list">
          <label class="sync-opt-item">
            <input type="checkbox" id="opt-sync-wrong" ${config.syncWrongBook === true ? 'checked' : ''} />
            <span>同步错题本</span>
          </label>
          <label class="sync-opt-item">
            <input type="checkbox" id="opt-sync-exercise" ${config.syncMyExercises === true ? 'checked' : ''} />
            <span>同步我的习题</span>
          </label>
        </div>
        <div class="info-row"><span>同步状态:</span><span class="info-val" id="wrong-sync-status" style="color:${wrongStatusColor};">${esc(wrongStatusText)}</span></div>
        <div class="info-row"><span>已同步题数:</span><span class="info-val" id="wrong-sync-count">${diag ? diag.wrongSync.syncedCount : 0} 道</span></div>
        <div class="info-row"><span>最近同步:</span><span class="info-val" id="wrong-sync-time">${esc(diag ? diag.wrongSync.lastSyncTime : '-')}</span></div>
      </div>

      <!-- 多用户绑定 -->
      <div class="section">
        <div class="section-title">多用户绑定与自动激活 (最多 3 组)</div>
        <div class="info-row">
          <span>智慧平台当前用户:</span>
          <span class="info-val">
            ${currentSmartedu ? `${esc(currentSmartedu.display_name)} (${esc(currentSmartedu.user_id.slice(0, 8))}…)` : (this.tabConnected ? '未检测到登录' : '需打开智慧平台页')}
          </span>
        </div>
        <div class="info-row">
          <span>同步激活状态:</span>
          <span class="info-val">
            ${
              !this.tabConnected
                ? (config.dofeeUsername ? `<span style="color:#16a34a;">已配置: ${esc(config.dofeeUsername)}</span>` : '<span style="color:#64748b;">待连接智慧平台</span>')
                : !currentSmartedu
                ? '<span style="color:#64748b;">待登录智慧平台</span>'
                : activeSlot
                ? `<span style="color:#16a34a;font-weight:700;">🟢 已激活: ${esc(activeSlot.dofeeUsername)}</span>`
                : slots.length > 0
                ? '<span style="color:#d97706;font-weight:700;">🟠 未绑定(同步暂停)</span>'
                : '<span style="color:#d97706;">未建立绑定</span>'
            }
          </span>
        </div>
        <div style="margin-top:8px;">${slotsHtml}</div>
      </div>

      <!-- DOFFEE网站域名 / API 地址 -->
      <div class="section">
        <div class="section-title">DOFFEE网站域名 / API 地址</div>
        <input type="text" class="input-field" id="cfg-url" placeholder="请输入自建服务端地址，如 https://your-domain.example" value="${esc(config.dofeeApiBase || '')}">
        <div class="btn-group">
          <button class="btn btn-primary" id="save-url-btn">保存域名</button>
          <button class="btn btn-secondary" id="flush-btn" ${!this.tabConnected ? 'disabled' : ''}>冲刷 (${diag?.queueLength ?? 0})</button>
          ${config.dofeeJwtToken ? '<button class="btn btn-danger" id="logout-btn">退出当前激活</button>' : ''}
        </div>
      </div>

      <!-- 学习记录同步 -->
      <div class="section">
        <div class="section-title">学习记录同步</div>
        <div class="info-row"><span>同步游标:</span><span class="info-val" style="color:${diag?.studyCursor.color || '#64748b'};">${esc(diag?.studyCursor.text || (this.tabConnected ? '检测中...' : '需打开智慧平台页'))}</span></div>
      </div>
    `;
  }

  private renderUnbindModal(): string {
    if (!this.unbindModal) return '';
    const m = this.unbindModal;
    return `
      <div class="modal-overlay" id="unbind-overlay">
        <div class="modal-card">
          <div class="modal-title">🔐 解绑需要验证 dofee 账户密码</div>
          <div class="modal-desc">即将解除绑定：dofee2 账号 [${esc(m.username)}] ↔ 智慧平台 [${esc(m.smarteduName)}]。请输入 dofee 账户密码确认。</div>
          <input type="password" class="input-field" id="unbind-pwd-input" placeholder="dofee 账户密码" autocomplete="current-password" />
          <div class="modal-err">${esc(m.error)}</div>
          <div class="btn-group">
            <button class="btn btn-secondary" id="unbind-cancel-btn" ${m.busy ? 'disabled' : ''}>取消解绑</button>
            <button class="btn btn-danger" id="unbind-ok-btn" ${m.busy ? 'disabled' : ''}>${m.busy ? '验证解绑中...' : '验证并解绑'}</button>
          </div>
        </div>
      </div>
    `;
  }

  private renderSwitchModal(): string {
    if (!this.switchModal) return '';
    const p = this.switchModal.prompt;
    return `
      <div class="modal-overlay" id="switch-overlay">
        <div class="modal-card">
          <div class="modal-title">⚠️ 检测到智慧平台登录用户已变更！</div>
          <div class="modal-pill">上次写入用户：${esc(p.previous.display_name)}（ID ${esc(p.previous.user_id)}）</div>
          <div class="modal-pill warn">当前登录用户：${esc(p.current.display_name)}（ID ${esc(p.current.user_id)}）</div>
          <div class="modal-desc">继续将把「${esc(p.current.display_name)}」的学习数据写入当前 dofee 账号（${esc(p.action)}），且写入后不可回滚。确定继续吗？</div>
          <div class="btn-group">
            <button class="btn btn-secondary" id="switch-cancel-btn">取消导入</button>
            <button class="btn btn-danger" id="switch-ok-btn">继续导入（有风险）</button>
          </div>
        </div>
      </div>
    `;
  }

  private bindEvents(): void {
    const $ = (id: string) => document.getElementById(id);

    $('toast-close')?.addEventListener('click', () => {
      this.toast = null;
      this.render();
    });

    // 顶部重载生效
    $('top-reload-btn')?.addEventListener('click', async () => {
      await sendRuntimeMessage({ type: 'APPLY_EXTENSION_UPDATE' });
      if (this.tabConnected && this.activeTabId !== null) {
        setTimeout(() => {
          chrome.tabs.reload(this.activeTabId!).catch(() => {});
          window.close();
        }, 1200);
      } else {
        setTimeout(() => window.close(), 1200);
      }
    });

    // 学习监控 Tab 事件
    $('flush-btn')?.addEventListener('click', () => this.runTabAction('FLUSH_QUEUE'));

    $('save-url-btn')?.addEventListener('click', async () => {
      const val = ($('cfg-url') as HTMLInputElement | null)?.value.trim().replace(/\/+$/, '') || '';
      if (!val) {
        this.showToast('warn', '请输入有效的 API 地址');
        return;
      }
      let parsedUrl: URL;
      try {
        parsedUrl = new URL(val);
      } catch {
        this.showToast('warn', 'API 地址格式无效，需包含 http:// 或 https://');
        return;
      }
      if (typeof chrome !== 'undefined' && chrome.permissions?.request) {
        try {
          await chrome.permissions.request({ origins: [`${parsedUrl.origin}/*`] });
        } catch (e) {}
      }
      this.config = storage.saveConfig({ dofeeApiBase: val });
      this.showToast('success', `API 地址已更新: ${val}`);
      void this.notifyTabConfigChanged();
    });

    $('logout-btn')?.addEventListener('click', () => {
      this.config = storage.logout();
      this.showToast('info', '已挂起当前激活账号（槽位绑定关系仍保留）');
      void this.notifyTabConfigChanged();
    });

    // 错题/习题同步开关
    const toggleItems: Array<{ id: string; key: 'syncWrongBook' | 'syncMyExercises'; label: string; scope: 'wrong' | 'exercise' }> = [
      { id: 'opt-sync-wrong', key: 'syncWrongBook', label: '同步错题本', scope: 'wrong' },
      { id: 'opt-sync-exercise', key: 'syncMyExercises', label: '同步我的习题', scope: 'exercise' }
    ];
    for (const item of toggleItems) {
      const el = $(item.id) as HTMLInputElement | null;
      el?.addEventListener('change', async () => {
        const enabled = el.checked === true;
        this.config = storage.saveConfig({ [item.key]: enabled });
        this.showToast('info', `已${enabled ? '开启' : '关闭'}「${item.label}」`);
        const cfg = this.config;
        if (enabled && cfg.dofeeApiBase && cfg.dofeeJwtToken) {
          void sendRuntimeMessage({ type: 'TRIGGER_SILENT_SYNC', trigger: 'config_enabled' });
          await this.notifyTabConfigChanged({
            notifyProbe: true,
            runSilentScope: item.scope,
            trigger: 'config_enabled'
          });
        } else {
          await this.notifyTabConfigChanged();
        }
      });
    }

    // 槽位解绑（打开内联密码框）
    document.querySelectorAll('.slot-unbind-btn').forEach((btn) => {
      btn.addEventListener('click', (e) => {
        const target = e.currentTarget as HTMLElement;
        const username = target.getAttribute('data-username') || '';
        const smarteduName = target.getAttribute('data-smartedu') || '';
        const token = target.getAttribute('data-token') || '';
        if (!username) return;
        this.unbindModal = { username, smarteduName, token, error: '', busy: false };
        this.render();
        setTimeout(() => ($('unbind-pwd-input') as HTMLInputElement | null)?.focus(), 20);
      });
    });

    // 新槽位登录绑定
    const newSlotBindBtn = $('new-slot-bind-btn');
    const newSlotPwdEl = $('new-slot-pwd') as HTMLInputElement | null;
    newSlotPwdEl?.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') {
        e.preventDefault();
        newSlotBindBtn?.click();
      }
    });
    newSlotBindBtn?.addEventListener('click', async () => {
      if (!this.config?.dofeeApiBase?.trim()) {
        this.showToast('warn', '请先在下方「DOFFEE网站域名 / API 地址」中配置并保存服务端域名');
        return;
      }
      const u = ($('new-slot-user') as HTMLInputElement | null)?.value.trim() || '';
      const p = ($('new-slot-pwd') as HTMLInputElement | null)?.value || '';
      if (!u || !p) {
        this.showToast('warn', '请输入 dofee2 学员用户名与密码');
        return;
      }
      const identity = this.diagSnap?.currentSmartedu;
      if (!identity) {
        this.showToast('warn', '未检测到智慧平台登录态，请先登录智慧平台后再绑定');
        return;
      }
      const slots = storage.getBoundAccounts();
      if (slots.length >= 3) {
        this.showToast('warn', '已达到最大绑定数量（3 个槽位），请先解绑多余槽位');
        return;
      }
      if (slots.some((s) => s.dofeeUsername === u)) {
        this.showToast('warn', `dofee2 账号 [${u}] 已绑定在其他槽位，不能重复绑定`);
        return;
      }
      if (slots.some((s) => s.smarteduUserId === identity.user_id)) {
        this.showToast('warn', `当前智慧平台用户 [${identity.display_name}] 已绑定在其他槽位，不能重复绑定`);
        return;
      }

      this.busyActions.add('BIND_SLOT');
      this.render();
      try {
        const loginRes = await uploader.login(u, p, { noSaveToConfig: true });
        if (!loginRes.success || !loginRes.token) {
          this.showToast('error', `dofee2 登录校验失败: ${loginRes.error || '用户名或密码错误'}`);
          return;
        }
        const bindRes = await smarteduBinding.bind(identity, { token: loginRes.token, username: u });
        if (!bindRes.ok) {
          this.showToast('error', `绑定失败: ${bindRes.error || bindRes.code || '未知错误'}`);
          return;
        }
        storage.saveBoundSlot({
          dofeeUsername: u,
          dofeeJwtToken: loginRes.token,
          dofeeRefreshToken: loginRes.refreshToken || '',
          smarteduUserId: identity.user_id,
          smarteduDisplayName: identity.display_name || '',
          boundAt: new Date().toISOString()
        });
        storage.activateSlotBySmarteduUserId(identity.user_id);
        this.config = storage.getConfig();
        this.showToast('success', `绑定成功！[${identity.display_name}] ↔ dofee2 [${u}]`);

        const syncCfg = storage.getConfig();
        if (syncCfg.syncWrongBook === true || syncCfg.syncMyExercises === true) {
          void sendRuntimeMessage({ type: 'TRIGGER_SILENT_SYNC' });
        }
        await this.notifyTabConfigChanged({
          runSilentScope: (syncCfg.syncWrongBook || syncCfg.syncMyExercises) ? 'wrong' : undefined,
          trigger: 'dofee_login',
          syncCatalog: true
        });
      } catch (err: any) {
        this.showToast('error', `绑定异常: ${err?.message || err}`);
      } finally {
        this.busyActions.delete('BIND_SLOT');
        this.render();
      }
    });

    // 内联解绑弹层事件
    $('unbind-cancel-btn')?.addEventListener('click', () => {
      this.unbindModal = null;
      this.render();
    });
    const submitUnbind = async () => {
      if (!this.unbindModal || this.unbindModal.busy) return;
      const pwd = ($('unbind-pwd-input') as HTMLInputElement | null)?.value || '';
      if (!pwd.trim()) {
        this.unbindModal.error = '密码不能为空';
        this.render();
        return;
      }
      this.unbindModal.busy = true;
      this.unbindModal.error = '';
      this.render();
      try {
        const res = await smarteduBinding.unbind(pwd, {
          token: this.unbindModal.token,
          username: this.unbindModal.username
        });
        if (res.ok) {
          const removedUser = this.unbindModal.username;
          storage.removeBoundSlot(removedUser);
          this.config = storage.getConfig();
          this.unbindModal = null;
          this.showToast('success', `槽位 [${removedUser}] 已成功解绑`);
          await this.notifyTabConfigChanged();
        } else {
          this.unbindModal.busy = false;
          this.unbindModal.error = `解绑失败: ${res.error || res.code || '密码校验未通过'}`;
          this.render();
        }
      } catch (err: any) {
        this.unbindModal.busy = false;
        this.unbindModal.error = `网络错误: ${err?.message || err}`;
        this.render();
      }
    };
    $('unbind-ok-btn')?.addEventListener('click', submitUnbind);
    $('unbind-pwd-input')?.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') {
        e.preventDefault();
        void submitUnbind();
      }
    });

    // 内联用户切换确认弹层事件
    $('switch-cancel-btn')?.addEventListener('click', () => {
      this.switchModal = null;
      this.showToast('info', '已取消导入（未产生任何写入）');
    });
    $('switch-ok-btn')?.addEventListener('click', async () => {
      if (!this.switchModal) return;
      const { retryAction, retryPayload } = this.switchModal;
      this.switchModal = null;
      await this.runTabAction(retryAction, { ...retryPayload, confirmedUserSwitch: true });
    });
  }
}

const appRoot = document.getElementById('app');
if (appRoot) {
  const controller = new PopupController(appRoot);
  void controller.init();
}
