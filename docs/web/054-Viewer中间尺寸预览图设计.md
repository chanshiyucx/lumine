# Viewer 中间尺寸预览图（preview）设计

- 日期：2026-10-18
- 状态：**搁置，不实施**（2026-10-18）。现阶段不改 pipeline 和图片加载流程，Viewer 继续直接加载原图。本文保留为记录，§2 的实测数据可供以后重新评估。
- 来源：[053 Viewer 性能与代码规范优化评估](053-Viewer性能与代码规范优化评估.md) 4.2
- 范围：pipeline 新增一档 preview 资源、manifest 字段、Viewer 的源选择与原图升级
- 约束：沿用 next/image 渲染原图（035）、沿用 Blob 加进度条的加载链路（028），不增加失败重试 UI，不做相邻照片预取（另行决策）

## 1. 目标

把 Viewer 默认显示的高清图，从 25.6 MP 原图换成一档按屏幕足够清晰的中间尺寸图。只在屏幕像素确实需要时（大屏幕或放大）才升级到原图。

预期效果：

- 切图后到图片清晰的等待时间明显缩短；
- 解码开销和像素缓冲大幅下降，移动端受益最明显；
- 大屏幕用户也会先看到 preview，而不是现在 600 px 的缩略图，然后再无缝升级到原图。

**非目标**：

- 不改变缩略图、瀑布流、共享转场、分享下载（仍然下载原图）、元数据展示（仍然显示原图的尺寸和体积）；
- 不引入多档响应式图片或 `srcset`。

## 2. 依据

### 2.1 线上资源

527 张照片中，515 张是 6192 × 4128；原图中位数 8.50 MB，最大 20.74 MB（053 §2.1）。

### 2.2 样本编码实测

从线上下载三张原图，体积分别处于 p10、p50 和最大值。在本机用 ImageMagick 7.1.2（libheif 1.23.1、AOM）做 Lanczos 缩放，编码为 10-bit、4:4:4、speed 6 的 AVIF。PSNR 以同尺寸的无损缩放结果为参照。

| 样本（原图体积） | 长边 / 质量            | 体积                  | 相对原图       | PSNR                  |
| ---------------- | ---------------------- | --------------------- | -------------- | --------------------- |
| s1（5.68 MB）    | 2560 / q70 · q80 · q90 | 0.44 · 0.61 · 1.07 MB | 8% · 11% · 19% | 39.9 · 42.0 · 45.7 dB |
| s1               | 3200 / q80             | 0.90 MB               | 16%            | 42.4 dB               |
| s2（8.56 MB）    | 2560 / q70 · q80 · q90 | 0.80 · 1.06 · 1.62 MB | 9% · 12% · 19% | 36.4 · 39.1 · 43.6 dB |
| s2               | 3200 / q80             | 1.61 MB               | 19%            | 39.3 dB               |
| s3（20.74 MB）   | 2560 / q70 · q80 · q90 | 1.85 · 2.44 · 3.68 MB | 9% · 12% · 18% | 30.8 · 32.9 · 36.5 dB |
| s3               | 3200 / q80             | 3.67 MB               | 18%            | 33.3 dB               |

**浏览器解码**（桌面 Chromium，16 核；`createImageBitmap`，三次取中位数）：

| 样本 | 原图   | 2560 / q80 | 3200 / q80 |
| ---- | ------ | ---------- | ---------- |
| s1   | 235 ms | 44 ms      | 70 ms      |
| s2   | 312 ms | 66 ms      | 99 ms      |
| s3   | 617 ms | 142 ms     | 212 ms     |

这组数据的边界：

- ImageMagick 的质量刻度对应 libheif。pipeline 对无 ICC 的 Sony 原图走的是 ravif 路径（pipeline 011 §3），两者的质量刻度不等价，最终参数要用 pipeline 本身重新校准（§7 第 2 阶段）。
- s3 是高细节画面，PSNR 偏低是内容特性造成的，不代表 q80 不够用，需要目视确认。
- 解码只测了桌面，移动端的绝对值会更高，但比例关系预计相近（推断）。
- 同次测量中 `img.decode()` 对大图出现了 1–6 ms 的异常值，所以不采用这组数值。

### 2.3 尺寸覆盖

判断 preview 够不够，看的是“每个原图像素对应多少设备像素”，即 `pixelScale × DPR`。其中 `pixelScale` 是 `useZoomableImage` 已经计算好的 `transform.scale × fitScale`。preview 能提供的密度是 `previewDensity = preview.width / original.width`：长边 2560 时约为 0.413，3200 时约为 0.517。

fit 状态下（侧栏展开，舞台宽约为视口宽减 320 px）：

| 设备                             | 舞台宽（CSS） | fit 时 `pixelScale × DPR` | 2560         | 3200 |
| -------------------------------- | ------------- | ------------------------- | ------------ | ---- |
| 手机 390 宽，DPR 3               | 390           | 0.19                      | 够           | 够   |
| MacBook Air 13（1470），DPR 2    | 约 1150       | 0.37                      | 够           | 够   |
| MacBook Pro 14（1512），DPR 2    | 约 1190       | 0.38                      | 够           | 够   |
| MacBook Pro 16（1728），DPR 2    | 约 1410       | 0.46                      | 临界，会升级 | 够   |
| 4K 外接屏（按 1920 显示），DPR 2 | 约 1600       | 0.52                      | 升级         | 临界 |
| 5K 外接屏（按 2560 显示），DPR 2 | 约 2240       | 0.72                      | 升级         | 升级 |

**推荐长边 2560，质量先按 libheif q80 的观感校准。** 理由：

- 移动端和 13–14 寸笔记本是主要受益场景，它们在 2560 下都不需要原图；
- 3200 会让所有设备多付约 50% 的体积和解码开销，换来的只是 16 寸和 4K 外接屏在 fit 状态下不升级；
- 大屏幕升级到原图时，体验也不会比现在差：中间先显示 preview，而不是 600 px 缩略图。

这是唯一需要你拍板的参数（§8），其余规则都由它推导。

## 3. 资源与数据

### 3.1 pipeline

| 项目     | 设计                                                                                                                                                                                         |
| -------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 配置     | 新增 `previews_dir`（默认 `"previews"`）、`preview_long_edge`（默认 2560）、`preview_quality`。沿用 `validate_direct_child_dir`，并校验它与 `originals_dir`、`thumbnails_dir` 互不相同。     |
| 输出路径 | `previews/<源相对路径>.avif`，规则同 `build_original_path`。同路径覆盖的缓存风险与原图相同，已记录在 README。                                                                                |
| 生成     | 从源文件经 `avif::decode` 解码，保持方向处理；缩放后交给现有的 `avif::encode`，这样 ICC、位深和编码路径的选择（pipeline 011 §3）与原图保持一致。                                             |
| 缩放位深 | 现有的 `thumbnail::resize_to_dimensions` 会先转成 8-bit（`to_rgb8`）。preview 需要一个保持 16-bit 的缩放路径（fast_image_resize 的 `U16x3` / `U16x4`），否则 10-bit 源在缩放时就丢失了位深。 |
| 跳过条件 | 源图长边 ≤ `preview_long_edge` 时不生成，manifest 里不写 `preview`，Viewer 直接使用原图。                                                                                                    |
| 一次解码 | 原图和 preview 都需要生成时，共用同一个 `LoadedImage`，避免重复解码 25 MP 源图。只缺 preview 时（首次上线时 527 张全是这种情况），单独解码源文件。                                           |
| 增量复用 | 仿照 `read_existing_original` 新增 `read_existing_preview`。源状态为 `Changed` 时三种产物一起重建。`remove_stale_outputs` 要把 previews 目录纳入清理范围。                                   |
| 并发     | preview 的解码和编码要计入现有的 `full_res_limiter`，避免首次全量生成时内存峰值翻倍。                                                                                                        |

### 3.2 manifest 与发布顺序

- `PhotoEntry` 新增 `preview: Option<Asset>`，使用 `skip_serializing_if = "Option::is_none"`。**`MANIFEST_VERSION` 保持 3**：升版本会触发 pipeline 全量重建元数据，Web 的 `z.literal(3)` 也会导致 Web 和 manifest 必须同时切换。
- Web 的 `photoSchema` 新增 `preview: assetSchema.optional()`，`collection.ts` 里同样经过 `normalizeAsset`。
- **发布顺序**：`photoSchema` 是 `z.strictObject`，旧版 Web 遇到未知字段会解析失败。所以必须先部署能接受 `preview` 的 Web，然后再上传 `previews/` 目录，最后才上传 manifest。
- manifest 每张照片约增加 100 字节，总计约 50 KB（现在约 530 KB）。同样的数据会进入页面的照片数据载荷，这个增量可以接受。

## 4. Viewer 设计

### 4.1 源选择规则（纯函数）

放在 `components/viewer/lib/`，比如 `photo-display-source.ts`：

```ts
const PREVIEW_DENSITY_TOLERANCE = 1.1;

function needsOriginal(photo: Photo, pixelScale: number, dpr: number) {
  if (!photo.preview) return true;
  const previewDensity = photo.preview.width / photo.original.width;
  return pixelScale * dpr > previewDensity * PREVIEW_DENSITY_TOLERANCE;
}
```

- 1.1 的容差允许轻微的放大插值，避免临界设备在 fit 状态反复判断。这个值需要目视确认。
- **只升不降**：同一次激活内一旦升级到原图，就不再退回 preview，避免缩放过程中来回切换。切走后再切回，重新判断。
- `pixelScale` 直接复用 `useZoomableImage` 通过 `onZoomChange` 上报的值，不新增测量。

### 4.2 加载流程

`ActiveProgressivePhoto` 按顺序管理两个阶段，每个阶段复用现有的 `useProgressivePhoto`：

1. **显示源阶段**：挂载时加载 preview（没有 preview 时加载原图，即现有行为）。150 ms 延迟、首图零延迟、进度提示、取消、Blob URL 释放和 200 ms 淡入全部沿用。缩略图在显示源稳定之前作为底图。
2. **升级阶段**：显示源稳定后，在以下两种情况之一首次满足 `needsOriginal` 时开始加载原图：
   - 在 fit 状态初次测量时就满足（大屏幕）；
   - 由 `onZoomChange` 上报的倍率触发（放大、双击 smart fill、窗口变大）。

   这是用户的明确操作，不加 150 ms 延迟。原图解码完成后，叠在 preview 上方淡入；淡入完成后卸载 preview 层，并释放它的 Blob URL。

`useProgressivePhoto` 需要的改动：把参数从 `photo` 改为 asset（`{ url, bytes, mime }`）加上一个 `enabled` 标志。它内部的状态机不变。

### 4.3 升级不跳动：两层图片共用同一个 transform

两层 `<Image>` 都放在 `TransformComponent` 的同一个 content 节点里，绝对定位叠放，原图层在上方淡入：

- transform 作用在 content 节点上，替换图层不会触碰 `react-zoom-pan-pinch` 的状态，所以位置和缩放天然连续。
- `ZoomableImage` 现在用 `width/height`（原图尺寸）计算 `ImageLayout`。两层都传入原图尺寸，`fitScale` 不变，倍率提示里的像素倍率也保持连续。preview 的宽高比和原图一致（存在取整误差），`object-contain` 下的偏差小于 1 个设备像素（推断，需截图核对）。
- `ZoomableImage` 的接口改为接收一个图层列表（最多两项：`src`、是否可见、`onLoad`、`onError`）。测量、手势和 wheel 逻辑不变，也不让它知道 preview 和原图的业务含义。这比在 `ProgressivePhoto` 外面再包一层 transform 更简单，因为不用同步两个 transform。

### 4.4 资源与失败

| 情况                   | 行为                                                                                                      |
| ---------------------- | --------------------------------------------------------------------------------------------------------- |
| preview 加载或渲染失败 | 回退为直接加载原图（等同于现有行为），不显示额外的错误                                                    |
| 原图升级失败           | 保留 preview 继续显示，加载提示显示现有的错误文案，不重试                                                 |
| 升级期间的内存峰值     | preview 约 4.4 MP 加原图 25.6 MP。按 RGBA 估算，比现在“缩略图 + 原图”的峰值多约 18 MB，可以接受（估算值） |
| 升级中途切图或关闭     | 两个阶段各自取消请求、释放 Blob URL，沿用现有的过期保护                                                   |

### 4.5 不受影响的部分

共享转场（使用缩略图和原图尺寸）、瀑布流、OG 图片、直方图（使用缩略图）、分享下载（使用原图 URL）、元数据（原图尺寸和体积）、`photo.id`（原图 URL）都保持不变。

## 5. 明确不做

- 不做多档 preview 或 `srcset`：一档加原图，已经覆盖 §2.3 中的所有设备。
- 不在本方案里删除 Blob 链路、取消进度提示、预取相邻照片，或调整 150 ms 延迟。这些在 preview 上线并测量之后，按 053 分别决策。
- 不按网络状况（`navigator.connection`）选源：浏览器支持不一致，收益也没有测量依据。

## 6. 验收

| 项目       | 标准                                                                                                                                              |
| ---------- | ------------------------------------------------------------------------------------------------------------------------------------------------- |
| 资源       | 全量构建后，统计 preview 体积的 p50 / p90 / max 和构建耗时；抽查 Sony（无 ICC）和 iPhone（P3 ICC）样本，确认 ICC 与位深和原图路径一致，并目视比较 |
| 选源       | 在 390 宽 DPR 3、MacBook 14、5K（或模拟 DPR 2 的 2560 宽视口）下，fit 状态分别得到 preview、preview、升级                                         |
| 升级连续性 | 放大触发升级前后，截图对比位置无跳动，倍率提示数值连续                                                                                            |
| 耗时       | 用 Viewer 实际路径测量切图到显示源稳定的时间，preview 与原图各测一次（桌面加至少一台手机）                                                        |
| 回退       | manifest 没有 `preview` 字段时，行为与现在完全一致                                                                                                |
| 纯函数     | `needsOriginal` 和 pipeline 的跳过条件有单元测试                                                                                                  |

## 7. 实施阶段

1. **Web 接受字段**：`manifestSchema` 和 `Photo` 增加可选的 `preview`，不改变行为。部署。
2. **pipeline 生成 preview**：配置项、16-bit 缩放、生成、复用、清理。用三张 §2.2 的样本和一张 iPhone P3 样本，校准 `preview_quality`，目标是在常规观看距离下和原图无可见差异，再全量构建，上传 `previews/` 和 manifest。同步更新 README 的输出目录说明。
3. **Viewer 使用 preview**：源选择纯函数加测试；`useProgressivePhoto` 参数化；`ZoomableImage` 改为图层列表；升级触发。
4. **按 §6 验收**，在 053 中记录结果，再决定 053 中被推迟的事项（Blob 链路、预取、150 ms 延迟）。

每个阶段可以独立上线：第 1、2 阶段完成后线上行为不变，第 3 阶段如果需要回滚，只回滚 Web 即可。

## 8. 待决策

1. **preview 长边**：推荐 2560（§2.3）。如果 4K 或 16 寸屏是你的主要浏览设备，可以选 3200。
2. **`preview_quality`**：在第 2 阶段用 pipeline 实测校准，不在此处预设具体数值。
