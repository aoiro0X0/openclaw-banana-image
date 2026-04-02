# Workflows

## Supported Modes

- `txt2img`: No input image. Use for fresh generation from a natural-language prompt.
- `img2img`: Input image without a mask. Use for whole-image restyling or controlled edits.
- `inpaint`: Input image plus mask. Use for localized edits.
- `background-replace`: Input image with an explicit background replacement request.

## Example Triggers

- `生成一张香蕉广告海报，偏热带商业摄影` -> `txt2img`
- `把这张图改成更亮一点的电商质感` -> `img2img`
- `只改掉杯子上的 logo，别动其他区域` + mask -> `inpaint`
- `给这张产品图换背景，换成纯白摄影棚` -> `background-replace`

## Conservative Routing Rule

If the task is ambiguous but executable, prefer the least destructive mode:

1. `background-replace` only when the request explicitly mentions background replacement.
2. `inpaint` only when a mask is present.
3. `img2img` when an input image is present but no more specific rule applies.
4. `txt2img` otherwise.
