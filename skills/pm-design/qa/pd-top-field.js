#!/usr/bin/env node
/* pd-top-field.js - read ONE top-level string field from a (possibly huge) project-data.json
 * without JSON.parse of the whole file.
 *
 * Why: rebuild-deliverable.ps1 used PowerShell ConvertFrom-Json on the full 53MB project-data just to
 * read "_deliverable" -> 6~20 s before anything was built (2026-11-13 measured). This helper does a
 * single byte scan that tracks string/escape state and nesting depth, so it only picks keys that are
 * truly at the top level (never a same-named key inside a nested object or inside a string value).
 * If the key occurs more than once at top level, the LAST one wins (same as JSON.parse).
 *
 * Usage:  node pd-top-field.js <project-data.json> <key>
 * Output: the value as a JSON string literal with all non-ASCII escaped (\uXXXX), so the caller can
 *         decode it safely regardless of console code page (PowerShell 5.1 = GBK by default).
 *         Prints "" when the key is missing or its value is not a string.
 * Exit:   0 = found string, 2 = missing / not a string, 1 = usage or read error.
 */
'use strict';
const fs = require('fs');
const [file, key] = process.argv.slice(2);
if (!file || !key) { process.stderr.write('usage: node pd-top-field.js <project-data.json> <key>\n'); process.exit(1); }

let buf;
try { buf = fs.readFileSync(file); } catch (e) { process.stderr.write('read failed: ' + e.message + '\n'); process.exit(1); }

const Q = 0x22, BS = 0x5c, LB = 0x7b, RB = 0x7d, LS = 0x5b, RS = 0x5d, COLON = 0x3a;
const isWs = c => c === 0x20 || c === 0x09 || c === 0x0a || c === 0x0d;
const n = buf.length;
let i = (n >= 3 && buf[0] === 0xef && buf[1] === 0xbb && buf[2] === 0xbf) ? 3 : 0; // skip BOM
let depth = 0;
let found;            // last top-level match: { s, e } = byte range of the value string literal (incl. quotes), or null if non-string
const keyLit = Buffer.from(JSON.stringify(key), 'utf8');

// scan to end of a string literal starting at buf[p] === '"'; returns index just after closing quote
function endOfString(p) {
  p++;
  while (p < n) {
    const c = buf[p];
    if (c === BS) { p += 2; continue; }
    if (c === Q) return p + 1;
    p++;
  }
  return n;
}

while (i < n) {
  const c = buf[i];
  if (c === Q) {
    const s = i, e = endOfString(i);
    // a string at depth 1 followed by ':' is a top-level key
    if (depth === 1) {
      let j = e; while (j < n && isWs(buf[j])) j++;
      if (buf[j] === COLON && (e - s) === keyLit.length && buf.compare(keyLit, 0, keyLit.length, s, e) === 0) {
        let k = j + 1; while (k < n && isWs(buf[k])) k++;
        if (buf[k] === Q) { const ve = endOfString(k); found = { s: k, e: ve }; i = ve; continue; }
        found = null; // present but not a string
        i = k; continue;
      }
    }
    i = e; continue;
  }
  if (c === LB || c === LS) depth++;
  else if (c === RB || c === RS) depth--;
  i++;
}

if (!found) { process.stdout.write('""\n'); process.exit(2); }
let val;
try { val = JSON.parse(buf.toString('utf8', found.s, found.e)); } catch (e) { process.stdout.write('""\n'); process.exit(2); }
const ascii = JSON.stringify(val).replace(/[\u007f-￿]/g, ch => '\\u' + ch.charCodeAt(0).toString(16).padStart(4, '0'));
process.stdout.write(ascii + '\n');
process.exit(0);
