#!/usr/bin/env node
/* ════════════════════════════════════════════════════════════════════════
   mhtml2html.js · 把 Chrome/Blink 的 MHTML(.mhtml) 转成【任意浏览器双击就开的通用单 .html】
   零依赖(纯 Node·无 npm 包·无 AGPL)。像素级——因为只是把 Chrome 冻好的真实 DOM+资源
   重新打包成 data: URI 内联，不重画。
   ────────────────────────────────────────────────────────────────────────
   用法：node mhtml2html.js <in.mhtml> [out.html]
   原理：MHTML = multipart/related；根 text/html 部件里的资源按【绝对 URL=各部件 Content-Location】
        引用。逐部件解码→建 URL→data:URI 映射→CSS 部件内 url() 重写并内联进 <style>→
        根 HTML 里所有资源 URL 替换成 data:URI。
   ════════════════════════════════════════════════════════════════════════ */
'use strict';
const fs = require('fs');
const path = require('path');

/* ── 解码助手 ── */
function decodeQuotedPrintable(str) {
  // 软换行 =\r\n / =\n 去掉；=XX → 字节。QP 编码的是 UTF-8 字节流。
  const noSoft = str.replace(/=\r?\n/g, '');
  const bytes = [];
  for (let i = 0; i < noSoft.length; i++) {
    const c = noSoft[i];
    if (c === '=' && i + 2 < noSoft.length && /[0-9A-Fa-f]{2}/.test(noSoft.substr(i + 1, 2))) {
      bytes.push(parseInt(noSoft.substr(i + 1, 2), 16)); i += 2;
    } else { bytes.push(c.charCodeAt(0) & 0xff); }
  }
  return Buffer.from(bytes);
}
function decodePart(body, enc) {
  enc = (enc || '').toLowerCase().trim();
  if (enc === 'base64') return Buffer.from(body.replace(/\s+/g, ''), 'base64');
  if (enc === 'quoted-printable') return decodeQuotedPrintable(body);
  return Buffer.from(body, 'utf8'); // 7bit/8bit/binary/none
}

/* ── 解析 MHTML ── */
function parseMhtml(raw) {
  // 头 / 体 在第一空行分隔
  const splitAt = raw.search(/\r?\n\r?\n/);
  const header = raw.slice(0, splitAt);
  let body = raw.slice(splitAt).replace(/^\r?\n\r?\n/, '');
  const bMatch = header.match(/boundary="?([^"\r\n;]+)"?/i);
  if (!bMatch) throw new Error('MHTML 未找到 multipart boundary');
  const boundary = bMatch[1];
  const snapLoc = (header.match(/Snapshot-Content-Location:\s*(.+)/i) || [])[1] || '';
  // 按 --boundary 切
  const chunks = body.split('--' + boundary);
  const parts = [];
  for (let chunk of chunks) {
    chunk = chunk.replace(/^\r?\n/, '');
    if (!chunk || chunk === '--' || chunk.startsWith('--')) continue; // 结束标记
    const hb = chunk.search(/\r?\n\r?\n/);
    if (hb < 0) continue;
    const phdr = chunk.slice(0, hb);
    let pbody = chunk.slice(hb).replace(/^\r?\n\r?\n/, '');
    pbody = pbody.replace(/\r?\n$/, '');
    const type = ((phdr.match(/Content-Type:\s*([^\r\n;]+)/i) || [])[1] || '').trim().toLowerCase();
    const enc = ((phdr.match(/Content-Transfer-Encoding:\s*([^\r\n]+)/i) || [])[1] || '').trim();
    const loc = ((phdr.match(/Content-Location:\s*([^\r\n]+)/i) || [])[1] || '').trim();
    const cid = ((phdr.match(/Content-ID:\s*<?([^>\r\n]+)>?/i) || [])[1] || '').trim();
    parts.push({ type, enc, loc, cid, body: pbody });
  }
  return { boundary, snapLoc, parts };
}

/* ── URL 在 HTML 里可能被实体化(&amp;)——两种形态都替 ── */
function replaceAll(hay, needle, repl) {
  if (!needle) return hay;
  let out = hay.split(needle).join(repl);
  const amp = needle.replace(/&/g, '&amp;');
  if (amp !== needle) out = out.split(amp).join(repl);
  return out;
}
function toDataUri(type, buf) { return 'data:' + (type || 'application/octet-stream') + ';base64,' + buf.toString('base64'); }

function convert(raw) {
  const { snapLoc, parts } = parseMhtml(raw);
  // 根 HTML = Content-Location==Snapshot-Content-Location 的 text/html，否则第一个 text/html
  let root = parts.find(p => p.type === 'text/html' && p.loc && snapLoc && p.loc === snapLoc)
          || parts.find(p => p.type === 'text/html');
  if (!root) throw new Error('MHTML 未找到根 text/html 部件');
  // 建 URL→dataURI 映射（非 HTML 二进制/字体/图片资源）
  const dataMap = new Map();   // loc → dataURI
  const cssParts = [];         // {loc, css}
  for (const p of parts) {
    if (p === root) continue;
    const buf = decodePart(p.body, p.enc);
    if (p.type === 'text/css') { cssParts.push({ loc: p.loc, css: buf.toString('utf8') }); }
    else { const uri = toDataUri(p.type, buf); if (p.loc) dataMap.set(p.loc, uri); if (p.cid) dataMap.set('cid:' + p.cid, uri); }
  }
  // CSS 部件里的 url() 重写为 dataURI，然后备用于内联
  const inlineCss = new Map(); // loc → 重写后的 css
  for (const c of cssParts) {
    let css = c.css;
    for (const [loc, uri] of dataMap) css = replaceAll(css, loc, uri);
    inlineCss.set(c.loc, css);
  }
  // 根 HTML 解码
  let html = decodePart(root.body, root.enc).toString('utf8');
  // ① <link rel=stylesheet href=CSSLOC> → 内联 <style>
  for (const [loc, css] of inlineCss) {
    const linkRe = new RegExp('<link\\b[^>]*href=["\']?' + loc.replace(/[.*+?^${}()|[\]\\]/g, '\\$&') + '["\']?[^>]*>', 'ig');
    html = html.replace(linkRe, '<style>\n' + css + '\n</style>');
    // 万一没匹配到 link（相对路径等），把该 CSS 的资源仍进 dataMap 供兜底（作为 data:text/css）
    if (!html.includes('<style>')) dataMap.set(loc, toDataUri('text/css', Buffer.from(css, 'utf8')));
  }
  // ② 其余资源 URL → dataURI（src / url() / srcset / href 图标 等，按绝对 URL 精确替换）
  for (const [loc, uri] of dataMap) html = replaceAll(html, loc, uri);
  // ③ 补 doctype
  if (!/^\s*<!doctype/i.test(html)) html = '<!doctype html>\n' + html;
  // 统计残留外链（诊断用）
  const leftover = (html.match(/https?:\/\/[^"')\s>]+/g) || []).filter(u => !u.startsWith('data:')).length;
  return { html, nParts: parts.length, nInlinedCss: inlineCss.size, nRes: dataMap.size, leftover };
}

/* ── CLI ── */
if (require.main === module) {
  const inp = process.argv[2];
  if (!inp) { console.error('用法: node mhtml2html.js <in.mhtml> [out.html]'); process.exit(2); }
  const out = process.argv[3] || inp.replace(/\.mhtml$/i, '') + '-单文件.html';
  const raw = fs.readFileSync(inp, 'latin1'); // 按字节读(QP/base64 解码时自行还原 UTF-8)
  const r = convert(raw);
  fs.writeFileSync(out, r.html, 'utf8');
  console.log('✅ 转换完成 → ' + out);
  console.log('   部件 ' + r.nParts + ' · 内联CSS ' + r.nInlinedCss + ' · 内联资源 ' + r.nRes + ' · 残留外链 ' + r.leftover + (r.leftover ? ' ⚠(可能有未内联资源·需核查)' : ' ✓'));
}
module.exports = { convert, parseMhtml };
