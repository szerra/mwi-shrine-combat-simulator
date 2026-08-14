import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const here = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(here, "..");
const upstreamPath = process.argv[2];
if (!upstreamPath) {
  throw new Error(
    "用法：node scripts/build-standalone-shrine-bridge.mjs <MWITools src/features/external-tools.js>",
  );
}

const upstream = fs.readFileSync(path.resolve(upstreamPath), "utf8");
const startMarker = "const LIVE_IMPORT_GUILD_KEYS";
const endMarker = "async function observeResultsForAmvoidguy";
const start = upstream.indexOf(startMarker);
const end = upstream.indexOf(endMarker);
if (start < 0 || end <= start) {
  throw new Error("找不到 MWITools 模擬器匯入程式區段");
}

let importer = upstream.slice(start, end).trim();
const shrinePatch = fs.readFileSync(
  path.join(here, "shrine-profile-importer-patch.js.txt"),
  "utf8",
).trim();
const shrineStart = importer.indexOf("function findGuildBuffLevel(source, key) {");
const shrineEnd = importer.indexOf("\n\nfunction getStoredBattleForRoster", shrineStart);
if (shrineStart < 0 || shrineEnd <= shrineStart) {
  throw new Error("找不到 MWITools 神龕匯入函式，無法套用隊友個別神龕支援");
}
importer = `${importer.slice(0, shrineStart)}${shrinePatch}${importer.slice(shrineEnd)}`;
importer = importer
  .replace(
    "playerObj.guildCombatBuffLevels = extractGuildCombatBuffLevels(characterObj);",
    "applyGuildCombatBuffLevels(playerObj, characterObj);",
  )
  .replace(
    `playerObj.guildCombatBuffLevels = extractGuildCombatBuffLevels(
    profile.profile,
  );`,
    `// Each teammate must use only that teammate's profile_shared shrine map.
  // Missing profile shrine data stays at zero and is marked; never borrow the
  // current character's or another party member's values.
  applyGuildCombatBuffLevels(playerObj, profile.profile);`,
  );
const storageKeys = [
  "init_character_data_saved_at",
  "init_character_data_character_id",
  "init_client_data",
  "init_character_data",
  "new_battle_saved_at",
  "new_battle",
  "profile_export_list",
];
for (const key of storageKeys) {
  importer = importer.replaceAll(
    `"${key}"`,
    `"mwiShrineBridge_${key}"`,
  );
}
importer = importer
  .replaceAll("buttonMWIToolsLiveImport", "buttonMWIShrineBridgeImport")
  .replaceAll("[MWITools]", "[MWI 神龕橋接器]")
  .replaceAll("MWITools 即時匯入失敗", "MWI 神龕橋接器匯入失敗")
  .replaceAll("MWITools live import failed", "MWI Shrine Bridge import failed")
  .replaceAll("已点击战斗模拟器导入按钮。", "已點擊戰鬥模擬器匯入按鈕。")
  .replaceAll("正在刷新战斗模拟器价格。", "正在重新整理戰鬥模擬器價格。");

const metadata = `// ==UserScript==
// @name         MWI 神龕模擬器橋接器
// @namespace    https://github.com/szerra/mwi-shrine-combat-simulator
// @version      1.0.3
// @description  在遊戲內開啟神龕模擬器，並獨立擷取角色、隊伍、裝備、技能與神龕等級；不依賴 MWITools 或公會資料插件。
// @author       Szerra adaptation; importer based on MWITools by bot7420, shykai, Stella
// @license      CC-BY-NC-SA-4.0
// @icon         https://www.milkywayidle.com/favicon.svg
// @homepageURL  https://szerra.github.io/mwi-shrine-combat-simulator/
// @supportURL   https://github.com/szerra/mwi-shrine-combat-simulator/issues
// @updateURL    https://szerra.github.io/mwi-shrine-combat-simulator/MWI-Shrine-Simulator-Bridge.user.js
// @downloadURL  https://szerra.github.io/mwi-shrine-combat-simulator/MWI-Shrine-Simulator-Bridge.user.js
// @match        https://www.milkywayidle.com/*
// @match        https://milkywayidle.com/*
// @match        https://test.milkywayidle.com/*
// @match        https://www.milkywayidlecn.com/*
// @match        https://milkywayidlecn.com/*
// @match        https://test.milkywayidlecn.com/*
// @match        https://szerra.github.io/mwi-shrine-combat-simulator/*
// @match        https://amvoidguy.github.io/MWICombatSimulatorTest/*
// @match        http://127.0.0.1/*
// @match        http://localhost/*
// @run-at       document-start
// @grant        GM_getValue
// @grant        GM_setValue
// @grant        GM_registerMenuCommand
// @grant        unsafeWindow
// @noframes
// ==/UserScript==`;

const runtimeSupport = `
(function () {
  "use strict";

  const VERSION = "1.0.3";
  const PREFIX = "mwiShrineBridge_";
  const SIMULATOR_URL = "https://szerra.github.io/mwi-shrine-combat-simulator/";
  const GAME_SOCKET_HOSTS = [
    "api.milkywayidle.com/ws",
    "api-test.milkywayidle.com/ws",
    "api.milkywayidlecn.com/ws",
    "api-test.milkywayidlecn.com/ws",
  ];
  const pageWindow = typeof unsafeWindow !== "undefined" ? unsafeWindow : window;
  const runtime = {
    config: {
      isZH: String(navigator.language || "").toLowerCase().startsWith("zh"),
      SCRIPT_COLOR_MAIN: "#2e9d8f",
    },
  };

${importer}

  function saveJson(key, value) {
    GM_setValue(PREFIX + key, JSON.stringify(value));
  }

  function readJson(key, fallback = null) {
    try {
      return JSON.parse(GM_getValue(PREFIX + key, "")) ?? fallback;
    } catch {
      return fallback;
    }
  }

  function loadCachedClientData() {
    try {
      const storage = pageWindow.localStorage;
      const storageUtil = pageWindow.localStorageUtil;
      if (
        !storage?.getItem?.("initClientData") ||
        typeof storageUtil?.getInitClientData !== "function"
      ) {
        return false;
      }
      const clientData = storageUtil.getInitClientData();
      if (!clientData?.actionDetailMap || !clientData?.itemDetailMap) {
        return false;
      }
      saveJson("init_client_data", clientData);
      return true;
    } catch (error) {
      console.warn(
        "[MWI 神龕橋接器 " + VERSION + "] 無法讀取遊戲共用資料快取",
        error,
      );
      return false;
    }
  }

  function installClientDataBootstrap() {
    if (loadCachedClientData()) return;
    if (typeof pageWindow.__mwiShrineBridgeClientDataTimerV1 !== "undefined") {
      return;
    }
    const timer = setInterval(() => {
      if (!loadCachedClientData()) return;
      clearInterval(timer);
      pageWindow.__mwiShrineBridgeClientDataTimerV1 = null;
    }, 250);
    pageWindow.__mwiShrineBridgeClientDataTimerV1 = timer;
  }

  function updateCharacter(mutator) {
    const current = readJson("init_character_data");
    if (!current || typeof current !== "object") return;
    mutator(current);
    saveJson("init_character_data", current);
    GM_setValue(PREFIX + "init_character_data_saved_at", Date.now());
  }

  function mergeByHrid(current, updates, keys) {
    if (!Array.isArray(updates)) return current;
    const result = Array.isArray(current) ? [...current] : [];
    for (const update of updates) {
      const identity = keys.map((key) => update?.[key]).find(Boolean);
      if (!identity) continue;
      const index = result.findIndex((item) =>
        keys.some((key) => item?.[key] && item[key] === identity),
      );
      if (index >= 0) result[index] = { ...result[index], ...update };
      else result.push(update);
    }
    return result;
  }

  function findGuildBuffMap(payload) {
    const preferredKeys = [
      "characterGuildBuffMap",
      "characterGuildBuffDict",
      "characterGuildBuffs",
      "characterGuildBuffLevelMap",
      "characterGuildBuffLevelDict",
    ];
    const fallbackKeys = [
      "guildBuffLevelMap",
      "guildBuffLevelDict",
      "guildBuffLevels",
      "guildBuffMap",
      "guildBuffDict",
    ];
    const queue = [{ value: payload, depth: 0 }];
    const visited = new Set();
    let fallback = null;
    while (queue.length && visited.size < 400) {
      const { value, depth } = queue.shift();
      if (!value || typeof value !== "object" || visited.has(value) || depth > 6) continue;
      visited.add(value);
      for (const key of preferredKeys) {
        if (value[key] && typeof value[key] === "object") return value[key];
      }
      for (const key of fallbackKeys) {
        if (!fallback && value[key] && typeof value[key] === "object") fallback = value[key];
      }
      for (const child of Object.values(value)) {
        if (child && typeof child === "object") queue.push({ value: child, depth: depth + 1 });
      }
    }
    return fallback;
  }

  function saveProfile(payload) {
    const profile = payload?.profile;
    const characterID = profile?.characterSkills?.[0]?.characterID;
    if (!profile || !characterID) return;
    const record = JSON.parse(JSON.stringify(payload));
    record.characterID = characterID;
    record.characterName = profile.sharableCharacter?.name || String(characterID);
    record.timestamp = Date.now();
    const profiles = (readJson("profile_export_list", []) || [])
      .filter((item) => String(item?.characterID) !== String(characterID));
    profiles.unshift(record);
    saveJson("profile_export_list", profiles.slice(0, 20));
  }

  function handleGamePayload(payload) {
    if (!payload?.type) return;
    switch (payload.type) {
      case "init_client_data":
        saveJson("init_client_data", payload);
        break;
      case "init_character_data":
        saveJson("init_character_data", payload);
        GM_setValue(PREFIX + "init_character_data_saved_at", Date.now());
        GM_setValue(PREFIX + "init_character_data_character_id", String(payload.character?.id || ""));
        GM_setValue(PREFIX + "new_battle", "");
        GM_setValue(PREFIX + "new_battle_saved_at", 0);
        break;
      case "new_battle":
        saveJson("new_battle", payload);
        GM_setValue(PREFIX + "new_battle_saved_at", Date.now());
        break;
      case "profile_shared":
        saveProfile(payload);
        break;
      case "items_updated":
        updateCharacter((character) => {
          const updates = payload.endCharacterItems || payload.characterItems;
          character.characterItems = mergeByHrid(
            character.characterItems,
            updates,
            ["id", "characterItemID", "hash"],
          );
        });
        break;
      case "skills_updated":
      case "action_completed":
        updateCharacter((character) => {
          const updates = payload.endCharacterSkills || payload.characterSkills;
          character.characterSkills = mergeByHrid(
            character.characterSkills,
            updates,
            ["skillHrid"],
          );
        });
        break;
      case "actions_updated":
        updateCharacter((character) => {
          if (Array.isArray(payload.characterActions)) {
            character.characterActions = payload.characterActions;
          }
          if (payload.partyInfo) character.partyInfo = payload.partyInfo;
        });
        break;
      case "house_rooms_updated":
        updateCharacter((character) => {
          if (payload.characterHouseRoomMap) {
            character.characterHouseRoomMap = payload.characterHouseRoomMap;
          }
        });
        break;
      case "abilities_updated":
      case "character_abilities_updated":
        updateCharacter((character) => {
          for (const key of [
            "characterAbilities",
            "abilityCombatTriggersMap",
            "consumableCombatTriggersMap",
            "combatUnit",
          ]) {
            if (payload[key] != null) character[key] = payload[key];
          }
        });
        break;
      case "guild_updated":
      case "guild_buffs_updated": {
        const levels = findGuildBuffMap(payload);
        if (levels) {
          updateCharacter((character) => {
            character.characterGuildBuffLevelMap = levels;
          });
        }
        break;
      }
    }
  }

  function handleSocketValue(value) {
    if (typeof value !== "string") return;
    try {
      handleGamePayload(JSON.parse(value));
    } catch {
      // 非 JSON 遊戲訊息不屬於橋接資料。
    }
  }

  function installSocketHook() {
    if (pageWindow.__mwiShrineBridgeSocketHookV1) return;
    const descriptor = Object.getOwnPropertyDescriptor(pageWindow.MessageEvent.prototype, "data");
    if (!descriptor?.get) {
      console.warn("[MWI 神龕橋接器 " + VERSION + "] 找不到 MessageEvent.data getter");
      return;
    }
    const previousGet = descriptor.get;
    const seen = new WeakSet();
    Object.defineProperty(pageWindow.MessageEvent.prototype, "data", {
      ...descriptor,
      get() {
        const value = previousGet.call(this);
        if (!seen.has(this)) {
          seen.add(this);
          const socket = this.currentTarget;
          const url = socket && typeof socket.url === "string" ? socket.url : "";
          if (GAME_SOCKET_HOSTS.some((host) => url.includes(host))) handleSocketValue(value);
        }
        return value;
      },
    });
    pageWindow.__mwiShrineBridgeSocketHookV1 = true;
  }

  function clearBridgeCache() {
    for (const key of [
      "init_client_data",
      "init_character_data",
      "init_character_data_saved_at",
      "init_character_data_character_id",
      "new_battle",
      "new_battle_saved_at",
      "profile_export_list",
    ]) {
      GM_setValue(PREFIX + key, key === "profile_export_list" ? "[]" : "");
    }
    console.info("[MWI 神龕橋接器] 已清除橋接器自己的快取；公會資料未變更。");
  }

  function openShrineSimulator() {
    if (typeof pageWindow.open === "function") {
      pageWindow.open(SIMULATOR_URL, "_blank");
    }
  }

  function ensureGameSimulatorEntry() {
    if (typeof document?.querySelector !== "function") return false;
    const container = document.querySelector(
      'div[class*="NavigationBar_minorNavigationLinks"]',
    );
    if (!container) return false;
    if (container.querySelector('[data-mwi-shrine-bridge-entry="true"]')) {
      return true;
    }

    const nativeLink = container.querySelector(
      'div[class*="NavigationBar_minorNavigationLink"]',
    );
    const link = document.createElement("div");
    link.className = nativeLink?.className || "NavigationBar_minorNavigationLink__31K7Y";
    link.setAttribute("data-mwi-shrine-bridge-entry", "true");
    link.setAttribute("role", "button");
    link.setAttribute("tabindex", "0");
    link.style.color = runtime.config.SCRIPT_COLOR_MAIN;
    link.style.cursor = "pointer";
    link.textContent = runtime.config.isZH
      ? "神龕戰鬥模擬器"
      : "Shrine Combat Simulator";
    link.addEventListener("click", openShrineSimulator);
    link.addEventListener("keydown", (event) => {
      if (event.key !== "Enter" && event.key !== " ") return;
      event.preventDefault();
      openShrineSimulator();
    });
    container.insertBefore(link, container.firstChild);
    return true;
  }

  function installGameSimulatorEntry() {
    ensureGameSimulatorEntry();
    if (typeof pageWindow.__mwiShrineBridgeEntryTimerV1 === "undefined") {
      pageWindow.__mwiShrineBridgeEntryTimerV1 = setInterval(
        ensureGameSimulatorEntry,
        500,
      );
    }
  }

  if (pageWindow.__MWI_SHRINE_BRIDGE_TEST__) {
    pageWindow.__mwiShrineBridgeTestAPI = {
      constructGroupExportObj,
      extractGuildCombatBuffLevels,
      inspectGuildCombatBuffLevels,
      handleGamePayload,
      findGuildBuffMap,
      ensureGameSimulatorEntry,
      loadCachedClientData,
    };
  }

  GM_registerMenuCommand(
    runtime.config.isZH ? "開啟神龕戰鬥模擬器" : "Open Shrine Combat Simulator",
    openShrineSimulator,
  );
  GM_registerMenuCommand("清除神龕模擬器橋接快取", clearBridgeCache);

  const host = location.hostname.toLowerCase();
  const isGame = host.includes("milkywayidle");
  if (isGame) {
    installClientDataBootstrap();
    installSocketHook();
    installGameSimulatorEntry();
    console.info("[MWI 神龕橋接器] " + VERSION + " 已開始讀取遊戲資料");
  } else {
    addImportButtonForAmvoidguy();
  }
})();`;

const outputPath = path.join(root, "MWI-Shrine-Simulator-Bridge.user.js");
fs.writeFileSync(outputPath, `${metadata}\n${runtimeSupport}\n`, "utf8");
console.log(`已建立 ${path.relative(root, outputPath)}`);
