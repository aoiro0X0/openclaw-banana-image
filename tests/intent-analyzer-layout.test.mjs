import test from 'node:test';
import assert from 'node:assert/strict';

import { buildComplianceRows, buildDesignDocMarkdown } from '../scripts/intent-analyzer.mjs';

function countCells(rowMarkup) {
  return (rowMarkup.match(/<lark-td>/g) ?? []).length;
}

test('buildDesignDocMarkdown uses a stable table structure without nested text tags', () => {
  const rows = buildComplianceRows([
    { name: '毛绒花束', price_str: '99钻' },
    { name: '冬日企鹅', price_str: '699钻' },
    { name: '暖途列车', price_str: '5200钻' },
  ]);

  const markdown = buildDesignDocMarkdown({
    opsDocLink: 'https://bytedance.larkoffice.com/docx/mock-doc',
    themeSummary: '冬日毛绒主题，延续冬季上新氛围，强化毛绒陪伴感与暖意表达。',
  }, rows);

  assert.equal(markdown.includes('<text background-color='), false);
  assert.equal(markdown.includes('运营文档： https://bytedance.larkoffice.com/docx/mock-doc'), true);
  assert.equal(markdown.includes('主题概括： 冬日毛绒主题，延续冬季上新氛围，强化毛绒陪伴感与暖意表达。'), true);
  assert.equal(markdown.includes('礼物名称'), true);
  assert.equal(markdown.includes('价效梯度'), false);
  assert.equal(markdown.includes('屏占比'), true);
  assert.equal(markdown.includes('时长'), true);
  assert.equal(markdown.includes('镜头数'), true);
  assert.equal(markdown.includes('切镜次数'), false);
  assert.equal(markdown.includes('🟥'), false);
  assert.equal(markdown.includes('🟨'), false);
  assert.equal(markdown.includes('毛绒花束(99钻)'), true);
  assert.equal(markdown.includes('1'), true);
  assert.equal(markdown.includes('4s'), true);
  assert.equal(markdown.includes('1/4屏'), true);

  const widthsMatch = markdown.match(/column-widths="([^"]+)"/);
  assert.ok(widthsMatch);
  assert.equal(widthsMatch[1].split(',').length, rows.length + 1);

  const tableRows = [...markdown.matchAll(/<lark-tr>[\s\S]*?<\/lark-tr>/g)].map((match) => match[0]);
  assert.equal(tableRows.length, 7);
  for (const rowMarkup of tableRows) {
    assert.equal(countCells(rowMarkup), rows.length + 1);
  }
});

test('buildComplianceRows uses camera upper-bound buckets for the design table', () => {
  const rows = buildComplianceRows([
    { name: '毛绒花束', price_str: '99钻' },
    { name: '呆萌企鹅', price_str: '699钻' },
    { name: '爱的抱抱', price_str: '1888钻' },
    { name: '雪绒乐园', price_str: '3500钻' },
    { name: '暖途列车', price_str: '8999钻' },
    { name: '星穹远征', price_str: '12000钻' },
    { name: '云端神殿', price_str: '18000钻' },
    { name: '云端神殿', price_str: '25000钻' },
  ]);

  assert.deepEqual(rows.map((row) => row.duration), [
    '3s',
    '4s',
    '4s',
    '5s',
    '6s',
    '7s',
    '8s',
    '9s',
  ]);

  assert.deepEqual(rows.map((row) => row.screen_occupancy), [
    '1/4屏',
    '无',
    '1/3屏',
    '2/5屏',
    '2/5屏',
    '1/2屏',
    '1/2屏',
    '3/5屏',
  ]);

  assert.deepEqual(rows.map((row) => row.camera_cuts), [
    '1',
    '1',
    '≤2',
    '≤2',
    '≤3',
    '≤4',
    '≤4',
    '≤4',
  ]);
});

test('sub-6000钻 buckets split into 0, 1, and ≤2 shot limits', () => {
  const rows = buildComplianceRows([
    { name: '托盘小礼物', price_str: '50钻' },
    { name: '边界99钻', price_str: '99钻' },
    { name: '三件套', price_str: '299钻' },
    { name: '企鹅', price_str: '699钻' },
    { name: '爱的抱抱', price_str: '1888钻' },
  ]);

  assert.deepEqual(rows.map((row) => row.camera_cuts), [
    '0',
    '1',
    '1',
    '1',
    '≤2',
  ]);
});

test('6000-10000钻 speed themes can be relaxed to ≤4 shots', () => {
  const rows = buildComplianceRows([
    { name: '暖途列车', price_str: '8999钻', subject_description: '雪国路线，浪漫陪伴，安静治愈的毛绒列车' },
    { name: '极夜竞速', price_str: '8999钻', subject_description: '跑车追逐，强速度感，紧张刺激，极速穿梭城市夜景' },
  ]);

  assert.deepEqual(rows.map((row) => row.camera_cuts), ['≤3', '≤4']);
});
