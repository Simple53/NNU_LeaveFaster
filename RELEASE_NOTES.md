## NNU LeaveFaster v1.1.0

移动端适配、附件图片强力预览与 `fast-anything` 热路径加速版本。

### 更新内容

- **5% 热路径重构加速（借鉴 `EL4CTEO/fast-anything` 思想）**：
  - 预编译所有高频正则并为 `rewritePageParams` 增加 O(1) 快速子串短路；
  - 为 `unlockGridSelectionLimits()` 增加 O(1) 状态短路标记，避免重复包装；
  - 将 `MutationObserver` 回调合并至 `requestAnimationFrame` 帧级批处理，消除手机端渲染掉帧；
  - `toggleSelectAll` 批量全选包裹 `jqxGrid('beginupdate')` / `endupdate` 冻结重绘并合并计数刷新。
- **附件图片强力兜底预览器（解决手机端/网页端图片预览失败）**：
  - 在 XHR 拦截层嗅探 `getUploadedAttachment.do` 与审核接口返回的图片附件元数据；
  - 弹窗内自动注入带缩略图的强力预览条，图片加载失败时自动使用带凭证的 `fetch` 转 `Blob` URL 兜底；
  - 内置触控全屏灯箱，支持放大/缩小、左旋/右旋 90°（应对倒拍请假条）与多图切换。
- **移动端响应式适配与一键审批**：
  - 在置顶“审核意见”上方注入大触控按钮 **【⚡ 一键同意并提交】** 与 **【✍️ 仅填同意】**，手机无需快捷键即可单手审批；
  - 补充 `@media (max-width: 768px)` 窄屏布局与主表高度适配（60vh / min-height 380px）。
- **测试套件扩充**：在 `test-pagination.cjs` 中新增附件提取、移动端一键审批、批量冻结重绘与 10,000 次热路径微基准测试。

### 验证

通过 `node --check nnu_leave_enhancer.user.js` 语法检查及 `node test-pagination.cjs` 全部回归与微基准测试。