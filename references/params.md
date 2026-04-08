# Parameters

## Input Contract

### Core image generation
- `task`: required natural-language request (Chinese or English)
- `apiKey`: optional one-time API key; otherwise read `ZENMUX_API_KEY`, then `GEMINI_API_KEY`, then prompt
- `inputImagePath`: optional local file path for `img2img`, `inpaint`, or background replacement
- `replyTargetImagePath`: optional local file path for the image being replied to in Feishu; highest priority for continuous edits
- `threadId`: optional thread/chat identifier used to restore the latest successful image in the same conversation
- `continueLastImage`: optional boolean forcing the request to continue from the latest successful image in the current thread
- `maskPath`: optional local file path; valid only with `inputImagePath`
- `referenceImagePaths`: optional list of local file paths — repeat `--reference-image-path` once per file
- `referenceLabels`: optional list of labels paired with `referenceImagePaths` — repeat `--reference-label` once per label (e.g. `"取构图"`, `"取配色"`)
- `size`: optional target size hint such as `1024x1024`
- `steps`: optional integer hint retained for metadata
- `seed`: optional integer
- `outputDir`: optional local output directory
- `model`: override model; defaults to auto-routed model
- `apiVersion`: defaults to `v1`

### Intent analysis
- `opsDocContent`: ops document text content (pasted)
- `feishuDocUrl`: ops document Feishu URL — fetched automatically via lark-cli
- `conversationHistory`: array of `{role, content}` objects for multi-turn context
- `skipIntent`: skip intent analysis when set to true

### Model routing
- `modelMode`: `auto` (default) or `pick`
  - `auto`: intent analyzer recommends model based on task type
  - `pick`: use `--model` flag or user-specified model

### Feishu delivery
- `feishuChatId`: Feishu chat ID — results sent automatically after generation

## Environment Variables

| Variable | Purpose |
|----------|---------|
| `ZENMUX_API_KEY` | Image API key (primary) |
| `GEMINI_API_KEY` | Image API key (fallback) |
| `ZENMUX_BASE_URL` | Image API base URL override |
| `GOOGLE_GEMINI_BASE_URL` | Image API base URL override (fallback) |
| `OPENCLAW_BANANA_MODEL` | Override image model |
| `ZENMUX_IMAGE_MODEL` | Override image model (fallback) |
| `BANANA_MODEL_REGISTRY` | JSON string to extend/replace the model registry |

Intent analysis is performed by the OpenClaw Agent directly — no `TEXT_LLM_*` environment variables are used by the script.

## Output Contract

The runner returns JSON with:

- `mode`: detected generation mode
- `output_files`: absolute paths to generated images
- `paths`: same as `output_files` (OpenClaw-style alias)
- `media`: `{ mediaUrls, mediaUrl }` for OpenClaw outbound delivery
- `mediaUrls`, `mediaUrl`
- `text_output`: text parts from API response
- `request_summary`: generation metadata
- `repro_info`: prompt + params for reproduction
- `raw_response_excerpt`: first 400 chars of raw API response
- `error`: null on success, error message string on failure
- `intent_analysis`: full intent analyzer output (null if skipped)
- `optimized_prompt`: the prompt actually sent to the image API
- `original_task`: the original user task string
- `model_routing`: `{ modelId, reason }` explaining model selection
- `image_context_source`: one of `reply_target`, `explicit_attachment`, `thread_last_image`, or `none`
- `feishu_delivery`: `{ ok, errors }` if `--feishu-chat-id` was set

### follow_up_required response (when more edit context is needed)

```json
{
  "status": "follow_up_required",
  "follow_up_question": "当前会话里没有可继续编辑的图片，请回复某张图或重新发送图片。",
  "image_context_source": "none",
  "original_task": "去掉背景，换成纯绿底"
}
```

## gifts-json Schema

Each item in the `--gifts-json` array:

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `name` | string | yes | Gift display name (e.g. `"毛绒花束"`) |
| `price_str` | string | yes | Price with unit (e.g. `"99钻"`, `"500元"`, `"2000"`) |
| `subject_description` | string | no | Visual/design direction from the ops doc |

Example:

```json
[
  { "name": "毛绒花束", "price_str": "99钻", "subject_description": "毛茸茸花束，暖色系，梦幻风格" },
  { "name": "冬日暖阳", "price_str": "500元", "subject_description": "阳光穿透云层，大型装置，写实光效" }
]
```

## Price Unit Conversion

Ops documents may use either 元 or 钻 as the price unit. The skill normalizes automatically:
- `1钻 = 0.1元`
- Example: `5000钻 = 500元` → 头部低 梯度

## Defaults

- Base URL: `https://zenmux.ai/api/vertex-ai`
- Output directory: `./output/banana`
- API auth header: `Authorization`
- API auth prefix: `Bearer `
- File conflict strategy: append `-2`, `-3`, and so on
- Model mode: `auto`
- Text LLM: `gpt-4o` via `https://api.openai.com/v1`
