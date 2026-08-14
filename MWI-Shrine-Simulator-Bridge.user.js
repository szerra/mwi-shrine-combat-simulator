// ==UserScript==
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
// ==/UserScript==

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

const LIVE_IMPORT_GUILD_KEYS = [
  "force",
  "tempo",
  "spirit",
  "rarity",
  "scholar",
];

function formatLiveImportSavedAt(timestamp) {
  const numericTimestamp = Number(timestamp);
  if (!Number.isFinite(numericTimestamp) || numericTimestamp <= 0) return "";
  return new Date(numericTimestamp).toLocaleString(
    runtime.config.isZH ? "zh-TW" : undefined,
    {
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
      hour12: false,
    },
  );
}

function getPersistentImportStatus() {
  const characterSavedAt =
    Number(GM_getValue("mwiShrineBridge_init_character_data_saved_at", 0)) || 0;
  const battleSavedAt = Number(GM_getValue("mwiShrineBridge_new_battle_saved_at", 0)) || 0;
  let oldestPartyProfileSavedAt = 0;
  try {
    const characterObj = JSON.parse(GM_getValue("mwiShrineBridge_init_character_data", ""));
    const selfCharacterID = String(characterObj?.character?.id ?? "");
    const partyCharacterIDs = Object.values(
      characterObj?.partyInfo?.partySlotMap ?? {},
    )
      .map((member) => String(member?.characterID ?? ""))
      .filter((characterID) => characterID && characterID !== selfCharacterID);
    const storedProfileList = JSON.parse(
      GM_getValue("mwiShrineBridge_profile_export_list", "[]"),
    );
    const profileTimes = partyCharacterIDs
      .map((characterID) => {
        const profile = Array.isArray(storedProfileList)
          ? storedProfileList.find(
              (item) => String(item?.characterID ?? "") === characterID,
            )
          : null;
        return Number(profile?.timestamp) || 0;
      })
      .filter((timestamp) => timestamp > 0);
    if (profileTimes.length)
      oldestPartyProfileSavedAt = Math.min(...profileTimes);
  } catch {
    oldestPartyProfileSavedAt = 0;
  }
  return { characterSavedAt, oldestPartyProfileSavedAt, battleSavedAt };
}

function updatePersistentImportButton(button, prefix) {
  const status = getPersistentImportStatus();
  const characterTime = formatLiveImportSavedAt(status.characterSavedAt);
  const profileTime = formatLiveImportSavedAt(status.oldestPartyProfileSavedAt);
  const battleTime = formatLiveImportSavedAt(status.battleSavedAt);
  button.style.backgroundColor = runtime.config.SCRIPT_COLOR_MAIN;
  button.textContent = characterTime
    ? runtime.config.isZH
      ? `${prefix}｜角色 ${characterTime}`
      : `${prefix} | Character ${characterTime}`
    : prefix;
  button.title = runtime.config.isZH
    ? `資料不會自動過期。角色：${characterTime || "尚未載入"}；隊友最舊：${profileTime || "無隊友快取"}；戰鬥快照：${battleTime || "無"}。重新整理遊戲頁面才更新角色與隊伍；重新開啟隊友名片才更新該隊友。`
    : `Data does not expire automatically. Character: ${characterTime || "not loaded"}; oldest teammate: ${profileTime || "no teammate cache"}; battle snapshot: ${battleTime || "none"}. Refresh the game to update the character and party; reopen a teammate profile to update that teammate.`;
}

function readGuildBuffLevelValue(value) {
  const rawLevel =
    value && typeof value === "object"
      ? (value.level ?? value.currentLevel ?? value.guildBuffLevel)
      : value;
  const level = Number(rawLevel);
  return Number.isFinite(level)
    ? Math.max(0, Math.min(20, Math.floor(level)))
    : 0;
}

function findGuildBuffLevelEntry(source, key) {
  if (!source || typeof source !== "object") {
    return { found: false, level: 0 };
  }
  const expectedHrids = [
    `/guild_buffs/${key}_combat`,
    `/guild_buffs/combat_${key}`,
  ];
  if (Array.isArray(source)) {
    const exact = source.find((entry) =>
      expectedHrids.includes(entry?.guildBuffHrid ?? entry?.hrid),
    );
    if (exact) {
      return { found: true, level: readGuildBuffLevelValue(exact) };
    }
    const fuzzy = source.find((entry) => {
      const hrid = String(
        entry?.guildBuffHrid ?? entry?.hrid ?? "",
      ).toLowerCase();
      return (
        hrid.includes(key) &&
        (hrid.includes("combat") || hrid.includes("battle")) &&
        !hrid.includes("skilling")
      );
    });
    return fuzzy
      ? { found: true, level: readGuildBuffLevelValue(fuzzy) }
      : { found: false, level: 0 };
  }
  for (const hrid of expectedHrids) {
    if (Object.prototype.hasOwnProperty.call(source, hrid)) {
      return { found: true, level: readGuildBuffLevelValue(source[hrid]) };
    }
  }
  const fuzzyKey = Object.keys(source).find((hrid) => {
    const normalized = hrid.toLowerCase();
    return (
      normalized.includes(key) &&
      (normalized.includes("combat") || normalized.includes("battle")) &&
      !normalized.includes("skilling")
    );
  });
  return fuzzyKey
    ? { found: true, level: readGuildBuffLevelValue(source[fuzzyKey]) }
    : { found: false, level: 0 };
}

function inspectGuildCombatBuffLevels(source) {
  const candidates = [
    ["guildBuffLevelMap", source?.guildBuffLevelMap],
    ["characterGuildBuffLevelMap", source?.characterGuildBuffLevelMap],
    ["characterGuildBuffMap", source?.characterGuildBuffMap],
    ["characterGuildBuffDict", source?.characterGuildBuffDict],
    ["characterGuildBuffs", source?.characterGuildBuffs],
    ["characterGuildBuffLevelDict", source?.characterGuildBuffLevelDict],
    ["guildBuffLevelDict", source?.guildBuffLevelDict],
  ];
  const presentCandidates = candidates.filter(([property, candidate]) =>
    Object.prototype.hasOwnProperty.call(source ?? {}, property) &&
    candidate &&
    typeof candidate === "object",
  );
  const levels = {};
  let foundAnyLevel = false;
  for (const key of LIVE_IMPORT_GUILD_KEYS) {
    let match = { found: false, level: 0 };
    for (const [, candidate] of presentCandidates) {
      match = findGuildBuffLevelEntry(candidate, key);
      if (match.found) break;
    }
    levels[key] = match.level;
    foundAnyLevel ||= match.found;
  }
  return {
    levels,
    missing: presentCandidates.length === 0,
    source: presentCandidates[0]?.[0] ?? "missing",
    foundAnyLevel,
  };
}

function extractGuildCombatBuffLevels(source) {
  return inspectGuildCombatBuffLevels(source).levels;
}

function applyGuildCombatBuffLevels(playerObj, source) {
  const shrineData = inspectGuildCombatBuffLevels(source);
  playerObj.guildCombatBuffLevels = shrineData.levels;
  playerObj.guildCombatBuffLevelsMissing = shrineData.missing;
  playerObj.guildCombatBuffLevelsSource = shrineData.source;
}

function getStoredBattleForRoster(partyCharacterIDs) {
  if (!(Number(GM_getValue("mwiShrineBridge_new_battle_saved_at", 0)) > 0)) return null;
  try {
    const battleObj = JSON.parse(GM_getValue("mwiShrineBridge_new_battle", ""));
    const battleCharacterIDs = (battleObj?.players ?? [])
      .map((player) => String(player?.character?.id ?? ""))
      .filter(Boolean);
    const expected = new Set(partyCharacterIDs.map(String));
    if (
      battleCharacterIDs.length !== expected.size ||
      !battleCharacterIDs.every((id) => expected.has(id))
    ) {
      return null;
    }
    return battleObj;
  } catch {
    return null;
  }
}

/* 为 https://amvoidguy.github.io/MWICombatSimulatorTest/ 添加导入按钮 */
// Parts of code regarding group export are by Ratatatata (https://greasyfork.org/en/scripts/507255).
function addImportButtonForAmvoidguy() {
  const checkElem = () => {
    const selectedElement = document.querySelector(`button#buttonImportExport`);
    if (selectedElement) {
      clearInterval(timer);
      let button = document.createElement("button");
      selectedElement.parentNode.parentElement.parentElement.insertBefore(
        button,
        selectedElement.parentElement.parentElement.nextSibling,
      );
      button.id = "buttonMWIShrineBridgeImport";
      updatePersistentImportButton(
        button,
        runtime.config.isZH ? "單人/組隊匯入" : "Import solo/group",
      );
      button.style.padding = "5px";
      button.onclick = async function () {
        console.log(
          runtime.config.isZH
            ? "[MWI 神龕橋接器] 已點擊戰鬥模擬器匯入按鈕。"
            : "[MWI 神龕橋接器] Combat simulator import button clicked.",
        );
        const getPriceButton = document.querySelector(`button#buttonGetPrices`);
        if (getPriceButton) {
          console.log(
            runtime.config.isZH
              ? "[MWI 神龕橋接器] 正在重新整理戰鬥模擬器價格。"
              : "[MWI 神龕橋接器] Refreshing combat simulator prices.",
          );
          getPriceButton.click();
        }
        if (
          !GM_getValue("mwiShrineBridge_init_character_data", "") ||
          !GM_getValue("mwiShrineBridge_init_client_data", "")
        ) {
          button.textContent = runtime.config.isZH
            ? "請先重新整理遊戲頁面"
            : "Refresh the game page first";
          button.style.backgroundColor = "#b02a37";
          return false;
        }
        try {
          await importDataForAmvoidguy(button);
        } catch (error) {
          console.error(
            runtime.config.isZH
              ? "MWI 神龕橋接器匯入失敗"
              : "MWI Shrine Bridge import failed",
            error,
          );
          button.textContent = runtime.config.isZH
            ? "匯入失敗，請重新整理遊戲後再試"
            : "Import failed; refresh the game and retry";
          button.style.backgroundColor = "#b02a37";
        }
        return false;
      };
    }
  };
  let timer = setInterval(checkElem, 200);
}

async function importDataForAmvoidguy(button) {
  const [
    exportObj,
    playerIDs,
    importedPlayerPositions,
    zone,
    difficultyTier,
    isZoneDungeon,
    isParty,
  ] = constructGroupExportObj();
  console.log(exportObj);
  console.log(playerIDs);

  document.querySelector(`a#group-combat-tab`).click();
  const importInputElem = document.querySelector(
    `input#inputSetGroupCombatAll`,
  );
  importInputElem.value = JSON.stringify(exportObj);
  document.querySelector(`button#buttonImportSet`).click();

  document.querySelector(`a#player1-tab`).textContent = playerIDs[0];
  document.querySelector(`a#player2-tab`).textContent = playerIDs[1];
  document.querySelector(`a#player3-tab`).textContent = playerIDs[2];
  document.querySelector(`a#player4-tab`).textContent = playerIDs[3];
  document.querySelector(`a#player5-tab`).textContent = playerIDs[4];

  // Select zone or dungeon
  if (zone) {
    if (isZoneDungeon) {
      document.querySelector(`input#simDungeonToggle`).checked = true;
      document
        .querySelector(`input#simDungeonToggle`)
        .dispatchEvent(new Event("change"));
      const selectDungeon = document.querySelector(`select#selectDungeon`);
      for (let i = 0; i < selectDungeon.options.length; i++) {
        if (selectDungeon.options[i].value === zone) {
          selectDungeon.options[i].selected = true;
          break;
        }
      }
    } else {
      document.querySelector(`input#simDungeonToggle`).checked = false;
      document
        .querySelector(`input#simDungeonToggle`)
        .dispatchEvent(new Event("change"));
      const selectZone = document.querySelector(`select#selectZone`);
      for (let i = 0; i < selectZone.options.length; i++) {
        if (selectZone.options[i].value === zone) {
          selectZone.options[i].selected = true;
          break;
        }
      }
    }

    if (difficultyTier) {
      const selectDifficulty = document.querySelector(
        `select#selectDifficulty`,
      );
      for (let i = 0; i < selectDifficulty.options.length; i++) {
        if (Number(selectDifficulty.options[i].value) === difficultyTier) {
          selectDifficulty.options[i].selected = true;
          break;
        }
      }
    }
  }

  // Select sim players
  for (let i = 0; i < 5; i++) {
    if (importedPlayerPositions[i]) {
      if (
        document.querySelector(
          `input#player${i + 1}.form-check-input.player-checkbox`,
        )
      ) {
        document.querySelector(
          `input#player${i + 1}.form-check-input.player-checkbox`,
        ).checked = true;
        document
          .querySelector(
            `input#player${i + 1}.form-check-input.player-checkbox`,
          )
          .dispatchEvent(new Event("change"));
      }
    } else {
      if (
        document.querySelector(
          `input#player${i + 1}.form-check-input.player-checkbox`,
        )
      ) {
        document.querySelector(
          `input#player${i + 1}.form-check-input.player-checkbox`,
        ).checked = false;
        document
          .querySelector(
            `input#player${i + 1}.form-check-input.player-checkbox`,
          )
          .dispatchEvent(new Event("change"));
      }
    }
  }

  // Input simulation time
  document.querySelector(`input#inputSimulationTime`).value = 24;

  updatePersistentImportButton(
    button,
    runtime.config.isZH ? "已匯入" : "Imported",
  );
  if (!isParty) {
    setTimeout(() => {
      document.querySelector(`button#buttonStartSimulation`).click();
    }, 500);
  }
}

function constructGroupExportObj() {
  const characterObj = JSON.parse(GM_getValue("mwiShrineBridge_init_character_data", ""));
  const clientObj = JSON.parse(GM_getValue("mwiShrineBridge_init_client_data", ""));
  const activePartyMembers = Object.values(
    characterObj?.partyInfo?.partySlotMap ?? {},
  ).filter((member) => member?.characterID);
  const activePartyCharacterIDs = activePartyMembers.map((member) =>
    String(member.characterID),
  );
  const battleObj = getStoredBattleForRoster(activePartyCharacterIDs);
  // console.log(battleObj);
  const storedProfileList = JSON.parse(
    GM_getValue("mwiShrineBridge_profile_export_list", "[]"),
  );
  // console.log(storedProfileList);

  const BLANK_PLAYER_JSON = `{\"player\":{\"attackLevel\":1,\"magicLevel\":1,\"meleeLevel\":1,\"rangedLevel\":1,\"defenseLevel\":1,\"staminaLevel\":1,\"intelligenceLevel\":1,\"equipment\":[]},\"food\":{\"/action_types/combat\":[{\"itemHrid\":\"\"},{\"itemHrid\":\"\"},{\"itemHrid\":\"\"}]},\"drinks\":{\"/action_types/combat\":[{\"itemHrid\":\"\"},{\"itemHrid\":\"\"},{\"itemHrid\":\"\"}]},\"abilities\":[{\"abilityHrid\":\"\",\"level\":\"1\"},{\"abilityHrid\":\"\",\"level\":\"1\"},{\"abilityHrid\":\"\",\"level\":\"1\"},{\"abilityHrid\":\"\",\"level\":\"1\"},{\"abilityHrid\":\"\",\"level\":\"1\"}],\"triggerMap\":{},\"zone\":\"/actions/combat/fly\",\"simulationTime\":\"100\",\"houseRooms\":{\"/house_rooms/dairy_barn\":0,\"/house_rooms/garden\":0,\"/house_rooms/log_shed\":0,\"/house_rooms/forge\":0,\"/house_rooms/workshop\":0,\"/house_rooms/sewing_parlor\":0,\"/house_rooms/kitchen\":0,\"/house_rooms/brewery\":0,\"/house_rooms/laboratory\":0,\"/house_rooms/observatory\":0,\"/house_rooms/dining_room\":0,\"/house_rooms/library\":0,\"/house_rooms/dojo\":0,\"/house_rooms/gym\":0,\"/house_rooms/armory\":0,\"/house_rooms/archery_range\":0,\"/house_rooms/mystical_study\":0}}`;

  const exportObj = {};
  exportObj[1] = BLANK_PLAYER_JSON;
  exportObj[2] = BLANK_PLAYER_JSON;
  exportObj[3] = BLANK_PLAYER_JSON;
  exportObj[4] = BLANK_PLAYER_JSON;
  exportObj[5] = BLANK_PLAYER_JSON;

  let isParty = false;
  const playerIDs = [
    "Player 1",
    "Player 2",
    "Player 3",
    "Player 4",
    "Player 5",
  ];
  const importedPlayerPositions = [false, false, false, false, false];
  let zone = "/actions/combat/fly";
  let isZoneDungeon = false;
  let difficultyTier = 0;

  if (!characterObj?.partyInfo?.partySlotMap) {
    exportObj[1] = JSON.stringify(
      constructSelfPlayerExportObjFromInitCharacterData(
        characterObj,
        clientObj,
      ),
    );
    playerIDs[0] = characterObj.character.name;
    importedPlayerPositions[0] = true;
    // Zone
    for (const action of characterObj.characterActions) {
      if (action && action.actionHrid.includes("/actions/combat/")) {
        zone = action.actionHrid;
        difficultyTier = action.difficultyTier;
        isZoneDungeon =
          clientObj.actionDetailMap[action.actionHrid]?.combatZoneInfo
            ?.isDungeon;
        break;
      }
    }
  } else {
    isParty = true;
    let i = 1;
    for (const member of Object.values(characterObj.partyInfo.partySlotMap)) {
      if (member.characterID) {
        if (String(member.characterID) === String(characterObj.character.id)) {
          exportObj[i] = JSON.stringify(
            constructSelfPlayerExportObjFromInitCharacterData(
              characterObj,
              clientObj,
            ),
          );
          playerIDs[i - 1] = characterObj.character.name;
          importedPlayerPositions[i - 1] = true;
        } else {
          const profileList = storedProfileList.filter(
            (item) => String(item?.characterID) === String(member.characterID),
          );
          if (profileList.length !== 1) {
            console.log(
              runtime.config.isZH
                ? `[MWI 神龕橋接器] 找不到角色 ${member.characterID} 的已保存资料。`
                : `[MWI 神龕橋接器] Cannot find a saved profile for character ${member.characterID}.`,
            );
            playerIDs[i - 1] = runtime.config.isZH
              ? "需要点开资料"
              : "Open profile in game";
            i++;
            continue;
          }
          const profile = profileList[0];

          const battlePlayerList = (battleObj?.players ?? []).filter(
            (item) =>
              String(item?.character?.id) === String(member.characterID),
          );
          let battlePlayer = null;
          if (battlePlayerList.length === 1) {
            battlePlayer = battlePlayerList[0];
          }

          exportObj[i] = JSON.stringify(
            constructPlayerExportObjFromStoredProfile(
              profile,
              clientObj,
              battlePlayer,
            ),
          );
          playerIDs[i - 1] = profile.characterName;
          importedPlayerPositions[i - 1] = true;
        }
      }
      i++;
    }

    // Zone
    zone = characterObj.partyInfo?.party?.actionHrid;
    difficultyTier = characterObj.partyInfo?.party?.difficultyTier;
    isZoneDungeon = clientObj.actionDetailMap[zone]?.combatZoneInfo?.isDungeon;
  }

  return [
    exportObj,
    playerIDs,
    importedPlayerPositions,
    zone,
    difficultyTier,
    isZoneDungeon,
    isParty,
  ];
}

function constructSelfPlayerExportObjFromInitCharacterData(
  characterObj,
  clientObj,
) {
  const playerObj = {};
  playerObj.player = {};

  // Levels
  for (const skill of characterObj.characterSkills) {
    if (skill.skillHrid.includes("stamina")) {
      playerObj.player.staminaLevel = skill.level;
    } else if (skill.skillHrid.includes("intelligence")) {
      playerObj.player.intelligenceLevel = skill.level;
    } else if (skill.skillHrid.includes("attack")) {
      playerObj.player.attackLevel = skill.level;
    } else if (skill.skillHrid.includes("melee")) {
      playerObj.player.meleeLevel = skill.level;
    } else if (skill.skillHrid.includes("defense")) {
      playerObj.player.defenseLevel = skill.level;
    } else if (skill.skillHrid.includes("ranged")) {
      playerObj.player.rangedLevel = skill.level;
    } else if (skill.skillHrid.includes("magic")) {
      playerObj.player.magicLevel = skill.level;
    }
  }

  // Items
  playerObj.player.equipment = [];
  for (const item of characterObj.characterItems) {
    if (!item.itemLocationHrid.includes("/item_locations/inventory")) {
      playerObj.player.equipment.push({
        itemLocationHrid: item.itemLocationHrid,
        itemHrid: item.itemHrid,
        enhancementLevel: item.enhancementLevel,
      });
    }
  }

  // Food
  playerObj.food = {};
  playerObj.food["/action_types/combat"] = [];
  for (const food of characterObj.actionTypeFoodSlotsMap[
    "/action_types/combat"
  ]) {
    if (food) {
      playerObj.food["/action_types/combat"].push({
        itemHrid: food.itemHrid,
      });
    } else {
      playerObj.food["/action_types/combat"].push({
        itemHrid: "",
      });
    }
  }

  // Drinks
  playerObj.drinks = {};
  playerObj.drinks["/action_types/combat"] = [];
  for (const drink of characterObj.actionTypeDrinkSlotsMap[
    "/action_types/combat"
  ]) {
    if (drink) {
      playerObj.drinks["/action_types/combat"].push({
        itemHrid: drink.itemHrid,
      });
    } else {
      playerObj.drinks["/action_types/combat"].push({
        itemHrid: "",
      });
    }
  }

  // Abilities
  playerObj.abilities = [
    {
      abilityHrid: "",
      level: "1",
    },
    {
      abilityHrid: "",
      level: "1",
    },
    {
      abilityHrid: "",
      level: "1",
    },
    {
      abilityHrid: "",
      level: "1",
    },
    {
      abilityHrid: "",
      level: "1",
    },
  ];
  let normalAbillityIndex = 1;
  for (const ability of characterObj.combatUnit.combatAbilities) {
    if (
      ability &&
      clientObj.abilityDetailMap[ability.abilityHrid].isSpecialAbility
    ) {
      playerObj.abilities[0] = {
        abilityHrid: ability.abilityHrid,
        level: ability.level,
      };
    } else if (ability) {
      playerObj.abilities[normalAbillityIndex++] = {
        abilityHrid: ability.abilityHrid,
        level: ability.level,
      };
    }
  }

  // TriggerMap
  playerObj.triggerMap = {
    ...characterObj.abilityCombatTriggersMap,
    ...characterObj.consumableCombatTriggersMap,
  };

  // HouseRooms
  playerObj.houseRooms = {};
  for (const house of Object.values(characterObj.characterHouseRoomMap)) {
    playerObj.houseRooms[house.houseRoomHrid] = house.level;
  }

  // Achievements
  playerObj.achievements = {};
  for (const achievement of Object.values(characterObj.characterAchievements)) {
    playerObj.achievements[achievement.achievementHrid] =
      achievement.isCompleted;
  }

  applyGuildCombatBuffLevels(playerObj, characterObj);

  return playerObj;
}

function constructPlayerExportObjFromStoredProfile(
  profile,
  clientObj,
  battlePlayer,
) {
  const playerObj = {};
  playerObj.player = {};

  // Levels
  for (const skill of profile.profile.characterSkills) {
    if (skill.skillHrid.includes("stamina")) {
      playerObj.player.staminaLevel = skill.level;
    } else if (skill.skillHrid.includes("intelligence")) {
      playerObj.player.intelligenceLevel = skill.level;
    } else if (skill.skillHrid.includes("attack")) {
      playerObj.player.attackLevel = skill.level;
    } else if (skill.skillHrid.includes("melee")) {
      playerObj.player.meleeLevel = skill.level;
    } else if (skill.skillHrid.includes("defense")) {
      playerObj.player.defenseLevel = skill.level;
    } else if (skill.skillHrid.includes("ranged")) {
      playerObj.player.rangedLevel = skill.level;
    } else if (skill.skillHrid.includes("magic")) {
      playerObj.player.magicLevel = skill.level;
    }
  }

  // Items
  playerObj.player.equipment = [];
  if (profile.profile.wearableItemMap) {
    for (const key in profile.profile.wearableItemMap) {
      const item = profile.profile.wearableItemMap[key];
      playerObj.player.equipment.push({
        itemLocationHrid: item.itemLocationHrid,
        itemHrid: item.itemHrid,
        enhancementLevel: item.enhancementLevel,
      });
    }
  }

  // Food and drinks
  playerObj.food = {};
  playerObj.food["/action_types/combat"] = [];
  playerObj.drinks = {};
  playerObj.drinks["/action_types/combat"] = [];

  if (battlePlayer?.combatConsumables) {
    for (const foodOrDrink of battlePlayer.combatConsumables) {
      if (foodOrDrink.itemHrid.includes("coffee")) {
        playerObj.drinks["/action_types/combat"].push({
          itemHrid: foodOrDrink.itemHrid,
        });
      } else {
        playerObj.food["/action_types/combat"].push({
          itemHrid: foodOrDrink.itemHrid,
        });
      }
    }
  } else {
    // Assume food and drinks based on equipped weapon
    const weapon =
      profile.profile.wearableItemMap &&
      (profile.profile.wearableItemMap["/item_locations/main_hand"]?.itemHrid ||
        profile.profile.wearableItemMap["/item_locations/two_hand"]?.itemHrid);
    if (weapon) {
      if (weapon.includes("shooter") || weapon.includes("bow")) {
        // 远程
        // xp,超远,暴击
        playerObj.drinks["/action_types/combat"].push({
          itemHrid: "/items/wisdom_coffee",
        });
        playerObj.drinks["/action_types/combat"].push({
          itemHrid: "/items/super_ranged_coffee",
        });
        playerObj.drinks["/action_types/combat"].push({
          itemHrid: "/items/critical_coffee",
        });
        // 2红1蓝
        playerObj.food["/action_types/combat"].push({
          itemHrid: "/items/spaceberry_donut",
        });
        playerObj.food["/action_types/combat"].push({
          itemHrid: "/items/spaceberry_cake",
        });
        playerObj.food["/action_types/combat"].push({
          itemHrid: "/items/star_fruit_yogurt",
        });
      } else if (
        weapon.includes("boomstick") ||
        weapon.includes("staff") ||
        weapon.includes("trident")
      ) {
        // 法师
        // xp,超魔,吟唱
        playerObj.drinks["/action_types/combat"].push({
          itemHrid: "/items/wisdom_coffee",
        });
        playerObj.drinks["/action_types/combat"].push({
          itemHrid: "/items/super_magic_coffee",
        });
        playerObj.drinks["/action_types/combat"].push({
          itemHrid: "/items/channeling_coffee",
        });
        // 1红2蓝
        playerObj.food["/action_types/combat"].push({
          itemHrid: "/items/spaceberry_cake",
        });
        playerObj.food["/action_types/combat"].push({
          itemHrid: "/items/star_fruit_gummy",
        });
        playerObj.food["/action_types/combat"].push({
          itemHrid: "/items/star_fruit_yogurt",
        });
      } else if (weapon.includes("bulwark")) {
        // 双手盾 精暮光
        // xp,超防,超耐
        playerObj.drinks["/action_types/combat"].push({
          itemHrid: "/items/wisdom_coffee",
        });
        playerObj.drinks["/action_types/combat"].push({
          itemHrid: "/items/super_defense_coffee",
        });
        playerObj.drinks["/action_types/combat"].push({
          itemHrid: "/items/super_stamina_coffee",
        });
        // 2红1蓝
        playerObj.food["/action_types/combat"].push({
          itemHrid: "/items/spaceberry_donut",
        });
        playerObj.food["/action_types/combat"].push({
          itemHrid: "/items/spaceberry_cake",
        });
        playerObj.food["/action_types/combat"].push({
          itemHrid: "/items/star_fruit_yogurt",
        });
      } else {
        // 战士
        // xp,超力,迅捷
        playerObj.drinks["/action_types/combat"].push({
          itemHrid: "/items/wisdom_coffee",
        });
        playerObj.drinks["/action_types/combat"].push({
          itemHrid: "/items/super_melee_coffee",
        });
        playerObj.drinks["/action_types/combat"].push({
          itemHrid: "/items/swiftness_coffee",
        });
        // 2红1蓝
        playerObj.food["/action_types/combat"].push({
          itemHrid: "/items/spaceberry_donut",
        });
        playerObj.food["/action_types/combat"].push({
          itemHrid: "/items/spaceberry_cake",
        });
        playerObj.food["/action_types/combat"].push({
          itemHrid: "/items/star_fruit_yogurt",
        });
      }
    }
  }

  // Abilities
  playerObj.abilities = [
    {
      abilityHrid: "",
      level: "1",
    },
    {
      abilityHrid: "",
      level: "1",
    },
    {
      abilityHrid: "",
      level: "1",
    },
    {
      abilityHrid: "",
      level: "1",
    },
    {
      abilityHrid: "",
      level: "1",
    },
  ];
  if (profile.profile.equippedAbilities) {
    let normalAbillityIndex = 1;
    for (const ability of profile.profile.equippedAbilities) {
      if (
        ability &&
        clientObj.abilityDetailMap[ability.abilityHrid].isSpecialAbility
      ) {
        playerObj.abilities[0] = {
          abilityHrid: ability.abilityHrid,
          level: ability.level,
        };
      } else if (ability) {
        playerObj.abilities[normalAbillityIndex++] = {
          abilityHrid: ability.abilityHrid,
          level: ability.level,
        };
      }
    }
  }

  // TriggerMap
  if (
    profile.profile.abilityCombatTriggersMap &&
    profile.profile.consumableCombatTriggersMap
  ) {
    playerObj.triggerMap = {
      ...profile.profile.abilityCombatTriggersMap,
      ...profile.profile.consumableCombatTriggersMap,
    };
  }

  // HouseRooms
  playerObj.houseRooms = {};
  for (const house of Object.values(profile.profile.characterHouseRoomMap)) {
    playerObj.houseRooms[house.houseRoomHrid] = house.level;
  }

  // Achievements
  playerObj.achievements = {};
  for (const achievement of Object.values(
    profile.profile.characterAchievements,
  )) {
    playerObj.achievements[achievement.achievementHrid] =
      achievement.isCompleted;
  }

  // Each teammate must use only that teammate's profile_shared shrine map.
  // Missing profile shrine data stays at zero and is marked; never borrow the
  // current character's or another party member's values.
  applyGuildCombatBuffLevels(playerObj, profile.profile);

  return playerObj;
}

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
})();
