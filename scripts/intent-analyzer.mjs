#!/usr/bin/env node
/**
 * Price-tier knowledge base and local compliance helpers for openclaw-gift-design.
 *
 * All intent analysis and document extraction is handled by the OpenClaw Agent.
 * This module only contains pure local functions that do not require any LLM or API key.
 */

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

/**
 * Extract a cut count string from a cameraCuts description.
 * Examples: "无" → "0", "多镜头" → "多", "2个镜头" → "2", "1-4个镜头" → "1-4"
 */
export function parseCutsCount(cameraCuts) {
  if (!cameraCuts || cameraCuts === '无') return '0';
  const rangeMatch = cameraCuts.match(/(\d+-\d+)/);
  if (rangeMatch) return rangeMatch[1];
  const numMatch = cameraCuts.match(/(\d+)/);
  if (numMatch) return numMatch[1];
  if (cameraCuts.includes('多')) return '多';
  return cameraCuts;
}

/**
 * Build compliance rows from a gift list.
 * Each gift: { name, price_str, subject_description }
 */
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
      cuts_count: parseCutsCount(tier?.cameraCuts ?? ''),
      particle_level: tier?.particleLevel ?? '—',
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
    return '运营文档中未识别到礼物信息。';
  }

  const header = '| 礼物名称 | 价位 | 价效梯度 | 时长 | 镜头 | 粒子效果 | 3D | 震动 | 音效 |';
  const divider = '|---------|------|---------|------|------|---------|----|----|-----|';
  const rowLines = rows.map((r) => {
    const flag = (v) => (v ? '✓' : '—');
    return `| ${r.name} | ${r.price_str} | ${r.tier_label} | ${r.duration} | ${r.camera_cuts} | ${r.particle_level} | ${flag(r.has_3d)} | ${flag(r.has_vibration)} | ${flag(r.has_sound)} |`;
  });

  return [header, divider, ...rowLines].join('\n');
}

/**
 * Return the Feishu background-color name for a tier label.
 * Supported values: red, orange, yellow, green, blue, purple, gray
 */
function tierBgColor(tierLabel) {
  if (tierLabel === '头部8层' || tierLabel === '头部') return 'red';
  if (tierLabel === '头部低') return 'orange';
  if (tierLabel === '腰部高' || tierLabel === '腰部') return 'yellow';
  if (tierLabel === '尾部高' || tierLabel === '尾部') return 'green';
  return 'gray';
}

/**
 * Build the full design document markdown using lark-table syntax:
 * ops doc content on top, then a design work table below.
 *
 * Auto-generated rows (价效 sub-block) have per-column background colors
 * matching the gift's price tier, using <text background-color="…"> inside
 * each <lark-td>. User-fillable rows are plain white.
 *
 * Column widths are computed dynamically so the table fills ~730 px.
 */
export function buildDesignDocMarkdown(opsDocContent, rows) {
  const TOTAL_WIDTH = 730;
  const LABEL_COL_WIDTH = 130;
  const giftColWidth = Math.max(100, Math.floor((TOTAL_WIDTH - LABEL_COL_WIDTH) / rows.length));
  const colWidths = [LABEL_COL_WIDTH, ...rows.map(() => giftColWidth)].join(',');

  const td = (content) => `<lark-td>\n\n${content}\n\n</lark-td>`;
  const colorTd = (content, bgColor) => td(`<text background-color="${bgColor}">${content}</text>`);

  const headerRow = [
    '<lark-tr>',
    td('字段'),
    ...rows.map((r) => td(`**${r.name}（${r.price_str}）**`)),
    '</lark-tr>',
  ].join('\n');

  const autoRow = (label, values) => [
    '<lark-tr>',
    td(label),
    ...rows.map((r, i) => colorTd(values[i], tierBgColor(r.tier_label))),
    '</lark-tr>',
  ].join('\n');

  const emptyRow = (label) => [
    '<lark-tr>',
    td(label),
    ...rows.map(() => td(' ')),
    '</lark-tr>',
  ].join('\n');

  const table = [
    `<lark-table column-widths="${colWidths}" header-row="true" header-column="true">`,
    headerRow,
    autoRow('价效梯度', rows.map((r) => r.tier_label)),
    autoRow('└ 时长', rows.map((r) => r.duration)),
    autoRow('└ 镜头数', rows.map((r) => r.camera_cuts)),
    autoRow('└ 切镜次数', rows.map((r) => r.cuts_count)),
    emptyRow('关键帧设计'),
    emptyRow('直播间背景展示'),
    emptyRow('ICON预览'),
    '</lark-table>',
  ].join('\n');

  return [
    opsDocContent.trim(),
    '',
    '---',
    '',
    '## 设计工作表',
    '',
    table,
  ].join('\n');
}
