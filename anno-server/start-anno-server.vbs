' ============================================================
'  anno-server hidden background launcher
'  - Runs anno-server silently (no visible console window)
'  - Auto-restarts if it crashes / is killed (keeps PRD sync alive)
'  - Guards against double-start (exits if port 3799 already up)
'  Usage: wscript "start-anno-server.vbs"   (AI auto-start / logon / double-click)
'  Deps : Windows built-in wscript + installed node. Zero extra deps.
' ============================================================
Option Explicit
Dim sh, fso, dir
Set sh  = CreateObject("WScript.Shell")
Set fso = CreateObject("Scripting.FileSystemObject")
dir = fso.GetParentFolderName(WScript.ScriptFullName)
sh.CurrentDirectory = dir

' Already running (port 3799 answers) -> quit, avoid a second instance
If PortBusy() Then WScript.Quit

Do
  ' 0 = hidden window, True = wait until node exits (crash / killed)
  sh.Run "cmd /c node """ & dir & "\server.js""", 0, True
  WScript.Sleep 3000                 ' wait 3s then relaunch, keep sync unbroken
  If PortBusy() Then WScript.Quit    ' another instance took over -> don't fight it
Loop

Function PortBusy()
  Dim http
  PortBusy = False
  On Error Resume Next
  Set http = CreateObject("MSXML2.XMLHTTP")
  http.Open "GET", "http://localhost:3799/anno-queue", False
  http.Send
  If Err.Number = 0 And http.status = 200 Then PortBusy = True
  On Error GoTo 0
End Function
