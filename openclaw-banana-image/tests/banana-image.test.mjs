import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, rm } from 'node:fs/promises';
import { join } from 'node:path';
import { tmpdir } from 'node:os';

import {
  buildPayload,
  buildWorkflowRequest,
  extractImageItems,
  invokeApi,
  runWorkflow,
} from '../scripts/banana-image.mjs';

test('buildWorkflowRequest accepts GEMINI_API_KEY from env', async () => {
  const request = await buildWorkflowRequest({
    task: 'Create a banana ad image',
    env: {
      GEMINI_API_KEY: 'gemini-key',
    },
  });

  assert.equal(request.apiKey, 'gemini-key');
});

test('buildPayload emits Vertex AI generateContent payload for image generation', async () => {
  const payload = await buildPayload({
    task: 'Create a banana ad image',
    mode: 'txt2img',
    model: 'google/gemini-3-pro-image-preview',
    apiVersion: 'v1',
    inputImagePath: null,
    maskPath: null,
    referenceImagePaths: [],
    size: null,
    steps: null,
    seed: 7,
  });

  assert.deepEqual(payload, {
    contents: [
      {
        role: 'user',
        parts: [
          {
            text: 'Create a banana ad image',
          },
        ],
      },
    ],
    generationConfig: {
      responseModalities: ['TEXT', 'IMAGE'],
      seed: 7,
    },
  });
});

test('invokeApi uses Vertex AI generateContent endpoint derived from provider and model', async () => {
  const calls = [];
  const fetchImpl = async (url, options) => {
    calls.push({ url, options });
    return {
      ok: true,
      async json() {
        return { candidates: [] };
      },
    };
  };

  await invokeApi({
    task: 'Create a banana ad image',
    apiKey: 'test-key',
    mode: 'txt2img',
    model: 'google/gemini-3-pro-image-preview',
    apiVersion: 'v1',
    inputImagePath: null,
    maskPath: null,
    referenceImagePaths: [],
    size: null,
    steps: null,
    seed: null,
  }, {
    fetchImpl,
  });

  assert.equal(calls.length, 1);
  assert.equal(
    calls[0].url,
    'https://zenmux.ai/api/vertex-ai/v1/publishers/google/models/gemini-3-pro-image-preview:generateContent',
  );
  assert.equal(calls[0].options.headers.Authorization, 'Bearer test-key');
});

test('extractImageItems reads inline image data from Vertex AI candidate parts', () => {
  const items = extractImageItems({
    candidates: [
      {
        content: {
          parts: [
            { text: 'Done' },
            {
              inlineData: {
                mimeType: 'image/png',
                data: 'ZmFrZQ==',
              },
            },
          ],
        },
      },
    ],
  });

  assert.deepEqual(items, [
    {
      inlineData: {
        mimeType: 'image/png',
        data: 'ZmFrZQ==',
      },
    },
  ]);
});

test('runWorkflow exposes OpenClaw-compatible media URLs for generated images', async () => {
  const outputDir = await mkdtemp(join(tmpdir(), 'banana-media-'));

  try {
    const result = await runWorkflow({
      task: 'Create a banana ad image',
      apiKey: 'test-key',
      mode: 'txt2img',
      model: 'google/gemini-3-pro-image-preview',
      apiVersion: 'v1',
      inputImagePath: null,
      maskPath: null,
      referenceImagePaths: [],
      size: null,
      steps: null,
      seed: null,
      outputDir,
    }, {
      fetchImpl: async () => ({
        ok: true,
        async json() {
          return {
            candidates: [
              {
                content: {
                  parts: [
                    {
                      inlineData: {
                        mimeType: 'image/png',
                        data: Buffer.from('fake-image').toString('base64'),
                      },
                    },
                  ],
                },
              },
            ],
          };
        },
      }),
    });

    assert.equal(result.error, null);
    assert.equal(result.output_files.length, 1);
    assert.deepEqual(result.media, {
      mediaUrls: result.output_files,
      mediaUrl: result.output_files[0],
    });
    assert.deepEqual(result.mediaUrls, result.output_files);
    assert.equal(result.mediaUrl, result.output_files[0]);
  } finally {
    await rm(outputDir, { recursive: true, force: true });
  }
});
