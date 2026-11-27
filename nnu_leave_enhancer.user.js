// ==UserScript==
// @name         NNU LeaveFaster
// @namespace    https://github.com/Simple53/NNU_LeaveFaster
// @version      1.1.1
// @description  南师大请假审批工作台增强：HeroUI v3 风格界面、热路径加速、移动端快捷审批、证明附件预览灯箱、突破10条批量限制与主表分页同步
// @author       Antigravity
// @homepageURL  https://github.com/Simple53/NNU_LeaveFaster
// @supportURL   https://github.com/Simple53/NNU_LeaveFaster/issues
// @icon         data:image/svg+xml;base64,PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHZpZXdCb3g9IjAgMCA2NCA2NCIgZmlsbD0ibm9uZSI+CiAgPHRpdGxlPk5OVSBMZWF2ZUZhc3RlcjwvdGl0bGU+CiAgPHJlY3Qgd2lkdGg9IjY0IiBoZWlnaHQ9IjY0IiByeD0iMTQiIGZpbGw9IiMxMTE4MjciLz4KICA8cGF0aCBkPSJNMjAgMTNoMThsOSA5djI3YTMgMyAwIDAgMS0zIDNIMjBhMyAzIDAgMCAxLTMtM1YxNmEzIDMgMCAwIDEgMy0zWiIgZmlsbD0id2hpdGUiLz4KICA8cGF0aCBkPSJNMzcgMTN2MTBoMTAiIGZpbGw9IiNEQ0U2RjUiLz4KICA8cGF0aCBkPSJtMjQgMzUgNiA2IDEyLTEzIiBzdHJva2U9IiMyNTYzRUIiIHN0cm9rZS13aWR0aD0iNC41IiBzdHJva2UtbGluZWNhcD0icm91bmQiIHN0cm9rZS1saW5lam9pbj0icm91bmQiLz4KPC9zdmc+Cg==
// @match        https://ehallapp.nnu.edu.cn/qljfw/sys/lwNjnuStuLeaveManagement/*
// @match        *://ehallapp.nnu.edu.cn/*
// @match        *://*/*/sys/lwNjnuStuLeaveManagement/*
// @match        *://*/*LeaveManagement*/*
// @run-at       document-start
// @grant        unsafeWindow
// @allFrames    true
// ==/UserScript==

/*
 * Unslop & HeroUI v3 Design Direction:
 * - Product: Leave-approval workspace enhancer and attachment inspector for NNU faculty and counselors.
 * - Character: calm, exact, tactile.
 * - World: University administrative desk and precision instruments — quiet ink-graphite neutral surfaces (oklch ramp).
 * - Moments: (1) Top review action bar with tactile keycaps & one-tap approval; (2) Inline proof filmstrip & inspection lightbox.
 * - Signature: Tactile monospace keycaps (.nnu-kbd) and tabular-numeral status readouts (tabular-nums).
 */

(function () {
    'use strict';

    // 同域匹配仍可能覆盖流程图 iframe，必须在任何样式、事件或网络修改前退出。
    if (/flowDiagram/i.test(location.href)) return;

    const win = typeof unsafeWindow !== 'undefined' ? unsafeWindow : window;
    const isTopWindow = (window.self === window.top);

    // ================= 预编译高频正则 (fast-anything 热路径优化) =================
    const RE_FAST_PAGE_CHECK = /pageSize|rows|limit/i;
    const RE_JSON_PAGESIZE = /("(?:[\w*]*pageSize|rows|limit)"\s*:\s*)("?)(\d+)\2/gi;
    const RE_KV_ENTRY = /(^|[?&])([^=?&#]+)=([^&#]*)/g;
    const RE_PAGE_KEY = /^(?:[\w*]*pageSize|rows|limit)$/i;
    const RE_QUERY_TASKS = /queryUserTasks\.do(?:[?#]|$)/i;
    const RE_QUERY_TASKS_END = /queryUserTasks\.do$/i;
    const RE_REVIEW_API = /getReviewData|review\.do/i;
    const RE_ATTACHMENT_API = /getUploadedAttachment\.do|getAttachment|queryAttachment/i;
    const RE_IMAGE_EXT = /\.(?:jpe?g|png|gif|webp|bmp)(?:[?#]|$)/i;
    const RE_DOWNLOAD_LINK = /download|attachment|getFile|previewFile|sys\/emapcomponent\/file/i;
    const RE_JSON_START = /^\s*[\[{]/;
    const RE_OBJ_START = /^\s*\{/;
    const RE_LIMIT_10 = /(?:超过|最多|上限).*?10|10.*?(?:条|个)/i;

    // ================= 配置与持久化状态 =================
    const STORAGE_KEY_PAGESIZE = 'nnu_leave_page_size';
    const STORAGE_KEY_AUTO_OPINION = 'nnu_leave_auto_opinion';
    const STORAGE_KEY_TALL_VIEW = 'nnu_leave_tall_view';

    let currentCustomPageSize = parseInt(localStorage.getItem(STORAGE_KEY_PAGESIZE) || '20', 10);
    if (![10, 20, 50, 100].includes(currentCustomPageSize)) currentCustomPageSize = 20;
    const autoOpinionText = localStorage.getItem(STORAGE_KEY_AUTO_OPINION) || '同意';
    let isTallView = localStorage.getItem(STORAGE_KEY_TALL_VIEW) !== 'false';

    let lastInteractTime = 0;
    let _batchSelectionLock = false;
    let _domObserverRaf = null;
    let _bhTipUnlocked = false;
    let _bhUtilTipUnlocked = false;
    let latestAttachments = [];

    const requestLogs = [];
    function addRequestLog(actionName, durationMs, details, isSuccess = true) {
        if (!isTopWindow) return;
        requestLogs.unshift({ time: new Date().toLocaleTimeString(), action: actionName, duration: durationMs, details, isSuccess });
        if (requestLogs.length > 15) requestLogs.pop();
        updateLogPanelUI();
    }

    // ================= 统一 Lucide 线性图标集 (16px, 1.5px stroke, 零 Emoji) =================
    const svgIcon = paths => `<svg class="nnu-icon" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${paths}</svg>`;
    const ICON_CHECK_DOC = svgIcon('<path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/><path d="m9 15 2 2 4-4"/>');
    const ICON_CLOSE = svgIcon('<line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>');
    const ICON_REFRESH = svgIcon('<path d="M21 12a9 9 0 0 0-9-9 9.75 9.75 0 0 0-6.74 2.74L3 8"/><path d="M3 3v5h5"/><path d="M3 12a9 9 0 0 0 9 9 9.75 9.75 0 0 0 6.74-2.74L21 16"/><path d="M16 16h5v5"/>');
    const ICON_CHECK = svgIcon('<polyline points="20 6 9 17 4 12"/>');
    const ICON_EDIT = svgIcon('<path d="M12 20h9"/><path d="M16.5 3.5a2.12 2.12 0 0 1 3 3L7 19l-4 1 1-4Z"/>');
    const ICON_IMAGE = svgIcon('<rect width="18" height="18" x="3" y="3" rx="2" ry="2"/><circle cx="9" cy="9" r="2"/><path d="m21 15-3.086-3.086a2 2 0 0 0-2.828 0L6 21"/>');
    const ICON_ROTATE_CCW = svgIcon('<path d="M3 12a9 9 0 1 0 9-9 9.75 9.75 0 0 0-6.74 2.74L3 8"/><path d="M3 3v5h5"/>');
    const ICON_ROTATE_CW = svgIcon('<path d="M21 12a9 9 0 1 1-9-9c2.52 0 4.93 1 6.74 2.74L21 8"/><path d="M21 3v5h-5"/>');
    const ICON_ZOOM_IN = svgIcon('<circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/><line x1="11" y1="8" x2="11" y2="14"/><line x1="8" y1="11" x2="14" y2="11"/>');
    const ICON_ZOOM_OUT = svgIcon('<circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/><line x1="8" y1="11" x2="14" y2="11"/>');
    const ICON_CHEVRON_LEFT = svgIcon('<path d="m15 18-6-6 6-6"/>');
    const ICON_CHEVRON_RIGHT = svgIcon('<path d="m9 18 6-6-6-6"/>');
    const ICON_EXTERNAL = svgIcon('<path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"/><polyline points="15 3 21 3 21 9"/><line x1="10" y1="14" x2="21" y2="3"/>');
    const ICON_COPY = svgIcon('<rect width="14" height="14" x="8" y="8" rx="2" ry="2"/><path d="M4 16c-1.1 0-2-.9-2-2V4c0-1.1.9-2 2-2h10c1.1 0 2 .9 2 2"/>');

    // ================= 1. 网络拦截层 =================
    function rewritePageParams(bodyOrUrl) {
        if (!bodyOrUrl) return bodyOrUrl;
        try {
            if (typeof bodyOrUrl === 'string') {
                if (!RE_FAST_PAGE_CHECK.test(bodyOrUrl) && bodyOrUrl.indexOf('%') === -1) {
                    return bodyOrUrl;
                }
                let res = bodyOrUrl.replace(RE_JSON_PAGESIZE,
                    (_, prefix, quote) => `${prefix}${quote}${currentCustomPageSize}${quote}`);
                if (!RE_JSON_START.test(res)) {
                    const kvRegex = new RegExp(RE_KV_ENTRY.source, 'g');
                    res = res.replace(kvRegex, (entry, sep, key, value) => {
                        try {
                            const name = decodeURIComponent(key.replace(/\+/g, ' '));
                            if (RE_PAGE_KEY.test(name)) {
                                return `${sep}${key}=${currentCustomPageSize}`;
                            }
                            if (value.indexOf('%') !== -1 || RE_JSON_START.test(value)) {
                                const decoded = decodeURIComponent(value.replace(/\+/g, ' '));
                                if (RE_JSON_START.test(decoded)) {
                                    const rewritten = rewritePageParams(decoded);
                                    if (rewritten !== decoded) return `${sep}${key}=${encodeURIComponent(rewritten)}`;
                                }
                            }
                        } catch (e) { /* 保留无法解码的原参数 */ }
                        return entry;
                    });
                }
                return res;
            }
            if ((win.FormData && bodyOrUrl instanceof win.FormData) || (win.URLSearchParams && bodyOrUrl instanceof win.URLSearchParams)) {
                for (const k of [...bodyOrUrl.keys()]) {
                    if (RE_PAGE_KEY.test(k)) bodyOrUrl.set(k, String(currentCustomPageSize));
                    else {
                        const value = bodyOrUrl.get(k);
                        if (typeof value === 'string' && RE_JSON_START.test(value)) bodyOrUrl.set(k, rewritePageParams(value));
                    }
                }
                return bodyOrUrl;
            }
        } catch (e) {}
        return bodyOrUrl;
    }

    function summarizePageResponse(value, depth = 0) {
        if (Array.isArray(value)) return { count: value.length };
        if (!value || typeof value !== 'object' || depth > 5) return undefined;
        const summary = {};
        for (const [key, child] of Object.entries(value)) {
            if (/^(pageSize|pageNumber|pageNum|total|totalSize|totalCount|recordsTotal)$/i.test(key) && /^\d+$/.test(String(child))) summary[key] = Number(child);
            else if (child && typeof child === 'object') {
                const nested = summarizePageResponse(child, depth + 1);
                if (nested) summary[key] = nested;
            }
        }
        return Object.keys(summary).length ? summary : undefined;
    }

    function summarizePageRequest(value) {
        if (!value) return {};
        try {
            if (typeof value === 'string' && RE_OBJ_START.test(value)) return summarizePageResponse(JSON.parse(value)) || {};
            const entries = typeof value === 'string' ? new win.URLSearchParams(value.includes('?') ? value.split('?')[1].split('#')[0] : value) : value;
            const summary = {};
            for (const [key, item] of entries) {
                if (/^(?:[\w*]*pageSize|pageNumber|pageNum|pagenum|rows|limit|offset|start)$/i.test(key) && /^\d+$/.test(item)) summary[key] = Number(item);
                else if (typeof item === 'string' && RE_OBJ_START.test(item)) summary[key] = summarizePageResponse(JSON.parse(item)) || {};
            }
            return summary;
        } catch (e) { return {}; }
    }

    function extractAttachmentsFromPayload(payload, baseOrigin = '') {
        const results = [];
        const seenUrls = new Set();

        function resolveUrl(raw) {
            if (!raw || typeof raw !== 'string') return '';
            const trimmed = raw.trim();
            if (!trimmed || trimmed.startsWith('javascript:') || trimmed.startsWith('data:text')) return '';
            if (/^https?:\/\//i.test(trimmed) || trimmed.startsWith('blob:') || trimmed.startsWith('data:image')) return trimmed;
            if (baseOrigin) {
                if (trimmed.startsWith('/')) return `${baseOrigin.replace(/\/$/, '')}${trimmed}`;
                return `${baseOrigin.replace(/\/$/, '')}/${trimmed}`;
            }
            return trimmed;
        }

        function walk(node, depth = 0) {
            if (!node || typeof node !== 'object' || depth > 6) return;
            if (Array.isArray(node)) {
                for (const item of node) walk(item, depth + 1);
                return;
            }
            const name = String(node.fileName || node.name || node.title || node.ATTACHMENT_NAME || node.FILE_NAME || '').trim();
            const rawUrl = node.previewUrl || node.fileUrl || node.downloadUrl || node.url || node.src || node.FILE_URL || node.ATTACHMENT_URL || '';
            const fileToken = node.token || node.fileToken || node.fileId || node.FILE_ID || node.id || '';

            let candidateUrl = resolveUrl(rawUrl);
            if (!candidateUrl && fileToken && (RE_IMAGE_EXT.test(name) || node.fileUrl !== undefined || node.fileName !== undefined)) {
                candidateUrl = resolveUrl(`/qljfw/sys/emapcomponent/file/getAttachmentFile/${encodeURIComponent(String(fileToken))}.do`);
            }

            if (candidateUrl && (RE_IMAGE_EXT.test(name) || RE_IMAGE_EXT.test(candidateUrl) || RE_DOWNLOAD_LINK.test(candidateUrl))) {
                if (!seenUrls.has(candidateUrl)) {
                    seenUrls.add(candidateUrl);
                    results.push({ name: name || `附件 ${results.length + 1}`, url: candidateUrl });
                }
            }

            for (const val of Object.values(node)) {
                if (val && typeof val === 'object') walk(val, depth + 1);
            }
        }

        walk(payload, 0);
        return results;
    }

    const _origOpen = win.XMLHttpRequest.prototype.open;
    const _origSend = win.XMLHttpRequest.prototype.send;

    win.XMLHttpRequest.prototype.open = function (method, url, async, user, password) {
        this._startTime = Date.now();
        if (typeof url === 'string' && RE_QUERY_TASKS.test(url)) url = rewritePageParams(url);
        this._requestUrl = url;
        return _origOpen.call(this, method, url, async, user, password);
    };

    win.XMLHttpRequest.prototype.send = function (body) {
        const t0 = Date.now();
        const reqUrl = this._requestUrl || '';
        const requestedSize = currentCustomPageSize;
        const isQueryTasks = RE_QUERY_TASKS.test(reqUrl);
        if (body && isQueryTasks) {
            body = rewritePageParams(body);
        }
        const sentPaging = isQueryTasks
            ? { url: summarizePageRequest(reqUrl), body: summarizePageRequest(body) } : null;
        this.addEventListener('loadend', () => {
            const dur = Date.now() - t0;
            const name = reqUrl.split('?')[0].split('/').pop() || '接口';
            let details = `${this.status}`;
            let parsedJson = null;

            if (RE_QUERY_TASKS_END.test(name) || RE_ATTACHMENT_API.test(name) || RE_REVIEW_API.test(name)) {
                try {
                    parsedJson = this.responseType === 'json' ? this.response : JSON.parse(this.responseText);
                } catch (e) {}
            }

            if (RE_QUERY_TASKS_END.test(name)) {
                details += ` | 设置行数:${requestedSize} | 请求分页:${JSON.stringify(sentPaging)}`;
                details += parsedJson
                    ? ` | 返回分页:${JSON.stringify(summarizePageResponse(parsedJson) || {})}`
                    : ' | 返回内容不是可解析的 JSON';
                setTimeout(() => {
                    apply75vhHeight();
                    updateBatchCountUI();
                }, 120);
            }

            if (parsedJson && (RE_ATTACHMENT_API.test(name) || RE_REVIEW_API.test(name))) {
                const extracted = extractAttachmentsFromPayload(parsedJson, location.origin);
                if (extracted.length) {
                    latestAttachments = extracted;
                    scheduleDomEnhancements();
                }
            }

            if (name.endsWith('.do')) addRequestLog(name, dur, details, this.status === 200);
            if (RE_REVIEW_API.test(name)) dismissMasks(true);
            else dismissMasks(false);
        });
        return _origSend.call(this, body);
    };

    if (win.fetch) {
        const _origFetch = win.fetch;
        win.fetch = function (input, init) {
            const t0 = Date.now();
            const reqUrl = typeof input === 'string' ? input : (input && input.url || '');
            if (RE_QUERY_TASKS.test(reqUrl)) {
                if (typeof input === 'string') input = rewritePageParams(input);
                if (init && init.body) init = { ...init, body: rewritePageParams(init.body) };
            }
            return _origFetch.call(this, input, init).then(res => {
                const dur = Date.now() - t0;
                const name = reqUrl.split('?')[0].split('/').pop() || 'Fetch';
                if (name.endsWith('.do')) addRequestLog(name, dur, `${res.status}`);
                if (RE_REVIEW_API.test(name)) dismissMasks(true);
                else dismissMasks(false);
                return res;
            }).catch(err => { dismissMasks(false); throw err; });
        };
    }

    // ================= 2. 样式系统 (HeroUI v3 oklch 变量 + Unslop 4px 网格与嵌套圆角) =================
    function injectStyles() {
        if (document.getElementById('nnu-leavefaster-styles')) return;
        const css = `
            :root {
                --heroui-bg: oklch(0.985 0.002 248);
                --heroui-surface: oklch(1 0 0);
                --heroui-surface-2: oklch(0.962 0.004 248);
                --heroui-surface-3: oklch(0.935 0.006 248);
                --heroui-fg: oklch(0.18 0.01 248);
                --heroui-fg-secondary: oklch(0.42 0.015 248);
                --heroui-fg-muted: oklch(0.54 0.015 248);
                --heroui-border: oklch(0.18 0.01 248 / 0.08);
                --heroui-border-strong: oklch(0.18 0.01 248 / 0.14);
                --heroui-accent: oklch(0.55 0.19 254);
                --heroui-accent-hover: oklch(0.49 0.19 254);
                --heroui-accent-fg: oklch(0.99 0 0);
                --heroui-success: oklch(0.56 0.15 148);
                --heroui-warning: oklch(0.64 0.15 65);
                --heroui-danger: oklch(0.55 0.19 25);
                --heroui-radius-panel: 16px;
                --heroui-radius-card: 12px;
                --heroui-radius-control: 8px;
                --heroui-radius-kbd: 6px;
                --heroui-shadow-panel: 0 8px 24px rgba(15, 23, 42, 0.08), 0 1px 2px rgba(15, 23, 42, 0.04);
                --heroui-shadow-sm: 0 1px 2px rgba(15, 23, 42, 0.05);
                --heroui-font-sans: "Inter", "Geist", -apple-system, BlinkMacSystemFont, "PingFang SC", "Microsoft YaHei", sans-serif;
                --heroui-font-mono: "JetBrains Mono", "Geist Mono", "IBM Plex Mono", Consolas, monospace;
            }

            .sc-animated, .bh-animated-doubleTime, .bh-single-animate, .waves-effect {
                transition: none !important;
                animation: none !important;
            }
            .bh-header-bg, .bh-headerBar, .bh-btn-primary, .bh-btn {
                background-image: none !important;
            }

            /* ===== 主表大视窗 (仅作用于已挂载的 .nnu-main-grid) ===== */
            .nnu-tall-view .nnu-main-grid {
                height: 75vh !important;
                min-height: 640px !important;
                max-height: 85vh !important;
            }

            /* ===== 审核详情弹窗高度自适应 ===== */
            .bh-paper-pile-dialog,
            .bh-paper-pile-dialog-dialog,
            .bh-card-lv4.bh-dialog-con,
            .bh-window,
            .bh-dialog,
            .bh-pop,
            .el-dialog,
            .bh-paper-dialog {
                height: auto !important;
                min-height: auto !important;
                border-radius: var(--heroui-radius-card) !important;
                box-shadow: var(--heroui-shadow-panel) !important;
                overflow: visible !important;
            }

            .bh-paper-pile-dialog-body,
            .bh-paper-pile-dialog-dialog,
            .bh-paper-pile-dialog .content,
            .bh-paper-pile-dialog .bh-paper,
            .bh-paper-pile-dialog form,
            .bh-paper-pile-dialog .emap-form,
            .bh-card-lv4.bh-dialog-con .bh-dialog-center,
            .bh-window-content,
            .bh-dialog .bh-dialog-center,
            .el-dialog__body {
                height: auto !important;
                min-height: auto !important;
                max-height: none !important;
                overflow-y: visible !important;
                padding: 12px 16px !important;
            }

            .bh-form-group, .bh-form-row, .el-form-item {
                height: auto !important;
                min-height: auto !important;
                margin-bottom: 4px !important;
                padding-top: 2px !important;
                padding-bottom: 2px !important;
            }

            .bh-paper-pile-dialog [data-action="grid"],
            .bh-card-lv4 [data-action="grid"],
            .bh-window [data-action="grid"],
            .bh-dialog [data-action="grid"] {
                height: auto !important;
                min-height: auto !important;
                max-height: none !important;
            }

            /* ===== 流转信息完整展示 ===== */
            :is(.emap-flow-comment, .emap-flow-comment-m, .bh-flow-comment, [data-role="flow-comment"]),
            :is(.emap-flow-comment, .emap-flow-comment-m, .bh-flow-comment, [data-role="flow-comment"]) :is(.emap-flow-comment-item, .content) {
                height: auto !important;
                min-height: 0 !important;
                max-height: none !important;
                overflow: visible !important;
                -webkit-line-clamp: unset !important;
                line-clamp: unset !important;
                white-space: normal !important;
                text-overflow: clip !important;
                font-size: 14px !important;
                line-height: 1.6 !important;
            }

            /* ===== HeroUI v3 Compound Card: 置顶审批工作区 ===== */
            .nnu-top-highlight {
                background: var(--heroui-surface) !important;
                border: 1px solid var(--heroui-border-strong) !important;
                border-left: 3px solid var(--heroui-accent) !important;
                border-radius: var(--heroui-radius-card) !important;
                padding: 16px !important;
                margin-bottom: 12px !important;
                box-shadow: var(--heroui-shadow-sm) !important;
            }
            .nnu-top-highlight .bh-form-label,
            .nnu-top-highlight label {
                color: var(--heroui-fg) !important;
                font-weight: 500 !important;
            }
            .nnu-quick-approve-bar {
                display: flex;
                flex-wrap: wrap;
                align-items: center;
                justify-content: space-between;
                gap: 8px;
                margin-bottom: 12px;
                padding-bottom: 12px;
                border-bottom: 1px solid var(--heroui-border);
                font-family: var(--heroui-font-sans);
            }
            .nnu-quick-actions {
                display: flex;
                flex-wrap: wrap;
                gap: 8px;
            }

            /* ===== HeroUI v3 Semantic Buttons ===== */
            .nnu-btn, .nnu-quick-btn {
                font-family: var(--heroui-font-sans);
                font-size: 13px;
                font-weight: 500;
                line-height: 20px;
                height: 36px;
                padding: 0 12px;
                border-radius: var(--heroui-radius-control);
                border: 1px solid transparent;
                cursor: pointer;
                display: inline-flex;
                align-items: center;
                justify-content: center;
                gap: 8px;
                user-select: none;
                white-space: nowrap;
                box-sizing: border-box;
                font-variant-numeric: tabular-nums;
            }
            .nnu-btn--sm {
                height: 32px;
                padding: 0 10px;
                font-size: 12px;
            }
            .nnu-btn--primary, .nnu-quick-btn-primary {
                background: var(--heroui-accent) !important;
                color: var(--heroui-accent-fg) !important;
                border-color: var(--heroui-accent) !important;
            }
            .nnu-btn--primary:hover, .nnu-quick-btn-primary:hover {
                background: var(--heroui-accent-hover) !important;
            }
            .nnu-btn--secondary, .nnu-btn-secondary, .nnu-quick-btn-outline {
                background: var(--heroui-surface-2) !important;
                color: var(--heroui-fg) !important;
                border-color: var(--heroui-border-strong) !important;
            }
            .nnu-btn--secondary:hover, .nnu-btn-secondary:hover, .nnu-quick-btn-outline:hover {
                background: var(--heroui-surface-3) !important;
            }
            .nnu-btn--ghost {
                background: transparent !important;
                color: var(--heroui-fg-secondary) !important;
                border-color: transparent !important;
            }
            .nnu-btn--ghost:hover {
                background: var(--heroui-surface-2) !important;
                color: var(--heroui-fg) !important;
            }
            .nnu-icon {
                flex-shrink: 0;
                color: currentColor;
            }

            /* ===== Signature Detail: Tactile Keycaps (.nnu-kbd) ===== */
            .nnu-kbd-group {
                display: inline-flex;
                align-items: center;
                gap: 4px;
                font-size: 12px;
                color: var(--heroui-fg-muted);
            }
            .nnu-kbd {
                display: inline-flex;
                align-items: center;
                justify-content: center;
                min-width: 20px;
                height: 20px;
                padding: 0 6px;
                font-family: var(--heroui-font-mono);
                font-size: 11px;
                font-weight: 500;
                line-height: 1;
                color: var(--heroui-fg-secondary);
                background: var(--heroui-surface-2);
                border: 1px solid var(--heroui-border-strong);
                border-radius: var(--heroui-radius-kbd);
                box-shadow: inset 0 -1px 0 rgba(0, 0, 0, 0.08);
            }

            /* ===== HeroUI v3 Compound Card: 证明附件预览胶片条 ===== */
            .nnu-attachment-bar {
                background: var(--heroui-surface);
                border: 1px solid var(--heroui-border-strong);
                border-radius: var(--heroui-radius-card);
                padding: 12px 16px;
                margin: 8px 0 12px 0;
                font-family: var(--heroui-font-sans);
            }
            .nnu-attachment-header {
                font-size: 13px;
                font-weight: 500;
                color: var(--heroui-fg);
                margin-bottom: 8px;
                display: flex;
                justify-content: space-between;
                align-items: center;
            }
            .nnu-attachment-title {
                display: inline-flex;
                align-items: center;
                gap: 8px;
                color: var(--heroui-fg);
            }
            .nnu-attachment-count {
                font-family: var(--heroui-font-mono);
                font-size: 12px;
                color: var(--heroui-fg-muted);
                font-variant-numeric: tabular-nums;
            }
            .nnu-attachment-list {
                display: flex;
                flex-wrap: wrap;
                gap: 8px;
            }
            .nnu-att-card {
                display: inline-flex;
                align-items: center;
                gap: 8px;
                padding: 4px 8px 4px 4px;
                background: var(--heroui-surface-2);
                border: 1px solid var(--heroui-border);
                border-radius: var(--heroui-radius-control);
                cursor: pointer;
                max-width: 240px;
            }
            .nnu-att-card:hover {
                background: var(--heroui-surface-3);
                border-color: var(--heroui-border-strong);
            }
            .nnu-att-thumb {
                width: 40px;
                height: 40px;
                object-fit: cover;
                border-radius: 6px;
                background: var(--heroui-surface-3);
                flex-shrink: 0;
            }
            .nnu-att-name {
                font-size: 12px;
                color: var(--heroui-fg-secondary);
                overflow: hidden;
                text-overflow: ellipsis;
                white-space: nowrap;
            }

            /* ===== 附件全屏检查灯箱 ===== */
            #nnu-lightbox {
                position: fixed;
                inset: 0;
                background: rgba(15, 15, 16, 0.92);
                z-index: 10000001;
                display: none;
                flex-direction: column;
                align-items: center;
                justify-content: center;
                padding: 16px;
                touch-action: none;
                font-family: var(--heroui-font-sans);
            }
            #nnu-lightbox.show { display: flex; }
            #nnu-lb-stage {
                flex: 1;
                width: 100%;
                display: flex;
                align-items: center;
                justify-content: center;
                overflow: hidden;
            }
            #nnu-lb-img {
                max-width: 92vw;
                max-height: 76vh;
                object-fit: contain;
                border-radius: var(--heroui-radius-control);
                user-select: none;
                -webkit-user-drag: none;
            }
            #nnu-lb-caption {
                color: #a1a1a6;
                font-size: 13px;
                margin-top: 8px;
                text-align: center;
                font-variant-numeric: tabular-nums;
            }
            #nnu-lb-toolbar {
                display: flex;
                flex-wrap: wrap;
                gap: 8px;
                justify-content: center;
                padding: 8px 12px;
                background: #19191b;
                border: 1px solid rgba(255, 255, 255, 0.08);
                border-radius: var(--heroui-radius-card);
                margin-top: 12px;
            }
            .nnu-lb-btn {
                background: #232325;
                color: #ededed;
                border: 1px solid rgba(255, 255, 255, 0.08);
                border-radius: var(--heroui-radius-control);
                height: 36px;
                padding: 0 12px;
                font-size: 13px;
                font-weight: 500;
                cursor: pointer;
                display: inline-flex;
                align-items: center;
                gap: 6px;
            }
            .nnu-lb-btn:hover { background: #2e2e32; }
            .nnu-lb-btn--danger { color: #f87171; }

            /* ===== 右下角工作台触发器 & HeroUI v3 浮动面板 ===== */
            #nnu-ball {
                position: fixed;
                bottom: 24px;
                right: 24px;
                height: 36px;
                padding: 0 12px;
                background: #171717 !important;
                color: #ededed !important;
                border: 1px solid rgba(255, 255, 255, 0.12);
                border-radius: var(--heroui-radius-control);
                box-shadow: var(--heroui-shadow-panel) !important;
                display: flex;
                align-items: center;
                gap: 8px;
                font-family: var(--heroui-font-sans);
                font-size: 13px;
                font-weight: 500;
                cursor: pointer;
                z-index: 9999999;
                user-select: none;
            }
            #nnu-ball:hover { background: #232325 !important; }
            .nnu-status-dot {
                width: 6px;
                height: 6px;
                border-radius: 50%;
                background: #4cc38a;
                flex-shrink: 0;
            }

            #nnu-ball-panel {
                position: fixed;
                bottom: 68px;
                right: 24px;
                width: 320px;
                max-width: calc(100vw - 24px);
                box-sizing: border-box;
                background: var(--heroui-surface);
                border: 1px solid var(--heroui-border-strong);
                border-radius: var(--heroui-radius-panel);
                box-shadow: var(--heroui-shadow-panel) !important;
                padding: 16px;
                font-family: var(--heroui-font-sans);
                font-size: 14px;
                line-height: 20px;
                color: var(--heroui-fg);
                z-index: 9999999;
                display: none;
                flex-direction: column;
                gap: 12px;
            }
            #nnu-ball-panel.show { display: flex; }

            .heroui-card__header {
                display: flex;
                justify-content: space-between;
                align-items: center;
                padding-bottom: 12px;
                border-bottom: 1px solid var(--heroui-border);
            }
            .heroui-card__title {
                font-size: 14px;
                font-weight: 600;
                color: var(--heroui-fg);
                display: flex;
                align-items: center;
                gap: 8px;
            }
            .heroui-card__meta {
                font-family: var(--heroui-font-mono);
                font-size: 11px;
                font-weight: 400;
                color: var(--heroui-fg-muted);
            }
            .heroui-row {
                display: flex;
                justify-content: space-between;
                align-items: center;
                gap: 8px;
                min-height: 36px;
            }
            .heroui-label {
                font-size: 13px;
                font-weight: 500;
                color: var(--heroui-fg-secondary);
            }
            .heroui-surface-box {
                display: flex;
                align-items: center;
                justify-content: space-between;
                padding: 8px 12px;
                background: var(--heroui-surface-2);
                border: 1px solid var(--heroui-border);
                border-radius: var(--heroui-radius-control);
                gap: 8px;
            }
            #nnu-selected-count {
                font-family: var(--heroui-font-mono);
                font-size: 12px;
                font-weight: 500;
                color: var(--heroui-fg);
                font-variant-numeric: tabular-nums;
            }
            #nnu-panel-close {
                border: 0;
                background: transparent;
                width: 28px;
                height: 28px;
                border-radius: 6px;
                color: var(--heroui-fg-muted);
                cursor: pointer;
                display: inline-flex;
                align-items: center;
                justify-content: center;
            }
            #nnu-panel-close:hover {
                background: var(--heroui-surface-2);
                color: var(--heroui-fg);
            }
            #nnu-select-pagesize {
                font-family: var(--heroui-font-mono);
                font-size: 13px;
                font-variant-numeric: tabular-nums;
                height: 36px;
                padding: 0 10px;
                border: 1px solid var(--heroui-border-strong);
                border-radius: var(--heroui-radius-control);
                background: var(--heroui-surface);
                color: var(--heroui-fg);
            }
            #nnu-ball-panel details {
                border-top: 1px solid var(--heroui-border);
                padding-top: 12px;
            }
            #nnu-ball-panel details summary {
                cursor: pointer;
                color: var(--heroui-fg-muted);
                font-size: 12px;
                font-weight: 500;
                user-select: none;
            }
            #nnu-ball-panel details[open] summary { margin-bottom: 8px; }

            #nnu-log-container {
                max-height: 88px;
                overflow-y: auto;
                background: var(--heroui-surface-2);
                border: 1px solid var(--heroui-border);
                border-radius: var(--heroui-radius-control);
                padding: 6px 8px;
                font-size: 12px;
                font-family: var(--heroui-font-mono);
                font-variant-numeric: tabular-nums;
            }
            .nnu-log-item {
                display: flex;
                justify-content: space-between;
                padding: 2px 0;
                border-bottom: 1px solid var(--heroui-border);
            }
            .nnu-log-item:last-child { border-bottom: none; }

            #nnu-toast {
                position: fixed;
                top: 24px;
                left: 50%;
                transform: translateX(-50%);
                z-index: 10000002;
                background: #171717;
                color: #ededed;
                border: 1px solid rgba(255, 255, 255, 0.12);
                padding: 8px 16px;
                border-radius: var(--heroui-radius-control);
                font-family: var(--heroui-font-sans);
                font-size: 13px;
                font-weight: 500;
                box-shadow: var(--heroui-shadow-panel);
                pointer-events: none;
                opacity: 0;
                max-width: 90vw;
                text-align: center;
                font-variant-numeric: tabular-nums;
            }
            #nnu-toast.show { opacity: 1; }

            /* ===== 移动端响应式适配 ===== */
            @media (max-width: 768px) {
                .nnu-tall-view .nnu-main-grid {
                    height: 60vh !important;
                    min-height: 380px !important;
                }
                .bh-paper-pile-dialog-body,
                .bh-card-lv4.bh-dialog-con .bh-dialog-center,
                .bh-window-content,
                .bh-dialog .bh-dialog-center,
                .el-dialog__body {
                    padding: 8px 12px !important;
                }
                #nnu-ball {
                    bottom: 16px;
                    right: 12px;
                }
                #nnu-ball-panel {
                    bottom: 60px;
                    right: 12px;
                    padding: 16px;
                }
                .nnu-btn, .nnu-quick-btn {
                    height: 40px;
                }
                .nnu-quick-actions {
                    width: 100%;
                }
                .nnu-quick-btn {
                    flex: 1 1 auto;
                }
                .nnu-kbd-group {
                    display: none;
                }
            }
        `;
        const s = document.createElement('style');
        s.id = 'nnu-leavefaster-styles';
        s.textContent = css;
        (document.head || document.documentElement).appendChild(s);
        if (isTallView) document.documentElement.classList.add('nnu-tall-view');
    }

    // ================= 3. 主表高度安全应用 (严禁修改未初始化或隐藏的 0x0 表格) =================
    let _heightRafTimer = null;
    function apply75vhHeight() {
        if (!isTallView) return;
        if (_heightRafTimer) return;
        _heightRafTimer = requestAnimationFrame(() => {
            _heightRafTimer = null;
            document.documentElement.classList.add('nnu-tall-view');
            const isMobile = window.innerWidth <= 768;
            const h = isMobile ? Math.max(Math.round(window.innerHeight * 0.6), 380) : Math.max(Math.round(window.innerHeight * 0.75), 640);
            document.querySelectorAll('#emapdatatable, [data-action="grid"], .jqx-grid').forEach(grid => {
                if (grid.closest('.bh-paper-pile-dialog, .bh-card-lv4, .bh-window, .bh-dialog, .bh-pop, .el-dialog, [role="dialog"]')) return;
                const content = grid.querySelector('.jqx-grid-content');
                if (!content || grid.clientWidth === 0) return;
                grid.classList.add('nnu-main-grid');
                if (Math.abs(grid.clientHeight - h) <= 4) return;
                grid.style.setProperty('height', `${h}px`, 'important');
                grid.style.setProperty('min-height', `${h}px`, 'important');
                content.style.setProperty('height', `${h - 64}px`, 'important');
                try {
                    if (win.jQuery && win.jQuery(grid).data('jqxGrid')) {
                        win.jQuery(grid).jqxGrid({ height: h });
                    }
                } catch (e) {}
            });
        });
    }

    function restoreNativeTableHeight() {
        document.documentElement.classList.remove('nnu-tall-view');
        document.querySelectorAll('.nnu-main-grid').forEach(grid => {
            grid.classList.remove('nnu-main-grid');
            grid.style.removeProperty('height');
            grid.style.removeProperty('min-height');
            const content = grid.querySelector('.jqx-grid-content');
            if (content) content.style.removeProperty('height');
        });
    }

    // ================= 4. 同步主表组件分页状态，再刷新 =================
    function getMainTables() {
        return Array.from(document.querySelectorAll('#emapdatatable, [data-action="grid"], .jqx-grid')).filter(el =>
            el.getClientRects().length && !el.closest('.bh-paper-pile-dialog, .bh-window, .bh-dialog, .bh-pop, .el-dialog, [role="dialog"]'));
    }

    function triggerReloadData() {
        lastInteractTime = Date.now();
        const $ = win.jQuery;
        if (!$) { showToast('表格组件尚未就绪，请稍后重试'); return; }
        for (const el of getMainTables()) {
            const table = $(el);
            const kind = table.data('jqxGrid') ? 'jqxGrid' : table.data('jqxDataTable') ? 'jqxDataTable' : null;
            if (!kind || typeof table[kind] !== 'function') continue;
            try {
                const isGrid = kind === 'jqxGrid';
                const sizeKey = isGrid ? 'pagesize' : 'pageSize';
                const oldSize = table[kind](sizeKey);
                const oldPage = isGrid ? table[kind]('getpaginginformation') : null;
                showToast(`正在加载每页 ${currentCustomPageSize} 行`);
                table[kind]({ [sizeKey]: currentCustomPageSize });
                table[kind](isGrid ? 'gotopage' : 'goToPage', 0);
                if (Number(oldSize) === currentCustomPageSize && (!isGrid || oldPage.pagenum === 0)) {
                    table[kind](isGrid ? 'updatebounddata' : 'updateBoundData');
                }
                addRequestLog('主表分页设置', 0, `${kind}: ${oldSize} -> ${table[kind](sizeKey)}`);
                setTimeout(apply75vhHeight, 500);
                return;
            } catch (e) {
                addRequestLog('主表分页设置失败', 0, String(e), false);
                console.warn('[NNU] 主表分页设置失败', e);
            }
        }
        showToast('未找到可操作的主表组件，请复制诊断日志', 3500);
    }

    // ================= 4.5 突破 10 条批量限制与多选增强 (不篡改 emapdatatable 原型，杜绝表格崩溃) =================
    function getActiveGrid() {
        const tables = getMainTables();
        return tables.length ? tables[0] : document.querySelector('#emapdatatable, [data-action="grid"], .jqx-grid');
    }

    function getSelectedRecords() {
        const grid = getActiveGrid();
        if (!grid) return [];
        const $ = win.jQuery;
        if ($ && $(grid).length) {
            try {
                if (typeof $(grid).emapdatatable === 'function') {
                    const checked = $(grid).emapdatatable('getChecked');
                    if (Array.isArray(checked) && checked.length) return checked;
                }
            } catch (e) {}
            try {
                if ($(grid).data('jqxGrid')) {
                    const indexes = $(grid).jqxGrid('getselectedrowindexes') || [];
                    const rows = [];
                    for (const idx of indexes) {
                        const rowData = $(grid).jqxGrid('getrowdata', idx);
                        if (rowData) rows.push(rowData);
                    }
                    if (rows.length) return rows;
                }
            } catch (e) {}
        }
        const checkedBoxes = Array.from(document.querySelectorAll('.jqx-grid-content .jqx-checkbox[aria-checked="true"], .jqx-grid-content input[type="checkbox"]:checked, #emapdatatable tbody input[type="checkbox"]:checked'));
        return checkedBoxes.map((cb, i) => ({ index: i, element: cb }));
    }

    function toggleSelectAll(selectAll = true) {
        lastInteractTime = Date.now();
        _batchSelectionLock = true;
        const grid = getActiveGrid();
        const $ = win.jQuery;
        const hasJqxGrid = Boolean(grid && $ && $(grid).data('jqxGrid'));
        try {
            const rowCheckboxes = document.querySelectorAll('.jqx-grid-content .jqx-checkbox, #emapdatatable tbody input[type="checkbox"]');
            let clickedCount = 0;
            for (const cb of rowCheckboxes) {
                if (cb.closest && cb.closest('.jqx-grid-column-header')) continue;
                if (cb.tagName === 'INPUT') {
                    if (cb.checked !== selectAll) {
                        cb.checked = selectAll;
                        cb.dispatchEvent(new Event('change', { bubbles: true }));
                        clickedCount++;
                    }
                } else {
                    const isChecked = cb.getAttribute('aria-checked') === 'true';
                    if (isChecked !== selectAll) {
                        cb.click();
                        clickedCount++;
                    }
                }
            }
            if (hasJqxGrid && clickedCount === 0) {
                try { $(grid).jqxGrid('beginupdate'); } catch (e) {}
                try { $(grid).jqxGrid(selectAll ? 'selectallrows' : 'clearselection'); } catch (e) {}
                try { $(grid).jqxGrid('endupdate'); } catch (e) {}
            }
        } finally {
            _batchSelectionLock = false;
        }
        updateBatchCountUI();
        showToast(selectAll ? '已全选当前页待办' : '已清空选择');
    }

    function updateBatchCountUI() {
        const count = getSelectedRecords().length;
        const countEl = document.getElementById('nnu-selected-count');
        if (countEl) countEl.textContent = `已选 ${count}`;
        const btnAgree = document.getElementById('nnu-btn-batch-agree');
        if (btnAgree) {
            btnAgree.textContent = count > 0 ? `批量同意 (${count})` : '批量同意';
            btnAgree.style.opacity = count > 0 ? '1' : '0.65';
        }
    }

    // 关键修复：绝不覆写 $.fn.emapdatatable 或向 jqxGrid 注入非标准 options 属性（会导致 jqxcore 抛出 Invalid property 致使表格消失）
    function unlockGridSelectionLimits() {
        if (_bhTipUnlocked && _bhUtilTipUnlocked) return;
        const $ = win.jQuery;
        if ($ && !_bhTipUnlocked && $.bhTip) {
            if (!$.bhTip._nnuWrapped) {
                const origBhTip = $.bhTip;
                const wrappedTip = function (options) {
                    const content = typeof options === 'string' ? options : (options && options.content || '');
                    if (RE_LIMIT_10.test(content)) return;
                    return origBhTip.apply(this, arguments);
                };
                Object.assign(wrappedTip, origBhTip);
                wrappedTip._nnuWrapped = true;
                $.bhTip = wrappedTip;
            }
            _bhTipUnlocked = true;
        }

        if (!_bhUtilTipUnlocked && win.BH_UTILS && win.BH_UTILS.bhTip) {
            if (!win.BH_UTILS.bhTip._nnuWrapped) {
                const origBhUtilTip = win.BH_UTILS.bhTip;
                const wrappedUtilTip = function (options) {
                    const content = typeof options === 'string' ? options : (options && options.content || '');
                    if (RE_LIMIT_10.test(content)) return;
                    return origBhUtilTip.apply(this, arguments);
                };
                Object.assign(wrappedUtilTip, origBhUtilTip);
                wrappedUtilTip._nnuWrapped = true;
                win.BH_UTILS.bhTip = wrappedUtilTip;
            }
            _bhUtilTipUnlocked = true;
        }
    }

    function executeBatchApprove() {
        lastInteractTime = Date.now();
        const records = getSelectedRecords();
        if (!records.length) {
            showToast('请先勾选需要批量同意的待办记录');
            return;
        }

        const nativeBatchBtn = Array.from(document.querySelectorAll('button, a, .bh-btn, [data-action]')).find(el => {
            const txt = (el.textContent || '').trim();
            const act = el.getAttribute('data-action') || '';
            return !el.closest('#nnu-ball-panel') && (/批量(?:同意|通过|审核|处理|办理)/.test(txt) || /batch(?:Review|Agree|Pass|Audit)/i.test(act)) && el.offsetParent;
        });

        if (nativeBatchBtn) {
            showToast(`正在批量处理 ${records.length} 条待办`);
            nativeBatchBtn.click();
            setTimeout(() => {
                const modal = document.querySelector('.bh-dialog-con, .bh-paper-pile-dialog, .bh-window, .bh-dialog');
                if (modal) {
                    const ta = modal.querySelector('textarea');
                    if (ta) {
                        ta.value = autoOpinionText;
                        ta.dispatchEvent(new Event('input', { bubbles: true }));
                    }
                }
            }, 300);
            return;
        }

        showToast(`已选 ${records.length} 条，请点击页面上方的批量审核按钮提交`);
    }

    // ================= 5. 审核表单置顶、移动端快捷审批与证明附件预览 =================
    function fillAgreeOpinion(scopeDoc = document) {
        let filled = false;
        scopeDoc.querySelectorAll('input[type="radio"]').forEach(r => {
            if ((r.parentElement && r.parentElement.textContent.includes('同意')) || (r.labels && Array.from(r.labels).some(l => l.textContent.includes('同意')))) {
                r.click();
                filled = true;
            }
        });
        scopeDoc.querySelectorAll('textarea').forEach(ta => {
            if (ta.offsetParent !== null) {
                ta.value = autoOpinionText;
                ta.dispatchEvent(new Event('input', { bubbles: true }));
                ta.dispatchEvent(new Event('change', { bubbles: true }));
                filled = true;
            }
        });
        return filled;
    }

    function submitReviewForm(scopeDoc = document) {
        const btn = Array.from(scopeDoc.querySelectorAll('button, a.bh-btn-primary, .bh-btn-primary')).find(b => {
            if (b.closest('#nnu-ball-panel, .nnu-quick-approve-bar')) return false;
            const t = (b.textContent || '').trim();
            return ['确定', '提交', '通过', '保存'].includes(t) && b.offsetParent !== null && !b.disabled;
        });
        if (btn) {
            btn.click();
            return true;
        }
        return false;
    }

    function liftReviewFormToTop() {
        const containers = document.querySelectorAll('.bh-paper-pile-dialog, .bh-card-lv4 .bh-dialog-center, .bh-window .bh-window-content, .bh-dialog .bh-dialog-center, .bh-dialog-content');
        containers.forEach(form => {
            if (form.dataset.nnuLifted) return;
            if (form.querySelector('#emapdatatable, #commonAdvanceQuery')) return;

            const groups = Array.from(form.querySelectorAll('.bh-form-group, .bh-form-row, .el-form-item, [data-name*="SHYJ"], [data-name*="opinion"]'));
            let target = null;
            for (const g of groups) {
                if (!g.querySelector('textarea')) continue;
                if (g.querySelector('[data-action="grid"], .jqx-grid')) continue;
                target = g;
            }
            if (target && target.parentElement) {
                form.dataset.nnuLifted = 'true';
                target.classList.add('nnu-top-highlight');
                target.parentElement.insertBefore(target, target.parentElement.firstChild);

                if (!target.querySelector('.nnu-quick-approve-bar')) {
                    const bar = document.createElement('div');
                    bar.className = 'nnu-quick-approve-bar';
                    bar.innerHTML = `
                        <div class="nnu-quick-actions">
                            <button type="button" class="nnu-quick-btn nnu-quick-btn-primary" data-nnu-act="agree-submit">${ICON_CHECK}<span>同意并提交</span></button>
                            <button type="button" class="nnu-quick-btn nnu-quick-btn-outline" data-nnu-act="agree-only">${ICON_EDIT}<span>填入同意</span></button>
                        </div>
                        <div class="nnu-kbd-group">
                            <kbd class="nnu-kbd">Alt</kbd><kbd class="nnu-kbd">A</kbd><span>同意</span>
                            <kbd class="nnu-kbd">Alt</kbd><kbd class="nnu-kbd">Enter</kbd><span>提交</span>
                        </div>
                    `;
                    bar.addEventListener('click', e => {
                        const btn = e.target.closest('button[data-nnu-act]');
                        if (!btn) return;
                        e.preventDefault();
                        e.stopPropagation();
                        const filled = fillAgreeOpinion(document);
                        if (btn.dataset.nnuAct === 'agree-submit') {
                            showToast(filled ? '已填入同意，正在提交' : '正在提交');
                            setTimeout(() => {
                                if (submitReviewForm(document)) showToast('已同意并提交');
                                else showToast('已填入同意，请确认提交');
                            }, 80);
                        } else {
                            showToast(filled ? `已勾选同意并填入：${autoOpinionText}` : '未检测到意见输入框');
                        }
                    });
                    target.insertBefore(bar, target.firstChild);
                }
            }
        });
    }

    function loadProtectedImage(imgEl, url) {
        imgEl.src = url;
        imgEl.onerror = () => {
            if (imgEl.dataset.nnuBlobTried) return;
            imgEl.dataset.nnuBlobTried = 'true';
            fetch(url, { credentials: 'include' })
                .then(res => {
                    if (!res.ok) throw new Error(`HTTP ${res.status}`);
                    return res.blob();
                })
                .then(blob => {
                    if (blob && blob.size > 0) {
                        const objUrl = URL.createObjectURL(blob);
                        imgEl.dataset.nnuBlobUrl = objUrl;
                        imgEl.src = objUrl;
                    }
                })
                .catch(() => {
                    imgEl.alt = '点击查看原图';
                });
        };
    }

    function openImageLightbox(items, startIndex = 0) {
        if (!items || !items.length) return;
        let idx = Math.max(0, Math.min(startIndex, items.length - 1));
        let scale = 1;
        let rotate = 0;

        let lb = document.getElementById('nnu-lightbox');
        if (!lb) {
            lb = document.createElement('div');
            lb.id = 'nnu-lightbox';
            lb.innerHTML = `
                <div id="nnu-lb-stage"><img id="nnu-lb-img" alt="附件预览"></div>
                <div id="nnu-lb-caption"></div>
                <div id="nnu-lb-toolbar">
                    <button type="button" class="nnu-lb-btn" data-lb="prev">${ICON_CHEVRON_LEFT}<span>上一张</span></button>
                    <button type="button" class="nnu-lb-btn" data-lb="zoom-in">${ICON_ZOOM_IN}<span>放大</span></button>
                    <button type="button" class="nnu-lb-btn" data-lb="zoom-out">${ICON_ZOOM_OUT}<span>缩小</span></button>
                    <button type="button" class="nnu-lb-btn" data-lb="rotate-left">${ICON_ROTATE_CCW}<span>左旋</span></button>
                    <button type="button" class="nnu-lb-btn" data-lb="rotate-right">${ICON_ROTATE_CW}<span>右旋</span></button>
                    <button type="button" class="nnu-lb-btn" data-lb="reset"><span>1:1</span></button>
                    <button type="button" class="nnu-lb-btn" data-lb="open-raw">${ICON_EXTERNAL}<span>原图</span></button>
                    <button type="button" class="nnu-lb-btn" data-lb="next"><span>下一张</span>${ICON_CHEVRON_RIGHT}</button>
                    <button type="button" class="nnu-lb-btn nnu-lb-btn--danger" data-lb="close">${ICON_CLOSE}<span>关闭</span></button>
                </div>
            `;
            document.body.appendChild(lb);
            lb.addEventListener('click', e => {
                if (e.target === lb || e.target.id === 'nnu-lb-stage') lb.classList.remove('show');
            });
        }

        const imgEl = document.getElementById('nnu-lb-img');
        const capEl = document.getElementById('nnu-lb-caption');
        const applyTransform = () => {
            imgEl.style.transform = `scale(${scale}) rotate(${rotate}deg)`;
        };
        const renderItem = () => {
            const item = items[idx];
            scale = 1;
            rotate = 0;
            applyTransform();
            delete imgEl.dataset.nnuBlobTried;
            loadProtectedImage(imgEl, item.url);
            capEl.textContent = `${item.name || '附件图片'} (${idx + 1} / ${items.length})`;
        };

        const toolbar = document.getElementById('nnu-lb-toolbar');
        toolbar.onclick = e => {
            const btn = e.target.closest('button[data-lb]');
            if (!btn) return;
            e.stopPropagation();
            const act = btn.dataset.lb;
            if (act === 'zoom-in') { scale = Math.min(4, scale + 0.35); applyTransform(); }
            else if (act === 'zoom-out') { scale = Math.max(0.3, scale - 0.35); applyTransform(); }
            else if (act === 'rotate-left') { rotate -= 90; applyTransform(); }
            else if (act === 'rotate-right') { rotate += 90; applyTransform(); }
            else if (act === 'reset') { scale = 1; rotate = 0; applyTransform(); }
            else if (act === 'prev') { idx = (idx - 1 + items.length) % items.length; renderItem(); }
            else if (act === 'next') { idx = (idx + 1) % items.length; renderItem(); }
            else if (act === 'open-raw') { window.open(imgEl.dataset.nnuBlobUrl || items[idx].url, '_blank'); }
            else if (act === 'close') { lb.classList.remove('show'); }
        };

        renderItem();
        lb.classList.add('show');
    }

    function enhanceAttachmentPreviews() {
        const dialogs = document.querySelectorAll('.bh-paper-pile-dialog, .bh-card-lv4.bh-dialog-con, .bh-window, .bh-dialog');
        dialogs.forEach(dialog => {
            if (!dialog.offsetParent) return;
            if (dialog.querySelector('#emapdatatable, #commonAdvanceQuery')) return;

            const items = [];
            const seen = new Set();
            const addItem = (name, url) => {
                if (!url || seen.has(url)) return;
                seen.add(url);
                items.push({ name: name || `附件 ${items.length + 1}`, url });
            };

            for (const att of latestAttachments) addItem(att.name, att.url);

            dialog.querySelectorAll('a[href]').forEach(a => {
                const href = a.href || a.getAttribute('href');
                if (href && (RE_IMAGE_EXT.test(href) || RE_DOWNLOAD_LINK.test(href))) {
                    addItem((a.textContent || '').trim(), href);
                }
            });
            dialog.querySelectorAll('img').forEach(img => {
                if (img.classList.contains('nnu-att-thumb') || img.closest('.emap-flow-comment-item .chapter')) return;
                const src = img.getAttribute('data-original') || img.getAttribute('data-src') || img.src;
                if (src && !src.startsWith('data:image/svg')) {
                    addItem(img.alt || '证明图片', src);
                    if (!img.dataset.nnuLightboxBound) {
                        img.dataset.nnuLightboxBound = 'true';
                        img.style.cursor = 'zoom-in';
                        img.addEventListener('click', e => {
                            e.stopPropagation();
                            openImageLightbox([{ name: img.alt || '证明图片', url: src }], 0);
                        });
                    }
                }
            });

            if (!items.length) return;
            const signature = items.map(i => i.url).join('|');
            let bar = dialog.querySelector('.nnu-attachment-bar');
            if (bar && bar.dataset.sig === signature) return;
            if (bar) bar.remove();

            bar = document.createElement('div');
            bar.className = 'nnu-attachment-bar';
            bar.dataset.sig = signature;
            bar.innerHTML = `
                <div class="nnu-attachment-header">
                    <span class="nnu-attachment-title">${ICON_IMAGE}<span>证明附件</span><span class="nnu-attachment-count">${items.length}</span></span>
                    <button type="button" class="nnu-btn nnu-btn--secondary nnu-btn--sm" data-nnu-open-all="1">全屏查看</button>
                </div>
                <div class="nnu-attachment-list"></div>
            `;
            const listEl = bar.querySelector('.nnu-attachment-list');
            items.forEach((item, index) => {
                const card = document.createElement('div');
                card.className = 'nnu-att-card';
                const thumb = document.createElement('img');
                thumb.className = 'nnu-att-thumb';
                thumb.alt = item.name;
                loadProtectedImage(thumb, item.url);
                const label = document.createElement('span');
                label.className = 'nnu-att-name';
                label.textContent = item.name;
                card.appendChild(thumb);
                card.appendChild(label);
                card.addEventListener('click', e => {
                    e.stopPropagation();
                    openImageLightbox(items, index);
                });
                listEl.appendChild(card);
            });
            bar.querySelector('[data-nnu-open-all]').addEventListener('click', e => {
                e.stopPropagation();
                openImageLightbox(items, 0);
            });

            const highlight = dialog.querySelector('.nnu-top-highlight');
            if (highlight && highlight.parentElement) {
                highlight.parentElement.insertBefore(bar, highlight.nextSibling);
            } else {
                const host = dialog.querySelector('.bh-paper-pile-dialog-body, .bh-dialog-center, .bh-window-content, .el-dialog__body') || dialog;
                host.insertBefore(bar, host.firstChild);
            }
        });
    }

    function scheduleDomEnhancements() {
        if (_domObserverRaf) return;
        _domObserverRaf = requestAnimationFrame(() => {
            _domObserverRaf = null;
            unlockGridSelectionLimits();
            apply75vhHeight();
            liftReviewFormToTop();
            enhanceAttachmentPreviews();
        });
    }

    function dismissMasks(immediate) {
        const fn = () => {
            document.querySelectorAll('.el-loading-mask, .bh-loading-mask, .bh-mask, [data-role="bh-loading"], .jqx-datatable-load').forEach(m => {
                if (m.offsetParent !== null) { m.style.display = 'none'; m.style.pointerEvents = 'none'; }
            });
        };
        immediate ? fn() : setTimeout(fn, 50);
    }

    function showToast(msg, dur = 1800) {
        let t = document.getElementById('nnu-toast');
        if (!t) { t = document.createElement('div'); t.id = 'nnu-toast'; document.body.appendChild(t); }
        t.textContent = msg;
        t.classList.add('show');
        setTimeout(() => t.classList.remove('show'), dur);
    }

    // ================= 6. HeroUI v3 工作台触发器与面板 =================
    function updateLogPanelUI() {
        const c = document.getElementById('nnu-log-container');
        if (!c) return;
        if (!requestLogs.length) { c.innerHTML = '<span style="color:var(--heroui-fg-muted)">等待接口请求</span>'; return; }
        c.innerHTML = requestLogs.map(item => {
            const color = item.isSuccess ? (item.duration > 2500 ? 'var(--heroui-warning)' : 'var(--heroui-success)') : 'var(--heroui-danger)';
            return `<div class="nnu-log-item" style="color:${color}"><span>${item.time} ${item.action}</span><span>${item.duration} ms</span></div>`;
        }).join('');
    }

    function copyDiagnosticLog() {
        const tables = document.querySelectorAll('[data-action="grid"], .jqx-grid, table');
        let tInfo = `检测到 ${tables.length} 个表格:\n`;
        tables.forEach((t, i) => {
            tInfo += `  [${i + 1}] <${t.tagName.toLowerCase()}> id:"${t.id}" class:"${t.className}" 尺寸:${t.clientWidth}x${t.clientHeight}\n`;
            try {
                const table = win.jQuery(t);
                if (table.data('jqxGrid')) tInfo += `    jqxGrid分页:${JSON.stringify(table.jqxGrid('getpaginginformation'))}\n`;
                else if (table.data('jqxDataTable')) tInfo += `    jqxDataTable每页:${table.jqxDataTable('pageSize')}\n`;
            } catch (e) { tInfo += `    组件诊断:${String(e)}\n`; }
        });
        const txt = `====== NNU Leave Diagnostic Log (v1.1.1) ======\n`
            + `URL: ${location.href}\n行数:${currentCustomPageSize} | 75vh视窗:${isTallView} | 嗅探附件:${latestAttachments.length}\n`
            + `Window:${window.innerWidth}x${window.innerHeight}\n${tInfo}\n`
            + `Requests:\n${JSON.stringify(requestLogs, null, 2)}\n===========================`;
        navigator.clipboard.writeText(txt).then(() => showToast('已复制诊断日志', 2500)).catch(() => console.log(txt));
    }

    function renderFloatingBall() {
        if (!isTopWindow || document.getElementById('nnu-ball')) return;

        const ball = document.createElement('div');
        ball.id = 'nnu-ball';
        ball.innerHTML = `<span class="nnu-status-dot"></span>${ICON_CHECK_DOC}<span>NNU LeaveFaster</span>`;
        document.body.appendChild(ball);

        const panel = document.createElement('div');
        panel.id = 'nnu-ball-panel';
        panel.innerHTML = `
            <div class="heroui-card__header">
                <div class="heroui-card__title">
                    ${ICON_CHECK_DOC}
                    <span>NNU LeaveFaster</span>
                    <span class="heroui-card__meta">v1.1.1</span>
                </div>
                <button id="nnu-panel-close" type="button" aria-label="关闭面板">${ICON_CLOSE}</button>
            </div>
            <div class="heroui-row">
                <label class="heroui-label" for="nnu-select-pagesize">每页行数</label>
                <div style="display:flex;align-items:center;gap:8px">
                    <select id="nnu-select-pagesize">
                        <option value="10">10</option>
                        <option value="20">20</option>
                        <option value="50">50</option>
                        <option value="100">100</option>
                    </select>
                    <button id="nnu-btn-apply" type="button" class="nnu-btn nnu-btn--primary">${ICON_REFRESH}<span>刷新</span></button>
                </div>
            </div>
            <div class="heroui-surface-box">
                <span id="nnu-selected-count">已选 0</span>
                <div style="display:flex;gap:4px">
                    <button id="nnu-btn-select-all" type="button" class="nnu-btn nnu-btn--secondary nnu-btn--sm">全选</button>
                    <button id="nnu-btn-unselect-all" type="button" class="nnu-btn nnu-btn--ghost nnu-btn--sm">清空</button>
                    <button id="nnu-btn-batch-agree" type="button" class="nnu-btn nnu-btn--primary nnu-btn--sm">批量同意</button>
                </div>
            </div>
            <label class="heroui-row" style="cursor:pointer">
                <span class="heroui-label">扩展主表视窗高度</span>
                <input type="checkbox" id="nnu-check-tallview" ${isTallView ? 'checked' : ''}>
            </label>
            <details>
                <summary>诊断与快捷键</summary>
                <div id="nnu-log-container"><span style="color:var(--heroui-fg-muted)">等待接口请求</span></div>
                <div style="display:flex;justify-content:space-between;align-items:center;margin-top:8px">
                    <button id="nnu-btn-diag" type="button" class="nnu-btn nnu-btn--secondary nnu-btn--sm">${ICON_COPY}<span>复制诊断信息</span></button>
                    <div class="nnu-kbd-group">
                        <kbd class="nnu-kbd">Alt</kbd><kbd class="nnu-kbd">A</kbd>
                        <kbd class="nnu-kbd">Alt</kbd><kbd class="nnu-kbd">Enter</kbd>
                    </div>
                </div>
            </details>
        `;
        document.body.appendChild(panel);

        panel.addEventListener('click', e => {
            lastInteractTime = Date.now();
            e.stopPropagation();
        });

        let isOpen = false;
        const togglePanel = show => {
            isOpen = typeof show === 'boolean' ? show : !isOpen;
            panel.classList.toggle('show', isOpen);
            if (isOpen) updateBatchCountUI();
        };

        ball.addEventListener('click', e => {
            lastInteractTime = Date.now();
            e.stopPropagation();
            togglePanel();
        });

        document.getElementById('nnu-panel-close').addEventListener('click', e => {
            e.stopPropagation();
            togglePanel(false);
        });

        document.getElementById('nnu-btn-select-all').addEventListener('click', e => {
            e.stopPropagation();
            toggleSelectAll(true);
        });

        document.getElementById('nnu-btn-unselect-all').addEventListener('click', e => {
            e.stopPropagation();
            toggleSelectAll(false);
        });

        document.getElementById('nnu-btn-batch-agree').addEventListener('click', e => {
            e.stopPropagation();
            executeBatchApprove();
        });

        document.addEventListener('click', e => {
            if (!isOpen) return;
            if (!e.isTrusted) return;
            if (Date.now() - lastInteractTime < 2500) return;
            if (panel.contains(e.target) || ball.contains(e.target) || (e.target.closest && e.target.closest('#nnu-ball-panel, #nnu-ball'))) {
                return;
            }
            togglePanel(false);
        });

        const sel = document.getElementById('nnu-select-pagesize');
        sel.value = String(currentCustomPageSize);
        sel.addEventListener('change', e => {
            lastInteractTime = Date.now();
            currentCustomPageSize = parseInt(e.target.value, 10);
            localStorage.setItem(STORAGE_KEY_PAGESIZE, currentCustomPageSize);
            showToast(`已设每页 ${currentCustomPageSize} 行，点击刷新生效`);
        });

        document.getElementById('nnu-btn-apply').addEventListener('click', e => {
            lastInteractTime = Date.now();
            e.stopPropagation();
            togglePanel(true);
            triggerReloadData();
        });

        document.getElementById('nnu-check-tallview').addEventListener('change', e => {
            lastInteractTime = Date.now();
            isTallView = e.target.checked;
            localStorage.setItem(STORAGE_KEY_TALL_VIEW, isTallView);
            if (isTallView) {
                apply75vhHeight();
                showToast('已启用扩展主表视窗');
            } else {
                restoreNativeTableHeight();
                showToast('已恢复默认主表高度');
            }
        });

        document.getElementById('nnu-btn-diag').addEventListener('click', e => {
            lastInteractTime = Date.now();
            e.stopPropagation();
            copyDiagnosticLog();
        });

        updateLogPanelUI();
        updateBatchCountUI();
    }

    // ================= 7. 快捷键 =================
    function handleKeys(e) {
        if (e.altKey && (e.key === 'a' || e.key === 'A')) {
            e.preventDefault();
            const filled = fillAgreeOpinion(document);
            showToast(filled ? `已勾选同意并填入：${autoOpinionText}` : '请先打开审核详情');
        }
        if (e.altKey && e.key === 'Enter') {
            e.preventDefault();
            if (submitReviewForm(document)) showToast('已提交审核');
        }
    }

    // ================= 8. 初始化 =================
    function init() {
        injectStyles();

        const onReady = () => {
            unlockGridSelectionLimits();
            renderFloatingBall();
            apply75vhHeight();
            document.addEventListener('keydown', handleKeys);

            win.addEventListener('resize', apply75vhHeight);

            document.addEventListener('change', e => {
                if (_batchSelectionLock) return;
                if (e.target.matches('input[type="checkbox"]')) {
                    setTimeout(updateBatchCountUI, 50);
                }
            }, true);

            document.addEventListener('click', e => {
                if (_batchSelectionLock) return;
                if (e.target.closest('.jqx-checkbox, .bh-checkbox, [data-action="checkAll"]')) {
                    setTimeout(updateBatchCountUI, 50);
                }
                const headerCheck = e.target.closest('.jqx-grid-column-header .jqx-checkbox, [data-action="checkAll"], th input[type="checkbox"]');
                if (headerCheck) {
                    unlockGridSelectionLimits();
                    setTimeout(updateBatchCountUI, 100);
                }
            }, true);

            const observer = new MutationObserver(() => {
                scheduleDomEnhancements();
            });
            observer.observe(document.body || document.documentElement, { childList: true, subtree: true });
        };

        if (document.readyState === 'loading') {
            document.addEventListener('DOMContentLoaded', onReady);
        } else {
            onReady();
        }

        win.addEventListener('load', () => {
            unlockGridSelectionLimits();
            setTimeout(apply75vhHeight, 500);
            setTimeout(apply75vhHeight, 1500);
        });
    }

    init();
})();
