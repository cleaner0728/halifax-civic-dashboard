// Scan recent JSONL transcripts for Bash + MCP tool calls,
// aggregate counts, output top patterns for permission allowlist.

import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';

const ROOT = 'C:/Users/lijia/.claude/projects';
const SCAN_LIMIT = 50;

// Recursively collect *.jsonl
function walk(dir) {
  const out = [];
  let entries;
  try { entries = readdirSync(dir, { withFileTypes: true }); } catch { return out; }
  for (const e of entries) {
    const full = join(dir, e.name);
    if (e.isDirectory()) out.push(...walk(full));
    else if (e.isFile() && e.name.endsWith('.jsonl')) out.push(full);
  }
  return out;
}

const all = walk(ROOT)
  .map((p) => ({ p, mtime: statSync(p).mtimeMs }))
  .sort((a, b) => b.mtime - a.mtime)
  .slice(0, SCAN_LIMIT)
  .map((x) => x.p);

const bashCounts = new Map();
const mcpCounts = new Map();
const bashFullCmds = new Map();

function bashKey(cmdRaw) {
  if (!cmdRaw || typeof cmdRaw !== 'string') return null;
  let cmd = cmdRaw.trim();
  while (/^[A-Za-z_][A-Za-z0-9_]*=\S+\s+/.test(cmd)) cmd = cmd.replace(/^[A-Za-z_][A-Za-z0-9_]*=\S+\s+/, '');
  cmd = cmd.replace(/^(sudo\s+(-[A-Za-z]+\s+)*)/, '');
  cmd = cmd.replace(/^timeout\s+\S+\s+/, '');
  cmd = cmd.replace(/^time\s+/, '');
  const first = cmd.split(/\s*(?:\|\||&&|;|\||>|<)\s*/)[0].trim();
  if (!first) return null;
  const tokens = first.split(/\s+/);
  const head = tokens[0];
  if (!head) return null;
  const subcmdLeaders = new Set([
    'git','gh','docker','kubectl','npm','pnpm','yarn','bun','cargo','go','jq',
    'apt','brew','pip','pip3','make','just','rustup','aws','az','gcloud','terraform',
    'helm','rg','psql','redis-cli','mongosh','mysql','node',
  ]);
  if (subcmdLeaders.has(head) && tokens[1] && !tokens[1].startsWith('-')) {
    return head + ' ' + tokens[1];
  }
  return head;
}

let nFiles = 0;
let nToolUses = 0;

for (const file of all) {
  nFiles++;
  let lines;
  try { lines = readFileSync(file, 'utf-8').split('\n'); } catch { continue; }
  for (const line of lines) {
    if (!line.trim()) continue;
    let obj;
    try { obj = JSON.parse(line); } catch { continue; }
    if (obj.type !== 'assistant') continue;
    const content = obj.message?.content;
    if (!Array.isArray(content)) continue;
    for (const block of content) {
      if (block.type !== 'tool_use') continue;
      nToolUses++;
      const name = block.name;
      if (name === 'Bash') {
        const cmd = block.input?.command;
        const k = bashKey(cmd);
        if (!k) continue;
        bashCounts.set(k, (bashCounts.get(k) ?? 0) + 1);
        if (!bashFullCmds.has(k)) bashFullCmds.set(k, new Set());
        if (bashFullCmds.get(k).size < 3) bashFullCmds.get(k).add(cmd.slice(0, 90));
      } else if (name && name.startsWith('mcp__')) {
        mcpCounts.set(name, (mcpCounts.get(name) ?? 0) + 1);
      }
    }
  }
}

console.log(`Scanned ${nFiles} files, ${nToolUses} tool_use blocks.\n`);

console.log('=== Bash command frequencies (top 40) ===');
const bashSorted = [...bashCounts.entries()].sort((a, b) => b[1] - a[1]).slice(0, 40);
for (const [k, n] of bashSorted) {
  const samples = [...(bashFullCmds.get(k) ?? new Set())].slice(0, 2);
  console.log(`  ${String(n).padStart(4)}  ${k.padEnd(28)} e.g. ${samples.join(' || ')}`);
}

console.log('\n=== MCP tool frequencies (top 30) ===');
const mcpSorted = [...mcpCounts.entries()].sort((a, b) => b[1] - a[1]).slice(0, 30);
for (const [k, n] of mcpSorted) {
  console.log(`  ${String(n).padStart(4)}  ${k}`);
}
