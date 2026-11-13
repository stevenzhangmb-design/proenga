// 把 PRD 的 md 生成在线网页版（只读）：<outDir>/index.html + <outDir>/img/ 引用到的图片
// 用法：node publish-prd-html.js <prd.md> <outDir> [标题]
// 红字：md 里 [文字]{custom-style="Red Text"} → 网页里同样显示红色
const fs = require('fs'), path = require('path'), { execFileSync } = require('child_process');
const [, , mdPath, outDir, titleArg] = process.argv;
if (!mdPath || !outDir) { console.error('用法：node publish-prd-html.js <prd.md> <outDir> [标题]'); process.exit(1); }
const mdDir = path.dirname(path.resolve(mdPath));
let md = fs.readFileSync(mdPath, 'utf8');
const title = titleArg || (md.match(/^#\s+(.+)$/m) || [, path.basename(mdPath, '.md')])[1].trim();

// 1、收集图片，复制到 outDir/img，并把 md 里的路径改成 img/<序号>.<扩展名>（避免中文路径在网址里出问题）
const imgDir = path.join(outDir, 'img');
fs.mkdirSync(imgDir, { recursive: true });
const map = new Map(); let n = 0, missing = [];
md = md.replace(/!\[([^\]]*)\]\(([^)\s]+)\)/g, (all, alt, src) => {
  if (/^(https?:|data:)/.test(src)) return all;
  const abs = path.resolve(mdDir, decodeURI(src));
  if (!fs.existsSync(abs)) { missing.push(src); return all; }
  if (!map.has(abs)) map.set(abs, 'img/' + String(++n).padStart(4, '0') + path.extname(abs).toLowerCase());
  return `![${alt}](${map.get(abs)})`;
});
// 正文里的 <序列号> 这类中文占位，pandoc 会当成 HTML 标签吃掉，先转义成文字
md = md.replace(/<([^\sa-zA-Z\/!<>][^<>\n]{0,30})>/g, '\\<$1\\>');
const keep = new Set();
for (const [abs, rel] of map) {
  const dst = path.join(outDir, rel); keep.add(path.basename(dst));
  const s = fs.statSync(abs);
  if (!fs.existsSync(dst) || fs.statSync(dst).size !== s.size || !fs.readFileSync(dst).equals(fs.readFileSync(abs))) fs.copyFileSync(abs, dst);
}
for (const f of fs.readdirSync(imgDir)) if (!keep.has(f)) fs.unlinkSync(path.join(imgDir, f)); // 删掉不再引用的旧图

// 2、pandoc 转 html（带目录）
const css = `
:root{--fg:#1f2329;--muted:#646a73;--line:#dee0e3;--bg:#fff;--side:#f7f8fa;--accent:#3363ff;--red:#e02020}
@media (prefers-color-scheme:dark){:root{--fg:#e6e6e6;--muted:#a0a4ab;--line:#3a3d42;--bg:#1b1c1f;--side:#232428;--accent:#7a9bff;--red:#ff6b6b}}
*{box-sizing:border-box}html{scroll-padding-top:16px}
body{margin:0;background:var(--bg);color:var(--fg);font:14px/1.75 "Microsoft YaHei","PingFang SC",sans-serif}
#TOC{position:fixed;top:0;left:0;bottom:0;width:300px;overflow:auto;background:var(--side);border-right:1px solid var(--line);padding:16px 12px;font-size:13px}
#TOC ul{list-style:none;padding-left:14px;margin:0}#TOC>ul{padding-left:0}
#TOC li{position:relative}
#TOC li.closed>ul{display:none}
#TOC .tw{position:absolute;left:-2px;top:3px;width:18px;height:18px;cursor:pointer;border-radius:3px}
#TOC .tw:hover{background:var(--line)}
#TOC li.open>.tw::before,#TOC li.closed>.tw::before{content:"";position:absolute;left:6px;top:5px;border:4px solid transparent;border-left:6px solid var(--muted)}
#TOC li.open>.tw::before{transform:rotate(90deg);transform-origin:3px 4px}
#TOC a{color:var(--fg);text-decoration:none;display:block;padding:2px 4px 2px 18px;border-radius:4px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
#TOC a:hover{background:var(--line)}
#TOC a.cur{background:var(--line);font-weight:600}
.toc-bar{display:flex;gap:8px;margin-bottom:8px;position:sticky;top:-16px;background:var(--side);padding:6px 0}
.toc-bar button{font:12px "Microsoft YaHei",sans-serif;padding:2px 10px;border:1px solid var(--line);border-radius:4px;background:var(--bg);color:var(--fg);cursor:pointer}
.toc-bar button:hover{border-color:var(--accent);color:var(--accent)}
main{margin-left:300px;padding:24px 40px 80px;max-width:1300px}
h1{font-size:24px}h2{font-size:20px;border-bottom:1px solid var(--line);padding-bottom:4px;margin-top:40px}h3{font-size:17px}h4,h5,h6,h7{font-size:15px}
p{text-indent:0;margin:6px 0}
table{border-collapse:collapse;margin:10px 0;width:100%;font-size:13px}
th,td{border:1px solid var(--line);padding:6px 8px;vertical-align:top;text-align:left;overflow-wrap:break-word}
th{white-space:nowrap}
pre{white-space:pre-wrap}
main{overflow-x:hidden}
th{background:var(--side);font-weight:600}
img{max-width:100%;border:1px solid var(--line);margin:6px 0}
[data-custom-style="Red Text"]{color:var(--red)}
code{font-family:Consolas,monospace}
#TOC a.red{color:var(--red)}
.hx{font-weight:600;margin:14px 0 6px}.h7{font-size:15px}.h8{font-size:14px}
@media (max-width:900px){#TOC{position:static;width:auto;max-height:50vh;border-right:0;border-bottom:1px solid var(--line)}main{margin-left:0;padding:16px}table{display:block;overflow-x:auto}}
`;
const tmpMd = path.join(outDir, '.src.md'), tmpCss = path.join(outDir, '.style.css');
fs.writeFileSync(tmpMd, md); fs.writeFileSync(tmpCss, css);
const html = path.join(outDir, 'index.html');
execFileSync('pandoc', [tmpMd, '-f', 'markdown', '-t', 'html5', '-s',
  '--metadata', 'title=' + title, '--metadata', 'lang=zh-CN', '-V', 'document-css=false',
  '--css', '.style.css', '-o', html], { cwd: outDir, stdio: 'inherit' });
// 样式直接内联；去掉 pandoc 自带的大标题块（正文里已有一级标题）
let h = fs.readFileSync(html, 'utf8')
  .replace(/<style>\s*\/\* Default styles provided by pandoc[\s\S]*?<\/style>/, '')
  .replace(/<colgroup>[\s\S]*?<\/colgroup>/g, '') // 列宽按内容自动分配（与 Word 一致），不按 md 里 --- 的长度平均分
  .replace(/<link rel="stylesheet" href="\.style\.css"\s*\/?>/, `<style>${css}</style>`)
  .replace(/<header id="title-block-header">[\s\S]*?<\/header>/, '')
  .replace('<head>', '<head>\n<meta name="robots" content="noindex">');
// 第 7、8 级标题：md 里写成 ::: {custom-style="Heading 7"}，Word 里是标题，网页里也要当标题（加锚点、进目录）
let hx = 0;
h = h.replace(/<div data-custom-style="Heading (\d)">\s*([\s\S]*?)\s*<\/div>/g, (a, lv, inner) =>
  `<div class="hx h${lv}" id="hx-${++hx}" role="heading" aria-level="${lv}">${inner.replace(/^<p>([\s\S]*)<\/p>$/, '$1')}</div>`);
// 目录：按正文顺序收集 1～8 级标题，和 Word 目录一致
const heads = []; const hre = /<h([1-6])\s+id="([^"]+)"[^>]*>([\s\S]*?)<\/h\1>|<div class="hx h(\d)" id="([^"]+)"[^>]*>([\s\S]*?)<\/div>/g; let mt;
while ((mt = hre.exec(h))) heads.push(mt[1] ? { lv: +mt[1], id: mt[2], html: mt[3] } : { lv: +mt[4], id: mt[5], html: mt[6] });
// 建成树：每个标题挂到前面最近的更高级标题下面，有下级的可以折叠/展开
const root = { kids: [] }, stack = [{ lv: 0, node: root }];
for (const x of heads) {
  while (stack[stack.length - 1].lv >= x.lv) stack.pop();
  const node = { ...x, kids: [] }; stack[stack.length - 1].node.kids.push(node); stack.push({ lv: x.lv, node });
}
const OPEN_LV = 1; // 默认只展开第 1 级（显示到章，如“5 发票系统”），其余收起
const esc = s => s.replace(/&/g, '&amp;').replace(/"/g, '&quot;');
const renderToc = list => '<ul>' + list.map(x => {
  const txt = x.html.replace(/<[^>]+>/g, '').replace(/\s+/g, ' ').trim(), red = /Red Text/.test(x.html) ? ' red' : '';
  const has = x.kids.length > 0;
  return `<li class="${has ? (x.lv <= OPEN_LV ? 'open' : 'closed') : 'leaf'}"><span class="tw"${has ? ' role="button" aria-label="展开或收起"' : ''}></span><a href="#${x.id}" class="t${red}" title="${esc(txt)}">${txt}</a>${has ? renderToc(x.kids) : ''}</li>`;
}).join('\n') + '</ul>';
const toc = `<nav id="TOC" role="doc-toc"><div class="toc-bar"><button type="button" data-act="open">全部展开</button><button type="button" data-act="close">全部收起</button></div>\n${renderToc(root.kids)}</nav>\n`;
const tocJs = `<script>(function(){var T=document.getElementById('TOC');
T.addEventListener('click',function(e){var b=e.target.closest('button[data-act]');if(b){var o=b.dataset.act==='open';T.querySelectorAll('li.open,li.closed').forEach(function(li){li.className=o?'open':'closed'});if(!o){var top=T.querySelector(':scope>ul>li');if(top&&!top.classList.contains('leaf'))top.className='open'}return}
var tw=e.target.closest('.tw');if(tw){var li=tw.parentNode;if(li.classList.contains('leaf'))return;li.className=li.classList.contains('open')?'closed':'open';}});
function reveal(a){for(var li=a.parentNode.parentNode.closest('li');li;li=li.parentNode.closest('li'))if(li.classList.contains('closed'))li.className='open';}
var links=[].slice.call(T.querySelectorAll('a.t')),map={};links.forEach(function(a){map[decodeURIComponent(a.hash.slice(1))]=a});
var cur=null;function mark(id){var a=map[id];if(!a||a===cur)return;if(cur)cur.classList.remove('cur');cur=a;a.classList.add('cur');reveal(a);var r=a.getBoundingClientRect(),tr=T.getBoundingClientRect();if(r.top<tr.top+40||r.bottom>tr.bottom-10)a.scrollIntoView({block:'center'});}
var hs=[].slice.call(document.querySelectorAll('main h1[id],main h2[id],main h3[id],main h4[id],main h5[id],main h6[id],main .hx[id]'));
var tick=false;window.addEventListener('scroll',function(){if(tick)return;tick=true;requestAnimationFrame(function(){tick=false;var c=null;for(var i=0;i<hs.length;i++){if(hs[i].getBoundingClientRect().top<=80)c=hs[i];else break}if(c)mark(c.id)})},{passive:true});
if(location.hash)mark(decodeURIComponent(location.hash.slice(1)));})();</script>`;
h = h.replace(/<body>/, '<body>\n' + toc + '<main>').replace(/<\/body>/, '</main>\n' + tocJs + '\n</body>');
// 流程图：```mermaid 在浏览器里画成图（和 Word 里的流程图同源）
if (/<pre class="mermaid">/.test(h)) {
  const cand = [path.join(__dirname, 'vendor/mermaid.min.js'), path.join(__dirname, '../pm-design/vendor/mermaid.min.js'), path.join(__dirname, '../../../anno-server/vendor/mermaid.min.js')];
  const mm = cand.find(p => fs.existsSync(p));
  if (!mm) { console.error('找不到 mermaid.min.js，流程图会显示成代码'); process.exit(3); }
  fs.copyFileSync(mm, path.join(outDir, 'mermaid.min.js'));
  h = h.replace(/<pre class="mermaid"><code>([\s\S]*?)<\/code><\/pre>/g, '<pre class="mermaid">$1</pre>')
    .replace('</body>', `<script src="mermaid.min.js"></script>\n<script>mermaid.initialize({startOnLoad:false,securityLevel:'loose',flowchart:{useMaxWidth:true},themeVariables:{fontFamily:'Microsoft YaHei'}});mermaid.run();</script>\n</body>`);
}
h = h.replace(/<img (?![^>]*loading=)/g, '<img loading="lazy" '); // 图片滚到才加载，打开更快
fs.writeFileSync(html, h);
fs.unlinkSync(tmpMd); fs.unlinkSync(tmpCss);
console.log(`网页已生成：${html}（${(h.length / 1e6).toFixed(1)}MB，图片 ${map.size} 张）`);
if (missing.length) { console.error('找不到的图片：\n' + missing.join('\n')); process.exit(2); }
