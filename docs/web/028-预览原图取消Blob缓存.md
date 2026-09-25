# Viewer 原图加载生命周期

- 状态：已实施
- 日期：2026-09-23
- 范围：Viewer 当前原图的下载进度、取消与 Blob URL 生命周期

## 决策

Viewer 同一时刻只激活一张照片。取消最多保留三张原图的应用层 Blob 缓存后，不再需要按 URL 管理多个资源的全局 `PhotoResourceStore`。当前照片的加载状态和资源由 `useProgressivePhoto` 持有；只有活动照片挂载这个 hook。非活动幻灯片仍显示缩略图。

`loadPhotoBlob` 负责原有的 `fetch` 响应流读取、字节统计和 Blob 组装。hook 负责 150 ms 切图延迟、进度状态、请求取消、过期结果保护，以及 Blob URL 的创建和释放。原图依旧交给原生 `<img>` 渲染，没有换用 `XMLHttpRequest`、Canvas 或 WebGL。

## 生命周期

1. 活动照片挂载时开始加载。首次进入沿用零延迟，后续切图沿用 150 ms 延迟。
2. 下载期间按原有规则更新百分比和字节数；完成后创建当前照片的 Blob URL，并等待图片的 `onLoad`。
3. 图片 `onLoad` 后保持原有 200 ms 淡入；淡入完成前显示缩略图。
4. 切图或关闭 Viewer 时，活动照片卸载：取消计时器和进行中的请求，并释放当前 Blob URL。过期请求不能再更新状态或创建对象 URL。
5. 再次查看同一张照片时重新执行加载流程；`fetch` 仍使用浏览器默认 HTTP 缓存策略，不保留应用层 Blob 缓存。
6. 图片渲染失败时沿用原有错误提示，并立即释放该 Blob URL。

## 保持不变

- `PhotoCarousel` 的激活规则、切图延迟和交互方式。
- `LoadingIndicator` 的百分比、字节数及错误文案。
- 缩放、手势、缩略图和原图淡入的视觉行为。

## 验证

- TypeScript、ESLint、Prettier 与 Git 差异检查。
- Chrome 中打开原图，确认进度提示、Blob URL 原图及淡入。
- 切到另一张照片再切回，确认每次只显示活动原图；快速切图时旧请求不会覆盖新照片。
