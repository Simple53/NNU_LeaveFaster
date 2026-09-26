// ==UserScript==
// @name         NNU LeaveFaster
// @namespace    https://github.com/Simple53/NNU_LeaveFaster
// @version      1.0.0
// @description  专为南师大请假系统定制：同步jqx组件分页并刷新主表、审核模块高度自适应、关闭动画与渐变、流转信息完整显示
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

    // ================= 配置与持久化状态 =================
    const STORAGE_KEY_PAGESIZE   = 'nnu_leave_page_size';
    const STORAGE_KEY_AUTO_OPINION = 'nnu_leave_auto_opinion';
    const STORAGE_KEY_TALL_VIEW  = 'nnu_leave_tall_view';

    let currentCustomPageSize = parseInt(localStorage.getItem(STORAGE_KEY_PAGESIZE) || '20', 10);
    if (![10, 20, 50, 100].includes(currentCustomPageSize)) currentCustomPageSize = 20;
    let autoOpinionText = localStorage.getItem(STORAGE_KEY_AUTO_OPINION) || '同意';
    let isTallView = localStorage.getItem(STORAGE_KEY_TALL_VIEW) !== 'false';

    // 交互时间锁：2.5秒内严禁外部合成事件收起面板
    let lastInteractTime = 0;

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
    const ICON_CLOSE  = `<svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line></svg>`;

    // ================= 1. 网络拦截层 =================
    function rewritePageParams(bodyOrUrl) {
        if (!bodyOrUrl) return bodyOrUrl;
        try {
            if (typeof bodyOrUrl === 'string') {
                let res = bodyOrUrl;
                res = res.replace(/("(?:[\w*]*pageSize|rows|limit)"\s*:\s*)("?)(\d+)\2/gi,
                    (_, prefix, quote) => `${prefix}${quote}${currentCustomPageSize}${quote}`);
                // EMAP 可能发送 *pageSize、%2ApageSize，或表单内 URL 编码的 JSON。
                if (!/^\s*[\[{]/.test(res)) res = res.replace(/(^|[?&])([^=?&#]+)=([^&#]*)/g, (entry, sep, key, value) => {
                    try {
                        const name = decodeURIComponent(key.replace(/\+/g, ' '));
                        if (/^(?:[\w*]*pageSize|rows|limit)$/i.test(name)) {
                            return `${sep}${key}=${currentCustomPageSize}`;
                        }
                        const decoded = decodeURIComponent(value.replace(/\+/g, ' '));
                        if (/^\s*[\[{]/.test(decoded)) {
                            const rewritten = rewritePageParams(decoded);
                            if (rewritten !== decoded) return `${sep}${key}=${encodeURIComponent(rewritten)}`;
                        }
                    } catch (e) { /* 保留无法解码的原参数 */ }
                    return entry;
                });
                return res;
            }
            if (bodyOrUrl instanceof win.FormData || bodyOrUrl instanceof win.URLSearchParams) {
                for (const k of [...bodyOrUrl.keys()]) {
                    if (/^(?:[\w*]*pageSize|rows|limit)$/i.test(k)) bodyOrUrl.set(k, String(currentCustomPageSize));
                    else {
                        const value = bodyOrUrl.get(k);
                        if (typeof value === 'string' && /^\s*[\[{]/.test(value)) bodyOrUrl.set(k, rewritePageParams(value));
                    }
                }
                return bodyOrUrl;
            }
        } catch (e) {}
        return bodyOrUrl;
    }

    const _origOpen = win.XMLHttpRequest.prototype.open;
    const _origSend = win.XMLHttpRequest.prototype.send;

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
            if (typeof value === 'string' && /^\s*\{/.test(value)) return summarizePageResponse(JSON.parse(value)) || {};
            const entries = typeof value === 'string' ? new win.URLSearchParams(value.includes('?') ? value.split('?')[1].split('#')[0] : value) : value;
            const summary = {};
            for (const [key, item] of entries) {
                if (/^(?:[\w*]*pageSize|pageNumber|pageNum|pagenum|rows|limit|offset|start)$/i.test(key) && /^\d+$/.test(item)) summary[key] = Number(item);
                else if (typeof item === 'string' && /^\s*\{/.test(item)) summary[key] = summarizePageResponse(JSON.parse(item)) || {};
            }
            return summary;
        } catch (e) { return {}; }
    }

    win.XMLHttpRequest.prototype.open = function (method, url, async, user, password) {
        this._startTime = Date.now();
        if (typeof url === 'string' && /queryUserTasks\.do(?:[?#]|$)/i.test(url)) url = rewritePageParams(url);
        this._requestUrl = url;
        return _origOpen.call(this, method, url, async, user, password);
    };

    win.XMLHttpRequest.prototype.send = function (body) {
        const t0 = Date.now();
        const reqUrl = this._requestUrl || '';
        const requestedSize = currentCustomPageSize;
        if (body && /queryUserTasks\.do(?:[?#]|$)/i.test(reqUrl)) {
            body = rewritePageParams(body);
        }
        const sentPaging = /queryUserTasks\.do(?:[?#]|$)/i.test(reqUrl)
            ? { url: summarizePageRequest(reqUrl), body: summarizePageRequest(body) } : null;
        this.addEventListener('loadend', () => {
            const dur = Date.now() - t0;
            const name = reqUrl.split('?')[0].split('/').pop() || '接口';
            let details = `${this.status}`;
            if (/queryUserTasks\.do$/i.test(name)) {
                details += ` | 设置行数:${requestedSize} | 请求分页:${JSON.stringify(sentPaging)}`;
                try {
                    const payload = this.responseType === 'json' ? this.response : JSON.parse(this.responseText);
                    details += ` | 返回分页:${JSON.stringify(summarizePageResponse(payload) || {})}`;
                } catch (e) { details += ' | 返回内容不是可解析的 JSON'; }
            }
            if (name.endsWith('.do')) addRequestLog(name, dur, details, this.status === 200);
            if (/getReviewData|review\.do/i.test(name)) dismissMasks(true);
            else dismissMasks(false);
        });
        return _origSend.call(this, body);
    };

    if (win.fetch) {
        const _origFetch = win.fetch;
        win.fetch = function (input, init) {
            const t0 = Date.now();
            const reqUrl = typeof input === 'string' ? input : (input && input.url || '');
            if (/queryUserTasks\.do(?:[?#]|$)/i.test(reqUrl)) {
                if (typeof input === 'string') input = rewritePageParams(input);
                if (init && init.body) init = { ...init, body: rewritePageParams(init.body) };
            }
            return _origFetch.call(this, input, init).then(res => {
                const dur = Date.now() - t0;
                const name = reqUrl.split('?')[0].split('/').pop() || 'Fetch';
                if (name.endsWith('.do')) addRequestLog(name, dur, `${res.status}`);
                if (/getReviewData|review\.do/i.test(name)) dismissMasks(true);
                else dismissMasks(false);
                return res;
            }).catch(err => { dismissMasks(false); throw err; });
        };
    }

    // ================= 2. 样式注入 (视窗收窄 + 高度全自适应 + 彻底关闭所有动画渐变) =================
    function injectStyles() {
        const css = `
            /* ===== 核心要求3：彻底关闭所有过渡动画、渐变、悬浮延迟 ===== */
            *, *::before, *::after {
                transition: none !important;
                animation-duration: 0s !important;
                animation-delay: 0s !important;
            }
            .sc-animated, .bh-animated-doubleTime, .bh-single-animate, .waves-effect {
                transition: none !important;
                animation: none !important;
            }
            /* 消除所有渐变背景，改为纯平整纯色 */
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

            /* ===== 核心要求2：审核页面视窗高度全自适应 (根据反馈不修改原生宽度) ===== */
            /* 精准命中实际源码中的 bhPaperPileDialog 和各类弹窗容器 */
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

            /* 审核页面的所有子模块高度全部自适应包裹，绝不写死高度 */
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

            /* 表单字段紧凑无冗余空白 */
            .bh-form-group, .bh-form-row, .el-form-item {
                height: auto !important;
                min-height: auto !important;
                margin-bottom: 4px !important;
                padding-top: 1px !important;
                padding-bottom: 1px !important;
            }

            /* 详情表格完整展开，不限制流转记录高度 */
            .bh-paper-pile-dialog [data-action="grid"],
            .bh-card-lv4 [data-action="grid"],
            .bh-window [data-action="grid"],
            .bh-dialog [data-action="grid"] {
                height: auto !important;
                min-height: auto !important;
                max-height: none !important;
            }

            /* ===== 流转信息完整显示，不截断内容或限制行数 ===== */
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

            /* ===== 处理意见置顶高亮 ===== */
            .nnu-top-highlight {
                background: #f0f7ff !important;
                border: 2px solid #1890ff !important;
                border-radius: 4px !important;
                padding: 8px 12px !important;
                margin-bottom: 10px !important;
            }
            .nnu-top-highlight .bh-form-label, .nnu-top-highlight label {
                color: #0050b3 !important;
                font-weight: bold !important;
            }

            /* ===== 胶囊悬浮球 (纯色、无渐变、无动画) ===== */
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
                max-width: calc(100vw - 48px);
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

            #nnu-toast { position:fixed; top:24px; left:50%; transform:translateX(-50%); z-index:10000000; background:#1890ff; color:#fff; padding:7px 20px; border-radius:18px; font-size:15px; box-shadow:0 2px 10px rgba(0,0,0,0.2); pointer-events:none; opacity:0; }
            #nnu-toast.show { opacity:1; }
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
            const h = Math.max(window.innerHeight * 0.75, 650);
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
        // 不再点击已选中的筛选标签假装刷新，也不把未验证的 API 调用当作成功。
        showToast('未找到可操作的主表组件，请复制诊断日志', 3500);
    }

    // ================= 5. 处理意见置顶与紧凑整理 =================
    function liftReviewFormToTop() {
        const containers = document.querySelectorAll('.bh-paper-pile-dialog, .bh-card-lv4 .bh-dialog-center, .bh-window .bh-window-content, .bh-dialog .bh-dialog-center, .bh-dialog-content');
        containers.forEach(form => {
            if (form.dataset.nnuLifted) return;
            const groups = form.querySelectorAll('.bh-form-group, .bh-form-row, .el-form-item, [data-name*="SHYJ"], [data-name*="SHJG"], [data-name*="opinion"]');
            let target = null;
            for (const g of groups) {
                const txt = g.textContent || '';
                if (txt.includes('审核意见') || txt.includes('处理意见') || txt.includes('审核结果') || g.querySelector('textarea')) {
                    target = g; break;
                }
            }
            if (target) {
                form.dataset.nnuLifted = 'true';
                target.classList.add('nnu-top-highlight');
                form.insertBefore(target, form.firstChild);
            }
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
            tInfo += `  [${i+1}] <${t.tagName.toLowerCase()}> id:"${t.id}" class:"${t.className}" 尺寸:${t.clientWidth}x${t.clientHeight}\n`;
            try {
                const table = win.jQuery(t);
                if (table.data('jqxGrid')) tInfo += `    jqxGrid分页:${JSON.stringify(table.jqxGrid('getpaginginformation'))}\n`;
                else if (table.data('jqxDataTable')) tInfo += `    jqxDataTable每页:${table.jqxDataTable('pageSize')}\n`;
            } catch (e) { tInfo += `    组件诊断:${String(e)}\n`; }
        });
        const txt = `====== NNU Leave Diagnostic Log (v1.0.0) ======\n`
            + `URL: ${location.href}\n行数:${currentCustomPageSize} | 75vh视窗:${isTallView}\n`
            + `Window:${window.innerWidth}x${window.innerHeight}\n${tInfo}\n`
            + `Requests:\n${JSON.stringify(requestLogs, null, 2)}\n===========================`;
        navigator.clipboard.writeText(txt).then(() => showToast('诊断日志已复制！', 2500)).catch(() => console.log(txt));
    }

    function renderFloatingBall() {
        if (!isTopWindow || document.getElementById('nnu-ball')) return;

        // 胶囊悬浮球
        const ball = document.createElement('div');
        ball.id = 'nnu-ball';
        ball.innerHTML = `<span style="display:inline-flex;align-items:center">${ICON_APP}</span><span>NNU LeaveFaster</span>`;
        document.body.appendChild(ball);

        // 面板
        const panel = document.createElement('div');
        panel.id = 'nnu-ball-panel';
        panel.innerHTML = `
            <div style="display:flex;justify-content:space-between;align-items:center;font-weight:600">
                <span>NNU LeaveFaster</span>
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
    }

    // ================= 7. 快捷键 =================
    function handleKeys(e) {
        if (e.altKey && (e.key === 'a' || e.key === 'A')) {
            e.preventDefault();
            let filled = false;
            document.querySelectorAll('input[type="radio"]').forEach(r => {
                if ((r.parentElement && r.parentElement.textContent.includes('同意')) || r.labels && Array.from(r.labels).some(l => l.textContent.includes('同意'))) {
                    r.click(); filled = true;
                }
            });
            document.querySelectorAll('textarea').forEach(ta => {
                if (ta.offsetParent) {
                    ta.value = autoOpinionText;
                    ta.dispatchEvent(new Event('input', { bubbles: true }));
                    ta.dispatchEvent(new Event('change', { bubbles: true }));
                    filled = true;
                }
            });
            showToast(filled ? `已勾选【同意】并填入意见："${autoOpinionText}"` : '请先点开审核弹窗');
        }
        if (e.altKey && e.key === 'Enter') {
            e.preventDefault();
            const btn = Array.from(document.querySelectorAll('button, a.bh-btn-primary, .bh-btn-primary')).find(b => {
                const t = (b.textContent || '').trim();
                return ['确定','提交','通过','保存'].includes(t) && b.offsetParent && !b.disabled;
            });
            if (btn) { btn.click(); showToast('已提交审核！'); }
        }
    }

    // ================= 8. 初始化 =================
    function init() {
        injectStyles();

        const onReady = () => {
            renderFloatingBall();
            apply75vhHeight();
            document.addEventListener('keydown', handleKeys);

            win.addEventListener('resize', apply75vhHeight);

            const observer = new MutationObserver(() => {
                liftReviewFormToTop();
            });
            observer.observe(document.body || document.documentElement, { childList: true, subtree: true });
        };

        if (document.readyState === 'loading') {
            document.addEventListener('DOMContentLoaded', onReady);
        } else {
            onReady();
        }

        win.addEventListener('load', () => {
            setTimeout(apply75vhHeight, 500);
            setTimeout(apply75vhHeight, 1500);
        });
    }

    init();
})();
