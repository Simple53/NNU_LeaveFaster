## NNU LeaveFaster v1.1.1

修复主表隐藏问题并完成 HeroUI v3 + Unslop 界面重构。

### 更新内容

- **主表渲染修复**：
  - 彻底移除对 `$.fn.emapdatatable` 原型与非标准 `jqxGrid` 属性的注入，消除 `Invalid property` 异常导致的主表空白问题；
  - `apply75vhHeight()` 仅对已渲染且宽度非零的可见主表生效，避免在空壳期锁死高度；
  - `liftReviewFormToTop()` 增加 `#emapdatatable` / `#commonAdvanceQuery` 主表隔离校验；
  - `toggleSelectAll()` 优先操作行复选框并排除表头复选框，防止全选状态二次反转。
- **HeroUI v3 & Unslop 界面重构**：
  - 采用 `oklch` 中性色阶（`--heroui-surface` / `--heroui-accent` / `--heroui-border`）与 4px 间距网格、嵌套圆角规范；
  - 移除界面全部 Emoji 与感叹号文案，统一替换为 16px / 1.5px 描边的 Lucide 线性 SVG 图标；
  - 置顶审批工作区与右下角触发器采用静谧卡片与等宽按键帽（`.nnu-kbd`）细节设计。
- **沿用 v1.1.0 核心能力**：热路径加速、附件图片 `Blob` 兜底预览与旋转缩放灯箱、移动端「同意并提交」快捷按钮。

### 验证

通过 `node --check nnu_leave_enhancer.user.js` 语法检查及 `node test-pagination.cjs` 全部回归、Unslop 无 Emoji 校验及微基准测试。
