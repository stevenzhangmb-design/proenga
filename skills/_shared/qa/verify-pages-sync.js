#!/usr/bin/env node
/* verify-pages-sync.js · 推送到 GitHub Pages（或任何静态托管）后，核对线上文件与本地发布目录逐字节一致。
   铁律：本地原型/PRD 是什么样，线上就必须一模一样；不一致不许说"已推送"。

   用法：
     node verify-pages-sync.js --local <本地发布目录> --base <Pages根网址> [选项] <相对路径1> <相对路径2> ...
   例：
     node verify-pages-sync.js --local <发布目录> --base https://<用户名>.github.io/<仓库名>/ invoice-system.html prd/index.html prd/img/0001.png

   选项：
     --timeout <秒>     单个文件下载超时（默认 600，大文件要留够）
     --retries <次>     单个文件下载失败重试次数（默认 3）
     --wait <分钟>      有不一致时每隔 --interval 秒整轮重核，最多等这么久（默认 0 = 只核一次；Pages 部署有延迟时用）
     --interval <秒>    重核间隔（默认 120）
     --no-bust          不加防缓存参数（默认在网址后加 ?_v=<时间戳> 绕开 CDN 缓存）
     --strict-eol       换行符不同也算不一致（默认不算，见下方"换行符"）

   输出：每个文件打印 一致 / 不一致 / 下载失败 / 本地缺失，以及 sha256、大小、用时。
   换行符：本地是 Windows 换行（CRLF）、git 开了 core.autocrlf 时，仓库里存的和线上发出的是 LF，逐字节必然不同。
     所以每个文件另算一份"去掉 CRLF 里的 CR"后的 sha256：原始不同但这份相同 = 判"一致（仅换行符不同）"，内容与显示完全相同；
     加 --strict-eol 则仍判不一致。
   退出码：全部一致 = 0；有不一致或下载失败或本地缺失 = 1；参数错误 = 2。
   下载走 Node 原生 https/http（跟随重定向），边下边算 sha256，不落盘。 */
require('./_tmp-sandbox');
const fs = require('fs'), path = require('path'), crypto = require('crypto');
const https = require('https'), http = require('http');

function parseArgs(argv) {
  const o = { local: '', base: '', timeout: 600, retries: 3, wait: 0, interval: 120, bust: true, strictEol: false, files: [] };
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    const next = () => { if (i + 1 >= argv.length) throw new Error('缺少参数值：' + a); return argv[++i]; };
    if (a === '--local') o.local = next();
    else if (a === '--base') o.base = next();
    else if (a === '--timeout') o.timeout = +next();
    else if (a === '--retries') o.retries = +next();
    else if (a === '--wait') o.wait = +next();
    else if (a === '--interval') o.interval = +next();
    else if (a === '--no-bust') o.bust = false;
    else if (a === '--strict-eol') o.strictEol = true;
    else if (a === '-h' || a === '--help') o.help = true;
    else if (a.startsWith('--')) throw new Error('未知选项：' + a);
    else o.files.push(a);
  }
  return o;
}

// 同时算原始 sha256 和"CRLF→LF"后的 sha256（流式，跨块的 CR 也处理对）
function makeHasher() {
  const h = crypto.createHash('sha256'), hl = crypto.createHash('sha256'); let n = 0, pendCR = false;
  return {
    update(d) {
      h.update(d); n += d.length;
      let start = 0;
      if (pendCR) { if (d[0] !== 0x0a) hl.update(Buffer.from([0x0d])); pendCR = false; }
      for (let i = 0; i < d.length; i++) {
        if (d[i] !== 0x0d) continue;
        if (i === d.length - 1) { hl.update(d.subarray(start, i)); start = d.length; pendCR = true; }
        else if (d[i + 1] === 0x0a) { hl.update(d.subarray(start, i)); start = i + 1; }
      }
      if (start < d.length) hl.update(d.subarray(start));
    },
    done() { if (pendCR) hl.update(Buffer.from([0x0d])); return { hash: h.digest('hex'), lf: hl.digest('hex'), size: n }; },
  };
}

function sha256File(p) {
  return new Promise((res, rej) => {
    const h = makeHasher();
    fs.createReadStream(p).on('data', d => h.update(d)).on('end', () => res(h.done())).on('error', rej);
  });
}

function sha256Url(url, timeoutMs, hops = 0) {
  return new Promise((res, rej) => {
    if (hops > 10) return rej(new Error('重定向次数过多'));
    const mod = url.startsWith('https:') ? https : http;
    const req = mod.get(url, { headers: { 'User-Agent': 'verify-pages-sync', 'Cache-Control': 'no-cache', 'Accept-Encoding': 'identity' } }, r => {
      if ([301, 302, 303, 307, 308].includes(r.statusCode) && r.headers.location) {
        r.resume();
        return sha256Url(new URL(r.headers.location, url).href, timeoutMs, hops + 1).then(res, rej);
      }
      if (r.statusCode !== 200) { r.resume(); return rej(new Error('HTTP ' + r.statusCode)); }
      const h = makeHasher();
      r.on('data', d => h.update(d));
      r.on('end', () => res(h.done()));
      r.on('error', rej);
    });
    req.setTimeout(timeoutMs, () => req.destroy(new Error('超时 ' + Math.round(timeoutMs / 1000) + ' 秒')));
    req.on('error', rej);
  });
}

async function fetchWithRetry(url, timeoutMs, retries) {
  let last;
  for (let k = 0; k <= retries; k++) {
    try { return await sha256Url(url, timeoutMs); }
    catch (e) { last = e; if (k < retries) await new Promise(r => setTimeout(r, 3000 * (k + 1))); }
  }
  throw last;
}

function joinUrl(base, rel) {
  const b = base.endsWith('/') ? base : base + '/';
  return new URL(rel.split(/[\\/]/).map(encodeURIComponent).join('/'), b).href;
}

async function checkOnce(o) {
  const results = [];
  for (const rel of o.files) {
    const t0 = Date.now();
    const lp = path.join(o.local, rel);
    let r = { rel, status: '', detail: '' };
    if (!fs.existsSync(lp)) { r.status = '本地缺失'; r.detail = lp; }
    else {
      const loc = await sha256File(lp);
      let url = joinUrl(o.base, rel);
      if (o.bust) url += (url.includes('?') ? '&' : '?') + '_v=' + Date.now();
      try {
        const rem = await fetchWithRetry(url, o.timeout * 1000, o.retries);
        const eolOnly = rem.hash !== loc.hash && rem.lf === loc.lf;
        r.status = rem.hash === loc.hash ? '一致' : (eolOnly && !o.strictEol ? '一致' : '不一致');
        if (eolOnly) r.note = '（仅换行符不同：本地 CRLF、线上 LF，内容完全相同）';
        r.detail = r.status === '一致'
          ? `sha256 ${loc.hash.slice(0, 16)}… ${loc.size} 字节`
          : `本地 ${loc.hash.slice(0, 16)}…(${loc.size} 字节) 线上 ${rem.hash.slice(0, 16)}…(${rem.size} 字节)`;
      } catch (e) { r.status = '下载失败'; r.detail = e.message; }
    }
    r.secs = ((Date.now() - t0) / 1000).toFixed(1);
    console.log(`[${r.status}] ${rel}  ${r.detail}${r.note ? '  ' + r.note : ''}  用时 ${r.secs} 秒`);
    results.push(r);
  }
  return results;
}

(async () => {
  let o;
  try { o = parseArgs(process.argv.slice(2)); } catch (e) { console.error(e.message); process.exit(2); }
  if (o.help || !o.local || !o.base || !o.files.length) {
    console.error('用法：node verify-pages-sync.js --local <本地发布目录> --base <Pages根网址> [--timeout 秒] [--retries 次] [--wait 分钟] [--interval 秒] [--no-bust] [--strict-eol] <相对路径...>');
    process.exit(o.help ? 0 : 2);
  }
  const deadline = Date.now() + o.wait * 60000;
  let round = 0;
  for (;;) {
    round++;
    console.log(`—— 第 ${round} 轮核对 ${new Date().toLocaleString()} ——`);
    const res = await checkOnce(o);
    const bad = res.filter(r => r.status !== '一致');
    if (!bad.length) { console.log(`全部一致（${res.length} 个文件）。`); process.exit(0); }
    if (Date.now() + o.interval * 1000 > deadline) {
      console.log(`有 ${bad.length} 个文件不一致或没核成：${bad.map(r => r.rel + '(' + r.status + ')').join('、')}。不许说"已推送"。`);
      process.exit(1);
    }
    console.log(`有 ${bad.length} 个没对上，${o.interval} 秒后重核。`);
    await new Promise(r => setTimeout(r, o.interval * 1000));
    // 已一致的不再重下
    o.files = bad.map(r => r.rel);
  }
})();
