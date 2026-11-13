-- PRD Word 版式过滤器（make-doc.ps1、anno-server、docx-guard 共用；任何用户、任何文档结构都生效）
-- 1) 不许出现倾斜字体（2026-11-05 用户明令）：md 里的 *强调* / _强调_ 转 Word 时按正常字体输出
-- 2) 首行缩进 2 个字（2026-11-06 用户明令，按中文书写习惯）：
--    只缩进前面没有编号的正文段落；以“1、”“1.”“（1）”“①”“•”“一、”等编号开头的段落不缩进。
--    缩进由模板 prd-reference.docx 里的“First Line Indent”样式提供（首行缩进 2 字符），表格、标题、引用不受影响。
-- 3) 提示语颜色加深、字体加粗（2026-11-06 用户明令）：md 里统一写成 提示：“提示原文。”。
--    凡是“提示：”“显示：”“二次确认：”后面引号里的原文（含引号），以及 提示：以“X：”开头、……“A”或“B” 这类写法，
--    套用模板里的“Prompt Text”字符样式（深蓝 1F3864 加粗）；在红字段落里只加粗、保持红色。

function Emph(el)
  return el.content
end

local MARKS = { "①","②","③","④","⑤","⑥","⑦","⑧","⑨","⑩","⑪","⑫","⑬","⑭","⑮","⑯","⑰","⑱","⑲","⑳",
  "•","●","▪","■","◆","※","❌","✅","⚠","-","—" }
local CN_NUM = "[一二三四五六七八九十]+、"

local function numbered(s)
  s = s:gsub("^%s+", "")
  if s == "" then return true end
  if s:find("^%d") then return true end
  if s:find("^（%d") or s:find("^%(%d") then return true end
  if s:find("^（[一二三四五六七八九十]") then return true end
  if s:find("^" .. CN_NUM) then return true end
  for _, m in ipairs(MARKS) do if s:sub(1, #m) == m then return true end end
  return false
end

local function only_images(p)
  for _, x in ipairs(p.content) do
    if x.t ~= "Image" and x.t ~= "Space" and x.t ~= "SoftBreak" and x.t ~= "LineBreak" then return false end
  end
  return true
end

-- ── 提示语识别 ──
local OPEN, CLOSE = "“", "”"
local STARTS = { "提示：", "显示：", "二次确认：", "提示：以", "显示：以" }
local function ends_with(s, suf) return #s >= #suf and s:sub(-#suf) == suf end
local function can_start(ctx, after_prompt)
  for _, suf in ipairs(STARTS) do if ends_with(ctx, suf) then return true end end
  if after_prompt and (ctx == "或" or ctx == "或以") then return true end
  return false
end
local function prompt_span1(buf) return pandoc.Span(buf, pandoc.Attr("", {}, { ["custom-style"] = "Prompt Text" })) end
-- 提示原文里写给研发看的说明括号不是提示语（2026-11-06 用户指出）：以“（按”“（如”“（例如”开头的括号，
-- 例如“（按发票类型列张数，如 销售发票 · NF-e 55 1 张）”，不加深加粗；其余括号（如“（SEFAZ）”“（须在 24 小时内补开）”）属于提示原文，照常加样式。
local NOTE_STARTS = { "（按", "（例如", "（如 " }   -- “（如仅用于办公……）”这类界面原文的括号不算说明
local function prompt_span(buf)
  local out, cur, note_depth = {}, {}, 0
  local function flush_prompt() if #cur > 0 then table.insert(out, prompt_span1(cur)); cur = {} end end
  local function add_text(s, as_note)
    if s == "" then return end
    if as_note then table.insert(out, pandoc.Str(s)) else table.insert(cur, pandoc.Str(s)) end
  end
  for _, el in ipairs(buf) do
    if el.t ~= "Str" then
      if note_depth > 0 then table.insert(out, el) else table.insert(cur, el) end
    else
      local s, seg_start, pos = el.text, 1, 1
      while pos <= #s do
        local c = s:sub(pos, pos + 2)          -- 中文括号都是 3 字节
        if note_depth == 0 and c == "（" then
          local starts = false
          for _, ns in ipairs(NOTE_STARTS) do if s:sub(pos, pos + #ns - 1) == ns then starts = true end end
          if starts then add_text(s:sub(seg_start, pos - 1), false); flush_prompt(); note_depth = 1; seg_start = pos end
          pos = pos + 3
        elseif note_depth > 0 and c == "（" then note_depth = note_depth + 1; pos = pos + 3
        elseif note_depth > 0 and c == "）" then
          note_depth = note_depth - 1; pos = pos + 3
          if note_depth == 0 then add_text(s:sub(seg_start, pos - 1), true); seg_start = pos end
        else
          local b = s:byte(pos); pos = pos + ((b >= 240 and 4) or (b >= 224 and 3) or (b >= 192 and 2) or 1)
        end
      end
      add_text(s:sub(seg_start), note_depth > 0)
    end
  end
  flush_prompt()
  return pandoc.Span(out, pandoc.Attr())   -- 外层普通 Span 只做容器
end

local function style_prompts(inls)
  local out, buf = {}, nil
  local ctx, depth, after_prompt = "", 0, false
  local function emit_text(s) if s ~= "" then table.insert(out, pandoc.Str(s)); ctx = ctx .. s end end
  local function handle_str(s)
    local i = 1
    while i <= #s do
      if buf then
        local j = i
        local closed_at = nil
        for p, c in utf8.codes(s:sub(i)) do
          local ch = utf8.char(c)
          if ch == OPEN then depth = depth + 1 elseif ch == CLOSE then depth = depth - 1; if depth == 0 then closed_at = i + p - 1 + #CLOSE - 1; break end end
        end
        if closed_at then
          table.insert(buf, pandoc.Str(s:sub(i, closed_at)))
          table.insert(out, prompt_span(buf)); buf = nil; ctx = ""; after_prompt = true
          i = closed_at + 1
        else
          table.insert(buf, pandoc.Str(s:sub(i))); return
        end
      else
        local q = s:find(OPEN, i, true)
        if not q then emit_text(s:sub(i)); return end
        local before = s:sub(i, q - 1)
        if can_start(ctx .. before, after_prompt) then
          emit_text(before); buf = {}; depth = 0; i = q
        else
          emit_text(s:sub(i, q + #OPEN - 1)); i = q + #OPEN; after_prompt = false
        end
      end
    end
  end
  for _, el in ipairs(inls) do
    if el.t == "Str" then handle_str(el.text)
    elseif buf then table.insert(buf, el)
    else
      table.insert(out, el)
      if el.t == "Space" then ctx = ctx .. " " else ctx = ""; after_prompt = false end
    end
  end
  if buf then for _, x in ipairs(buf) do table.insert(out, x) end end   -- 引号没闭合：原样输出，不加样式
  return out
end

function Pandoc(doc)
  -- 提示语样式
  doc = doc:walk({ Inlines = function(inls) return style_prompts(inls) end })
  -- 红字里的提示语：保持红色，只加粗
  doc = doc:walk({ Span = function(sp)
    if sp.attributes["custom-style"] == "Red Text" or sp.attributes["custom-style"] == "Blue Text" then
      return sp:walk({ Span = function(x) if x.attributes["custom-style"] == "Prompt Text" then return pandoc.Strong(x.content) end end })
    end
  end })
  -- 首行缩进
  local out = {}
  for _, b in ipairs(doc.blocks) do
    if b.t == "Para" and not only_images(b) and not numbered(pandoc.utils.stringify(b)) then
      table.insert(out, pandoc.Div({ b }, pandoc.Attr("", {}, { ["custom-style"] = "First Line Indent" })))
    else
      table.insert(out, b)
    end
  end
  doc.blocks = out
  return doc
end
