const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");

const root = path.resolve(__dirname, "..");
const scriptPath = path.join(root, "MWI-Shrine-Simulator-Bridge.user.js");
const source = fs.readFileSync(scriptPath, "utf8");

assert.match(source, /@version\s+1\.0\.1/);
assert.match(source, /characterGuildBuffLevelMap/);
assert.match(source, /神龕戰鬥模擬器/);
assert.match(source, /https:\/\/szerra\.github\.io\/mwi-shrine-combat-simulator\//);
assert.doesNotMatch(source, /mwi-guild-data-bridge:/);
assert.doesNotMatch(source, /script\.google\.com/);
assert.doesNotMatch(source, /MWI_INTEGRATED/);

const storage = new Map();
const openedWindows = [];
const intervalCallbacks = [];

class FakeElement {
  constructor(tagName) {
    this.tagName = tagName;
    this.children = [];
    this.attributes = new Map();
    this.listeners = new Map();
    this.className = "";
    this.style = {};
    this.textContent = "";
  }

  get firstChild() {
    return this.children[0] || null;
  }

  setAttribute(name, value) {
    this.attributes.set(name, String(value));
  }

  getAttribute(name) {
    return this.attributes.get(name) || null;
  }

  addEventListener(type, listener) {
    this.listeners.set(type, listener);
  }

  insertBefore(child, before) {
    const index = before ? this.children.indexOf(before) : -1;
    if (index >= 0) this.children.splice(index, 0, child);
    else this.children.push(child);
  }

  querySelector(selector) {
    if (selector === '[data-mwi-shrine-bridge-entry="true"]') {
      return this.children.find(
        (child) => child.getAttribute("data-mwi-shrine-bridge-entry") === "true",
      ) || null;
    }
    if (selector.includes('NavigationBar_minorNavigationLink')) {
      return this.children.find(
        (child) => child.className.includes("NavigationBar_minorNavigationLink"),
      ) || null;
    }
    return null;
  }
}

function makeNavigation() {
  const navigation = new FakeElement("div");
  const nativeLink = new FakeElement("div");
  nativeLink.className = "NavigationBar_minorNavigationLink__native";
  nativeLink.textContent = "原生連結";
  navigation.children.push(nativeLink);
  return navigation;
}

let currentNavigation = makeNavigation();
class FakeMessageEvent {}
Object.defineProperty(FakeMessageEvent.prototype, "data", {
  configurable: true,
  get() {
    return this._data;
  },
});
const pageWindow = {
  __MWI_SHRINE_BRIDGE_TEST__: true,
  MessageEvent: FakeMessageEvent,
  open: (url, target) => openedWindows.push([url, target]),
};
const context = {
  console,
  window: pageWindow,
  unsafeWindow: pageWindow,
  MessageEvent: FakeMessageEvent,
  navigator: { language: "zh-TW" },
  location: { hostname: "www.milkywayidle.com" },
  document: {
    querySelector: (selector) => selector.includes("NavigationBar_minorNavigationLinks")
      ? currentNavigation
      : null,
    createElement: (tagName) => new FakeElement(tagName),
  },
  setInterval: (callback, delay) => {
    intervalCallbacks.push({ callback, delay });
    return intervalCallbacks.length;
  },
  clearInterval: () => {},
  setTimeout,
  Event,
  WeakSet,
  GM_getValue: (key, fallback) => storage.has(key) ? storage.get(key) : fallback,
  GM_setValue: (key, value) => storage.set(key, value),
  GM_registerMenuCommand: () => {},
};
vm.createContext(context);
vm.runInContext(source, context, { filename: scriptPath });

const api = pageWindow.__mwiShrineBridgeTestAPI;
assert.ok(api, "應公開測試介面");

const entrySelector = '[data-mwi-shrine-bridge-entry="true"]';
let gameEntry = currentNavigation.querySelector(entrySelector);
assert.ok(gameEntry, "應在遊戲左側導覽列加入神龕模擬器入口");
assert.equal(gameEntry.className, "NavigationBar_minorNavigationLink__native");
assert.equal(gameEntry.textContent, "神龕戰鬥模擬器");
assert.equal(gameEntry.style.color, "#2e9d8f");
assert.equal(gameEntry, currentNavigation.firstChild, "入口應排在次要連結區最前面");
const entryCount = currentNavigation.children.length;
api.ensureGameSimulatorEntry();
assert.equal(currentNavigation.children.length, entryCount, "重複檢查不得加入第二個入口");
gameEntry.listeners.get("click")();
assert.deepEqual(openedWindows.pop(), [
  "https://szerra.github.io/mwi-shrine-combat-simulator/",
  "_blank",
]);
assert.equal(intervalCallbacks.length, 1);
assert.equal(intervalCallbacks[0].delay, 500);
currentNavigation = makeNavigation();
intervalCallbacks[0].callback();
gameEntry = currentNavigation.querySelector(entrySelector);
assert.ok(gameEntry, "遊戲重新繪製導覽列後應自動補回入口");

const levels = api.extractGuildCombatBuffLevels({
  characterGuildBuffLevelMap: {
    "/guild_buffs/force_combat": { level: 7 },
    "/guild_buffs/tempo_combat": 6,
    "/guild_buffs/spirit_combat": { currentLevel: 5 },
    "/guild_buffs/rarity_combat": { guildBuffLevel: 4 },
    "/guild_buffs/scholar_combat": 3,
  },
});
assert.deepEqual(
  JSON.parse(JSON.stringify(levels)),
  { force: 7, tempo: 6, spirit: 5, rarity: 4, scholar: 3 },
);

api.handleGamePayload({
  type: "init_client_data",
  actionDetailMap: {
    "/actions/combat/fly": { combatZoneInfo: { isDungeon: false } },
  },
  abilityDetailMap: {},
});
api.handleGamePayload({
  type: "init_character_data",
  character: { id: "233068", name: "SZERRA" },
  characterSkills: [
    { skillHrid: "/skills/stamina", level: 100 },
    { skillHrid: "/skills/intelligence", level: 100 },
    { skillHrid: "/skills/attack", level: 100 },
    { skillHrid: "/skills/melee", level: 100 },
    { skillHrid: "/skills/defense", level: 100 },
    { skillHrid: "/skills/ranged", level: 100 },
    { skillHrid: "/skills/magic", level: 100 },
  ],
  characterItems: [],
  actionTypeFoodSlotsMap: { "/action_types/combat": [null, null, null] },
  actionTypeDrinkSlotsMap: { "/action_types/combat": [null, null, null] },
  combatUnit: { combatAbilities: [] },
  abilityCombatTriggersMap: {},
  consumableCombatTriggersMap: {},
  characterHouseRoomMap: {},
  characterAchievements: {},
  characterActions: [{ actionHrid: "/actions/combat/fly", difficultyTier: 0 }],
  characterGuildBuffLevelMap: {
    "/guild_buffs/force_combat": { level: 2 },
  },
});
api.handleGamePayload({
  type: "guild_updated",
  nested: {
    characterGuildBuffLevelMap: {
      "/guild_buffs/force_combat": { level: 9 },
    },
  },
});
const saved = JSON.parse(storage.get("mwiShrineBridge_init_character_data"));
assert.equal(saved.characterGuildBuffLevelMap["/guild_buffs/force_combat"].level, 9);
assert.equal(storage.has("mwi-guild-data-bridge:api-url"), false);

const [exportObj, playerNames, importedPositions] = api.constructGroupExportObj();
const selfExport = JSON.parse(exportObj[1]);
assert.equal(playerNames[0], "SZERRA");
assert.equal(importedPositions[0], true);
assert.equal(selfExport.guildCombatBuffLevels.force, 9);

saved.partyInfo = {
  party: { actionHrid: "/actions/combat/fly", difficultyTier: 0 },
  partySlotMap: {
    1: { characterID: "233068" },
    2: { characterID: "teammate-1" },
  },
};
storage.set("mwiShrineBridge_init_character_data", JSON.stringify(saved));
storage.set("mwiShrineBridge_profile_export_list", JSON.stringify([{
  characterID: "teammate-1",
  characterName: "TEAMMATE",
  profile: {
    characterSkills: [
      { characterID: "teammate-1", skillHrid: "/skills/stamina", level: 90 },
      { characterID: "teammate-1", skillHrid: "/skills/intelligence", level: 90 },
      { characterID: "teammate-1", skillHrid: "/skills/attack", level: 90 },
      { characterID: "teammate-1", skillHrid: "/skills/melee", level: 90 },
      { characterID: "teammate-1", skillHrid: "/skills/defense", level: 90 },
      { characterID: "teammate-1", skillHrid: "/skills/ranged", level: 90 },
      { characterID: "teammate-1", skillHrid: "/skills/magic", level: 90 },
    ],
    sharableCharacter: { name: "TEAMMATE" },
    wearableItemMap: {},
    equippedAbilities: [],
    abilityCombatTriggersMap: {},
    consumableCombatTriggersMap: {},
    characterHouseRoomMap: {},
    characterAchievements: {},
    characterGuildBuffLevelMap: {
      "/guild_buffs/force_combat": { level: 4 },
    },
  },
}]));
const [partyExports, partyNames, partyPositions] = api.constructGroupExportObj();
assert.equal(partyNames[1], "TEAMMATE");
assert.equal(partyPositions[1], true);
assert.equal(JSON.parse(partyExports[2]).guildCombatBuffLevels.force, 4);

console.log("standalone shrine bridge checks passed");
