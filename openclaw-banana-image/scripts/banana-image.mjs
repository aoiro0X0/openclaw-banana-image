#!/usr/bin/env node
import { access, mkdir, readFile, stat, writeFile } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { basename, extname, resolve } from 'node:path';
import { parseArgs } from 'node:util';
import { pathToFileURL } from 'node:url';
import readline from 'node:readline/promises';

export const DEFAULT_BASE_URL = 'https://zenmux.ai/api/vertex-ai';
export const DEFAULT_MODEL = 'google/gemini-3.1-flash-image-preview';
export const DEFAULT_API_VERSION = 'v1';
export const API_KEY_ENV_NAMES = ['ZENMUX_API_KEY'];

const CN_BACKGROUND_WORD = '背景';
const CN_BACKGROUND_REPLACE_VERBS = ['换', '替换', '抠图'];
const EN_BACKGROUND_REPLACE_PATTERNS = [
  'replace background',
  'background replace',
  'background replacement',
  'change background',
  'swap background',
];

export function isBackgroundReplaceTask(task) {
  const normalizedTask = task.toLowerCase();
  const hasChinesePattern = normalizedTask.includes(CN_BACKGROUND_WORD)
    && CN_BACKGROUND_REPLACE_VERBS.some((verb) => normalizedTask.includes(verb));
  const hasEnglishPattern = EN_BACKGROUND_REPLACE_PATTERNS.some((pattern) => normalizedTask.includes(pattern));
  return hasChinesePattern || hasEnglishPattern;
}

export function classifyMode(task, { inputImagePath, maskPath } = {}) {
  if (inputImagePath && isBackgroundReplaceTask(task)) {
    return 'background-replace';
  }
  if (inputImagePath && maskPath) {
    return 'inpaint';
  }
  if (inputImagePath) {
    return 'img2img';
  }
  return 'txt2img';
}

export function resolveApiKeyFromEnv(env = process.env) {
  for (const envName of API_KEY_ENV_NAMES) {
    const value = env[envName];
    if (typeof value === 'string' && value.trim()) {
      return value.trim();
    }
  }
  return null;
}

export async function resolveApiKey(apiKey, { promptForApiKey, env = process.env } = {}) {
  if (apiKey && apiKey.trim()) {
    return apiKey.trim();
  }
  const envApiKey = resolveApiKeyFromEnv(env);
  if (envApiKey) {
    return envApiKey;
  }
  if (!promptForApiKey) {
    throw new Error('API key is required for this request.');
  }
  const prompted = (await promptForApiKey('Enter Banana API key for this request: ')).trim();
  if (!prompted) {
    throw new Error('API key prompt was empty.');
  }
  return prompted;
}

export async function ensureExistingFile(pathValue, label) {
  if (!pathValue) {
    return null;
  }
  const resolved = resolve(pathValue);
  await access(resolved);
  const fileStat = await stat(resolved);
  if (!fileStat.isFile()) {
    throw new Error(`${label} is not a file: ${resolved}`);
  }
  return resolved;
}

export async function buildWorkflowRequest({
  task,
  apiKey,
  inputImagePath,
  maskPath,
  referenceImagePaths = [],
  size,
  steps,
  seed,
  outputDir,
  model = DEFAULT_MODEL,
  apiVersion = DEFAULT_API_VERSION,
  promptForApiKey,
  env = process.env,
}) {
  const resolvedInput = await ensureExistingFile(inputImagePath, 'Input image');
  if (maskPath && !resolvedInput) {
    throw new Error('maskPath requires inputImagePath.');
  }
  const resolvedMask = await ensureExistingFile(maskPath, 'Mask image');
  const resolvedReferences = [];
  for (const referencePath of referenceImagePaths) {
    resolvedReferences.push(await ensureExistingFile(referencePath, 'Reference image'));
  }

  return {
    task: task.trim(),
    apiKey: await resolveApiKey(apiKey, { promptForApiKey, env }),
    mode: classifyMode(task, { inputImagePath, maskPath }),
    inputImagePath: resolvedInput,
    maskPath: resolvedMask,
    referenceImagePaths: resolvedReferences,
    size: size ?? null,
    steps: steps ?? null,
    seed: seed ?? null,
    model,
    apiVersion,
    outputDir: outputDir ? resolve(outputDir) : resolve(process.cwd(), 'output', 'banana'),
  };
}

export async function encodeFile(filePath) {
  const bytes = await readFile(filePath);
  return {
    path: filePath,
    filename: basename(filePath),
    contentBase64: Buffer.from(bytes).toString('base64'),
  };
}

export async function buildPayload(request) {
  const payload = {
    task: request.task,
    mode: request.mode,
    model: request.model,
    api_version: request.apiVersion,
  };
  if (request.size) {
    payload.size = request.size;
  }
  if (request.steps !== null) {
    payload.steps = request.steps;
  }
  if (request.seed !== null) {
    payload.seed = request.seed;
  }
  if (request.inputImagePath) {
    payload.input_image = await encodeFile(request.inputImagePath);
  }
  if (request.maskPath) {
    payload.mask_image = await encodeFile(request.maskPath);
  }
  if (request.referenceImagePaths.length > 0) {
    payload.reference_images = await Promise.all(request.referenceImagePaths.map((filePath) => encodeFile(filePath)));
  }
  return payload;
}

export function uniqueOutputPath(outputDir, preferredName) {
  const filename = basename(preferredName || 'banana-result.png');
  const extension = extname(filename) || '.png';
  const stem = extension ? filename.slice(0, -extension.length) : filename;
  let candidate = resolve(outputDir, filename);
  let index = 2;
  while (existsSync(candidate)) {
    candidate = resolve(outputDir, `${stem}-${index}${extension}`);
    index += 1;
  }
  return candidate;
}

export function extractImageItems(responsePayload) {
  for (const key of ['images', 'output_files', 'data']) {
    const value = responsePayload[key];
    if (Array.isArray(value)) {
      return value.map((item, index) => {
        if (typeof item === 'string') {
          return {
            filename: `banana-result-${index + 1}.png`,
            b64_json: item,
          };
        }
        return item;
      });
    }
  }
  return [];
}

export function guessFilename(item, index, mode) {
  if (item.filename) {
    return item.filename;
  }
  if (item.url) {
    try {
      const url = new URL(item.url);
      const name = basename(url.pathname);
      if (name) {
        return name;
      }
    } catch {
      // Fall back to a generated filename if the URL is malformed.
    }
  }
  return `${mode}-${index}.png`;
}

export async function imageBytesFromItem(item, { fetchImpl }) {
  for (const key of ['b64_json', 'contentBase64', 'base64', 'data']) {
    const value = item[key];
    if (typeof value === 'string' && value.length > 0) {
      return Buffer.from(value, 'base64');
    }
  }
  if (typeof item.url === 'string' && item.url.length > 0) {
    const response = await fetchImpl(item.url, {
      headers: { Accept: 'image/*' },
    });
    if (!response.ok) {
      throw new Error(`HTTP ${response.status}: failed to download output image`);
    }
    return Buffer.from(await response.arrayBuffer());
  }
  throw new Error('Image item did not include base64 data or a downloadable URL.');
}

export async function saveImageItems(items, { outputDir, mode, fetchImpl }) {
  await mkdir(outputDir, { recursive: true });
  const outputFiles = [];
  for (const [index, item] of items.entries()) {
    const filename = guessFilename(item, index + 1, mode);
    const destination = uniqueOutputPath(outputDir, filename);
    const bytes = await imageBytesFromItem(item, { fetchImpl });
    await writeFile(destination, bytes);
    outputFiles.push(destination);
  }
  return outputFiles;
}

export function summarizeResponse(responsePayload) {
  return JSON.stringify(responsePayload).slice(0, 400);
}

export function buildRequestSummary(request, responsePayload) {
  return {
    mode: request.mode,
    size: request.size,
    steps: request.steps,
    seed: request.seed,
    model: request.model,
    api_version: request.apiVersion,
    has_input_image: Boolean(request.inputImagePath),
    has_mask_image: Boolean(request.maskPath),
    reference_count: request.referenceImagePaths.length,
    ...(responsePayload.request_summary ?? {}),
  };
}

export function buildReproInfo(request, responsePayload) {
  return {
    prompt: request.task,
    mode: request.mode,
    seed: request.seed,
    size: request.size,
    model: request.model,
    api_version: request.apiVersion,
    ...(responsePayload.repro_info ?? {}),
  };
}

export async function invokeApi(request, {
  baseUrl = DEFAULT_BASE_URL,
  endpoint = '/v1/images',
  apiKeyHeader = 'Authorization',
  apiKeyPrefix = 'Bearer ',
  fetchImpl = fetch,
}) {
  const payload = await buildPayload(request);
  const response = await fetchImpl(new URL(endpoint, baseUrl).toString(), {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Accept: 'application/json',
      [apiKeyHeader]: `${apiKeyPrefix}${request.apiKey}`.trim(),
    },
    body: JSON.stringify(payload),
  });

  if (!response.ok) {
    const message = await response.text();
    throw new Error(`HTTP ${response.status}: ${message || 'request failed'}`);
  }
  return response.json();
}

export async function runWorkflow(request, {
  baseUrl = DEFAULT_BASE_URL,
  endpoint = '/v1/images',
  apiKeyHeader = 'Authorization',
  apiKeyPrefix = 'Bearer ',
  fetchImpl = fetch,
}) {
  const result = {
    mode: request.mode,
    output_files: [],
    request_summary: {},
    repro_info: {},
    raw_response_excerpt: '',
    error: null,
  };

  try {
    const responsePayload = await invokeApi(request, {
      baseUrl,
      endpoint,
      apiKeyHeader,
      apiKeyPrefix,
      fetchImpl,
    });
    result.raw_response_excerpt = summarizeResponse(responsePayload);

    if (typeof responsePayload.error === 'string' && responsePayload.error.trim()) {
      result.error = responsePayload.error.trim();
      return result;
    }

    const items = extractImageItems(responsePayload);
    if (items.length === 0) {
      result.error = 'API response did not contain any output images.';
      return result;
    }

    result.output_files = await saveImageItems(items, {
      outputDir: request.outputDir,
      mode: request.mode,
      fetchImpl,
    });
    result.request_summary = buildRequestSummary(request, responsePayload);
    result.repro_info = buildReproInfo(request, responsePayload);
    return result;
  } catch (error) {
    result.error = error.message;
    return result;
  }
}

export function parseCliArgs(argv) {
  const { values } = parseArgs({
    args: argv,
    allowPositionals: true,
    options: {
      task: { type: 'string' },
      'base-url': { type: 'string', default: DEFAULT_BASE_URL },
      endpoint: { type: 'string', default: '/v1/images' },
      model: { type: 'string', default: DEFAULT_MODEL },
      'api-version': { type: 'string', default: DEFAULT_API_VERSION },
      'api-key': { type: 'string' },
      'input-image-path': { type: 'string' },
      'mask-path': { type: 'string' },
      'reference-image-path': { type: 'string', multiple: true },
      size: { type: 'string' },
      steps: { type: 'string' },
      seed: { type: 'string' },
      'output-dir': { type: 'string' },
      'api-key-header': { type: 'string', default: 'Authorization' },
      'api-key-prefix': { type: 'string', default: 'Bearer ' },
      help: { type: 'boolean', default: false },
    },
  });
  return values;
}

export function helpText() {
  return [
    'Run an OpenClaw banana image generation or editing workflow.',
    '',
    'Defaults:',
    `  base URL: ${DEFAULT_BASE_URL}`,
    `  model: ${DEFAULT_MODEL}`,
    `  api version: ${DEFAULT_API_VERSION}`,
    `  API key env: ${API_KEY_ENV_NAMES.join(', ')}`,
    '',
    'Usage:',
    '  node ./scripts/banana-image.mjs --task "Create a banana ad image"',
    '',
    'Options:',
    '  --task                  Natural-language task description.',
    '  --base-url              Banana HTTP API base URL.',
    '  --endpoint              API endpoint path. Default: /v1/images',
    '  --model                 Model name. Default: google/gemini-3.1-flash-image-preview',
    '  --api-version           API version string. Default: v1',
    '  --api-key               One-time API key. If omitted, the script checks ZENMUX_API_KEY and then prompts.',
    '  --input-image-path      Local input image path.',
    '  --mask-path             Local mask image path for inpaint.',
    '  --reference-image-path  Repeatable local reference image path.',
    '  --size                  Optional size, such as 1024x1024.',
    '  --steps                 Optional inference steps.',
    '  --seed                  Optional numeric seed.',
    '  --output-dir            Output directory. Default: ./output/banana',
  ].join('\n');
}

export async function promptForApiKey(prompt) {
  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
  });
  try {
    return await rl.question(prompt);
  } finally {
    rl.close();
  }
}

export async function main(argv = process.argv.slice(2)) {
  const args = parseCliArgs(argv);
  if (args.help) {
    process.stdout.write(`${helpText()}\n`);
    return 0;
  }
  if (!args.task) {
    process.stderr.write('The --task option is required.\n');
    return 1;
  }

  const request = await buildWorkflowRequest({
    task: args.task,
    apiKey: args['api-key'],
    inputImagePath: args['input-image-path'],
    maskPath: args['mask-path'],
    referenceImagePaths: args['reference-image-path'] ?? [],
    size: args.size,
    steps: args.steps ? Number(args.steps) : null,
    seed: args.seed ? Number(args.seed) : null,
    outputDir: args['output-dir'],
    model: args.model,
    apiVersion: args['api-version'],
    promptForApiKey,
    env: process.env,
  });
  const result = await runWorkflow(request, {
    baseUrl: args['base-url'],
    endpoint: args.endpoint,
    apiKeyHeader: args['api-key-header'],
    apiKeyPrefix: args['api-key-prefix'],
  });
  process.stdout.write(`${JSON.stringify(result, null, 2)}\n`);
  return result.error ? 1 : 0;
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const exitCode = await main();
  process.exit(exitCode);
}
