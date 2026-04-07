# Workflows

## Supported Modes

- `txt2img`: No input image. Use for fresh generation from a natural-language prompt.
- `img2img`: Input image without a mask. Use for whole-image restyling or controlled edits.
- `inpaint`: Input image plus mask. Use for localized edits.
- `background-replace`: Input image with an explicit background replacement request.

## Example Triggers

- `Create a tropical banana ad poster with a premium studio-photography look` -> `txt2img`
- `Restyle this product image to look brighter and more commercial` -> `img2img`
- `Only replace the logo on the cup and keep everything else the same` + mask -> `inpaint`
- `Replace the background of this product shot with a clean white studio scene` -> `background-replace`

## Conservative Routing Rule

If the task is ambiguous but executable, prefer the least destructive mode:

1. `background-replace` only when the request explicitly mentions background replacement.
2. `inpaint` only when a mask is present.
3. `img2img` when an input image is present but no more specific rule applies.
4. `txt2img` otherwise.
