---
name: openclaw-banana-image
description: 为抖音直播礼物设计师提供意图分析 + 价效规范检查 + 多参考图组合 + Banana 图像生成的完整工作流 skill。支持从运营飞书文档提取需求约束，自动路由 txt2img/img2img/inpaint/background-replace 模式，多轮对话补全缺失信息，结果发回飞书群。可单独使用，也可作为子 agent 嵌入完整创作 agent。
---

# OpenClaw Banana Image

## Overview

This skill routes Douyin Live gift design requests for OpenClaw. It:

1. **Reads ops documents** from Feishu links or pasted text to extract price-tier requirements and visual direction.
2. **Analyzes designer intent** using a text LLM — understands structured instructions like "take composition from ref1, color from ref2", checks price-tier compliance (价效规范), and optimizes the generation prompt.
3. **Routes to the right model** — creative txt2img goes to Seedream, editing/inpaint/combination goes to Banana (Gemini image).
4. **Generates images** via the Zenmux Vertex AI `generateContent` endpoint.
5. **Delivers results** to a Feishu chat with intent summary, optimized prompt, and price-tier compliance notes.

## GitHub Install

Expected repo layout:

- `<repo>/openclaw-banana-image/SKILL.md`
- `<repo>/openclaw-banana-image/agents/openai.yaml`
- `<repo>/openclaw-banana-image/scripts/banana-image.mjs`
- `<repo>/openclaw-banana-image/scripts/intent-analyzer.mjs`
- `<repo>/openclaw-banana-image/scripts/model-router.mjs`
- `<repo>/openclaw-banana-image/scripts/feishu-bridge.mjs`
- `<repo>/openclaw-banana-image/references/*`

Agent-facing install request example:

```text
Use $skill-installer to install this skill from https://github.com/<owner>/<repo>/tree/main/openclaw-banana-image
```

## Defaults

- Base URL: `https://zenmux.ai/api/vertex-ai`
- Endpoint pattern: `/v1/publishers/{provider}/models/{model}:generateContent`
- Image model: `google/gemini-3-pro-image-preview` (auto-routed)
- Text LLM: `gpt-4o` via OpenAI-compatible endpoint
- API key env vars: `ZENMUX_API_KEY`, `GEMINI_API_KEY`
- Text LLM env vars: `TEXT_LLM_API_KEY`, `TEXT_LLM_BASE_URL`, `TEXT_LLM_MODEL`
- Model mode: `auto` (intent-driven routing)

## When to Use

Use this skill when the request involves Douyin Live gift raster image workflows:

- text-to-image generation from ops brief
- image-to-image editing on a base image
- inpaint or localized edits
- background replacement
- multi-reference feature combination ("take composition from A, color from B")

Do not use it for vector assets, SVG/logo systems, or code-native graphics.

## Workflow

1. Read ops document from `--feishu-doc-url` or `--ops-doc-text`.
2. Call intent analyzer (text LLM) → get structured plan with price-tier check.
3. If `follow_up_question` is set → surface question to user, wait for reply, re-invoke with `--conversation`.
4. Route to model via `--model-mode auto` (default) or `--model-mode pick`.
5. Run `scripts/banana-image.mjs` with optimized prompt and image API settings.
6. Return JSON with `intent_analysis`, `optimized_prompt`, `price_tier_analysis`, `model_routing`, and OpenClaw `media`/`mediaUrls` fields — OpenClaw delivers the image back to the Feishu conversation automatically.

## Price-Tier Compliance (价效规范)

The intent analyzer has built-in knowledge of the Douyin Live gift price-tier spec (updated 2026-01-09):

| Tier | Price (元) | Subject | Duration | Camera |
|------|-----------|---------|----------|--------|
| 头部8层 | 2000-3000 | 星际/神性大型动物 | 9s | 1-4 cuts |
| 头部 | 500-2000 | 大型装置/神兽 | 9s | multi-cut |
| 头部低 | 100-500 | 豪华消费品/中型动物 | 6s | 2 cuts |
| 腰部高 | 50-100 | 交通工具/小动物 | 4s | none |
| 腰部 | 9.9-50 | 食物/植物 | 3s | none |
| 尾部高 | 2-9.9 | 日常消费品 | 1-2s | none |
| 尾部 | 0-2 | 符号 | 0s | none |

Price unit: supports both 元 and 钻 (1钻 = 0.1元).

## API Key Rules

- Ask for the image API key only when both `ZENMUX_API_KEY` and `GEMINI_API_KEY` are unset.
- `TEXT_LLM_API_KEY` is required for intent analysis; set it in the environment.
- Never write any key to disk, environment files, caches, or repo config.

## Commands

### Full workflow (with intent analysis + Feishu):

```bash
# Designer B: multi-reference combination with ops doc
node ./scripts/banana-image.mjs \
  --task "参考图1取构图，参考图2取配色，做一个500元梯度的礼物" \
  --reference-image-path ./ref1.png --reference-label "取构图" \
  --reference-image-path ./ref2.png --reference-label "取配色" \
  --feishu-doc-url "https://bytedance.larkoffice.com/docx/xxx" \
  --feishu-chat-id "oc_xxx"
```

```bash
# Designer A: edit base image
node ./scripts/banana-image.mjs \
  --task "增强光效和粒子冲击力" \
  --input-image-path ./base.png \
  --ops-doc-text "价位：2000钻，视觉方向：科技奇幻"
```

### Skip intent analysis (direct mode):

```bash
node ./scripts/banana-image.mjs \
  --task "Create a gift with glowing particles" \
  --skip-intent
```

## References

- Mode selection and examples: `references/workflows.md`
- Input/output contract: `references/params.md`
- HTTP request and response shape: `references/http-api.md`
- Nano Banana provider notes: `references/zenmux-nano-banana.md`
- GitHub install guidance: `references/github-install.md`
