<div align="center">

<img src="assets/icon.svg" alt="NNU LeaveFaster Logo" width="150" height="150" />

# NNU LeaveFaster

**轻量、简洁的南师大请假审批体验优化助手**<br>
*A lightweight userscript for a smoother NNU leave approval workflow.*

[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](#license)
[![JavaScript](https://img.shields.io/badge/JavaScript-ES6%2B-F7DF1E?logo=javascript&logoColor=black)](nnu_leave_enhancer.user.js)
[![Userscript](https://img.shields.io/badge/Userscript-Tampermonkey-00485B?logo=tampermonkey&logoColor=white)](#english)
[![Release](https://img.shields.io/github/v/release/Simple53/NNU_LeaveFaster?color=green)](https://github.com/Simple53/NNU_LeaveFaster/releases)

[English](#english) | [中文说明](#中文说明)

[Download / 下载](https://github.com/Simple53/NNU_LeaveFaster/releases/latest) · [Source / 源码](nnu_leave_enhancer.user.js) · [Feedback / 反馈](https://github.com/Simple53/NNU_LeaveFaster/issues)

</div>

---

## English

A browser userscript for Nanjing Normal University's leave approval system, built on Wisedu EMAP (`lwNjnuStuLeaveManagement`). No backend changes or local service required.

### ✨ Key Features

| Feature | Description |
|---|---|
| 📋 **Page Size Control** | Choose 10, 20, 50, or 100 rows. Refresh synchronizes the jqxGrid / jqxDataTable page size and returns to the first page. Refreshing the same size is supported. |
| ↕️ **Taller Main Table** | Toggle a 75vh table viewport. Visible rows still depend on screen size, row height, and returned data. |
| ✨ **Minimal Interface** | 15px primary text, numeric page-size options, and collapsed diagnostics and shortcut help. |
| 📝 **Review Details** | Keep the original dialog width, adapt content height, and move the review opinion area to the top with a highlight. |
| 📜 **Full Workflow History** | Remove the plugin's height and text-clipping limits so existing workflow comments can be displayed in full. |
| 🔗 **Native Flow Diagram** | Skip plugin execution on flow diagram pages, preserving the site's original layout and click interactions. |
| ⚡ **Reduced Visual Delay** | Disable animations and transitions, and attempt to dismiss loading masks after requests. Actual response time depends on the network and server. |
| 🔎 **Diagnostics** | Keep the latest 15 requests or pagination operations. Main-table XHR logs include pagination parameters and response counts without copying student records. |

---

### 🚀 Quick Start

#### Method 1: Install from Release

1. Install Tampermonkey or Violentmonkey in your browser.
2. Open the [Releases page](https://github.com/Simple53/NNU_LeaveFaster/releases/latest) and download `nnu_leave_enhancer.user.js`.
3. Install it in your userscript manager. If installation does not open automatically, create a new script, paste the downloaded file's contents, and save.
4. Sign in to the leave approval system through the university portal and reload the page.
5. Open **NNU LeaveFaster** at the bottom right, choose a page size, and click **刷新** (Refresh).

#### Method 2: Install from Source

1. Open [`nnu_leave_enhancer.user.js`](nnu_leave_enhancer.user.js) and copy the complete source.
2. Create a new script in your userscript manager, replace the template, and save.
3. Reload the university page to activate the script.

**Updating:** Replace the existing script and avoid enabling duplicate copies. v1.0.0 is the first formal release and incorporates development versions v1.0.6–v1.0.8; users of those versions should replace the script manually. Reloading removes previously injected styles.

---

### 📖 User Guide

| Control | Action |
|---|---|
| **每页行数 → 刷新** | Set the page size and load the first page. |
| **加高主表** | Toggle the taller main-table viewport. |
| **诊断与快捷键 → 复制诊断日志** | Copy diagnostic information. |
| **`Alt + A`** | Select approval and fill the opinion field with “同意” in the review view. |
| **`Alt + Enter`** | Click the visible confirm, submit, approve, or save button; this performs an actual submission. |

Page size and viewport preferences are stored in the site's local storage. The control labels remain Chinese to match the university system.

### 🔧 Troubleshooting

If 50 rows are selected but only 10 appear, wait for loading to finish and copy the diagnostics. Compare the widget's page size, outgoing `queryUserTasks.do` pagination parameters, and returned array lengths and totals.

HTTP 200 does not prove that the selected page size took effect. A short final page or a small filtered result is normal. Server limits and changes to the site's API or components may also affect behavior.

Logs include the current page URL. Remove session parameters before sharing them publicly.

---

## 中文说明

面向南京师范大学请假审批系统（Wisedu EMAP / `lwNjnuStuLeaveManagement`）的浏览器油猴脚本，无需修改后端或启动本地服务。

### ✨ 核心功能

| 功能 | 说明 |
|---|---|
| 📋 **主表行数切换** | 支持 10、20、50、100 行。刷新时同步 jqxGrid / jqxDataTable 分页状态并返回第一页，相同行数也可再次刷新。 |
| ↕️ **主表大视窗** | 可切换 75vh 视窗；实际可见行数取决于屏幕尺寸、行高与接口返回数据。 |
| ✨ **简洁操作面板** | 15px 主字号，行数选项仅显示数字，诊断与快捷键默认折叠。 |
| 📝 **审批详情优化** | 保留原生宽度，内容高度自适应；处理意见区域置顶并高亮。 |
| 📜 **流转信息完整展示** | 取消插件对高度和文字行数的限制，按已有内容完整展示。 |
| 🔗 **原生流程图交互** | 流程图页面直接跳过插件处理，不注入样式、不绑定事件、不拦截请求，保留原生尺寸与点击交互。 |
| ⚡ **减少视觉等待** | 关闭动画与过渡，并在请求结束后尝试解除加载遮罩；实际响应时间由网络和服务器决定。 |
| 🔎 **内置诊断日志** | 记录最近 15 项请求或分页操作；主表 XHR 请求额外记录分页参数与响应数量，不复制学生记录明细。 |

---

### 🚀 快速开始

#### 方式一：从 Release 安装

1. 在浏览器中安装 Tampermonkey 或 Violentmonkey。
2. 前往 [Releases 页面](https://github.com/Simple53/NNU_LeaveFaster/releases/latest)，下载 `nnu_leave_enhancer.user.js`。
3. 使用脚本管理器安装；若未自动打开安装界面，可新建脚本，粘贴下载文件的全部内容并保存。
4. 通过学校门户正常登录请假审批系统，重新加载网页。
5. 点击右下角 **NNU LeaveFaster**，选择每页行数并点击“刷新”。

#### 方式二：从源码安装

1. 打开 [`nnu_leave_enhancer.user.js`](nnu_leave_enhancer.user.js)，复制全部源码。
2. 在脚本管理器中新建脚本，替换模板内容并保存。
3. 重新加载学校网页即可使用。

**更新说明：** 替换原脚本，避免并行启用多个版本。v1.0.0 为首个正式 Release，整合了开发阶段 v1.0.6–v1.0.8 的修改；这些开发版本的用户请手动替换。重新加载网页才能清除旧版本注入的样式。

---

### 📖 使用指南

| 操作 | 效果 |
|---|---|
| **每页行数 → 刷新** | 设置主表分页并回到第一页。 |
| **加高主表** | 切换主表大视窗。 |
| **诊断与快捷键 → 复制诊断日志** | 复制排查信息。 |
| **`Alt + A`** | 在审核页面勾选“同意”并填入意见，默认“同意”。 |
| **`Alt + Enter`** | 点击当前可见的确定、提交、通过或保存按钮，会执行实际提交。 |

每页行数和大视窗偏好保存在网页本地存储中。

### 🔧 常见问题

**选择 50 行后仍只显示 10 行？**

等待请求完成，再复制诊断日志，对比组件内部的每页行数、`queryUserTasks.do` 发出的分页参数，以及响应数组长度与总数。

HTTP 200 只表示请求完成，不代表目标行数已经生效。末页或筛选结果不足 50 条时，显示较少记录属于正常情况；服务器上限、接口结构变化或学校更新组件也可能影响行为。

**分享诊断日志前需要注意什么？**

日志不复制学生记录明细，但包含当前页面 URL；对外分享前请移除 URL 中的会话参数。

---

### 🏗️ Directory Structure / 项目结构

```text
NNU_LeaveFaster/
├── nnu_leave_enhancer.user.js  # Installable userscript / 油猴脚本
├── test-pagination.cjs        # Regression checks / 分页回归检查
├── README.md                  # User guide / 使用说明
├── RELEASE_NOTES.md           # v1.0.0 release notes / 发布说明
└── assets/
    └── icon.svg               # Project icon / 项目矢量图标
```

### 🧪 Development & Validation / 开发与验证

No build step or npm dependencies. Tested with Node.js 22.<br>
无需构建或安装 npm 依赖，已在 Node.js 22 验证。

```sh
node --check nnu_leave_enhancer.user.js
node test-pagination.cjs
```

Checks cover pagination parameter rewriting, encoded JSON and forms, widget pagination, repeated refreshes, dialog-table exclusion, diagnostic summaries, and early exit on flow diagram pages. Widgets are mocked; these checks do not replace validation on the university site.

回归检查覆盖分页参数改写、编码 JSON 与表单、组件分页、重复刷新、详情表格排除、诊断摘要及流程图页面提前退出。组件使用模拟对象，不能替代学校真实网页验证。

Manual checks: switch between 10 and 50 rows, navigate pages, refresh again, inspect workflow history, and click the flow diagram.<br>
手动检查：切换 10 / 50 行并翻页、重复刷新、检查流转信息，以及点击流程图验证原生交互。

---

### License

MIT License — following the repository's existing license declaration.<br>
MIT License（沿用仓库现有声明）。
