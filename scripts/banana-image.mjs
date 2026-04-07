#!/usr/bin/env node
import { access, mkdir, readFile, stat, writeFile } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { basename, extname, resolve } from 'node:path';
import { parseArgs } from 'node:util';
import { pathToFileURL } from 'node:url';
import readline from 'node:readline/promises';
import { analyzeIntent, analyzeOpsDoc, buildDesignDocMarkdown } from './intent-analyzer.mjs';
import { routeModel } from './model-router.mjs';
import { fetchFeishuDoc, createFeishuDesignDoc } from './feishu-bridge.mjs';

export const DEFAULT_BASE_URL = 'https://zenmux.ai/api/vertex-ai';
export const DEFAULT_MODEL = 'google/gemini-3-pro-image-preview';
export const DEFAULT_API_VERSION = 'v1';
export const API_KEY_ENV_NAMES = ['ZENMUX_API_KEY', 'GEMINI_API_KEY'];
export const BASE_URL_ENV_NAMES = ['ZENMUX_BASE_URL', 'GOOGLE_GEMINI_BASE_URL'];
export const MODEL_ENV_NAMES = ['OPENCLAW_BANANA_MODEL', 'ZENMUX_IMAGE_MODEL'];

const CN_BACKGROUND_WORD = '\u80cc\u666f';
const CN_BACKGROUND_REPLACE_VERBS = ['\u6362', '\u66ff\u6362', '\u62a0\u56fe'];
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

export function resolveFirstEnv(envNames, env = process.env) {
  for (const envName of envNames) {
    const value = env[envName];
    if (typeof value === 'string' && value.trim()) {
      return value.trim();
    }
  }
  return null;
}

export function normalizeModelName(model) {
  const trimmed = model.trim();
  if (!trimmed) {
    return DEFAULT_MODEL;
  }
  return trimmed.includes('/') ? trimmed : `google/${trimmed}`;
}

export function isImageCapableModel(model) {
  return model.toLowerCase().includes('image');
}

export function resolveModel(model, env = process.env) {
  if (typeof model === 'string' && model.trim()) {
    return normalizeModelName(model);
  }

  const explicitImageModel = resolveFirstEnv(MODEL_ENV_NAMES, env);
  if (explicitImageModel) {
    return normalizeModelName(explicitImageModel);
  }

  const geminiModel = resolveFirstEnv(['GEMINI_MODEL'], env);
  if (geminiModel && isImageCapableModel(geminiModel)) {
    return normalizeModelName(geminiModel);
  }

  return DEFAULT_MODEL;
}

export function resolveBaseUrl(baseUrl, env = process.env) {
  if (typeof baseUrl === 'string' && baseUrl.trim()) {
    return baseUrl.trim().replace(/\/+$/, '');
  }
  return (resolveFirstEnv(BASE_URL_ENV_NAMES, env) ?? DEFAULT_BASE_URL).replace(/\/+$/, '');
}

export function resolveApiVersion(apiVersion) {
  if (typeof apiVersion === 'string' && apiVersion.trim()) {
    return apiVersion.trim();
  }
  return DEFAULT_API_VERSION;
}

export function resolveApiKeyFromEnv(env = process.env) {
  return resolveFirstEnv(API_KEY_ENV_NAMES, env);
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
    throw new Error('API key is required for this request. Set ZENMUX_API_KEY or GEMINI_API_KEY.');
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
  model,
  apiVersion,
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
    model: resolveModel(model, env),
    apiVersion: resolveApiVersion(apiVersion),
    outputDir: outputDir ? resolve(outputDir) : resolve(process.cwd(), 'output', 'banana'),
  };
}

export function guessMimeType(filePath) {
  switch (extname(filePath).toLowerCase()) {
    case '.jpg':
    case '.jpeg':
      return 'image/jpeg';
    case '.webp':
      return 'image/webp';
    case '.gif':
      return 'image/gif';
    default:
      return 'image/png';
  }
}

export function extensionForMimeType(mimeType) {
  switch ((mimeType ?? '').toLowerCase()) {
    case 'image/jpeg':
      return '.jpg';
    case 'image/webp':
      return '.webp';
    case 'image/gif':
      return '.gif';
    default:
      return '.png';
  }
}

export async function encodeFile(filePath) {
  const bytes = await readFile(filePath);
  return {
    path: filePath,
    filename: basename(filePath),
    mimeType: guessMimeType(filePath),
    contentBase64: Buffer.from(bytes).toString('base64'),
  };
}

export function buildPromptText(request) {
  const parts = [request.task.trim()];
  if (request.mode === 'inpaint') {
    parts.push('Use the provided mask image as an edit mask. Only change the masked region and preserve everything else.');
  }
  if (request.mode === 'background-replace') {
    parts.push('Replace the background while preserving the main subject.');
  }
  if (request.referenceImagePaths.length > 0) {
    parts.push('Use the reference images for style and composition guidance.');
  }
  return parts.join('\n\n');
}

export function buildInlineDataPart(file) {
  return {
    inlineData: {
      mimeType: file.mimeType,
      data: file.contentBase64,
    },
  };
}

export async function buildPayload(request) {
  const parts = [{ text: buildPromptText(request) }];

  if (request.inputImagePath) {
    parts.push(buildInlineDataPart(await encodeFile(request.inputImagePath)));
  }
  for (const referencePath of request.referenceImagePaths) {
    parts.push(buildInlineDataPart(await encodeFile(referencePath)));
  }
  if (request.maskPath) {
    parts.push(buildInlineDataPart(await encodeFile(request.maskPath)));
  }

  const generationConfig = {
    responseModalities: ['TEXT', 'IMAGE'],
  };
  if (request.seed !== null) {
    generationConfig.seed = request.seed;
  }

  return {
    contents: [
      {
        role: 'user',
        parts,
      },
    ],
    generationConfig,
  };
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

export function extractResponseParts(responsePayload) {
  const parts = [];

  if (Array.isArray(responsePayload.parts)) {
    parts.push(...responsePayload.parts);
  }

  if (Array.isArray(responsePayload.candidates)) {
    for (const candidate of responsePayload.candidates) {
      if (Array.isArray(candidate?.content?.parts)) {
        parts.push(...candidate.content.parts);
      }
    }
  }

  return parts;
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

  return extractResponseParts(responsePayload).filter((part) => part.inlineData || part.inline_data);
}

export function extractTextOutput(responsePayload) {
  return extractResponseParts(responsePayload)
    .map((part) => part.text)
    .filter((value) => typeof value === 'string' && value.trim())
    .map((value) => value.trim());
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

  const inlineMimeType = item.inlineData?.mimeType ?? item.inline_data?.mimeType;
  return `${mode}-${index}${extensionForMimeType(inlineMimeType)}`;
}

export async function imageBytesFromItem(item, { fetchImpl }) {
  const inlineData = item.inlineData ?? item.inline_data;
  if (typeof inlineData?.data === 'string' && inlineData.data.length > 0) {
    return Buffer.from(inlineData.data, 'base64');
  }

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

export async function buildOpenClawMedia(outputFiles) {
  const mediaUrls = [];
  for (const filePath of outputFiles) {
    const bytes = await readFile(filePath);
    const mimeType = guessMimeType(filePath);
    mediaUrls.push(`data:${mimeType};base64,${bytes.toString('base64')}`);
  }
  return {
    mediaUrls,
    ...(mediaUrls[0] ? { mediaUrl: mediaUrls[0] } : {}),
  };
}

export function parseModelRef(modelRef) {
  const normalized = normalizeModelName(modelRef);
  const slashIndex = normalized.indexOf('/');
  return {
    provider: normalized.slice(0, slashIndex),
    model: normalized.slice(slashIndex + 1),
  };
}

export function buildGenerateContentEndpoint(modelRef, apiVersion = DEFAULT_API_VERSION) {
  const { provider, model } = parseModelRef(modelRef);
  return `${apiVersion}/publishers/${encodeURIComponent(provider)}/models/${encodeURIComponent(model)}:generateContent`;
}

export function joinUrl(baseUrl, endpoint) {
  return `${baseUrl.replace(/\/+$/, '')}/${endpoint.replace(/^\/+/, '')}`;
}

export function formatHttpError(status, url, message) {
  const trimmed = (message || 'request failed').trim();
  if (status === 403) {
    return `HTTP 403: access denied for ${url}. Confirm the API key is valid and has access to this model. Raw response: ${trimmed}`;
  }
  if (status === 404) {
    return `HTTP 404: endpoint not found for ${url}. Confirm the base URL and Vertex AI generateContent path. Raw response: ${trimmed}`;
  }
  return `HTTP ${status}: ${trimmed}`;
}

export async function invokeApi(request, {
  baseUrl = DEFAULT_BASE_URL,
  endpoint,
  apiKeyHeader = 'Authorization',
  apiKeyPrefix = 'Bearer ',
  fetchImpl = fetch,
}) {
  const payload = await buildPayload(request);
  const targetEndpoint = endpoint ? endpoint.replace(/^\/+/, '') : buildGenerateContentEndpoint(request.model, request.apiVersion);
  const targetUrl = joinUrl(resolveBaseUrl(baseUrl), targetEndpoint);
  const response = await fetchImpl(targetUrl, {
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
    throw new Error(formatHttpError(response.status, targetUrl, message));
  }
  return response.json();
}

export async function runWorkflow(request, {
  baseUrl = DEFAULT_BASE_URL,
  endpoint,
  apiKeyHeader = 'Authorization',
  apiKeyPrefix = 'Bearer ',
  fetchImpl = fetch,
}) {
  const result = {
    mode: request.mode,
    output_files: [],
    paths: [],
    media: { mediaUrls: [] },
    mediaUrls: [],
    mediaUrl: null,
    text_output: [],
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
    result.text_output = extractTextOutput(responsePayload);

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
    result.paths = [...result.output_files];
    result.media = await buildOpenClawMedia(result.output_files);
    result.mediaUrls = result.media.mediaUrls;
    result.mediaUrl = result.media.mediaUrl ?? null;
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
      'base-url': { type: 'string' },
      endpoint: { type: 'string' },
      model: { type: 'string' },
      'model-mode': { type: 'string', default: 'auto' },
      'api-version': { type: 'string' },
      'api-key': { type: 'string' },
      'input-image-path': { type: 'string' },
      'mask-path': { type: 'string' },
      'reference-image-path': { type: 'string', multiple: true },
      'reference-label': { type: 'string', multiple: true },
      size: { type: 'string' },
      steps: { type: 'string' },
      seed: { type: 'string' },
      'output-dir': { type: 'string' },
      'api-key-header': { type: 'string', default: 'Authorization' },
      'api-key-prefix': { type: 'string', default: 'Bearer ' },
      'ops-doc-text': { type: 'string' },
      'feishu-doc-url': { type: 'string' },
      'conversation': { type: 'string' },
      'skip-intent': { type: 'boolean', default: false },
      'skip-design-doc': { type: 'boolean', default: false },
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
    `  API key envs: ${API_KEY_ENV_NAMES.join(', ')}`,
    `  base URL envs: ${BASE_URL_ENV_NAMES.join(', ')}`,
    `  image model envs: ${MODEL_ENV_NAMES.join(', ')}, GEMINI_MODEL (image models only)`,
    '',
    'Usage:',
    '  node ./scripts/banana-image.mjs --task "创建一个礼物设计图"',
    '',
    'Core options:',
    '  --task                  Natural-language task description.',
    '  --model                 Image-capable model name. Defaults to google/gemini-3-pro-image-preview.',
    '  --model-mode            Model selection mode: auto (default) or pick.',
    '  --api-key               One-time API key.',
    '  --input-image-path      Local input image path.',
    '  --mask-path             Local mask image path for inpaint.',
    '  --reference-image-path  Repeatable local reference image path.',
    '  --reference-label       Repeatable label for reference image (e.g. "取构图"). Paired with --reference-image-path.',
    '  --size                  Optional size hint.',
    '  --seed                  Optional numeric seed.',
    '  --output-dir            Output directory. Default: ./output/banana',
    '',
    'Intent analysis options:',
    '  --ops-doc-text          Ops document text content (pasted).',
    '  --feishu-doc-url        Ops document Feishu URL (fetched automatically).',
    '  --conversation          Path to JSON file with conversation history array.',
    '  --skip-intent           Skip intent analysis and go straight to image generation.',
    '',
    'Feishu delivery options:',
    '  Results are returned via OpenClaw mediaUrls fields and delivered automatically through the Feishu/OpenClaw integration.',
    '  --skip-design-doc       Skip creating Feishu design doc in Mode A (ops doc intake).',
    '',
    'Advanced options:',
    '  --base-url              Vertex AI base URL.',
    '  --endpoint              Override the generateContent endpoint path.',
    '  --api-version           API version string. Default: v1',
    '  --api-key-header        Auth header name. Default: Authorization',
    '  --api-key-prefix        Auth header prefix. Default: Bearer',
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

  // --- Step 1: Load ops document ---
  let opsDocContent = args['ops-doc-text'] ?? null;
  if (!opsDocContent && args['feishu-doc-url']) {
    try {
      opsDocContent = await fetchFeishuDoc(args['feishu-doc-url']);
    } catch (error) {
      process.stderr.write(`Warning: failed to fetch Feishu doc: ${error.message}\n`);
    }
  }

  // If no task provided but ops doc is present, run doc-only compliance analysis
  const hasOpsDoc = Boolean(opsDocContent);
  const hasTask = Boolean(args.task);
  if (!hasTask) {
    if (hasOpsDoc) {
      try {
        const { table, rows, doc_title } = await analyzeOpsDoc(opsDocContent, { env: process.env });
        process.stdout.write(`${table}\n`);

        if (!args['skip-design-doc']) {
          const effectiveTitle = (doc_title ?? '礼物批次') + ' 设计文档';
          const designMarkdown = buildDesignDocMarkdown(opsDocContent, rows);
          try {
            const docResult = await createFeishuDesignDoc(effectiveTitle, designMarkdown);
            process.stderr.write(`设计文档已创建：${docResult.url ?? effectiveTitle}\n`);
          } catch (docError) {
            process.stderr.write(`Warning: 设计文档创建失败: ${docError.message}\n`);
          }
        }

        return 0;
      } catch (error) {
        process.stderr.write(`Ops doc analysis failed: ${error.message}\n`);
        return 1;
      }
    }
    process.stderr.write('The --task option is required (or provide --ops-doc-text / --feishu-doc-url for compliance table only).\n');
    return 1;
  }

  // --- Step 2: Load conversation history ---
  let conversationHistory = [];
  if (args.conversation) {
    try {
      const raw = await readFile(resolve(args.conversation), 'utf8');
      conversationHistory = JSON.parse(raw);
    } catch (error) {
      process.stderr.write(`Warning: failed to load conversation history: ${error.message}\n`);
    }
  }

  const referenceImagePaths = args['reference-image-path'] ?? [];
  const referenceLabels = args['reference-label'] ?? [];

  // --- Step 3: Intent analysis ---
  let intentAnalysis = null;
  if (!args['skip-intent']) {
    try {
      intentAnalysis = await analyzeIntent(
        {
          userMessage: args.task,
          opsDocContent,
          referenceImagePaths,
          referenceLabels,
          inputImagePath: args['input-image-path'] ?? null,
          maskPath: args['mask-path'] ?? null,
          conversationHistory,
        },
        { env: process.env },
      );

      // If intent analysis needs more info, output the question and exit
      if (intentAnalysis.follow_up_question) {
        const output = {
          status: 'follow_up_required',
          follow_up_question: intentAnalysis.follow_up_question,
          intent_summary: intentAnalysis.intent_summary,
          price_tier_analysis: intentAnalysis.price_tier_analysis,
        };
        process.stdout.write(`${JSON.stringify(output, null, 2)}\n`);
        return 0;
      }
    } catch (error) {
      process.stderr.write(`Warning: intent analysis failed (${error.message}), proceeding without it.\n`);
    }
  }

  // --- Step 4: Model routing ---
  const { modelId, reason: modelReason } = routeModel({
    modelMode: args['model-mode'] ?? 'auto',
    explicitModel: args.model ?? null,
    intentMode: intentAnalysis?.mode ?? 'txt2img',
    recommendedModel: intentAnalysis?.recommended_model ?? null,
    env: process.env,
  });

  // Use optimized prompt from intent analysis if available
  const effectiveTask = intentAnalysis?.optimized_prompt
    ? intentAnalysis.optimized_prompt
    : args.task;

  // --- Step 5: Build and run image generation workflow ---
  const request = await buildWorkflowRequest({
    task: effectiveTask,
    apiKey: args['api-key'],
    inputImagePath: args['input-image-path'],
    maskPath: args['mask-path'],
    referenceImagePaths,
    size: intentAnalysis?.parameters?.size ?? args.size,
    steps: args.steps ? Number(args.steps) : null,
    seed: intentAnalysis?.parameters?.seed ?? (args.seed ? Number(args.seed) : null),
    outputDir: args['output-dir'],
    model: modelId,
    apiVersion: args['api-version'],
    promptForApiKey,
    env: process.env,
  });

  const result = await runWorkflow(request, {
    baseUrl: resolveBaseUrl(args['base-url'], process.env),
    endpoint: args.endpoint,
    apiKeyHeader: args['api-key-header'],
    apiKeyPrefix: args['api-key-prefix'],
  });

  // Attach intent analysis and model routing info to result
  result.intent_analysis = intentAnalysis;
  result.optimized_prompt = intentAnalysis?.optimized_prompt ?? null;
  result.original_task = args.task;
  result.model_routing = { modelId, reason: modelReason };
  if (result.repro_info) {
    result.repro_info.model = modelId;
  }

  process.stdout.write(`${JSON.stringify(result, null, 2)}\n`);
  return result.error ? 1 : 0;
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const exitCode = await main();
  process.exit(exitCode);
}

