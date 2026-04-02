# HTTP API

## Request Shape

`banana-image.mjs` sends a JSON POST request to `new URL(endpoint, baseUrl)`.

Default transport values:

- base URL: `https://zenmux.ai/api/vertex-ai`
- endpoint: `/v1/images`
- model: `google/gemini-3.1-flash-image-preview`
- api version: `v1`

Core fields:

- `task`
- `mode`
- `model`
- `api_version`
- `size`
- `steps`
- `seed`
- `input_image`
- `mask_image`
- `reference_images`

File objects use this shape:

```json
{
  "path": "F:/images/input.png",
  "filename": "input.png",
  "contentBase64": "..."
}
```

## Authentication

By default the runner sends:

- header name: `Authorization`
- header value: `Bearer <apiKey>`

The script first checks `ZENMUX_API_KEY`, then falls back to an interactive prompt.

## Response Shape

The runner accepts these array keys for generated images:

- `images`
- `output_files`
- `data`

Each item may include:

- `filename`
- `b64_json`
- `contentBase64`
- `base64`
- `data`
- `url`

Optional top-level fields:

- `request_summary`
- `repro_info`
- `error`

If image data is returned by `url`, the runner downloads it and saves it locally.
