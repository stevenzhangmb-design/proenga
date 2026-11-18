---
name: proenga-update
description: 更新 Proenga 工具包到 GitHub 上的最新版，或检查有没有新版。用户说“更新 Proenga”“帮我更新 Proenga”“升级 Proenga”“检查 Proenga 有没有新版”“Proenga 是不是最新版”时使用。会运行 proenga 文件夹里的 update-proenga.ps1（Windows）或 update-proenga.sh（macOS / Linux），再用白话转述结果。
---

# proenga-update（更新 Proenga）

用户要更新 Proenga，或者问有没有新版时，按下面的步骤做。任何 AI 工具都适用，包括只把技能复制到 `~/.agents/skills` 的 OpenClaw。

## 1. 找到 Proenga 文件夹

Proenga 文件夹是根目录里有 `update-proenga.ps1`、`update-proenga.sh`、`AGENTS.md` 和 `skills` 文件夹的那个文件夹，默认名字是 `proenga` 或 `proenga-main`。

- 用户在话里说了位置，就用用户说的位置。
- 当前打开的文件夹就是 Proenga 文件夹，就用当前文件夹。
- 都不是，就问用户：“Proenga 文件夹在哪里？请告诉我完整位置，例如 D:\proenga。”。不要自己在整个磁盘里乱找，也不要猜。
- 找到的文件夹里没有 `update-proenga.ps1` 和 `update-proenga.sh`，说明是 2026 年 11 月 18 日以前装的老版本。先从 https://github.com/stevenzhangmb-design/proenga 下载最新版的 `update-proenga.ps1`（macOS / Linux 下载 `update-proenga.sh`）放到这个文件夹的根目录，再往下做。下载地址是 `https://raw.githubusercontent.com/stevenzhangmb-design/proenga/main/update-proenga.ps1`（或把最后的文件名换成 `update-proenga.sh`）。

## 2. 运行脚本

在 Proenga 文件夹里运行（不在里面时用完整路径），不需要管理员权限：

| 系统 | 只检查有没有新版 | 更新到最新版 |
|---|---|---|
| Windows | `powershell -ExecutionPolicy Bypass -File .\update-proenga.ps1 -Check` | `powershell -ExecutionPolicy Bypass -File .\update-proenga.ps1` |
| macOS / Linux | `bash update-proenga.sh -Check` | `bash update-proenga.sh` |

- 用户说“检查”“有没有新版”“是不是最新版”，加 `-Check`；说“更新”“升级”，不加。
- 更新要下载、要把整个文件夹备份一份，可能要几分钟。命令超时至少设 10 分钟，不要中途打断。
- 更新时不用手动停同步服务，脚本会自己先停、更新完再启动。

## 3. 按退出码转述结果

| 退出码 | 意思 | 怎么跟用户说 |
|---|---|---|
| 0 | 更新成功，或者已经是最新版 | 用白话说清：从哪个版本更新到哪个版本、更新了什么、备份放在哪里、同步服务是否正常、下一步要不要重开 AI 工具。已是最新版就直接说已是最新版。 |
| 1 | 没更新成功 | 转述脚本给的原因，比如网络不通、下载不完整。告诉用户现有文件没被改动，或者已经自动用备份还原。 |
| 2 | 需要用户先处理 | 一般是用 git 下载的文件夹里改过工具包文件。把脚本列出的文件和提示原样转述，问用户这些改动是撤销还是保留，等用户说了再处理。 |

- 不要只说“更新好了”，要把上面几项都说到。
- 退出码 2 时，不许自己运行 `git stash`、`git reset`、`git checkout`，也不许强行覆盖文件。
- 退出码 1 时，不要自己手动下载 ZIP 覆盖文件夹，也不要删除备份文件夹。
- 输出里提到 `.claude/settings.json.new`、`README.md.new` 等 `.new` 文件，说明用户改过原文件，新版另存了一份。问过用户后，帮他把新版里的内容合并进原文件。
- 做过全局安装的（`~/.agents/skills`、`~/.claude/skills`），脚本会一起换成新版。更新完提醒用户重开 AI 工具；OpenClaw 新开一个会话。

## 4. 只需要停止同步服务时

更新不用手动停。别的情况要停同步服务（anno-server）时，要先停守护进程，再停 node，最后确认端口已释放。只结束 node 不行：Windows 的 `start-anno-server.vbs` 会在 3 秒后把它重新拉起，`start-anno-server.js` 不到 1 秒就会拉起。只停这个 Proenga 文件夹里的进程，别的文件夹的同步服务不要动。

**Windows**（在 Proenga 文件夹里运行 PowerShell）：

```powershell
$dir = (Join-Path (Get-Location).ProviderPath 'anno-server\').ToLower()
$all = @(Get-CimInstance Win32_Process)
$svc = @($all | Where-Object { $_.CommandLine -and $_.CommandLine.ToLower().Replace('/','\').Contains($dir) })
# 守护进程：wscript（start-anno-server.vbs）或 node（start-anno-server.js）；用相对路径启动的从子进程往上找
$guard = @($all | Where-Object { (($svc.ProcessId -contains $_.ProcessId) -or ($svc.ParentProcessId -contains $_.ProcessId)) -and $_.CommandLine -match 'start-anno-server' })
$guard | ForEach-Object { Stop-Process -Id $_.ProcessId -Force }                     # 1. 先停守护进程
$svc | Where-Object { $guard.ProcessId -notcontains $_.ProcessId } | ForEach-Object { Stop-Process -Id $_.ProcessId -Force -ErrorAction SilentlyContinue }   # 2. 再停 node
Start-Sleep 2; try { Invoke-WebRequest http://localhost:3799/anno-queue -TimeoutSec 2 -UseBasicParsing | Out-Null; '还在运行' } catch { '已停止，端口已释放' }   # 3. 确认
```

**macOS / Linux**（在 Proenga 文件夹里运行）：

```bash
d="$(pwd -P)/anno-server/"; pkill -f "${d}start-anno-server.js"; sleep 1; pkill -f "${d}server.js"; sleep 1; curl -s http://localhost:3799/anno-queue >/dev/null && echo 还在运行 || echo 已停止
```

要恢复时用隐藏启动器重新启动：Windows 运行 `wscript "anno-server\start-anno-server.vbs"`，macOS / Linux 运行 `nohup node "anno-server/start-anno-server.js" >/dev/null 2>&1 &`，再确认 `http://localhost:3799/anno-queue` 能打开。
