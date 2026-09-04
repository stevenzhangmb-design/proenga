/* ============================================================
   anno-server 跨平台后台监督器 · start-anno-server.js
   - 任何 OS（Windows / macOS / Linux）通用，零额外依赖（只用 Node 内置）
   - 崩溃自动重启（保持 PRD 同步不断）；防双开（端口 3799 已通则退出）
   - 子进程 stdio:'ignore' → 无输出噪音
   后台启动方式（由 AI / CLAUDE.md / AGENTS.md 按系统选）：
     Windows : start-anno-server.vbs（最干净·全隐藏）  或  Start-Process node start-anno-server.js -WindowStyle Hidden
     mac/Linux: nohup node start-anno-server.js >/dev/null 2>&1 &
   ============================================================ */
const { spawn } = require("child_process");
const http = require("http");
const path = require("path");
const fs   = require("fs");

function portBusy() {
  return new Promise((res) => {
    const req = http.get("http://localhost:3799/anno-queue", (r) => { res(r.statusCode === 200); r.resume(); });
    req.on("error", () => res(false));
    req.setTimeout(1500, () => { req.destroy(); res(false); });
  });
}

(async () => {
  if (await portBusy()) process.exit(0);          // 已在运行 → 不双开
  const server = path.join(__dirname, "server.js");
  const logPath = path.join(__dirname, "anno-server.log");
  let fastFail = 0;                               // 连续"秒崩"计数：正常被杀→秒回；崩溃循环→退避防 CPU 空转
  const loop = () => {
    let everHealthy = false;   // 起来健康过一次 → 之后退出算"正常被杀"(秒回)；从没健康过 → "崩溃循环"(退避防空转)
    // 子进程输出落日志(原 stdio:'ignore' 把崩溃原因吞了→查不到根因)；每次重启前截断超大日志(>2MB)防无限增长
    let out = "ignore";
    try { if (fs.existsSync(logPath) && fs.statSync(logPath).size > 2 * 1024 * 1024) fs.writeFileSync(logPath, ""); out = fs.openSync(logPath, "a"); } catch (e) { out = "ignore"; }
    const child = spawn(process.execPath, [server], { cwd: __dirname, stdio: ["ignore", out, out], windowsHide: true });
    // 健康看门狗：进程还活着但【假死/卡住不响应】时，普通的 exit 监听抓不到。
    // 启动 20s 宽限后每 15s ping 一次端口，连续 2 次不通(≈30s 无响应)=判定卡死→杀掉，触发下方 exit→自动重生。
    let miss = 0;
    const wd = setInterval(async () => {
      if (await portBusy()) { miss = 0; return; }
      if (++miss >= 2) { clearInterval(wd); try { child.kill(); } catch (e) {} }
    }, 15000);
    // 快速健康探针：起来通了就标记 everHealthy（1s 一次·通了即停）——用于区分"正常被杀"vs"崩溃循环"
    const hp = setInterval(async () => { if (await portBusy()) { everHealthy = true; clearInterval(hp); } }, 1000);
    child.on("exit", () => {
      clearInterval(wd); clearInterval(hp);
      // 起来健康过=正常被杀/运行中崩→清零→800ms 秒回；从没健康过=崩溃循环(启动即挂)→指数退避到 8s 防 CPU 空转
      if (everHealthy) fastFail = 0; else fastFail++;
      const delay = everHealthy ? 800 : Math.min(800 * Math.pow(2, fastFail), 8000);
      setTimeout(async () => {
        if (await portBusy()) process.exit(0);     // 期间别的实例接管了 → 退出不抢
        loop();                                    // 崩了/被杀/卡死 → 快速重启（正常 800ms）
      }, delay);
    });
  };
  loop();
})();
