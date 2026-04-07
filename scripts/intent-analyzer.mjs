#!/usr/bin/env node
/**
 * Intent Analyzer for openclaw-banana-image
 *
 * Uses a text LLM to analyze designer intent, check price-tier compliance,
 * optimize the generation prompt, and decide whether to ask follow-up questions.
 *
 * Text LLM config (OpenAI-compatible):
 *   TEXT_LLM_API_KEY   - required
 *   TEXT_LLM_BASE_URL  - default: https://api.openai.com/v1
 *   TEXT_LLM_MODEL     - default: gpt-4o
 */

export const TEXT_LLM_BASE_URL_DEFAULT = 'https://api.openai.com/v1';
export const TEXT_LLM_MODEL_DEFAULT = 'gpt-4o';

// ---------------------------------------------------------------------------
// Price-tier knowledge base (Douyin Live gift spec, updated 2026-01-09)
// 1 钻 = 0.1 元
// ---------------------------------------------------------------------------
export const PRICE_TIERS = [
  {
    label: '头部8层',
    minYuan: 2000,
    maxYuan: 3000,
    subjectTypes: ['星际/虚拟交通工具', '虚拟豪华大型装置', '大型神性动物（尊贵身份、顶级祥瑞）', '神性/虚拟人物（权利主宰、家国英雄）'],
    sceneTypes: ['大型壮阔自然/虚拟/奇幻场景'],
    durationSeconds: 9,
    cameraCuts: '1-4个镜头，多镜头叙事',
    particleLevel: '特效光效，粒子种类/变化多，真实感强',
    has3D: true,
    hasVibration: true,
    hasSound: true,
  },
  {
    label: '头部',
    minYuan: 500,
    maxYuan: 2000,
    subjectTypes: ['大型神性动物', '大型装置', '虚拟人物'],
    sceneTypes: ['壮阔自然场景', '奇幻场景'],
    durationSeconds: 9,
    cameraCuts: '多镜头',
    particleLevel: '特效光效，粒子丰富',
    has3D: true,
    hasVibration: true,
    hasSound: true,
  },
  {
    label: '头部低',
    minYuan: 100,
    maxYuan: 500,
    subjectTypes: ['中高端消费品', '小型设施', '舞台基建', '小动物群组', '中小型动物', '神兽幼崽', '单人侧脸', '双人背影'],
    sceneTypes: ['风景（周边场景小）'],
    durationSeconds: 6,
    cameraCuts: '2个镜头',
    particleLevel: '中高粒子',
    has3D: true,
    hasVibration: false,
    hasSound: true,
  },
  {
    label: '腰部高',
    minYuan: 50,
    maxYuan: 100,
    subjectTypes: ['交通工具', '小型设施', '舞台基建', '日常消费品', '植物', '豪华餐饮', '小动物群组', '中小型动物', '神兽幼崽', '拟人形象', '人物肢体'],
    sceneTypes: [],
    durationSeconds: 4,
    cameraCuts: '无',
    particleLevel: '中价粒子：烟花/LED，静态/双色',
    has3D: false,
    hasVibration: false,
    hasSound: false,
  },
  {
    label: '腰部',
    minYuan: 9.9,
    maxYuan: 50,
    subjectTypes: ['食物', '植物', '日常消费品', '昆虫', '小动物群组', '中小型动物', '神兽幼崽', '拟人形象', '人物肢体'],
    sceneTypes: [],
    durationSeconds: 3,
    cameraCuts: '无',
    particleLevel: '低价粒子：雪/彩带，静态/单色',
    has3D: false,
    hasVibration: false,
    hasSound: false,
  },
  {
    label: '尾部高',
    minYuan: 2,
    maxYuan: 9.9,
    subjectTypes: ['日常消费品', '食物', '植物', '符号'],
    sceneTypes: [],
    durationSeconds: 1.5,
    cameraCuts: '无',
    particleLevel: '仅托盘+外层',
    has3D: false,
    hasVibration: false,
    hasSound: false,
  },
  {
    label: '尾部',
    minYuan: 0,
    maxYuan: 2,
    subjectTypes: ['符号'],
    sceneTypes: [],
    durationSeconds: 0,
    cameraCuts: '无',
    particleLevel: '仅托盘',
    has3D: false,
    hasVibration: false,
    hasSound: false,
  },
];

/**
 * Convert price string to yuan (handles 元 and 钻 units).
 * Examples: "500元" → 500, "5000钻" → 500, "200" → 200
 */
export function parsePriceToYuan(priceStr) {
  if (!priceStr || typeof priceStr !== 'string') return null;
  const cleaned = priceStr.trim().replace(/,/g, '');
  const match = cleaned.match(/([\d.]+)\s*(元|钻)?/);
  if (!match) return null;
  const value = parseFloat(match[1]);
  const unit = match[2] ?? '元';
  return unit === '钻' ? value * 0.1 : value;
}

/**
 * Find the matching price tier for a given yuan amount.
 */
export function matchPriceTier(yuan) {
  if (yuan === null || yuan === undefined) return null;
  return PRICE_TIERS.find((t) => yuan >= t.minYuan && yuan <= t.maxYuan) ?? null;
}

// ---------------------------------------------------------------------------
// System prompt builder
// ---------------------------------------------------------------------------
export function buildSystemPrompt() {
  const tierTable = PRICE_TIERS.map(
    (t) =>
      `- ${t.label}（${t.minYuan}-${t.maxYuan}元）：物象「${t.subjectTypes.slice(0, 3).join('/')}...」，时长${t.durationSeconds}s，镜头${t.cameraCuts}，粒子「${t.particleLevel}」`,
  ).join('\n');

  return `你是一个专业的抖音直播礼物设计意图分析师。你的任务是：

1. 读取设计师输入、运营文档（如有）和参考图标注，分析设计意图。
2. 自动判断生图模式（txt2img / img2img / inpaint / background-replace）。
3. 将模糊的中文需求优化为精准的英文生图 prompt。
4. 如果运营文档中提到价位（支持"元"和"钻"两种单位，1钻=0.1元），检查设计意图是否符合该价效梯度规范。
5. 只在真正缺少关键信息时（如风格/主题完全不明确）才提出追问，其余情况自行推断。

## 抖音直播礼物价效梯度表（2026-01-09版）

${tierTable}

## 输出格式

严格输出以下 JSON，不要有其他内容：

\`\`\`json
{
  "mode": "txt2img|img2img|inpaint|background-replace",
  "optimized_prompt": "详细的英文生图 prompt，包含主体、风格、光效、构图等",
  "intent_summary": "一句话中文意图描述",
  "reference_instructions": [
    { "path": "图片路径或标识", "extract": "composition|color_palette|style|texture|subject" }
  ],
  "recommended_model": "模型ID",
  "model_reason": "推荐理由",
  "follow_up_question": null,
  "parameters": {
    "size": null,
    "seed": null
  },
  "price_tier_analysis": {
    "detected_price_yuan": null,
    "detected_tier": null,
    "spec": {
      "subject_types": [],
      "duration_seconds": null,
      "camera_cuts": "",
      "particle_level": "",
      "has_3d": false,
      "has_vibration": false
    },
    "violations": [],
    "suggestions": ""
  }
}
\`\`\`

## 规则

- mode 选择：有输入图且明确换背景 → background-replace；有输入图+mask → inpaint；只有输入图 → img2img；无输入图 → txt2img。
- reference_instructions 只列出用户明确标注了用途的参考图。
- follow_up_question：只在风格/主题/价位完全无法推断时才填，否则设为 null。
- price_tier_analysis：没有价位信息时全部设为 null/空数组/空字符串。
- violations：列出不符合价效规范的具体问题，如"物象级别超出腰部价效范围"。
- recommended_model：根据任务类型推荐，从零创意生图推荐 "bytedance/seedream-3"，编辑/组合/inpaint 推荐 "google/gemini-3-pro-image-preview"。`;
}

// ---------------------------------------------------------------------------
// User message builder
// ---------------------------------------------------------------------------
export function buildUserMessage({
  userMessage,
  opsDocContent,
  referenceImagePaths = [],
  referenceLabels = [],
  inputImagePath,
  maskPath,
  conversationHistory = [],
}) {
  const parts = [];

  if (opsDocContent) {
    parts.push(`## 运营文档内容\n\n${opsDocContent.trim()}`);
  }

  if (inputImagePath) {
    parts.push(`## 输入底图\n\n路径：${inputImagePath}${maskPath ? `\nMask路径：${maskPath}` : ''}`);
  }

  if (referenceImagePaths.length > 0) {
    const refs = referenceImagePaths.map((p, i) => {
      const label = referenceLabels[i] ? `（${referenceLabels[i]}）` : '';
      return `- 参考图${i + 1}${label}：${p}`;
    });
    parts.push(`## 参考图\n\n${refs.join('\n')}`);
  }

  if (conversationHistory.length > 0) {
    const history = conversationHistory
      .map((m) => `${m.role === 'user' ? '设计师' : '系统'}：${m.content}`)
      .join('\n');
    parts.push(`## 对话历史\n\n${history}`);
  }

  parts.push(`## 设计师当前需求\n\n${userMessage.trim()}`);

  return parts.join('\n\n');
}

// ---------------------------------------------------------------------------
// LLM config resolver
// ---------------------------------------------------------------------------
export function resolveTextLlmConfig(env = process.env) {
  return {
    apiKey: env.TEXT_LLM_API_KEY ?? null,
    baseUrl: (env.TEXT_LLM_BASE_URL ?? TEXT_LLM_BASE_URL_DEFAULT).replace(/\/+$/, ''),
    model: env.TEXT_LLM_MODEL ?? TEXT_LLM_MODEL_DEFAULT,
  };
}

// ---------------------------------------------------------------------------
// LLM call
// ---------------------------------------------------------------------------
export async function callTextLlm({ systemPrompt, userMessage, config, fetchImpl = fetch }) {
  const url = `${config.baseUrl}/chat/completions`;
  const response = await fetchImpl(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${config.apiKey}`,
    },
    body: JSON.stringify({
      model: config.model,
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: userMessage },
      ],
      temperature: 0.3,
      response_format: { type: 'json_object' },
    }),
  });

  if (!response.ok) {
    const text = await response.text();
    throw new Error(`Text LLM HTTP ${response.status}: ${text.slice(0, 300)}`);
  }

  const data = await response.json();
  const raw = data.choices?.[0]?.message?.content ?? '';
  return raw;
}

// ---------------------------------------------------------------------------
// Response parser
// ---------------------------------------------------------------------------
export function parseAnalysisResponse(raw) {
  // Strip markdown code fences if present
  const cleaned = raw.replace(/^```json\s*/i, '').replace(/```\s*$/, '').trim();
  try {
    return JSON.parse(cleaned);
  } catch {
    throw new Error(`Intent analyzer returned invalid JSON: ${cleaned.slice(0, 200)}`);
  }
}

// ---------------------------------------------------------------------------
// Ops doc batch analysis
// ---------------------------------------------------------------------------
export function buildOpsDocExtractionSystemPrompt() {
  return `你是一个运营文档解析助手。从运营文档中提取所有礼物项目，输出 JSON。

每个礼物包含：
- name: 礼物名称
- price_str: 价位原文，保留单位（如"500元"、"5000钻"、"99.9元"）
- subject_description: 物象或视觉描述（没有则为空字符串）

严格输出以下 JSON，不要有其他内容：
{"gifts": [{"name": "...", "price_str": "...", "subject_description": "..."}, ...]}

如果文档中没有礼物信息，输出 {"gifts": []}。`;
}

export async function extractGiftsFromOpsDoc(opsDocContent, { env = process.env, fetchImpl = fetch, llmConfig = null } = {}) {
  const config = llmConfig ?? resolveTextLlmConfig(env);
  if (!config.apiKey) {
    throw new Error('TEXT_LLM_API_KEY is required for ops doc analysis.');
  }
  const raw = await callTextLlm({
    systemPrompt: buildOpsDocExtractionSystemPrompt(),
    userMessage: opsDocContent.trim(),
    config,
    fetchImpl,
  });
  const cleaned = raw.replace(/^```json\s*/i, '').replace(/```\s*$/, '').trim();
  let parsed;
  try {
    parsed = JSON.parse(cleaned);
  } catch {
    throw new Error(`Ops doc extraction returned invalid JSON: ${cleaned.slice(0, 200)}`);
  }
  return Array.isArray(parsed.gifts) ? parsed.gifts : [];
}

export function buildComplianceRows(gifts) {
  return gifts.map((gift) => {
    const yuan = parsePriceToYuan(gift.price_str);
    const tier = yuan !== null ? matchPriceTier(yuan) : null;
    return {
      name: gift.name,
      price_str: gift.price_str,
      price_yuan: yuan,
      tier_label: tier?.label ?? '未识别',
      subject_types: tier?.subjectTypes.slice(0, 3).join(' / ') ?? '—',
      duration: tier ? `${tier.durationSeconds}s` : '—',
      camera_cuts: tier?.cameraCuts ?? '—',
      particle_level: tier?.particleLevel ?? '—',
      has_3d: tier?.has3D ?? false,
      has_vibration: tier?.hasVibration ?? false,
      has_sound: tier?.hasSound ?? false,
      subject_description: gift.subject_description ?? '',
    };
  });
}

export function formatComplianceTable(rows) {
  if (rows.length === 0) {
    return '运营文档中未识别到礼物信息。';
  }

  const header = '| 礼物名称 | 价位 | 价效梯度 | 推荐物象类型 | 时长 | 镜头 | 粒子效果 | 3D | 震动 | 音效 |';
  const divider = '|---------|------|---------|------------|------|------|---------|----|----|-----|';
  const rowLines = rows.map((r) => {
    const flag = (v) => (v ? '✓' : '—');
    return `| ${r.name} | ${r.price_str} | ${r.tier_label} | ${r.subject_types} | ${r.duration} | ${r.camera_cuts} | ${r.particle_level} | ${flag(r.has_3d)} | ${flag(r.has_vibration)} | ${flag(r.has_sound)} |`;
  });

  return [header, divider, ...rowLines].join('\n');
}

export async function analyzeOpsDoc(opsDocContent, opts = {}) {
  const gifts = await extractGiftsFromOpsDoc(opsDocContent, opts);
  const rows = buildComplianceRows(gifts);
  const table = formatComplianceTable(rows);
  return { gifts, rows, table };
}

// ---------------------------------------------------------------------------
// Main analyze function
// ---------------------------------------------------------------------------
export async function analyzeIntent(
  {
    userMessage,
    opsDocContent = null,
    referenceImagePaths = [],
    referenceLabels = [],
    inputImagePath = null,
    maskPath = null,
    conversationHistory = [],
  },
  {
    env = process.env,
    fetchImpl = fetch,
    llmConfig = null,
  } = {},
) {
  if (!userMessage || !userMessage.trim()) {
    throw new Error('userMessage is required for intent analysis.');
  }

  const config = llmConfig ?? resolveTextLlmConfig(env);
  if (!config.apiKey) {
    throw new Error(
      'TEXT_LLM_API_KEY is required for intent analysis. Set the environment variable.',
    );
  }

  const systemPrompt = buildSystemPrompt();
  const userMsg = buildUserMessage({
    userMessage,
    opsDocContent,
    referenceImagePaths,
    referenceLabels,
    inputImagePath,
    maskPath,
    conversationHistory,
  });

  const raw = await callTextLlm({ systemPrompt, userMessage: userMsg, config, fetchImpl });
  const result = parseAnalysisResponse(raw);

  // Normalize: ensure required fields exist
  return {
    mode: result.mode ?? 'txt2img',
    optimized_prompt: result.optimized_prompt ?? userMessage,
    intent_summary: result.intent_summary ?? '',
    reference_instructions: result.reference_instructions ?? [],
    recommended_model: result.recommended_model ?? 'google/gemini-3-pro-image-preview',
    model_reason: result.model_reason ?? '',
    follow_up_question: result.follow_up_question ?? null,
    parameters: {
      size: result.parameters?.size ?? null,
      seed: result.parameters?.seed ?? null,
    },
    price_tier_analysis: result.price_tier_analysis ?? {
      detected_price_yuan: null,
      detected_tier: null,
      spec: {},
      violations: [],
      suggestions: '',
    },
  };
}
