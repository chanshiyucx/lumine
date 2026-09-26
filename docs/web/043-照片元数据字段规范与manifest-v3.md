# 照片元数据字段规范与 manifest v3

日期：2026-09-26

## 决策

manifest 是供 Web 使用的精简、归一化照片数据契约。直接提取的摄影字段尽量采用 EXIF 标签对应的 lowerCamelCase 名称；经过换算或多标签选择的字段，名称必须反映最终值的含义。页面标题、字段标签和数值格式不参与 manifest 命名。

不同概念分开存储，同一概念的替代来源在 pipeline 中归一化。缺失字段省略，不写 `null`、空字符串或用于页面占位的 `Unknown`。不保存完整原始 EXIF、不重复存储 ISO 的多个候选值、不添加逐字段来源信息。将来若需要原始元数据审计，另行设计归档文件。

本次版本为 **3**。用户明确要求重新生成数据，因此不实现旧字段别名、v2 schema、迁移转换或兼容分支。Web 严格读取 v3；pipeline 遇到旧 manifest 时重建照片条目，图片按独立产物规则复用。

## camera 字段契约

以下字段均可缺省。

| 字段 | 类型与单位 | 来源与语义 |
| --- | --- | --- |
| `make` | string | 相机制造商，EXIF Make |
| `model` | string | 相机型号，EXIF Model |
| `lensMake` | string | 镜头制造商，EXIF LensMake；不从相机制造商猜测 |
| `lensModel` | string | 镜头型号，EXIF LensModel；不再回退到 LensMake |
| `focalLength` | number，mm | EXIF FocalLength，实际焦距 |
| `focalLengthIn35mmFilm` | 正整数，mm | EXIF FocalLengthIn35mmFilm，35 mm 等效焦距；0 表示未知，省略 |
| `fNumber` | 正数 | EXIF FNumber，例如 5.6；不是 APEX ApertureValue |
| `exposureTime` | 正数，秒 | EXIF ExposureTime，例如 0.005；不是 ShutterSpeedValue，也不是页面字符串 |
| `iso` | 正整数 | 归一化的有效拍摄感光度，详见下节 |
| `maxApertureFNumber` | 正数 | 最大光圈的 F-number；由 MaxApertureValue 换算，或在可靠情况下从 LensSpecification 得到 |
| `brightnessValue` | number，APEX Bv | EXIF BrightnessValue；允许负值，不是曝光补偿 ExposureBiasValue |
| `exposureProgram` | string | EXIF ExposureProgram 的读取库文本表示 |
| `exposureMode` | string | 归一化为 auto、manual、bracket |
| `meteringMode` | string | EXIF MeteringMode 的读取库文本表示 |
| `whiteBalance` | string | 归一化为 auto、manual |
| `flash` | string | 原有简化闪光灯状态，不是原始 EXIF 位掩码 |
| `sceneCaptureType` | string | EXIF SceneCaptureType 的读取库文本表示 |
| `sensingMethod` | string | EXIF SensingMethod 的有效传感器类型；缺失、未定义和保留值省略 |

保留现有曝光模式、白平衡、闪光灯和枚举字符串策略，不额外保存枚举编号或原始位掩码。`flash` 的简化值包括 off、on、auto、auto-fired、red-eye、unsupported；它不是用于无损还原 EXIF 的字段。

数值只保存有限值。曝光时间、光圈系数和焦距必须为正；曝光时间保留读取所得数值精度，不使用两位小数舍入，避免将 1/200 秒变成 0.01 秒。焦距、光圈系数和亮度沿用已有的小数精度策略。

### ISO 归一化

`iso` 表示供画廊使用的拍摄感光度，不声称始终等于原始 ISOSpeed 标签。PhotographicSensitivity 可以表达 SOS、REI 或 ISO Speed，因此不机械改名为 photographicSensitivity。

1. PhotographicSensitivity 在 1–65534 时，使用该值，兼容没有 SensitivityType 的旧照片。
2. 该字段缺失、为 0 或达到饱和值 65535 时，根据 SensitivityType 选择对应的长整数标签。
3. 对于缺失、未知或不支持的 SensitivityType，仅尝试有效 ISOSpeed，不猜测 SOS/REI。
4. 无有效结果时省略 `iso`。不把 0 或短字段的饱和值当作有效拍摄感光度。

| SensitivityType | 候选顺序，跳过缺失或非正值 |
| --- | --- |
| 1：SOS | StandardOutputSensitivity |
| 2：REI | RecommendedExposureIndex |
| 3：ISO Speed | ISOSpeed |
| 4：SOS + REI | StandardOutputSensitivity → RecommendedExposureIndex |
| 5：SOS + ISO Speed | StandardOutputSensitivity → ISOSpeed |
| 6：REI + ISO Speed | RecommendedExposureIndex → ISOSpeed |
| 7：三者都有 | StandardOutputSensitivity → RecommendedExposureIndex → ISOSpeed |

组合类型优先选择短字段所代表的参数；替代候选仍必须属于已声明的感光度类型。Web 只读取 `iso`，不再选择 EXIF 来源。

### 最大光圈

MaxApertureValue 是 APEX Av，不能将原始值直接显示成 f-number。pipeline 使用 `2^(Av/2)` 得到 `maxApertureFNumber`。

缺失时尝试 LensSpecification：恒定光圈镜头可直接取值；可变光圈变焦镜头仅在当前焦距匹配广角或长焦端时取对应值。中间焦段不使用广角端光圈代替，也不自行插值；不能确定时省略。

## 旧名称与新名称

| v2 名称 | v3 名称或处理 |
| --- | --- |
| `lens` | 分开读取 `lensMake`、`lensModel` |
| `focalLengthMm` | `focalLength` |
| `focalLengthIn35mm` | `focalLengthIn35mmFilm` |
| `aperture` | `fNumber` |
| `shutter`（字符串） | `exposureTime`（秒数） |
| `maxAperture` | `maxApertureFNumber` |
| `brightnessEv` | `brightnessValue` |
| `iso` | 名称保留，完善归一化 |

上述表格用于说明重新生成前后的契约变化，不用于运行时迁移。

## 非 camera 字段的边界

本次保持资源结构、拍摄时间和位置结构，避免把摄影字段整理扩大成资源模型重构：

- `version`、`updatedAt`、`photos`：manifest 管理字段。
- `original`、`thumbnail`：输出图片资源，包含 url、width、height、bytes、mime。`original` 是现有应用中“全尺寸输出图”的名称，实际为转码 AVIF，并非源文件归档；这些尺寸和字节数来自输出文件，不改成 EXIF PixelXDimension 等标签。
- `thumbHash`：缩略图占位数据，不属于 EXIF。
- `title`：源文件名去掉扩展名得到的应用标题，不是 EXIF ImageDescription。
- `takenAt`：归一化时间。沿用 DateTimeOriginal → DateTimeDigitized → DateTime 的选择和相应 SubSecTime/OffsetTime 配对；没有可用 EXIF 时间时回退到文件修改时间。因此不改名为 dateTimeOriginal。页面仍按已有的拍摄地时区策略格式化。
- `location.lat/lng/alt`：经纬度为带正负号的十进制度数；高度为带正负号的米。它们是转换后的 GPS 坐标，不是原始度分秒数组。
- `image.orientation`：输出图方向，当前归一为 1。
- `image.colorSpace`：源 EXIF 色彩空间描述，缺失时沿用 Unspecified；不代表额外检测过输出文件的 ICC 配置。
- `image.bitDepth`：源图探测得到的色深，不保证与转码 AVIF 的位深一致。
- `image.isLivePhoto`：保留现有布尔字段，当前固定 false，不作为已实现 Live Photo 检测的承诺。

这些都是应用字段或归一化字段，没有必要为了对齐 EXIF 改成长标签名。本次只新增可能存在的镜头制造商，不新增一整套原始标签、来源副本或可从尺寸计算的 megapixels。

## Web 实现

`web/lib/photo/manifest.ts` 是 v3 校验 schema 和 manifest 类型的唯一来源。PhotoAsset、PhotoCamera、PhotoImage、PhotoLocation、PhotoManifestEntry 从 schema 推导，`collection.ts` 负责获取数据、校验和生成应用派生信息。

展示层使用独立文案：Basic Information、Device Information、Filename、Capture Time，保留 Megapixels。拍摄参数与分享卡片读取同一套新字段。

- 曝光时间共用数值格式化逻辑：详情页显示 `1/200 s`、`0.3 s`、`30 s`；OG 保持固定的“标签 + 数值”结构，使用独立的 `s` 标签和 `1/200` 等数值文字，不引入可选标签分支。
- Lens 行读取 lensModel；有 lensMake 时独立显示 Lens Manufacturer。型号未知时不会用制造商冒充。
- Sensing Method 归入 Device Information；有有效值才显示，不在 Shooting Mode 中展示 Unknown。
- 其他已有缺失值占位策略保持不变。

## 示例

```json
{
  "make": "SONY",
  "model": "ILCE-6700",
  "lensModel": "E 18-135mm F3.5-5.6 OSS",
  "focalLength": 73,
  "focalLengthIn35mmFilm": 109,
  "fNumber": 5.6,
  "maxApertureFNumber": 5.6,
  "exposureTime": 0.005,
  "iso": 100,
  "brightnessValue": 8.01
}
```

lensMake 和 sensingMethod 在源图缺失时不出现，不根据相机品牌补齐。

## 重新生成与验证

在 pipeline 目录运行现有 `./build.sh`，生成 version 3 的 manifest。由于没有兼容层，发布顺序应保证新 Web 读取的是新 manifest；重建 manifest 会复用现有可用图片；构建控制见 [增量构建与手动重建方案](../pipeline/009-增量构建与手动重建方案.md)。

使用隔离目录中的 Sony HIF 和 iPhone JPEG 样本验证 pipeline 输出可以被 Web v3 schema 直接读取。

### 本次验证结果

- Rust：release 构建、格式检查和严格 Clippy 检查通过。
- Web：类型、ESLint、Prettier 和差异检查通过。
- 两张真实样本在独立临时目录重新生成成功，输出 manifest 通过 Web v3 schema，并直接用于拍摄参数和设备信息显示验证。
- Sony 样本：exposureTime 为 0.005，显示 1/200 s；ISO 100；Sensing Method 省略。
- iPhone 样本：lensMake 为 Apple，与 lensModel 分开；ISO 160；有效的 Sensing Method 保留。
- 按紧凑 JSON 比较两张样本的 camera 对象，Sony 从 345 增至 364 字节（+19），iPhone 从 410 增至 439 字节（+29）。这是本次样本实测，不代表全部照片或压缩后的网络传输体积；主要变化是明确字段名和可选的镜头制造商，未增加原始 EXIF 副本。

## 参考

- [Adobe EXIF 字段说明](https://developer.adobe.com/xmp/docs/xmp-namespaces/exif/)：字段名称和 APEX、秒、毫米等单位语义。
- [CIPA Exif 标准](https://www.cipa.jp/std/documents/e/DC-X008-Translation-2019-E.pdf)：PhotographicSensitivity、SensitivityType 与高范围感光度字段的关系。
