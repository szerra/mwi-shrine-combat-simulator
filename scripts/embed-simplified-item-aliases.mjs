import fs from 'node:fs';
import path from 'node:path';
import process from 'node:process';
import { fileURLToPath } from 'node:url';

const scriptDirectory = path.dirname(fileURLToPath(import.meta.url));
const repositoryRoot = path.dirname(scriptDirectory);
const targetPath = path.join(repositoryRoot, 'MWITools-Shrine-Simulator.user.js');
const sourceArgument = process.argv[2];

if (!sourceArgument) {
  throw new Error('Usage: node scripts/embed-simplified-item-aliases.mjs <upstream-MWITools.user.js>');
}

const sourcePath = path.resolve(process.cwd(), sourceArgument);
const source = fs.readFileSync(sourcePath, 'utf8');
const target = fs.readFileSync(targetPath, 'utf8');

function decodeStringLiteral(value, label) {
  try {
    return JSON.parse(`"${value}"`);
  } catch (error) {
    throw new Error(`Could not decode ${label}: ${error.message}`);
  }
}

function extractZhItemNames(text, label) {
  const objectMatch = text.match(/const ZHItemNames = \{([\s\S]*?)\r?\n    \};/);
  if (!objectMatch) {
    throw new Error(`Could not find ZHItemNames in ${label}`);
  }

  const result = new Map();
  const entryPattern = /^\s*"((?:\\.|[^"])*)":\s*"((?:\\.|[^"])*)",?\s*$/gm;
  for (const match of objectMatch[1].matchAll(entryPattern)) {
    const hrid = decodeStringLiteral(match[1], `${label} item HRID`);
    const name = decodeStringLiteral(match[2], `${label} item name`);
    result.set(hrid, name);
  }

  if (result.size < 900) {
    throw new Error(`Expected at least 900 item names in ${label}, found ${result.size}`);
  }
  return result;
}

const simplifiedNames = extractZhItemNames(source, sourcePath);
const traditionalNames = extractZhItemNames(target, targetPath);
const traditionalNameToHrid = new Map([...traditionalNames].map(([hrid, name]) => [name, hrid]));
const aliases = new Map();

for (const [hrid, simplifiedName] of simplifiedNames) {
  if (traditionalNameToHrid.get(simplifiedName) === hrid) continue;
  const existingHrid = aliases.get(simplifiedName);
  if (existingHrid && existingHrid !== hrid) {
    throw new Error(`Simplified item name collision: ${simplifiedName}`);
  }
  aliases.set(simplifiedName, hrid);
}

const newline = target.includes('\r\n') ? '\r\n' : '\n';
const beginMarker = '    // BEGIN GENERATED SIMPLIFIED ITEM NAME ALIASES';
const endMarker = '    // END GENERATED SIMPLIFIED ITEM NAME ALIASES';
const aliasLines = [...aliases].map(
  ([name, hrid]) => `        ${JSON.stringify(name)}: ${JSON.stringify(hrid)},`
);
const aliasBlock = [
  beginMarker,
  '    // Generated from the upstream Simplified Chinese dictionary. Keep the',
  '    // Traditional display dictionary above and accept both forms for lookup.',
  '    const ZH_CN_TO_ITEM_HRID_ALIASES = {',
  ...aliasLines,
  '    };',
  endMarker,
].join(newline);

let nextTarget = target;
const markerStart = nextTarget.indexOf(beginMarker);
const markerEnd = nextTarget.indexOf(endMarker);
if (markerStart >= 0 && markerEnd > markerStart) {
  nextTarget = `${nextTarget.slice(0, markerStart)}${aliasBlock}${nextTarget.slice(markerEnd + endMarker.length)}`;
} else {
  const insertionPoint = nextTarget.indexOf('    const ZHToItemHridMap = inverseKV(ZHItemNames);');
  if (insertionPoint < 0) {
    throw new Error(`Could not find ZHToItemHridMap insertion point in ${targetPath}`);
  }
  nextTarget = `${nextTarget.slice(0, insertionPoint)}${aliasBlock}${newline}${newline}${nextTarget.slice(insertionPoint)}`;
}

const mapPattern = /    const ZHToItemHridMap = (?:inverseKV\(ZHItemNames\);|\{\r?\n        \.\.\.ZH_CN_TO_ITEM_HRID_ALIASES,\r?\n        \.\.\.inverseKV\(ZHItemNames\),\r?\n    \};)/;
const mapReplacement = [
  '    const ZHToItemHridMap = {',
  '        ...ZH_CN_TO_ITEM_HRID_ALIASES,',
  '        ...inverseKV(ZHItemNames),',
  '    };',
].join(newline);
if (!mapPattern.test(nextTarget)) {
  throw new Error(`Could not find ZHToItemHridMap assignment in ${targetPath}`);
}
nextTarget = nextTarget.replace(mapPattern, mapReplacement);

fs.writeFileSync(targetPath, nextTarget, 'utf8');
console.log(`Embedded ${aliases.size} Simplified Chinese item aliases into ${targetPath}`);
