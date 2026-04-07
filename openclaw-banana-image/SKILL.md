---
name: openclaw-banana-image
description: Install and run an OpenClaw banana image skill for Nano Banana image generation and editing over the Zenmux Vertex AI endpoint. Use it for text-to-image, image-to-image, inpaint, and background replacement tasks that should be installable from a GitHub skill folder URL.
deprecated: true
---

> **DEPRECATED** — This is the pre-v1.0.0 stub. It only contains the core image generation script and lacks intent analysis, model routing, and Feishu integration.
> Use the full v1.0.0 implementation at the repo root instead.

# OpenClaw Banana Image

## Overview

This skill routes Nano Banana image generation and editing requests for OpenClaw. It classifies the task, collects local file inputs, resolves `ZENMUX_API_KEY` or `GEMINI_API_KEY`, calls the Zenmux Vertex AI `generateContent` endpoint, saves image outputs into the workspace, and returns OpenClaw-compatible media fields so the host can send the generated image back to chat.

## GitHub Install

This folder is designed to be installed directly from a GitHub path by an agent.

Expected repo layout:

- `<repo>/openclaw-banana-image/SKILL.md`
- `<repo>/openclaw-banana-image/agents/openai.yaml`
- `<repo>/openclaw-banana-image/scripts/banana-image.mjs`
- `<repo>/openclaw-banana-image/references/*`

Once this folder is pushed to GitHub, an agent can install it from a GitHub tree URL such as:

```text
https://github.com/<owner>/<repo>/tree/main/openclaw-banana-image
```

Agent-facing install request example:

```text
Use $skill-installer to install this skill from https://github.com/<owner>/<repo>/tree/main/openclaw-banana-image
```

## Defaults

- Base URL: `https://zenmux.ai/api/vertex-ai`
- Endpoint pattern: `/v1/publishers/{provider}/models/{model}:generateContent`
- Model: `google/gemini-3-pro-image-preview`
- API version: `v1`
- API key env vars: `ZENMUX_API_KEY`, `GEMINI_API_KEY`
- Base URL env vars: `ZENMUX_BASE_URL`, `GOOGLE_GEMINI_BASE_URL`
- Optional image model env vars: `OPENCLAW_BANANA_MODEL`, `ZENMUX_IMAGE_MODEL`, `GEMINI_MODEL` (only if it is an image-capable model)

## When to Use

Use this skill when the request is about Nano Banana raster image workflows for OpenClaw, including:

- text-to-image generation
- image-to-image editing
- inpaint or local masked edits
- background replacement

Do not use it for vector assets, SVG/logo systems, or code-native graphics.

## Workflow

1. Read the request and identify local file inputs.
2. Choose the mode:
   - no input image -> `txt2img`
   - input image only -> `img2img`
   - input image + mask -> `inpaint`
   - explicit background-replacement request -> `background-replace`
3. Resolve the API key from `ZENMUX_API_KEY` or `GEMINI_API_KEY`; if both are missing, prompt for a one-time key.
4. Run `scripts/banana-image.mjs` with the task, local paths, and API settings.
5. Return the saved file paths plus OpenClaw-compatible `media` / `mediaUrls` fields, along with the request summary and repro info.

## API Key Rules

- Ask for the API key only when the current run does not already have one and both env vars are unset.
- Treat the key as request-scoped only.
- Never write the key to disk, environment files, caches, or repo config.

## Files and Outputs

- Prefer local filesystem paths for input images, masks, and references.
- Default outputs go to `./output/banana` relative to the current workspace.
- The runner also returns OpenClaw-compatible `media.mediaUrls`, `mediaUrls`, and `mediaUrl` fields that point at the generated files.
- Never overwrite an existing output file; create a suffixed filename instead.

## Commands

Main runner:

```bash
node ./scripts/banana-image.mjs --task "Create a banana ad image"
```

Helpful references:

- Mode selection and examples: `references/workflows.md`
- Input/output contract: `references/params.md`
- HTTP request and response shape: `references/http-api.md`
- Nano Banana provider notes: `references/zenmux-nano-banana.md`
- GitHub install guidance: `references/github-install.md`



