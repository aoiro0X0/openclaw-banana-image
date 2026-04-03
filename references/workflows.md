# Workflows

## Supported Modes

- `txt2img`: No input image. Use for fresh generation from a natural-language prompt.
- `img2img`: Input image without a mask. Use for whole-image restyling or controlled edits.
- `inpaint`: Input image plus mask. Use for localized edits.
- `background-replace`: Input image with an explicit background replacement request.

## Designer Workflow A: Base Image + Banana Edit

Designer generates a base image with another tool (Midjourney, Seedream, etc.), then iterates using Banana.

```bash
node ./scripts/banana-image.mjs \
  --task "在这个底图基础上增加光效粒子，让礼物更有冲击力" \
  --input-image-path ./base.png \
  --ops-doc-text "价位：500元，视觉方向：科技感+神秘" \
  --model-mode auto
```

Intent analyzer will detect `img2img` mode and route to Banana/Gemini for editing.

## Designer Workflow B: Multi-Reference Feature Combination

Designer provides reference images and specifies which feature to extract from each.

```bash
node ./scripts/banana-image.mjs \
  --task "做一个高端礼物设计，融合参考图的构图和配色" \
  --reference-image-path ./ref1.png --reference-label "取构图" \
  --reference-image-path ./ref2.png --reference-label "取配色" \
  --feishu-doc-url "https://bytedance.larkoffice.com/docx/xxx" \
  --feishu-chat-id "oc_xxx"
```

Intent analyzer extracts `reference_instructions` from labels and builds a structured prompt.

## Conservative Routing Rule

If the task is ambiguous but executable, prefer the least destructive mode:

1. `background-replace` only when the request explicitly mentions background replacement.
2. `inpaint` only when a mask is present.
3. `img2img` when an input image is present but no more specific rule applies.
4. `txt2img` otherwise.

## Multi-Turn Interaction

When critical information is missing (style/theme completely unclear), the skill returns:

```json
{
  "status": "follow_up_required",
  "follow_up_question": "请问这个礼物的目标价位是多少？视觉风格偏向写实还是奇幻？",
  "intent_summary": "...",
  "price_tier_analysis": {}
}
```

The caller should surface the question to the user, collect the answer, then re-invoke with `--conversation` pointing to the updated history file.

## Skip Intent Analysis

For direct low-level usage (e.g. when called from another agent that already handled intent):

```bash
node ./scripts/banana-image.mjs --task "..." --skip-intent
```
