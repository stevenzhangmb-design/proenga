/* ════════════════════════════════════════════════════════════════════════
   _anno-isolate.js · 浏览器闸与真 anno-server(3799) 隔离 · 2026-11-13
   ────────────────────────────────────────────────────────────────────────
   为什么：原型里的标注层硬编码 fetch('http://localhost:3799/anno-persist')，页面加载/清空/编辑后
   1.5 秒去抖把全部标注烤回【archive 里 system_name 相同的原型文件】（非原子写）。
   闸用无头浏览器打开原型时只要没拦 3799，本机正在跑的真 anno-server 就会把闸的测试标注
   写进用户真实原型——实测 ②regression-check 每跑一次都改写
   archive\原型-海外仓财务-充值管理-装配版-…-offline.html，并让同时读它的 ⑦⑨㉛㊱ 读到半截文件。

   用法（在 Page.navigate 之前调用一次）：
     const { isolateAnnoServer } = require('./_anno-isolate');
     await isolateAnnoServer(send);            // 3799 一律打到死端口 = 等同"服务没启动"
     await isolateAnnoServer(send, APORT);     // 3799 重定向到闸自己起的临时实例
   send = (method, params) => Promise（CDP 发送函数）。
   效果：fetch / EventSource / XMLHttpRequest / sendBeacon 里的 localhost:3799、127.0.0.1:3799
   全部改到目标端口（默认 127.0.0.1:9 = 连接被拒，和服务没开时行为一致，不改变闸的判定）。
   防回退：qa/anno-isolation-gate.js 静态扫所有浏览器闸，打开原型却没接本隔离 = 红。
   ════════════════════════════════════════════════════════════════════════ */
const DEAD_PORT = 9;

function isolationSource(port) {
  const to = "127.0.0.1:" + (port || DEAD_PORT);
  return `(function(){
  var TO=${JSON.stringify(to)};
  function fx(u){try{if(typeof u==='string')return u.replace(/(localhost|127\\.0\\.0\\.1):3799(?=\\/|$)/g,TO);if(u&&typeof URL!=='undefined'&&u instanceof URL)return new URL(fx(u.href));}catch(e){}return u;}
  try{var of=window.fetch;if(of){window.fetch=function(u,o){try{if(typeof Request!=='undefined'&&u instanceof Request){var n=fx(u.url);if(n!==u.url)u=new Request(n,u);}else u=fx(u);}catch(e){}return of.call(this,u,o);};}}catch(e){}
  try{var OE=window.EventSource;if(OE){var NE=function(u,o){return new OE(fx(u),o);};NE.prototype=OE.prototype;NE.CONNECTING=0;NE.OPEN=1;NE.CLOSED=2;window.EventSource=NE;}}catch(e){}
  try{var xo=XMLHttpRequest.prototype.open;XMLHttpRequest.prototype.open=function(m,u){var a=Array.prototype.slice.call(arguments);a[1]=fx(u);return xo.apply(this,a);};}catch(e){}
  try{if(navigator.sendBeacon){var sb=navigator.sendBeacon.bind(navigator);navigator.sendBeacon=function(u,d){return sb(fx(u),d);};}}catch(e){}
  window.__ANNO_ISOLATED__=TO;
})();`;
}

async function isolateAnnoServer(send, port) {
  return send("Page.addScriptToEvaluateOnNewDocument", { source: isolationSource(port) });
}

module.exports = { isolateAnnoServer, isolationSource, DEAD_PORT };
