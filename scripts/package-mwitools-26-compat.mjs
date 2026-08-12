import fs from "node:fs";
import path from "node:path";
import process from "node:process";
import { fileURLToPath } from "node:url";
import OpenCC from "opencc-js";

const scriptDirectory = path.dirname(fileURLToPath(import.meta.url));
const repositoryRoot = path.dirname(scriptDirectory);
const targetPath = path.join(
  repositoryRoot,
  "MWITools-Shrine-Simulator.user.js",
);
const sourceArgument = process.argv[2];

if (!sourceArgument) {
  throw new Error(
    "Usage: node scripts/package-mwitools-26-compat.mjs <upstream-MWITools.js>",
  );
}

const sourcePath = path.resolve(process.cwd(), sourceArgument);
let source = fs.readFileSync(sourcePath, "utf8");
const previous = fs.readFileSync(targetPath, "utf8");
const convertToTaiwanTraditional = OpenCC.Converter({
  from: "cn",
  to: "twp",
});

function replaceOnce(text, search, replacement, label) {
  const first = text.indexOf(search);
  if (first < 0) throw new Error(`Could not find ${label}`);
  if (text.indexOf(search, first + search.length) >= 0) {
    throw new Error(`Found multiple ${label} values`);
  }
  return `${text.slice(0, first)}${replacement}${text.slice(first + search.length)}`;
}

function extractItemMap(text, label) {
  const declaration = text.includes("const ZHItemNames = {")
    ? "const ZHItemNames = {"
    : "var ZHItemNames = {";
  const start = text.indexOf(declaration);
  const mapEnd = text.indexOf("\n  };", start);
  const legacyEnd = text.indexOf("\n    };", start);
  const end = mapEnd >= 0 ? mapEnd : legacyEnd;
  if (start < 0 || end < 0) {
    throw new Error(`Could not find ZHItemNames in ${label}`);
  }
  const body = text.slice(start + declaration.length, end);
  const result = new Map();
  const pattern = /^\s*"((?:\\.|[^"])*)":\s*"((?:\\.|[^"])*)",?\s*$/gm;
  for (const match of body.matchAll(pattern)) {
    result.set(
      JSON.parse(`"${match[1]}"`),
      JSON.parse(`"${match[2]}"`),
    );
  }
  return result;
}

function extractAvatarBody(text) {
  const beginMarker = "// BEGIN EMBEDDED MWI AVATAR LIBRARY";
  const endMarker = "// END EMBEDDED MWI AVATAR LIBRARY";
  const markerStart = text.indexOf(beginMarker);
  const markerEnd = text.indexOf(endMarker, markerStart);
  if (markerStart < 0 || markerEnd < markerStart) {
    throw new Error("Could not find the embedded avatar library in the previous build");
  }
  const bodyStart = text.indexOf("(() => {", markerStart);
  const bodyEnd = text.lastIndexOf("})();", markerEnd);
  if (bodyStart < 0 || bodyEnd < bodyStart) {
    throw new Error("Could not isolate the embedded avatar library body");
  }
  return text.slice(bodyStart, bodyEnd + "})();".length);
}

source = replaceOnce(source, "// @name         MWITools", "// @name         MWITools 繁體中文相容版（神龕模擬器）", "userscript name");
source = replaceOnce(source, "// @version      26.4.5", "// @version      26.4.5-TW.28", "userscript version");
source = replaceOnce(source, "// @updateURL    https://update.greasyfork.org/scripts/494467/MWITools.meta.js", "// @updateURL    https://szerra.github.io/mwi-shrine-combat-simulator/MWITools-Shrine-Simulator.user.js", "update URL");
source = replaceOnce(source, "// @downloadURL  https://update.greasyfork.org/scripts/494467/MWITools.user.js", "// @downloadURL  https://szerra.github.io/mwi-shrine-combat-simulator/MWITools-Shrine-Simulator.user.js", "download URL");
source = replaceOnce(source, "// @description  Tools for MilkyWayIdle. Includes feedback, action projections, market insights, asset history, DPS/HPS statistics, inventory tools, tasks, and guild utilities.", "// @description  以官方 MWITools 26.4.5 為底的繁體中文相容版；保留 DPS/HPS/承傷、神龕模擬器即時匯入與自訂角色圖庫，並預設關閉和 Szerra 整合包重複的功能。", "description");
source = replaceOnce(source, "// @author       bot7420, shykai, Stella", "// @author       bot7420, shykai, Stella, Szerra compatibility build", "author");
source = replaceOnce(source, "// @match        https://mooneycalc.vercel.app/*", [
  "// @match        https://mooneycalc.vercel.app/*",
  "// @match        https://szerra.github.io/mwi-shrine-combat-simulator/*",
  "// @match        http://127.0.0.1:8765/*",
  "// @match        http://localhost:8765/*",
].join("\n"), "simulator matches");
source = replaceOnce(source, "// @grant        GM_setValue", "// @grant        GM_setValue\n// @grant        GM_registerMenuCommand", "menu grant");

const simplifiedNames = extractItemMap(source, sourcePath);
source = convertToTaiwanTraditional(source);
const convertedNames = extractItemMap(source, `${sourcePath} after OpenCC`);
const traditionalNames = extractItemMap(previous, targetPath);
if (simplifiedNames.size !== traditionalNames.size) {
  throw new Error(
    `Item dictionary size mismatch: ${simplifiedNames.size} vs ${traditionalNames.size}`,
  );
}
for (const [hrid, traditionalName] of traditionalNames) {
  const convertedName = convertedNames.get(hrid);
  if (convertedName == null) throw new Error(`Missing upstream item HRID ${hrid}`);
  source = replaceOnce(
    source,
    `${JSON.stringify(hrid)}: ${JSON.stringify(convertedName)}`,
    `${JSON.stringify(hrid)}: ${JSON.stringify(traditionalName)}`,
    `item translation ${hrid}`,
  );
}
const aliases = [...simplifiedNames].filter(
  ([hrid, simplifiedName]) => traditionalNames.get(hrid) !== simplifiedName,
);
const aliasBlock = [
  "// BEGIN GENERATED SIMPLIFIED ITEM NAME ALIASES",
  "// Traditional display names remain canonical; Simplified names are accepted for lookup.",
  "var ZHCNToItemHridMap = {",
  ...aliases.map(
    ([hrid, name]) => `    ${JSON.stringify(name)}: ${JSON.stringify(hrid)},`,
  ),
  "  };",
  "// END GENERATED SIMPLIFIED ITEM NAME ALIASES",
  "var ZHToItemHridMap = {",
  "    ...ZHCNToItemHridMap,",
  "    ...inverseKV(ZHItemNames)",
  "  };",
].join("\n  ");
source = replaceOnce(
  source,
  "var ZHToItemHridMap = inverseKV(ZHItemNames);",
  aliasBlock,
  "item reverse lookup",
);

const avatarBody = extractAvatarBody(previous);
const insertionPoint = source.indexOf("  // src/data/translations.js");
if (insertionPoint < 0) throw new Error("Could not find the avatar insertion point");
const avatarBlock = [
  "  // BEGIN EMBEDDED MWI AVATAR LIBRARY",
  avatarBody
    .split(/\r?\n/)
    .map((line) => `  ${line}`)
    .join("\n"),
  "  // END EMBEDDED MWI AVATAR LIBRARY",
  "",
].join("\n");
source = `${source.slice(0, insertionPoint)}${avatarBlock}${source.slice(insertionPoint)}`;
source = source
  .split("\n")
  .map((line) => line.trimEnd())
  .join("\n");

fs.writeFileSync(targetPath, source, "utf8");
console.log(
  `Packaged ${sourcePath} into ${targetPath} with ${aliases.length} Simplified aliases and the embedded avatar library.`,
);
