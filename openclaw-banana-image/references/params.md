# Parameters

## Input Contract

- `task`: required natural-language request
- `apiKey`: optional one-time API key; otherwise read `ZENMUX_API_KEY`, then prompt
- `inputImagePath`: optional local file path for `img2img`, `inpaint`, or background replacement
- `maskPath`: optional local file path; valid only with `inputImagePath`
- `referenceImagePaths`: optional list of local file paths
- `size`: optional target size such as `1024x1024`
- `steps`: optional integer
- `seed`: optional integer
- `outputDir`: optional local output directory
- `model`: defaults to `google/gemini-3.1-flash-image-preview`
- `apiVersion`: defaults to `v1`

## Output Contract

The runner returns JSON with:

- `mode`
- `output_files`
- `request_summary`
- `repro_info`
- `raw_response_excerpt`
- `error`

## Defaults

- Base URL: `https://zenmux.ai/api/vertex-ai`
- Output directory: `./output/banana`
- API auth header: `Authorization`
- API auth prefix: `Bearer `
- File conflict strategy: append `-2`, `-3`, and so on
