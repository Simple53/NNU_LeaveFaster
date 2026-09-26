# NNU LeaveFaster (南师大请假审批系统体验优化助手)

针对南京师范大学及金智教育（Wisedu EMAP / 今日校园 / ehallapp）学生请假审批管理系统（`lwNjnuStuLeaveManagement`）量身定制的前端体验增强油猴脚本。作为用户无需修改后端代码，即可解决**默认10行翻页繁琐**、**表格高度局促需上下滚动**、**审核弹窗输入框被埋在底部**以及**操作卡顿**等痛点。

GitHub 仓库: [https://github.com/Simple53/NNU_LeaveFaster](https://github.com/Simple53/NNU_LeaveFaster)

---

## 核心特性

- **表格默认铺满视窗高度**：自动计算浏览器剩余物理空间，主表格纵向直接自适应填满屏幕，一屏完整容纳 20~50 行数据，彻底告别在内部小框里翻滚轮。
- **突破单页 10 行限制**：支持在悬浮面板中自由设定每页显示 **10 / 20 / 50 / 100 行**，网络层自动重写 `queryUserTasks.do` 查询参数。
- **处理信息文本框自动置顶**：点开学生审批弹窗瞬间，自动将底部的“审核结果通过”单选框与“审核意见”输入框提取并**置顶移至弹窗最上方**并高亮显示，免去每次向下滑动寻找输入框的繁琐动作。
- **极速快捷键审批**：
  - `Alt + A`：自动勾选“同意/通过”，并自动填入审核意见（默认“同意”）；
  - `Alt + Enter`：一键秒速确认并提交弹窗；
  - 双手无需离开键盘，1 秒内完成单人审批流。
- **精致悬浮球设计**：采用右下角圆形矢量小球，平时不遮挡页面任何按钮和分页组件；点击平滑展开控制面板，面板内操作不会意外收起。
- **全面采用 SVG 矢量图标**：去除所有 emoji 字符，升级为高分辨率高清内联 SVG 图标，干练、专业、轻快。
- **精准隔离弹窗尺寸**：只扩大主页面待办大表格的高度，弹窗内部关联表格和系统原生提示框（alert/confirm）保持紧凑，不拉伸变形。
- **内置接口耗时监控与一键诊断**：实时监测后台请求延迟，提供一键复制排查日志功能。

---

## 安装使用指南

### 第一步：安装脚本管理器（任选其一）
请确保浏览器已安装 Tampermonkey 或 Violentmonkey 扩展：
- **Edge 浏览器**：[Tampermonkey 扩展商店链接](https://microsoftedge.microsoft.com/addons/detail/tampermonkey/iikmkjmpbppiibahmmnapnahndlhxhpm)
- **Chrome 浏览器**：[Tampermonkey Chrome Web Store](https://chromewebstore.google.com/detail/tampermonkey/dhdgffkkebhmkfjojejmpbldmpobfkfo)

### 第二步：安装脚本
1. 点击浏览器右上角的 **Tampermonkey** 图标 -> **“添加新脚本”**；
2. 复制仓库中的 [`nnu_leave_enhancer.user.js`](./nnu_leave_enhancer.user.js) 全部代码并粘贴；
3. 按 `Ctrl + S` 保存。

### 第三步：访问系统
访问南师大请假审批系统页面：
- [进入南师大请假审批系统](https://ehallapp.nnu.edu.cn/qljfw/sys/lwNjnuStuLeaveManagement/index.do?gid_=Yko5cDZXQThPczJXWHdaSDhyYU9GVzhvdWloUkF4b0ErdUViZ3BoUnpFQzd3am5KTUE5NWlBR3RkTU1Pek1CV2xCaW1XYXZ6V25ES0t4VmVpS1lMcGc9PQ&amp_sec_version_=1&EMAP_LANG=zh&THEME=#/review)
- 页面右下角将出现科技感火箭悬浮小球，主表格将默认自动撑满屏幕高度！

---

## 快捷键一览

| 快捷键 | 功能说明 |
| :--- | :--- |
| **`Alt + A`** | 打开审批弹窗后，自动勾选“同意/通过”单选框并自动填入审核意见（默认“同意”） |
| **`Alt + Enter`** | 秒速点击弹窗底部的“确定/提交”按钮 |

---

## 项目结构

```text
NNU_LeaveFaster/
├── README.md                  # 项目使用与技术说明文档
├── nnu_leave_enhancer.user.js  # 油猴增强脚本源码 (V3.1.0)
└── .gitignore                 # Git 忽略文件
```

## License

MIT License
