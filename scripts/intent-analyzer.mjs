#!/usr/bin/env node
/**
 * Price-tier knowledge base and local compliance helpers for openclaw-gift-design.
 *
 * All intent analysis and document extraction is handled by the OpenClaw Agent.
 * This module only contains pure local helpers that do not require any LLM or API key.
 */

export const PRICE_TIERS = [
  {
    label: '头部8层',
    minYuan: 3000,
    maxYuan: 10000,
    subjectTypes: ['星际/虚拟交通工具', '虚拟豪华大型装置', '大型神性动物', '神性/虚拟人物'],
    durationLabel: '9s',
    screenOccupancy: '3/5屏',
    cameraCuts: '4',
    particleLevel: '特效光效',
    has3D: true,
    hasVibration: true,
    hasSound: true,
  },
  {
    label: '头部8层',
    minYuan: 2000,
    maxYuan: 3000,
    subjectTypes: ['星际/虚拟交通工具', '虚拟豪华大型装置', '大型神性动物', '神性/虚拟人物'],
    durationLabel: '9s',
    screenOccupancy: '3/5屏',
    cameraCuts: '4',
    particleLevel: '特效光效',
    has3D: true,
    hasVibration: true,
    hasSound: true,
  },
  {
    label: '头部8层',
    minYuan: 1500,
    maxYuan: 2000,
    subjectTypes: ['虚拟/权利象征大型动物', '大型现实/虚拟场景'],
    durationLabel: '8s',
    screenOccupancy: '1/2屏',
    cameraCuts: '4',
    particleLevel: '特效光效',
    has3D: true,
    hasVibration: true,
    hasSound: true,
  },
  {
    minYuan: 1000,
    label: '头部8层',
    maxYuan: 1500,
    subjectTypes: ['星际/虚拟交通工具', '大型豪华装置设施'],
    durationLabel: '7s',
    screenOccupancy: '1/2屏',
    cameraCuts: '4',
    particleLevel: '特效光效',
    has3D: true,
    hasVibration: true,
    hasSound: true,
  },
  {
    label: '中头部6-7层',
    minYuan: 600,
    maxYuan: 1000,
    subjectTypes: ['豪华交通工具', '大型装置设施', '大型动物', '单双人/多人形象'],
    durationLabel: '6s',
    screenOccupancy: '2/5屏',
    cameraCuts: '3',
    particleLevel: '高价粒子：无人机（动态/混色）',
    has3D: false,
    hasVibration: false,
    hasSound: false,
  },
  {
    label: '中头部6-7层',
    minYuan: 300,
    maxYuan: 600,
    subjectTypes: ['大型交通工具', '中型装置设施', '中小型动物群组', '单人正脸/双人正脸短停'],
    durationLabel: '5s',
    screenOccupancy: '2/5屏',
    cameraCuts: '1',
    particleLevel: '无',
    has3D: false,
    hasVibration: false,
    hasSound: false,
  },
  {
    label: '中头部6-7层',
    minYuan: 100,
    maxYuan: 300,
    subjectTypes: ['交通工具', '中高端消费品', '小型设施', '小动物群组/中小型动物'],
    durationLabel: '4s',
    screenOccupancy: '1/3屏',
    cameraCuts: '1',
    particleLevel: '无',
    has3D: false,
    hasVibration: false,
    hasSound: false,
  },
  {
    label: '中头部6-7层',
    minYuan: 50,
    maxYuan: 100,
    subjectTypes: ['交通工具/小型设施/舞台基建', '日常消费品/植物/豪华餐饮', '拟人形象/人物肢体'],
    durationLabel: '4s',
    screenOccupancy: '无',
    cameraCuts: '0',
    particleLevel: '中价粒子：烟花/LED（静态/双色）',
    has3D: false,
    hasVibration: false,
    hasSound: false,
  },
  {
    label: '腰部3-5层',
    minYuan: 9.9,
    maxYuan: 50,
    subjectTypes: ['食物/植物', '日常消费品'],
    durationLabel: '3s',
    screenOccupancy: '1/4屏',
    cameraCuts: '0',
    particleLevel: '低价粒子：雪/彩带（静态/单色）',
    has3D: false,
    hasVibration: false,
    hasSound: false,
  },
  {
    label: '腰部3-5层',
    minYuan: 2,
    maxYuan: 9.9,
    subjectTypes: ['日常消费品/食物/植物/符号'],
    durationLabel: '1-2s',
    screenOccupancy: '仅托盘+外层',
    cameraCuts: '0',
    particleLevel: '仅托盘+外层',
    has3D: false,
    hasVibration: false,
    hasSound: false,
  },
  {
    label: '尾部1-2层',
    minYuan: 0,
    maxYuan: 2,
    subjectTypes: ['符号'],
    durationLabel: '0s',
    screenOccupancy: '仅托盘',
    cameraCuts: '0',
    particleLevel: '仅托盘',
    has3D: false,
    hasVibration: false,
    hasSound: false,
  },
];

const DASH = '—';
const DESIGN_TABLE_TOTAL_WIDTH = 760;
const DESIGN_LABEL_COL_WIDTH = 96;
const HIGH_SPEED_THEME_KEYWORDS = [
  '跑车',
  '竞速',
  '追逐',
  '追击',
  '极速',
  '疾驰',
  '飙车',
  '速度感',
  '紧张刺激',
  '冲刺',
  '飞驰',
  'racing',
  'speed',
  'high-speed',
  'chase',
  'turbo',
];
const DESIGN_GROUP_ROW_DEFS = [
  { label: '屏占比', formatter: compactScreenOccupancyValue },
  { label: '时长', formatter: compactDurationValue },
  { label: '镜头数', formatter: compactCameraValue },
];
const DESIGN_EDITABLE_ROW_LABELS = ['关键帧设计', '直播间背景展示', 'ICON预览'];

/**
 * Convert price string to yuan (handles 元 and 钻 units).
 * Examples: "500元" -> 500, "5000钻" -> 500, "200" -> 200
 */
export function parsePriceToYuan(priceStr) {
  if (!priceStr || typeof priceStr !== 'string') return null;
  const cleaned = priceStr.trim().replace(/,/g, '');
  const match = cleaned.match(/([\d.]+)\s*(元|钻)?/);
  if (!match) return null;
  const value = Number.parseFloat(match[1]);
  if (Number.isNaN(value)) return null;
  const unit = match[2] ?? '元';
  return unit === '钻' ? value * 0.1 : value;
}

/**
 * Find the matching price tier for a given yuan amount.
 */
export function matchPriceTier(yuan) {
  if (yuan === null || yuan === undefined) return null;
  return PRICE_TIERS.find((tier) => yuan >= tier.minYuan && yuan <= tier.maxYuan) ?? null;
}

/**
 * Extract a compact cut-count label from the camera description.
 */
export function parseCutsCount(cameraCuts) {
  if (!cameraCuts || cameraCuts === '无' || cameraCuts === '0') return '0';
  const rangeMatch = cameraCuts.match(/(\d+-\d+)/);
  if (rangeMatch) return rangeMatch[1];
  const numMatch = cameraCuts.match(/(\d+)/);
  if (numMatch) return numMatch[1];
  if (cameraCuts.includes('多')) return '多';
  return cameraCuts;
}

export function cameraUpperBoundByPriceYuan(yuan) {
  if (yuan === null || yuan === undefined || Number.isNaN(yuan)) {
    return DASH;
  }
  if (yuan < 9.9) {
    return '0';
  }
  if (yuan < 100) {
    return '1';
  }
  if (yuan < 600) {
    return '≤2';
  }
  if (yuan >= 1000) {
    return '≤4';
  }
  return '≤3';
}

export function isHighSpeedTheme(gift) {
  const combinedText = [gift?.name, gift?.subject_description]
    .filter((value) => typeof value === 'string' && value.trim())
    .join(' ')
    .toLowerCase();

  return HIGH_SPEED_THEME_KEYWORDS.some((keyword) => combinedText.includes(keyword.toLowerCase()));
}

export function cameraUpperBoundForGift(yuan, gift) {
  if (yuan === null || yuan === undefined || Number.isNaN(yuan)) {
    return DASH;
  }
  if (yuan < 9.9) {
    return '0';
  }
  if (yuan < 100) {
    return '1';
  }
  if (yuan < 600) {
    return '≤2';
  }
  if (yuan >= 1000) {
    return '≤4';
  }
  return isHighSpeedTheme(gift) ? '≤4' : '≤3';
}

/**
 * Build compliance rows from a gift list.
 * Each gift: { name, price_str, subject_description }
 */
export function buildComplianceRows(gifts) {
  return gifts.map((gift) => {
    const yuan = parsePriceToYuan(gift.price_str);
    const tier = yuan !== null ? matchPriceTier(yuan) : null;
    const cameraUpperBound = cameraUpperBoundForGift(yuan, gift);
    return {
      name: gift.name,
      price_str: gift.price_str,
      price_yuan: yuan,
      tier_label: tier?.label ?? '未识别',
      subject_types: tier?.subjectTypes.slice(0, 3).join(' / ') ?? DASH,
      duration: tier?.durationLabel ?? DASH,
      screen_occupancy: tier?.screenOccupancy ?? DASH,
      camera_cuts: cameraUpperBound,
      cuts_count: parseCutsCount(cameraUpperBound),
      particle_level: tier?.particleLevel ?? DASH,
      has_3d: tier?.has3D ?? false,
      has_vibration: tier?.hasVibration ?? false,
      has_sound: tier?.hasSound ?? false,
      subject_description: gift.subject_description ?? '',
    };
  });
}

/**
 * Format compliance rows as a markdown table.
 */
export function formatComplianceTable(rows) {
  if (rows.length === 0) {
    return '运营文案中未识别到礼物信息。';
  }

  const header = '| 礼物名称 | 价位 | 价效梯度 | 时长 | 镜头 | 粒子效果 | 3D | 震动 | 音效 |';
  const divider = '|---------|------|---------|------|------|---------|----|----|-----|';
  const rowLines = rows.map((row) => {
    const flag = (value) => (value ? '是' : '否');
    return `| ${row.name} | ${row.price_str} | ${row.tier_label} | ${row.duration} | ${row.camera_cuts} | ${row.particle_level} | ${flag(row.has_3d)} | ${flag(row.has_vibration)} | ${flag(row.has_sound)} |`;
  });

  return [header, divider, ...rowLines].join('\n');
}

function compactCameraLabel(cameraCuts) {
  if (typeof cameraCuts === 'string' && cameraCuts.includes('≤')) {
    return cameraCuts;
  }
  const cutsCount = parseCutsCount(cameraCuts ?? '');
  if (cutsCount === '0') return '0';
  if (/^\d+$/.test(cutsCount)) return cutsCount;
  return cameraCuts ?? '0';
}

function compactHeaderLabel(row) {
  return `${row.name}(${row.price_str})`;
}

function compactDurationValue(row) {
  return row.duration;
}

function compactScreenOccupancyValue(row) {
  return row.screen_occupancy;
}

function compactCameraValue(row) {
  return compactCameraLabel(row.camera_cuts);
}

function designColumnWidths(columnCount) {
  if (columnCount <= 0) {
    return `${DESIGN_LABEL_COL_WIDTH},110`;
  }

  const giftColWidth = Math.max(
    82,
    Math.min(110, Math.floor((DESIGN_TABLE_TOTAL_WIDTH - DESIGN_LABEL_COL_WIDTH) / columnCount)),
  );
  return [DESIGN_LABEL_COL_WIDTH, ...Array.from({ length: columnCount }, () => giftColWidth)].join(',');
}

function td(content) {
  return `<lark-td>\n\n${content}\n\n</lark-td>`;
}

function buildTableRow(label, cellContents) {
  return [
    '<lark-tr>',
    td(label),
    ...cellContents.map((content) => td(content)),
    '</lark-tr>',
  ].join('\n');
}

function normalizeThemeSummary(summary) {
  if (typeof summary !== 'string') {
    return '';
  }
  const normalized = summary.replace(/\s+/g, ' ').trim();
  if (!normalized) {
    return '';
  }

  const sentenceMatch = normalized.match(/^(.+?[。！？!?\n])/);
  const firstSentence = sentenceMatch ? sentenceMatch[1].trim() : normalized;
  return firstSentence.slice(0, 120);
}

function normalizeDesignDocMeta(docMeta) {
  if (typeof docMeta === 'string') {
    return {
      opsDocLink: '',
      themeSummary: normalizeThemeSummary(docMeta),
    };
  }

  if (!docMeta || typeof docMeta !== 'object') {
    return {
      opsDocLink: '',
      themeSummary: '',
    };
  }

  return {
    opsDocLink: typeof docMeta.opsDocLink === 'string' ? docMeta.opsDocLink.trim() : '',
    themeSummary: normalizeThemeSummary(docMeta.themeSummary ?? docMeta.opsDocText),
  };
}

function buildDesignDocIntro(docMeta) {
  const normalized = normalizeDesignDocMeta(docMeta);
  const lines = [];

  if (normalized.opsDocLink) {
    lines.push(`运营文档： ${normalized.opsDocLink}`);
  }
  if (normalized.themeSummary) {
    lines.push(`主题概括： ${normalized.themeSummary}`);
  }

  return lines.join('\n');
}

/**
 * Build the full design document markdown using lark-table syntax:
 * ops doc content on top, then a compact design work table below.
 */
export function buildDesignDocMarkdown(opsDocContent, rows) {
  const intro = buildDesignDocIntro(opsDocContent);
  const headerRow = buildTableRow(
    '礼物名称',
    rows.map((row) => compactHeaderLabel(row)),
  );

  const generatedRows = DESIGN_GROUP_ROW_DEFS.map((rowDef) =>
    buildTableRow(
      rowDef.label,
      rows.map((row) => rowDef.formatter(row)),
    ),
  );

  const editableRows = DESIGN_EDITABLE_ROW_LABELS.map((label) =>
    buildTableRow(
      label,
      rows.map(() => ' '),
    ),
  );

  const table = [
    `<lark-table column-widths="${designColumnWidths(rows.length)}" header-row="true" header-column="true">`,
    headerRow,
    ...generatedRows,
    ...editableRows,
    '</lark-table>',
  ].join('\n');

  return [
    ...(intro ? [intro, '', '---', ''] : []),
    '## 设计工作表',
    '',
    table,
  ].join('\n');
}
