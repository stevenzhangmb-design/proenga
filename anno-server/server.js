const http = require('http');
const fs   = require('fs');
const path = require('path');
const { execSync, execFileSync } = require('child_process');

const PORT          = +(process.env.ANNO_PORT || 3799);   // 端口可用 ANNO_PORT 覆盖：隔离测试闸起临时实例(临时端口+临时 ANNO_ARCHIVE_DIR)时用，绝不碰真实例/真数据
const QUEUE_FILE    = path.join(__dirname, 'anno-queue.json');
const AI_QUEUE_FILE = path.join(__dirname, 'anno-ai-regen-queue.json');

/* ══════════════════════════════════════════════════════════════════════════
   【治本·anno-server 反复崩根因】全局错误兜底：任何未捕获异常 / 未处理 promise 拒绝
   一律【记日志 + 保持进程存活】，绝不让 Node 默认行为(直接退出)把服务拖死。
   历史病根：处理 /anno-update·/anno-inject 时会 spawn 无头 Chrome 生成截图/流程图，
   偶发失败(Chrome 未装/超时/文件被 Word/浏览器占用 EBUSY)→ 未捕获 → 进程退出 →
   用户点「导出分享版」「保存标注」时正好没起 → 报"导出失败/同步失败"。
   加此兜底后：偶发错误只记进 anno-server-error.log，服务继续接下一个请求，不再倒。
   ══════════════════════════════════════════════════════════════════════════ */
const _ERR_LOG = path.join(__dirname, 'anno-server-error.log');
function _logErr(tag, e) {
  const line = `[${new Date().toISOString()}] ${tag} ${e && e.stack ? e.stack : e}\n`;
  try { fs.appendFileSync(_ERR_LOG, line); } catch (_) {}
  try { console.error(tag, e && e.stack ? e.stack : e); } catch (_) {}
}
process.on('uncaughtException',  (e) => _logErr('[UNCAUGHT]', e));
process.on('unhandledRejection', (e) => _logErr('[UNHANDLED_REJECTION]', e));
/* ══════════════════════════════════════════════════
   输出/扫描目录解析（绝不写死绝对路径）
   ─ 解决打包后别人安装、拷文件给他人、原型放在别的盘的场景 ─
   以用户实际文件目录为准，按优先级解析：
     ① 环境变量 ANNO_ARCHIVE_DIR（显式覆盖，安装器/启动器可设）
     ② 配置文件 anno-server/anno-config.json 的 { "archiveDir": "..." }（随包持久化，用户设一次）
     ③ 自动探测：在候选目录里找第一个含原型 HTML（内容带 window.__PRD_DATA__）的目录
     ④ 兜底：__dirname/../archive（保持现有 archive 目录行为，找不到原型时不破坏）
══════════════════════════════════════════════════ */
function _dirHasPrototype(dir) {
  try {
    const files = fs.readdirSync(dir).filter(f => f.endsWith('.html') && !/备份|\.bak|backup|分享版/i.test(f));
    for (const f of files) {
      try {
        const html = fs.readFileSync(path.join(dir, f), 'utf-8');
        if (html.includes('window.__PRD_DATA__')) return true;
      } catch (_) {}
    }
  } catch (_) {}
  return false;
}
function resolveArchiveDir() {
  // ① 环境变量
  const envDir = process.env.ANNO_ARCHIVE_DIR;
  if (envDir && fs.existsSync(envDir)) {
    console.log(`[anno-server] 输出目录: ${envDir}（来源: 环境变量 ANNO_ARCHIVE_DIR）`);
    return envDir;
  }
  // ② 配置文件
  try {
    const cfgPath = path.join(__dirname, 'anno-config.json');
    if (fs.existsSync(cfgPath)) {
      const cfg = JSON.parse(fs.readFileSync(cfgPath, 'utf-8'));
      if (cfg && cfg.archiveDir) {
        const cfgDir = path.isAbsolute(cfg.archiveDir) ? cfg.archiveDir : path.join(__dirname, cfg.archiveDir);
        if (fs.existsSync(cfgDir)) {
          console.log(`[anno-server] 输出目录: ${cfgDir}（来源: 配置文件 anno-config.json）`);
          return cfgDir;
        }
      }
    }
  } catch (_) {}
  // ③ 自动探测：找第一个真正含原型 HTML 的目录
  const candidates = [
    process.cwd(),
    path.join(__dirname, '..', 'archive'),
    path.join(__dirname, 'archive'),
    __dirname,
    path.join(__dirname, '..'),
    path.join(__dirname, '..', '..'),
    path.join(__dirname, '..', '..', 'archive'),
    path.join(__dirname, '..', '..', '..'),
    path.join(__dirname, '..', '..', '..', 'archive'),
  ];
  const seen = new Set();
  for (const dir of candidates) {
    let abs; try { abs = path.resolve(dir); } catch (_) { continue; }
    if (seen.has(abs)) continue;
    seen.add(abs);
    if (_dirHasPrototype(abs)) {
      console.log(`[anno-server] 输出目录: ${abs}（来源: 自动探测）`);
      return abs;
    }
  }
  // ④ 兜底
  const fallback = path.join(__dirname, '..', 'archive');
  console.log(`[anno-server] 输出目录: ${fallback}（来源: 兜底默认值，未探测到原型）`);
  return fallback;
}
let ARCHIVE_DIR = resolveArchiveDir();  // 默认目录(无 systemName 的请求/启动用)；有 systemName 的请求会按项目自动切(useArchiveFor)

/* ══ 生成研发代码（Route B·「导出研发版」引擎·2026-08-06）══
   接原型「导出研发版」按钮：收 prd-data → 桥(derive-datamodel)推 data_model → emit-all 出前后端代码
   → 写 <archive>/生成代码/<系统>/。codegen 脚本在 ai-rules/skills/pm-design/codegen(自动探测)。
   诚实：本引擎只【出码骨架】·不编译；真编译/前端类型检查需 JDK/vue-tsc(另做)。L3 天花板·业务逻辑那 20% 标 TODO。 */
function resolveCodegenDir() {
  const cands = [
    process.env.CODEGEN_DIR,                                                       // 显式覆盖（安装器/维护者可设·无写死盘符）
    path.join(__dirname, '..', 'ai-rules', 'skills', 'dev-codegen', 'codegen'),    // ★ 新家：dev-codegen skill（2026-09-01 从 pm-design 拆出）
    path.join(__dirname, '..', '..', 'ai-rules', 'skills', 'dev-codegen', 'codegen'),
    path.join(__dirname, '..', 'ai-rules', 'skills', 'pm-design', 'codegen'),      // 旧家 fallback（拆分前布局·back-compat）
    path.join(__dirname, '..', '..', 'ai-rules', 'skills', 'pm-design', 'codegen'),
    path.join(__dirname, 'codegen'),                                              // 随包子目录
  ];
  for (const c of cands) { try { if (c && fs.existsSync(path.join(c, 'emit-all.js'))) return c; } catch (e) {} }
  return null;
}
function generateDevCode(systemName, prdData, fpFilter, feStack, beStack) {
  const { execFileSync } = require('child_process');
  const os = require('os');
  const cg = resolveCodegenDir();
  if (!cg) throw new Error('找不到代码生成器目录(ai-rules/skills/pm-design/codegen)');
  if (!prdData || !prdData.function_points) throw new Error('缺 prd-data(function_points)——原型未内嵌或未圈选生成');
  const stack = (String(feStack || 'vue').toLowerCase() === 'react') ? 'react' : 'vue';   // 前端栈：vue(默认)|react·扇出多栈
  const beReq = String(beStack || 'java').toLowerCase();
  const beCode = (beReq === 'node' || beReq === 'python') ? beReq : 'java';  // 后端栈：java(默认)|node|python·扇出多栈
  const arch = (typeof useArchiveFor === 'function' ? useArchiveFor(systemName) : ARCHIVE_DIR) || ARCHIVE_DIR;
  const safe = String(systemName || '未命名系统').replace(/[\\/:*?"<>|]/g, '_').slice(0, 40);
  const suffix = (stack === 'vue' && beCode === 'java') ? '' : '-' + stack + '-' + beCode;   // 只有默认栈(vue+java)不加后缀·其余(含python)都加·避免不同栈撞同一目录互相覆盖
  const outDir = path.join(arch, '生成代码', safe + suffix);
  const tmp = os.tmpdir(), stamp = Date.now();
  const prdFile = path.join(tmp, 'anno-prd-' + stamp + '.json');
  const dmFile = path.join(tmp, 'anno-dm-' + stamp + '.json');
  fs.writeFileSync(prdFile, JSON.stringify(prdData));
  const deriveArgs = [path.join(cg, 'derive-datamodel.js'), prdFile, dmFile];
  if (fpFilter) deriveArgs.push(fpFilter);
  const deriveOut = execFileSync('node', deriveArgs, { encoding: 'utf8', timeout: 60000 });
  const emitOut = execFileSync('node', [path.join(cg, 'emit-all.js'), dmFile, outDir, 'com.tf.gen', stack, beCode], { encoding: 'utf8', timeout: 120000 });
  try { fs.unlinkSync(prdFile); fs.unlinkSync(dmFile); } catch (e) {}
  const files = [];
  (function walk(d) { try { for (const e of fs.readdirSync(d, { withFileTypes: true })) { const p = path.join(d, e.name); if (e.isDirectory()) walk(p); else if (/\.(java|vue|tsx?|py|sql)$/.test(e.name)) files.push(path.relative(outDir, p)); } } catch (e) {} })(outDir);
  const summary = deriveOut.trim().split('\n').filter(l => /实体|列|枚举|⚠/.test(l)).join(' | ');
  const green = /全部通过静态校验|全部通过结构校验/.test(emitOut);
  return { outDir, files, count: files.length, summary, staticGreen: green, stack, beStack: beCode };
}
/* ══ 导出对接料（A·喂AI·不出码·2026-08-06）══
   出料包：data_model + openapi + schema.sql + tokens + 提示词包 + README → 写 <archive>/对接料/<系统>/。
   栈无关——喂给用户自己的 AI 生成任意栈代码。Proenga 不碰代码。 */
function generateDevKit(systemName, prdData, fpFilter) {
  const { execFileSync } = require('child_process');
  const os = require('os');
  const cg = resolveCodegenDir();
  if (!cg) throw new Error('找不到代码生成器目录(ai-rules/skills/pm-design/codegen)');
  if (!prdData || !prdData.function_points) throw new Error('缺 prd-data(function_points)——原型未内嵌或未圈选生成');
  const arch = (typeof useArchiveFor === 'function' ? useArchiveFor(systemName) : ARCHIVE_DIR) || ARCHIVE_DIR;
  const safe = String(systemName || '未命名系统').replace(/[\\/:*?"<>|]/g, '_').slice(0, 40);
  const outDir = path.join(arch, '对接料', safe);
  fs.mkdirSync(outDir, { recursive: true });
  const prdFile = path.join(os.tmpdir(), 'anno-prd-' + Date.now() + '.json');
  const dmFile = path.join(outDir, 'data_model.json');
  fs.writeFileSync(prdFile, JSON.stringify(prdData));
  const dArgs = [path.join(cg, 'derive-datamodel.js'), prdFile, dmFile]; if (fpFilter) dArgs.push(fpFilter);
  execFileSync('node', dArgs, { encoding: 'utf8', timeout: 60000 });
  execFileSync('node', [path.join(cg, 'emit-contract.js'), dmFile, outDir], { encoding: 'utf8', timeout: 60000 });
  execFileSync('node', [path.join(cg, 'emit-tokens.js'), outDir], { encoding: 'utf8', timeout: 30000 });
  execFileSync('node', [path.join(cg, 'emit-prompts.js'), dmFile, outDir], { encoding: 'utf8', timeout: 30000 });
  try { fs.unlinkSync(prdFile); } catch (e) {}
  const files = [];
  (function walk(d) { try { for (const e of fs.readdirSync(d, { withFileTypes: true })) { const p = path.join(d, e.name); if (e.isDirectory()) walk(p); else files.push(path.relative(outDir, p)); } } catch (e) {} })(outDir);
  return { outDir, files, count: files.length };
}

/* ══ 多项目·灵活输出目录 ══
   收集所有候选目录(配置 archiveDir/archiveDirs + 自动探测含原型的目录)，
   每个请求按其 systemName 自动认"是哪个项目的目录"→切过去写。
   多个项目各自独立、同时可用，不用来回改配置。
   假设：本地单用户、请求基本串行；处理某请求期间不并发另一项目的写请求(本地工具成立)。 */
function _buildArchiveCandidates() {
  const list = [];
  const add = (d) => { try { const a = path.resolve(d); if (a && fs.existsSync(a) && _dirHasPrototype(a) && !list.includes(a)) list.push(a); } catch (_) {} };
  try {
    const cfgPath = path.join(__dirname, 'anno-config.json');
    if (fs.existsSync(cfgPath)) {
      const cfg = JSON.parse(fs.readFileSync(cfgPath, 'utf-8')) || {};
      for (const d of [].concat(cfg.archiveDirs || [], cfg.archiveDir || [])) add(path.isAbsolute(d) ? d : path.join(__dirname, d));
    }
  } catch (_) {}
  if (process.env.ANNO_ARCHIVE_DIR) add(process.env.ANNO_ARCHIVE_DIR);
  [process.cwd(), path.join(__dirname, '..', 'archive'), path.join(__dirname, 'archive'),
   path.join(__dirname, '..', '..', 'archive'), path.join(__dirname, '..', '..', '..', 'archive')].forEach(add);
  add(ARCHIVE_DIR);
  return list;
}
const ARCHIVE_CANDIDATES = _buildArchiveCandidates();
console.log(`[anno-server] 候选项目目录(${ARCHIVE_CANDIDATES.length}): ${ARCHIVE_CANDIDATES.join('  |  ') || '(无)'}`);

function _dirMatchesSystem(dir, systemName) {
  if (!systemName) return false;
  try {
    const pd = path.join(dir, 'prd-data.json');
    if (fs.existsSync(pd)) { try { if ((JSON.parse(fs.readFileSync(pd, 'utf8').replace(/^﻿/, '')).system_name || '') === systemName) return true; } catch (_) {} }
    // 键【带不带引号都认】：装配器出的是 "system_name":"X"(JSON.stringify)，手搓版常写 system_name:"X"(JS对象字面量·键无引号)。
    // 旧的字符串 includes 只认带引号键 → 手搓版原型(尤其放子目录、需按此匹配切目录)导出分享版/生成PRD 匹配不到 → "没有匹配的原型"。
    const esc = String(systemName).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const re = new RegExp('["\']?system_name["\']?\\s*:\\s*["\']' + esc + '["\']');
    for (const f of fs.readdirSync(dir)) {
      if (!f.endsWith('.html') || /备份|\.bak|backup|分享版/i.test(f)) continue;
      try { if (re.test(fs.readFileSync(path.join(dir, f), 'utf8'))) return true; } catch (_) {}
    }
  } catch (_) {}
  return false;
}
function resolveArchiveDirFor(systemName, candidates) {  // candidates 可选(便于闸用临时目录测试)，默认用启动收集的 ARCHIVE_CANDIDATES
  const cands = candidates || ARCHIVE_CANDIDATES;
  if (systemName) { for (const d of cands) if (_dirMatchesSystem(d, systemName)) return d; }
  return ARCHIVE_DIR;
}
// 按请求 systemName 把当前输出目录切到该项目所在目录（找不到匹配则维持默认，不乱切）
function useArchiveFor(systemName) {
  const d = resolveArchiveDirFor(systemName);
  if (d && d !== ARCHIVE_DIR) { ARCHIVE_DIR = d; console.log(`[anno-server] ▶ 本次请求切到项目目录: ${d}（system=${systemName}）`); }
  return ARCHIVE_DIR;
}

/* ══════════════════════════════════════════════════
   队列读写
══════════════════════════════════════════════════ */
function readQueue()       { try { return JSON.parse(fs.readFileSync(QUEUE_FILE, 'utf-8')); } catch { return []; } }
function writeQueue(data)  { fs.writeFileSync(QUEUE_FILE, JSON.stringify(data, null, 2), 'utf-8'); }

/* ══════════════════════════════════════════════════
   AI 重生成队列读写（/anno-ai-queue）
   存储待 AI 重新生成用例规则的 zoneContext 条目
══════════════════════════════════════════════════ */
function readAiQueue()      { try { return JSON.parse(fs.readFileSync(AI_QUEUE_FILE, 'utf-8')); } catch { return []; } }
function writeAiQueue(data) { fs.writeFileSync(AI_QUEUE_FILE, JSON.stringify(data, null, 2), 'utf-8'); }

/* ══════════════════════════════════════════════════
   SSE 连接池
══════════════════════════════════════════════════ */
const sseClients = new Set();
function broadcastSSE(event, data) {
  const msg = `event: ${event}\ndata: ${JSON.stringify(data)}\n\n`;
  for (const res of sseClients) { try { res.write(msg); } catch { sseClients.delete(res); } }
}

/* ══════════════════════════════════════════════════
   监听队列文件变化 → SSE 广播
══════════════════════════════════════════════════ */
let _lastEmpty = readQueue().length === 0;
if (require.main === module) {   // 队列监听只属常驻；被 require（assemble-once 子进程 / 单测）时不启，保持子进程极简
  try {
    fs.watch(QUEUE_FILE, { persistent: false }, () => {
      try {
        const q = readQueue();
        const empty = q.length === 0;
        if (empty && !_lastEmpty) broadcastSSE('prd-updated', { ts: new Date().toISOString() });
        if (!empty) broadcastSSE('queue-updated', { count: q.length });
        _lastEmpty = empty;
      } catch {}
    });
  } catch {}
}

/* ══════════════════════════════════════════════════
   解析 fp_key → { system, module, fp }
   例："充值管理-WMS.充值" → { system:'WMS', module:'充值管理', fp:'充值' }
══════════════════════════════════════════════════ */
function parseFpKey(fpKey) {
  fpKey = (fpKey || '').trim();
  // 通用化（产品级）：系统码 = 模块与功能点之间、点号前的【大写短码段】，不写死枚举。
  // 覆盖 OMS/WMS/APP/H5/PC/B2B/B2C/ADMIN 之外的任意系统/版本码（如中巴双版 CN/BR、门店 POS、海外 SG 等）。
  const m = fpKey.match(/^(.+?)-([A-Z][A-Z0-9]{0,9})\.(.+)$/);
  if (m) return { module: m[1], system: m[2].toUpperCase(), fp: m[3] };
  const dot = fpKey.indexOf('.');
  if (dot > 0) return { module: fpKey.slice(0, dot), system: '', fp: fpKey.slice(dot + 1) };
  return { module: fpKey, system: '', fp: fpKey };
}

/* ══════════════════════════════════════════════════
   prd-data.json 路径查找 / 读写
══════════════════════════════════════════════════ */
function findPrdDataPath() {
  const cands = [
    path.join(ARCHIVE_DIR, 'prd-data.json'),
    path.join(__dirname, '..', 'ai-rules', 'prd-data.json'),
  ];
  return cands.find(p => fs.existsSync(p)) || cands[0];
}
function readPrdData() {
  try { return JSON.parse(fs.readFileSync(findPrdDataPath(), 'utf-8')); }
  catch { return { system_name: '产品需求文档', function_points: {} }; }
}
function writePrdData(data) {
  const p = findPrdDataPath();
  fs.mkdirSync(path.dirname(p), { recursive: true });
  // ★ 数据零丢失守卫：若新数据会删掉已有功能点/page_menus 键（如误清理），先自动备份旧文件 + 警告，绝不静默丢失
  try {
    if (fs.existsSync(p)) {
      const old = JSON.parse(fs.readFileSync(p, 'utf-8'));
      const newFps = new Set(Object.keys((data && data.function_points) || {}));
      const droppedFps = Object.keys((old && old.function_points) || {}).filter(k => !newFps.has(k));
      const newPm = new Set(Object.keys((data && data.page_menus) || {}));
      const droppedPm = Object.keys((old && old.page_menus) || {}).filter(k => !newPm.has(k));
      if (droppedFps.length || droppedPm.length) {
        const bak = p.replace(/\.json$/, `.bak-${Date.now()}.json`);
        fs.writeFileSync(bak, JSON.stringify(old, null, 2), 'utf-8');
        console.warn(`  [GUARD] 写 prd-data 将删除 ${droppedFps.length} 功能点 + ${droppedPm.length} page_menus；已自动备份旧文件→ ${path.basename(bak)}。dropped fp=[${droppedFps.join(', ')}] pm=[${droppedPm.join(', ')}]`);
      }
    }
  } catch (e) { console.warn(`  [GUARD] 守卫检查跳过: ${e.message}`); }
  // ★ 原子写（治"崩了数据坏"）：先写临时文件、再 renameSync 原子替换。同盘 rename 是原子操作 →
  //   进程即使在写盘中途被杀/断电，prd-data.json 要么是旧完整版、要么是新完整版，绝不会是写坏一半的残档。
  const _tmp = p + '.tmp-' + process.pid + '-' + Date.now();
  try {
    fs.writeFileSync(_tmp, JSON.stringify(data, null, 2), 'utf-8');
    fs.renameSync(_tmp, p);
  } catch (e) {
    try { fs.unlinkSync(_tmp); } catch (_) {}
    fs.writeFileSync(p, JSON.stringify(data, null, 2), 'utf-8');  // rename 极少数失败(目标被锁)→退回直接写，至少不丢内容
  }
}

/* ══════════════════════════════════════════════════
   ㊴ 工程命名硬卡：功能名(fp_name)判定。
   ★ 真理源 = ai-rules/skills/pm-design/qa/function-name-gate.js 的 checkName；
     此处为 anno-server 自带副本（独立部署·不耦合 ai-rules 路径）。改规则两处必同步。
══════════════════════════════════════════════════ */
const _FN_GENERIC = ['功能区', '功能', '列表', '操作', '区域', '未命名', '功能标注', '标注', '按钮', '卡片', '内容', '元素', '占位', '标题', '文本'];
function checkFnName(raw) {
  const n = String(raw == null ? '' : raw).trim().replace(/^功能点[:：]/, '').trim();
  if (!n) return { ok: false, reason: '空名' };
  if (/^\d+$/.test(n)) return { ok: false, reason: '纯数字' };
  if (/^[A-Za-z]{0,8}[-_]?\d{5,}[A-Za-z0-9]*$/.test(n)) return { ok: false, reason: '纯编号/单号(取到了数据值)' };
  if (_FN_GENERIC.includes(n)) return { ok: false, reason: '通用兜底词(没取到真名)' };
  if (n.length > 20) return { ok: false, reason: '过长·疑似整段文字' };
  if (/[，。！？；]/.test(n)) return { ok: false, reason: '含标点·是整句不是功能名' };
  if (n.length >= 8 && /(你|您|我们|更多|体验|欢迎|立即|马上|快来|点击这里|了解更多|开始使用|连接你|请点)/.test(n)) return { ok: false, reason: '营销/引导语·不是功能名' };
  return { ok: true };
}

/* ══════════════════════════════════════════════════
   将 PIN 草稿内容合并进 prd-data.function_points
══════════════════════════════════════════════════ */
function mergePinIntoPrd(prdData, pin) {
  const fpKey = (pin.zoneContext && pin.zoneContext.fpKey) || pin.boundFp || '';
  if (!fpKey) return null;

  const { system, module, fp } = parseFpKey(fpKey);
  const existing = prdData.function_points[fpKey] || {};

  // 归属菜单树（变长，供 §4.4 编号）：优先 pin.menuPath（数组/「A / B / C」串），回退 page_menus[页面]，再回退 module
  const resolveMenuPath = () => {
    let mp = pin.menuPath;
    if (Array.isArray(mp)) return mp.map(s => String(s).trim()).filter(Boolean);
    if (typeof mp === 'string' && mp.trim()) return mp.split(/\s*[\/／>›]\s*/).map(s => s.trim()).filter(Boolean);
    // page_menus 回退：pin.pageKey = "系统-页面"，取页面段查 prdData.page_menus
    const pk = pin.pageKey || '';
    const page = pk.includes('-') ? pk.slice(pk.indexOf('-') + 1) : pk;
    const pm = (prdData.page_menus || {})[page];
    if (pm) return String(pm).split(/\s*[\/／>›]\s*/).map(s => s.trim()).filter(Boolean);
    if (Array.isArray(existing.menu_path) && existing.menu_path.length) return existing.menu_path;
    return module ? [module] : [];
  };

  // Q2修复：始终用 PIN 的最新内容覆盖草稿字段（不管是否有结构化数据）
  // pin.isAIDraft=false 表示用户已编辑，内容必须写入；isAIDraft=true 是 AI 草稿同样写入
  // 只有 pin.fieldSpecs/useCaseRules 为空时才保留旧值
  const menu_path = resolveMenuPath();
  prdData.function_points[fpKey] = {
    ...existing,
    fp_name:              pin.title || fp,
    menu_name:            existing.menu_name || module,
    system:               (pin.pageKey && pin.pageKey.includes('-') ? pin.pageKey.split('-')[0] : '') || existing.system || system,
    menu_path:            menu_path,
    page_key:             pin.pageKey || existing.page_key || '',
    img:                  pin.img || existing.img || '无',
    // pin._fullEdit=true（浏览器"保存即同步"传入）→ 以 pin 当前值为准，含清空（删除内容也同步）；
    // 否则（如 AI 局部注入）→ 空值回退保留旧值，避免漏传字段把已有内容冲掉
    _draft_fieldSpecs:    pin._fullEdit ? (pin.fieldSpecs   || '') : (pin.fieldSpecs    || existing._draft_fieldSpecs    || ''),
    _draft_useCaseRules:  pin._fullEdit ? (pin.useCaseRules || '') : (pin.useCaseRules  || existing._draft_useCaseRules  || ''),
    _isUserEdited:        pin.isAIDraft === false,  // 标记是否用户亲手编辑过
    updatedAt:            new Date().toISOString(),
  };
  return fpKey;
}

/* ══════════════════════════════════════════════════
   PRD §1-§4.3 上下文感知模板（Q1：基于真实 prd-data 生成，而非通用占位符）
══════════════════════════════════════════════════ */
function prdHeader(prdData, date) {
  const productName = prdData.system_name || '产品需求文档';
  const fps = prdData.function_points || {};

  // 分析 prd-data：提取系统类型 + 模块列表
  const systemsSet = new Set();
  const modulesSet = new Set();
  const fpNames    = [];
  for (const [key, fp] of Object.entries(fps)) {
    const { system, module } = parseFpKey(key);
    if (system) systemsSet.add(system);
    if (module) modulesSet.add(module);
    if (fp.fp_name) fpNames.push(fp.fp_name);
  }
  const systems  = [...systemsSet];
  const modules  = [...modulesSet];
  const hasSys   = s => systems.includes(s);

  // § 1 开发目的：列出实际涉及的系统 + 模块
  const sysList = systems.length ? systems.join('、') : 'WMS/OMS';
  const modList = modules.length ? modules.join('、') : '各功能模块';
  const fpDesc  = fpNames.length
    ? `，涵盖 ${fpNames.slice(0, 6).join('、')}${fpNames.length > 6 ? ' 等' : ''} ${fpNames.length} 个功能点`
    : '';
  const purpose = `本文档描述 **${productName}** 的产品功能需求，作为研发团队设计与开发的依据。\n\n当前版本覆盖 **${sysList}** 系统下的 **${modList}**${fpDesc}，通过原型标注工具持续同步更新，确保文档与产品原型保持一致。`;

  // § 3 术语：基础术语 + 按检测到的系统动态添加行业专属术语
  const baseTerms = [
    ['PRD',      '产品需求文档（Product Requirements Document）'],
    ['PM',       '产品经理（Product Manager）'],
    ['fp_key',   '功能点唯一标识，格式：模块名-系统.功能名'],
  ];
  // 行业术语【不写死】：AI 据真实系统生成、存 prd-data._prd_meta.terms（[[术语,说明],...]）。
  // 铁律：skill 里的术语全是【举例】，禁当通用模板硬塞进任意系统（防"发货单/退货单/订单流程"泄漏到充值这类系统）。
  const _todo = (w) => `（待 AI 据原型/业务真值生成${w}——skill 仅举例，须写本系统真实场景，禁照抄/通用臆造/占位）`;
  const metaTerms = (prdData._prd_meta && Array.isArray(prdData._prd_meta.terms)) ? prdData._prd_meta.terms : [];
  const termRows = metaTerms.length ? [...baseTerms, ...metaTerms] : [...baseTerms, ['—', _todo('本系统业务术语')]];
  const termsTable = termRows
    .map(([term, desc]) => `| ${term} | ${desc} |`)
    .join('\n');

  // § 4.1 产品定义【不写死】：AI 据真实系统生成、存 _prd_meta.product_def；生成器不按系统类型猜（防"OMS=订单/发货"这类通用臆造套到充值上）
  const productDef = hardWrapForPandoc((prdData._prd_meta && prdData._prd_meta.product_def && String(prdData._prd_meta.product_def).trim())
    || _todo('产品定义（本系统是什么、解决什么业务、覆盖哪些模块）'));

  // § 4.3 业务流程图：必须 mermaid（prd 铁律 §2.1，禁纯文字）。编号自 4.3.1 顺延、不重复。
  //   优先用 prdData.business_flows（PM/AI 真推理的业务流，[{title, mermaid}]）；否则按检测到的系统给默认 mermaid 起点。
  let flowIdx = 0, flowDesc = '';
  // slug 与 saveScreenshotsAndRegen / renderBusinessFlows 一致：让 §4.3 引用已渲染的 FLOW-N.png（docx 可嵌入）
  const _flowSafe = (prdData.system_name || 'PRD').replace(/[/\\:*?"<>|]/g, '-');
  const _flowSlug = _flowSafe.replace(/[\s·]+/g, '-').replace(/-{2,}/g, '-').replace(/^-|-$/g, '') || 'prd';
  // 读 PNG 真实像素宽高（IHDR：字节16-24），零依赖；失败返回 null
  const _pngSize = (file) => {
    try {
      const b = fs.readFileSync(file);
      if (b.length < 24 || b.toString('ascii', 1, 4) !== 'PNG') return null;
      return { w: b.readUInt32BE(16), h: b.readUInt32BE(20) };
    } catch (e) { return null; }
  };
  const mkFlow = (title, body) => {
    flowIdx++;
    const _png = path.join(ARCHIVE_DIR, 'screenshots', _flowSlug, 'FLOW-' + flowIdx + '.png');
    // 渲染好了 → 引用图片（pandoc cwd=archive 时嵌进 docx）；没渲染（无 Chrome/库 或渲染失败）→ 降级保留 mermaid 源码
    let _block;
    if (fs.existsSync(_png)) {
      // 按真实宽高比给 pandoc 显示宽度：宽图占满页宽、高图放到接近整页高——杜绝 Word 把流程图压成小图
      const sz = _pngSize(_png);
      const USABLE_W = 6.2, USABLE_H = 8.0;  // 页面可用区(英寸·留边)
      let attr = '{width=100%}';
      if (sz && sz.w > 0 && sz.h > 0) {
        const win = Math.min(USABLE_W, USABLE_H * (sz.w / sz.h));
        attr = `{width=${(Math.round(win * 100) / 100)}in}`;
      }
      _block = `![业务流程图：${title}](screenshots/${_flowSlug}/FLOW-${flowIdx}.png)${attr}`;
    } else {
      _block = `\`\`\`mermaid\n${String(body).trim()}\n\`\`\``;
    }
    return `\n#### 4.3.${flowIdx} ${title}\n\n${_block}\n\n`;
  };
  const customFlows = (prdData._prd_meta && Array.isArray(prdData._prd_meta.business_flows)) ? prdData._prd_meta.business_flows
    : (Array.isArray(prdData.business_flows) ? prdData.business_flows : []);
  if (customFlows.length) {
    for (const f of customFlows) flowDesc += mkFlow(f.title || '业务流程', f.mermaid || 'flowchart TD\n    A([开始]) --> Z([结束])');
  } else {
    // 不写死订单/发货/充值流程（那是 skill 举例）；AI 没给真实业务流就明确待生成，闸拦住不让交
    flowDesc = mkFlow('业务流程图', 'flowchart TD\n    A([待生成]) --> B[需 AI 据本系统真实业务流程绘制] --> Z([待生成])');
  }

  const sysBoundary = systems.length
    ? `本系统涉及 **${systems.join('、')}** ${systems.length} 个子系统，系统边界与集成关系详见架构设计文档。`
    : `（系统视图边界 — 请 PM 补充）`;
  // §4.3.x 系统视图边界：仅多系统视图必填（prd 铁律 §1.3.1）；编号紧接业务流程图顺延
  let boundarySection = '';
  if (systems.length >= 2) { flowIdx++; boundarySection = `#### 4.3.${flowIdx} 系统视图边界\n\n${sysBoundary}\n\n`; }

  // §1 开发目的、§4.2 产品框架【不写死】：优先 _prd_meta（AI 据真值生成）；无则 §1 用数据派生的中性描述、§4.2 明确待生成（不占位"请PM补充"）
  // ★ 套 hardWrapForPandoc：AI 自由文本(§1/§4.2)里若含「• …」或「N、…」行、下一行非空 → 补行尾两空格，
  //   否则 pandoc 合并成一坨（⑪ 结构闸 F-WRAP）。此前只对 _draft 字段/用例套了，meta 章节漏套 → 充值 §4.2 的「• OMS/WMS」判红。根因修。
  const purposeFinal = hardWrapForPandoc((prdData._prd_meta && prdData._prd_meta.dev_purpose && String(prdData._prd_meta.dev_purpose).trim()) || purpose);
  const productFramework = hardWrapForPandoc((prdData._prd_meta && prdData._prd_meta.product_framework && String(prdData._prd_meta.product_framework).trim()) || _todo('产品框架（系统/模块拓扑、视图划分、模块间关系）'));

  return `# ${productName} PRD

> 版本：v1.0.0　生成日期：${date}

---

## 1 开发目的

${purposeFinal}

---

## 2 版本变更

| 版本 | 日期 | 变更人 | 变更内容 |
|---|---|---|---|
| v1.0 | ${date} | PM | 首次发版：覆盖 ${modList} 等 ${fpNames.length} 个功能点 |

---

## 3 术语 / 图例定义

| 术语 | 说明 |
|------|------|
${termsTable}

---

## 4 功能需求

### 4.1 产品定义

${productDef}

### 4.2 产品框架

${productFramework}

### 4.3 业务流程图
${flowDesc}${boundarySection}### 4.4 功能点明细

`;
}

/* ══════════════════════════════════════════════════
   §4.4 功能点层级（严格遵循 skills/prd/_rules/prd-directory-numbering.mdc）
   多系统：4.4 功能点明细 → 4.4.X 系统视图 → 变长菜单树 → 末级菜单 → 功能点
   功能点 4 子节固定顺序：.1 位置  .2 原型图  .3 字段规范  .4 用例规则
   （无字段规范时该节写「无」，用例规则固定 .4）。深度随原型，不写死层数。
══════════════════════════════════════════════════ */
/* 解析 fp 的 system / menu_path(数组) / fp_name */
function fpMeta(key, fp) {
  const parsed = parseFpKey(key);
  const sys = fp.system || parsed.system || '通用';
  let mp = Array.isArray(fp.menu_path) ? fp.menu_path.slice()
         : (typeof fp.menu_path === 'string' ? fp.menu_path.split(/\s*[\/／>›]\s*/) : []);
  mp = mp.map(s => String(s).trim()).filter(Boolean);
  if (!mp.length) mp = [fp.menu_name || parsed.module || '未分类'];
  return { key, fp, sys, menuPath: mp, fpName: fp.fp_name || parsed.fp || '功能点' };
}

/* 字段规范/用例规则【规范格式=markdown 字符串】；但端点不校验入参，若被传成数组/对象，
   旧代码 `(v||'').trim()` 会抛 "trim is not a function" → prd-data 已写、PRD.md 静默不生成
   （用户以为存好了、PRD 却是残的）。统一安全转 markdown，绝不让一个坏格式炸掉整份 PRD 生成。 */
function draftToMd(v) {
  if (v == null) return '';
  if (typeof v === 'string') return v;
  if (Array.isArray(v)) {
    if (!v.length) return '';
    if (v.every(x => x && typeof x === 'object' && !Array.isArray(x))) {   // [{字段对象}] → 标准 5 列表格
      const cell = x => (x === undefined || x === null) ? '' : String(x).replace(/\|/g, '\\|').replace(/\n/g, ' ');
      const rows = v.map(x => {
        const req = x.required === true ? '是' : x.required === false ? '否' : (x.是否必填 ?? x.是否必填必选 ?? x.required ?? '');
        return `| ${cell(x.field ?? x.name ?? x.字段名称 ?? x.字段 ?? '')} | ${cell(x.type ?? x.类型 ?? '')} | ${cell(req)} | ${cell(x.default ?? x.默认值 ?? '')} | ${cell(x.rule ?? x.desc ?? x.约束规则 ?? x.说明 ?? '')} |`;
      });
      return ['| 字段名称 | 类型 | 是否必填/必选 | 默认值 | 约束规则 |', '| --- | --- | --- | --- | --- |', ...rows].join('\n');
    }
    return v.map(x => '- ' + (typeof x === 'string' ? x : JSON.stringify(x))).join('\n');   // 其它数组 → 项目符号
  }
  if (typeof v === 'object') return String(v.markdown ?? v.md ?? v.text ?? JSON.stringify(v));
  return String(v);
}

/* 【治本·排版铁律 §0 / 结构闸 F-WRAP】给用例规则/字段规范里的「• 七节标签行」与「  N、子项行」补 markdown 行尾两空格：
   否则相邻非空行会被 pandoc 合并成一大段（七节挤成一坨）。draftToMd 对字符串草稿原样返回·不换行，
   任何来源(对话框 AI 草稿/原型内编辑/凭空生成)出来都在此统一规范化 → 排版永远合规，不靠上游手工敲两空格。
   幂等：已带两空格的行不动；只对【下一行非空】的 •/N、行补两空格(与 prd-structure-lint F-WRAP 判据完全一致)。 */
function hardWrapForPandoc(md) {
  if (!md) return md;
  const ls = md.split('\n');
  return ls.map((l, i) => {
    if (!/^•\s/.test(l) && !/^\s+\d+、/.test(l)) return l;              // 只处理 • 七节标签行 与 N、子项行
    if ((ls[i + 1] || '').trim() !== '' && !/  $/.test(l)) return l.replace(/\s*$/, '') + '  ';  // 下一行非空且本行尾无两空格→补
    return l;
  }).join('\n');
}

/* 渲染单个功能点的 4 子节（位置/原型图/字段规范/用例规则，内容来自 AI 真推理，原样插入）*/
function renderFp(it, num) {
  const fp = it.fp;
  // 标题层级随编号深度（prd 铁律 §1.2：# 数 = 编号段数 + 1，markdown 封顶 6）
  const h = '#'.repeat(Math.min(num.split('.').length + 1, 6));
  let md = `\n${h} ${num} ${it.fpName}\n`;
  const loc = [it.sys, ...it.menuPath, it.fpName].join('-');
  md += `\n**${num}.1 位置**\n\n${loc}\n`;
  md += `\n**${num}.2 原型图**\n\n${(fp.img && String(fp.img).trim()) || '无'}\n`;
  const fs = hardWrapForPandoc(draftToMd(fp._draft_fieldSpecs).trim());
  const uc = hardWrapForPandoc(draftToMd(fp._draft_useCaseRules).trim());
  /* 无字段规范 → 该节写「无」（与原型图空值写「无」一致）；用例规则固定 .4，编号不再随有无字段规范挪动 */
  md += `\n**${num}.3 字段规范**\n\n${fs || '无'}\n`;
  md += `\n**${num}.4 用例规则**\n\n${uc || '（待生成）'}\n`;
  return md;
}

/* 递归渲染菜单树：每多一级菜单顺延一个小数段；末级菜单下挂功能点（与末级菜单同名也各占一级=双写）*/
function renderMenuTree(items, prefix, depth) {
  let md = '';
  const groups = [];
  const idx = {};
  for (const it of items) {
    const name = it.menuPath[depth];
    if (name === undefined) continue;
    if (idx[name] === undefined) { idx[name] = groups.length; groups.push({ name, items: [] }); }
    groups[idx[name]].items.push(it);
  }
  let i = 0;
  for (const g of groups) {
    i++;
    const menuNum = `${prefix}.${i}`;
    // 标题层级随编号深度（prd 铁律 §1.2：# 数 = 编号段数 + 1，markdown 封顶 6）
    const h = '#'.repeat(Math.min(menuNum.split('.').length + 1, 6));
    md += `\n${h} ${menuNum} ${g.name}\n`;
    const deeper = g.items.filter(it => it.menuPath.length > depth + 1);
    const leaf   = g.items.filter(it => it.menuPath.length <= depth + 1);
    if (deeper.length) md += renderMenuTree(deeper, menuNum, depth + 1);
    let j = 0;
    for (const it of leaf) { j++; md += renderFp(it, `${menuNum}.${j}`); }
  }
  return md;
}

function buildFpSections(prdData) {
  const fps = prdData.function_points || {};
  const keys = Object.keys(fps);
  if (!keys.length) return '\n（暂无功能点标注）\n';

  const items = keys.map(k => fpMeta(k, fps[k]));
  const bySys = {};
  const seen = [];
  for (const it of items) { if (!bySys[it.sys]) { bySys[it.sys] = []; seen.push(it.sys); } bySys[it.sys].push(it); }
  // 系统顺序：跟随实际出现顺序；prdData.system_order 显式给定时优先（严格跟随用户菜单顺序，不写死）
  const order = Array.isArray(prdData.system_order) ? prdData.system_order : [];
  const systems = [...new Set([...order, ...seen])].filter(s => bySys[s]);

  let md = '';
  let si = 0;
  for (const sys of systems) {
    si++;
    md += `\n#### 4.4.${si} ${sys}\n`;
    md += renderMenuTree(bySys[sys], `4.4.${si}`, 0);
  }
  return md;
}

/* ══════════════════════════════════════════════════
   生成完整 PRD Markdown
══════════════════════════════════════════════════ */
function generatePrdMd(prdData) {
  const date = new Date().toISOString().slice(0, 10);
  return prdHeader(prdData, date) + buildFpSections(prdData);
}

/* ══════════════════════════════════════════════════
   回写原型 HTML 的 window.__PRD_DATA__
   用大括号计数法定位 JSON 边界，安全可靠
══════════════════════════════════════════════════ */
function updatePrototypeHtmls(prdData) {
  const targetSys = (prdData && prdData.system_name) || '';
  let files = [];
  try { files = fs.readdirSync(ARCHIVE_DIR).filter(f => f.endsWith('.html') && !/备份|\.bak|backup/i.test(f)).map(f => path.join(ARCHIVE_DIR, f)); }
  catch {}
  for (const htmlPath of files) {
    try {
      let content = fs.readFileSync(htmlPath, 'utf-8');
      const marker = 'window.__PRD_DATA__';
      const mIdx = content.indexOf(marker);
      if (mIdx === -1) continue;
      /* ★ 只回写 system_name 匹配的原型，绝不无差别覆盖其它产品的原型（防把 A 产品数据写进 B 原型）*/
      const existSysM = content.slice(mIdx, mIdx + 6000).match(/["']?system_name["']?\s*:\s*"((?:[^"\\]|\\.)*)"/);
      const existSys = existSysM ? existSysM[1] : '';
      if (targetSys && existSys && existSys !== targetSys) {
        console.log(`  [HTML] Skip(系统不匹配 ${existSys}≠${targetSys}): ${path.basename(htmlPath)}`);
        continue;
      }
      const eqIdx = content.indexOf('=', mIdx) + 1;
      const jIdx  = content.indexOf('{', eqIdx);
      if (jIdx === -1) continue;
      let depth = 0, jEnd = -1;
      for (let i = jIdx; i < content.length; i++) {
        if (content[i] === '{') depth++;
        else if (content[i] === '}') { if (--depth === 0) { jEnd = i; break; } }
      }
      if (jEnd === -1) continue;
      let tail = jEnd + 1;
      while (tail < content.length && (content[tail] === ';' || content[tail] === ' ')) tail++;
      // ★ MERGE 而非整体替换：保留原型里 prdData 没有的键（如 page_menus），杜绝回写冲掉原型自有数据
      let toWrite = prdData;
      try {
        const existObj = JSON.parse(content.slice(jIdx, jEnd + 1));
        toWrite = { ...existObj, ...prdData };  // prdData 权威覆盖 system_name/function_points；existObj 独有键(page_menus)保留
      } catch {}
      content = content.slice(0, mIdx) + `window.__PRD_DATA__ = ${JSON.stringify(toWrite, null, 2)};` + content.slice(tail);
      fs.writeFileSync(htmlPath, content, 'utf-8');
      console.log(`  [HTML] Updated __PRD_DATA__: ${path.basename(htmlPath)}`);
    } catch (e) { console.error(`  [HTML] Skip ${path.basename(htmlPath)}: ${e.message}`); }
  }
}

/* ══════════════════════════════════════════════════
   生成「分享版」HTML：嵌入全量定位 pin + 烤入只读标志
   → 别人【双击文件即只读】+ 看得到标注（不靠 URL 参数）；可发文件或上传静态托管。
   通用：按 system_name 匹配任意原型，不绑死示例。pins 由客户端传入(localStorage 全量定位 pin)。
══════════════════════════════════════════════════ */
function writeShareVersion(systemName, pins, opts) {
  useArchiveFor(systemName);   // 多项目：按 systemName 切到该项目目录再读/写
  opts = opts || {};
  const written = [];      // opts.returnContent 时改收 {name, content}，不落盘（交浏览器弹框选位置保存）
  let files = [];
  try { files = fs.readdirSync(ARCHIVE_DIR).filter(f => f.endsWith('.html') && !/备份|\.bak|backup|分享版/i.test(f)).map(f => path.join(ARCHIVE_DIR, f)); }
  catch {}
  for (const htmlPath of files) {
    try {
      let content = fs.readFileSync(htmlPath, 'utf-8');
      const mIdx = content.indexOf('window.__PRD_DATA__');
      if (mIdx === -1) continue;
      const existSysM = content.slice(mIdx, mIdx + 6000).match(/["']?system_name["']?\s*:\s*"((?:[^"\\]|\\.)*)"/);
      const existSys = existSysM ? existSysM[1] : '';
      if (systemName && existSys && existSys !== systemName) continue;  // 只对匹配原型生成
      // 定位 __PRD_DATA__ = {...}; 的末尾
      const eqIdx = content.indexOf('=', mIdx) + 1;
      const jIdx  = content.indexOf('{', eqIdx);
      if (jIdx === -1) continue;
      let depth = 0, jEnd = -1;
      for (let i = jIdx; i < content.length; i++) { if (content[i] === '{') depth++; else if (content[i] === '}') { if (--depth === 0) { jEnd = i; break; } } }
      if (jEnd === -1) continue;
      let tail = jEnd + 1;
      while (tail < content.length && (content[tail] === ';' || content[tail] === ' ')) tail++;
      // 清掉副本里可能已有的同名赋值(幂等)，再注入新的；正则只匹配赋值，不碰 _loadPins 里的引用
      // 清旧只匹配【布尔赋值】(= true/false;)，绝不碰 isPreviewMode 里的 `=== true` 比较；__USER_ANNOTATIONS__ 只匹配 `= [...]` 赋值，不碰 _loadPins 里的引用
      const rest = content.slice(tail)
        .replace(/\s*window\.__ANNO_READONLY__\s*=\s*(?:true|false)\s*;/g, '')
        .replace(/\s*window\.__USER_ANNOTATIONS__\s*=\s*\[[\s\S]*?\];/g, '');
      const inject = `\nwindow.__ANNO_READONLY__ = true;\nwindow.__USER_ANNOTATIONS__ = ${JSON.stringify(pins || [])};`;
      let out = content.slice(0, tail) + inject + rest;
      // 只读硬保证(分享版铁律)：给 <body> 打上 anno-preview-mode 类 → CSS 从加载即隐藏所有 .anno-author-only 编辑控件，
      // 不依赖 JS(isPreviewMode) 时机；杜绝老原型/手搓工具条在只读分享版里仍露出「复制已圈/导出分享版/清空/恢复标注」等编辑按钮。
      if (!/<body[^>]*\banno-preview-mode\b/i.test(out)) {
        out = out.replace(/<body\b([^>]*)>/i, (m, attrs) =>
          /\bclass\s*=/.test(attrs)
            ? m.replace(/class\s*=\s*(['"])/i, 'class=$1anno-preview-mode ')
            : `<body class="anno-preview-mode"${attrs}>`);
      }
      const base = path.basename(htmlPath).replace(/\.html$/i, '');
      const outName = `${base}-分享版.html`;
      if (opts.returnContent) {
        // 不落盘，把内容返给浏览器 → 浏览器弹原生框让用户选保存位置（或下载）
        written.push({ name: outName, content: out });
        console.log(`  [SHARE] 分享版内容已返回浏览器保存: ${outName} (只读 + ${(pins||[]).length} 个嵌入标注)`);
      } else {
        const outPath = path.join(ARCHIVE_DIR, outName);
        fs.writeFileSync(outPath, out, 'utf-8');
        written.push(path.basename(outPath));
        console.log(`  [SHARE] 分享版已生成: ${path.basename(outPath)} (只读 + ${(pins||[]).length} 个嵌入标注)`);
      }
    } catch (e) { console.error(`  [SHARE] Skip ${path.basename(htmlPath)}: ${e.message}`); }
  }
  return written;
}

/* ══════════════════════════════════════════════════
   把标注实时烤回【工作文件本身】(in-place) —— 非只读，对方拷贝原文件即可看 + 编辑
   与 writeShareVersion 区别：①写回原文件、不另存 -分享版 ②只注 __USER_ANNOTATIONS__、不烤 __ANNO_READONLY__
   通用：按 system_name 匹配任意原型。pins 由客户端 localStorage 全量传入。
══════════════════════════════════════════════════ */
function persistAnnotationsToFile(systemName, pins) {
  useArchiveFor(systemName);   // 多项目：按 systemName 切到该项目目录
  const written = [];
  let files = [];
  try { files = fs.readdirSync(ARCHIVE_DIR).filter(f => f.endsWith('.html') && !/备份|\.bak|backup|分享版/i.test(f)).map(f => path.join(ARCHIVE_DIR, f)); } catch {}
  for (const htmlPath of files) {
    try {
      let content = fs.readFileSync(htmlPath, 'utf-8');
      const mIdx = content.indexOf('window.__PRD_DATA__');
      if (mIdx === -1) continue;
      const existSysM = content.slice(mIdx, mIdx + 6000).match(/["']?system_name["']?\s*:\s*"((?:[^"\\]|\\.)*)"/);
      const existSys = existSysM ? existSysM[1] : '';
      if (systemName && existSys && existSys !== systemName) continue;  // 只回写 system_name 匹配的原型
      const eqIdx = content.indexOf('=', mIdx) + 1;
      const jIdx  = content.indexOf('{', eqIdx);
      if (jIdx === -1) continue;
      let depth = 0, jEnd = -1;
      for (let i = jIdx; i < content.length; i++) { if (content[i] === '{') depth++; else if (content[i] === '}') { if (--depth === 0) { jEnd = i; break; } } }
      if (jEnd === -1) continue;
      let tail = jEnd + 1;
      while (tail < content.length && (content[tail] === ';' || content[tail] === ' ')) tail++;
      // 幂等清旧 __USER_ANNOTATIONS__ 赋值（只匹配 = [...] 赋值，不碰 _loadPins 里的引用）
      const rest = content.slice(tail).replace(/\s*window\.__USER_ANNOTATIONS__\s*=\s*\[[\s\S]*?\];/g, '');
      // ★ JS/HTML 安全：转义 </script 防字段内容里出现时提前闭合 <script> 标签（曾踩坑）
      const pinsJson = JSON.stringify(pins || []).replace(/<\/script/gi, '<\\/script');
      const inject = `\nwindow.__USER_ANNOTATIONS__ = ${pinsJson};`;
      const out = content.slice(0, tail) + inject + rest;
      fs.writeFileSync(htmlPath, out, 'utf-8');  // ★ 写回原文件本身（非 -分享版）
      written.push(path.basename(htmlPath));
      console.log(`  [PERSIST] 标注已烤进工作文件: ${path.basename(htmlPath)} (${(pins||[]).length} 个 · 可编辑)`);
    } catch (e) { console.error(`  [PERSIST] Skip ${path.basename(htmlPath)}: ${e.message}`); }
  }
  return written;
}

/* ══════════════════════════════════════════════════
   主处理：收到标注变更 → 写所有本地文件
══════════════════════════════════════════════════ */
/* 从原型 HTML 中提取 window.__PRD_DATA__ 用于初始化 prd-data.json */
function extractPrdDataFromHtml() {
  let files = [];
  try { files = fs.readdirSync(ARCHIVE_DIR).filter(f => f.endsWith('.html') && !/备份|\.bak|backup/i.test(f)).map(f => path.join(ARCHIVE_DIR, f)); } catch {}
  for (const htmlPath of files) {
    try {
      const content = fs.readFileSync(htmlPath, 'utf-8');
      const mIdx = content.indexOf('window.__PRD_DATA__');
      if (mIdx === -1) continue;
      const jIdx = content.indexOf('{', content.indexOf('=', mIdx));
      if (jIdx === -1) continue;
      let depth = 0, jEnd = -1;
      for (let i = jIdx; i < content.length; i++) {
        if (content[i] === '{') depth++;
        else if (content[i] === '}') { if (--depth === 0) { jEnd = i; break; } }
      }
      if (jEnd === -1) continue;
      const data = JSON.parse(content.slice(jIdx, jEnd + 1));
      if (data && data.function_points && Object.keys(data.function_points).length) {
        console.log(`  [INIT] Extracted prd-data from ${path.basename(htmlPath)}`);
        return data;
      }
    } catch {}
  }
  return null;
}

/* ══════════════════════════════════════════════════
   docx 被 Word/WPS 锁住时的【后台自动重试覆盖】
   ─ 内容(md/prd-data)每次保存就已最新；docx 只是导出件。被占用时先另存"最新版"，
     再每 RETRY_MS 后台重试覆盖正式 docx，用户一关 Word 就自动覆盖回去、删掉另存件、广播恢复。
   ─ 纯 anno-server 端逻辑(不碰任何原型 HTML)：所有原型/所有打包用户共用本 server → 原则1+2 天然达标。
   ─ 同一 docx 只挂一个重试定时器(新生成会清掉旧的)，最多重试 MAX_TRIES 次后放弃(另存件留着)。
══════════════════════════════════════════════════ */
const RETRY_MS = +(process.env.ANNO_DOCX_RETRY_MS || 4000), MAX_TRIES = +(process.env.ANNO_DOCX_MAX_TRIES || 45);  // 4s × 45 ≈ 3 分钟内关掉 Word 都能自动覆盖（测试可用 env 加速）
const __docxRetryTimers = new Map();            // docxPath → timer
function clearDocxRetry(docxPath) {
  const t = __docxRetryTimers.get(docxPath);
  if (t) { clearTimeout(t); __docxRetryTimers.delete(docxPath); }
}
function scheduleDocxOverwrite(mdPath, docxPath, altPath) {
  clearDocxRetry(docxPath);                      // 防重复挂表
  let tries = 0;
  const attempt = () => {
    tries++;
    try {
      execFileSync('pandoc', [mdPath, '-f', 'markdown+hard_line_breaks', '-o', docxPath], { timeout: 20000, cwd: ARCHIVE_DIR });
      // 成功 = Word 已关、正式 docx 已覆盖成最新 → 删另存件、通知前端
      try { if (altPath && fs.existsSync(altPath)) fs.rmSync(altPath, { force: true }); } catch (_) {}
      __docxRetryTimers.delete(docxPath);
      console.log(`  [DOCX] ✅ 自动重试成功：${path.basename(docxPath)} 已覆盖为最新（Word 已关闭），另存件已删`);
      try { broadcastSSE('docx-recovered', { file: path.basename(docxPath), ts: new Date().toISOString() }); } catch (_) {}
    } catch (e) {
      const msg = String((e && (e.stderr || e.message)) || '');
      if (/EBUSY|busy|locked|being used|in use|denied|permission/i.test(msg) && tries < MAX_TRIES) {
        __docxRetryTimers.set(docxPath, setTimeout(attempt, RETRY_MS));   // 还锁着 → 继续等
      } else {
        __docxRetryTimers.delete(docxPath);
        if (tries >= MAX_TRIES) console.log(`  [DOCX] 自动重试 ${MAX_TRIES} 次仍被占用，放弃（最新内容在另存件里，请手动关闭 Word 后再保存一次）`);
      }
    }
  };
  __docxRetryTimers.set(docxPath, setTimeout(attempt, RETRY_MS));
}

async function processPrdUpdate(changes, systemName, prdMeta) {
  if ((!changes || !changes.length) && !prdMeta) return;
  useArchiveFor(systemName);   // 多项目：按 systemName 切到该项目目录再读 prd-data / 写 PRD（各项目各自独立）
  const ts = new Date().toLocaleTimeString();
  console.log(`\n[${ts}] Auto-generating PRD for ${changes.length} change(s)...`);

  // 1. 读 prd-data.json；若不存在则尝试从原型 HTML 初始化
  let prdData = readPrdData();
  const isNew = !fs.existsSync(findPrdDataPath());
  if (isNew) {
    const fromHtml = extractPrdDataFromHtml();
    if (fromHtml) prdData = fromHtml;
  }
  // 应用原型传来的 systemName
  if (systemName && systemName.trim()) prdData.system_name = systemName.trim();
  // 章节元数据（§1开发目的/§3术语/§4.1产品定义/§4.2产品框架/§4.3业务流程图）：AI 据真值生成、存 _prd_meta，生成器渲染（不再硬编码通用模板）
  if (prdMeta && typeof prdMeta === 'object') prdData._prd_meta = { ...(prdData._prd_meta || {}), ...prdMeta };

  // 2. 合并标注数据
  const updated = [];
  for (const c of (changes || [])) {
    if (!c.pin) continue;
    if (c.action === 'delete') {
      const fk = c.pin.zoneContext && c.pin.zoneContext.fpKey;
      if (fk && prdData.function_points[fk]) { delete prdData.function_points[fk]; console.log(`  [DEL] ${fk}`); }
    } else {
      const fk = mergePinIntoPrd(prdData, c.pin);
      if (fk) { updated.push(fk); console.log(`  [SET] ${fk}`); }
      else { console.log(`  [SKIP] No fpKey: ${c.pin.title || '?'}`); }
    }
  }

  // 3. 写 prd-data.json
  writePrdData(prdData);
  console.log(`  [JSON] prd-data.json saved`);

  // 4-6. 重活（§4.3 Chrome 流程图 + pandoc docx + 回写原型 HTML）挪进【一次性子进程】assemble-once.js：
  //      常驻【绝不】碰 Chrome/pandoc —— 它们超时/被占用/没装都只崩掉可弃的子进程，常驻照常服务（崩源结构隔离）。
  //      数据（prd-data.json）已在上面 writePrdData 落盘、SSE 已在各 handler 广播 → 原型同步与数据零依赖此子进程。
  spawnAssembleOnce(prdData.system_name || systemName || '');
  console.log(`  [✓] 数据已落盘；重活交一次性子进程装配（md + docx + 流程图 + 回写HTML）。\n`);
}

/* ══════════════════════════════════════════════════
   一次性装配（重活隔离）：§4.3 流程图 + PRD md + pandoc docx + 回写原型 HTML。
   由常驻 detached spawn 到 assemble-once.js 子进程执行；Chrome/pandoc 崩了只崩此子进程，常驻不受影响。
   ——本函数整段就是原 processPrdUpdate 步骤 4-6，逐字搬迁、逻辑不变，只换了运行进程。
══════════════════════════════════════════════════ */
function assembleArtifacts(systemName) {
  useArchiveFor(systemName);
  const prdData = readPrdData();
  if (!prdData || !prdData.system_name) { console.log('  [ASSEMBLE] 无 prd-data，跳过装配'); return { ok: false, reason: 'no-prd-data' }; }
  const safeName = (prdData.system_name || 'PRD').replace(/[/\\:*?"<>|]/g, '-');
  fs.mkdirSync(ARCHIVE_DIR, { recursive: true });
  const mdPath   = path.join(ARCHIVE_DIR, `PRD-${safeName}.md`);
  const docxPath = path.join(ARCHIVE_DIR, `PRD-${safeName}.docx`);
  const flowRet = renderBusinessFlows(prdData);  // §4.3 mermaid→PNG（在生成 md 前，让 md 引用已渲染的 FLOW-N.png）
  const flow = (flowRet && flowRet.skipped) ? 'skipped' : ((flowRet && flowRet.count > 0) ? 'ok' : 'none');  // skipped=缺Chrome/库降级源码·none=本就没流程图·ok=渲染出图
  fs.writeFileSync(mdPath, generatePrdMd(prdData), 'utf-8');
  console.log(`  [MD]   ${path.basename(mdPath)}`);
  let docx = 'ok';  // ok=生成·locked=被Word占用另存·skipped=缺pandoc/失败
  try {
    // -f markdown+hard_line_breaks：单换行→docx 内换行；cwd=ARCHIVE_DIR：让 ![](screenshots/...) 相对图嵌进 docx
    execFileSync('pandoc', [mdPath, '-f', 'markdown+hard_line_breaks', '-o', docxPath], { timeout: 20000, cwd: ARCHIVE_DIR });
    clearDocxRetry(docxPath);
    console.log(`  [DOCX] ${path.basename(docxPath)}`);
  } catch (e) {
    const msg = String((e && (e.stderr || e.message)) || '');
    if (/EBUSY|busy|locked|being used|in use|denied|permission/i.test(msg)) {
      docx = 'locked';
      // 原 docx 被 Word/WPS 锁住 → 另存最新版，用户立刻拿到新内容；后台有界重试，Word 关了自动覆盖回原文件
      const altPath = docxPath.replace(/\.docx$/i, '-最新版(原docx被占用未覆盖).docx');
      let alt = '';
      try { execFileSync('pandoc', [mdPath, '-f', 'markdown+hard_line_breaks', '-o', altPath], { timeout: 20000, cwd: ARCHIVE_DIR }); alt = path.basename(altPath); } catch (_) {}
      console.log(`  [DOCX] ⚠️ ${path.basename(docxPath)} 被 Word/WPS 锁定、原文件未更新` + (alt ? `；已另存最新版「${alt}」（关闭 Word/WPS 后自动覆盖回原文件并删另存件）` : '；且另存也失败'));
      try { broadcastSSE('docx-locked', { file: path.basename(docxPath), alt, ts: new Date().toISOString() }); } catch (_) {}
      scheduleDocxOverwrite(mdPath, docxPath, altPath);
    } else {
      docx = 'skipped';
      console.log(`  [DOCX] pandoc skipped (not installed or failed): ${msg.slice(0, 200)}`);
    }
  }
  updatePrototypeHtmls(prdData);
  console.log(`  [✓] 装配完成（md + docx + 流程图 + 回写HTML）。\n`);
  return { ok: true, system: prdData.system_name, md: 'ok', docx, flow, ts: new Date().toISOString() };  // ← 供 assemble-once POST 回常驻广播 SSE，原型据此弹提示
}

const ASSEMBLE_ONCE_PATH = path.join(__dirname, 'assemble-once.js');
function spawnAssembleOnce(systemName) {
  try {
    const { spawn } = require('child_process');
    const child = spawn(process.execPath, [ASSEMBLE_ONCE_PATH, systemName || ''], { detached: true, stdio: 'ignore', cwd: __dirname });
    child.on('error', (e) => { try { _logErr('[ASSEMBLE_SPAWN]', e); } catch (_) {} });
    child.unref();   // 与常驻解绑：子进程独立生死，常驻不等它、它崩不连累常驻
  } catch (e) { try { _logErr('[ASSEMBLE_SPAWN]', e); } catch (_) {} }
}

/* ══════════════════════════════════════════════════
   方案A·浏览器内 html2canvas 截图 → 存档 + 写进 PRD 的 .2 原型图（零客户依赖）
   入参 shots=[{fpKey, imgBase64}]；每次为全量重拍：清本系统旧图、按收到顺序分配 IMG-NN、
   写 fp.img=![IMG-NN 原型截图](screenshots/<系统>/IMG-NN.png)，再重生 PRD（pandoc 设 cwd 让图嵌进 docx）
══════════════════════════════════════════════════ */
function saveScreenshotsAndRegen(systemName, shots) {
  const prdData = readPrdData();
  const fps = prdData.function_points || {};
  const safeName = (prdData.system_name || 'PRD').replace(/[/\\:*?"<>|]/g, '-');
  if (systemName && prdData.system_name && prdData.system_name !== systemName)
    throw new Error(`系统不匹配：截图为 ${systemName}，当前 prd-data 为 ${prdData.system_name}`);
  // 子目录用无空格 slug：markdown 图片路径含空格会截断链接、图嵌不进 docx（实测坑）
  const slug = safeName.replace(/[\s·]+/g, '-').replace(/-{2,}/g, '-').replace(/^-|-$/g, '') || 'prd';
  const shotDir = path.join(ARCHIVE_DIR, 'screenshots', slug);
  fs.mkdirSync(shotDir, { recursive: true });
  // 稳定编号：IMG-NN 按功能点在 prd-data 中的次序固定 → 支持增量重拍（PM 截列表页，再开弹窗补截），互不覆盖
  const keys = Object.keys(fps);
  const saved = [];
  for (const s of (shots || [])) {
    if (!s || !s.fpKey || !s.imgBase64 || !fps[s.fpKey]) continue;
    const b64 = String(s.imgBase64).replace(/^data:image\/\w+;base64,/, '');
    if (!b64) continue;
    const id = 'IMG-' + String(keys.indexOf(s.fpKey) + 1).padStart(2, '0');
    fs.writeFileSync(path.join(shotDir, id + '.png'), Buffer.from(b64, 'base64'));  // 覆盖同名=重拍该功能点
    fps[s.fpKey].img = `![${id} 原型截图](screenshots/${slug}/${id}.png)`;
    saved.push({ fpKey: s.fpKey, id });
  }
  writePrdData(prdData);
  // 截图已写盘 + prd-data 已落 img 引用（上面 writePrdData·纯 fs·安全）。重活（§4.3 流程图渲染 + pandoc docx +
  // 回写原型 HTML）同样交【一次性子进程】assemble-once.js —— 常驻绝不碰 Chrome/pandoc；子进程读最新 prd-data 出 md/docx/嵌图。
  spawnAssembleOnce(prdData.system_name || systemName || '');
  console.log(`  [SHOT] 存 ${saved.length} 张原型截图 → ${shotDir}；重活交一次性子进程装配`);
  return saved;
}

/* ══════════════════════════════════════════════════
   §4.3 业务流程图 mermaid → PNG 渲染（对话框生成 PRD / 改流程描述时自动调用，再嵌进 docx）
   ─ 复用本机 Chrome/Edge（与 auto-screenshot 同思路）+ vendor/mermaid.min.js，零 npm 依赖、离线可用
   ─ 两遍：① --dump-dom 读 svg 真实尺寸 ② 按尺寸 --screenshot 紧贴裁剪（无大片留白）
   ─ 幂等：FLOW-i.png 在且 FLOW-i.mmd 源码未变 → 跳过；源码变了（改描述）→ 重渲
   ─ 优雅降级：无 Chrome 或无 mermaid 库或渲染失败 → 不出图，generatePrdMd 自动回退 mermaid 源码
══════════════════════════════════════════════════ */
// outDir：可选，指定 screenshots 根目录（默认 ARCHIVE_DIR）。fresh-system-smoke ⑬ 用它把全新系统的流程图渲到临时目录、机器断言尺寸（证明打包后别人画新系统也得到大图，不套兜底白布、不超宽）。
// 返回 { count, flows:[{id, w, h, ratio, fallback, ok}] }：fallback=true 表示尺寸没测出、套了兜底大白布（⑬据此判红）。
function renderBusinessFlows(prdData, outDir) {
  try {
    const flows = (prdData._prd_meta && Array.isArray(prdData._prd_meta.business_flows)) ? prdData._prd_meta.business_flows
      : (Array.isArray(prdData.business_flows) ? prdData.business_flows : []);
    if (!flows.length) return { count: 0, flows: [] };
    const mermaidLib = path.join(__dirname, 'vendor', 'mermaid.min.js');
    const CHROME = ['C:/Program Files/Google/Chrome/Application/chrome.exe', 'C:/Program Files (x86)/Google/Chrome/Application/chrome.exe',
      'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe', 'C:/Program Files/Microsoft/Edge/Application/msedge.exe'].find(p => fs.existsSync(p));
    if (!CHROME || !fs.existsSync(mermaidLib)) { console.log('  [FLOW] 跳过流程图渲染（无 Chrome 或 vendor/mermaid.min.js）→ 降级保留 mermaid 源码'); return { count: 0, flows: [], skipped: 'no-chrome-or-lib' }; }
    const MERMAID = fs.readFileSync(mermaidLib, 'utf8');
    const safeName = (prdData.system_name || 'PRD').replace(/[/\\:*?"<>|]/g, '-');
    const slug = safeName.replace(/[\s·]+/g, '-').replace(/-{2,}/g, '-').replace(/^-|-$/g, '') || 'prd';
    const shotDir = path.join(outDir || ARCHIVE_DIR, 'screenshots', slug);
    fs.mkdirSync(shotDir, { recursive: true });
    const tmp = path.join(shotDir, '_flowsrc.html');
    const ud = path.join(shotDir, '_chrome_flow_prof');
    const base = ['--headless=new', '--disable-gpu', '--no-sandbox', '--no-first-run', `--user-data-dir=${ud}`, '--hide-scrollbars', '--virtual-time-budget=8000'];
    let n = 0; const results = [];
    for (let i = 0; i < flows.length; i++) {
      const id = 'FLOW-' + (i + 1);
      const code = String((flows[i] && flows[i].mermaid) || 'flowchart TD\n    A([开始]) --> Z([结束])').trim();
      const png = path.join(shotDir, id + '.png');
      const mmd = path.join(shotDir, id + '.mmd');
      if (fs.existsSync(png) && fs.existsSync(mmd) && fs.readFileSync(mmd, 'utf8') === code) { n++; continue; }  // 幂等
      // fontSize 调大 + 节点间距加宽：流程图嵌进 PRD/docx 后字够大、不被压成 2pt（配合 generatePrdMd 按宽高比铺满页面）
      // useMaxWidth:false 对【所有图类型】（flowchart/state/sequence/class/er）→ SVG 输出数字 width/height 而非 width="100%"，尺寸才测得准（否则套兜底大白布、图小白边大）
      const html = `<!DOCTYPE html><html><head><meta charset="utf-8"><style>html,body{margin:0;background:#fff;width:fit-content}#wrap{display:inline-block;padding:18px}.mermaid{font-size:22px}</style><script>${MERMAID}</script></head><body><div id="wrap"><pre class="mermaid">${code}</pre></div><script>mermaid.initialize({startOnLoad:true,securityLevel:'loose',flowchart:{useMaxWidth:false,nodeSpacing:55,rankSpacing:65,padding:14},sequence:{useMaxWidth:false},state:{useMaxWidth:false},class:{useMaxWidth:false},er:{useMaxWidth:false},themeVariables:{fontFamily:'Microsoft YaHei,Segoe UI,sans-serif',fontSize:'22px'}});</script></body></html>`;
      fs.writeFileSync(tmp, html, 'utf8');
      const uri = 'file:///' + tmp.split('\\').join('/');
      let W = 0, H = 0;
      try {
        const dom = execFileSync(CHROME, [...base, '--dump-dom', uri], { timeout: 40000, maxBuffer: 64 * 1024 * 1024 }).toString();
        const wh = dom.match(/<svg[^>]*\swidth="([\d.]+)"[^>]*\sheight="([\d.]+)"/);
        const hw = dom.match(/<svg[^>]*\sheight="([\d.]+)"[^>]*\swidth="([\d.]+)"/);
        if (wh) { W = parseFloat(wh[1]); H = parseFloat(wh[2]); }
        else if (hw) { H = parseFloat(hw[1]); W = parseFloat(hw[2]); }
        if (!(W > 0 && H > 0)) {  // 兜底：从 viewBox 取真实尺寸（任何 width="100%" 的图都能测准）
          const vb = dom.match(/viewBox="0 0 ([\d.]+) ([\d.]+)"/);
          if (vb) { W = parseFloat(vb[1]); H = parseFloat(vb[2]); }
        }
      } catch (e) {}
      let fallback = false;
      if (!(W > 0 && H > 0)) { W = 1000; H = 1400; fallback = true; }  // 最后兜底（极少触发）= 尺寸没测出、套大白布 → ⑬ 判红
      W = Math.ceil(W) + 40; H = Math.ceil(H) + 40;
      try { fs.rmSync(png, { force: true }); } catch (e) {}
      try { execFileSync(CHROME, [...base, `--window-size=${W},${H}`, '--force-device-scale-factor=3', `--screenshot=${png}`, uri], { timeout: 40000 }); } catch (e) {}
      if (fs.existsSync(png)) { fs.writeFileSync(mmd, code, 'utf8'); n++; results.push({ id, w: W, h: H, ratio: +(W / H).toFixed(3), fallback, ok: true }); console.log(`  [FLOW] ${id} 渲染 ${Math.round(fs.statSync(png).size / 1024)}KB (${W}x${H})`); }
      else { results.push({ id, w: W, h: H, ratio: +(W / H).toFixed(3), fallback, ok: false }); console.log(`  [FLOW] ${id} 渲染失败 → 降级 mermaid 源码`); }
    }
    try { fs.rmSync(tmp, { force: true }); } catch (e) {}
    try { fs.rmSync(ud, { recursive: true, force: true }); } catch (e) {}
    return { count: n, flows: results };
  } catch (e) { console.log('  [FLOW] 渲染异常（降级 mermaid 源码）：' + e.message); return { count: 0, flows: [], error: e.message }; }
}

/* ══════════════════════════════════════════════════
   追加变更到队列（保留给 AI 读取用，可选）
══════════════════════════════════════════════════ */
function appendChanges(changes, cmd) {
  const queue = readQueue();
  queue.push({ ts: new Date().toISOString(), cmd, changes });
  writeQueue(queue);
  broadcastSSE('queue-updated', { count: queue.length });
}

/* ══════════════════════════════════════════════════
   HTTP 服务
══════════════════════════════════════════════════ */
const server = http.createServer((req, res) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') { res.writeHead(204); res.end(); return; }

  /* SSE */
  if (req.method === 'GET' && req.url === '/events') {
    res.writeHead(200, { 'Content-Type': 'text/event-stream', 'Cache-Control': 'no-cache', 'Connection': 'keep-alive', 'Access-Control-Allow-Origin': '*' });
    res.write('retry: 3000\n\n');
    res.write(`event: connected\ndata: {"ts":"${new Date().toISOString()}"}\n\n`);
    sseClients.add(res);
    console.log(`[${new Date().toLocaleTimeString()}] SSE +1 (total: ${sseClients.size})`);
    req.on('close', () => { sseClients.delete(res); });
    return;
  }

  /* 接收标注变更 → 自动生成 PRD 文件 */
  if (req.method === 'POST' && req.url === '/anno-update') {
    let body = '';
    req.on('data', d => { body += d; });
    req.on('end', async () => {
      try {
        const { changes, cmd, systemName } = JSON.parse(body);
        // 先立即响应浏览器（避免超时）
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ ok: true, queued: (changes || []).length, autoProcess: true }));
        // 异步生成文件
        await processPrdUpdate(changes || [], systemName || '');
        // 清空队列（已自动处理，不再需要 AI 手动读取）
        writeQueue([]);
        _lastEmpty = true;
        broadcastSSE('prd-updated', { ts: new Date().toISOString(), auto: true });
        // 删功能点 → 广播 pin-deleted，让【已打开的原型】实时移除对应标注 PIN（不必刷新）
        const _delKeys = (changes || []).filter(c => c.action === 'delete' && c.pin)
          .map(c => (c.pin.zoneContext && c.pin.zoneContext.fpKey) || c.pin.boundFp || '').filter(Boolean);
        if (_delKeys.length) broadcastSSE('pin-deleted', { fpKeys: _delKeys, ts: new Date().toISOString() });
      } catch (e) {
        console.error('processPrdUpdate error:', e.message);
      }
    });
    return;
  }

  /* 读队列 */
  if (req.method === 'GET' && req.url === '/anno-queue') {
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify(readQueue()));
    return;
  }

  /* 清队列 */
  if (req.method === 'POST' && req.url === '/anno-clear') {
    writeQueue([]); _lastEmpty = true;
    broadcastSSE('prd-updated', { ts: new Date().toISOString() });
    res.writeHead(200); res.end(JSON.stringify({ ok: true }));
    return;
  }

  /* ══ 装配结果回报（子进程 assemble-once → 常驻 → 广播 SSE → 原型弹提示）══
     子进程 assembleArtifacts 跑完把 { ok, system, docx:ok|locked|skipped, flow:ok|skipped|none } POST 回来；
     常驻广播 SSE 'assemble-status' → 原型据此弹 toast（docx/流程图没出→提示缺 pandoc/Chrome·可重生），杜绝静默降级用户无感知。 */
  if (req.method === 'POST' && req.url === '/anno-assemble-status') {
    let body = '';
    req.on('data', d => { body += d; });
    req.on('end', () => {
      let st = {}; try { st = JSON.parse(body || '{}'); } catch (_) {}
      try { broadcastSSE('assemble-status', { ...st, ts: new Date().toISOString() }); } catch (_) {}
      console.log(`  [ASSEMBLE-STATUS] docx=${st.docx || '?'} flow=${st.flow || '?'} → 已广播 SSE`);
    });
    res.writeHead(200); res.end(JSON.stringify({ ok: true }));
    return;
  }

  /* ══ AI 对话框模式（场景①）→ 注入 PIN 到原型 + 生成 PRD 文件 ══
     AI 生成 PIN 内容后 POST 到此端点：
       { pins: [{ fpKey, title, fieldSpecs, useCaseRules, menuPath? }], systemName? }
     服务器：① 写 prd-data.json ② 生成 PRD.md/.docx ③ 广播 SSE inject-pins → 原型 JS 接收后自动在 DOM 创建/更新 PIN
  */
  if (req.method === 'POST' && req.url === '/anno-inject') {
    let body = '';
    req.on('data', d => { body += d; });
    req.on('end', async () => {
      try {
        const { pins, systemName, prdMeta } = JSON.parse(body);
        if ((!pins || !pins.length) && !prdMeta) {
          res.writeHead(400); res.end(JSON.stringify({ ok: false, error: 'pins array or prdMeta required' })); return;
        }
        // ㊴ 工程命名硬卡：坏名(纯编号/功能区/营销句)一律拒写进 prd-data，回 422 + 原因，逼调用方(AI/浏览器)改对。
        const _rejected = (pins || []).map(p => ({ p, c: checkFnName(p.title) })).filter(x => !x.c.ok)
          .map(x => ({ fpKey: x.p.fpKey || '', name: (x.p.title || ''), reason: x.c.reason }));
        if (_rejected.length) {
          res.writeHead(422, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ ok: false, error: '功能名不合格·已拒绝写入 PRD', rejected: _rejected }));
          console.log(`  [命名硬卡] 拒绝 ${_rejected.length} 个坏名：` + _rejected.map(r => `[${r.name}](${r.reason})`).join(' '));
          return;
        }
        // 立即响应，异步处理
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ ok: true, count: (pins || []).length, meta: !!prdMeta }));

        // 转为 changes 格式复用 processPrdUpdate
        const changes = (pins || []).map(p => ({
          action: 'add',
          pin: {
            ...p,
            isAIDraft: p.isAIDraft !== false, // AI 注入默认为草稿，除非明确标注已编辑
            zoneContext: {
              fpKey:      p.fpKey,
              zoneLabel:  p.title,
              zoneId:     `inject-${p.fpKey.replace(/[^a-z0-9]/gi, '-')}`,
              zoneTexts:  [],
              zoneGroups: [],
              zoneHTML:   '',
            },
          },
        }));
        await processPrdUpdate(changes, systemName || '', prdMeta);
        writeQueue([]);

        // 广播到原型（场景①→②同步：原型 JS 收到后自动创建/更新 PIN）
        if (pins && pins.length) { broadcastSSE('inject-pins', { pins, ts: new Date().toISOString() }); console.log(`  [INJECT] ${pins.length} pin(s) broadcast to prototype via SSE`); }
        if (prdMeta) console.log(`  [META] _prd_meta updated (章节内容)`);
      } catch (e) {
        console.error('anno-inject error:', e.message);
      }
    });
    return;
  }

  /* ══ 导出分享版（场景：发给别人看）：客户端传本机全量定位 pin → 生成 <名>-分享版.html（只读 + 嵌入 pin）══
     { pins: [...localStorage 全量定位 pin...], systemName } → 写 archive/<原名>-分享版.html，可直接发文件或上传静态托管 */
  if (req.method === 'POST' && req.url === '/anno-embed') {
    res.setHeader('Access-Control-Allow-Origin', '*');
    let body = '';
    req.on('data', d => { body += d; });
    req.on('end', () => {
      try {
        const { pins, systemName, returnContent } = JSON.parse(body || '{}');
        const written = writeShareVersion(systemName || '', pins || [], { returnContent: !!returnContent });
        res.writeHead(200, { 'Content-Type': 'application/json' });
        // returnContent=true → files=[{name,content}]（浏览器弹框选位置保存）；否则 files=[名字]（服务端已写 archive）
        res.end(JSON.stringify({ ok: true, files: written, count: (pins || []).length, returned: !!returnContent }));
      } catch (e) {
        res.writeHead(500, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ ok: false, error: e.message }));
      }
    });
    return;
  }

  /* ══ 生成研发代码（Route B·「导出研发版」）：原型 prd-data → 前后端骨架代码 ══ */
  if (req.method === 'POST' && req.url === '/anno-codegen') {
    res.setHeader('Access-Control-Allow-Origin', '*');
    let body = '';
    req.on('data', d => { body += d; });
    req.on('end', () => {
      try {
        const { systemName, prdData, fpFilter, feStack, beStack } = JSON.parse(body || '{}');
        const r = generateDevCode(systemName || '', prdData, fpFilter || '', feStack || 'vue', beStack || 'java');
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ ok: true, ...r }));
      } catch (e) {
        res.writeHead(500, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ ok: false, error: e.message }));
      }
    });
    return;
  }

  /* ══ 导出对接料（A·喂AI）：原型 prd-data → openapi+schema+tokens+提示词包 ══ */
  if (req.method === 'POST' && req.url === '/anno-devkit') {
    res.setHeader('Access-Control-Allow-Origin', '*');
    let body = '';
    req.on('data', d => { body += d; });
    req.on('end', () => {
      try {
        const { systemName, prdData, fpFilter } = JSON.parse(body || '{}');
        const r = generateDevKit(systemName || '', prdData, fpFilter || '');
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ ok: true, ...r }));
      } catch (e) {
        res.writeHead(500, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ ok: false, error: e.message }));
      }
    });
    return;
  }

  /* ══ 标注实时烤回工作文件（拷贝原文件即可分享·可编辑）══ */
  if (req.method === 'POST' && req.url === '/anno-persist') {
    res.setHeader('Access-Control-Allow-Origin', '*');
    let body = '';
    req.on('data', d => { body += d; });
    req.on('end', () => {
      try {
        const { pins, systemName } = JSON.parse(body || '{}');
        const written = persistAnnotationsToFile(systemName || '', pins || []);
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ ok: true, files: written, count: (pins || []).length }));
      } catch (e) {
        res.writeHead(500, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ ok: false, error: e.message }));
      }
    });
    return;
  }

  /* ══ 方案A·浏览器内截图存档 → 写进 PRD 的 .2 原型图 ══ */
  if (req.method === 'POST' && req.url === '/anno-screenshots') {
    res.setHeader('Access-Control-Allow-Origin', '*');
    let body = '';
    req.on('data', d => { body += d; });
    req.on('end', () => {
      try {
        const { shots, systemName } = JSON.parse(body || '{}');
        const saved = saveScreenshotsAndRegen(systemName || '', shots || []);
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ ok: true, saved, count: saved.length }));
      } catch (e) {
        res.writeHead(500, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ ok: false, error: e.message }));
      }
    });
    return;
  }

  /* ══ 遗漏扫描：从原型 HTML 提取未标注的交互元素 ══ */
  if (req.method === 'GET' && req.url === '/anno-scan') {
    res.setHeader('Access-Control-Allow-Origin', '*');
    try {
      const prdData = readPrdData();
      const existingTexts = new Set(
        Object.values(prdData.function_points || {}).map(fp => fp.fp_name).filter(Boolean)
      );

      const htmlFiles = fs.existsSync(ARCHIVE_DIR)
        ? fs.readdirSync(ARCHIVE_DIR).filter(f => f.startsWith('原型') && f.endsWith('.html'))
        : [];

      const candidates = new Map(); // text → count（出现越多越靠前）
      // 忽略：纯 UI 操作按钮，非业务功能
      const IGNORE = new Set(['确认','取消','关闭','保存','返回','提交','编辑','删除','查看',
        '刷新','导出','搜索','查询','重置','清空','生成','导入','×','OK','是','否',
        '上一步','下一步','完成','展开','收起','更多','加载中','生成研发PRD']);
      // 业务操作关键词（有此词才算候选）
      const BIZ = /新增|充值|审核|提现|申请|结算|开票|发货|收货|盘点|补货|调拨|核销|对账|授权|配置|分配|绑定|解绑|停用|启用|冻结|解冻|驳回|撤销|批量|打印|签收|发布|上架|下架|转移|拆分|合并|续费|退款/;

      for (const file of htmlFiles) {
        try {
          const html = fs.readFileSync(path.join(ARCHIVE_DIR, file), 'utf-8');
          // el-button 文本
          for (const m of html.matchAll(/<el-button[^>]*>\s*([^<\n]{1,20}?)\s*<\/el-button>/g)) {
            const t = m[1].trim();
            if (t && !IGNORE.has(t) && BIZ.test(t) && !existingTexts.has(t))
              candidates.set(t, (candidates.get(t) || 0) + 1);
          }
          // el-tab-pane label
          for (const m of html.matchAll(/label="([^"]{2,16})"/g)) {
            const t = m[1].trim();
            if (t && !IGNORE.has(t) && BIZ.test(t) && !existingTexts.has(t))
              candidates.set(t, (candidates.get(t) || 0) + 1);
          }
          // @click 元素的文本内容（span/a/div）
          for (const m of html.matchAll(/@click[^>]*>\s*([^<\n]{2,16}?)\s*<\//g)) {
            const t = m[1].trim();
            if (t && !IGNORE.has(t) && BIZ.test(t) && !existingTexts.has(t))
              candidates.set(t, (candidates.get(t) || 0) + 1);
          }
        } catch {}
      }

      const items = [...candidates.entries()]
        .sort((a, b) => b[1] - a[1])
        .slice(0, 20)
        .map(([text]) => ({ text }));

      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ ok: true, items, scanned: htmlFiles.length }));
    } catch (e) {
      res.writeHead(500, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ ok: false, error: e.message }));
    }
    return;
  }

  /* ══ AI 重生成队列（场景②自动入队，场景①/AI 批量读取并重新生成）══
     GET  /anno-ai-queue           → 返回全部待处理条目
     POST /anno-ai-queue           → 新增一条或多条 zoneContext 入队
       body: { item } 或 { items: [...] }
       item 结构: { zoneId, zoneLabel, zoneTexts?, zoneGroups?, zoneHTML?, boundFp?, draftTitle?, draftType?, reason? }
     DELETE /anno-ai-queue         → 清队列（全部）或按 ids 删除
       body(可选): { ids: ["id1","id2"] }（省略则清全部）
  */
  if (req.url === '/anno-ai-queue') {
    /* GET — 读队列 */
    if (req.method === 'GET') {
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ ok: true, items: readAiQueue() }));
      return;
    }
    /* POST — 入队 */
    if (req.method === 'POST') {
      let body = '';
      req.on('data', d => { body += d; });
      req.on('end', () => {
        try {
          const payload = JSON.parse(body);
          const newItems = payload.items
            ? payload.items
            : payload.item ? [payload.item] : [];
          if (!newItems.length) {
            res.writeHead(400, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({ ok: false, error: 'item or items required' }));
            return;
          }
          const queue = readAiQueue();
          const now = new Date().toISOString();
          const added = [];
          for (const raw of newItems) {
            if (!raw.zoneId) continue;
            /* 幂等：同一 zoneId 已存在则更新，否则追加 */
            const existing = queue.findIndex(q => q.zoneId === raw.zoneId);
            const entry = {
              id: raw.id || `aq-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
              ts: now,
              zoneId:     raw.zoneId,
              zoneLabel:  raw.zoneLabel  || raw.zoneId,
              zoneTexts:  raw.zoneTexts  || [],
              zoneGroups: raw.zoneGroups || [],
              zoneHTML:   raw.zoneHTML   || '',
              boundFp:    raw.boundFp    || '',
              draftTitle: raw.draftTitle || '',
              draftType:  raw.draftType  || '',
              reason:     raw.reason     || 'manual',
            };
            if (existing >= 0) { queue[existing] = entry; }
            else { queue.push(entry); }
            added.push(entry.id);
          }
          writeAiQueue(queue);
          broadcastSSE('ai-queue-updated', { count: queue.length });
          res.writeHead(200, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ ok: true, added: added.length, total: queue.length }));
        } catch (e) {
          res.writeHead(400, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ ok: false, error: e.message }));
        }
      });
      return;
    }
    /* DELETE — 删条目或清空 */
    if (req.method === 'DELETE') {
      let body = '';
      req.on('data', d => { body += d; });
      req.on('end', () => {
        try {
          const payload = body ? JSON.parse(body) : {};
          if (payload.ids && payload.ids.length) {
            const toRemove = new Set(payload.ids);
            const queue = readAiQueue().filter(q => !toRemove.has(q.id));
            writeAiQueue(queue);
            broadcastSSE('ai-queue-updated', { count: queue.length });
            res.writeHead(200, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({ ok: true, removed: toRemove.size, total: queue.length }));
          } else {
            writeAiQueue([]);
            broadcastSSE('ai-queue-updated', { count: 0 });
            res.writeHead(200, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({ ok: true, removed: 'all', total: 0 }));
          }
        } catch (e) {
          res.writeHead(400, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ ok: false, error: e.message }));
        }
      });
      return;
    }
  }

  res.writeHead(404); res.end('Not found');
});

// require.main 守卫：直接 `node server.js` 才启动 HTTP 服务；被 require（单测）时只导出函数不监听
if (require.main === module) {
  /* ══════════════════════════════════════════════════════════════════════
     【治本·EADDRINUSE 僵尸进程根因】listen 错误必须挂 server.on('error')。
     历史病根：server.listen 没挂 'error' 监听 → 端口被占用时 error 事件无人接 →
     Node 抛错 → 被上面全局 uncaughtException【保活】兜住 → 进程活着但【没在监听】=
     僵尸(服务像在跑、http://localhost:3799 却不通) → 用户点「导出分享版」报"需先启动 anno-server"。
     error 日志里反复出现的 EADDRINUSE 正是此。修：listen 前挂 'error'：
       · EADDRINUSE = 端口已被【另一个 anno-server 实例】占用(防双开) → 干净退出(0)，让已有实例继续，绝不兜成僵尸；
       · 其它 listen 错误 → 记日志 + 退出(1)，交给监督器(start-anno-server.js)重启，而非僵在原地。
     注：全局 uncaughtException 保活【只该管请求处理期的偶发错】(截图/docx 占用等)，
         不该保活【启动期 listen 失败】——故这里用 server.on('error') 抢在它前面处理。
     ══════════════════════════════════════════════════════════════════════ */
  server.on('error', (e) => {
    if (e && e.code === 'EADDRINUSE') {
      _logErr('[LISTEN_EADDRINUSE]', `端口 ${PORT} 已被占用，已有 anno-server 实例在跑，本进程干净退出(防双开·非崩溃)`);
      console.error(`\n  ⚠️ 端口 ${PORT} 已被占用——已有 anno-server 在跑，本次不重复启动（正常·防双开）。\n`);
      process.exit(0);
    }
    _logErr('[LISTEN_ERROR]', e);
    process.exit(1);
  });
  server.listen(PORT, '127.0.0.1', () => {
    console.log(`\n  ✅ PRD Auto-Gen Server  http://localhost:${PORT}`);
    console.log(`  Archive : ${ARCHIVE_DIR}`);
    console.log(`  Queue   : ${QUEUE_FILE}`);
    console.log(`  SSE     : http://localhost:${PORT}/events`);
    console.log(`\n  圈选(只圈范围·待生成) → 「📋 复制已圈功能」→ 粘给 AI 按 PRD 规则真推理生成 → /anno-inject → 本地文件自动生成（.md + .docx + prd-data.json + 原型HTML）\n`);
  });
}

module.exports = { generatePrdMd, buildFpSections, mergePinIntoPrd, parseFpKey, updatePrototypeHtmls, writeShareVersion, persistAnnotationsToFile, saveScreenshotsAndRegen, writePrdData, readPrdData, renderBusinessFlows, scheduleDocxOverwrite, clearDocxRetry, resolveArchiveDirFor, _dirMatchesSystem, assembleArtifacts, spawnAssembleOnce };
