# Viewer 代码组织与规范整理方案

- 日期：2026-10-18
- 状态：第 1–5 项已实施（见 §6），第 6–8 项暂不实施
- 来源：[053](053-Viewer性能与代码规范优化评估.md) 之后的第二轮检查，已吸收外部复核意见
- 范围：`web/components/viewer` 的文件组织、代码规范和局部结构。不改 pipeline、图片加载流程、交互设计、动画数值和视觉样式
- 性质：这些都是维护性整理，**没有证据表明能明显提升流畅度**，不以性能收益作为采纳理由

## 1. 总览

| 编号 | 项目                                       | 档位               | 是否影响交互                 |
| ---- | ------------------------------------------ | ------------------ | ---------------------------- |
| 1    | 去掉 `inert` 旁多余的属性                  | 建议做，需单独回归 | 预期不影响，需要验证点击穿透 |
| 2    | 动画参数集中到 `VIEWER_MOTION`             | 建议做             | 不影响（数值不变）           |
| 3    | 删除内部重复的 `'use client'`              | 建议做             | 不影响                       |
| 4    | 简化 `viewer-trigger.ts`                   | 建议做             | 不影响                       |
| 5    | 加载进度的字节格式化改为纯逻辑共享         | 建议做             | 不影响（更新节奏不变）       |
| 6    | 移动端 hook 按用途返回 style               | 可选               | 不影响                       |
| 7    | 下拉关闭的帧计算组合移入 `viewer-frame.ts` | 可选               | 不影响                       |
| 8    | 统一纯逻辑文件的位置与命名                 | 可选               | 不影响                       |

建议的执行顺序：2、3、4 → 1（单独回归）→ 5。6–8 以后再按需决定。每项单独提交。

## 2. 建议做

### 2.1 去掉 `inert` 旁多余的属性（第 1 项）

**现状**：控件不可交互时，同时设置了三种限制。

| 位置                                     | `inert` | `aria-hidden` | 条件式 `pointerEvents` style |
| ---------------------------------------- | ------- | ------------- | ---------------------------- |
| 工具栏 `viewer-controls.tsx:49-58`       | 有      | 有            | 有                           |
| 导航 `viewer-controls.tsx:133-135`       | 有      | 有            | **无**，用的是固定 class     |
| 缩略图栏 `viewer-controls.tsx:195-205`   | 有      | 有            | 有                           |
| 信息面板 `viewer-info-panel.tsx:171-178` | 有      | 有            | 有                           |

**依据**：按 [HTML 规范](https://html.spec.whatwg.org/multipage/interaction.html#inert-subtrees)，`inert` 子树不参与命中测试，不能获得焦点，也不暴露给辅助技术。所以同条件的 `aria-hidden`，以及条件为 `none` 的 `pointerEvents`，都是重复设置。

**改法**：

- 工具栏、缩略图栏、信息面板：删除 `aria-hidden` 和条件式 `pointerEvents` style，只保留 `inert`。
- 导航：只删除 `aria-hidden`。**保留** 容器的 `pointer-events-none` 和按钮的 `pointer-events-auto`（`NAVIGATION_BUTTON_CLASS`）。这组 class 的作用是：导航可用时，箭头以外的区域仍然能操作下面的图片，和 `inert` 无关。
- `viewer.tsx:298` 舞台 `section` 的 `pointerEvents` 不在本项范围内，那里没有 `inert`。

**风险**：删除条件式 style 后，控件可交互时不再显式写 `pointer-events: auto`，会继承父级。需要确认父级在这些控件可交互时都不是 `none`。舞台 `section` 只在非 `open` 阶段才是 `none`，而那时这些控件都是 `inert`，预期不受影响。

**回归**：

- 桌面：收起信息面板后点击、拖动图片；导航箭头显示时，在箭头以外的区域滑动图片；键盘 Tab 不会进入隐藏的控件。
- 移动端：展开信息抽屉时，工具栏和缩略图栏点不到；收起后恢复。
- 分享弹窗打开期间，底层内容不可点。

### 2.2 动画参数集中到 `VIEWER_MOTION`（第 2 项）

**现状**：`lib/viewer-motion.ts` 已经集中了大部分动画参数，但还有 4 处写死在组件里：

| 位置                                                 | 当前值                                                        | 建议命名                            |
| ---------------------------------------------------- | ------------------------------------------------------------- | ----------------------------------- |
| `viewer-share-dialog.tsx:345` 遮罩                   | `{ duration: 0.18, ease: 'easeOut' }`                         | `shareDialog.backdrop`              |
| `viewer-share-dialog.tsx:360` 弹窗                   | `{ type: 'spring', duration: 0.32, bounce: 0 }`               | `shareDialog.panel`                 |
| `progressive-photo.tsx:108` 原图淡入                 | `{ duration: 0.2, ease: 'easeOut' }`（reduced motion 时为 0） | `originalFadeIn`                    |
| `use-mobile-viewer-interactions.ts:195-201` 下拉甩出 | 两个 spring，duration 0.18，bounce 分别为 0.08 / 0.04         | `dismissThrow.x` / `dismissThrow.y` |

**改法**：只把数值挪进 `VIEWER_MOTION`，每个场景单独命名，不和现有的相似参数合并（例如 `backdropEnter` 也是 0.18，但语义不同，不复用）。reduced motion 的判断、`onComplete` 回调、动画编号与取消保护仍然留在原来的操作处。

**验证**：改动前后 diff 中的数值逐一对应。

### 2.3 删除内部重复的 `'use client'`（第 3 项）

**现状**：`viewer.tsx`、`photo-histogram.tsx`、`viewer-location-map.tsx`、`transition/shared-photo-transition.tsx` 都写了 `'use client'`，其余 viewer 文件都没写。

**依据**：`'use client'` 标记的是服务端到客户端的入口边界，被客户端模块导入的文件自动属于客户端（[Next 文档](https://nextjs.org/docs/app/api-reference/directives/use-client)）。当前的导入关系：

- `photo-gallery.tsx`（`'use client'`）动态导入 `viewer.tsx`；
- `viewer.tsx` 导入 `shared-photo-transition.tsx`；
- `viewer-info-panel.tsx` 导入 `photo-histogram.tsx` 和 `viewer-location-map.tsx`。

这 3 个文件没有被任何服务端组件直接导入。

**改法**：保留 `viewer.tsx` 的声明作为模块入口标记，删除另外 3 个文件的声明。

**约束**：以后如果有服务端组件直接导入这 3 个文件之一，需要重新加上。

### 2.4 简化 `viewer-trigger.ts`（第 4 项）

**现状与改法**：

| 内容                                                            | 现状                                | 改法                                     | 理由                                                                                                                                                                                                   |
| --------------------------------------------------------------- | ----------------------------------- | ---------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `escapeAttributeValue`                                          | `CSS.escape` 不存在时，退回手写转义 | 直接调用 `CSS.escape(photoId)`，删除回退 | `CSS.escape` 在现代浏览器中已经普遍支持；转义本身必须保留，因为 `photoId` 是原图 URL，包含 `/` 和 `.`                                                                                                  |
| `resolveViewerTrigger` 开头的 `typeof window/document` 判断     | 存在                                | 删除                                     | 已核实三处调用（`use-viewer-controller.ts:99`、`:153`、`:223`）只来自点击、关闭和 popstate 这些浏览器事件路径。注意：Viewer 在照片直链下会做服务端渲染，所以判断依据是调用路径，而不是“文件属于客户端” |
| `TriggerElementLike` 结构类型                                   | 自定义窄接口                        | 改用 `HTMLElement`                       | 唯一的调用方传入的就是 `HTMLElement`，窄接口没有其他消费者                                                                                                                                             |
| `isUsableViewerTrigger`、`VIEWER_TRIGGER_ATTRIBUTE` 的 `export` | 已导出                              | 去掉 `export`，改为模块私有              | 仓库内没有外部引用                                                                                                                                                                                     |

**补充发现**：`photo-masonry-item.tsx:38` 直接写了字面量 `data-viewer-trigger`，没有使用这个常量。两处约定靠字符串保持一致。可以在常量旁加一行注释指明设置方，不在 JSX 里改用计算属性名。

### 2.5 加载进度的字节格式化改为纯逻辑共享（第 5 项）

**现状**：

- `loading-indicator.tsx:5` 和 `hooks/use-progressive-photo.ts:5` 各定义了一份 `BYTES_PER_MEBIBYTE`；
- 两边都用 `(bytes / BYTES_PER_MEBIBYTE).toFixed(1)` 处理已加载字节：组件用来显示，hook 在总大小未知时用来判断“显示文字是否变化”（`use-progressive-photo.ts:45-46`）。

**注意，两边并非完全按显示文字去重**：总大小已知时，hook 用 `Math.floor(progress)` 判断是否更新（`:40`），而组件显示的是 `Math.round(progress)`（`loading-indicator.tsx:46`）。本项**不改变这个更新节奏**，只合并字节格式化。

**改法**：新建 `lib/photo-loading-progress.ts`，放 `BYTES_PER_MEBIBYTE` 和 `formatMebibytes(bytes)`（返回 `"x.x"`，不带单位），hook 和组件都从这里导入。不让 hook 从展示组件导入函数，避免资源逻辑依赖展示层。

## 3. 可选

### 3.1 移动端 hook 按用途返回 style（第 6 项）

**现状**：`useMobileViewerInteractions` 返回约 20 个值，`viewer.tsx` 再手工组装成舞台 style（`borderRadius`、`rotate`、`scale`、`transformOrigin`、`x`、`y`），以及信息面板的 `{ opacity, y }` 等。

**改法**：hook 直接返回 `stageStyle`、`infoPanelStyle` 等分好组的对象，`backdropOpacity`、`chromeOpacity`、`railOpacity` 保持单值。hook 本来就负责这些视觉 MotionValue，返回 style 对象不算越界。

**采纳标准**：调用处是否更容易看懂，而不是少了多少行。手势逻辑不动。

### 3.2 下拉关闭的帧计算组合移入 `viewer-frame.ts`（第 7 项）

**现状**：`viewer.tsx:112-140` 的 `handleMobileDismiss` 依次读取舞台的 `offset*` 尺寸、调用 `fitMediaFrame`、读取 `window.innerWidth/innerHeight`、调用 `projectViewerFrame`，最后设置 state。

**改法**：只把 `fitMediaFrame → projectViewerFrame` 这段纯数值组合提取为 `viewer-frame.ts` 中的一个函数，参数为媒体尺寸、舞台矩形、视口矩形和快照。读取 DOM 尺寸、读取 `window`、设置 React state 仍然留在 Viewer。`viewer-frame.ts` 继续只处理数值。

### 3.3 统一纯逻辑文件的位置与命名（第 8 项）

**现状**：

- 过渡相关的纯逻辑分散在两处：`transition/viewer-frame.ts`、`transition/viewer-reveal-state.ts` 在 `transition/`，而 `lib/shared-photo-transition.ts` 在 `lib/`。049 这样放，是为了避免和 `transition/shared-photo-transition.tsx` 同名。
- `photo-histogram.tsx` 与 `lib/photo-histogram.ts` 同名，是同一类问题。

**改法**：

- `lib/shared-photo-transition.ts` 改名为 `transition/resolve-shared-transition.ts`，同名问题随之消除；
- `lib/photo-histogram.ts` 改名为 `lib/histogram-data.ts`（职责是计算与缓存直方图数据）。

**代价**：只有改名和导入路径变化，收益较小，适合单独一次提交。

## 4. 不建议动

| 项目                                        | 原因                                                                                                                                                           |
| ------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 给 viewer 加 `index.ts` 入口                | gallery 静态导入 controller、动态导入 Viewer。如果放进同一个入口，存在把 Viewer 打进首页主包的打包耦合风险（不能断言一定会破坏动态导入）。保持现在的深路径导入 |
| 去掉 `viewer-` 文件名前缀                   | 025 的“不重复前缀”规则是针对 `lib/` 的；`components/map`、`components/gallery` 也都带前缀，viewer 和它们保持一致即可                                           |
| 拆分分享弹窗或 `viewer.tsx`                 | 049 已决定，只用一次的小函数留在所属模块                                                                                                                       |
| 精简直方图组件的多个 ref                    | 用于让动画从当前画面接续，删掉会改变切图时的过渡效果                                                                                                           |
| 交互状态布尔值收拢、焦点 layout effect 迁移 | 见 053 §5                                                                                                                                                      |

## 5. 验收

- 每项完成后执行 `pnpm lint`、`pnpm type-check`、相关文件的 Prettier 检查；全部完成后执行一次 `pnpm build`。
- 第 1 项按 §2.1 的回归清单手动验证；其余各项需打开 Viewer，确认切图、缩放、分享弹窗和移动端下拉都正常。
- 不新增测试（见 053 §8.1）。

## 6. 实施记录（2026-10-18）

### 6.1 已完成

按 2、3、4、1、5 的顺序实施，共改动 12 个文件、新增 1 个文件。

- **第 2 项**：`VIEWER_MOTION` 新增 `dismissThrow.x/y`、`originalFadeIn`、`shareDialog.backdrop/panel`，数值与原来逐一对应。原图淡入在 reduced motion 时沿用 `{ duration: 0 }` 的写法，与背景层一致。下拉甩出的 `onComplete` 和动画编号仍然留在 hook 里。
- **第 3 项**：删除 `photo-histogram.tsx`、`viewer-location-map.tsx`、`transition/shared-photo-transition.tsx` 的 `'use client'`，只保留 `viewer.tsx`。
- **第 4 项**：`viewer-trigger.ts` 改用 `HTMLElement`，`isUsableViewerTrigger` 改为类型谓词；直接调用 `CSS.escape(photoId)`；删除服务端判断，并在函数旁注明只从浏览器事件路径调用；`VIEWER_TRIGGER_ATTRIBUTE` 和 `isUsableViewerTrigger` 改为模块私有，常量旁注明属性由 `photo-masonry-item.tsx` 设置。
- **第 1 项**：工具栏、缩略图栏、信息面板删除 `aria-hidden` 和条件式 `pointerEvents` style；导航只删除 `aria-hidden`，保留 `pointer-events-none` / `pointer-events-auto` 这组 class。导航按钮上的 `disabled` 不在方案范围内，保持不变。
- **第 5 项**：`hooks/use-progressive-photo.ts` 导出 `formatProgressBytes`，直接返回加载提示里显示的字节文字（如 `8.1 MB`）。`LoadingIndicator` 用它显示（它原本就从这个文件导入状态类型），hook 在总大小未知时比较的也是它的返回值，“显示文字不变就不更新状态”一眼可见。`BYTES_PER_MEBIBYTE` 只保留一份，为文件私有。没有按 §2.5 新建 `lib/photo-loading-progress.ts`：单个函数不值得独立成文件；复核担心的是 hook 依赖展示组件，而组件依赖 hook 模块的方向没有问题。`Math.floor` / `Math.round` 的更新节奏不变。

### 6.1.1 追加检查：小文件与导出（结论为保留）

第 5 项调整后，对全目录做了同类检查，结论是不再做结构调整：

- `hooks/use-swiper-resize.ts`（只被 `photo-carousel.tsx` 使用）和 `hooks/use-horizontal-wheel-scroll.ts`（只被 `thumbnail-rail.tsx` 使用）**保留为独立文件**。它们各自是命名清楚的完整单元，与“为共享一个函数新建文件”不是同一类问题；049 也明确保留 `hooks / lib / transition` 的组织方式。曾短暂并回使用方，但未经讨论，已撤回。
- 导出函数签名中的类型（如 `ViewerHistoryMarker`、`TransformState`）虽然没有外部引用，但属于公开签名的一部分，继续导出。
- `lib/load-photo-blob.ts`（028 拆出）、`lib/viewer-history.ts`、`lib/histogram-renderer.ts`（049 拆出）、`transition/viewer-reveal-state.ts` 是有独立职责的逻辑模块，不合并。
- 进度字节固定保留一位小数，和 `lib/photo/formatters.ts` 里去掉末尾 0 的 `formatBytes` 不同，这是为了避免加载时文字宽度跳动，不合并。

以后超出方案明确范围的结构调整，先列出来讨论，再实施。

### 6.2 验证

- `pnpm lint`、`pnpm type-check`、相关文件的 Prettier 检查、`pnpm build` 均通过（本机 Node 22.23.2），第 5 项调整后重新执行一次，仍然通过。
- 生产构建下，以照片直链打开 Viewer，做了 DOM 检查（浏览器面板在后台，`requestAnimationFrame` 不触发，所以只核对状态和命中测试，不涉及动画和帧时间）：
  - 1440 × 900：可交互时工具栏、导航、缩略图栏、信息面板都不是 `inert`，也没有残留的 `aria-hidden` 和内联 `pointerEvents`；舞台中心、导航箭头以外的区域都命中下面的图片，缩略图区域命中缩略图栏；收起面板后面板变为 `inert`，展开后恢复。
  - 打开分享弹窗后，内容层为 `inert`；按 Esc 后分享按钮的 `aria-expanded` 变为 `false`，Viewer 没有被一起关闭。弹窗节点要等退场动画结束才会卸载，后台页面看不到这一步。
  - 375 × 812：初始时面板为 `inert`、工具栏和缩略图栏可交互；打开信息抽屉后，工具栏和缩略图栏变为 `inert`，面板可交互。
- 尚未在前台手动验证：桌面与真机上的实际点击和拖动、Tab 焦点顺序、分享弹窗退场、下拉关闭的甩出手感。建议按 §2.1 的回归清单手动体验一次。
