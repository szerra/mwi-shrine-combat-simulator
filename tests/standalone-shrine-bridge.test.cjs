const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");

const root = path.resolve(__dirname, "..");
const scriptPath = path.join(root, "MWI-Shrine-Simulator-Bridge.user.js");
const source = fs.readFileSync(scriptPath, "utf8");

assert.match(source, /@version\s+1\.0\.0/);
assert.match(source, /characterGuildBuffLevelMap/);
assert.doesNotMatch(source, /mwi-guild-data-bridge:/);
assert.doesNotMatch(source, /script\.google\.com/);
assert.doesNotMatch(source, /MWI_INTEGRATED/);

const storage = new Map();
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
};
const context = {
  console,
  window: pageWindow,
  unsafeWindow: pageWindow,
  MessageEvent: FakeMessageEvent,
  navigator: { language: "zh-TW" },
  location: { hostname: "www.milkywayidle.com" },
  document: {},
  setInterval,
  clearInterval,
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
