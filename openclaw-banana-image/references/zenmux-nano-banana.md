# Nano Banana 2 on Zenmux

The current skill defaults target this stack:

- provider: Zenmux Vertex AI endpoint
- base URL: `https://zenmux.ai/api/vertex-ai`
- model: `google/gemini-3.1-flash-image-preview`
- API key env var: `ZENMUX_API_KEY`

## Reference Python Example

```python
from google import genai
from google.genai import types

client = genai.Client(
    api_key="$ZENMUX_API_KEY",
    vertexai=True,
    http_options=types.HttpOptions(
        api_version='v1',
        base_url='https://zenmux.ai/api/vertex-ai',
    ),
)

response = client.models.generate_content(
    model="google/gemini-3.1-flash-image-preview",
    contents=["Create a banana dish in a fancy restaurant"],
    config=types.GenerateContentConfig(
        response_modalities=["TEXT", "IMAGE"],
    ),
)
```

## How This Skill Uses Those Defaults

- It reuses the same base URL, model, and API version as runner defaults.
- It prefers `ZENMUX_API_KEY` before prompting the user.
- It preserves OpenClaw-friendly behavior such as local file inputs, non-destructive outputs, and structured JSON results.

## Current Boundary

The installed skill runner currently uses a generic HTTP adapter layer with Nano Banana 2 defaults. If the upstream wire format changes, update `scripts/banana-image.mjs` and this reference together.
