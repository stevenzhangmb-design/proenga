// 生成只读分享版（与 anno-server writeShareVersion 同样处理，保留内嵌标注）。用法：node make-share-copy.js <交付件.html> <输出.html>
const fs=require('fs');const [,,src,dst]=process.argv;
/* 2026-11-22 铁律：推送/发布前，交付件的全量检查必须已经跑完并全部通过；检查还在跑、没通过、比交付件旧，一律不许生成发布件。 */
{const rp=src+'.gate-report.txt';const st=fs.existsSync(rp)?fs.statSync(rp):null;const first=st?(fs.readFileSync(rp,'utf-8').split(/\r?\n/)[0]||''):'';
 const why=!st?'没有全量检查报告（先跑 rebuild-deliverable）':/^RUNNING/.test(first)?'全量检查还在跑，等它跑完':!/^PASS/.test(first)?'全量检查没通过：'+first:st.mtimeMs<fs.statSync(src).mtimeMs?'检查报告比交付件旧，重新跑检查':'';
 if(why){console.error('✗ 不能生成发布件：'+why+'\n  报告：'+rp);process.exit(5);}}
let content=fs.readFileSync(src,'utf-8');
const mm=/window\.__PRD_DATA__\s*=\s*\{/.exec(content);if(!mm)throw new Error('no PRD_DATA');const mIdx=mm.index;
const eqIdx=content.indexOf('=',mIdx)+1;const jIdx=content.indexOf('{',eqIdx);let depth=0,jEnd=-1;
for(let i=jIdx;i<content.length;i++){if(content[i]==='{')depth++;else if(content[i]==='}'){if(--depth===0){jEnd=i;break}}}
let tail=jEnd+1;while(tail<content.length&&(content[tail]===';'||content[tail]===' '))tail++;
const m=content.match(/window\.__USER_ANNOTATIONS__\s*=\s*(\[[\s\S]*?\]);/);const pins=m?m[1]:'[]';
const rest=content.slice(tail).replace(/\s*window\.__ANNO_READONLY__\s*=\s*(?:true|false)\s*;/g,'').replace(/\s*window\.__USER_ANNOTATIONS__\s*=\s*\[[\s\S]*?\];/g,'');
let out=content.slice(0,tail)+`\nwindow.__ANNO_READONLY__ = true;\nwindow.__USER_ANNOTATIONS__ = ${pins};`+rest;
if(!/<body[^>]*\banno-preview-mode\b/i.test(out))out=out.replace(/<body\b([^>]*)>/i,(mm,a)=>/\bclass\s*=/.test(a)?mm.replace(/class\s*=\s*(['"])/i,'class=$1anno-preview-mode '):`<body class="anno-preview-mode"${a}>`);
fs.writeFileSync(dst,out,'utf-8');console.log('share written',dst,(out.length/1e6).toFixed(1)+'MB, pins chars',pins.length);
