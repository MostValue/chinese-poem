#!/usr/bin/env node
// Parses CC-CEDICT into a compact JSON dictionary for the app

const { readFileSync, writeFileSync } = require('fs');

const raw = readFileSync('/tmp/cedict_ts.u8', 'utf-8');
const dict = {};

for (const line of raw.split('\n')) {
  if (line.startsWith('#') || !line.trim()) continue;
  const match = line.match(/^(.+?)\s(.+?)\s\[([^\]]+)\]\s\/(.+)\/\s*$/);
  if (!match) continue;
  const [, traditional, simplified, pinyin, english] = match;
  const entry = [pinyin, english.replace(/\//g, '; ')];

  if (!dict[simplified]) dict[simplified] = [];
  dict[simplified].push(entry);

  if (traditional !== simplified) {
    if (!dict[traditional]) dict[traditional] = [];
    dict[traditional].push(entry);
  }
}

const output = JSON.stringify(dict);
writeFileSync('public/data/cedict.json', output);
console.log(`Dictionary built: ${Object.keys(dict).length} entries, ${(output.length / 1024 / 1024).toFixed(1)}MB`);
