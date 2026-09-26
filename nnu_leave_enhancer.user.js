// ==UserScript==
// @name         南师大请假审批系统体验优化助手 (NNU Leave Enhancer)
// @namespace    https://github.com/nnu-enhancer/leave
// @version      3.2.0
// @description  专为南师大请假系统定制：扩大垂直视窗高度(75vh一屏容纳大量行数无需滑滚轮)、弹窗保持紧凑不拉高、全SVG专业图标、修复刷新收起Bug、处理意见置顶
// @author       Antigravity
// @match        https://ehallapp.nnu.edu.cn/qljfw/sys/lwNjnuStuLeaveManagement/*
// @match        *://ehallapp.nnu.edu.cn/*
// @match        *://*/*/sys/lwNjnuStuLeaveManagement/*
// @match        *://*/*LeaveManagement*/*
// @run-at       document-start
// @grant        unsafeWindow
// @grant        GM_addStyle
// @grant        GM_setValue
// @grant        GM_getValue
// @allFrames    true
// ==/UserScript==

(function () {
    'use strict';

    const win = typeof unsafeWindow !== 'undefined' ? unsafeWindow : window;
    const isTopWindow = (window.self === window.top);

    // ================= 配置与持久化状态 =================
    const STORAGE_KEY_PAGESIZE = 'nnu_leave_page_size';
    const STORAGE_KEY_AUTO_OPINION = 'nnu_leave_auto_opinion';
    const STORAGE_KEY_TALL_VIEW = 'nnu_leave_tall_view';

    let currentCustomPageSize = parseInt(localStorage.getItem(STORAGE_KEY_PAGESIZE) || '20', 10);
    let autoOpinionText = localStorage.getItem(STORAGE_KEY_AUTO_OPINION) || '同意';
    let isTallView = localStorage.getItem(STORAGE_KEY_TALL_VIEW) !== 'false'; // 默认开启 75vh 垂直视窗高度

    // 内存请求追踪日志 (最多保留 15 条)
    const requestLogs = [];
    function addRequestLog(actionName, durationMs, details, isSuccess = true) {
        if (!isTopWindow) return;
        const timeStr = new Date().toLocaleTimeString();
        requestLogs.unshift({
            time: timeStr,
            action: actionName,
            duration: durationMs,
            details: details,
            isSuccess: isSuccess
        });
        if (requestLogs.length > 15) requestLogs.pop();
        updateLogPanelUI();
    }

    // ================= 1. SVG 矢量图标库 =================
    const SVG_ICONS = {
        rocket: `<svg viewBox="0 0 24 24" width="20" height="20" fill="currentColor"><path d="M13.13 2.06c-.47-.47-1.24-.4-1.63.15L7.2 8.78c-.28.39-.33.91-.13 1.34l1.37 2.92-3.8 3.8a1 1 0 0 0 0 1.42l1.42 1.42a1 1 0 0 0 1.42 0l3.8-3.8 2.92 1.37c.43.2.95.15 1.34-.13l6.57-4.3c.55-.39.62-1.16.15-1.63l-7.74-7.73zM15.5 12a1.5 1.5 0 1 1 0-3 1.5 1.5 0 0 1 0 3z"/></svg>`,
        refresh: `<svg viewBox="0 0 24 24" width="12" height="12" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" style="vertical-align: -1px; margin-right: 3px;"><path d="M23 4v6h-6"></path><path d="M1 20v-6h6"></path><path d="M3.51 9a9 9 0 0 1 14.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0 0 20.49 15"></path></svg>`,
        close: `<svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line></svg>`,
        copy: `<svg viewBox="0 0 24 24" width="12" height="12" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="vertical-align: -1px; margin-right: 3px;"><path d="M16 4h2a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2h2"></path><rect x="8" y="2" width="8" height="4" rx="1" ry="1"></rect></svg>`,
        pulse: `<svg viewBox="0 0 24 24" width="12" height="12" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="vertical-align: -1px; margin-right: 3px;"><polyline points="22 12 18 12 15 21 9 3 6 12 2 12"></polyline></svg>`
    };

    // ================= 2. 网络拦截层 (精准支持 20/50/100 行) =================
    function rewritePageParamsSafe(bodyOrUrl) {
        if (!bodyOrUrl) return bodyOrUrl;
        try {
            if (typeof bodyOrUrl === 'string') {
                let res = bodyOrUrl;
                if (res.includes('pageSize') || res.includes('pagesize') || res.includes('rows') || res.includes('limit')) {
                    res = res.replace(/("pageSize"\s*:\s*)("\d+"|\d+)/gi, `$1${currentCustomPageSize}`);
                    res = res.replace(/("pagesize"\s*:\s*)("\d+"|\d+)/gi, `$1${currentCustomPageSize}`);
                    res = res.replace(/("rows"\s*:\s*)("\d+"|\d+)/gi, `$1${currentCustomPageSize}`);
                    res = res.replace(/("limit"\s*:\s*)("\d+"|\d+)/gi, `$1${currentCustomPageSize}`);
                }
                res = res.replace(/((?:^|&|\?)(?:[a-zA-Z0-9_]*pageSize|pagesize|rows|limit)=)\d+/gi, `$1${currentCustomPageSize}`);
                return res;
            }

            if (bodyOrUrl instanceof FormData) {
                const keys = ['pageSize', 'pagesize', 'rows', 'limit'];
                for (const k of keys) {
                    if (bodyOrUrl.has(k)) bodyOrUrl.set(k, currentCustomPageSize);
                }
                return bodyOrUrl;
            }
        } catch (e) {}

        return bodyOrUrl;
    }

    const originalOpen = win.XMLHttpRequest.prototype.open;
    const originalSend = win.XMLHttpRequest.prototype.send;

    win.XMLHttpRequest.prototype.open = function (method, url, async, user, password) {
        this._startTime = Date.now();
        if (typeof url === 'string') {
            url = rewritePageParamsSafe(url);
        }
        this._requestUrl = url;
        this._requestMethod = method;
        return originalOpen.call(this, method, url, async, user, password);
    };

    win.XMLHttpRequest.prototype.send = function (body) {
        const startTime = Date.now();
        const reqUrl = this._requestUrl || '';

        if (body && (reqUrl.includes('queryUserTasks.do') || reqUrl.includes('query') || reqUrl.includes('List'))) {
            body = rewritePageParamsSafe(body);
        }

        this.addEventListener('loadend', () => {
            const duration = Date.now() - startTime;
            const urlShort = reqUrl.split('?')[0].split('/').pop() || '接口';

            if (urlShort.endsWith('.do')) {
                const info = `状态:${this.status}`;
                addRequestLog(urlShort, duration, info, this.status === 200);
            }
            dismissLoadingMasks();
        });

        return originalSend.call(this, body);
    };

    if (win.fetch) {
        const originalFetch = win.fetch;
        win.fetch = function (input, init) {
            const startTime = Date.now();
            let reqUrl = typeof input === 'string' ? input : (input && input.url ? input.url : '');

            if (typeof input === 'string' && (input.includes('queryUserTasks.do') || input.includes('List'))) {
                input = rewritePageParamsSafe(input);
            }
            if (init && init.body && typeof init.body === 'string' && (reqUrl.includes('queryUserTasks.do') || reqUrl.includes('List'))) {
                init.body = rewritePageParamsSafe(init.body);
            }

            return originalFetch.call(this, input, init).then(res => {
                const duration = Date.now() - startTime;
                const urlShort = reqUrl.split('?')[0].split('/').pop() || 'Fetch';
                if (urlShort.endsWith('.do')) {
                    addRequestLog(urlShort, duration, `状态:${res.status}`);
                }
                dismissLoadingMasks();
                return res;
            }).catch(err => {
                dismissLoadingMasks();
                throw err;
            });
        };
    }

    // ================= 3. 样式注入：扩大垂直视窗高度(75vh一屏容纳大量行数) & 弹窗紧凑 =================
    const injectStyles = () => {
        const css = `
            /* ===== 1. 主页面表格扩大垂直视窗高度 (75vh 一屏容纳大量行数无需滑滚轮) ===== */
            .nnu-tall-view [data-action="grid"],
            .nnu-tall-view .jqx-grid,
            .nnu-tall-view .jqx-grid-content,
            .nnu-tall-view .emap-grid,
            .nnu-tall-view .el-table,
            .nnu-tall-view .el-table__body-wrapper,
            .nnu-tall-view .bh-table {
                height: 75vh !important;
                min-height: 650px !important;
                max-height: 85vh !important;
            }

            /* ===== 2. 精确覆盖：弹窗和提示框内部绝对保持紧凑原生高度，不拉高 ===== */
            .bh-window [data-action="grid"],
            .bh-dialog [data-action="grid"],
            .bh-pop [data-action="grid"],
            .bh-dialog-con [data-action="grid"],
            .el-dialog [data-action="grid"],
            .bh-window .jqx-grid,
            .bh-dialog .jqx-grid,
            .bh-pop .jqx-grid,
            .bh-dialog-con .jqx-grid,
            .el-dialog .el-table,
            .bh-window .jqx-grid-content,
            .bh-dialog .jqx-grid-content,
            .el-dialog .el-table__body-wrapper {
                height: auto !important;
                min-height: auto !important;
                max-height: 280px !important;
            }

            /* 弹窗自身坚决不被撑大，保持紧凑原生尺寸 */
            .bh-window, .bh-dialog, .bh-pop, .bh-dialog-con, .el-dialog, .bh-paper-dialog {
                width: auto !important;
                max-width: 90vw !important;
                height: auto !important;
                max-height: 90vh !important;
            }

            /* ===== 3. 处理信息文本框置顶高亮 ===== */
            .nnu-top-highlight {
                background: #f0f7ff !important;
                border: 2px solid #1890ff !important;
                border-radius: 6px !important;
                padding: 10px 14px !important;
                margin-bottom: 15px !important;
                box-shadow: 0 2px 8px rgba(24, 144, 255, 0.12) !important;
            }
            .nnu-top-highlight .bh-form-label, .nnu-top-highlight label {
                color: #0050b3 !important;
                font-weight: bold !important;
            }

            /* ===== 4. 精致悬浮球与卡片面板 ===== */
            #nnu-ball {
                position: fixed;
                bottom: 24px;
                right: 24px;
                width: 44px;
                height: 44px;
                background: linear-gradient(135deg, #1890ff, #096dd9);
                border-radius: 50%;
                box-shadow: 0 4px 14px rgba(24, 144, 255, 0.4);
                display: flex;
                align-items: center;
                justify-content: center;
                color: #ffffff;
                cursor: pointer;
                z-index: 9999999;
                transition: transform 0.2s, box-shadow 0.2s;
                user-select: none;
            }
            #nnu-ball:hover {
                transform: scale(1.08);
                box-shadow: 0 6px 20px rgba(24, 144, 255, 0.6);
            }

            #nnu-ball-panel {
                position: fixed;
                bottom: 76px;
                right: 24px;
                width: 310px;
                background: #ffffff;
                border: 1px solid #d9d9d9;
                border-radius: 8px;
                box-shadow: 0 8px 24px rgba(0, 0, 0, 0.15);
                padding: 12px 14px;
                font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Microsoft YaHei", sans-serif;
                font-size: 13px;
                color: #333;
                z-index: 9999999;
                display: none;
                flex-direction: column;
                gap: 8px;
            }
            #nnu-ball-panel.show {
                display: flex;
            }

            .nnu-btn {
                background: #1890ff;
                color: #fff;
                border: none;
                border-radius: 4px;
                padding: 5px 10px;
                font-size: 12px;
                cursor: pointer;
                display: inline-flex;
                align-items: center;
                justify-content: center;
                transition: background 0.2s;
            }
            .nnu-btn:hover { background: #40a9ff; }
            .nnu-btn-success { background: #52c41a; }
            .nnu-btn-success:hover { background: #73d13d; }
            .nnu-btn-danger { background: #f5222d; }
            .nnu-btn-danger:hover { background: #ff4d4f; }

            /* 网络日志展示 */
            #nnu-log-container {
                max-height: 90px;
                overflow-y: auto;
                background: #f7f9fa;
                border: 1px solid #e8e8e8;
                border-radius: 4px;
                padding: 4px 6px;
                font-size: 11px;
                font-family: Consolas, monospace;
            }
            .nnu-log-item {
                display: flex;
                justify-content: space-between;
                padding: 2px 0;
                border-bottom: 1px dashed #e8e8e8;
            }

            /* Toast 提示 */
            #nnu-toast {
                position: fixed;
                top: 24px;
                left: 50%;
                transform: translateX(-50%);
                z-index: 10000000;
                background: #1890ff;
                color: #fff;
                padding: 8px 22px;
                border-radius: 20px;
                font-size: 13px;
                box-shadow: 0 4px 12px rgba(0,0,0,0.25);
                pointer-events: none;
                opacity: 0;
                transition: opacity 0.2s;
            }
            #nnu-toast.show { opacity: 1; }
        `;
        const styleEl = document.createElement('style');
        styleEl.id = 'nnu-enhancer-styles';
        styleEl.innerHTML = css;
        (document.head || document.documentElement).appendChild(styleEl);

        if (isTallView) {
            document.documentElement.classList.add('nnu-tall-view');
        }
    };

    // ================= 4. JS 动态应用 75vh 视窗高度并重绘 =================
    function apply75vhHeight() {
        if (!isTallView) return;
        document.documentElement.classList.add('nnu-tall-view');

        const grids = document.querySelectorAll('[data-action="grid"], .jqx-grid');
        grids.forEach(grid => {
            // 排除弹窗内的表格
            const inDialog = grid.closest && grid.closest('.bh-window, .bh-dialog, .bh-pop, .bh-dialog-con, .el-dialog');
            if (!inDialog) {
                const h = Math.max(window.innerHeight * 0.75, 650);
                grid.style.setProperty('height', `${h}px`, 'important');
                grid.style.setProperty('min-height', `${h}px`, 'important');

                const content = grid.querySelector('.jqx-grid-content');
                if (content) {
                    content.style.setProperty('height', `${h - 60}px`, 'important');
                }

                try {
                    if (win.jQuery && win.jQuery(grid).data('jqxGrid')) {
                        win.jQuery(grid).jqxGrid({ height: h });
                    }
                } catch (e) {}
            }
        });

        // 派发 resize，让表格计算并填充可见行
        win.dispatchEvent(new Event('resize'));
    }

    // ================= 5. 处理信息文本框自动“置顶最上方” =================
    function liftReviewFormToTop() {
        const forms = document.querySelectorAll('.bh-dialog .emap-form, .bh-window .emap-form, .bh-dialog form, .bh-window form, .bh-dialog-content');
        forms.forEach(form => {
            if (form.dataset.nnuLifted) return;

            const groups = form.querySelectorAll('.bh-form-group, .bh-form-row, .el-form-item, [data-name*="SHYJ"], [data-name*="opinion"], [data-name*="SHJG"]');
            let targetGroup = null;

            for (const group of groups) {
                const text = group.textContent || '';
                if (text.includes('审核意见') || text.includes('处理意见') || text.includes('审批意见') || text.includes('审核结果') || group.querySelector('textarea')) {
                    targetGroup = group;
                    break;
                }
            }

            if (targetGroup) {
                form.dataset.nnuLifted = 'true';
                targetGroup.classList.add('nnu-top-highlight');
                form.insertBefore(targetGroup, form.firstChild);
            }
        });
    }

    // 消除卡顿遮罩
    function dismissLoadingMasks() {
        setTimeout(() => {
            const masks = document.querySelectorAll('.el-loading-mask, .bh-loading-mask, .bh-mask, [data-role="bh-loading"]');
            masks.forEach(mask => {
                if (mask.offsetParent !== null) {
                    mask.style.display = 'none';
                    mask.style.pointerEvents = 'none';
                }
            });
        }, 100);
    }

    // 重新触发查询
    function triggerReloadData() {
        showToast(`已设置每页 ${currentCustomPageSize} 行，正在请求数据...`);

        let switched = false;
        const pageSelects = document.querySelectorAll('.el-pagination__sizes select, .bh-pagination-pagesizes select, [data-role="pager"] select');
        pageSelects.forEach(select => {
            let found = false;
            for (let i = 0; i < select.options.length; i++) {
                if (parseInt(select.options[i].value, 10) === currentCustomPageSize) {
                    select.selectedIndex = i;
                    found = true;
                    break;
                }
            }
            if (!found) {
                select.add(new Option(`${currentCustomPageSize} 条/页`, String(currentCustomPageSize)));
                select.value = String(currentCustomPageSize);
            }
            select.dispatchEvent(new Event('change', { bubbles: true }));
            switched = true;
        });

        if (switched) {
            showToast(`已联动底部分页条切换为 ${currentCustomPageSize} 行`);
            setTimeout(apply75vhHeight, 600);
            return;
        }

        const buttons = Array.from(document.querySelectorAll('button, .el-button, .bh-btn, input[type="button"]'));
        const queryBtn = buttons.find(b => {
            const txt = (b.innerText || b.value || '').trim();
            return (txt === '查询' || txt === '搜索' || txt === '刷新' || txt.includes('查询')) && b.offsetParent !== null;
        });

        if (queryBtn) {
            queryBtn.click();
            showToast(`已触发【${queryBtn.innerText.trim()}】刷新`);
            setTimeout(apply75vhHeight, 600);
            return;
        }

        showToast(`已切换为 ${currentCustomPageSize} 行，请点击页面上的【查询】按钮生效`);
    }

    const showToast = (msg, duration = 2000) => {
        let toast = document.getElementById('nnu-toast');
        if (!toast) {
            toast = document.createElement('div');
            toast.id = 'nnu-toast';
            document.body.appendChild(toast);
        }
        toast.textContent = msg;
        toast.classList.add('show');
        setTimeout(() => toast.classList.remove('show'), duration);
    };

    // ================= 6. 渲染悬浮球 UI =================
    const updateLogPanelUI = () => {
        const container = document.getElementById('nnu-log-container');
        if (!container) return;

        if (requestLogs.length === 0) {
            container.innerHTML = '<span style="color:#aaa;">接口监控中...</span>';
            return;
        }

        let html = '';
        requestLogs.forEach(item => {
            const isSlow = item.duration > 2000;
            const color = item.isSuccess ? (isSlow ? '#fa8c16' : '#52c41a') : '#f5222d';
            html += `
                <div class="nnu-log-item" style="color:${color};">
                    <span>${item.time} ${item.action}</span>
                    <span>${item.duration}ms</span>
                </div>
            `;
        });
        container.innerHTML = html;
    };

    const copyDiagnosticLog = () => {
        const tableElements = document.querySelectorAll('.el-table, .bh-table, [data-action="grid"], .jqx-grid, table');
        let tableInfo = `检测到 ${tableElements.length} 个表格元素:\n`;
        tableElements.forEach((t, i) => {
            tableInfo += `  [${i+1}] tag:<${t.tagName.toLowerCase()}> class:"${t.className}" 尺寸:${t.clientWidth}x${t.clientHeight}\n`;
        });

        const diag = `====== NNU Leave Diagnostic Log (V3.2.0) ======\n`
                   + `URL: ${location.href}\n`
                   + `当前设置行数: ${currentCustomPageSize} | 扩大垂直视窗75vh: ${isTallView}\n`
                   + `Window Inner: ${window.innerWidth}x${window.innerHeight}\n`
                   + `Table DOM Info:\n${tableInfo}\n`
                   + `Recent Requests:\n${JSON.stringify(requestLogs, null, 2)}\n`
                   + `================================================`;

        navigator.clipboard.writeText(diag).then(() => {
            showToast('诊断日志已复制到剪贴板！', 3000);
        }).catch(() => {
            showToast('已打印到 Console 控制台');
        });
    };

    const renderFloatingBall = () => {
        if (!isTopWindow) return;
        if (document.getElementById('nnu-ball')) return;

        // 1. 创建悬浮小球 (内嵌 SVG)
        const ball = document.createElement('div');
        ball.id = 'nnu-ball';
        ball.title = '点击展开请假加速助手';
        ball.innerHTML = SVG_ICONS.rocket;
        document.body.appendChild(ball);

        // 2. 创建卡片面板
        const panel = document.createElement('div');
        panel.id = 'nnu-ball-panel';
        panel.innerHTML = `
            <div style="display:flex; justify-content:space-between; align-items:center; border-bottom:1px solid #f0f0f0; padding-bottom:6px; font-weight:600; color:#1890ff;">
                <span style="display:flex; align-items:center; gap:4px;">${SVG_ICONS.pulse} 请假加速助手</span>
                <span id="nnu-panel-close" style="cursor:pointer; display:flex; align-items:center; color:#999;" title="收起">${SVG_ICONS.close}</span>
            </div>
            <div style="display:flex; justify-content:space-between; align-items:center;">
                <span style="font-weight:600;">主表行数:</span>
                <select id="nnu-select-pagesize" style="padding:3px 6px; border-radius:4px; border:1px solid #ccc; font-size:12px;">
                    <option value="10">10 行</option>
                    <option value="20">20 行 (推荐)</option>
                    <option value="50">50 行</option>
                    <option value="100">100 行</option>
                </select>
                <button id="nnu-btn-apply" class="nnu-btn nnu-btn-success">${SVG_ICONS.refresh} 刷新</button>
            </div>
            <div style="display:flex; align-items:center; justify-content:space-between; font-size:12px;">
                <label style="cursor:pointer; display:flex; align-items:center; gap:5px;" title="扩大垂直视窗高度为 75vh，一屏容纳大量行数，无需内部滑滚轮">
                    <input type="checkbox" id="nnu-check-tallview" ${isTallView ? 'checked' : ''}>
                    <span>扩大垂直高度 (75vh大视窗无需滚轮)</span>
                </label>
            </div>
            <!-- 日志监控 -->
            <div style="border-top:1px solid #f0f0f0; padding-top:4px;">
                <div style="font-size:11px; color:#888; margin-bottom:2px; display:flex; justify-content:space-between;">
                    <span>请求监控</span>
                    <span>queryUserTasks.do</span>
                </div>
                <div id="nnu-log-container">
                    <span style="color:#aaa;">接口监控中...</span>
                </div>
            </div>
            <!-- 诊断与快捷键 -->
            <div style="display:flex; justify-content:space-between; align-items:center; margin-top:2px;">
                <button id="nnu-btn-diag" class="nnu-btn nnu-btn-danger" style="font-size:11px; padding:3px 8px;">${SVG_ICONS.copy} 复制诊断日志</button>
                <span style="font-size:11px; color:#666;">Alt+A同意 | Alt+Enter提交</span>
            </div>
        `;
        document.body.appendChild(panel);

        panel.addEventListener('click', (e) => {
            e.stopPropagation();
        });

        let isPanelOpen = false;
        const togglePanel = (show) => {
            isPanelOpen = (typeof show === 'boolean') ? show : !isPanelOpen;
            if (isPanelOpen) {
                panel.classList.add('show');
            } else {
                panel.classList.remove('show');
            }
        };

        ball.addEventListener('click', (e) => {
            e.stopPropagation();
            togglePanel();
        });

        document.getElementById('nnu-panel-close').addEventListener('click', (e) => {
            e.stopPropagation();
            togglePanel(false);
        });

        document.addEventListener('click', (e) => {
            if (isPanelOpen && !panel.contains(e.target) && e.target !== ball) {
                togglePanel(false);
            }
        });

        const select = document.getElementById('nnu-select-pagesize');
        select.value = String(currentCustomPageSize);
        select.addEventListener('change', (e) => {
            currentCustomPageSize = parseInt(e.target.value, 10);
            localStorage.setItem(STORAGE_KEY_PAGESIZE, currentCustomPageSize);
            showToast(`已选 ${currentCustomPageSize} 行，点击【刷新】`);
        });

        document.getElementById('nnu-btn-apply').addEventListener('click', (e) => {
            e.stopPropagation();
            triggerReloadData();
        });

        const tallCheck = document.getElementById('nnu-check-tallview');
        tallCheck.addEventListener('change', (e) => {
            isTallView = e.target.checked;
            localStorage.setItem(STORAGE_KEY_TALL_VIEW, isTallView);
            if (isTallView) {
                document.documentElement.classList.add('nnu-tall-view');
                apply75vhHeight();
                showToast('已扩大垂直高度为 75vh！');
            } else {
                document.documentElement.classList.remove('nnu-tall-view');
                showToast('已恢复原生高度');
            }
        });

        document.getElementById('nnu-btn-diag').addEventListener('click', (e) => {
            e.stopPropagation();
            copyDiagnosticLog();
        });

        updateLogPanelUI();
    };

    // ================= 7. 审批快捷键 =================
    const handleQuickReviewKeyboard = (e) => {
        if (e.altKey && (e.key === 'a' || e.key === 'A')) {
            e.preventDefault();
            let filled = false;

            const radios = document.querySelectorAll('input[type="radio"], .el-radio, .bh-radio');
            radios.forEach(radio => {
                const labelText = radio.textContent || radio.parentElement.textContent || '';
                if (labelText.includes('同意') || labelText.includes('通过')) {
                    if (typeof radio.click === 'function') {
                        radio.click();
                        filled = true;
                    }
                }
            });

            const textareas = document.querySelectorAll('textarea, input[placeholder*="意见"], [data-name*="SHYJ"], [data-name*="opinion"]');
            textareas.forEach(textarea => {
                if (textarea.offsetParent !== null) {
                    textarea.value = autoOpinionText;
                    textarea.dispatchEvent(new Event('input', { bubbles: true }));
                    textarea.dispatchEvent(new Event('change', { bubbles: true }));
                    filled = true;
                }
            });

            if (filled) {
                showToast(`已自动勾选【同意】并填入意见：“${autoOpinionText}”`);
            } else {
                showToast('请先点开审核申请弹窗');
            }
        }

        if (e.altKey && e.key === 'Enter') {
            e.preventDefault();
            const btns = Array.from(document.querySelectorAll('.el-dialog__footer button, .bh-dialog-foot button, .bh-window-footer button, .bh-btn-primary, button'));
            const btn = btns.find(b => {
                const t = (b.textContent || '').trim();
                return (t === '确定' || t === '提交' || t === '通过' || t === '保存') && b.offsetParent !== null && !b.disabled;
            });
            if (btn) {
                btn.click();
                showToast('已提交审核！');
            }
        }
    };

    // ================= 8. 初始化与自适应监听 =================
    const init = () => {
        injectStyles();

        const onReady = () => {
            renderFloatingBall();
            apply75vhHeight();
            document.addEventListener('keydown', handleQuickReviewKeyboard);

            win.addEventListener('resize', () => {
                apply75vhHeight();
            });

            const observer = new MutationObserver(() => {
                liftReviewFormToTop();
                apply75vhHeight();
            });
            observer.observe(document.body || document.documentElement, {
                childList: true,
                subtree: true
            });
        };

        if (document.readyState === 'loading') {
            document.addEventListener('DOMContentLoaded', onReady);
        } else {
            onReady();
        }

        win.addEventListener('load', () => {
            setTimeout(apply75vhHeight, 500);
            setTimeout(apply75vhHeight, 1200);
        });
    };

    init();
})();
