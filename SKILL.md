---
name: openclaw-gift-design
description: 为抖音直播礼物设计师提供意图分析 + 价效规范检查 + 多参考图组合 + 图像生成的完整工作流 skill。意图分析、运营文档提取、合规表格输出均由 OpenClaw Agent 处理；脚本负责图像生成，只需配置 ZENMUX_API_KEY。
---

# OpenClaw Banana Image

## Overview

This skill routes Douyin Live gift design requests for OpenClaw. Architecture:

- **OpenClaw Agent** — handles all intelligence: reads ops docs, extracts gift items, checks price-tier compliance, analyzes designer intent, optimizes prompts, creates Feishu design docs.
- **`scripts/banana-image.mjs`** — handles all image generation: calls the Zenmux Vertex AI `generateContent` endpoint, saves output, returns OpenClaw-compatible `mediaUrls` (base64 data URIs).

Only one API key is needed: `ZENMUX_API_KEY` (or `GEMINI_API_KEY`).

## GitHub Install

Expected repo layout:

- `<repo>/openclaw-gift-design/SKILL.md`
- `<repo>/openclaw-gift-design/agents/openai.yaml`
- `<repo>/openclaw-gift-design/scripts/banana-image.mjs`
- `<repo>/openclaw-gift-design/scripts/intent-analyzer.mjs`
- `<repo>/openclaw-gift-design/scripts/model-router.mjs`
- `<repo>/openclaw-gift-design/scripts/feishu-bridge.mjs`
- `<repo>/openclaw-gift-design/references/*`

Agent-facing install request example:

```text
Use $skill-installer to install this skill from https://github.com/<owner>/<repo>/tree/main/openclaw-gift-design
```

## Defaults

- Base URL: `https://zenmux.ai/api/vertex-ai`
- Endpoint pattern: `/v1/publishers/{provider}/models/{model}:generateContent`
- Image model: `google/gemini-3-pro-image-preview` (auto-routed)
- API key env vars: `ZENMUX_API_KEY`, `GEMINI_API_KEY`

## When to Use

Use this skill when the request involves Douyin Live gift raster image workflows:

- **ops doc intake** — user provides a Feishu doc or pastes ops text without a specific task → Agent outputs price-tier compliance table and creates a Feishu design doc
- text-to-image generation from ops brief
- image-to-image editing on a base image
- inpaint or localized edits
- background replacement
- multi-reference feature combination ("take composition from A, color from B")

Do not use it for vector assets, SVG/logo systems, or code-native graphics.

## Workflow

### Mode A — Ops Doc Intake (no design task yet)

Handled entirely by the Agent (no script call):

1. Fetch ops doc content (Feishu URL → `lark-cli docs +fetch`, or use pasted text directly).
2. Extract every gift item (name, price, visual notes) from the doc.
3. Match each price to the 价效梯度 table (Agent has the full table in `agents/openai.yaml`).
4. Output a markdown compliance table.
5. Create a Feishu design doc in the user's personal space (`my_library`) via `lark-cli docs +create`, with ops text + design work table as content.
6. Share the design doc URL with the user.

### Mode B — Full Design Workflow (with task)

1. Agent analyzes designer intent: reference image roles, price-tier check, optimized prompt.
2. If critical info is missing → Agent asks one focused question.
3. Agent calls the script:

```bash
node ./scripts/banana-image.mjs \
  --task "<optimized prompt>" \
  [--input-image-path <path>] \
  [--mask-path <path>] \
  [--reference-image-path <path> --reference-label "<role>"] \
  [--model-mode auto]
```

4. Script returns JSON with `mediaUrls` (base64 data URIs) — OpenClaw delivers the image back to the conversation.

## Price-Tier Compliance (价效规范)

The Agent has built-in knowledge of the Douyin Live gift price-tier spec (updated 2026-01-09):

| Tier | Price (元) | Subject | Duration | Camera |
|------|-----------|---------|----------|--------|
| 头部8层 | 2000-3000 | 星际/神性大型动物 | 9s | 1-4 cuts |
| 头部 | 500-2000 | 大型装置/神兽 | 9s | multi-cut |
| 头部低 | 100-500 | 豪华消费品/中型动物 | 6s | 2 cuts |
| 腰部高 | 50-100 | 交通工具/小动物 | 4s | none |
| 腰部 | 9.9-50 | 食物/植物 | 3s | none |
| 尾部高 | 2-9.9 | 日常消费品 | 1.5s | none |
| 尾部 | 0-2 | 符号 | 0s | none |

Price unit: supports both 元 and 钻 (1钻 = 0.1元).

## API Key Rules

- Only `ZENMUX_API_KEY` (or `GEMINI_API_KEY`) is needed — for image generation only.
- No separate text LLM API key. The OpenClaw Agent handles all analysis.
- Never write any key to disk, environment files, caches, or repo config.

## Commands

### Full workflow (Agent analyzes intent, then calls script):

```bash
# Multi-reference combination
node ./scripts/banana-image.mjs \
  --task "take composition from ref1, color palette from ref2, 500元 tier divine beast emerging from light" \
  --reference-image-path ./ref1.png --reference-label "取构图" \
  --reference-image-path ./ref2.png --reference-label "取配色"
```

```bash
# Edit base image
node ./scripts/banana-image.mjs \
  --task "enhance particle impact and light emission for 2000元 tier cosmic creature" \
  --input-image-path ./base.png
```

### Local compliance helpers (pure functions, no API key):

```js
import { parsePriceToYuan, matchPriceTier, buildComplianceRows, formatComplianceTable } from './scripts/intent-analyzer.mjs';
```

## References

- Mode selection and examples: `references/workflows.md`
- Input/output contract: `references/params.md`
- HTTP request and response shape: `references/http-api.md`
- Nano Banana provider notes: `references/zenmux-nano-banana.md`
- GitHub install guidance: `references/github-install.md`
