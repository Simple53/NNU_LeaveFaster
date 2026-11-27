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
| ⚡ **Hot-Path Optimization** | Inspired by `EL4CTEO/fast-anything`: precompiled regex fast-paths, `requestAnimationFrame`-batched DOM observers, O(1) unlock caching, and `jqxGrid` `beginupdate`/`endupdate` batch selection to eliminate mobile frame drops. |
| 🖼️ **Attachment Image Preview Fixer** | Sniffs `getUploadedAttachment.do` responses and DOM links, falls back to credentialed `fetch` → `Blob` URLs when images fail to load, and provides a touch-friendly fullscreen lightbox with zoom and 90° rotation. |
| 📱 **Mobile One-Tap Approval** | Responsive mobile layout plus touch-friendly **⚡ 一键同意并提交** (One-Tap Approve & Submit) and **✍️ 仅填同意** buttons directly above the review opinion box. |
| 📋 **Page Size Control** | Choose 10, 20, 50, or 100 rows. Refresh synchronizes the jqxGrid / jqxDataTable page size and returns to the first page. Refreshing the same size is supported. |
| ✅ **Batch Multi-Select & Approve** | Remove the native 10-item batch approval limit. Freely check multiple items or click Select All to approve all selected pending tasks in one batch. |
| ↕️ **Taller Main Table** | Toggle a 75vh (60vh on mobile) table viewport. Visible rows still depend on screen size, row height, and returned data. |
| 📝 **Review Details & History** | Keep the original dialog width, adapt content height, move the review opinion area to the top with a highlight, and display full workflow history without clipping. |
| 🔗 **Native Flow Diagram** | Skip plugin execution on flow diagram pages, preserving the site's original layout and click interactions. |

---

### 📱 Mobile Browser Setup (Recommended over Native App)

The built-in university App WebView cannot run userscripts and frequently fails to preview leave attachment images. Using a mobile browser with this userscript is faster and fixes image previews:

- **Android / HarmonyOS**: Install **Lemur Browser** or **Firefox Mobile**, add **Tampermonkey**, install `nnu_leave_enhancer.user.js`, and "Add to Home Screen" for app-like launch.
- **iOS (iPhone / iPad)**: Install **Userscripts** or **Stay 2** from the App Store, enable it in *Settings → Safari → Extensions*, and import `nnu_leave_enhancer.user.js`.

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

---

### 📖 User Guide

| Control | Action |
|---|---|
| **每页行数 → 刷新** | Set the page size and load the first page. |
| **全选 / 清空 / 批量同意** | Select all rows on the current page, clear selection, or submit batch approval. |
| **⚡ 一键同意并提交** | Touch button inside review dialog: select approve, fill “同意”, and submit. |
| **🖼️ 全屏预览** | Open the attachment lightbox with zoom, 90° rotation, and next/prev navigation. |
| **加高主表** | Toggle the taller main-table viewport. |
| **`Alt + A` / `Alt + Enter`** | Desktop shortcuts: fill approval / submit review. |

---

## 中文说明

面向南京师范大学请假审批系统（Wisedu EMAP / `lwNjnuStuLeaveManagement`）的浏览器油猴脚本，无需修改后端或启动本地服务。

### ✨ 核心功能

| 功能 | 说明 |
|---|---|
| ⚡ **5% 热路径极致加速** | 借鉴 `EL4CTEO/fast-anything` 思想：预编译正则与子串短路（Fast-Path）、`requestAnimationFrame` 帧级合并 DOM 监听、O(1) 解锁缓存、`jqxGrid` `beginupdate`/`endupdate` 冻结重绘，大幅降低手机端卡顿。 |
| 🖼️ **附件图片强力兜底预览** | 自动嗅探 `getUploadedAttachment.do` 与页面图片链接；遇裂图或下载拦截时自动通过带凭证的 `fetch` 转 `Blob` 渲染，并提供支持**双指/按钮缩放、90° 左右旋转、多图切换**的轻量全屏灯箱。 |
| 📱 **手机端一键审批与适配** | 针对手机窄屏优化排版，在置顶意见框上方注入大尺寸触控按钮 **【⚡ 一键同意并提交】** 与 **【✍️ 仅填同意】**，无需键盘快捷键即可单手完成审批。 |
| 📋 **主表行数切换** | 支持 10、20、50、100 行。刷新时同步 jqxGrid / jqxDataTable 分页状态并返回第一页，相同行数也可再次刷新。 |
| ✅ **突破批量上限与全选** | 彻底解除系统原生 10 条批量审批上限，支持复选框自由多选与一键“全选”，支持批量同意当前页所有待办。 |
| ↕️ **主表大视窗** | 桌面端 75vh / 移动端 60vh 视窗；实际可见行数取决于屏幕尺寸、行高与接口返回数据。 |
| 📝 **审批详情与流转记录** | 保留原生宽度，内容高度自适应；处理意见置顶高亮，取消流转信息高度与行数截断限制。 |
| 🔗 **原生流程图交互** | 流程图页面直接跳过插件处理，保留原生尺寸与点击交互。 |

---

### 📱 手机端使用建议（网页 + 脚本 vs 学校 App）

学校 App 内置 WebView 封闭，既无法运行加速脚本，也经常因跨域或下载头拦截导致学生病假条图片预览失败。推荐直接使用**手机浏览器 + 油猴扩展**：

- **Android / 鸿蒙**：使用 **狐猴浏览器（Lemur Browser）** 或 **Firefox 移动版** 安装 **Tampermonkey** 扩展并导入脚本，随后将请假审核页「添加到主屏幕」，即可像原生 App 一样一键打开。
- **iOS（iPhone / iPad）**：在 App Store 下载免费开源的 **Userscripts** 或 **Stay 2**，在「设置 → Safari 浏览器 → 扩展」中启用并导入本脚本即可在 Safari 中运行。

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

---

### 📖 使用指南

| 操作 | 效果 |
|---|---|
| **每页行数 → 刷新** | 设置主表分页并回到第一页。 |
| **全选 / 清空 / 批量同意** | 一键全选当前页待办并突破 10 条上限批量审批。 |
| **⚡ 一键同意并提交** | 手机端详情页顶部按钮：一键勾选同意、填入“同意”并提交。 |
| **🖼️ 全屏预览** | 打开附件高清灯箱，支持放大缩小与 90° 旋转（专治倒拍请假条）。 |
| **加高主表** | 切换主表大视窗。 |
| **`Alt + A` / `Alt + Enter`** | 电脑端快捷键：填入同意 / 提交审核。 |

---

### 🧪 Development & Validation / 开发与验证

```sh
node --check nnu_leave_enhancer.user.js
node test-pagination.cjs
```

### License

MIT License