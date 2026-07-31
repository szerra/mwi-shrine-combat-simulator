import fs from 'node:fs';
import path from 'node:path';
import process from 'node:process';
import { fileURLToPath } from 'node:url';

const scriptDirectory = path.dirname(fileURLToPath(import.meta.url));
const repositoryRoot = path.dirname(scriptDirectory);
const targetPath = path.join(repositoryRoot, 'MWITools-Shrine-Simulator.user.js');
const sourceArgument = process.argv[2];

if (!sourceArgument) {
  throw new Error('Usage: node scripts/embed-avatar-library.mjs <avatar-library.user.js>');
}

const sourcePath = path.resolve(process.cwd(), sourceArgument);
const source = fs.readFileSync(sourcePath, 'utf8');
const target = fs.readFileSync(targetPath, 'utf8');
const beginMarker = '    // BEGIN EMBEDDED MWI AVATAR LIBRARY';
const endMarker = '    // END EMBEDDED MWI AVATAR LIBRARY';
const bodyStart = source.indexOf('(() => {');
const bodyEnd = source.lastIndexOf('})();');

if (bodyStart < 0 || bodyEnd < bodyStart) {
  throw new Error(`Could not find the userscript body in ${sourcePath}`);
}

let body = source.slice(bodyStart, bodyEnd + '})();'.length);
const standaloneFlag = 'const INTEGRATED_IN_MWITOOLS = false;';
if (!body.includes(standaloneFlag)) {
  throw new Error(`Could not find ${standaloneFlag} in ${sourcePath}`);
}
body = body.replace(standaloneFlag, 'const INTEGRATED_IN_MWITOOLS = true;');

const markerStart = target.indexOf(beginMarker);
const markerEnd = target.indexOf(endMarker);
if (markerStart < 0 || markerEnd < markerStart) {
  throw new Error(`Could not find avatar library markers in ${targetPath}`);
}

const newline = target.includes('\r\n') ? '\r\n' : '\n';
const indentedBody = body
  .replace(/\r?\n/g, '\n')
  .split('\n')
  .map((line) => (line ? `    ${line}` : ''))
  .join(newline);
const replacement = `${beginMarker}${newline}${indentedBody}${newline}${endMarker}`;
const nextTarget = `${target.slice(0, markerStart)}${replacement}${target.slice(markerEnd + endMarker.length)}`;

fs.writeFileSync(targetPath, nextTarget, 'utf8');
console.log(`Embedded ${sourcePath} into ${targetPath}`);
