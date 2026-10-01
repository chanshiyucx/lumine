# Viewer 与 Afilmory 设计对比分析

- 日期：2026-09-30
- 状态：移动端交互优化已实施（`1be3128`）；第二项缩略图悬浮预览优化已实施
- 对比范围：`web/components/viewer` 与 `tmp/afilmory/apps/web/src/modules/viewer`，以及相关 motion、加载、信息面板模块
- 约束：保留 img 原图渲染，暂不考虑 WebGL / WebGPU 迁移
- 证据范围：基于当前本地源码；没有进行两边的真机手势、慢网和性能对照实测。以下明确区分已确认的实现差异、风险推断和产品建议。

## 结论

Lumine 已具备 Afilmory 大部分核心体验：共享元素进出场、虚拟缩略图、渐进加载、桌面信息侧栏、移动端上滑查看信息和下滑关闭。优先优化交互细节，无需整体替换架构。

Afilmory 的优势是手势过程中的状态联动、操作提示和功能完整度；Lumine 的优势是职责拆分、显式生命周期、焦点管理和相对克制的视觉表达。移动端交互优化后，下一项选取现有缩略图悬浮预览的打开时机，减少鼠标快速经过时不必要的预览闪现与挂载。

## 逐项比较

| 维度       | Lumine                                                            | Afilmory                                             | 建议                                         |
| ---------- | ----------------------------------------------------------------- | ---------------------------------------------------- | -------------------------------------------- |
| 基础布局   | 桌面侧栏与底部缩略图，移动端信息抽屉                              | 基本相同                                             | 保留现有结构                                 |
| 视觉表达   | 较少装饰，照片更突出                                              | 更多材质模糊、强调色光晕、渐变和缩放                 | 借鉴层次感，谨慎增加光晕与装饰               |
| 移动端手势 | 上滑信息、下滑关闭，缩放、旋转与透明度联动                        | 额外协调纵向手势占用、抽屉可见性、工具栏与缩略图位移 | 优先吸收过程状态与互斥规则                   |
| 缩略图     | 虚拟列表、直接自动居中、比例展示、限制尺寸和位置的悬浮预览        | 悬浮延迟、标题和日期、更强的当前项反馈               | 保留定位方式，补提示信息与适度选中标记       |
| 缩放       | 适应屏幕与智能铺满／放大切换                                      | 适应屏幕、铺满、100% 原始像素循环                    | 桌面增加容易到达的 100% 查看方式             |
| 信息面板   | 参数、Creative Look、直方图、设备、地图                           | 另有标签、区域标注、原始 EXIF、分析、评论等          | 按产品需求选择，避免仅为功能对齐而增加复杂度 |
| 状态与职责 | controller、轮播、加载、缩放、过渡分开；显式 phase 和 operationId | motion 独立成包，主 viewer 仍编排较多媒体和社交功能  | 保留 Lumine 的职责组织                       |

### 1. 移动端手势互斥和控件交互状态

已确认的差异：

- Afilmory 的 `useViewerMobileInteractions` 提供 `isVerticalGestureActive`，viewer 在纵向拖动、信息抽屉可见或图片放大时禁用 Swiper 的触摸切图。
- Lumine 的 `PhotoCarousel` 根据放大状态及 `isSwipeDisabled` 控制 Swiper；viewer 当前传入的是 `isMobile && mobile.infoOpen`。`infoOpen` 表达吸附目标，拖动中改变 `inspectorProgress` 并不会同步改变它。
- Lumine 展开信息抽屉时，工具栏接近透明、缩略图完全透明，但两者的交互条件仍主要取决于 viewer phase 和进场 reveal 状态。视觉隐藏没有同步改变 pointer、inert 和 aria 状态。
- Afilmory 在抽屉可见时禁用移动端工具栏和缩略图操作，并在放大图片时收起信息抽屉。

风险推断：斜向拖动可能让两个手势模块竞争；隐藏控件可能仍接收操作。前者需触摸运行验证，后者的交互开关缺口可从 JSX 确认，但被抽屉覆盖的区域仍取决于实际布局。

建议：明确过程中的手势占用与抽屉呈现状态，统一各控件的可交互条件。关闭入口和按钮命中范围属于独立的 UI 取舍；经用户复核，本轮沿用现有把手和 32px 工具栏，不增加关闭按钮或标题。

主要依据：

- `web/components/viewer/hooks/use-mobile-viewer-interactions.ts`
- `web/components/viewer/viewer.tsx`
- `web/components/viewer/viewer-controls.tsx`
- `web/components/viewer/viewer-info-panel.tsx`
- `tmp/afilmory/apps/web/src/modules/viewer/PhotoViewer.tsx`
- `tmp/afilmory/packages/viewer-motion/src/useViewerMobileInteractions.ts`

### 2. 进场交接与图片可见性

Lumine 已区分下载、解码、就绪状态，并在原图淡入完成后移除缩略图，避免直接替换造成突变。共享元素预览的交接主要依据动画时间；过渡预览和轮播缩略图使用 `showPlaceholder={false}`。

Afilmory 另行跟踪缩略图是否可见、原图是否已呈现，进场期间设置兜底图片层。值得借鉴的是“交接时至少已有一层图片可见”，无需等待原图完成，也无需复制整套实现。

首次分析曾建议补占位、关联可见性与交接条件，并提供失败重试。2026-10-01 复核后不采纳此项：用户明确不需要失败占位或重试；现有缩略图保留机制继续沿用，进场空白尚未复现，不据此增加协调逻辑。准备阶段的提示文案也不作为本轮优化目标。

慢网下的空白或闪烁风险尚未对照复现，不将上述推断作为运行结果。

主要依据：`transition/shared-photo-transition-preview.tsx`、`progressive-photo.tsx`、`hooks/use-progressive-photo.ts`、`loading-indicator.tsx`，以及 Afilmory 的 `ProgressiveImage.tsx` 和 `entry-animation-state.ts`。

### 3. 可发现性与缩略图反馈

Afilmory 移动端有上滑看信息／下滑关闭的提示；缩略图悬浮预览有 100ms 打开延迟、标题和日期。Lumine 当前立即打开悬浮预览，缺少文字和移动手势提示。

建议：首次打开短暂提示手势，操作后隐藏；悬浮增加短延迟及可选标题／日期；当前项增加细边框或底部标记，避免仅靠其他图片灰度化识别选择。

应保留 Lumine 的预览高度和横向边界限制。Afilmory 固定宽度预览对竖图可能占用较多高度，选中项放大和强光晕也会增加视觉干扰。

主要依据：两边的 `thumbnail-rail.tsx` / `GalleryThumbnail.tsx`，Afilmory `PhotoViewer.tsx` 的 stage hint。

### 4. 容易到达的原始像素查看

Lumine 双击在适应屏幕和智能铺满／放大之间切换；Afilmory 采用适应、铺满、100% 原始像素的分段循环。

建议：桌面支持三段循环，或增加“适应 / 100%”快捷操作，服务锐度、噪点和对焦检查。移动端可保留易预测的双击返回行为。该变化只涉及几何与交互策略，不依赖 WebGL。

主要依据：`web/components/viewer/lib/zoom-geometry.ts` 和 `tmp/afilmory/packages/webgl-viewer/src/double-click-zoom.ts`。

### 5. 资源复用

Lumine 切走活动图片时释放 Blob URL，资源归属明确；返回照片重新走加载流程，下载原图也另行 fetch。浏览器 HTTP 缓存是否避免网络传输取决于响应缓存策略，不能直接推定每次都重新传输原图。

Afilmory 使用普通图片 Blob LRU，并向分享模块传递当前 Blob。不过普通图片缓存检查位于 XHR 下载之后，缓存按 10 张限制，不能推定它避免了重复请求或拥有稳定的内存预算。

建议优先评估当前图片与下载的资源复用。已复核 `028-预览原图取消Blob缓存.md`：不保留应用层 Blob 缓存是已有明确决策，不视为当前实现缺陷。本报告不建议直接恢复缓存；只有实测收益足以支持改变原决策时，再单独评估字节预算和使用期间的 URL 生命周期。相邻原图预加载同样需要先测量等待时间、原图大小和资源消耗。

主要依据：`hooks/use-progressive-photo.ts`、`viewer-share-dialog.tsx`，Afilmory `lib/image-loader-manager.ts`。

## 应保留的现有设计

- 显式进入／打开／退出状态与 operationId，忽略过期完成回调。
- 从实际 media stage 测量过渡目标尺寸。
- 焦点圈定、关闭后的焦点恢复，分享弹窗期间底层 inert。
- 减少动态效果支持。
- 缩略图直接使用 `scrollToIndex`，避免自行累加宽度。Afilmory 仍手动计算偏移，并监听普通元素 resize。
- 共享过渡使用 transform；无需改为 Afilmory 逐帧修改宽高的方式。
- 直方图已有请求去重和有界缓存；地图已有活动状态控制及 viewer 内实例复用。

## 优先级与后续

1. 移动端手势互斥与隐藏控件交互状态，保持现有可见 UI。
2. 现有缩略图悬浮预览延迟 100ms 打开，减少快速掠过时的预览闪现和短暂挂载。
3. 其他呈现建议暂不实施；手势提示、文字信息和选中标记需另有明确需求。
4. 100% 查看方式。
5. 复核已有决策后评估资源复用。

评论、区域标注、Live Photo 等属于新增产品能力，单独决策。第一项的进一步分析和实施设计见 `051-Viewer移动端交互状态优化方案.md`。

2026-10-01 复核：失败恢复方案已撤回。第二个候选从原报告第三项选取，具体设计见 [Viewer 缩略图悬浮预览优化方案](052-Viewer缩略图悬浮预览优化方案.md)。以上逐项比较中的原始实现差异保留作历史证据，当前实施结论以对应方案的最新状态为准。
