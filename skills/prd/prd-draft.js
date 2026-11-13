#!/usr/bin/env node
/* ════════════════════════════════════════════════════════════════════════
   prd-draft.js —— PRD 7 节「固定件发射器」（2026-10-08 提速·PRD 版的 mockgen）
   ────────────────────────────────────────────────────────────────────────
   背景：PRD 的"复用固定件"此前只是规则嘱咐（"别重写固定件"），没有工具帮 AI 吐出来，
         结果每个功能点 AI 还得手敲那套 7 节骨架（操作日志固定说明语+表、查询固定句、
         提示消息表头、通知 4 列头），既费 token 又可能抄错格式。
   做法：按功能点类型，机器吐出 use_cases 7 节骨架——【固定件逐字填好】+【业务槽位 <…> 标出】，
         对话框 AI 只填业务槽位（权限/校验/文案/接收方），固定件永远对、不用重敲。
         每个功能点省 ~20-30% 敲字（annotation-templates.md §生成提速 所述·现在成工具）。

   用法：node prd-draft.js <类型> [--fields "售价*,库存,状态"] [--notif] [--name "功能名"]
     类型：add/新增 · edit/编辑 · delete/删除 · submit/提交 · audit/审核 · export/导出 · batch/批量
           · query/查询 · view/查看 · filter/筛选 · reset/重置
     --fields  必填字段尾带 *；→ 生成 prompt_messages 行（"请输入X"固定填好）+ field_specs 骨架
     --notif   强制出 message_notifications 4 列表骨架（提交/审核/出库/付款等下发类默认已出）
     --name    功能名，填进详情模板槽位

   边界（不吹）：只吐【结构+固定件】，业务内容（具体权限/校验/文案/接收方/旧值→新值）AI 自己填；
                它保证固定件逐字对、格式对、省重敲——不是"自动写出业务 PRD"。
   ════════════════════════════════════════════════════════════════════════ */
'use strict';

// —— 固定件（逐字·来自 annotation-templates.md·单一真理源，改这里要同步那里）——
const LOG_INTRO = '用户操作成功后，系统在操作日志模块记录：操作时间、操作账号、操作模块、操作功能、操作明细、IP地址。';
const LOG_QUERY = '查询/查看不输出操作日志。';
const NOTIF_NONE = '无。';
const NOTIF_TABLE = [
  '| 通知场景 | 通知标题 | 通知内容 | 接收方 |',
  '|---|---|---|---|',
  '| <触发该通知的业务动作/状态> | <通知卡片标题，简短> | <通知正文，动态字段用 {占位符}> | <具体接收方角色，如 财务审核人员/门店店长> |'
].join('\n');

// —— 类型归类 ——
const ALIAS = { '新增': 'add', '编辑': 'edit', '删除': 'delete', '提交': 'submit', '审核': 'audit', '导出': 'export', '批量': 'batch', '查询': 'query', '查看': 'view', '筛选': 'filter', '重置': 'reset' };
const NOLOG = new Set(['query', 'view', 'filter', 'reset']);         // 查询/查看类：不输出操作日志
const NOTIF_DEFAULT = new Set(['submit', 'audit']);                  // 下发类：默认出通知表（其余默认"无。"，可 --notif 强制）

const argv = process.argv.slice(2);
let type = argv[0];
if (!type) { console.log(require('fs').readFileSync(__filename, 'utf8').split('════')[1]); process.exit(1); }
type = ALIAS[type] || type;
const flags = {}; for (let i = 1; i < argv.length; i++) { const a = argv[i]; if (a.startsWith('--')) { const k = a.slice(2); flags[k] = (argv[i + 1] && !argv[i + 1].startsWith('--')) ? argv[++i] : true; } }
const fields = flags.fields && flags.fields !== true ? String(flags.fields).split(',').map(s => s.trim()).filter(Boolean) : [];
const name = flags.name && flags.name !== true ? String(flags.name) : '<业务名称>';

const isNoLog = NOLOG.has(type);
const wantNotif = flags.notif || NOTIF_DEFAULT.has(type);

// —— 各节骨架（固定件填好·业务槽位 <…> 待 AI 填）——
const VERB = { add: '新增', edit: '编辑', delete: '删除', submit: '提交', audit: '审核', export: '导出', batch: '批量操作', query: '查询', view: '查看', filter: '筛选', reset: '重置' }[type] || type;

const preconditions = isNoLog
  ? ['用户已登录<系统名>', '具备「<完整菜单路径>-查看」权限']
  : ['用户已登录<系统名>', '具备「<完整菜单路径>-' + VERB + '」权限', '<模块>列表中存在可' + VERB + '状态的' + name];

const operation_flow = isNoLog
  ? ['用户在<模块>列表，<填写筛选条件/点击查看>，系统<展示匹配结果/打开详情>。']
  : [
    '用户在<模块>，点击「' + VERB + '」<按钮/操作列>，系统<打开' + VERB + '弹窗并回显/弹出二次确认>。',
    '用户<修改表单字段/确认>，点击「<保存/确认>」。',
    '系统校验通过后执行' + VERB + '，<关闭弹窗，列表自动刷新>，提示"' + name + VERB + '成功"。',
    '用户点击「取消」，系统关闭弹窗，不执行任何操作。'
  ];

const postconditions = isNoLog
  ? ['<展示/返回匹配结果，不产生数据变更>。']
  : [name + '数据<变化说明：新增一条/更新字段/状态流转>；<模块>列表数据同步刷新；触发操作日志记录。'];

const validations = ['字段级校验见提示消息表；<补充跨字段/状态/权限/业务逻辑/异常类校验，无则写：本功能点无其他校验>。'];

const prompt_messages = fields.length
  ? fields.map(f => { const req = /\*$/.test(f); const fn = f.replace(/\*$/, '').trim(); return { field: fn + (req ? '（必填）' : ''), empty_prompt: req ? ('请输入' + fn) : '（非必填·按需填错误提示）', error_prompt: '<' + fn + '的错误提示语，如 格式/长度/范围不符>' }; })
  : [{ field: '<必填字段>', empty_prompt: '请输入<字段名>', error_prompt: '<错误提示语>' }];

const message_notifications = isNoLog ? NOTIF_NONE : (wantNotif ? NOTIF_TABLE : NOTIF_NONE);

const operation_log = isNoLog ? LOG_QUERY : {
  fixed_intro: LOG_INTRO,
  detail_format: VERB + name + '：<对象唯一标识>=<值>' + (type === 'edit' ? '，<字段>：<旧值>→<新值>' : '') + (type === 'batch' ? '，共 <N> 件（成功 <X> 失败 <Y>）' : ''),
  detail_example: '<按 detail_format 给一条真实示例>'
};

const use_cases = { preconditions, operation_flow, postconditions, validations, prompt_messages, message_notifications, operation_log };

const out = { _type: type, _note: '固定件已逐字填好（operation_log/prompt_messages/通知表头）；填完 <…> 业务槽位后 → /anno-inject 推送' };
if (fields.length) out.field_specs_skeleton = fields.map(f => { const req = /\*$/.test(f); const fn = f.replace(/\*$/, '').trim(); return { field: fn, required: req, type: '<文本/数字/下拉/日期…>', constraint: '<层1行业基线+层2业务约束>', default: '<默认值/占位原文/空>' }; });
out.use_cases = use_cases;

console.log(JSON.stringify(out, null, 2));
console.error('\n[prd-draft] 类型=' + type + (isNoLog ? '（查询类·操作日志固定不输出）' : '') + (wantNotif && !isNoLog ? '（含通知表骨架）' : '') + ' · 固定件已填·只填 <…> 槽位再 inject');
