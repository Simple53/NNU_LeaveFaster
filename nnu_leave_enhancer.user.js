// ==UserScript==
// @name         NNU LeaveFaster
// @namespace    https://github.com/Simple53/NNU_LeaveFaster
// @version      1.1.0
// @description  专为南师大请假系统定制：热路径加速、手机端一键同意与适配、附件图片强力兜底预览(防裂图/可旋转缩放)、突破10条批量上限支持全选、同步jqx分页刷新
// @author       Antigravity
// @homepageURL  https://github.com/Simple53/NNU_LeaveFaster
// @supportURL   https://github.com/Simple53/NNU_LeaveFaster/issues
// @icon         data:image/svg+xml;base64,PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHZpZXdCb3g9IjAgMCA2NCA2NCIgZmlsbD0ibm9uZSI+CiAgPHRpdGxlPk5OVSBMZWF2ZUZhc3RlcjwvdGl0bGU+CiAgPHJlY3Qgd2lkdGg9IjY0IiBoZWlnaHQ9IjY0IiByeD0iMTYiIGZpbGw9IiMxNjc3RkYiLz4KICA8cGF0aCBkPSJNMjAgMTNoMThsOSA5djI3YTMgMyAwIDAgMS0zIDNIMjBhMyAzIDAgMCAxLTMtM1YxNmEzIDMgMCAwIDEgMy0zWiIgZmlsbD0id2hpdGUiLz4KICA8cGF0aCBkPSJNMzcgMTN2MTBoMTAiIGZpbGw9IiNCOEQ3RkYiLz4KICA8cGF0aCBkPSJtMjQgMzUgNiA2IDEyLTEzIiBzdHJva2U9IiMxNjc3RkYiIHN0cm9rZS13aWR0aD0iNC41IiBzdHJva2UtbGluZWNhcD0icm91bmQiIHN0cm9rZS1saW5lam9pbj0icm91bmQiLz4KICA8cGF0aCBkPSJNOSAyNmgxM003IDMzaDEyIiBzdHJva2U9IiNCOEQ3RkYiIHN0cm9rZS13aWR0aD0iMyIgc3Ryb2tlLWxpbmVjYXA9InJvdW5kIi8+Cjwvc3ZnPgo=
// @match        https://ehallapp.nnu.edu.cn/qljfw/sys/lwNjnuStuLeaveManagement/*
// @match        *://ehallapp.nnu.edu.cn/*
// @match        *://*/*/sys/lwNjnuStuLeaveManagement/*
// @match        *://*/*LeaveManagement*/*
// @run-at       document-start
// @grant        unsafeWindow
// @allFrames    true
// ==/UserScript==

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

    // 交互时间锁与批处理锁
    let lastInteractTime = 0;
    let _batchSelectionLock = false;
    let _domObserverRaf = null;
    let _emapUnlocked = false;
    let _bhTipUnlocked = false;
    let _bhUtilTipUnlocked = false;

    // 最近一次审核单的附件缓存
    let latestAttachments = [];

    const requestLogs = [];
    function addRequestLog(actionName, durationMs, details, isSuccess = true) {
        if (!isTopWindow) return;
        requestLogs.unshift({ time: new Date().toLocaleTimeString(), action: actionName, duration: durationMs, details, isSuccess });
        if (requestLogs.length > 15) requestLogs.pop();
        updateLogPanelUI();
    }

    // ================= 纯净无动画 SVG 图标库 =================
    const ICON_APP = `<svg width="20" height="20" aria-hidden="true" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64" fill="none">
  <title>NNU LeaveFaster</title>
  <rect width="64" height="64" rx="16" fill="#1677FF"/>
  <path d="M20 13h18l9 9v27a3 3 0 0 1-3 3H20a3 3 0 0 1-3-3V16a3 3 0 0 1 3-3Z" fill="white"/>
  <path d="M37 13v10h10" fill="#B8D7FF"/>
  <path d="m24 35 6 6 12-13" stroke="#1677FF" stroke-width="4.5" stroke-linecap="round" stroke-linejoin="round"/>
  <path d="M9 26h13M7 33h12" stroke="#B8D7FF" stroke-width="3" stroke-linecap="round"/>
</svg>`;
    const ICON_CLOSE = `<svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line></svg>`;

    // ================= 1. 网络拦截层 =================
    function rewritePageParams(bodyOrUrl) {
        if (!bodyOrUrl) return bodyOrUrl;
        try {
            if (typeof bodyOrUrl === 'string') {
                // Fast-path：不包含分页关键词且不含 URL 编码时直接 O(1) 返回
                if (!RE_FAST_PAGE_CHECK.test(bodyOrUrl) && bodyOrUrl.indexOf('%') === -1) {
                    return bodyOrUrl;
                }
                let res = bodyOrUrl.replace(RE_JSON_PAGESIZE,
                    (_, prefix, quote) => `${prefix}${quote}${currentCustomPageSize}${quote}`);
                // EMAP 可能发送 *pageSize、%2ApageSize，或表单内 URL 编码的 JSON。
                if (!RE_JSON_START.test(res)) {
                    res = res.replace(RE_KV_ENTRY, (entry, sep, key, value) => {
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

    // 仅记录分页元数据及数组长度，不复制学生信息。
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

    // 递归提取接口响应中的图片/附件元数据，用于强力兜底预览
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
                // 金智 EMAP 常见附件下载接口兜底格式
                candidateUrl = resolveUrl(`/qljfw/sys/emapcomponent/file/getAttachmentFile/${encodeURIComponent(String(fileToken))}.do`);
            }

            if (candidateUrl && (RE_IMAGE_EXT.test(name) || RE_IMAGE_EXT.test(candidateUrl) || RE_DOWNLOAD_LINK.test(candidateUrl))) {
                if (!seenUrls.has(candidateUrl)) {
                    seenUrls.add(candidateUrl);
                    results.push({ name: name || `附件图片 ${results.length + 1}`, url: candidateUrl });
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

    // ================= 2. 样式注入 (关闭动画渐变 + 自适应 + 移动端适配 + 图片灯箱) =================
    function injectStyles() {
        const css = `
            /* ===== 彻底关闭所有过渡动画、渐变、悬浮延迟 ===== */
            *, *::before, *::after {
                transition: none !important;
                animation-duration: 0s !important;
                animation-delay: 0s !important;
            }
            .sc-animated, .bh-animated-doubleTime, .bh-single-animate, .waves-effect {
                transition: none !important;
                animation: none !important;
            }
            .bh-header-bg, .bh-headerBar,
            #nnu-ball, .nnu-btn, .bh-btn-primary, .bh-btn {
                background-image: none !important;
            }

            /* ===== 主表 75vh 大视窗 ===== */
            .nnu-tall-view .nnu-main-grid,
            .nnu-tall-view .nnu-main-grid > .jqx-grid-content {
                height: 75vh !important;
                min-height: 650px !important;
                max-height: 85vh !important;
            }

            /* ===== 审核弹窗高度自适应 ===== */
            .bh-paper-pile-dialog,
            .bh-paper-pile-dialog-dialog,
            .bh-paper-pile-dialog-container,
            [bh-paper-pile-dialog-role-container-guid],
            .bh-card-lv4.bh-dialog-con,
            .bh-window,
            .bh-dialog,
            .bh-pop,
            .el-dialog,
            .bh-paper-dialog {
                height: auto !important;
                min-height: auto !important;
                border-radius: 6px !important;
                box-shadow: 0 4px 18px rgba(0,0,0,0.18) !important;
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
                padding: 10px 16px !important;
            }

            .bh-form-group, .bh-form-row, .el-form-item {
                height: auto !important;
                min-height: auto !important;
                margin-bottom: 4px !important;
                padding-top: 1px !important;
                padding-bottom: 1px !important;
            }

            .bh-paper-pile-dialog [data-action="grid"],
            .bh-card-lv4 [data-action="grid"],
            .bh-window [data-action="grid"],
            .bh-dialog [data-action="grid"] {
                height: auto !important;
                min-height: auto !important;
                max-height: none !important;
            }

            /* ===== 流转信息完整显示 ===== */
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
                font-size: 15px !important;
                line-height: 1.6 !important;
            }

            /* ===== 处理意见置顶高亮 & 移动端一键审批栏 ===== */
            .nnu-top-highlight {
                background: #f0f7ff !important;
                border: 2px solid #1890ff !important;
                border-radius: 6px !important;
                padding: 10px 12px !important;
                margin-bottom: 10px !important;
            }
            .nnu-top-highlight .bh-form-label, .nnu-top-highlight label {
                color: #0050b3 !important;
                font-weight: bold !important;
            }
            .nnu-quick-approve-bar {
                display: flex;
                flex-wrap: wrap;
                gap: 8px;
                margin-bottom: 8px;
                padding-bottom: 8px;
                border-bottom: 1px dashed #bae0ff;
            }
            .nnu-quick-btn {
                border: none;
                border-radius: 6px;
                padding: 8px 14px;
                min-height: 38px;
                font-size: 14px;
                font-weight: 600;
                cursor: pointer;
                display: inline-flex;
                align-items: center;
                justify-content: center;
                gap: 4px;
            }
            .nnu-quick-btn-primary { background: #1677ff; color: #fff; }
            .nnu-quick-btn-primary:hover { background: #0958d9; }
            .nnu-quick-btn-outline { background: #fff; color: #1677ff; border: 1px solid #91caff; }

            /* ===== 附件图片强力兜底预览区 & 高清灯箱 ===== */
            .nnu-attachment-bar {
                background: #fafafa;
                border: 1px solid #e8e8e8;
                border-radius: 6px;
                padding: 8px 12px;
                margin: 8px 0;
            }
            .nnu-attachment-header {
                font-size: 13px;
                font-weight: 600;
                color: #333;
                margin-bottom: 6px;
                display: flex;
                justify-content: space-between;
                align-items: center;
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
                padding: 5px 8px;
                background: #fff;
                border: 1px solid #d9d9d9;
                border-radius: 5px;
                cursor: pointer;
                max-width: 240px;
            }
            .nnu-att-card:hover { border-color: #1677ff; }
            .nnu-att-thumb {
                width: 44px;
                height: 44px;
                object-fit: cover;
                border-radius: 4px;
                background: #f0f0f0;
                flex-shrink: 0;
            }
            .nnu-att-name {
                font-size: 12px;
                color: #333;
                overflow: hidden;
                text-overflow: ellipsis;
                white-space: nowrap;
            }
            #nnu-lightbox {
                position: fixed;
                inset: 0;
                background: rgba(0,0,0,0.88);
                z-index: 10000001;
                display: none;
                flex-direction: column;
                align-items: center;
                justify-content: center;
                padding: 12px;
                touch-action: none;
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
                max-width: 94vw;
                max-height: 78vh;
                object-fit: contain;
                border-radius: 4px;
                user-select: none;
                -webkit-user-drag: none;
            }
            #nnu-lb-toolbar {
                display: flex;
                flex-wrap: wrap;
                gap: 8px;
                justify-content: center;
                padding: 10px 12px;
                background: rgba(30,30,30,0.9);
                border-radius: 8px;
                margin-top: 8px;
            }
            .nnu-lb-btn {
                background: #2f2f2f;
                color: #fff;
                border: 1px solid #555;
                border-radius: 5px;
                padding: 6px 12px;
                min-height: 36px;
                font-size: 13px;
                cursor: pointer;
            }
            .nnu-lb-btn:hover { background: #1677ff; border-color: #1677ff; }

            /* ===== 胶囊悬浮球 ===== */
            #nnu-ball {
                position: fixed;
                bottom: 24px; right: 24px;
                height: 40px; padding: 0 16px;
                background: #1890ff !important;
                border-radius: 19px;
                box-shadow: 0 2px 10px rgba(0,0,0,0.2) !important;
                display: flex; align-items: center; gap: 7px;
                color: #fff;
                font-family: -apple-system, BlinkMacSystemFont, "Microsoft YaHei", sans-serif;
                font-size: 15px; font-weight: 600;
                cursor: pointer; z-index: 9999999;
                user-select: none;
            }
            #nnu-ball:hover { background: #096dd9 !important; }

            #nnu-ball-panel {
                position: fixed;
                bottom: 72px; right: 24px;
                width: 300px;
                max-width: calc(100vw - 24px);
                box-sizing: border-box;
                background: #fff;
                border: 1px solid #d9d9d9;
                border-radius: 6px;
                box-shadow: 0 4px 16px rgba(0,0,0,0.15) !important;
                padding: 16px;
                font-family: -apple-system, BlinkMacSystemFont, "Microsoft YaHei", sans-serif;
                font-size: 15px; line-height: 1.5; color: #333;
                z-index: 9999999;
                display: none; flex-direction: column; gap: 14px;
            }
            #nnu-ball-panel.show { display: flex; }

            .nnu-btn { background:#1890ff !important; color:#fff; border:1px solid transparent; border-radius:5px; padding:6px 12px; font:inherit; cursor:pointer; display:inline-flex; align-items:center; justify-content:center; }
            .nnu-btn:hover { background:#096dd9 !important; }
            .nnu-btn-secondary { background:#fff !important; color:#555; border-color:#d9d9d9; }
            .nnu-btn-secondary:hover { background:#f5f5f5 !important; }
            #nnu-panel-close { border:0; background:none; padding:4px; color:#777; cursor:pointer; display:flex; }
            #nnu-select-pagesize { font:inherit; padding:5px 8px; border:1px solid #d9d9d9; border-radius:5px; background:#fff; }
            #nnu-ball-panel details summary { cursor:pointer; color:#666; font-size:14px; }
            #nnu-ball-panel details[open] summary { margin-bottom:8px; }

            #nnu-log-container { max-height:85px; overflow-y:auto; background:#f7f9fa; border:1px solid #e8e8e8; border-radius:4px; padding:4px 6px; font-size:13px; font-family:Consolas,monospace; }
            .nnu-log-item { display:flex; justify-content:space-between; padding:2px 0; border-bottom:1px dashed #e8e8e8; }

            #nnu-toast { position:fixed; top:24px; left:50%; transform:translateX(-50%); z-index:10000002; background:#1890ff; color:#fff; padding:7px 20px; border-radius:18px; font-size:15px; box-shadow:0 2px 10px rgba(0,0,0,0.2); pointer-events:none; opacity:0; max-width:90vw; text-align:center; }
            #nnu-toast.show { opacity:1; }

            /* ===== 移动端响应式适配 ===== */
            @media (max-width: 768px) {
                .nnu-tall-view .nnu-main-grid,
                .nnu-tall-view .nnu-main-grid > .jqx-grid-content {
                    height: 60vh !important;
                    min-height: 380px !important;
                }
                .bh-paper-pile-dialog-body,
                .bh-card-lv4.bh-dialog-con .bh-dialog-center,
                .bh-window-content,
                .bh-dialog .bh-dialog-center,
                .el-dialog__body {
                    padding: 8px 10px !important;
                }
                #nnu-ball {
                    bottom: 14px;
                    right: 12px;
                    height: 36px;
                    padding: 0 12px;
                    font-size: 13px;
                }
                #nnu-ball-panel {
                    bottom: 58px;
                    right: 12px;
                    padding: 12px;
                }
                .nnu-quick-btn {
                    flex: 1 1 auto;
                }
            }
        `;
        const s = document.createElement('style');
        s.innerHTML = css;
        (document.head || document.documentElement).appendChild(s);
        if (isTallView) document.documentElement.classList.add('nnu-tall-view');
    }

    // ================= 3. 主表高度应用 (节流无循环) =================
    let _heightRafTimer = null;
    function apply75vhHeight() {
        if (!isTallView) return;
        if (_heightRafTimer) return;
        _heightRafTimer = requestAnimationFrame(() => {
            _heightRafTimer = null;
            document.documentElement.classList.add('nnu-tall-view');
            const isMobile = window.innerWidth <= 768;
            const h = isMobile ? Math.max(window.innerHeight * 0.6, 380) : Math.max(window.innerHeight * 0.75, 650);
            document.querySelectorAll('[data-action="grid"], .jqx-grid').forEach(grid => {
                if (grid.closest('.bh-paper-pile-dialog, .bh-card-lv4, .bh-window, .bh-dialog, .bh-pop, .el-dialog')) return;
                grid.classList.add('nnu-main-grid');
                if (grid.clientHeight === h) return;
                grid.style.setProperty('height', `${h}px`, 'important');
                grid.style.setProperty('min-height', `${h}px`, 'important');
                const content = grid.querySelector('.jqx-grid-content');
                if (content) content.style.setProperty('height', `${h - 60}px`, 'important');
                try {
                    if (win.jQuery && win.jQuery(grid).data('jqxGrid')) {
                        win.jQuery(grid).jqxGrid({ height: h });
                    }
                } catch (e) {}
            });
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
        if (!$) { showToast('表格组件尚未加载，请稍后重试'); return; }
        for (const el of getMainTables()) {
            const table = $(el);
            // EMAP 的底层可能是 jqxGrid 或 jqxDataTable，API 大小写不同。
            const kind = table.data('jqxGrid') ? 'jqxGrid' : table.data('jqxDataTable') ? 'jqxDataTable' : null;
            if (!kind || typeof table[kind] !== 'function') continue;
            try {
                const isGrid = kind === 'jqxGrid';
                const sizeKey = isGrid ? 'pagesize' : 'pageSize';
                const oldSize = table[kind](sizeKey);
                const oldPage = isGrid ? table[kind]('getpaginginformation') : null;
                showToast(`正在请求每页 ${currentCustomPageSize} 行，请等待表格加载`);
                // 设置组件状态，避免接口返回 50 条但组件仍按 10 条渲染/翻页。
                table[kind]({ [sizeKey]: currentCustomPageSize });
                table[kind](isGrid ? 'gotopage' : 'goToPage', 0);
                // 行数和页码都没变时，显式刷新；否则交给组件的分页事件加载。
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

    // ================= 4.5 突破 10 条批量限制与多选增强 (含 beginupdate/endupdate 批处理加速) =================
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
            if (hasJqxGrid) {
                try { $(grid).jqxGrid('beginupdate'); } catch (e) {}
                try { $(grid).jqxGrid(selectAll ? 'selectallrows' : 'clearselection'); } catch (e) {}
            }
            if (grid && $) {
                try {
                    if (typeof $(grid).emapdatatable === 'function') {
                        $(grid).emapdatatable(selectAll ? 'checkAll' : 'uncheckAll');
                    }
                } catch (e) {}
            }
            const checkboxes = document.querySelectorAll('.jqx-grid-content .jqx-checkbox, [data-action="grid"] .jqx-checkbox, #emapdatatable input[type="checkbox"]');
            for (const cb of checkboxes) {
                if (cb.tagName === 'INPUT') {
                    if (cb.checked !== selectAll) {
                        cb.checked = selectAll;
                        cb.dispatchEvent(new Event('change', { bubbles: true }));
                    }
                } else {
                    const isChecked = cb.getAttribute('aria-checked') === 'true';
                    if (isChecked !== selectAll) cb.click();
                }
            }
        } finally {
            if (hasJqxGrid) {
                try { $(grid).jqxGrid('endupdate'); } catch (e) {}
            }
            _batchSelectionLock = false;
        }
        updateBatchCountUI();
        showToast(selectAll ? '已全选当前页所有待办' : '已取消全选');
    }

    function updateBatchCountUI() {
        const count = getSelectedRecords().length;
        const countEl = document.getElementById('nnu-selected-count');
        if (countEl) countEl.textContent = `已选: ${count} 条`;
        const btnAgree = document.getElementById('nnu-btn-batch-agree');
        if (btnAgree) {
            btnAgree.textContent = count > 0 ? `批量同意 (${count}条)` : '批量同意已选';
            btnAgree.style.opacity = count > 0 ? '1' : '0.6';
        }
    }

    // O(1) 短路解锁：一旦全部目标包装完成，后续调用直接返回
    function unlockGridSelectionLimits() {
        if (_emapUnlocked && _bhTipUnlocked && _bhUtilTipUnlocked) return;
        const $ = win.jQuery;
        if (!$ || !$.fn) return;
        if (!_emapUnlocked && $.fn.emapdatatable) {
            if (!$.fn.emapdatatable._nnuUnlocked) {
                const origEmapdatatable = $.fn.emapdatatable;
                $.fn.emapdatatable = function (options, ...args) {
                    if (options && typeof options === 'object') {
                        options.maxCheckCount = 999999;
                        options.maxCheck = 999999;
                        options.checkLimit = 999999;
                        options.maxSelected = 999999;
                    }
                    return origEmapdatatable.apply(this, [options, ...args]);
                };
                $.fn.emapdatatable._nnuUnlocked = true;
            }
            _emapUnlocked = true;
        }

        if (!_bhTipUnlocked && $.bhTip) {
            if (!$.bhTip._nnuWrapped) {
                const origBhTip = $.bhTip;
                $.bhTip = function (options, ...args) {
                    const content = typeof options === 'string' ? options : (options && options.content || '');
                    if (RE_LIMIT_10.test(content)) return;
                    return origBhTip.apply(this, [options, ...args]);
                };
                $.bhTip._nnuWrapped = true;
            }
            _bhTipUnlocked = true;
        }

        if (!_bhUtilTipUnlocked && win.BH_UTILS && win.BH_UTILS.bhTip) {
            if (!win.BH_UTILS.bhTip._nnuWrapped) {
                const origBhUtilTip = win.BH_UTILS.bhTip;
                win.BH_UTILS.bhTip = function (options, ...args) {
                    const content = typeof options === 'string' ? options : (options && options.content || '');
                    if (RE_LIMIT_10.test(content)) return;
                    return origBhUtilTip.apply(this, [options, ...args]);
                };
                win.BH_UTILS.bhTip._nnuWrapped = true;
            }
            _bhUtilTipUnlocked = true;
        }
    }

    function executeBatchApprove() {
        lastInteractTime = Date.now();
        const records = getSelectedRecords();
        if (!records.length) {
            showToast('请先勾选需要批量同意的请假待办');
            return;
        }

        const nativeBatchBtn = Array.from(document.querySelectorAll('button, a, .bh-btn, [data-action]')).find(el => {
            const txt = (el.textContent || '').trim();
            const act = el.getAttribute('data-action') || '';
            return !el.closest('#nnu-ball-panel') && (/批量(?:同意|通过|审核|处理|办理)/.test(txt) || /batch(?:Review|Agree|Pass|Audit)/i.test(act)) && el.offsetParent;
        });

        if (nativeBatchBtn) {
            showToast(`正在批量提交 ${records.length} 条待办...`);
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

        showToast(`已选 ${records.length} 条，请直接点击表格上方的【批量同意】按钮提交`);
    }

    // ================= 5. 审核表单置顶、移动端一键审批与附件图片强力预览 =================
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
            const groups = form.querySelectorAll('.bh-form-group, .bh-form-row, .el-form-item, [data-name*="SHYJ"], [data-name*="SHJG"], [data-name*="opinion"]');
            let target = null;
            for (const g of groups) {
                const txt = g.textContent || '';
                if (txt.includes('审核意见') || txt.includes('处理意见') || txt.includes('审核结果') || g.querySelector('textarea')) {
                    target = g;
                    break;
                }
            }
            if (target) {
                form.dataset.nnuLifted = 'true';
                target.classList.add('nnu-top-highlight');
                form.insertBefore(target, form.firstChild);

                if (!target.querySelector('.nnu-quick-approve-bar')) {
                    const bar = document.createElement('div');
                    bar.className = 'nnu-quick-approve-bar';
                    bar.innerHTML = `
                        <button type="button" class="nnu-quick-btn nnu-quick-btn-primary" data-nnu-act="agree-submit">⚡ 一键同意并提交</button>
                        <button type="button" class="nnu-quick-btn nnu-quick-btn-outline" data-nnu-act="agree-only">✍️ 仅填同意</button>
                    `;
                    bar.addEventListener('click', e => {
                        const btn = e.target.closest('button[data-nnu-act]');
                        if (!btn) return;
                        e.preventDefault();
                        e.stopPropagation();
                        const filled = fillAgreeOpinion(document);
                        if (btn.dataset.nnuAct === 'agree-submit') {
                            showToast(filled ? '已填同意，正在提交...' : '正在尝试提交...');
                            setTimeout(() => {
                                if (submitReviewForm(document)) showToast('已一键同意并提交！');
                                else showToast('已填同意，请手动确认提交');
                            }, 80);
                        } else {
                            showToast(filled ? `已勾选【同意】并填入："${autoOpinionText}"` : '未检测到意见输入框');
                        }
                    });
                    target.insertBefore(bar, target.firstChild);
                }
            }
        });
    }

    // 使用带凭证的 fetch 读取图片流转 Blob URL，绕过手机 WebView 裂图与下载拦截
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
                    imgEl.alt = '加载失败，请点此查看原图';
                });
        };
    }

    // 轻量高清全屏灯箱（支持缩放、旋转、多图切换与手机触控）
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
                <div id="nnu-lb-caption" style="color:#ddd;font-size:13px;margin-top:6px;text-align:center"></div>
                <div id="nnu-lb-toolbar">
                    <button type="button" class="nnu-lb-btn" data-lb="prev">◀ 上一张</button>
                    <button type="button" class="nnu-lb-btn" data-lb="zoom-in">放大 +</button>
                    <button type="button" class="nnu-lb-btn" data-lb="zoom-out">缩小 -</button>
                    <button type="button" class="nnu-lb-btn" data-lb="rotate-left">↺ 左旋</button>
                    <button type="button" class="nnu-lb-btn" data-lb="rotate-right">↻ 右旋</button>
                    <button type="button" class="nnu-lb-btn" data-lb="reset">1:1</button>
                    <button type="button" class="nnu-lb-btn" data-lb="open-raw">原图</button>
                    <button type="button" class="nnu-lb-btn" data-lb="next">下一张 ▶</button>
                    <button type="button" class="nnu-lb-btn" data-lb="close" style="background:#cf1322;border-color:#cf1322">✕ 关闭</button>
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
        const dialogs = document.querySelectorAll('.bh-paper-pile-dialog, .bh-card-lv4.bh-dialog-con, .bh-window, .bh-dialog, [role="dialog"]');
        dialogs.forEach(dialog => {
            if (!dialog.offsetParent) return;
            const items = [];
            const seen = new Set();
            const addItem = (name, url) => {
                if (!url || seen.has(url)) return;
                seen.add(url);
                items.push({ name: name || `附件 ${items.length + 1}`, url });
            };

            // 1. 收集接口嗅探到的附件
            for (const att of latestAttachments) addItem(att.name, att.url);

            // 2. 扫描弹窗 DOM 中的图片与附件下载链接
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
                    <span>🖼️ 附件图片强力预览 (${items.length}张，防裂图/可旋转缩放)</span>
                    <button type="button" class="nnu-btn" style="padding:3px 10px;font-size:12px" data-nnu-open-all="1">全屏预览</button>
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

            const host = dialog.querySelector('.bh-paper-pile-dialog-body, .bh-dialog-center, .bh-window-content, .el-dialog__body') || dialog;
            const highlight = host.querySelector('.nnu-top-highlight');
            if (highlight && highlight.nextSibling) host.insertBefore(bar, highlight.nextSibling);
            else host.insertBefore(bar, host.firstChild);
        });
    }

    function scheduleDomEnhancements() {
        if (_domObserverRaf) return;
        _domObserverRaf = requestAnimationFrame(() => {
            _domObserverRaf = null;
            unlockGridSelectionLimits();
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

    // ================= 6. 悬浮球 & 面板 =================
    function updateLogPanelUI() {
        const c = document.getElementById('nnu-log-container');
        if (!c) return;
        if (!requestLogs.length) { c.innerHTML = '<span style="color:#aaa">接口监控中...</span>'; return; }
        c.innerHTML = requestLogs.map(item => {
            const color = item.isSuccess ? (item.duration > 2500 ? '#fa8c16' : '#52c41a') : '#f5222d';
            return `<div class="nnu-log-item" style="color:${color}"><span>${item.time} ${item.action}</span><span>${item.duration}ms</span></div>`;
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
        const txt = `====== NNU Leave Diagnostic Log (v1.1.0) ======\n`
            + `URL: ${location.href}\n行数:${currentCustomPageSize} | 75vh视窗:${isTallView} | 嗅探附件:${latestAttachments.length}\n`
            + `Window:${window.innerWidth}x${window.innerHeight}\n${tInfo}\n`
            + `Requests:\n${JSON.stringify(requestLogs, null, 2)}\n===========================`;
        navigator.clipboard.writeText(txt).then(() => showToast('诊断日志已复制！', 2500)).catch(() => console.log(txt));
    }

    function renderFloatingBall() {
        if (!isTopWindow || document.getElementById('nnu-ball')) return;

        const ball = document.createElement('div');
        ball.id = 'nnu-ball';
        ball.innerHTML = `<span style="display:inline-flex;align-items:center">${ICON_APP}</span><span>NNU LeaveFaster</span>`;
        document.body.appendChild(ball);

        const panel = document.createElement('div');
        panel.id = 'nnu-ball-panel';
        panel.innerHTML = `
            <div style="display:flex;justify-content:space-between;align-items:center;font-weight:600">
                <span>NNU LeaveFaster v1.1</span>
                <button id="nnu-panel-close" type="button" aria-label="关闭面板">${ICON_CLOSE}</button>
            </div>
            <div style="display:flex;justify-content:space-between;align-items:center;gap:12px">
                <label for="nnu-select-pagesize">每页行数</label>
                <select id="nnu-select-pagesize">
                    <option value="10">10</option>
                    <option value="20">20</option>
                    <option value="50">50</option>
                    <option value="100">100</option>
                </select>
                <button id="nnu-btn-apply" class="nnu-btn">刷新</button>
            </div>
            <div style="display:flex;align-items:center;justify-content:space-between;padding:8px 10px;background:#f6f9fc;border-radius:5px;border:1px solid #e5e9f2;font-size:13px">
                <span id="nnu-selected-count" style="font-weight:600;color:#1890ff">已选: 0 条</span>
                <div style="display:flex;gap:5px">
                    <button id="nnu-btn-select-all" class="nnu-btn nnu-btn-secondary" style="padding:3px 6px;font-size:12px">全选</button>
                    <button id="nnu-btn-unselect-all" class="nnu-btn nnu-btn-secondary" style="padding:3px 6px;font-size:12px">清空</button>
                    <button id="nnu-btn-batch-agree" class="nnu-btn" style="padding:3px 8px;font-size:12px">批量同意</button>
                </div>
            </div>
            <label style="cursor:pointer;display:flex;align-items:center;gap:8px">
                <input type="checkbox" id="nnu-check-tallview" ${isTallView ? 'checked' : ''}>
                <span>加高主表</span>
            </label>
            <details>
                <summary>诊断与快捷键</summary>
                <div id="nnu-log-container"><span style="color:#888">等待请求</span></div>
                <button id="nnu-btn-diag" class="nnu-btn nnu-btn-secondary" style="margin-top:10px">复制诊断日志</button>
                <div style="font-size:13px;color:#777;margin-top:10px">Alt+A 同意 · Alt+Enter 提交</div>
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
            showToast(`已选 ${currentCustomPageSize} 行，点击【刷新】生效`);
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
            if (isTallView) { apply75vhHeight(); showToast('已开启 75vh 大视窗'); }
            else { document.documentElement.classList.remove('nnu-tall-view'); showToast('已恢复原生高度'); }
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
            showToast(filled ? `已勾选【同意】并填入意见："${autoOpinionText}"` : '请先点开审核弹窗');
        }
        if (e.altKey && e.key === 'Enter') {
            e.preventDefault();
            if (submitReviewForm(document)) showToast('已提交审核！');
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
