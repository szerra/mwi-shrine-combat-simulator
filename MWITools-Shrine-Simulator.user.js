// ==UserScript==
// @name         MWITools 繁體中文修正版（神龕模擬器網路版）
// @namespace    http://tampermonkey.net/
// @version      25.13-TW.25
// @description  MWITools 25.13 繁體中文修正版；支援 GitHub Pages 神龕模擬器、防止舊資料匯入、匯出戰鬥神龕等級並內建自訂角色圖庫。
// @author       bot7420, shykai
// @license      CC-BY-NC-SA-4.0
// @match        https://www.milkywayidle.com/*
// @match        https://test.milkywayidle.com/*
// @match        https://www.milkywayidlecn.com/*
// @match        https://amvoidguy.github.io/MWICombatSimulatorTest/*
// @match        https://shykai.github.io/MWICombatSimulatorTest/dist/*
// @match        https://mooneycalc.netlify.app/*
// @match        http://127.0.0.1:8765/*
// @match        http://localhost:8765/*
// @match        https://szerra.github.io/mwi-shrine-combat-simulator/*
// @updateURL    https://szerra.github.io/mwi-shrine-combat-simulator/MWITools-Shrine-Simulator.user.js
// @downloadURL  https://szerra.github.io/mwi-shrine-combat-simulator/MWITools-Shrine-Simulator.user.js
// @grant        GM_addStyle
// @grant        GM.xmlHttpRequest
// @grant        GM_xmlhttpRequest
// @grant        GM_notification
// @grant        GM_getValue
// @grant        GM_setValue
// @grant        GM_registerMenuCommand
// @require      https://cdnjs.cloudflare.com/ajax/libs/mathjs/12.4.2/math.js
// @require      https://cdn.jsdelivr.net/npm/chart.js@3.7.0/dist/chart.min.js
// @require      https://cdn.jsdelivr.net/npm/chartjs-plugin-datalabels@2.0.0/dist/chartjs-plugin-datalabels.min.js
// ==/UserScript==

/*
    Steam客戶端玩家還需要額外安裝相容插件。

    MilkyWayIdle Steam game client players should also install this script:
    https://raw.githubusercontent.com/YangLeda/Userscripts-For-MilkyWayIdle/refs/heads/main/MWITools%20addon%20for%20Steam%20version.js
*/

/*
    【遇到MWITools插件有問題時的解決方法】

    請先務必排查以下問題：
    1. 你的MWITools插件已更新至最新版（greasyfork網站有可能被牆，請開梯子更新；或者到QQ群檔案裡下載後手動匯入或複製貼上程式碼）；
    2. 你沒有重複安裝插件（有的人裝了新版本插件，但還有個舊版本的沒有刪除，在同時執行；或者有的人在同一個瀏覽器裡裝了兩個油猴類瀏覽器插件）；
    3. 安裝或更新完插件後，以及在遊戲設定裡切換過語言後，必須重新整理遊戲網頁；
    4. 請在電腦上、使用最新版本Chrome瀏覽器、使用最新版本TamperMonkey（油猴）插件嘗試（作者精力有限，做不到逐個適配各種環境、為每個人定位環境問題，
       遇到問題時請優先使用上述主流環境。如果你一定要使用舊版本或其它品牌的瀏覽器或油猴插件，遇到問題請優先自行摸索如何解決，作者很可能無法解決你的問題。
       手機使用問題很多，作者不定位手機上問題。問問群友用什麼瀏覽器好使，多換幾個瀏覽器試試。蘋果手機建議嘗試focus瀏覽器。）。

    如果仍有問題，請私聊作者具體問題是什麼、復現問題的具體步驟、最好附帶截圖；
    與網路有關的問題，右上角紅字顯示無法從API更新市場資料時，點選紅字檢視錯誤資訊，截圖發給作者；
    報錯日誌是定位問題的快速甚至唯一方法，請開啟瀏覽器開發者工具檢視終端，重新整理遊戲網頁，復現遇到的問題，截圖發給作者。
*/

(() => {
    "use strict";

    const THOUSAND_SEPERATOR = new Intl.NumberFormat().format(1111).replaceAll("1", "").at(0) || "";
    const DECIMAL_SEPERATOR = new Intl.NumberFormat().format(1.1).replaceAll("1", "").at(0);

    const isZHInGameSetting = localStorage.getItem("i18nextLng")?.toLowerCase()?.startsWith("zh"); // 獲取遊戲內設定語言
    let isZH = isZHInGameSetting; // MWITools 本身顯示的語言預設由遊戲內設定語言決定

    /* 自定義插件字型顏色 */
    /* 找顏色自行網上搜尋"CSS顏色" */
    /* 可以是顏色名稱，比如"red"；也可以是顏色Hex，比如"#ED694D" */
    // Customization
    let SCRIPT_COLOR_MAIN = "green"; // 指令碼主要字型顏色
    let SCRIPT_COLOR_TOOLTIP = "darkgreen"; // 物品懸浮窗的字型顏色
    const SCRIPT_COLOR_ALERT = "red"; // 警告字型顏色

    console.log(window.location.href);
    const MARKET_API_URL = window.location.href.includes("milkywayidle.com")
        ? "https://www.milkywayidle.com/game_data/marketplace.json"
        : "https://www.milkywayidlecn.com/game_data/marketplace.json";

    let settingsMap = {
        useOrangeAsMainColor: {
            id: "useOrangeAsMainColor",
            desc: isZH ? "使用橙色字型" : "Use orange as the main color for the script.",
            isTrue: true,
        },
        displayCapMM:{
            id: "displayCapMM",
            desc: isZH ? "限制最高支援M量級（之前最高B量級）" : "Values are capped at the million level, which used to be billion.",
            isTrue: false,
        },
        totalActionTime: {
            id: "totalActionTime",
            desc: isZH
                ? "左上角顯示：當前動作預計總耗時、預計何時完成"
                : "Top left: Estimated total time of the current action, estimated complete time.",
            isTrue: true,
        },
        actionPanel_totalTime: {
            id: "actionPanel_totalTime",
            desc: isZH
                ? "動作面板顯示：動作預計總耗時、到多少級還需做多少次、每小時經驗"
                : "Action panel: Estimated total time of the action, times needed to reach a target skill level, exp/hour.",
            isTrue: true,
        },
        actionPanel_totalTime_quickInputs: {
            id: "actionPanel_totalTime_quickInputs",
            desc: isZH ? "動作面板顯示：快速輸入次數 [依賴上一項]" : "Action panel: Quick input numbers. [Depends on the previous selection]",
            isTrue: true,
        },
        actionPanel_foragingTotal: {
            id: "actionPanel_foragingTotal",
            desc: isZH
                ? "動作面板顯示：採摘綜合圖顯示綜合收益 [依賴上一項]"
                : "Action panel: Overall profit of the foraging maps with multiple outcomes. [Depends on the previous selection]",
            isTrue: true,
        },
        networth: {
            id: "networth",
            desc: isZH
                ? "右上角顯示：流動資產(+2及以上物品按強化模擬成本計算)"
                : "Top right: Current assets (Items with at least 2 enhancement levels are valued by enchancing simulator).",
            isTrue: true,
        },
        invWorth: {
            id: "invWorth",
            desc: isZH
                ? "倉庫搜尋欄下方顯示：倉庫和戰力總結 [依賴上一項]"
                : "Below inventory search bar: Inventory and character summery. [Depends on the previous selection]",
            isTrue: true,
        },
        invSort: {
            id: "invSort",
            desc: isZH ? "倉庫顯示：倉庫物品排序 [依賴上一項]" : "Inventory: Sort inventory items. [Depends on the previous selection]",
            isTrue: true,
        },
        profileBuildScore: {
            id: "profileBuildScore",
            desc: isZH ? "人物面板顯示：戰力分" : "Profile panel: Build score.",
            isTrue: true,
        },
        itemTooltip_prices: {
            id: "itemTooltip_prices",
            desc: isZH ? "物品懸浮窗顯示：24小時市場均價" : "Item tooltip: 24 hours average market price.",
            isTrue: true,
        },
        itemTooltip_profit: {
            id: "itemTooltip_profit",
            desc: isZH
                ? "物品懸浮窗顯示：生產成本和利潤計算 [依賴上一項]"
                : "Item tooltip: Production cost and profit. [Depends on the previous selection]",
            isTrue: true,
        },
        showConsumTips: {
            id: "showConsumTips",
            desc: isZH
                ? "物品懸浮窗顯示：消耗品回血回魔速度、回覆價效比、每天最多消耗數量"
                : "Item tooltip: HP/MP consumables restore speed, cost performance, max cost per day.",
            isTrue: true,
        },
        networkAlert: {
            id: "networkAlert",
            desc: isZH ? "右上角顯示：無法聯網更新市場資料時，紅字警告" : "Top right: Alert message when market price data can not be fetched.",
            isTrue: true,
        },
        expPercentage: {
            id: "expPercentage",
            desc: isZH ? "左側欄顯示：技能經驗百分比" : "Left sidebar: Percentages of exp of the skill levels.",
            isTrue: true,
        },
        battlePanel: {
            id: "battlePanel",
            desc: isZH
                ? "戰鬥總結面板（戰鬥時點選玩家頭像）顯示：平均每小時戰鬥次數、收入、經驗"
                : "Battle info panel(click on player avatar during combat): Encounters/hour, revenue, exp.",
            isTrue: true,
        },
        itemIconLevel: {
            id: "itemIconLevel",
            desc: isZH ? "裝備圖示右上角顯示：裝備等級" : "Top right corner of equipment icons: Equipment level.",
            isTrue: true,
        },
        showsKeyInfoInIcon: {
            id: "showsKeyInfoInIcon",
            desc: isZH
                ? "鑰匙和鑰匙碎片圖示右上角顯示：對應的地圖序號 [依賴上一項]"
                : "Top right corner of key/fragment icons: Corresponding combat zone index number. [Depends on the previous selection]",
            isTrue: true,
        },
        marketFilter: {
            id: "marketFilter",
            desc: isZH ? "市場頁面顯示：裝備按等級、職業、部位篩選" : "Marketplace: Filter by equipment level, class, slot.",
            isTrue: true,
        },
        taskMapIndex: {
            id: "taskMapIndex",
            desc: isZH ? "任務頁面顯示：目標戰鬥地圖序號" : "Tasks page: Combat zone index number.",
            isTrue: true,
        },
        mapIndex: {
            id: "mapIndex",
            desc: isZH ? "戰鬥地圖選擇頁面顯示：地圖序號" : "Combat zones page: Combat zone index number.",
            isTrue: true,
        },
        skillbook: {
            id: "skillbook",
            desc: isZH
                ? "技能書的物品詞典面板顯示：到多少級還需要多少本技能書"
                : "Item dictionary of skill books: Number of books needed to reach target skill level.",
            isTrue: true,
        },
        ThirdPartyLinks: {
            id: "ThirdPartyLinks",
            desc: isZH ? "左側選單欄顯示：第三方工具網站連結、指令碼設定連結" : "Left sidebar: Links to 3rd-party websites, script settings.",
            isTrue: true,
        },
        actionQueue: {
            id: "actionQueue",
            desc: isZH
                ? "上方動作佇列選單顯示：佇列中每個動作預計總時間、到何時完成"
                : "Queued actions panel at the top: Estimated total time and complete time of each queued action.",
            isTrue: true,
        },
        enhanceSim: {
            id: "enhanceSim",
            desc: isZH
                ? "帶強化等級的裝備的懸浮選單顯示：強化模擬計算"
                : "Tooltip of equipment with enhancement level: Enhancing simulator calculations.",
            isTrue: true,
        },
        checkEquipment: {
            id: "checkEquipment",
            desc: isZH
                ? "頁面上方顯示：戰鬥時穿了生產裝備，或者生產時沒有穿對應的生產裝備而倉庫裡有，紅字警告"
                : "Top: Alert message when combating with production equipments equipted, or producing when there are unequipted corresponding production equipment in the inventory.",
            isTrue: true,
        },
        notifiEmptyAction: {
            id: "notifiEmptyAction",
            desc: isZH
                ? "彈窗通知：正在空閒（遊戲網頁開啟時才有效）"
                : "Browser notification: Action queue is empty. (Works only when the game page is open.)",
            isTrue: false,
        },
        fillMarketOrderPrice: {
            id: "fillMarketOrderPrice",
            desc: isZH
                ? "釋出市場訂單時自動填寫為最小壓價"
                : "Automatically input price with the smallest increasement/decreasement when posting marketplace bid/sell orders.",
            isTrue: true,
        },
        showDamage: {
            id: "showDamage",
            desc: isZH ? "戰鬥時，人物頭像下方顯示：傷害統計數字" : "Bottom of player avatar during combat: DPS.",
            isTrue: true,
        },
        showDamageGraph: {
            id: "showDamageGraph",
            desc: isZH
                ? "戰鬥時，在戰鬥區上方顯示隊伍／公會多人 DPS [依賴上一項]"
                : "Embedded party/guild DPS panel in the battle area. [Depends on the previous selection]",
            isTrue: true,
        },
        damageGraphTransparentBackground: {
            id: "damageGraphTransparentBackground",
            desc: isZH ? "內嵌 DPS 面板使用半透明背景 [依賴上一項]" : "Use a translucent embedded DPS panel. [Depends on the previous selection]",
            isTrue: true,
        },
        forceMWIToolsDisplayZH: {
            id: "forceMWIToolsDisplayZH",
            desc: isZH ? "MWITools本身強制顯示中文 MWITools always in Chinese" : "MWITools本身強制顯示中文 MWITools always in Chinese",
            isTrue: false,
        },
    };
    readSettings();

    // These values must be initialized before the early return used on
    // third-party simulator pages. The import handlers run after that return.
    const LIVE_IMPORT_CHARACTER_MAX_AGE_MS = 10 * 60 * 1000;
    const LIVE_IMPORT_PROFILE_MAX_AGE_MS = 10 * 60 * 1000;
    const LIVE_IMPORT_BATTLE_MAX_AGE_MS = 10 * 60 * 1000;
    const LIVE_IMPORT_GUILD_KEYS = ["force", "tempo", "spirit", "rarity", "scholar"];

    // 非遊戲網站
    const isShareableLocalSimulator =
        (location.hostname === "127.0.0.1" || location.hostname === "localhost") && location.port === "8765";
    const isShareableGithubSimulator =
        location.hostname === "szerra.github.io" && location.pathname.startsWith("/mwi-shrine-combat-simulator/");
    if (
        document.URL.includes("amvoidguy.github.io") ||
        document.URL.includes("shykai.github.io/MWICombatSimulatorTest/") ||
        isShareableLocalSimulator ||
        isShareableGithubSimulator
    ) {
        addImportButtonForAmvoidguy();
        observeResultsForAmvoidguy();
        return;
    } else if (document.URL.includes("shykai.github.io/mwisim")) {
        addImportButtonFor9Battles();
        observeResultsForAmvoidguy();
        return;
    } else if (document.URL.includes("mooneycalc.netlify.app")) {
        addImportButtonForMooneycalc();
        return;
    }

    // Keep combat cards at the bottom of the battle area so the embedded
    // party/guild statistics panel has a stable area above them. This layout
    // belongs to MWITools rather than the optional custom-avatar userscript.
    GM_addStyle(`
        [class*="BattlePanel_playersArea"] [class*="BattlePanel_combatUnitGrid"],
        [class*="BattlePanel_monstersArea"] [class*="BattlePanel_combatUnitGrid"] {
            grid-template-columns: repeat(auto-fit, 9.5rem) !important;
            align-content: end !important;
            box-sizing: border-box !important;
            padding-bottom: 2.25rem !important;
        }

        [class*="BattlePanel_playersArea"] [class*="BattlePanel_combatUnitGrid"] > [class*="CombatUnit_combatUnit"],
        [class*="BattlePanel_monstersArea"] [class*="BattlePanel_combatUnitGrid"] > [class*="CombatUnit_combatUnit"] {
            width: 7.5rem !important;
            justify-self: center;
            /* Hit Tracker shakes the card by writing an inline transform.
               Keep MWITools' responsive scale authoritative so the whole card
               no longer jumps between scaled and unscaled sizes on every hit. */
            transform: scale(1.28) !important;
            transform-origin: center center;
        }

        /* 1920x1080 at Windows 125% scaling leaves roughly a 1536x864 CSS
           viewport. When chat is expanded, reserve less vertical space for
           combat cards so the statistics panel remains usable. */
        @media (max-width: 1700px), (max-height: 950px) {
            [class*="BattlePanel_playersArea"] [class*="BattlePanel_combatUnitGrid"],
            [class*="BattlePanel_monstersArea"] [class*="BattlePanel_combatUnitGrid"] {
                grid-template-columns: repeat(auto-fit, 8rem) !important;
                padding-bottom: 0.75rem !important;
            }

            [class*="BattlePanel_playersArea"] [class*="BattlePanel_combatUnitGrid"] > [class*="CombatUnit_combatUnit"],
            [class*="BattlePanel_monstersArea"] [class*="BattlePanel_combatUnitGrid"] > [class*="CombatUnit_combatUnit"] {
                transform: scale(0.96) !important;
            }

            .script_dps_panel {
                max-height: clamp(120px, calc(100% - 260px), 260px) !important;
                overflow-x: hidden !important;
                overflow-y: auto !important;
                scrollbar-gutter: auto !important;
                padding: 6px 8px !important;
                font-size: 11px !important;
                line-height: 1.3 !important;
            }
        }

        @media (max-width: 1360px), (max-height: 760px) {
            [class*="BattlePanel_playersArea"] [class*="BattlePanel_combatUnitGrid"],
            [class*="BattlePanel_monstersArea"] [class*="BattlePanel_combatUnitGrid"] {
                grid-template-columns: repeat(auto-fit, 7rem) !important;
                padding-bottom: 0.25rem !important;
            }

            [class*="BattlePanel_playersArea"] [class*="BattlePanel_combatUnitGrid"] > [class*="CombatUnit_combatUnit"],
            [class*="BattlePanel_monstersArea"] [class*="BattlePanel_combatUnitGrid"] > [class*="CombatUnit_combatUnit"] {
                transform: scale(0.84) !important;
            }

            .script_dps_panel {
                max-height: clamp(104px, calc(100% - 225px), 220px) !important;
                padding: 5px 7px !important;
                font-size: 10px !important;
            }
        }
    `);

    // BEGIN EMBEDDED MWI AVATAR LIBRARY
    (() => {
      'use strict';

      const SCRIPT_ID = 'mwi-avatar-library';
      const DB_NAME = 'mwi-avatar-library-v1';
      const DB_VERSION = 1;
      const IMAGE_STORE = 'images';
      const ASSIGNMENTS_KEY = 'mwiAvatarLibraryAssignmentsV1';
      const PANEL_POSITION_KEY = 'mwiAvatarLibraryPanelPositionV1';
      const MIGRATION_STORAGE_KEY = 'mwiAvatarLibraryAssignmentsMigrationV1';
      const INTEGRATED_IN_MWITOOLS = true;
      const MAX_PARTY_SIZE = 5;
      const IMPORT_SIZE = 512;
      const IMPORT_QUALITY = 0.86;
      const BUILTIN_IMAGES = [
        {
          id: 'builtin:azure-princess',
          name: '藍髮水系角色',
          revision: 2,
          dataUrl: 'data:image/webp;base64,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',
        },
        {
          id: 'builtin:rose-healer',
          name: '粉金銀髮治療師',
          revision: 2,
          dataUrl: 'data:image/webp;base64,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',
        },
        {
          id: 'builtin:rose-cat-healer',
          name: '粉金貓耳治療師',
          revision: 2,
          dataUrl: 'data:image/webp;base64,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',
        },
      ];

      const objectUrls = new Map();
      let databasePromise = null;
      let assignments = normalizeAssignments(GM_getValue(ASSIGNMENTS_KEY, {}));
      let refreshQueued = false;
      let modalOpen = false;

      if (INTEGRATED_IN_MWITOOLS) {
        document.documentElement.dataset.mwiToolsAvatarLibrary = 'true';
      }

      GM_addStyle(`
        .mwi-avatar-original-hidden {
          visibility: hidden !important;
        }

        .mwi-avatar-library-skin {
          position: absolute !important;
          left: 0 !important;
          top: 6px !important;
          width: 100% !important;
          height: 100% !important;
          object-fit: contain !important;
          object-position: center !important;
          transform: scale(1.18);
          transform-origin: center top;
          border-radius: 0;
          pointer-events: none !important;
          user-select: none !important;
          z-index: 1;
        }

        #mwi-avatar-library-launcher {
          position: fixed;
          right: 14px;
          bottom: 146px;
          z-index: 2147483000;
          width: 44px;
          height: 44px;
          border: 1px solid rgba(135, 181, 255, .72);
          border-radius: 50%;
          background: linear-gradient(145deg, #3b4b78, #20283e);
          color: #fff;
          font-size: 22px;
          line-height: 1;
          cursor: pointer;
          box-shadow: 0 8px 24px rgba(0, 0, 0, .42);
        }

        #mwi-avatar-library-launcher:hover {
          filter: brightness(1.14);
          transform: translateY(-1px);
        }

        #mwi-avatar-library-overlay {
          position: fixed;
          inset: 0;
          z-index: 2147483600;
          display: flex;
          align-items: center;
          justify-content: center;
          padding: 20px;
          background: rgba(4, 8, 18, .76);
          backdrop-filter: blur(4px);
          color: #eaf2ff;
          font-family: Arial, "Microsoft JhengHei", sans-serif;
        }

        #mwi-avatar-library-panel {
          position: fixed;
          top: 50%;
          left: 50%;
          transform: translate(-50%, -50%);
          width: min(940px, calc(100vw - 28px));
          max-height: min(88vh, 900px);
          overflow: auto;
          border: 1px solid #4e689a;
          border-radius: 14px;
          background: #1d2232;
          box-shadow: 0 22px 70px rgba(0, 0, 0, .58);
        }

        .mwi-avatar-library-header {
          position: sticky;
          top: 0;
          z-index: 3;
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 12px;
          padding: 14px 16px;
          border-bottom: 1px solid #39445f;
          background: rgba(29, 34, 50, .97);
          cursor: move;
          touch-action: none;
          user-select: none;
        }

        .mwi-avatar-library-header h2 {
          margin: 0;
          color: #9edcff;
          font-size: 19px;
        }

        .mwi-avatar-library-close {
          width: 34px;
          height: 34px;
          border: 0;
          border-radius: 8px;
          background: #313a53;
          color: #fff;
          font-size: 22px;
          cursor: pointer;
        }

        .mwi-avatar-library-body {
          padding: 16px;
        }

        .mwi-avatar-library-toolbar {
          display: flex;
          flex-wrap: wrap;
          gap: 8px;
          margin-bottom: 16px;
        }

        .mwi-avatar-library-button {
          min-height: 34px;
          padding: 7px 12px;
          border: 1px solid #526a9d;
          border-radius: 7px;
          background: #34466f;
          color: #fff;
          font-weight: 700;
          cursor: pointer;
        }

        .mwi-avatar-library-button:hover {
          filter: brightness(1.13);
        }

        .mwi-avatar-library-button.secondary {
          border-color: #4c566f;
          background: #2a3042;
        }

        .mwi-avatar-library-button.danger {
          border-color: #875363;
          background: #623845;
        }

        .mwi-avatar-library-section {
          margin-top: 18px;
        }

        .mwi-avatar-library-section h3 {
          margin: 0 0 10px;
          color: #f1f5ff;
          font-size: 16px;
        }

        .mwi-avatar-library-note {
          margin: 6px 0 10px;
          color: #aeb9d2;
          font-size: 13px;
          line-height: 1.5;
        }

        .mwi-avatar-team-list {
          display: grid;
          gap: 8px;
        }

        .mwi-avatar-team-row {
          display: grid;
          grid-template-columns: 52px minmax(100px, 1fr) minmax(180px, 2fr) auto;
          align-items: center;
          gap: 10px;
          padding: 9px;
          border: 1px solid #38445e;
          border-radius: 9px;
          background: #242a3b;
        }

        .mwi-avatar-team-preview {
          width: 48px;
          height: 48px;
          object-fit: contain;
          border: 1px solid #475675;
          border-radius: 7px;
          background: #071629;
        }

        .mwi-avatar-team-name {
          min-width: 0;
          overflow: hidden;
          color: #fff;
          font-weight: 700;
          text-overflow: ellipsis;
          white-space: nowrap;
        }

        .mwi-avatar-team-select {
          width: 100%;
          min-height: 34px;
          border: 1px solid #4c5b7a;
          border-radius: 6px;
          background: #171c29;
          color: #fff;
          padding: 5px 8px;
        }

        .mwi-avatar-gallery {
          display: grid;
          grid-template-columns: repeat(auto-fill, minmax(132px, 1fr));
          gap: 10px;
        }

        .mwi-avatar-gallery-card {
          min-width: 0;
          padding: 8px;
          border: 1px solid #3a4660;
          border-radius: 9px;
          background: #242a3b;
        }

        .mwi-avatar-gallery-card img {
          display: block;
          width: 100%;
          aspect-ratio: 1;
          object-fit: contain;
          border-radius: 7px;
          background: #071629;
        }

        .mwi-avatar-gallery-name {
          margin: 7px 0 6px;
          overflow: hidden;
          color: #fff;
          font-size: 13px;
          font-weight: 700;
          text-align: center;
          text-overflow: ellipsis;
          white-space: nowrap;
        }

        .mwi-avatar-gallery-badge {
          display: inline-block;
          margin-bottom: 6px;
          padding: 2px 6px;
          border-radius: 999px;
          background: #34486f;
          color: #bfe2ff;
          font-size: 11px;
        }

        .mwi-avatar-gallery-actions {
          display: flex;
          justify-content: center;
          gap: 5px;
        }

        .mwi-avatar-gallery-actions button {
          padding: 4px 7px;
          border: 1px solid #485977;
          border-radius: 5px;
          background: #303a51;
          color: #fff;
          font-size: 12px;
          cursor: pointer;
        }

        .mwi-avatar-library-empty {
          padding: 16px;
          border: 1px dashed #4a5875;
          border-radius: 8px;
          color: #aeb9d2;
          text-align: center;
        }

        .mwi-avatar-library-status {
          min-height: 22px;
          margin-top: 12px;
          color: #7ee3b1;
          font-size: 13px;
        }

        @media (max-width: 660px) {
          .mwi-avatar-team-row {
            grid-template-columns: 48px 1fr auto;
          }

          .mwi-avatar-team-select {
            grid-column: 1 / -1;
          }
        }
      `);

      function normalizeAssignments(value) {
        if (!value || typeof value !== 'object' || Array.isArray(value)) return {};
        return { ...value };
      }

      function playerKey(name) {
        return `name:${String(name || '').trim().toLocaleLowerCase()}`;
      }

      function saveAssignments() {
        GM_setValue(ASSIGNMENTS_KEY, assignments);
        if (!INTEGRATED_IN_MWITOOLS) publishAssignmentsForMigration();
      }

      function publishAssignmentsForMigration() {
        if (!Object.keys(assignments).length) return;
        try {
          localStorage.setItem(MIGRATION_STORAGE_KEY, JSON.stringify({
            version: 1,
            assignments,
            updatedAt: Date.now(),
          }));
        } catch (error) {
          console.warn(`[${SCRIPT_ID}] 無法準備舊圖庫指派移交`, error);
        }
      }

      function importMigratedAssignments() {
        if (!INTEGRATED_IN_MWITOOLS || Object.keys(assignments).length) return false;
        try {
          const migration = JSON.parse(localStorage.getItem(MIGRATION_STORAGE_KEY) || 'null');
          const migratedAssignments = normalizeAssignments(migration?.assignments);
          if (!Object.keys(migratedAssignments).length) return false;
          assignments = migratedAssignments;
          saveAssignments();
          return true;
        } catch (error) {
          console.warn(`[${SCRIPT_ID}] 無法接收舊圖庫指派`, error);
          return false;
        }
      }

      function openDatabase() {
        if (databasePromise) return databasePromise;
        databasePromise = new Promise((resolve, reject) => {
          const request = indexedDB.open(DB_NAME, DB_VERSION);
          request.onupgradeneeded = () => {
            const db = request.result;
            if (!db.objectStoreNames.contains(IMAGE_STORE)) {
              db.createObjectStore(IMAGE_STORE, { keyPath: 'id' });
            }
          };
          request.onsuccess = () => resolve(request.result);
          request.onerror = () => reject(request.error || new Error('無法開啟角色圖庫'));
        });
        return databasePromise;
      }

      async function withStore(mode, callback) {
        const db = await openDatabase();
        return new Promise((resolve, reject) => {
          const transaction = db.transaction(IMAGE_STORE, mode);
          const store = transaction.objectStore(IMAGE_STORE);
          let callbackResult;
          try {
            callbackResult = callback(store);
          } catch (error) {
            reject(error);
            return;
          }
          transaction.oncomplete = () => resolve(callbackResult);
          transaction.onerror = () => reject(transaction.error || new Error('角色圖庫操作失敗'));
          transaction.onabort = () => reject(transaction.error || new Error('角色圖庫操作已取消'));
        });
      }

      async function getAllImages() {
        const db = await openDatabase();
        return new Promise((resolve, reject) => {
          const transaction = db.transaction(IMAGE_STORE, 'readonly');
          const request = transaction.objectStore(IMAGE_STORE).getAll();
          request.onsuccess = () => {
            const rows = Array.isArray(request.result) ? request.result : [];
            rows.sort((a, b) => {
              if (Boolean(a.builtin) !== Boolean(b.builtin)) return a.builtin ? -1 : 1;
              return String(a.name || '').localeCompare(String(b.name || ''), 'zh-Hant');
            });
            resolve(rows);
          };
          request.onerror = () => reject(request.error || new Error('無法讀取角色圖庫'));
        });
      }

      async function getImage(id) {
        const db = await openDatabase();
        return new Promise((resolve, reject) => {
          const request = db.transaction(IMAGE_STORE, 'readonly').objectStore(IMAGE_STORE).get(id);
          request.onsuccess = () => resolve(request.result || null);
          request.onerror = () => reject(request.error || new Error('無法讀取角色圖片'));
        });
      }

      async function putImage(record) {
        await withStore('readwrite', (store) => store.put(record));
        revokeObjectUrl(record.id);
      }

      async function deleteImage(id) {
        await withStore('readwrite', (store) => store.delete(id));
        revokeObjectUrl(id);
      }

      function dataUrlToBlob(dataUrl) {
        const [header, payload] = String(dataUrl).split(',');
        const typeMatch = /^data:([^;]+);base64$/i.exec(header);
        if (!typeMatch || !payload) throw new Error('圖片資料格式不正確');
        const binary = atob(payload);
        const bytes = new Uint8Array(binary.length);
        for (let index = 0; index < binary.length; index += 1) {
          bytes[index] = binary.charCodeAt(index);
        }
        return new Blob([bytes], { type: typeMatch[1] });
      }

      function blobToDataUrl(blob) {
        return new Promise((resolve, reject) => {
          const reader = new FileReader();
          reader.onload = () => resolve(String(reader.result || ''));
          reader.onerror = () => reject(reader.error || new Error('無法轉換圖片'));
          reader.readAsDataURL(blob);
        });
      }

      async function ensureBuiltinImages() {
        for (const builtin of BUILTIN_IMAGES) {
          const existing = await getImage(builtin.id);
          if (existing?.builtinRevision === builtin.revision) continue;
          await putImage({
            id: builtin.id,
            name: builtin.name,
            blob: dataUrlToBlob(builtin.dataUrl),
            sourceUrl: '',
            builtin: true,
            builtinRevision: builtin.revision,
            createdAt: Date.now(),
          });
        }
      }

      function revokeObjectUrl(id) {
        const url = objectUrls.get(id);
        if (url) URL.revokeObjectURL(url);
        objectUrls.delete(id);
      }

      function imageRecordUrl(record) {
        if (!record) return '';
        if (record.sourceUrl) return record.sourceUrl;
        if (!(record.blob instanceof Blob)) return '';
        if (!objectUrls.has(record.id)) {
          objectUrls.set(record.id, URL.createObjectURL(record.blob));
        }
        return objectUrls.get(record.id);
      }

      function canvasToBlob(canvas) {
        return new Promise((resolve, reject) => {
          canvas.toBlob(
            (blob) => (blob ? resolve(blob) : reject(new Error('圖片壓縮失敗'))),
            'image/webp',
            IMPORT_QUALITY,
          );
        });
      }

      async function optimizeImageFile(file) {
        const bitmap = await createImageBitmap(file);
        try {
          const canvas = document.createElement('canvas');
          canvas.width = IMPORT_SIZE;
          canvas.height = IMPORT_SIZE;
          const context = canvas.getContext('2d');
          context.clearRect(0, 0, IMPORT_SIZE, IMPORT_SIZE);
          const scale = Math.min(
            (IMPORT_SIZE - 10) / bitmap.width,
            (IMPORT_SIZE - 10) / bitmap.height,
          );
          const width = Math.max(1, Math.round(bitmap.width * scale));
          const height = Math.max(1, Math.round(bitmap.height * scale));
          context.imageSmoothingEnabled = true;
          context.imageSmoothingQuality = 'high';
          context.drawImage(
            bitmap,
            Math.round((IMPORT_SIZE - width) / 2),
            Math.round((IMPORT_SIZE - height) / 2),
            width,
            height,
          );
          return canvasToBlob(canvas);
        } finally {
          bitmap.close();
        }
      }

      function makeImageId(prefix = 'custom') {
        const random = Math.random().toString(36).slice(2, 10);
        return `${prefix}:${Date.now().toString(36)}:${random}`;
      }

      async function importLocalFiles(files, setStatus) {
        const accepted = Array.from(files || []).filter((file) => file.type.startsWith('image/'));
        if (!accepted.length) return;
        let imported = 0;
        for (const file of accepted) {
          setStatus(`正在處理：${file.name}`);
          const blob = await optimizeImageFile(file);
          const baseName = file.name.replace(/\.[^.]+$/, '').trim() || `自訂圖片 ${imported + 1}`;
          await putImage({
            id: makeImageId(),
            name: baseName,
            blob,
            sourceUrl: '',
            builtin: false,
            createdAt: Date.now(),
          });
          imported += 1;
        }
        setStatus(`已匯入 ${imported} 張圖片`);
      }

      async function addUrlImage(setStatus) {
        const sourceUrl = window.prompt('請貼上圖片網址（PNG、JPG、WebP 或 GitHub Raw 網址）：', '');
        if (sourceUrl === null) return;
        const url = sourceUrl.trim();
        if (!/^https?:\/\//i.test(url) && !/^data:image\//i.test(url)) {
          throw new Error('請輸入 http、https 或 data:image 圖片網址');
        }
        const name = (window.prompt('這張圖片的名稱：', '網址圖片') || '').trim() || '網址圖片';
        await putImage({
          id: makeImageId('url'),
          name,
          blob: null,
          sourceUrl: url,
          builtin: false,
          createdAt: Date.now(),
        });
        setStatus(`已加入：${name}`);
      }

      function findPlayerUnits() {
        const units = Array.from(document.querySelectorAll('[class*="CombatUnit_combatUnit"]'));
        const found = [];
        const seen = new Set();
        for (const unit of units) {
          const playerMarker = unit.querySelector('[class*="CombatUnit_player"]');
          const nameElement = unit.querySelector('[class*="CombatUnit_name"]');
          const name = String(nameElement?.textContent || '').trim();
          if (!playerMarker || !name || seen.has(name)) continue;
          seen.add(name);
          found.push({ unit, name, key: playerKey(name) });
          if (found.length >= MAX_PARTY_SIZE) break;
        }
        return found;
      }

      async function applyAvatarToUnit(player, imageMap) {
        const model = player.unit.querySelector('[class*="CombatUnit_unitIconContainer"]')
          || player.unit.querySelector('[class*="CombatUnit_model"]');
        if (!model) return;
        const original = model.querySelector('[class*="FullAvatar_fullAvatar"]');
        const selectedId = assignments[player.key] || '';
        const selectedRecord = selectedId ? imageMap.get(selectedId) : null;
        let customImage = model.querySelector(':scope > img.mwi-avatar-library-skin');

        if (!selectedRecord) {
          if (customImage) customImage.remove();
          if (original) original.classList.remove('mwi-avatar-original-hidden');
          delete model.dataset.mwiAvatarImageId;
          return;
        }

        const source = imageRecordUrl(selectedRecord);
        if (!source) return;
        if (!customImage) {
          customImage = document.createElement('img');
          customImage.className = 'mwi-avatar-library-skin';
          customImage.decoding = 'async';
          customImage.draggable = false;
          customImage.alt = `${player.name} 自訂角色圖`;
          model.appendChild(customImage);
        }
        if (customImage.src !== source) customImage.src = source;
        customImage.alt = `${player.name} 自訂角色圖`;
        model.dataset.mwiAvatarImageId = selectedRecord.id;
        if (original) original.classList.add('mwi-avatar-original-hidden');
      }

      async function applyAllAvatars() {
        const images = await getAllImages();
        const imageMap = new Map(images.map((image) => [image.id, image]));
        const players = findPlayerUnits();
        await Promise.all(players.map((player) => applyAvatarToUnit(player, imageMap)));
      }

      function queueRefresh() {
        if (refreshQueued) return;
        refreshQueued = true;
        window.setTimeout(async () => {
          refreshQueued = false;
          try {
            await applyAllAvatars();
          } catch (error) {
            console.error(`[${SCRIPT_ID}]`, error);
          }
        }, 80);
      }

      function createButton(label, className = '') {
        const button = document.createElement('button');
        button.type = 'button';
        button.className = `mwi-avatar-library-button ${className}`.trim();
        button.textContent = label;
        return button;
      }

      function setModalStatus(message, isError = false) {
        const status = document.querySelector('#mwi-avatar-library-status');
        if (!status) return;
        status.textContent = message || '';
        status.style.color = isError ? '#ff9b9b' : '#7ee3b1';
      }

      function clampPanelPosition(panel, left, top) {
        const margin = 8;
        const maxLeft = Math.max(margin, window.innerWidth - panel.offsetWidth - margin);
        const maxTop = Math.max(margin, window.innerHeight - panel.offsetHeight - margin);
        return {
          left: Math.min(maxLeft, Math.max(margin, Number(left) || margin)),
          top: Math.min(maxTop, Math.max(margin, Number(top) || margin)),
        };
      }

      function placePanel(panel, left, top) {
        const position = clampPanelPosition(panel, left, top);
        panel.style.left = `${position.left}px`;
        panel.style.top = `${position.top}px`;
        panel.style.transform = 'none';
        return position;
      }

      function restorePanelPosition(panel) {
        const saved = GM_getValue(PANEL_POSITION_KEY, null);
        if (!saved || !Number.isFinite(Number(saved.left)) || !Number.isFinite(Number(saved.top))) return;
        window.requestAnimationFrame(() => placePanel(panel, saved.left, saved.top));
      }

      function makePanelDraggable(panel, header) {
        let dragState = null;

        const onPointerMove = (event) => {
          if (!dragState || event.pointerId !== dragState.pointerId) return;
          placePanel(
            panel,
            event.clientX - dragState.offsetX,
            event.clientY - dragState.offsetY
          );
          event.preventDefault();
        };

        const finishDrag = (event) => {
          if (!dragState || event.pointerId !== dragState.pointerId) return;
          const rect = panel.getBoundingClientRect();
          const position = placePanel(panel, rect.left, rect.top);
          GM_setValue(PANEL_POSITION_KEY, position);
          dragState = null;
        };

        const onPointerDown = (event) => {
          if (event.button !== 0 || event.target.closest('button, input, select, a, label')) return;
          const rect = panel.getBoundingClientRect();
          placePanel(panel, rect.left, rect.top);
          dragState = {
            pointerId: event.pointerId,
            offsetX: event.clientX - rect.left,
            offsetY: event.clientY - rect.top,
          };
          try {
            header.setPointerCapture(event.pointerId);
          } catch {
            // Window-level listeners below still keep the drag active.
          }
          event.preventDefault();
        };

        const onResize = () => {
          if (panel.style.transform !== 'none') return;
          const rect = panel.getBoundingClientRect();
          placePanel(panel, rect.left, rect.top);
        };

        header.addEventListener('pointerdown', onPointerDown);
        window.addEventListener('pointermove', onPointerMove, { passive: false });
        window.addEventListener('pointerup', finishDrag);
        window.addEventListener('pointercancel', finishDrag);
        window.addEventListener('resize', onResize);

        return () => {
          header.removeEventListener('pointerdown', onPointerDown);
          window.removeEventListener('pointermove', onPointerMove);
          window.removeEventListener('pointerup', finishDrag);
          window.removeEventListener('pointercancel', finishDrag);
          window.removeEventListener('resize', onResize);
        };
      }

      async function renderTeamRows(container, images) {
        container.replaceChildren();
        const players = findPlayerUnits();
        if (!players.length) {
          const empty = document.createElement('div');
          empty.className = 'mwi-avatar-library-empty';
          empty.textContent = '目前畫面沒有偵測到隊伍角色。進入戰鬥後會自動列出自己與隊友。';
          container.appendChild(empty);
          return;
        }

        const imageMap = new Map(images.map((image) => [image.id, image]));
        for (const player of players) {
          const row = document.createElement('div');
          row.className = 'mwi-avatar-team-row';

          const preview = document.createElement('img');
          preview.className = 'mwi-avatar-team-preview';
          preview.alt = `${player.name} 預覽`;

          const name = document.createElement('div');
          name.className = 'mwi-avatar-team-name';
          name.textContent = player.name;
          name.title = player.name;

          const select = document.createElement('select');
          select.className = 'mwi-avatar-team-select';
          const originalOption = document.createElement('option');
          originalOption.value = '';
          originalOption.textContent = '使用遊戲原圖';
          select.appendChild(originalOption);
          for (const image of images) {
            const option = document.createElement('option');
            option.value = image.id;
            option.textContent = image.name;
            select.appendChild(option);
          }
          select.value = assignments[player.key] || '';

          const reset = createButton('原圖', 'secondary');
          reset.addEventListener('click', async () => {
            delete assignments[player.key];
            saveAssignments();
            select.value = '';
            preview.removeAttribute('src');
            await applyAllAvatars();
            setModalStatus(`${player.name} 已恢復遊戲原圖`);
          });

          const updatePreview = () => {
            const record = imageMap.get(select.value);
            const url = imageRecordUrl(record);
            if (url) preview.src = url;
            else preview.removeAttribute('src');
          };
          updatePreview();

          select.addEventListener('change', async () => {
            if (select.value) assignments[player.key] = select.value;
            else delete assignments[player.key];
            saveAssignments();
            updatePreview();
            await applyAllAvatars();
            setModalStatus(`${player.name} 的角色圖已更新`);
          });

          row.append(preview, name, select, reset);
          container.appendChild(row);
        }
      }

      async function renderGallery(container, images) {
        container.replaceChildren();
        if (!images.length) {
          const empty = document.createElement('div');
          empty.className = 'mwi-avatar-library-empty';
          empty.textContent = '圖庫是空的，請匯入圖片。';
          container.appendChild(empty);
          return;
        }

        for (const image of images) {
          const card = document.createElement('article');
          card.className = 'mwi-avatar-gallery-card';

          const preview = document.createElement('img');
          preview.src = imageRecordUrl(image);
          preview.alt = image.name;

          const name = document.createElement('div');
          name.className = 'mwi-avatar-gallery-name';
          name.textContent = image.name;
          name.title = image.name;

          const badge = document.createElement('span');
          badge.className = 'mwi-avatar-gallery-badge';
          badge.textContent = image.builtin ? '內建圖片' : image.sourceUrl ? '網址圖片' : '本機圖片';

          const actions = document.createElement('div');
          actions.className = 'mwi-avatar-gallery-actions';

          const rename = document.createElement('button');
          rename.type = 'button';
          rename.textContent = '改名';
          rename.addEventListener('click', async () => {
            const nextName = (window.prompt('新的圖片名稱：', image.name) || '').trim();
            if (!nextName || nextName === image.name) return;
            await putImage({ ...image, name: nextName });
            setModalStatus(`已重新命名為：${nextName}`);
            await renderModalContents();
          });
          actions.appendChild(rename);

          if (!image.builtin) {
            const remove = document.createElement('button');
            remove.type = 'button';
            remove.textContent = '刪除';
            remove.addEventListener('click', async () => {
              if (!window.confirm(`確定刪除「${image.name}」嗎？`)) return;
              await deleteImage(image.id);
              for (const [key, value] of Object.entries(assignments)) {
                if (value === image.id) delete assignments[key];
              }
              saveAssignments();
              await applyAllAvatars();
              setModalStatus(`已刪除：${image.name}`);
              await renderModalContents();
            });
            actions.appendChild(remove);
          }

          card.append(preview, name, badge, actions);
          container.appendChild(card);
        }
      }

      async function renderModalContents() {
        const teamContainer = document.querySelector('#mwi-avatar-team-list');
        const galleryContainer = document.querySelector('#mwi-avatar-gallery');
        if (!teamContainer || !galleryContainer) return;
        const images = await getAllImages();
        await renderTeamRows(teamContainer, images);
        await renderGallery(galleryContainer, images);
      }

      async function exportBackup() {
        const images = await getAllImages();
        const exportedImages = [];
        for (const image of images) {
          if (image.builtin) continue;
          exportedImages.push({
            id: image.id,
            name: image.name,
            sourceUrl: image.sourceUrl || '',
            dataUrl: image.blob instanceof Blob ? await blobToDataUrl(image.blob) : '',
            createdAt: image.createdAt || Date.now(),
          });
        }
        const backup = {
          format: 'mwi-avatar-library-backup',
          version: 1,
          exportedAt: new Date().toISOString(),
          assignments,
          images: exportedImages,
        };
        const blob = new Blob([JSON.stringify(backup)], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        const anchor = document.createElement('a');
        anchor.href = url;
        anchor.download = `MWI-角色圖庫備份-${new Date().toISOString().slice(0, 10)}.json`;
        document.body.appendChild(anchor);
        anchor.click();
        anchor.remove();
        window.setTimeout(() => URL.revokeObjectURL(url), 1000);
      }

      async function importBackupFile(file) {
        const text = await file.text();
        const backup = JSON.parse(text);
        if (backup?.format !== 'mwi-avatar-library-backup' || !Array.isArray(backup.images)) {
          throw new Error('這不是有效的 MWI 角色圖庫備份');
        }
        for (const image of backup.images) {
          const sourceUrl = typeof image.sourceUrl === 'string' ? image.sourceUrl : '';
          const blob = image.dataUrl ? dataUrlToBlob(image.dataUrl) : null;
          if (!sourceUrl && !blob) continue;
          await putImage({
            id: String(image.id || makeImageId()),
            name: String(image.name || '匯入圖片'),
            sourceUrl,
            blob,
            builtin: false,
            createdAt: Number(image.createdAt) || Date.now(),
          });
        }
        assignments = normalizeAssignments(backup.assignments);
        saveAssignments();
        await applyAllAvatars();
      }

      async function openModal() {
        if (document.querySelector('#mwi-avatar-library-overlay')) return;
        modalOpen = true;
        const overlay = document.createElement('div');
        overlay.id = 'mwi-avatar-library-overlay';

        const panel = document.createElement('section');
        panel.id = 'mwi-avatar-library-panel';
        panel.dataset.avatarLibrarySource = INTEGRATED_IN_MWITOOLS ? 'mwitools' : 'standalone';

        const header = document.createElement('div');
        header.className = 'mwi-avatar-library-header';
        const title = document.createElement('h2');
        title.textContent = 'MWI 自訂角色圖庫';
        const close = document.createElement('button');
        close.type = 'button';
        close.className = 'mwi-avatar-library-close';
        close.textContent = '×';
        close.title = '關閉';
        header.append(title, close);

        const body = document.createElement('div');
        body.className = 'mwi-avatar-library-body';
        const toolbar = document.createElement('div');
        toolbar.className = 'mwi-avatar-library-toolbar';

        const importLocal = createButton('匯入本機圖片');
        const importUrl = createButton('加入圖片網址', 'secondary');
        const exportButton = createButton('匯出圖庫備份', 'secondary');
        const importBackup = createButton('匯入圖庫備份', 'secondary');
        const localInput = document.createElement('input');
        localInput.type = 'file';
        localInput.accept = 'image/png,image/jpeg,image/webp,image/gif';
        localInput.multiple = true;
        localInput.hidden = true;
        const backupInput = document.createElement('input');
        backupInput.type = 'file';
        backupInput.accept = 'application/json,.json';
        backupInput.hidden = true;

        toolbar.append(importLocal, importUrl, exportButton, importBackup, localInput, backupInput);

        const teamSection = document.createElement('section');
        teamSection.className = 'mwi-avatar-library-section';
        teamSection.innerHTML = `
          <h3>目前隊伍（最多五人）</h3>
          <p class="mwi-avatar-library-note">每位角色可選不同圖片；設定會依完整玩家名稱保存。沒有選圖的人維持遊戲原圖。</p>
          <div id="mwi-avatar-team-list" class="mwi-avatar-team-list"></div>
        `;

        const gallerySection = document.createElement('section');
        gallerySection.className = 'mwi-avatar-library-section';
        gallerySection.innerHTML = `
          <h3>角色圖庫</h3>
          <p class="mwi-avatar-library-note">本機圖片匯入時會自動縮成 512×512 WebP；原圖有透明背景時會完整保留。</p>
          <div id="mwi-avatar-gallery" class="mwi-avatar-gallery"></div>
        `;

        const status = document.createElement('div');
        status.id = 'mwi-avatar-library-status';
        status.className = 'mwi-avatar-library-status';

        body.append(toolbar, teamSection, gallerySection, status);
        panel.append(header, body);
        overlay.appendChild(panel);
        document.body.appendChild(overlay);
        restorePanelPosition(panel);
        const destroyPanelDrag = makePanelDraggable(panel, header);

        const closeModal = () => {
          modalOpen = false;
          destroyPanelDrag();
          overlay.remove();
        };
        close.addEventListener('click', closeModal);
        overlay.addEventListener('click', (event) => {
          if (event.target === overlay) closeModal();
        });

        importLocal.addEventListener('click', () => localInput.click());
        localInput.addEventListener('change', async () => {
          try {
            await importLocalFiles(localInput.files, setModalStatus);
            localInput.value = '';
            await renderModalContents();
          } catch (error) {
            setModalStatus(error.message || String(error), true);
          }
        });

        importUrl.addEventListener('click', async () => {
          try {
            await addUrlImage(setModalStatus);
            await renderModalContents();
          } catch (error) {
            setModalStatus(error.message || String(error), true);
          }
        });

        exportButton.addEventListener('click', async () => {
          try {
            await exportBackup();
            setModalStatus('圖庫備份已匯出');
          } catch (error) {
            setModalStatus(error.message || String(error), true);
          }
        });

        importBackup.addEventListener('click', () => backupInput.click());
        backupInput.addEventListener('change', async () => {
          try {
            const file = backupInput.files?.[0];
            if (!file) return;
            await importBackupFile(file);
            backupInput.value = '';
            await renderModalContents();
            setModalStatus('圖庫備份已匯入');
          } catch (error) {
            setModalStatus(error.message || String(error), true);
          }
        });

        await renderModalContents();
      }

      function ensureLauncher() {
        if (document.querySelector('#mwi-avatar-library-launcher')) return;
        const launcher = document.createElement('button');
        launcher.id = 'mwi-avatar-library-launcher';
        launcher.dataset.avatarLibrarySource = INTEGRATED_IN_MWITOOLS ? 'mwitools' : 'standalone';
        launcher.type = 'button';
        launcher.textContent = '🎭';
        launcher.title = '開啟 MWI 自訂角色圖庫';
        launcher.setAttribute('aria-label', '開啟 MWI 自訂角色圖庫');
        launcher.addEventListener('click', () => {
          openModal().catch((error) => {
            console.error(`[${SCRIPT_ID}]`, error);
            window.alert(`角色圖庫開啟失敗：${error.message || error}`);
          });
        });
        document.body.appendChild(launcher);
      }

      async function initialize() {
        await ensureBuiltinImages();
        ensureLauncher();
        await applyAllAvatars();
        const observer = new MutationObserver(queueRefresh);
        observer.observe(document.body, { childList: true, subtree: true });
        GM_registerMenuCommand('開啟 MWI 自訂角色圖庫', () => {
          openModal().catch((error) => console.error(`[${SCRIPT_ID}]`, error));
        });
      }

      const startAvatarLibrary = () => {
        if (INTEGRATED_IN_MWITOOLS) {
          importMigratedAssignments();
          window.setTimeout(async () => {
            if (importMigratedAssignments()) await applyAllAvatars();
          }, 1200);
        }
        initialize().catch((error) => {
          console.error(`[${SCRIPT_ID}] 初始化失敗`, error);
        });
      };

      if (INTEGRATED_IN_MWITOOLS) {
        startAvatarLibrary();
      } else {
        publishAssignmentsForMigration();
        window.setTimeout(() => {
          if (document.documentElement.dataset.mwiToolsAvatarLibrary === 'true') return;
          startAvatarLibrary();
        }, 800);
      }
    })();
    // END EMBEDDED MWI AVATAR LIBRARY

    /* 官方漢化 */
    // /static/js/main.9972e69d.chunk.js
    const ZHItemNames = {
        "/items/coin": "金幣",
        "/items/task_token": "任務代幣",
        "/items/labyrinth_token": "迷宮代幣",
        "/items/chimerical_token": "奇幻代幣",
        "/items/sinister_token": "陰森代幣",
        "/items/enchanted_token": "秘法代幣",
        "/items/pirate_token": "海盜代幣",
        "/items/guild_token": "公會代幣",
        "/items/green_guild_credit": "綠色公會信用點",
        "/items/brown_guild_credit": "棕色公會信用點",
        "/items/white_guild_credit": "白色公會信用點",
        "/items/blue_guild_credit": "藍色公會信用點",
        "/items/purple_guild_credit": "紫色公會信用點",
        "/items/red_guild_credit": "紅色公會信用點",
        "/items/silver_guild_credit": "銀色公會信用點",
        "/items/gold_guild_credit": "金色公會信用點",
        "/items/cowbell": "牛鈴",
        "/items/bag_of_10_cowbells": "牛鈴袋 (10個)",
        "/items/purples_gift": "小紫牛的禮物",
        "/items/small_meteorite_cache": "小隕石艙",
        "/items/medium_meteorite_cache": "中隕石艙",
        "/items/large_meteorite_cache": "大隕石艙",
        "/items/small_artisans_crate": "小工匠匣",
        "/items/medium_artisans_crate": "中工匠匣",
        "/items/large_artisans_crate": "大工匠匣",
        "/items/small_treasure_chest": "小寶箱",
        "/items/medium_treasure_chest": "中寶箱",
        "/items/large_treasure_chest": "大寶箱",
        "/items/chimerical_chest": "奇幻寶箱",
        "/items/chimerical_refinement_chest": "奇幻精煉寶箱",
        "/items/sinister_chest": "陰森寶箱",
        "/items/sinister_refinement_chest": "陰森精煉寶箱",
        "/items/enchanted_chest": "秘法寶箱",
        "/items/enchanted_refinement_chest": "秘法精煉寶箱",
        "/items/pirate_chest": "海盜寶箱",
        "/items/pirate_refinement_chest": "海盜精煉寶箱",
        "/items/purdoras_box_skilling": "紫多拉之盒（生活）",
        "/items/purdoras_box_combat": "紫多拉之盒（戰鬥）",
        "/items/labyrinth_refinement_chest": "迷宮精煉寶箱",
        "/items/seal_of_gathering": "採集卷軸",
        "/items/seal_of_gourmet": "美食卷軸",
        "/items/seal_of_processing": "加工卷軸",
        "/items/seal_of_efficiency": "效率卷軸",
        "/items/seal_of_action_speed": "行動速度卷軸",
        "/items/seal_of_combat_drop": "戰鬥掉落卷軸",
        "/items/seal_of_attack_speed": "攻擊速度卷軸",
        "/items/seal_of_cast_speed": "施法速度卷軸",
        "/items/seal_of_damage": "傷害卷軸",
        "/items/seal_of_critical_rate": "暴擊率卷軸",
        "/items/seal_of_wisdom": "經驗卷軸",
        "/items/seal_of_rare_find": "稀有發現卷軸",
        "/items/blue_key_fragment": "藍色鑰匙碎片",
        "/items/green_key_fragment": "綠色鑰匙碎片",
        "/items/purple_key_fragment": "紫色鑰匙碎片",
        "/items/white_key_fragment": "白色鑰匙碎片",
        "/items/orange_key_fragment": "橙色鑰匙碎片",
        "/items/brown_key_fragment": "棕色鑰匙碎片",
        "/items/stone_key_fragment": "石頭鑰匙碎片",
        "/items/dark_key_fragment": "黑暗鑰匙碎片",
        "/items/burning_key_fragment": "燃燒鑰匙碎片",
        "/items/chimerical_entry_key": "奇幻鑰匙",
        "/items/chimerical_chest_key": "奇幻寶箱鑰匙",
        "/items/sinister_entry_key": "陰森鑰匙",
        "/items/sinister_chest_key": "陰森寶箱鑰匙",
        "/items/enchanted_entry_key": "秘法鑰匙",
        "/items/enchanted_chest_key": "秘法寶箱鑰匙",
        "/items/pirate_entry_key": "海盜鑰匙",
        "/items/pirate_chest_key": "海盜寶箱鑰匙",
        "/items/donut": "甜甜圈",
        "/items/blueberry_donut": "藍莓甜甜圈",
        "/items/blackberry_donut": "黑莓甜甜圈",
        "/items/strawberry_donut": "草莓甜甜圈",
        "/items/mooberry_donut": "哞莓甜甜圈",
        "/items/marsberry_donut": "火星莓甜甜圈",
        "/items/spaceberry_donut": "太空莓甜甜圈",
        "/items/cupcake": "紙杯蛋糕",
        "/items/blueberry_cake": "藍莓蛋糕",
        "/items/blackberry_cake": "黑莓蛋糕",
        "/items/strawberry_cake": "草莓蛋糕",
        "/items/mooberry_cake": "哞莓蛋糕",
        "/items/marsberry_cake": "火星莓蛋糕",
        "/items/spaceberry_cake": "太空莓蛋糕",
        "/items/gummy": "軟糖",
        "/items/apple_gummy": "蘋果軟糖",
        "/items/orange_gummy": "橙子軟糖",
        "/items/plum_gummy": "李子軟糖",
        "/items/peach_gummy": "桃子軟糖",
        "/items/dragon_fruit_gummy": "火龍果軟糖",
        "/items/star_fruit_gummy": "楊桃軟糖",
        "/items/yogurt": "優格",
        "/items/apple_yogurt": "蘋果優格",
        "/items/orange_yogurt": "橙子優格",
        "/items/plum_yogurt": "李子優格",
        "/items/peach_yogurt": "桃子優格",
        "/items/dragon_fruit_yogurt": "火龍果優格",
        "/items/star_fruit_yogurt": "楊桃優格",
        "/items/milking_tea": "擠奶茶",
        "/items/foraging_tea": "採摘茶",
        "/items/woodcutting_tea": "伐木茶",
        "/items/cooking_tea": "烹飪茶",
        "/items/brewing_tea": "沖泡茶",
        "/items/alchemy_tea": "煉金茶",
        "/items/enhancing_tea": "強化茶",
        "/items/cheesesmithing_tea": "乳酪鍛造茶",
        "/items/crafting_tea": "製作茶",
        "/items/tailoring_tea": "縫紉茶",
        "/items/super_milking_tea": "超級擠奶茶",
        "/items/super_foraging_tea": "超級採摘茶",
        "/items/super_woodcutting_tea": "超級伐木茶",
        "/items/super_cooking_tea": "超級烹飪茶",
        "/items/super_brewing_tea": "超級沖泡茶",
        "/items/super_alchemy_tea": "超級煉金茶",
        "/items/super_enhancing_tea": "超級強化茶",
        "/items/super_cheesesmithing_tea": "超級乳酪鍛造茶",
        "/items/super_crafting_tea": "超級製作茶",
        "/items/super_tailoring_tea": "超級縫紉茶",
        "/items/ultra_milking_tea": "究極擠奶茶",
        "/items/ultra_foraging_tea": "究極採摘茶",
        "/items/ultra_woodcutting_tea": "究極伐木茶",
        "/items/ultra_cooking_tea": "究極烹飪茶",
        "/items/ultra_brewing_tea": "究極沖泡茶",
        "/items/ultra_alchemy_tea": "究極煉金茶",
        "/items/ultra_enhancing_tea": "究極強化茶",
        "/items/ultra_cheesesmithing_tea": "究極乳酪鍛造茶",
        "/items/ultra_crafting_tea": "究極製作茶",
        "/items/ultra_tailoring_tea": "究極縫紉茶",
        "/items/gathering_tea": "採集茶",
        "/items/gourmet_tea": "美食茶",
        "/items/wisdom_tea": "經驗茶",
        "/items/processing_tea": "加工茶",
        "/items/efficiency_tea": "效率茶",
        "/items/artisan_tea": "工匠茶",
        "/items/catalytic_tea": "催化茶",
        "/items/blessed_tea": "福氣茶",
        "/items/stamina_coffee": "耐力咖啡",
        "/items/intelligence_coffee": "智力咖啡",
        "/items/defense_coffee": "防禦咖啡",
        "/items/attack_coffee": "攻擊咖啡",
        "/items/melee_coffee": "近戰咖啡",
        "/items/ranged_coffee": "遠程咖啡",
        "/items/magic_coffee": "魔法咖啡",
        "/items/super_stamina_coffee": "超級耐力咖啡",
        "/items/super_intelligence_coffee": "超級智力咖啡",
        "/items/super_defense_coffee": "超級防禦咖啡",
        "/items/super_attack_coffee": "超級攻擊咖啡",
        "/items/super_melee_coffee": "超級近戰咖啡",
        "/items/super_ranged_coffee": "超級遠程咖啡",
        "/items/super_magic_coffee": "超級魔法咖啡",
        "/items/ultra_stamina_coffee": "究極耐力咖啡",
        "/items/ultra_intelligence_coffee": "究極智力咖啡",
        "/items/ultra_defense_coffee": "究極防禦咖啡",
        "/items/ultra_attack_coffee": "究極攻擊咖啡",
        "/items/ultra_melee_coffee": "究極近戰咖啡",
        "/items/ultra_ranged_coffee": "究極遠程咖啡",
        "/items/ultra_magic_coffee": "究極魔法咖啡",
        "/items/wisdom_coffee": "經驗咖啡",
        "/items/lucky_coffee": "幸運咖啡",
        "/items/swiftness_coffee": "迅捷咖啡",
        "/items/channeling_coffee": "吟唱咖啡",
        "/items/critical_coffee": "暴擊咖啡",
        "/items/poke": "破膽之刺",
        "/items/impale": "透骨之刺",
        "/items/puncture": "破甲之刺",
        "/items/penetrating_strike": "貫心之刺",
        "/items/scratch": "爪影斬",
        "/items/cleave": "分裂斬",
        "/items/maim": "血刃斬",
        "/items/crippling_slash": "致殘斬",
        "/items/smack": "重碾",
        "/items/sweep": "重掃",
        "/items/stunning_blow": "重錘",
        "/items/fracturing_impact": "碎裂衝擊",
        "/items/shield_bash": "盾擊",
        "/items/quick_shot": "快速射擊",
        "/items/aqua_arrow": "流水箭",
        "/items/flame_arrow": "烈焰箭",
        "/items/rain_of_arrows": "箭雨",
        "/items/silencing_shot": "沉默之箭",
        "/items/steady_shot": "穩定射擊",
        "/items/pestilent_shot": "疫病射擊",
        "/items/penetrating_shot": "貫穿射擊",
        "/items/water_strike": "流水衝擊",
        "/items/ice_spear": "冰槍術",
        "/items/frost_surge": "冰霜爆裂",
        "/items/mana_spring": "法力噴泉",
        "/items/entangle": "纏繞",
        "/items/toxic_pollen": "劇毒粉塵",
        "/items/natures_veil": "自然菌幕",
        "/items/life_drain": "生命吸取",
        "/items/fireball": "火球",
        "/items/flame_blast": "熔岩爆裂",
        "/items/firestorm": "火焰風暴",
        "/items/smoke_burst": "煙爆滅影",
        "/items/minor_heal": "初級自愈術",
        "/items/heal": "自愈術",
        "/items/quick_aid": "快速治療術",
        "/items/rejuvenate": "群體治療術",
        "/items/taunt": "嘲諷",
        "/items/provoke": "挑釁",
        "/items/toughness": "堅韌",
        "/items/elusiveness": "閃避",
        "/items/precision": "精確",
        "/items/berserk": "狂暴",
        "/items/elemental_affinity": "元素增幅",
        "/items/frenzy": "狂速",
        "/items/spike_shell": "尖刺防護",
        "/items/retribution": "懲戒",
        "/items/vampirism": "吸血",
        "/items/revive": "復活",
        "/items/insanity": "瘋狂",
        "/items/invincible": "無敵",
        "/items/speed_aura": "速度光環",
        "/items/guardian_aura": "守護光環",
        "/items/fierce_aura": "物理光環",
        "/items/critical_aura": "暴擊光環",
        "/items/mystic_aura": "元素光環",
        "/items/gobo_stabber": "哥布林長劍",
        "/items/gobo_slasher": "哥布林關刀",
        "/items/gobo_smasher": "哥布林狼牙棒",
        "/items/spiked_bulwark": "尖刺重盾",
        "/items/werewolf_slasher": "狼人關刀",
        "/items/griffin_bulwark": "獅鷲重盾",
        "/items/griffin_bulwark_refined": "獅鷲重盾 ★",
        "/items/gobo_shooter": "哥布林彈弓",
        "/items/vampiric_bow": "吸血弓",
        "/items/cursed_bow": "咒怨之弓",
        "/items/cursed_bow_refined": "咒怨之弓 ★",
        "/items/gobo_boomstick": "哥布林火棍",
        "/items/cheese_bulwark": "乳酪重盾",
        "/items/verdant_bulwark": "翠綠重盾",
        "/items/azure_bulwark": "蔚藍重盾",
        "/items/burble_bulwark": "深紫重盾",
        "/items/crimson_bulwark": "絳紅重盾",
        "/items/rainbow_bulwark": "彩虹重盾",
        "/items/holy_bulwark": "神聖重盾",
        "/items/wooden_bow": "木弓",
        "/items/birch_bow": "樺木弓",
        "/items/cedar_bow": "雪松弓",
        "/items/purpleheart_bow": "紫心弓",
        "/items/ginkgo_bow": "銀杏弓",
        "/items/redwood_bow": "紅杉弓",
        "/items/arcane_bow": "神秘弓",
        "/items/stalactite_spear": "石鍾長槍",
        "/items/granite_bludgeon": "花崗岩大棒",
        "/items/furious_spear": "狂怒長槍",
        "/items/furious_spear_refined": "狂怒長槍 ★",
        "/items/regal_sword": "君王之劍",
        "/items/regal_sword_refined": "君王之劍 ★",
        "/items/chaotic_flail": "混沌連枷",
        "/items/chaotic_flail_refined": "混沌連枷 ★",
        "/items/soul_hunter_crossbow": "靈魂獵手弩",
        "/items/sundering_crossbow": "裂空之弩",
        "/items/sundering_crossbow_refined": "裂空之弩 ★",
        "/items/frost_staff": "冰霜法杖",
        "/items/infernal_battlestaff": "煉獄法杖",
        "/items/jackalope_staff": "鹿角兔之杖",
        "/items/rippling_trident": "漣漪三叉戟",
        "/items/rippling_trident_refined": "漣漪三叉戟 ★",
        "/items/blooming_trident": "綻放三叉戟",
        "/items/blooming_trident_refined": "綻放三叉戟 ★",
        "/items/blazing_trident": "熾焰三叉戟",
        "/items/blazing_trident_refined": "熾焰三叉戟 ★",
        "/items/cheese_sword": "乳酪劍",
        "/items/verdant_sword": "翠綠劍",
        "/items/azure_sword": "蔚藍劍",
        "/items/burble_sword": "深紫劍",
        "/items/crimson_sword": "絳紅劍",
        "/items/rainbow_sword": "彩虹劍",
        "/items/holy_sword": "神聖劍",
        "/items/cheese_spear": "乳酪長槍",
        "/items/verdant_spear": "翠綠長槍",
        "/items/azure_spear": "蔚藍長槍",
        "/items/burble_spear": "深紫長槍",
        "/items/crimson_spear": "絳紅長槍",
        "/items/rainbow_spear": "彩虹長槍",
        "/items/holy_spear": "神聖長槍",
        "/items/cheese_mace": "乳酪釘頭錘",
        "/items/verdant_mace": "翠綠釘頭錘",
        "/items/azure_mace": "蔚藍釘頭錘",
        "/items/burble_mace": "深紫釘頭錘",
        "/items/crimson_mace": "絳紅釘頭錘",
        "/items/rainbow_mace": "彩虹釘頭錘",
        "/items/holy_mace": "神聖釘頭錘",
        "/items/wooden_crossbow": "木弩",
        "/items/birch_crossbow": "樺木弩",
        "/items/cedar_crossbow": "雪松弩",
        "/items/purpleheart_crossbow": "紫心弩",
        "/items/ginkgo_crossbow": "銀杏弩",
        "/items/redwood_crossbow": "紅杉弩",
        "/items/arcane_crossbow": "神秘弩",
        "/items/wooden_water_staff": "木製水法杖",
        "/items/birch_water_staff": "樺木水法杖",
        "/items/cedar_water_staff": "雪松水法杖",
        "/items/purpleheart_water_staff": "紫心水法杖",
        "/items/ginkgo_water_staff": "銀杏水法杖",
        "/items/redwood_water_staff": "紅杉水法杖",
        "/items/arcane_water_staff": "神秘水法杖",
        "/items/wooden_nature_staff": "木製自然法杖",
        "/items/birch_nature_staff": "樺木自然法杖",
        "/items/cedar_nature_staff": "雪松自然法杖",
        "/items/purpleheart_nature_staff": "紫心自然法杖",
        "/items/ginkgo_nature_staff": "銀杏自然法杖",
        "/items/redwood_nature_staff": "紅杉自然法杖",
        "/items/arcane_nature_staff": "神秘自然法杖",
        "/items/wooden_fire_staff": "木製火法杖",
        "/items/birch_fire_staff": "樺木火法杖",
        "/items/cedar_fire_staff": "雪松火法杖",
        "/items/purpleheart_fire_staff": "紫心火法杖",
        "/items/ginkgo_fire_staff": "銀杏火法杖",
        "/items/redwood_fire_staff": "紅杉火法杖",
        "/items/arcane_fire_staff": "神秘火法杖",
        "/items/eye_watch": "掌上監工",
        "/items/snake_fang_dirk": "蛇牙短劍",
        "/items/vision_shield": "視覺盾",
        "/items/gobo_defender": "哥布林防禦者",
        "/items/vampire_fang_dirk": "吸血鬼短劍",
        "/items/knights_aegis": "騎士盾",
        "/items/knights_aegis_refined": "騎士盾 ★",
        "/items/treant_shield": "樹人盾",
        "/items/manticore_shield": "蠍獅盾",
        "/items/tome_of_healing": "治療之書",
        "/items/tome_of_the_elements": "元素之書",
        "/items/watchful_relic": "警戒遺物",
        "/items/bishops_codex": "主教法典",
        "/items/bishops_codex_refined": "主教法典 ★",
        "/items/cheese_buckler": "乳酪圓盾",
        "/items/verdant_buckler": "翠綠圓盾",
        "/items/azure_buckler": "蔚藍圓盾",
        "/items/burble_buckler": "深紫圓盾",
        "/items/crimson_buckler": "絳紅圓盾",
        "/items/rainbow_buckler": "彩虹圓盾",
        "/items/holy_buckler": "神聖圓盾",
        "/items/wooden_shield": "木盾",
        "/items/birch_shield": "樺木盾",
        "/items/cedar_shield": "雪松盾",
        "/items/purpleheart_shield": "紫心盾",
        "/items/ginkgo_shield": "銀杏盾",
        "/items/redwood_shield": "紅杉盾",
        "/items/arcane_shield": "神秘盾",
        "/items/gatherer_cape": "採集者披風",
        "/items/gatherer_cape_refined": "採集者披風 ★",
        "/items/artificer_cape": "工匠披風",
        "/items/artificer_cape_refined": "工匠披風 ★",
        "/items/culinary_cape": "廚師披風",
        "/items/culinary_cape_refined": "廚師披風 ★",
        "/items/chance_cape": "機緣披風",
        "/items/chance_cape_refined": "機緣披風 ★",
        "/items/sinister_cape": "陰森披風",
        "/items/sinister_cape_refined": "陰森披風 ★",
        "/items/chimerical_quiver": "奇幻箭袋",
        "/items/chimerical_quiver_refined": "奇幻箭袋 ★",
        "/items/enchanted_cloak": "秘法披風",
        "/items/enchanted_cloak_refined": "秘法披風 ★",
        "/items/red_culinary_hat": "紅色廚師帽",
        "/items/snail_shell_helmet": "蝸牛殼頭盔",
        "/items/vision_helmet": "視覺頭盔",
        "/items/fluffy_red_hat": "蓬鬆紅帽子",
        "/items/corsair_helmet": "掠奪者頭盔",
        "/items/corsair_helmet_refined": "掠奪者頭盔 ★",
        "/items/acrobatic_hood": "雜技師兜帽",
        "/items/acrobatic_hood_refined": "雜技師兜帽 ★",
        "/items/magicians_hat": "魔術師帽",
        "/items/magicians_hat_refined": "魔術師帽 ★",
        "/items/cheese_helmet": "乳酪頭盔",
        "/items/verdant_helmet": "翠綠頭盔",
        "/items/azure_helmet": "蔚藍頭盔",
        "/items/burble_helmet": "深紫頭盔",
        "/items/crimson_helmet": "絳紅頭盔",
        "/items/rainbow_helmet": "彩虹頭盔",
        "/items/holy_helmet": "神聖頭盔",
        "/items/rough_hood": "粗糙兜帽",
        "/items/reptile_hood": "爬行動物兜帽",
        "/items/gobo_hood": "哥布林兜帽",
        "/items/beast_hood": "野獸兜帽",
        "/items/umbral_hood": "暗影兜帽",
        "/items/cotton_hat": "棉帽",
        "/items/linen_hat": "亞麻帽",
        "/items/bamboo_hat": "竹帽",
        "/items/silk_hat": "絲帽",
        "/items/radiant_hat": "光輝帽",
        "/items/dairyhands_top": "擠奶工上衣",
        "/items/foragers_top": "採摘者上衣",
        "/items/lumberjacks_top": "伐木工上衣",
        "/items/cheesemakers_top": "乳酪師上衣",
        "/items/crafters_top": "工匠上衣",
        "/items/tailors_top": "裁縫上衣",
        "/items/chefs_top": "廚師上衣",
        "/items/brewers_top": "飲品師上衣",
        "/items/alchemists_top": "煉金師上衣",
        "/items/enhancers_top": "強化師上衣",
        "/items/gator_vest": "鱷魚馬甲",
        "/items/turtle_shell_body": "龜殼胸甲",
        "/items/colossus_plate_body": "巨像胸甲",
        "/items/demonic_plate_body": "惡魔胸甲",
        "/items/anchorbound_plate_body": "錨定胸甲",
        "/items/anchorbound_plate_body_refined": "錨定胸甲 ★",
        "/items/maelstrom_plate_body": "怒濤胸甲",
        "/items/maelstrom_plate_body_refined": "怒濤胸甲 ★",
        "/items/marine_tunic": "海洋皮衣",
        "/items/revenant_tunic": "亡靈皮衣",
        "/items/griffin_tunic": "獅鷲皮衣",
        "/items/kraken_tunic": "克拉肯皮衣",
        "/items/kraken_tunic_refined": "克拉肯皮衣 ★",
        "/items/icy_robe_top": "冰霜袍服",
        "/items/flaming_robe_top": "烈焰袍服",
        "/items/luna_robe_top": "月神袍服",
        "/items/royal_water_robe_top": "皇家水系袍服",
        "/items/royal_water_robe_top_refined": "皇家水系袍服 ★",
        "/items/royal_nature_robe_top": "皇家自然系袍服",
        "/items/royal_nature_robe_top_refined": "皇家自然系袍服 ★",
        "/items/royal_fire_robe_top": "皇家火系袍服",
        "/items/royal_fire_robe_top_refined": "皇家火系袍服 ★",
        "/items/cheese_plate_body": "乳酪胸甲",
        "/items/verdant_plate_body": "翠綠胸甲",
        "/items/azure_plate_body": "蔚藍胸甲",
        "/items/burble_plate_body": "深紫胸甲",
        "/items/crimson_plate_body": "絳紅胸甲",
        "/items/rainbow_plate_body": "彩虹胸甲",
        "/items/holy_plate_body": "神聖胸甲",
        "/items/rough_tunic": "粗糙皮衣",
        "/items/reptile_tunic": "爬行動物皮衣",
        "/items/gobo_tunic": "哥布林皮衣",
        "/items/beast_tunic": "野獸皮衣",
        "/items/umbral_tunic": "暗影皮衣",
        "/items/cotton_robe_top": "棉袍服",
        "/items/linen_robe_top": "亞麻袍服",
        "/items/bamboo_robe_top": "竹袍服",
        "/items/silk_robe_top": "絲綢袍服",
        "/items/radiant_robe_top": "光輝袍服",
        "/items/dairyhands_bottoms": "擠奶工下裝",
        "/items/foragers_bottoms": "採摘者下裝",
        "/items/lumberjacks_bottoms": "伐木工下裝",
        "/items/cheesemakers_bottoms": "乳酪師下裝",
        "/items/crafters_bottoms": "工匠下裝",
        "/items/tailors_bottoms": "裁縫下裝",
        "/items/chefs_bottoms": "廚師下裝",
        "/items/brewers_bottoms": "飲品師下裝",
        "/items/alchemists_bottoms": "煉金師下裝",
        "/items/enhancers_bottoms": "強化師下裝",
        "/items/turtle_shell_legs": "龜殼腿甲",
        "/items/colossus_plate_legs": "巨像腿甲",
        "/items/demonic_plate_legs": "惡魔腿甲",
        "/items/anchorbound_plate_legs": "錨定腿甲",
        "/items/anchorbound_plate_legs_refined": "錨定腿甲 ★",
        "/items/maelstrom_plate_legs": "怒濤腿甲",
        "/items/maelstrom_plate_legs_refined": "怒濤腿甲 ★",
        "/items/marine_chaps": "航海皮褲",
        "/items/revenant_chaps": "亡靈皮褲",
        "/items/griffin_chaps": "獅鷲皮褲",
        "/items/kraken_chaps": "克拉肯皮褲",
        "/items/kraken_chaps_refined": "克拉肯皮褲 ★",
        "/items/icy_robe_bottoms": "冰霜袍裙",
        "/items/flaming_robe_bottoms": "烈焰袍裙",
        "/items/luna_robe_bottoms": "月神袍裙",
        "/items/royal_water_robe_bottoms": "皇家水系袍裙",
        "/items/royal_water_robe_bottoms_refined": "皇家水系袍裙 ★",
        "/items/royal_nature_robe_bottoms": "皇家自然系袍裙",
        "/items/royal_nature_robe_bottoms_refined": "皇家自然系袍裙 ★",
        "/items/royal_fire_robe_bottoms": "皇家火系袍裙",
        "/items/royal_fire_robe_bottoms_refined": "皇家火系袍裙 ★",
        "/items/cheese_plate_legs": "乳酪腿甲",
        "/items/verdant_plate_legs": "翠綠腿甲",
        "/items/azure_plate_legs": "蔚藍腿甲",
        "/items/burble_plate_legs": "深紫腿甲",
        "/items/crimson_plate_legs": "絳紅腿甲",
        "/items/rainbow_plate_legs": "彩虹腿甲",
        "/items/holy_plate_legs": "神聖腿甲",
        "/items/rough_chaps": "粗糙皮褲",
        "/items/reptile_chaps": "爬行動物皮褲",
        "/items/gobo_chaps": "哥布林皮褲",
        "/items/beast_chaps": "野獸皮褲",
        "/items/umbral_chaps": "暗影皮褲",
        "/items/cotton_robe_bottoms": "棉袍裙",
        "/items/linen_robe_bottoms": "亞麻袍裙",
        "/items/bamboo_robe_bottoms": "竹袍裙",
        "/items/silk_robe_bottoms": "絲綢袍裙",
        "/items/radiant_robe_bottoms": "光輝袍裙",
        "/items/enchanted_gloves": "附魔手套",
        "/items/pincer_gloves": "蟹鉗手套",
        "/items/panda_gloves": "熊貓手套",
        "/items/magnetic_gloves": "磁力手套",
        "/items/dodocamel_gauntlets": "渡渡駝護手",
        "/items/dodocamel_gauntlets_refined": "渡渡駝護手 ★",
        "/items/sighted_bracers": "瞄準護腕",
        "/items/marksman_bracers": "神射護腕",
        "/items/marksman_bracers_refined": "神射護腕 ★",
        "/items/chrono_gloves": "時空手套",
        "/items/cheese_gauntlets": "乳酪護手",
        "/items/verdant_gauntlets": "翠綠護手",
        "/items/azure_gauntlets": "蔚藍護手",
        "/items/burble_gauntlets": "深紫護手",
        "/items/crimson_gauntlets": "絳紅護手",
        "/items/rainbow_gauntlets": "彩虹護手",
        "/items/holy_gauntlets": "神聖護手",
        "/items/rough_bracers": "粗糙護腕",
        "/items/reptile_bracers": "爬行動物護腕",
        "/items/gobo_bracers": "哥布林護腕",
        "/items/beast_bracers": "野獸護腕",
        "/items/umbral_bracers": "暗影護腕",
        "/items/cotton_gloves": "棉手套",
        "/items/linen_gloves": "亞麻手套",
        "/items/bamboo_gloves": "竹手套",
        "/items/silk_gloves": "絲手套",
        "/items/radiant_gloves": "光輝手套",
        "/items/collectors_boots": "收藏家靴",
        "/items/shoebill_shoes": "鯨頭鸛鞋",
        "/items/black_bear_shoes": "黑熊鞋",
        "/items/grizzly_bear_shoes": "棕熊鞋",
        "/items/polar_bear_shoes": "北極熊鞋",
        "/items/pathbreaker_boots": "開路者靴",
        "/items/pathbreaker_boots_refined": "開路者靴 ★",
        "/items/centaur_boots": "半人馬靴",
        "/items/pathfinder_boots": "探路者靴",
        "/items/pathfinder_boots_refined": "探路者靴 ★",
        "/items/sorcerer_boots": "巫師靴",
        "/items/pathseeker_boots": "尋路者靴",
        "/items/pathseeker_boots_refined": "尋路者靴 ★",
        "/items/cheese_boots": "乳酪靴",
        "/items/verdant_boots": "翠綠靴",
        "/items/azure_boots": "蔚藍靴",
        "/items/burble_boots": "深紫靴",
        "/items/crimson_boots": "絳紅靴",
        "/items/rainbow_boots": "彩虹靴",
        "/items/holy_boots": "神聖靴",
        "/items/rough_boots": "粗糙靴",
        "/items/reptile_boots": "爬行動物靴",
        "/items/gobo_boots": "哥布林靴",
        "/items/beast_boots": "野獸靴",
        "/items/umbral_boots": "暗影靴",
        "/items/cotton_boots": "棉靴",
        "/items/linen_boots": "亞麻靴",
        "/items/bamboo_boots": "竹靴",
        "/items/silk_boots": "絲靴",
        "/items/radiant_boots": "光輝靴",
        "/items/small_pouch": "小袋子",
        "/items/medium_pouch": "中袋子",
        "/items/large_pouch": "大袋子",
        "/items/giant_pouch": "巨大袋子",
        "/items/gluttonous_pouch": "貪食之袋",
        "/items/guzzling_pouch": "暴飲之囊",
        "/items/necklace_of_efficiency": "效率項鍊",
        "/items/fighter_necklace": "戰士項鍊",
        "/items/ranger_necklace": "射手項鍊",
        "/items/wizard_necklace": "巫師項鍊",
        "/items/necklace_of_wisdom": "經驗項鍊",
        "/items/necklace_of_speed": "速度項鍊",
        "/items/philosophers_necklace": "賢者項鍊",
        "/items/earrings_of_gathering": "採集耳環",
        "/items/earrings_of_essence_find": "精華發現耳環",
        "/items/earrings_of_armor": "護甲耳環",
        "/items/earrings_of_regeneration": "恢復耳環",
        "/items/earrings_of_resistance": "抗性耳環",
        "/items/earrings_of_rare_find": "稀有發現耳環",
        "/items/earrings_of_critical_strike": "暴擊耳環",
        "/items/philosophers_earrings": "賢者耳環",
        "/items/ring_of_gathering": "採集戒指",
        "/items/ring_of_essence_find": "精華發現戒指",
        "/items/ring_of_armor": "護甲戒指",
        "/items/ring_of_regeneration": "恢復戒指",
        "/items/ring_of_resistance": "抗性戒指",
        "/items/ring_of_rare_find": "稀有發現戒指",
        "/items/ring_of_critical_strike": "暴擊戒指",
        "/items/philosophers_ring": "賢者戒指",
        "/items/trainee_milking_charm": "實習擠奶護符",
        "/items/basic_milking_charm": "基礎擠奶護符",
        "/items/advanced_milking_charm": "高階擠奶護符",
        "/items/expert_milking_charm": "專家擠奶護符",
        "/items/master_milking_charm": "大師擠奶護符",
        "/items/grandmaster_milking_charm": "宗師擠奶護符",
        "/items/trainee_foraging_charm": "實習採摘護符",
        "/items/basic_foraging_charm": "基礎採摘護符",
        "/items/advanced_foraging_charm": "高階採摘護符",
        "/items/expert_foraging_charm": "專家採摘護符",
        "/items/master_foraging_charm": "大師採摘護符",
        "/items/grandmaster_foraging_charm": "宗師採摘護符",
        "/items/trainee_woodcutting_charm": "實習伐木護符",
        "/items/basic_woodcutting_charm": "基礎伐木護符",
        "/items/advanced_woodcutting_charm": "高階伐木護符",
        "/items/expert_woodcutting_charm": "專家伐木護符",
        "/items/master_woodcutting_charm": "大師伐木護符",
        "/items/grandmaster_woodcutting_charm": "宗師伐木護符",
        "/items/trainee_cheesesmithing_charm": "實習乳酪鍛造護符",
        "/items/basic_cheesesmithing_charm": "基礎乳酪鍛造護符",
        "/items/advanced_cheesesmithing_charm": "高階乳酪鍛造護符",
        "/items/expert_cheesesmithing_charm": "專家乳酪鍛造護符",
        "/items/master_cheesesmithing_charm": "大師乳酪鍛造護符",
        "/items/grandmaster_cheesesmithing_charm": "宗師乳酪鍛造護符",
        "/items/trainee_crafting_charm": "實習製作護符",
        "/items/basic_crafting_charm": "基礎製作護符",
        "/items/advanced_crafting_charm": "高階製作護符",
        "/items/expert_crafting_charm": "專家制作護符",
        "/items/master_crafting_charm": "大師製作護符",
        "/items/grandmaster_crafting_charm": "宗師製作護符",
        "/items/trainee_tailoring_charm": "實習縫紉護符",
        "/items/basic_tailoring_charm": "基礎縫紉護符",
        "/items/advanced_tailoring_charm": "高階縫紉護符",
        "/items/expert_tailoring_charm": "專家縫紉護符",
        "/items/master_tailoring_charm": "大師縫紉護符",
        "/items/grandmaster_tailoring_charm": "宗師縫紉護符",
        "/items/trainee_cooking_charm": "實習烹飪護符",
        "/items/basic_cooking_charm": "基礎烹飪護符",
        "/items/advanced_cooking_charm": "高階烹飪護符",
        "/items/expert_cooking_charm": "專家烹飪護符",
        "/items/master_cooking_charm": "大師烹飪護符",
        "/items/grandmaster_cooking_charm": "宗師烹飪護符",
        "/items/trainee_brewing_charm": "實習沖泡護符",
        "/items/basic_brewing_charm": "基礎沖泡護符",
        "/items/advanced_brewing_charm": "高階沖泡護符",
        "/items/expert_brewing_charm": "專家沖泡護符",
        "/items/master_brewing_charm": "大師沖泡護符",
        "/items/grandmaster_brewing_charm": "宗師沖泡護符",
        "/items/trainee_alchemy_charm": "實習煉金護符",
        "/items/basic_alchemy_charm": "基礎煉金護符",
        "/items/advanced_alchemy_charm": "高階煉金護符",
        "/items/expert_alchemy_charm": "專家煉金護符",
        "/items/master_alchemy_charm": "大師煉金護符",
        "/items/grandmaster_alchemy_charm": "宗師煉金護符",
        "/items/trainee_enhancing_charm": "實習強化護符",
        "/items/basic_enhancing_charm": "基礎強化護符",
        "/items/advanced_enhancing_charm": "高階強化護符",
        "/items/expert_enhancing_charm": "專家強化護符",
        "/items/master_enhancing_charm": "大師強化護符",
        "/items/grandmaster_enhancing_charm": "宗師強化護符",
        "/items/trainee_stamina_charm": "實習耐力護符",
        "/items/basic_stamina_charm": "基礎耐力護符",
        "/items/advanced_stamina_charm": "高階耐力護符",
        "/items/expert_stamina_charm": "專家耐力護符",
        "/items/master_stamina_charm": "大師耐力護符",
        "/items/grandmaster_stamina_charm": "宗師耐力護符",
        "/items/trainee_intelligence_charm": "實習智力護符",
        "/items/basic_intelligence_charm": "基礎智力護符",
        "/items/advanced_intelligence_charm": "高階智力護符",
        "/items/expert_intelligence_charm": "專家智力護符",
        "/items/master_intelligence_charm": "大師智力護符",
        "/items/grandmaster_intelligence_charm": "宗師智力護符",
        "/items/trainee_attack_charm": "實習攻擊護符",
        "/items/basic_attack_charm": "基礎攻擊護符",
        "/items/advanced_attack_charm": "高階攻擊護符",
        "/items/expert_attack_charm": "專家攻擊護符",
        "/items/master_attack_charm": "大師攻擊護符",
        "/items/grandmaster_attack_charm": "宗師攻擊護符",
        "/items/trainee_defense_charm": "實習防禦護符",
        "/items/basic_defense_charm": "基礎防禦護符",
        "/items/advanced_defense_charm": "高階防禦護符",
        "/items/expert_defense_charm": "專家防禦護符",
        "/items/master_defense_charm": "大師防禦護符",
        "/items/grandmaster_defense_charm": "宗師防禦護符",
        "/items/trainee_melee_charm": "實習近戰護符",
        "/items/basic_melee_charm": "基礎近戰護符",
        "/items/advanced_melee_charm": "高階近戰護符",
        "/items/expert_melee_charm": "專家近戰護符",
        "/items/master_melee_charm": "大師近戰護符",
        "/items/grandmaster_melee_charm": "宗師近戰護符",
        "/items/trainee_ranged_charm": "實習遠程護符",
        "/items/basic_ranged_charm": "基礎遠程護符",
        "/items/advanced_ranged_charm": "高階遠程護符",
        "/items/expert_ranged_charm": "專家遠程護符",
        "/items/master_ranged_charm": "大師遠程護符",
        "/items/grandmaster_ranged_charm": "宗師遠程護符",
        "/items/trainee_magic_charm": "實習魔法護符",
        "/items/basic_magic_charm": "基礎魔法護符",
        "/items/advanced_magic_charm": "高階魔法護符",
        "/items/expert_magic_charm": "專家魔法護符",
        "/items/master_magic_charm": "大師魔法護符",
        "/items/grandmaster_magic_charm": "宗師魔法護符",
        "/items/basic_task_badge": "基礎任務徽章",
        "/items/advanced_task_badge": "高階任務徽章",
        "/items/expert_task_badge": "專家任務徽章",
        "/items/celestial_brush": "星空刷子",
        "/items/cheese_brush": "乳酪刷子",
        "/items/verdant_brush": "翠綠刷子",
        "/items/azure_brush": "蔚藍刷子",
        "/items/burble_brush": "深紫刷子",
        "/items/crimson_brush": "絳紅刷子",
        "/items/rainbow_brush": "彩虹刷子",
        "/items/holy_brush": "神聖刷子",
        "/items/celestial_shears": "星空剪刀",
        "/items/cheese_shears": "乳酪剪刀",
        "/items/verdant_shears": "翠綠剪刀",
        "/items/azure_shears": "蔚藍剪刀",
        "/items/burble_shears": "深紫剪刀",
        "/items/crimson_shears": "絳紅剪刀",
        "/items/rainbow_shears": "彩虹剪刀",
        "/items/holy_shears": "神聖剪刀",
        "/items/celestial_hatchet": "星空斧頭",
        "/items/cheese_hatchet": "乳酪斧頭",
        "/items/verdant_hatchet": "翠綠斧頭",
        "/items/azure_hatchet": "蔚藍斧頭",
        "/items/burble_hatchet": "深紫斧頭",
        "/items/crimson_hatchet": "絳紅斧頭",
        "/items/rainbow_hatchet": "彩虹斧頭",
        "/items/holy_hatchet": "神聖斧頭",
        "/items/celestial_hammer": "星空錘子",
        "/items/cheese_hammer": "乳酪錘子",
        "/items/verdant_hammer": "翠綠錘子",
        "/items/azure_hammer": "蔚藍錘子",
        "/items/burble_hammer": "深紫錘子",
        "/items/crimson_hammer": "絳紅錘子",
        "/items/rainbow_hammer": "彩虹錘子",
        "/items/holy_hammer": "神聖錘子",
        "/items/celestial_chisel": "星空鑿子",
        "/items/cheese_chisel": "乳酪鑿子",
        "/items/verdant_chisel": "翠綠鑿子",
        "/items/azure_chisel": "蔚藍鑿子",
        "/items/burble_chisel": "深紫鑿子",
        "/items/crimson_chisel": "絳紅鑿子",
        "/items/rainbow_chisel": "彩虹鑿子",
        "/items/holy_chisel": "神聖鑿子",
        "/items/celestial_needle": "星空針",
        "/items/cheese_needle": "乳酪針",
        "/items/verdant_needle": "翠綠針",
        "/items/azure_needle": "蔚藍針",
        "/items/burble_needle": "深紫針",
        "/items/crimson_needle": "絳紅針",
        "/items/rainbow_needle": "彩虹針",
        "/items/holy_needle": "神聖針",
        "/items/celestial_spatula": "星空鍋鏟",
        "/items/cheese_spatula": "乳酪鍋鏟",
        "/items/verdant_spatula": "翠綠鍋鏟",
        "/items/azure_spatula": "蔚藍鍋鏟",
        "/items/burble_spatula": "深紫鍋鏟",
        "/items/crimson_spatula": "絳紅鍋鏟",
        "/items/rainbow_spatula": "彩虹鍋鏟",
        "/items/holy_spatula": "神聖鍋鏟",
        "/items/celestial_pot": "星空壺",
        "/items/cheese_pot": "乳酪壺",
        "/items/verdant_pot": "翠綠壺",
        "/items/azure_pot": "蔚藍壺",
        "/items/burble_pot": "深紫壺",
        "/items/crimson_pot": "絳紅壺",
        "/items/rainbow_pot": "彩虹壺",
        "/items/holy_pot": "神聖壺",
        "/items/celestial_alembic": "星空蒸餾器",
        "/items/cheese_alembic": "乳酪蒸餾器",
        "/items/verdant_alembic": "翠綠蒸餾器",
        "/items/azure_alembic": "蔚藍蒸餾器",
        "/items/burble_alembic": "深紫蒸餾器",
        "/items/crimson_alembic": "絳紅蒸餾器",
        "/items/rainbow_alembic": "彩虹蒸餾器",
        "/items/holy_alembic": "神聖蒸餾器",
        "/items/celestial_enhancer": "星空強化器",
        "/items/cheese_enhancer": "乳酪強化器",
        "/items/verdant_enhancer": "翠綠強化器",
        "/items/azure_enhancer": "蔚藍強化器",
        "/items/burble_enhancer": "深紫強化器",
        "/items/crimson_enhancer": "絳紅強化器",
        "/items/rainbow_enhancer": "彩虹強化器",
        "/items/holy_enhancer": "神聖強化器",
        "/items/milk": "牛奶",
        "/items/verdant_milk": "翠綠牛奶",
        "/items/azure_milk": "蔚藍牛奶",
        "/items/burble_milk": "深紫牛奶",
        "/items/crimson_milk": "絳紅牛奶",
        "/items/rainbow_milk": "彩虹牛奶",
        "/items/holy_milk": "神聖牛奶",
        "/items/cheese": "乳酪",
        "/items/verdant_cheese": "翠綠乳酪",
        "/items/azure_cheese": "蔚藍乳酪",
        "/items/burble_cheese": "深紫乳酪",
        "/items/crimson_cheese": "絳紅乳酪",
        "/items/rainbow_cheese": "彩虹乳酪",
        "/items/holy_cheese": "神聖乳酪",
        "/items/log": "原木",
        "/items/birch_log": "白樺原木",
        "/items/cedar_log": "雪松原木",
        "/items/purpleheart_log": "紫心原木",
        "/items/ginkgo_log": "銀杏原木",
        "/items/redwood_log": "紅杉原木",
        "/items/arcane_log": "神秘原木",
        "/items/lumber": "木板",
        "/items/birch_lumber": "白樺木板",
        "/items/cedar_lumber": "雪松木板",
        "/items/purpleheart_lumber": "紫心木板",
        "/items/ginkgo_lumber": "銀杏木板",
        "/items/redwood_lumber": "紅杉木板",
        "/items/arcane_lumber": "神秘木板",
        "/items/rough_hide": "粗糙獸皮",
        "/items/reptile_hide": "爬行動物皮",
        "/items/gobo_hide": "哥布林皮",
        "/items/beast_hide": "野獸皮",
        "/items/umbral_hide": "暗影皮",
        "/items/rough_leather": "粗糙皮革",
        "/items/reptile_leather": "爬行動物皮革",
        "/items/gobo_leather": "哥布林皮革",
        "/items/beast_leather": "野獸皮革",
        "/items/umbral_leather": "暗影皮革",
        "/items/cotton": "棉花",
        "/items/flax": "亞麻",
        "/items/bamboo_branch": "竹子",
        "/items/cocoon": "蠶繭",
        "/items/radiant_fiber": "光輝纖維",
        "/items/cotton_fabric": "棉花布料",
        "/items/linen_fabric": "亞麻布料",
        "/items/bamboo_fabric": "竹子布料",
        "/items/silk_fabric": "絲綢",
        "/items/radiant_fabric": "光輝布料",
        "/items/egg": "雞蛋",
        "/items/wheat": "小麥",
        "/items/sugar": "糖",
        "/items/blueberry": "藍莓",
        "/items/blackberry": "黑莓",
        "/items/strawberry": "草莓",
        "/items/mooberry": "哞莓",
        "/items/marsberry": "火星莓",
        "/items/spaceberry": "太空莓",
        "/items/apple": "蘋果",
        "/items/orange": "橙子",
        "/items/plum": "李子",
        "/items/peach": "桃子",
        "/items/dragon_fruit": "火龍果",
        "/items/star_fruit": "楊桃",
        "/items/arabica_coffee_bean": "低階咖啡豆",
        "/items/robusta_coffee_bean": "中級咖啡豆",
        "/items/liberica_coffee_bean": "高階咖啡豆",
        "/items/excelsa_coffee_bean": "特級咖啡豆",
        "/items/fieriosa_coffee_bean": "火山咖啡豆",
        "/items/spacia_coffee_bean": "太空咖啡豆",
        "/items/green_tea_leaf": "綠茶葉",
        "/items/black_tea_leaf": "黑茶葉",
        "/items/burble_tea_leaf": "紫茶葉",
        "/items/moolong_tea_leaf": "哞龍茶葉",
        "/items/red_tea_leaf": "紅茶葉",
        "/items/emp_tea_leaf": "虛空茶葉",
        "/items/catalyst_of_coinification": "點金催化劑",
        "/items/catalyst_of_decomposition": "分解催化劑",
        "/items/catalyst_of_transmutation": "轉化催化劑",
        "/items/prime_catalyst": "至高催化劑",
        "/items/snake_fang": "蛇牙",
        "/items/shoebill_feather": "鯨頭鸛羽毛",
        "/items/snail_shell": "蝸牛殼",
        "/items/crab_pincer": "蟹鉗",
        "/items/turtle_shell": "烏龜殼",
        "/items/marine_scale": "海洋鱗片",
        "/items/treant_bark": "樹皮",
        "/items/centaur_hoof": "半人馬蹄",
        "/items/luna_wing": "月神翼",
        "/items/gobo_rag": "哥布林抹布",
        "/items/goggles": "護目鏡",
        "/items/magnifying_glass": "放大鏡",
        "/items/eye_of_the_watcher": "觀察者之眼",
        "/items/icy_cloth": "冰霜織物",
        "/items/flaming_cloth": "烈焰織物",
        "/items/sorcerers_sole": "魔法師鞋底",
        "/items/chrono_sphere": "時空球",
        "/items/frost_sphere": "冰霜球",
        "/items/panda_fluff": "熊貓絨",
        "/items/black_bear_fluff": "黑熊絨",
        "/items/grizzly_bear_fluff": "棕熊絨",
        "/items/polar_bear_fluff": "北極熊絨",
        "/items/red_panda_fluff": "小熊貓絨",
        "/items/magnet": "磁鐵",
        "/items/stalactite_shard": "鐘乳石碎片",
        "/items/living_granite": "花崗岩",
        "/items/colossus_core": "巨像核心",
        "/items/vampire_fang": "吸血鬼之牙",
        "/items/werewolf_claw": "狼人之爪",
        "/items/revenant_anima": "亡者之魂",
        "/items/soul_fragment": "靈魂碎片",
        "/items/infernal_ember": "地獄餘燼",
        "/items/demonic_core": "惡魔核心",
        "/items/griffin_leather": "獅鷲之皮",
        "/items/manticore_sting": "蠍獅之刺",
        "/items/jackalope_antler": "鹿角兔之角",
        "/items/dodocamel_plume": "渡渡駝之翎",
        "/items/griffin_talon": "獅鷲之爪",
        "/items/chimerical_refinement_shard": "奇幻精煉碎片",
        "/items/acrobats_ribbon": "雜技師綵帶",
        "/items/magicians_cloth": "魔術師織物",
        "/items/chaotic_chain": "混沌鎖鏈",
        "/items/cursed_ball": "詛咒之球",
        "/items/sinister_refinement_shard": "陰森精煉碎片",
        "/items/royal_cloth": "皇家織物",
        "/items/knights_ingot": "騎士之錠",
        "/items/bishops_scroll": "主教卷軸",
        "/items/regal_jewel": "君王寶石",
        "/items/sundering_jewel": "裂空寶石",
        "/items/enchanted_refinement_shard": "秘法精煉碎片",
        "/items/marksman_brooch": "神射胸針",
        "/items/corsair_crest": "掠奪者徽章",
        "/items/damaged_anchor": "破損船錨",
        "/items/maelstrom_plating": "怒濤甲片",
        "/items/kraken_leather": "克拉肯皮革",
        "/items/kraken_fang": "克拉肯之牙",
        "/items/pirate_refinement_shard": "海盜精煉碎片",
        "/items/pathbreaker_lodestone": "開路者磁石",
        "/items/pathfinder_lodestone": "探路者磁石",
        "/items/pathseeker_lodestone": "尋路者磁石",
        "/items/labyrinth_refinement_shard": "迷宮精煉碎片",
        "/items/butter_of_proficiency": "精通之油",
        "/items/thread_of_expertise": "專精之線",
        "/items/branch_of_insight": "洞察之枝",
        "/items/gluttonous_energy": "貪食能量",
        "/items/guzzling_energy": "暴飲能量",
        "/items/milking_essence": "擠奶精華",
        "/items/foraging_essence": "採摘精華",
        "/items/woodcutting_essence": "伐木精華",
        "/items/cheesesmithing_essence": "乳酪鍛造精華",
        "/items/crafting_essence": "製作精華",
        "/items/tailoring_essence": "縫紉精華",
        "/items/cooking_essence": "烹飪精華",
        "/items/brewing_essence": "沖泡精華",
        "/items/alchemy_essence": "煉金精華",
        "/items/enhancing_essence": "強化精華",
        "/items/swamp_essence": "沼澤精華",
        "/items/aqua_essence": "海洋精華",
        "/items/jungle_essence": "叢林精華",
        "/items/gobo_essence": "哥布林精華",
        "/items/eyessence": "眼精華",
        "/items/sorcerer_essence": "法師精華",
        "/items/bear_essence": "熊熊精華",
        "/items/golem_essence": "魔像精華",
        "/items/twilight_essence": "暮光精華",
        "/items/abyssal_essence": "地獄精華",
        "/items/chimerical_essence": "奇幻精華",
        "/items/sinister_essence": "陰森精華",
        "/items/enchanted_essence": "秘法精華",
        "/items/pirate_essence": "海盜精華",
        "/items/labyrinth_essence": "迷宮精華",
        "/items/task_crystal": "任務水晶",
        "/items/star_fragment": "星光碎片",
        "/items/pearl": "珍珠",
        "/items/amber": "琥珀",
        "/items/garnet": "石榴石",
        "/items/jade": "翡翠",
        "/items/amethyst": "紫水晶",
        "/items/moonstone": "月亮石",
        "/items/sunstone": "太陽石",
        "/items/philosophers_stone": "賢者之石",
        "/items/crushed_pearl": "珍珠碎片",
        "/items/crushed_amber": "琥珀碎片",
        "/items/crushed_garnet": "石榴石碎片",
        "/items/crushed_jade": "翡翠碎片",
        "/items/crushed_amethyst": "紫水晶碎片",
        "/items/crushed_moonstone": "月亮石碎片",
        "/items/crushed_sunstone": "太陽石碎片",
        "/items/crushed_philosophers_stone": "賢者之石碎片",
        "/items/shard_of_protection": "保護碎片",
        "/items/mirror_of_protection": "保護之鏡",
        "/items/philosophers_mirror": "賢者之鏡",
        "/items/basic_torch": "基礎火把",
        "/items/advanced_torch": "進階火把",
        "/items/expert_torch": "專家火把",
        "/items/basic_shroud": "基礎斗篷",
        "/items/advanced_shroud": "進階斗篷",
        "/items/expert_shroud": "專家斗篷",
        "/items/basic_beacon": "基礎探照燈",
        "/items/advanced_beacon": "進階探照燈",
        "/items/expert_beacon": "專家探照燈",
        "/items/basic_food_crate": "基礎食物箱",
        "/items/advanced_food_crate": "進階食物箱",
        "/items/expert_food_crate": "專家食物箱",
        "/items/basic_tea_crate": "基礎茶葉箱",
        "/items/advanced_tea_crate": "進階茶葉箱",
        "/items/expert_tea_crate": "專家茶葉箱",
        "/items/basic_coffee_crate": "基礎咖啡箱",
        "/items/advanced_coffee_crate": "進階咖啡箱",
        "/items/expert_coffee_crate": "專家咖啡箱",
    };

    const ZHActionNames = {
        "/actions/milking/cow": "奶牛",
        "/actions/milking/verdant_cow": "翠綠奶牛",
        "/actions/milking/azure_cow": "蔚藍奶牛",
        "/actions/milking/burble_cow": "深紫奶牛",
        "/actions/milking/crimson_cow": "絳紅奶牛",
        "/actions/milking/unicow": "彩虹奶牛",
        "/actions/milking/holy_cow": "神聖奶牛",
        "/actions/foraging/egg": "雞蛋",
        "/actions/foraging/wheat": "小麥",
        "/actions/foraging/sugar": "糖",
        "/actions/foraging/cotton": "棉花",
        "/actions/foraging/farmland": "翠野農場",
        "/actions/foraging/blueberry": "藍莓",
        "/actions/foraging/apple": "蘋果",
        "/actions/foraging/arabica_coffee_bean": "低階咖啡豆",
        "/actions/foraging/flax": "亞麻",
        "/actions/foraging/shimmering_lake": "波光湖泊",
        "/actions/foraging/blackberry": "黑莓",
        "/actions/foraging/orange": "橙子",
        "/actions/foraging/robusta_coffee_bean": "中級咖啡豆",
        "/actions/foraging/misty_forest": "迷霧森林",
        "/actions/foraging/strawberry": "草莓",
        "/actions/foraging/plum": "李子",
        "/actions/foraging/liberica_coffee_bean": "高階咖啡豆",
        "/actions/foraging/bamboo_branch": "竹子",
        "/actions/foraging/burble_beach": "深紫沙灘",
        "/actions/foraging/mooberry": "哞莓",
        "/actions/foraging/peach": "桃子",
        "/actions/foraging/excelsa_coffee_bean": "特級咖啡豆",
        "/actions/foraging/cocoon": "蠶繭",
        "/actions/foraging/silly_cow_valley": "傻牛山谷",
        "/actions/foraging/marsberry": "火星莓",
        "/actions/foraging/dragon_fruit": "火龍果",
        "/actions/foraging/fieriosa_coffee_bean": "火山咖啡豆",
        "/actions/foraging/olympus_mons": "奧林匹斯山",
        "/actions/foraging/spaceberry": "太空莓",
        "/actions/foraging/star_fruit": "楊桃",
        "/actions/foraging/spacia_coffee_bean": "太空咖啡豆",
        "/actions/foraging/radiant_fiber": "光輝纖維",
        "/actions/foraging/asteroid_belt": "小行星帶",
        "/actions/woodcutting/tree": "樹",
        "/actions/woodcutting/birch_tree": "樺樹",
        "/actions/woodcutting/cedar_tree": "雪松樹",
        "/actions/woodcutting/purpleheart_tree": "紫心樹",
        "/actions/woodcutting/ginkgo_tree": "銀杏樹",
        "/actions/woodcutting/redwood_tree": "紅杉樹",
        "/actions/woodcutting/arcane_tree": "奧秘樹",
        "/actions/cheesesmithing/cheese": "乳酪",
        "/actions/cheesesmithing/cheese_boots": "乳酪靴",
        "/actions/cheesesmithing/cheese_gauntlets": "乳酪護手",
        "/actions/cheesesmithing/cheese_sword": "乳酪劍",
        "/actions/cheesesmithing/cheese_brush": "乳酪刷子",
        "/actions/cheesesmithing/cheese_shears": "乳酪剪刀",
        "/actions/cheesesmithing/cheese_hatchet": "乳酪斧頭",
        "/actions/cheesesmithing/cheese_spear": "乳酪長槍",
        "/actions/cheesesmithing/cheese_hammer": "乳酪錘子",
        "/actions/cheesesmithing/cheese_chisel": "乳酪鑿子",
        "/actions/cheesesmithing/cheese_needle": "乳酪針",
        "/actions/cheesesmithing/cheese_spatula": "乳酪鍋鏟",
        "/actions/cheesesmithing/cheese_pot": "乳酪壺",
        "/actions/cheesesmithing/cheese_mace": "乳酪釘頭錘",
        "/actions/cheesesmithing/cheese_alembic": "乳酪蒸餾器",
        "/actions/cheesesmithing/cheese_enhancer": "乳酪強化器",
        "/actions/cheesesmithing/cheese_helmet": "乳酪頭盔",
        "/actions/cheesesmithing/cheese_buckler": "乳酪圓盾",
        "/actions/cheesesmithing/cheese_bulwark": "乳酪重盾",
        "/actions/cheesesmithing/cheese_plate_legs": "乳酪腿甲",
        "/actions/cheesesmithing/cheese_plate_body": "乳酪胸甲",
        "/actions/cheesesmithing/verdant_cheese": "翠綠乳酪",
        "/actions/cheesesmithing/verdant_boots": "翠綠靴",
        "/actions/cheesesmithing/verdant_gauntlets": "翠綠護手",
        "/actions/cheesesmithing/verdant_sword": "翠綠劍",
        "/actions/cheesesmithing/verdant_brush": "翠綠刷子",
        "/actions/cheesesmithing/verdant_shears": "翠綠剪刀",
        "/actions/cheesesmithing/verdant_hatchet": "翠綠斧頭",
        "/actions/cheesesmithing/verdant_spear": "翠綠長槍",
        "/actions/cheesesmithing/verdant_hammer": "翠綠錘子",
        "/actions/cheesesmithing/verdant_chisel": "翠綠鑿子",
        "/actions/cheesesmithing/verdant_needle": "翠綠針",
        "/actions/cheesesmithing/verdant_spatula": "翠綠鍋鏟",
        "/actions/cheesesmithing/verdant_pot": "翠綠壺",
        "/actions/cheesesmithing/verdant_mace": "翠綠釘頭錘",
        "/actions/cheesesmithing/snake_fang_dirk": "蛇牙短劍",
        "/actions/cheesesmithing/verdant_alembic": "翠綠蒸餾器",
        "/actions/cheesesmithing/verdant_enhancer": "翠綠強化器",
        "/actions/cheesesmithing/verdant_helmet": "翠綠頭盔",
        "/actions/cheesesmithing/verdant_buckler": "翠綠圓盾",
        "/actions/cheesesmithing/verdant_bulwark": "翠綠重盾",
        "/actions/cheesesmithing/verdant_plate_legs": "翠綠腿甲",
        "/actions/cheesesmithing/verdant_plate_body": "翠綠胸甲",
        "/actions/cheesesmithing/azure_cheese": "蔚藍乳酪",
        "/actions/cheesesmithing/azure_boots": "蔚藍靴",
        "/actions/cheesesmithing/basic_beacon": "基礎探照燈",
        "/actions/cheesesmithing/azure_gauntlets": "蔚藍護手",
        "/actions/cheesesmithing/azure_sword": "蔚藍劍",
        "/actions/cheesesmithing/azure_brush": "蔚藍刷子",
        "/actions/cheesesmithing/azure_shears": "蔚藍剪刀",
        "/actions/cheesesmithing/azure_hatchet": "蔚藍斧頭",
        "/actions/cheesesmithing/azure_spear": "蔚藍長槍",
        "/actions/cheesesmithing/azure_hammer": "蔚藍錘子",
        "/actions/cheesesmithing/azure_chisel": "蔚藍鑿子",
        "/actions/cheesesmithing/azure_needle": "蔚藍針",
        "/actions/cheesesmithing/azure_spatula": "蔚藍鍋鏟",
        "/actions/cheesesmithing/azure_pot": "蔚藍壺",
        "/actions/cheesesmithing/azure_mace": "蔚藍釘頭錘",
        "/actions/cheesesmithing/pincer_gloves": "蟹鉗手套",
        "/actions/cheesesmithing/azure_alembic": "蔚藍蒸餾器",
        "/actions/cheesesmithing/azure_enhancer": "蔚藍強化器",
        "/actions/cheesesmithing/azure_helmet": "蔚藍頭盔",
        "/actions/cheesesmithing/azure_buckler": "蔚藍圓盾",
        "/actions/cheesesmithing/azure_bulwark": "蔚藍重盾",
        "/actions/cheesesmithing/azure_plate_legs": "蔚藍腿甲",
        "/actions/cheesesmithing/snail_shell_helmet": "蝸牛殼頭盔",
        "/actions/cheesesmithing/azure_plate_body": "蔚藍胸甲",
        "/actions/cheesesmithing/turtle_shell_legs": "龜殼腿甲",
        "/actions/cheesesmithing/turtle_shell_body": "龜殼胸甲",
        "/actions/cheesesmithing/burble_cheese": "深紫乳酪",
        "/actions/cheesesmithing/burble_boots": "深紫靴",
        "/actions/cheesesmithing/burble_gauntlets": "深紫護手",
        "/actions/cheesesmithing/burble_sword": "深紫劍",
        "/actions/cheesesmithing/burble_brush": "深紫刷子",
        "/actions/cheesesmithing/burble_shears": "深紫剪刀",
        "/actions/cheesesmithing/burble_hatchet": "深紫斧頭",
        "/actions/cheesesmithing/burble_spear": "深紫長槍",
        "/actions/cheesesmithing/burble_hammer": "深紫錘子",
        "/actions/cheesesmithing/burble_chisel": "深紫鑿子",
        "/actions/cheesesmithing/burble_needle": "深紫針",
        "/actions/cheesesmithing/burble_spatula": "深紫鍋鏟",
        "/actions/cheesesmithing/burble_pot": "深紫壺",
        "/actions/cheesesmithing/burble_mace": "深紫釘頭錘",
        "/actions/cheesesmithing/burble_alembic": "深紫蒸餾器",
        "/actions/cheesesmithing/burble_enhancer": "深紫強化器",
        "/actions/cheesesmithing/burble_helmet": "深紫頭盔",
        "/actions/cheesesmithing/burble_buckler": "深紫圓盾",
        "/actions/cheesesmithing/burble_bulwark": "深紫重盾",
        "/actions/cheesesmithing/burble_plate_legs": "深紫腿甲",
        "/actions/cheesesmithing/burble_plate_body": "深紫胸甲",
        "/actions/cheesesmithing/crimson_cheese": "絳紅乳酪",
        "/actions/cheesesmithing/crimson_boots": "絳紅靴",
        "/actions/cheesesmithing/advanced_beacon": "進階探照燈",
        "/actions/cheesesmithing/crimson_gauntlets": "絳紅護手",
        "/actions/cheesesmithing/crimson_sword": "絳紅劍",
        "/actions/cheesesmithing/crimson_brush": "絳紅刷子",
        "/actions/cheesesmithing/crimson_shears": "絳紅剪刀",
        "/actions/cheesesmithing/crimson_hatchet": "絳紅斧頭",
        "/actions/cheesesmithing/crimson_spear": "絳紅長槍",
        "/actions/cheesesmithing/crimson_hammer": "絳紅錘子",
        "/actions/cheesesmithing/crimson_chisel": "絳紅鑿子",
        "/actions/cheesesmithing/crimson_needle": "絳紅針",
        "/actions/cheesesmithing/crimson_spatula": "絳紅鍋鏟",
        "/actions/cheesesmithing/crimson_pot": "絳紅壺",
        "/actions/cheesesmithing/crimson_mace": "絳紅釘頭錘",
        "/actions/cheesesmithing/crimson_alembic": "絳紅蒸餾器",
        "/actions/cheesesmithing/crimson_enhancer": "絳紅強化器",
        "/actions/cheesesmithing/crimson_helmet": "絳紅頭盔",
        "/actions/cheesesmithing/crimson_buckler": "絳紅圓盾",
        "/actions/cheesesmithing/crimson_bulwark": "絳紅重盾",
        "/actions/cheesesmithing/crimson_plate_legs": "絳紅腿甲",
        "/actions/cheesesmithing/vision_helmet": "視覺頭盔",
        "/actions/cheesesmithing/vision_shield": "視覺盾",
        "/actions/cheesesmithing/crimson_plate_body": "絳紅胸甲",
        "/actions/cheesesmithing/rainbow_cheese": "彩虹乳酪",
        "/actions/cheesesmithing/rainbow_boots": "彩虹靴",
        "/actions/cheesesmithing/black_bear_shoes": "黑熊鞋",
        "/actions/cheesesmithing/grizzly_bear_shoes": "棕熊鞋",
        "/actions/cheesesmithing/polar_bear_shoes": "北極熊鞋",
        "/actions/cheesesmithing/rainbow_gauntlets": "彩虹護手",
        "/actions/cheesesmithing/rainbow_sword": "彩虹劍",
        "/actions/cheesesmithing/panda_gloves": "熊貓手套",
        "/actions/cheesesmithing/rainbow_brush": "彩虹刷子",
        "/actions/cheesesmithing/rainbow_shears": "彩虹剪刀",
        "/actions/cheesesmithing/rainbow_hatchet": "彩虹斧頭",
        "/actions/cheesesmithing/rainbow_spear": "彩虹長槍",
        "/actions/cheesesmithing/rainbow_hammer": "彩虹錘子",
        "/actions/cheesesmithing/rainbow_chisel": "彩虹鑿子",
        "/actions/cheesesmithing/rainbow_needle": "彩虹針",
        "/actions/cheesesmithing/rainbow_spatula": "彩虹鍋鏟",
        "/actions/cheesesmithing/rainbow_pot": "彩虹壺",
        "/actions/cheesesmithing/rainbow_mace": "彩虹釘頭錘",
        "/actions/cheesesmithing/rainbow_alembic": "彩虹蒸餾器",
        "/actions/cheesesmithing/rainbow_enhancer": "彩虹強化器",
        "/actions/cheesesmithing/rainbow_helmet": "彩虹頭盔",
        "/actions/cheesesmithing/rainbow_buckler": "彩虹圓盾",
        "/actions/cheesesmithing/rainbow_bulwark": "彩虹重盾",
        "/actions/cheesesmithing/rainbow_plate_legs": "彩虹腿甲",
        "/actions/cheesesmithing/rainbow_plate_body": "彩虹胸甲",
        "/actions/cheesesmithing/holy_cheese": "神聖乳酪",
        "/actions/cheesesmithing/holy_boots": "神聖靴",
        "/actions/cheesesmithing/expert_beacon": "專家探照燈",
        "/actions/cheesesmithing/holy_gauntlets": "神聖護手",
        "/actions/cheesesmithing/holy_sword": "神聖劍",
        "/actions/cheesesmithing/holy_brush": "神聖刷子",
        "/actions/cheesesmithing/holy_shears": "神聖剪刀",
        "/actions/cheesesmithing/holy_hatchet": "神聖斧頭",
        "/actions/cheesesmithing/holy_spear": "神聖長槍",
        "/actions/cheesesmithing/holy_hammer": "神聖錘子",
        "/actions/cheesesmithing/holy_chisel": "神聖鑿子",
        "/actions/cheesesmithing/holy_needle": "神聖針",
        "/actions/cheesesmithing/holy_spatula": "神聖鍋鏟",
        "/actions/cheesesmithing/holy_pot": "神聖壺",
        "/actions/cheesesmithing/holy_mace": "神聖釘頭錘",
        "/actions/cheesesmithing/magnetic_gloves": "磁力手套",
        "/actions/cheesesmithing/stalactite_spear": "石鍾長槍",
        "/actions/cheesesmithing/granite_bludgeon": "花崗岩大棒",
        "/actions/cheesesmithing/vampire_fang_dirk": "吸血鬼短劍",
        "/actions/cheesesmithing/werewolf_slasher": "狼人關刀",
        "/actions/cheesesmithing/holy_alembic": "神聖蒸餾器",
        "/actions/cheesesmithing/holy_enhancer": "神聖強化器",
        "/actions/cheesesmithing/holy_helmet": "神聖頭盔",
        "/actions/cheesesmithing/holy_buckler": "神聖圓盾",
        "/actions/cheesesmithing/holy_bulwark": "神聖重盾",
        "/actions/cheesesmithing/holy_plate_legs": "神聖腿甲",
        "/actions/cheesesmithing/holy_plate_body": "神聖胸甲",
        "/actions/cheesesmithing/celestial_brush": "星空刷子",
        "/actions/cheesesmithing/celestial_shears": "星空剪刀",
        "/actions/cheesesmithing/celestial_hatchet": "星空斧頭",
        "/actions/cheesesmithing/celestial_hammer": "星空錘子",
        "/actions/cheesesmithing/celestial_chisel": "星空鑿子",
        "/actions/cheesesmithing/celestial_needle": "星空針",
        "/actions/cheesesmithing/celestial_spatula": "星空鍋鏟",
        "/actions/cheesesmithing/celestial_pot": "星空壺",
        "/actions/cheesesmithing/celestial_alembic": "星空蒸餾器",
        "/actions/cheesesmithing/celestial_enhancer": "星空強化器",
        "/actions/cheesesmithing/colossus_plate_body": "巨像胸甲",
        "/actions/cheesesmithing/colossus_plate_legs": "巨像腿甲",
        "/actions/cheesesmithing/demonic_plate_body": "惡魔胸甲",
        "/actions/cheesesmithing/demonic_plate_legs": "惡魔腿甲",
        "/actions/cheesesmithing/spiked_bulwark": "尖刺重盾",
        "/actions/cheesesmithing/pathbreaker_boots": "開路者靴",
        "/actions/cheesesmithing/dodocamel_gauntlets": "渡渡駝護手",
        "/actions/cheesesmithing/corsair_helmet": "掠奪者頭盔",
        "/actions/cheesesmithing/knights_aegis": "騎士盾",
        "/actions/cheesesmithing/anchorbound_plate_legs": "錨定腿甲",
        "/actions/cheesesmithing/maelstrom_plate_legs": "怒濤腿甲",
        "/actions/cheesesmithing/griffin_bulwark": "獅鷲重盾",
        "/actions/cheesesmithing/furious_spear": "狂怒長槍",
        "/actions/cheesesmithing/chaotic_flail": "混沌連枷",
        "/actions/cheesesmithing/regal_sword": "君王之劍",
        "/actions/cheesesmithing/anchorbound_plate_body": "錨定胸甲",
        "/actions/cheesesmithing/maelstrom_plate_body": "怒濤胸甲",
        "/actions/cheesesmithing/pathbreaker_boots_refined": "開路者靴 ★",
        "/actions/cheesesmithing/dodocamel_gauntlets_refined": "渡渡駝護手 ★",
        "/actions/cheesesmithing/corsair_helmet_refined": "掠奪者頭盔 ★",
        "/actions/cheesesmithing/knights_aegis_refined": "騎士盾 ★",
        "/actions/cheesesmithing/anchorbound_plate_legs_refined": "錨定腿甲 ★",
        "/actions/cheesesmithing/maelstrom_plate_legs_refined": "怒濤腿甲 ★",
        "/actions/cheesesmithing/griffin_bulwark_refined": "獅鷲重盾 ★",
        "/actions/cheesesmithing/furious_spear_refined": "狂怒長槍 ★",
        "/actions/cheesesmithing/chaotic_flail_refined": "混沌連枷 ★",
        "/actions/cheesesmithing/regal_sword_refined": "君王之劍 ★",
        "/actions/cheesesmithing/anchorbound_plate_body_refined": "錨定胸甲 ★",
        "/actions/cheesesmithing/maelstrom_plate_body_refined": "怒濤胸甲 ★",
        "/actions/crafting/lumber": "木板",
        "/actions/crafting/wooden_crossbow": "木弩",
        "/actions/crafting/wooden_water_staff": "木製水法杖",
        "/actions/crafting/basic_task_badge": "基礎任務徽章",
        "/actions/crafting/advanced_task_badge": "高階任務徽章",
        "/actions/crafting/expert_task_badge": "專家任務徽章",
        "/actions/crafting/wooden_shield": "木盾",
        "/actions/crafting/wooden_nature_staff": "木製自然法杖",
        "/actions/crafting/wooden_bow": "木弓",
        "/actions/crafting/wooden_fire_staff": "木製火法杖",
        "/actions/crafting/birch_lumber": "白樺木板",
        "/actions/crafting/birch_crossbow": "樺木弩",
        "/actions/crafting/birch_water_staff": "樺木水法杖",
        "/actions/crafting/crushed_pearl": "珍珠碎片",
        "/actions/crafting/birch_shield": "樺木盾",
        "/actions/crafting/birch_nature_staff": "樺木自然法杖",
        "/actions/crafting/birch_bow": "樺木弓",
        "/actions/crafting/ring_of_gathering": "採集戒指",
        "/actions/crafting/birch_fire_staff": "樺木火法杖",
        "/actions/crafting/earrings_of_gathering": "採集耳環",
        "/actions/crafting/cedar_lumber": "雪松木板",
        "/actions/crafting/cedar_crossbow": "雪松弩",
        "/actions/crafting/cedar_water_staff": "雪松水法杖",
        "/actions/crafting/basic_milking_charm": "基礎擠奶護符",
        "/actions/crafting/basic_foraging_charm": "基礎採摘護符",
        "/actions/crafting/basic_woodcutting_charm": "基礎伐木護符",
        "/actions/crafting/basic_cheesesmithing_charm": "基礎乳酪鍛造護符",
        "/actions/crafting/basic_crafting_charm": "基礎製作護符",
        "/actions/crafting/basic_tailoring_charm": "基礎縫紉護符",
        "/actions/crafting/basic_cooking_charm": "基礎烹飪護符",
        "/actions/crafting/basic_brewing_charm": "基礎沖泡護符",
        "/actions/crafting/basic_alchemy_charm": "基礎煉金護符",
        "/actions/crafting/basic_enhancing_charm": "基礎強化護符",
        "/actions/crafting/basic_torch": "基礎火把",
        "/actions/crafting/cedar_shield": "雪松盾",
        "/actions/crafting/cedar_nature_staff": "雪松自然法杖",
        "/actions/crafting/cedar_bow": "雪松弓",
        "/actions/crafting/crushed_amber": "琥珀碎片",
        "/actions/crafting/cedar_fire_staff": "雪松火法杖",
        "/actions/crafting/ring_of_essence_find": "精華發現戒指",
        "/actions/crafting/earrings_of_essence_find": "精華發現耳環",
        "/actions/crafting/necklace_of_efficiency": "效率項鍊",
        "/actions/crafting/purpleheart_lumber": "紫心木板",
        "/actions/crafting/purpleheart_crossbow": "紫心弩",
        "/actions/crafting/purpleheart_water_staff": "紫心水法杖",
        "/actions/crafting/purpleheart_shield": "紫心盾",
        "/actions/crafting/purpleheart_nature_staff": "紫心自然法杖",
        "/actions/crafting/purpleheart_bow": "紫心弓",
        "/actions/crafting/advanced_milking_charm": "高階擠奶護符",
        "/actions/crafting/advanced_foraging_charm": "高階採摘護符",
        "/actions/crafting/advanced_woodcutting_charm": "高階伐木護符",
        "/actions/crafting/advanced_cheesesmithing_charm": "高階乳酪鍛造護符",
        "/actions/crafting/advanced_crafting_charm": "高階製作護符",
        "/actions/crafting/advanced_tailoring_charm": "高階縫紉護符",
        "/actions/crafting/advanced_cooking_charm": "高階烹飪護符",
        "/actions/crafting/advanced_brewing_charm": "高階沖泡護符",
        "/actions/crafting/advanced_alchemy_charm": "高階煉金護符",
        "/actions/crafting/advanced_enhancing_charm": "高階強化護符",
        "/actions/crafting/advanced_stamina_charm": "高階耐力護符",
        "/actions/crafting/advanced_intelligence_charm": "高階智力護符",
        "/actions/crafting/advanced_attack_charm": "高階攻擊護符",
        "/actions/crafting/advanced_defense_charm": "高階防禦護符",
        "/actions/crafting/advanced_melee_charm": "高階近戰護符",
        "/actions/crafting/advanced_ranged_charm": "高階遠程護符",
        "/actions/crafting/advanced_magic_charm": "高階魔法護符",
        "/actions/crafting/crushed_garnet": "石榴石碎片",
        "/actions/crafting/crushed_jade": "翡翠碎片",
        "/actions/crafting/crushed_amethyst": "紫水晶碎片",
        "/actions/crafting/catalyst_of_coinification": "點金催化劑",
        "/actions/crafting/treant_shield": "樹人盾",
        "/actions/crafting/purpleheart_fire_staff": "紫心火法杖",
        "/actions/crafting/ring_of_regeneration": "恢復戒指",
        "/actions/crafting/earrings_of_regeneration": "恢復耳環",
        "/actions/crafting/fighter_necklace": "戰士項鍊",
        "/actions/crafting/ginkgo_lumber": "銀杏木板",
        "/actions/crafting/ginkgo_crossbow": "銀杏弩",
        "/actions/crafting/ginkgo_water_staff": "銀杏水法杖",
        "/actions/crafting/ring_of_armor": "護甲戒指",
        "/actions/crafting/catalyst_of_decomposition": "分解催化劑",
        "/actions/crafting/advanced_torch": "進階火把",
        "/actions/crafting/ginkgo_shield": "銀杏盾",
        "/actions/crafting/earrings_of_armor": "護甲耳環",
        "/actions/crafting/ginkgo_nature_staff": "銀杏自然法杖",
        "/actions/crafting/ranger_necklace": "射手項鍊",
        "/actions/crafting/ginkgo_bow": "銀杏弓",
        "/actions/crafting/ring_of_resistance": "抗性戒指",
        "/actions/crafting/crushed_moonstone": "月亮石碎片",
        "/actions/crafting/ginkgo_fire_staff": "銀杏火法杖",
        "/actions/crafting/earrings_of_resistance": "抗性耳環",
        "/actions/crafting/wizard_necklace": "巫師項鍊",
        "/actions/crafting/ring_of_rare_find": "稀有發現戒指",
        "/actions/crafting/expert_milking_charm": "專家擠奶護符",
        "/actions/crafting/expert_foraging_charm": "專家採摘護符",
        "/actions/crafting/expert_woodcutting_charm": "專家伐木護符",
        "/actions/crafting/expert_cheesesmithing_charm": "專家乳酪鍛造護符",
        "/actions/crafting/expert_crafting_charm": "專家制作護符",
        "/actions/crafting/expert_tailoring_charm": "專家縫紉護符",
        "/actions/crafting/expert_cooking_charm": "專家烹飪護符",
        "/actions/crafting/expert_brewing_charm": "專家沖泡護符",
        "/actions/crafting/expert_alchemy_charm": "專家煉金護符",
        "/actions/crafting/expert_enhancing_charm": "專家強化護符",
        "/actions/crafting/expert_stamina_charm": "專家耐力護符",
        "/actions/crafting/expert_intelligence_charm": "專家智力護符",
        "/actions/crafting/expert_attack_charm": "專家攻擊護符",
        "/actions/crafting/expert_defense_charm": "專家防禦護符",
        "/actions/crafting/expert_melee_charm": "專家近戰護符",
        "/actions/crafting/expert_ranged_charm": "專家遠程護符",
        "/actions/crafting/expert_magic_charm": "專家魔法護符",
        "/actions/crafting/catalyst_of_transmutation": "轉化催化劑",
        "/actions/crafting/earrings_of_rare_find": "稀有發現耳環",
        "/actions/crafting/necklace_of_wisdom": "經驗項鍊",
        "/actions/crafting/redwood_lumber": "紅杉木板",
        "/actions/crafting/redwood_crossbow": "紅杉弩",
        "/actions/crafting/redwood_water_staff": "紅杉水法杖",
        "/actions/crafting/redwood_shield": "紅杉盾",
        "/actions/crafting/redwood_nature_staff": "紅杉自然法杖",
        "/actions/crafting/redwood_bow": "紅杉弓",
        "/actions/crafting/crushed_sunstone": "太陽石碎片",
        "/actions/crafting/chimerical_entry_key": "奇幻鑰匙",
        "/actions/crafting/chimerical_chest_key": "奇幻寶箱鑰匙",
        "/actions/crafting/eye_watch": "掌上監工",
        "/actions/crafting/watchful_relic": "警戒遺物",
        "/actions/crafting/redwood_fire_staff": "紅杉火法杖",
        "/actions/crafting/ring_of_critical_strike": "暴擊戒指",
        "/actions/crafting/mirror_of_protection": "保護之鏡",
        "/actions/crafting/earrings_of_critical_strike": "暴擊耳環",
        "/actions/crafting/necklace_of_speed": "速度項鍊",
        "/actions/crafting/arcane_lumber": "神秘木板",
        "/actions/crafting/arcane_crossbow": "神秘弩",
        "/actions/crafting/arcane_water_staff": "神秘水法杖",
        "/actions/crafting/master_milking_charm": "大師擠奶護符",
        "/actions/crafting/master_foraging_charm": "大師採摘護符",
        "/actions/crafting/master_woodcutting_charm": "大師伐木護符",
        "/actions/crafting/master_cheesesmithing_charm": "大師乳酪鍛造護符",
        "/actions/crafting/master_crafting_charm": "大師製作護符",
        "/actions/crafting/master_tailoring_charm": "大師縫紉護符",
        "/actions/crafting/master_cooking_charm": "大師烹飪護符",
        "/actions/crafting/master_brewing_charm": "大師沖泡護符",
        "/actions/crafting/master_alchemy_charm": "大師煉金護符",
        "/actions/crafting/master_enhancing_charm": "大師強化護符",
        "/actions/crafting/master_stamina_charm": "大師耐力護符",
        "/actions/crafting/master_intelligence_charm": "大師智力護符",
        "/actions/crafting/master_attack_charm": "大師攻擊護符",
        "/actions/crafting/master_defense_charm": "大師防禦護符",
        "/actions/crafting/master_melee_charm": "大師近戰護符",
        "/actions/crafting/master_ranged_charm": "大師遠程護符",
        "/actions/crafting/master_magic_charm": "大師魔法護符",
        "/actions/crafting/sinister_entry_key": "陰森鑰匙",
        "/actions/crafting/sinister_chest_key": "陰森寶箱鑰匙",
        "/actions/crafting/expert_torch": "專家火把",
        "/actions/crafting/arcane_shield": "神秘盾",
        "/actions/crafting/arcane_nature_staff": "神秘自然法杖",
        "/actions/crafting/manticore_shield": "蠍獅盾",
        "/actions/crafting/arcane_bow": "神秘弓",
        "/actions/crafting/enchanted_entry_key": "秘法鑰匙",
        "/actions/crafting/enchanted_chest_key": "秘法寶箱鑰匙",
        "/actions/crafting/pirate_entry_key": "海盜鑰匙",
        "/actions/crafting/pirate_chest_key": "海盜寶箱鑰匙",
        "/actions/crafting/arcane_fire_staff": "神秘火法杖",
        "/actions/crafting/vampiric_bow": "吸血弓",
        "/actions/crafting/soul_hunter_crossbow": "靈魂獵手弩",
        "/actions/crafting/frost_staff": "冰霜法杖",
        "/actions/crafting/infernal_battlestaff": "煉獄法杖",
        "/actions/crafting/jackalope_staff": "鹿角兔之杖",
        "/actions/crafting/philosophers_ring": "賢者戒指",
        "/actions/crafting/crushed_philosophers_stone": "賢者之石碎片",
        "/actions/crafting/philosophers_earrings": "賢者耳環",
        "/actions/crafting/philosophers_necklace": "賢者項鍊",
        "/actions/crafting/bishops_codex": "主教法典",
        "/actions/crafting/cursed_bow": "咒怨之弓",
        "/actions/crafting/sundering_crossbow": "裂空之弩",
        "/actions/crafting/rippling_trident": "漣漪三叉戟",
        "/actions/crafting/blooming_trident": "綻放三叉戟",
        "/actions/crafting/blazing_trident": "熾焰三叉戟",
        "/actions/crafting/grandmaster_milking_charm": "宗師擠奶護符",
        "/actions/crafting/grandmaster_foraging_charm": "宗師採摘護符",
        "/actions/crafting/grandmaster_woodcutting_charm": "宗師伐木護符",
        "/actions/crafting/grandmaster_cheesesmithing_charm": "宗師乳酪鍛造護符",
        "/actions/crafting/grandmaster_crafting_charm": "宗師製作護符",
        "/actions/crafting/grandmaster_tailoring_charm": "宗師縫紉護符",
        "/actions/crafting/grandmaster_cooking_charm": "宗師烹飪護符",
        "/actions/crafting/grandmaster_brewing_charm": "宗師沖泡護符",
        "/actions/crafting/grandmaster_alchemy_charm": "宗師煉金護符",
        "/actions/crafting/grandmaster_enhancing_charm": "宗師強化護符",
        "/actions/crafting/grandmaster_stamina_charm": "宗師耐力護符",
        "/actions/crafting/grandmaster_intelligence_charm": "宗師智力護符",
        "/actions/crafting/grandmaster_attack_charm": "宗師攻擊護符",
        "/actions/crafting/grandmaster_defense_charm": "宗師防禦護符",
        "/actions/crafting/grandmaster_melee_charm": "宗師近戰護符",
        "/actions/crafting/grandmaster_ranged_charm": "宗師遠程護符",
        "/actions/crafting/grandmaster_magic_charm": "宗師魔法護符",
        "/actions/crafting/philosophers_mirror": "賢者之鏡",
        "/actions/crafting/bishops_codex_refined": "主教法典 ★",
        "/actions/crafting/cursed_bow_refined": "咒怨之弓 ★",
        "/actions/crafting/sundering_crossbow_refined": "裂空之弩 ★",
        "/actions/crafting/rippling_trident_refined": "漣漪三叉戟 ★",
        "/actions/crafting/blooming_trident_refined": "綻放三叉戟 ★",
        "/actions/crafting/blazing_trident_refined": "熾焰三叉戟 ★",
        "/actions/tailoring/rough_leather": "粗糙皮革",
        "/actions/tailoring/cotton_fabric": "棉花布料",
        "/actions/tailoring/rough_boots": "粗糙靴",
        "/actions/tailoring/cotton_boots": "棉靴",
        "/actions/tailoring/rough_bracers": "粗糙護腕",
        "/actions/tailoring/cotton_gloves": "棉手套",
        "/actions/tailoring/small_pouch": "小袋子",
        "/actions/tailoring/rough_hood": "粗糙兜帽",
        "/actions/tailoring/cotton_hat": "棉帽",
        "/actions/tailoring/rough_chaps": "粗糙皮褲",
        "/actions/tailoring/cotton_robe_bottoms": "棉袍裙",
        "/actions/tailoring/rough_tunic": "粗糙皮衣",
        "/actions/tailoring/cotton_robe_top": "棉袍服",
        "/actions/tailoring/reptile_leather": "爬行動物皮革",
        "/actions/tailoring/linen_fabric": "亞麻布料",
        "/actions/tailoring/reptile_boots": "爬行動物靴",
        "/actions/tailoring/linen_boots": "亞麻靴",
        "/actions/tailoring/reptile_bracers": "爬行動物護腕",
        "/actions/tailoring/linen_gloves": "亞麻手套",
        "/actions/tailoring/basic_shroud": "基礎斗篷",
        "/actions/tailoring/reptile_hood": "爬行動物兜帽",
        "/actions/tailoring/linen_hat": "亞麻帽",
        "/actions/tailoring/reptile_chaps": "爬行動物皮褲",
        "/actions/tailoring/linen_robe_bottoms": "亞麻袍裙",
        "/actions/tailoring/medium_pouch": "中袋子",
        "/actions/tailoring/reptile_tunic": "爬行動物皮衣",
        "/actions/tailoring/linen_robe_top": "亞麻袍服",
        "/actions/tailoring/shoebill_shoes": "鯨頭鸛鞋",
        "/actions/tailoring/gobo_leather": "哥布林皮革",
        "/actions/tailoring/bamboo_fabric": "竹子布料",
        "/actions/tailoring/gobo_boots": "哥布林靴",
        "/actions/tailoring/bamboo_boots": "竹靴",
        "/actions/tailoring/gobo_bracers": "哥布林護腕",
        "/actions/tailoring/bamboo_gloves": "竹手套",
        "/actions/tailoring/gobo_hood": "哥布林兜帽",
        "/actions/tailoring/bamboo_hat": "竹帽",
        "/actions/tailoring/gobo_chaps": "哥布林皮褲",
        "/actions/tailoring/bamboo_robe_bottoms": "竹袍裙",
        "/actions/tailoring/large_pouch": "大袋子",
        "/actions/tailoring/gobo_tunic": "哥布林皮衣",
        "/actions/tailoring/bamboo_robe_top": "竹袍服",
        "/actions/tailoring/marine_tunic": "海洋皮衣",
        "/actions/tailoring/marine_chaps": "航海皮褲",
        "/actions/tailoring/icy_robe_top": "冰霜袍服",
        "/actions/tailoring/icy_robe_bottoms": "冰霜袍裙",
        "/actions/tailoring/flaming_robe_top": "烈焰袍服",
        "/actions/tailoring/flaming_robe_bottoms": "烈焰袍裙",
        "/actions/tailoring/advanced_shroud": "進階斗篷",
        "/actions/tailoring/beast_leather": "野獸皮革",
        "/actions/tailoring/silk_fabric": "絲綢",
        "/actions/tailoring/beast_boots": "野獸靴",
        "/actions/tailoring/silk_boots": "絲靴",
        "/actions/tailoring/beast_bracers": "野獸護腕",
        "/actions/tailoring/silk_gloves": "絲手套",
        "/actions/tailoring/collectors_boots": "收藏家靴",
        "/actions/tailoring/sighted_bracers": "瞄準護腕",
        "/actions/tailoring/beast_hood": "野獸兜帽",
        "/actions/tailoring/silk_hat": "絲帽",
        "/actions/tailoring/beast_chaps": "野獸皮褲",
        "/actions/tailoring/silk_robe_bottoms": "絲綢袍裙",
        "/actions/tailoring/centaur_boots": "半人馬靴",
        "/actions/tailoring/sorcerer_boots": "巫師靴",
        "/actions/tailoring/giant_pouch": "巨大袋子",
        "/actions/tailoring/beast_tunic": "野獸皮衣",
        "/actions/tailoring/silk_robe_top": "絲綢袍服",
        "/actions/tailoring/red_culinary_hat": "紅色廚師帽",
        "/actions/tailoring/luna_robe_top": "月神袍服",
        "/actions/tailoring/luna_robe_bottoms": "月神袍裙",
        "/actions/tailoring/umbral_leather": "暗影皮革",
        "/actions/tailoring/radiant_fabric": "光輝布料",
        "/actions/tailoring/umbral_boots": "暗影靴",
        "/actions/tailoring/radiant_boots": "光輝靴",
        "/actions/tailoring/umbral_bracers": "暗影護腕",
        "/actions/tailoring/radiant_gloves": "光輝手套",
        "/actions/tailoring/enchanted_gloves": "附魔手套",
        "/actions/tailoring/fluffy_red_hat": "蓬鬆紅帽子",
        "/actions/tailoring/chrono_gloves": "時空手套",
        "/actions/tailoring/expert_shroud": "專家斗篷",
        "/actions/tailoring/umbral_hood": "暗影兜帽",
        "/actions/tailoring/radiant_hat": "光輝帽",
        "/actions/tailoring/umbral_chaps": "暗影皮褲",
        "/actions/tailoring/radiant_robe_bottoms": "光輝袍裙",
        "/actions/tailoring/umbral_tunic": "暗影皮衣",
        "/actions/tailoring/radiant_robe_top": "光輝袍服",
        "/actions/tailoring/revenant_chaps": "亡靈皮褲",
        "/actions/tailoring/griffin_chaps": "獅鷲皮褲",
        "/actions/tailoring/dairyhands_top": "擠奶工上衣",
        "/actions/tailoring/dairyhands_bottoms": "擠奶工下裝",
        "/actions/tailoring/foragers_top": "採摘者上衣",
        "/actions/tailoring/foragers_bottoms": "採摘者下裝",
        "/actions/tailoring/lumberjacks_top": "伐木工上衣",
        "/actions/tailoring/lumberjacks_bottoms": "伐木工下裝",
        "/actions/tailoring/cheesemakers_top": "乳酪師上衣",
        "/actions/tailoring/cheesemakers_bottoms": "乳酪師下裝",
        "/actions/tailoring/crafters_top": "工匠上衣",
        "/actions/tailoring/crafters_bottoms": "工匠下裝",
        "/actions/tailoring/tailors_top": "裁縫上衣",
        "/actions/tailoring/tailors_bottoms": "裁縫下裝",
        "/actions/tailoring/chefs_top": "廚師上衣",
        "/actions/tailoring/chefs_bottoms": "廚師下裝",
        "/actions/tailoring/brewers_top": "飲品師上衣",
        "/actions/tailoring/brewers_bottoms": "飲品師下裝",
        "/actions/tailoring/alchemists_top": "煉金師上衣",
        "/actions/tailoring/alchemists_bottoms": "煉金師下裝",
        "/actions/tailoring/enhancers_top": "強化師上衣",
        "/actions/tailoring/enhancers_bottoms": "強化師下裝",
        "/actions/tailoring/revenant_tunic": "亡靈皮衣",
        "/actions/tailoring/griffin_tunic": "獅鷲皮衣",
        "/actions/tailoring/gluttonous_pouch": "貪食之袋",
        "/actions/tailoring/guzzling_pouch": "暴飲之囊",
        "/actions/tailoring/pathfinder_boots": "探路者靴",
        "/actions/tailoring/pathseeker_boots": "尋路者靴",
        "/actions/tailoring/marksman_bracers": "神射護腕",
        "/actions/tailoring/acrobatic_hood": "雜技師兜帽",
        "/actions/tailoring/magicians_hat": "魔術師帽",
        "/actions/tailoring/kraken_chaps": "克拉肯皮褲",
        "/actions/tailoring/royal_water_robe_bottoms": "皇家水系袍裙",
        "/actions/tailoring/royal_nature_robe_bottoms": "皇家自然系袍裙",
        "/actions/tailoring/royal_fire_robe_bottoms": "皇家火系袍裙",
        "/actions/tailoring/kraken_tunic": "克拉肯皮衣",
        "/actions/tailoring/royal_water_robe_top": "皇家水系袍服",
        "/actions/tailoring/royal_nature_robe_top": "皇家自然系袍服",
        "/actions/tailoring/royal_fire_robe_top": "皇家火系袍服",
        "/actions/tailoring/gatherer_cape_refined": "採集者披風 ★",
        "/actions/tailoring/artificer_cape_refined": "工匠披風 ★",
        "/actions/tailoring/culinary_cape_refined": "廚師披風 ★",
        "/actions/tailoring/chance_cape_refined": "機緣披風 ★",
        "/actions/tailoring/chimerical_quiver_refined": "奇幻箭袋 ★",
        "/actions/tailoring/sinister_cape_refined": "陰森披風 ★",
        "/actions/tailoring/enchanted_cloak_refined": "秘法披風 ★",
        "/actions/tailoring/pathfinder_boots_refined": "探路者靴 ★",
        "/actions/tailoring/pathseeker_boots_refined": "尋路者靴 ★",
        "/actions/tailoring/marksman_bracers_refined": "神射護腕 ★",
        "/actions/tailoring/acrobatic_hood_refined": "雜技師兜帽 ★",
        "/actions/tailoring/magicians_hat_refined": "魔術師帽 ★",
        "/actions/tailoring/kraken_chaps_refined": "克拉肯皮褲 ★",
        "/actions/tailoring/royal_water_robe_bottoms_refined": "皇家水系袍裙 ★",
        "/actions/tailoring/royal_nature_robe_bottoms_refined": "皇家自然系袍裙 ★",
        "/actions/tailoring/royal_fire_robe_bottoms_refined": "皇家火系袍裙 ★",
        "/actions/tailoring/kraken_tunic_refined": "克拉肯皮衣 ★",
        "/actions/tailoring/royal_water_robe_top_refined": "皇家水系袍服 ★",
        "/actions/tailoring/royal_nature_robe_top_refined": "皇家自然系袍服 ★",
        "/actions/tailoring/royal_fire_robe_top_refined": "皇家火系袍服 ★",
        "/actions/cooking/donut": "甜甜圈",
        "/actions/cooking/cupcake": "紙杯蛋糕",
        "/actions/cooking/gummy": "軟糖",
        "/actions/cooking/yogurt": "優格",
        "/actions/cooking/blueberry_donut": "藍莓甜甜圈",
        "/actions/cooking/blueberry_cake": "藍莓蛋糕",
        "/actions/cooking/apple_gummy": "蘋果軟糖",
        "/actions/cooking/apple_yogurt": "蘋果優格",
        "/actions/cooking/blackberry_donut": "黑莓甜甜圈",
        "/actions/cooking/blackberry_cake": "黑莓蛋糕",
        "/actions/cooking/orange_gummy": "橙子軟糖",
        "/actions/cooking/orange_yogurt": "橙子優格",
        "/actions/cooking/basic_food_crate": "基礎食物箱",
        "/actions/cooking/strawberry_donut": "草莓甜甜圈",
        "/actions/cooking/strawberry_cake": "草莓蛋糕",
        "/actions/cooking/plum_gummy": "李子軟糖",
        "/actions/cooking/plum_yogurt": "李子優格",
        "/actions/cooking/mooberry_donut": "哞莓甜甜圈",
        "/actions/cooking/mooberry_cake": "哞莓蛋糕",
        "/actions/cooking/peach_gummy": "桃子軟糖",
        "/actions/cooking/peach_yogurt": "桃子優格",
        "/actions/cooking/advanced_food_crate": "進階食物箱",
        "/actions/cooking/marsberry_donut": "火星莓甜甜圈",
        "/actions/cooking/marsberry_cake": "火星莓蛋糕",
        "/actions/cooking/dragon_fruit_gummy": "火龍果軟糖",
        "/actions/cooking/dragon_fruit_yogurt": "火龍果優格",
        "/actions/cooking/spaceberry_donut": "太空莓甜甜圈",
        "/actions/cooking/spaceberry_cake": "太空莓蛋糕",
        "/actions/cooking/star_fruit_gummy": "楊桃軟糖",
        "/actions/cooking/star_fruit_yogurt": "楊桃優格",
        "/actions/cooking/expert_food_crate": "專家食物箱",
        "/actions/brewing/milking_tea": "擠奶茶",
        "/actions/brewing/stamina_coffee": "耐力咖啡",
        "/actions/brewing/foraging_tea": "採摘茶",
        "/actions/brewing/intelligence_coffee": "智力咖啡",
        "/actions/brewing/gathering_tea": "採集茶",
        "/actions/brewing/woodcutting_tea": "伐木茶",
        "/actions/brewing/cooking_tea": "烹飪茶",
        "/actions/brewing/defense_coffee": "防禦咖啡",
        "/actions/brewing/brewing_tea": "沖泡茶",
        "/actions/brewing/attack_coffee": "攻擊咖啡",
        "/actions/brewing/gourmet_tea": "美食茶",
        "/actions/brewing/alchemy_tea": "煉金茶",
        "/actions/brewing/enhancing_tea": "強化茶",
        "/actions/brewing/cheesesmithing_tea": "乳酪鍛造茶",
        "/actions/brewing/melee_coffee": "近戰咖啡",
        "/actions/brewing/basic_tea_crate": "基礎茶葉箱",
        "/actions/brewing/basic_coffee_crate": "基礎咖啡箱",
        "/actions/brewing/crafting_tea": "製作茶",
        "/actions/brewing/ranged_coffee": "遠程咖啡",
        "/actions/brewing/wisdom_tea": "經驗茶",
        "/actions/brewing/wisdom_coffee": "經驗咖啡",
        "/actions/brewing/tailoring_tea": "縫紉茶",
        "/actions/brewing/magic_coffee": "魔法咖啡",
        "/actions/brewing/super_milking_tea": "超級擠奶茶",
        "/actions/brewing/super_stamina_coffee": "超級耐力咖啡",
        "/actions/brewing/super_foraging_tea": "超級採摘茶",
        "/actions/brewing/super_intelligence_coffee": "超級智力咖啡",
        "/actions/brewing/processing_tea": "加工茶",
        "/actions/brewing/lucky_coffee": "幸運咖啡",
        "/actions/brewing/super_woodcutting_tea": "超級伐木茶",
        "/actions/brewing/super_cooking_tea": "超級烹飪茶",
        "/actions/brewing/super_defense_coffee": "超級防禦咖啡",
        "/actions/brewing/advanced_tea_crate": "進階茶葉箱",
        "/actions/brewing/advanced_coffee_crate": "進階咖啡箱",
        "/actions/brewing/super_brewing_tea": "超級沖泡茶",
        "/actions/brewing/ultra_milking_tea": "究極擠奶茶",
        "/actions/brewing/super_attack_coffee": "超級攻擊咖啡",
        "/actions/brewing/ultra_stamina_coffee": "究極耐力咖啡",
        "/actions/brewing/efficiency_tea": "效率茶",
        "/actions/brewing/swiftness_coffee": "迅捷咖啡",
        "/actions/brewing/super_alchemy_tea": "超級煉金茶",
        "/actions/brewing/super_enhancing_tea": "超級強化茶",
        "/actions/brewing/ultra_foraging_tea": "究極採摘茶",
        "/actions/brewing/ultra_intelligence_coffee": "究極智力咖啡",
        "/actions/brewing/channeling_coffee": "吟唱咖啡",
        "/actions/brewing/super_cheesesmithing_tea": "超級乳酪鍛造茶",
        "/actions/brewing/ultra_woodcutting_tea": "究極伐木茶",
        "/actions/brewing/super_melee_coffee": "超級近戰咖啡",
        "/actions/brewing/artisan_tea": "工匠茶",
        "/actions/brewing/super_crafting_tea": "超級製作茶",
        "/actions/brewing/ultra_cooking_tea": "究極烹飪茶",
        "/actions/brewing/super_ranged_coffee": "超級遠程咖啡",
        "/actions/brewing/ultra_defense_coffee": "究極防禦咖啡",
        "/actions/brewing/catalytic_tea": "催化茶",
        "/actions/brewing/critical_coffee": "暴擊咖啡",
        "/actions/brewing/super_tailoring_tea": "超級縫紉茶",
        "/actions/brewing/ultra_brewing_tea": "究極沖泡茶",
        "/actions/brewing/super_magic_coffee": "超級魔法咖啡",
        "/actions/brewing/ultra_attack_coffee": "究極攻擊咖啡",
        "/actions/brewing/blessed_tea": "福氣茶",
        "/actions/brewing/ultra_alchemy_tea": "究極煉金茶",
        "/actions/brewing/ultra_enhancing_tea": "究極強化茶",
        "/actions/brewing/expert_tea_crate": "專家茶葉箱",
        "/actions/brewing/expert_coffee_crate": "專家咖啡箱",
        "/actions/brewing/ultra_cheesesmithing_tea": "究極乳酪鍛造茶",
        "/actions/brewing/ultra_melee_coffee": "究極近戰咖啡",
        "/actions/brewing/ultra_crafting_tea": "究極製作茶",
        "/actions/brewing/ultra_ranged_coffee": "究極遠程咖啡",
        "/actions/brewing/ultra_tailoring_tea": "究極縫紉茶",
        "/actions/brewing/ultra_magic_coffee": "究極魔法咖啡",
        "/actions/alchemy/coinify": "點金",
        "/actions/alchemy/transmute": "轉化",
        "/actions/alchemy/decompose": "分解",
        "/actions/alchemy/unrefine": "解精煉",
        "/actions/enhancing/enhance": "強化",
        "/actions/combat/fly": "蒼蠅",
        "/actions/combat/rat": "傑瑞",
        "/actions/combat/skunk": "臭鼬",
        "/actions/combat/porcupine": "豪豬",
        "/actions/combat/slimy": "史萊姆",
        "/actions/combat/smelly_planet": "臭臭星球",
        "/actions/combat/frog": "青蛙",
        "/actions/combat/snake": "蛇",
        "/actions/combat/swampy": "沼澤蟲",
        "/actions/combat/alligator": "夏洛克",
        "/actions/combat/swamp_planet": "沼澤星球",
        "/actions/combat/sea_snail": "蝸牛",
        "/actions/combat/crab": "螃蟹",
        "/actions/combat/aquahorse": "水馬",
        "/actions/combat/nom_nom": "咬咬魚",
        "/actions/combat/turtle": "忍者龜",
        "/actions/combat/aqua_planet": "海洋星球",
        "/actions/combat/jungle_sprite": "叢林精靈",
        "/actions/combat/myconid": "蘑菇人",
        "/actions/combat/treant": "樹人",
        "/actions/combat/centaur_archer": "半人馬弓箭手",
        "/actions/combat/jungle_planet": "叢林星球",
        "/actions/combat/gobo_stabby": "刺刺",
        "/actions/combat/gobo_slashy": "砍砍",
        "/actions/combat/gobo_smashy": "錘錘",
        "/actions/combat/gobo_shooty": "咻咻",
        "/actions/combat/gobo_boomy": "轟轟",
        "/actions/combat/gobo_planet": "哥布林星球",
        "/actions/combat/eye": "獨眼",
        "/actions/combat/eyes": "疊眼",
        "/actions/combat/veyes": "複眼",
        "/actions/combat/planet_of_the_eyes": "眼球星球",
        "/actions/combat/novice_sorcerer": "新手巫師",
        "/actions/combat/ice_sorcerer": "冰霜巫師",
        "/actions/combat/flame_sorcerer": "火焰巫師",
        "/actions/combat/elementalist": "元素法師",
        "/actions/combat/sorcerers_tower": "巫師之塔",
        "/actions/combat/gummy_bear": "軟糖熊",
        "/actions/combat/panda": "熊貓",
        "/actions/combat/black_bear": "黑熊",
        "/actions/combat/grizzly_bear": "棕熊",
        "/actions/combat/polar_bear": "北極熊",
        "/actions/combat/bear_with_it": "熊熊星球",
        "/actions/combat/magnetic_golem": "磁力魔像",
        "/actions/combat/stalactite_golem": "鐘乳石魔像",
        "/actions/combat/granite_golem": "花崗岩魔像",
        "/actions/combat/golem_cave": "魔像洞穴",
        "/actions/combat/zombie": "殭屍",
        "/actions/combat/vampire": "吸血鬼",
        "/actions/combat/werewolf": "狼人",
        "/actions/combat/twilight_zone": "暮光之地",
        "/actions/combat/abyssal_imp": "深淵小鬼",
        "/actions/combat/soul_hunter": "靈魂獵手",
        "/actions/combat/infernal_warlock": "地獄術士",
        "/actions/combat/infernal_abyss": "地獄深淵",
        "/actions/combat/chimerical_den": "奇幻洞穴",
        "/actions/combat/sinister_circus": "陰森馬戲團",
        "/actions/combat/enchanted_fortress": "秘法要塞",
        "/actions/combat/pirate_cove": "海盜基地",
        "/actions/labyrinth/explore": "探索迷宮",
        "/actions/special/party_ready": "隊伍準備就緒",
    };

    const ZHOthersDic = {
        "/monsters/abyssal_imp": "深淵小鬼",
        "/monsters/acrobat": "雜技師",
        "/monsters/anchor_shark": "持錨鯊",
        "/monsters/aquahorse": "水馬",
        "/monsters/black_bear": "黑熊",
        "/monsters/gobo_boomy": "轟轟",
        "/monsters/brine_marksman": "海鹽射手",
        "/monsters/butterjerry": "蝶鼠",
        "/monsters/captain_fishhook": "魚鉤船長",
        "/monsters/centaur_archer": "半人馬弓箭手",
        "/monsters/cyclops": "獨眼巨人",
        "/monsters/chronofrost_sorcerer": "霜時巫師",
        "/monsters/dryad": "樹精",
        "/monsters/crystal_colossus": "水晶巨像",
        "/monsters/frost_sniper": "霜凍狙擊手",
        "/monsters/demonic_overlord": "惡魔霸主",
        "/monsters/deranged_jester": "小丑皇",
        "/monsters/dodocamel": "渡渡駝",
        "/monsters/dusk_revenant": "黃昏亡靈",
        "/monsters/elementalist": "元素法師",
        "/monsters/enchanted_bishop": "秘法主教",
        "/monsters/enchanted_king": "秘法國王",
        "/monsters/enchanted_knight": "秘法騎士",
        "/monsters/enchanted_pawn": "秘法士兵",
        "/monsters/enchanted_queen": "秘法王后",
        "/monsters/enchanted_rook": "秘法堡壘",
        "/monsters/eye": "獨眼",
        "/monsters/eyes": "疊眼",
        "/monsters/flame_sorcerer": "火焰巫師",
        "/monsters/fly": "蒼蠅",
        "/monsters/frog": "青蛙",
        "/monsters/sea_snail": "蝸牛",
        "/monsters/giant_shoebill": "鯨頭鸛",
        "/monsters/gobo_chieftain": "哥布林酋長",
        "/monsters/granite_golem": "花崗魔像",
        "/monsters/griffin": "獅鷲",
        "/monsters/grizzly_bear": "棕熊",
        "/monsters/gummy_bear": "軟糖熊",
        "/monsters/crab": "螃蟹",
        "/monsters/ice_sorcerer": "冰霜巫師",
        "/monsters/infernal_warlock": "地獄術士",
        "/monsters/jackalope": "鹿角兔",
        "/monsters/rat": "傑瑞",
        "/monsters/juggler": "雜耍者",
        "/monsters/jungle_sprite": "叢林精靈",
        "/monsters/giant_mantis": "巨螳螂",
        "/monsters/luna_empress": "月神之蝶",
        "/monsters/magician": "魔術師",
        "/monsters/magnetic_golem": "磁力魔像",
        "/monsters/manticore": "獅蠍獸",
        "/monsters/marine_huntress": "海洋獵手",
        "/monsters/giant_scorpion": "巨蠍",
        "/monsters/mimic": "寶箱怪",
        "/monsters/myconid": "蘑菇人",
        "/monsters/nom_nom": "咬咬魚",
        "/monsters/novice_sorcerer": "新手巫師",
        "/monsters/panda": "熊貓",
        "/monsters/polar_bear": "北極熊",
        "/monsters/porcupine": "豪豬",
        "/monsters/rabid_rabbit": "瘋魔兔",
        "/monsters/red_panda": "小熊貓",
        "/monsters/alligator": "夏洛克",
        "/monsters/gobo_shooty": "咻咻",
        "/monsters/skunk": "臭鼬",
        "/monsters/gobo_slashy": "砍砍",
        "/monsters/slimy": "史萊姆",
        "/monsters/gobo_smashy": "錘錘",
        "/monsters/soul_hunter": "靈魂獵手",
        "/monsters/squawker": "鸚鵡",
        "/monsters/gobo_stabby": "刺刺",
        "/monsters/stalactite_golem": "鐘乳石魔像",
        "/monsters/pyre_hunter": "火焰獵手",
        "/monsters/swampy": "沼澤蟲",
        "/monsters/the_kraken": "克拉肯",
        "/monsters/the_watcher": "觀察者",
        "/monsters/snake": "蛇",
        "/monsters/tidal_conjuror": "潮汐召喚師",
        "/monsters/salamander": "火蜥蜴",
        "/monsters/shadow_archer": "暗影弓手",
        "/monsters/treant": "樹人",
        "/monsters/trial_badger": "試煉獾",
        "/monsters/trial_beetle": "試煉甲蟲",
        "/monsters/trial_chameleon": "試煉變色龍",
        "/monsters/trial_dragonfly": "試煉蜻蜓",
        "/monsters/trial_firefly": "試煉螢火蟲",
        "/monsters/trial_hedgehog": "試煉刺蝟",
        "/monsters/trial_jellyfish": "試煉水母",
        "/monsters/trial_wasp": "試煉黃蜂",
        "/monsters/turtle": "忍者龜",
        "/monsters/vampire": "吸血鬼",
        "/monsters/veyes": "複眼",
        "/monsters/siren": "海妖",
        "/monsters/werewolf": "狼人",
        "/monsters/zombie": "殭屍",
        "/monsters/zombie_bear": "殭屍熊",
        "/abilities/poke": "破膽之刺",
        "/abilities/impale": "透骨之刺",
        "/abilities/puncture": "破甲之刺",
        "/abilities/penetrating_strike": "貫心之刺",
        "/abilities/scratch": "爪影斬",
        "/abilities/cleave": "分裂斬",
        "/abilities/maim": "血刃斬",
        "/abilities/crippling_slash": "致殘斬",
        "/abilities/smack": "重碾",
        "/abilities/sweep": "重掃",
        "/abilities/stunning_blow": "重錘",
        "/abilities/fracturing_impact": "碎裂衝擊",
        "/abilities/shield_bash": "盾擊",
        "/abilities/quick_shot": "快速射擊",
        "/abilities/aqua_arrow": "流水箭",
        "/abilities/flame_arrow": "烈焰箭",
        "/abilities/rain_of_arrows": "箭雨",
        "/abilities/silencing_shot": "沉默之箭",
        "/abilities/steady_shot": "穩定射擊",
        "/abilities/pestilent_shot": "疫病射擊",
        "/abilities/penetrating_shot": "貫穿射擊",
        "/abilities/water_strike": "流水衝擊",
        "/abilities/ice_spear": "冰槍術",
        "/abilities/frost_surge": "冰霜爆裂",
        "/abilities/mana_spring": "法力噴泉",
        "/abilities/entangle": "纏繞",
        "/abilities/toxic_pollen": "劇毒粉塵",
        "/abilities/natures_veil": "自然菌幕",
        "/abilities/life_drain": "生命吸取",
        "/abilities/fireball": "火球",
        "/abilities/flame_blast": "熔岩爆裂",
        "/abilities/firestorm": "火焰風暴",
        "/abilities/smoke_burst": "煙爆滅影",
        "/abilities/minor_heal": "初級自愈術",
        "/abilities/heal": "自愈術",
        "/abilities/quick_aid": "快速治療術",
        "/abilities/rejuvenate": "群體治療術",
        "/abilities/taunt": "嘲諷",
        "/abilities/provoke": "挑釁",
        "/abilities/toughness": "堅韌",
        "/abilities/elusiveness": "閃避",
        "/abilities/precision": "精確",
        "/abilities/berserk": "狂暴",
        "/abilities/frenzy": "狂速",
        "/abilities/elemental_affinity": "元素增幅",
        "/abilities/spike_shell": "尖刺防護",
        "/abilities/retribution": "懲戒",
        "/abilities/vampirism": "吸血",
        "/abilities/revive": "復活",
        "/abilities/insanity": "瘋狂",
        "/abilities/invincible": "無敵",
        "/abilities/speed_aura": "速度光環",
        "/abilities/guardian_aura": "守護光環",
        "/abilities/fierce_aura": "物理光環",
        "/abilities/critical_aura": "暴擊光環",
        "/abilities/mystic_aura": "元素光環",
        "/abilities/promote": "晉升",
    };

    function inverseKV(obj) {
        const retobj = {};
        for (const key in obj) {
            retobj[obj[key]] = key;
        }
        return retobj;
    }

    const ZHToItemHridMap = inverseKV(ZHItemNames);
    const ZHToActionHridMap = inverseKV(ZHActionNames);
    const ZHToOthersMap = inverseKV(ZHOthersDic);

    function getItemEnNameFromZhName(zhName) {
        const itemHrid = ZHToItemHridMap[zhName];
        if (!itemHrid) {
            console.log("Can not find EN name for item " + zhName);
            return "";
        }
        const enName = initData_itemDetailMap[itemHrid]?.name;
        if (!enName) {
            console.log("Can not find EN name for itemHrid " + itemHrid);
            return "";
        }
        return enName;
    }

    function getActionEnNameFromZhName(zhName) {
        const actionHrid = ZHToActionHridMap[zhName];
        if (!actionHrid) {
            console.log("Can not find EN name for action " + zhName);
            return "";
        }
        const enName = initData_actionDetailMap[actionHrid]?.name;
        if (!enName) {
            console.log("Can not find EN name for actionHrid " + actionHrid);
            return "";
        }
        return enName;
    }

    function getOthersFromZhName(zhName) {
        const key = ZHToOthersMap[zhName];
        if (!key) {
            // console.log("Can not find EN key for " + zhName);
            return "";
        }
        return key;
    }

    const itemEnNameToHridMap = {};

    const MARKET_JSON_LOCAL_BACKUP = `{"marketData":{"/items/abyssal_essence":{"0":{"a":260,"b":255}},"/items/acrobatic_hood":{"0":{"a":70000000,"b":68000000},"2":{"a":-1,"b":58000000},"3":{"a":-1,"b":58000000},"4":{"a":-1,"b":58000000},"5":{"a":74000000,"b":66000000},"6":{"a":-1,"b":56000000},"7":{"a":90000000,"b":84000000},"8":{"a":145000000,"b":110000000},"9":{"a":-1,"b":150000000},"10":{"a":280000000,"b":275000000},"11":{"a":-1,"b":340000000},"12":{"a":-1,"b":960000000}},"/items/acrobatic_hood_refined":{"5":{"a":-1,"b":3600000},"10":{"a":580000000,"b":540000000},"11":{"a":-1,"b":3600000}},"/items/acrobats_ribbon":{"0":{"a":6800000,"b":6600000}},"/items/advanced_alchemy_charm":{"0":{"a":39000000,"b":-1},"1":{"a":48000000,"b":-1},"2":{"a":54000000,"b":-1},"3":{"a":52000000,"b":31000000},"4":{"a":74000000,"b":-1},"5":{"a":120000000,"b":-1}},"/items/advanced_attack_charm":{"0":{"a":7400000,"b":6400000},"1":{"a":11000000,"b":7000000},"2":{"a":16000000,"b":9800000},"3":{"a":19500000,"b":18000000},"4":{"a":39000000,"b":-1},"5":{"a":56000000,"b":46000000}},"/items/advanced_brewing_charm":{"0":{"a":16000000,"b":14000000},"2":{"a":25500000,"b":-1},"3":{"a":31000000,"b":-1},"4":{"a":66000000,"b":38000000},"5":{"a":105000000,"b":-1}},"/items/advanced_cheesesmithing_charm":{"0":{"a":23500000,"b":12500000},"3":{"a":42000000,"b":-1},"4":{"a":60000000,"b":-1},"5":{"a":80000000,"b":52000000}},"/items/advanced_cooking_charm":{"0":{"a":-1,"b":20500000},"1":{"a":30000000,"b":-1},"2":{"a":39000000,"b":-1},"3":{"a":38000000,"b":-1},"5":{"a":82000000,"b":74000000}},"/items/advanced_crafting_charm":{"0":{"a":27500000,"b":24000000},"1":{"a":29500000,"b":-1},"2":{"a":36000000,"b":19000000},"3":{"a":46000000,"b":-1},"4":{"a":88000000,"b":-1}},"/items/advanced_defense_charm":{"0":{"a":7000000,"b":6600000},"1":{"a":11000000,"b":9200000},"2":{"a":-1,"b":8200000},"3":{"a":19500000,"b":18500000},"5":{"a":82000000,"b":68000000}},"/items/advanced_enhancing_charm":{"0":{"a":58000000,"b":32000000},"1":{"a":74000000,"b":-1},"3":{"a":96000000,"b":-1},"5":{"a":150000000,"b":100000000}},"/items/advanced_foraging_charm":{"0":{"a":21000000,"b":18500000},"1":{"a":28000000,"b":-1},"3":{"a":38000000,"b":-1},"4":{"a":62000000,"b":-1},"5":{"a":115000000,"b":80000000},"7":{"a":-1,"b":1600000}},"/items/advanced_intelligence_charm":{"0":{"a":7400000,"b":6400000},"1":{"a":13000000,"b":7000000},"3":{"a":21500000,"b":18500000},"4":{"a":-1,"b":37000000},"5":{"a":78000000,"b":62000000}},"/items/advanced_magic_charm":{"0":{"a":11500000,"b":10000000},"1":{"a":15000000,"b":11500000},"3":{"a":22000000,"b":19000000},"4":{"a":42000000,"b":35000000},"5":{"a":-1,"b":68000000}},"/items/advanced_melee_charm":{"0":{"a":6800000,"b":6600000},"1":{"a":9000000,"b":5400000},"2":{"a":13500000,"b":8200000},"3":{"a":18500000,"b":17500000},"4":{"a":49000000,"b":29000000},"5":{"a":58000000,"b":50000000}},"/items/advanced_milking_charm":{"0":{"a":25500000,"b":20500000},"1":{"a":28000000,"b":-1},"2":{"a":28000000,"b":-1},"3":{"a":33000000,"b":-1},"4":{"a":66000000,"b":50000000},"5":{"a":98000000,"b":-1}},"/items/advanced_ranged_charm":{"0":{"a":6800000,"b":6400000},"1":{"a":10000000,"b":-1},"2":{"a":13000000,"b":8000000},"3":{"a":20000000,"b":16500000},"4":{"a":39000000,"b":36000000},"5":{"a":74000000,"b":33000000}},"/items/advanced_stamina_charm":{"0":{"a":14500000,"b":14000000},"1":{"a":-1,"b":12000000},"2":{"a":19500000,"b":12500000},"3":{"a":30000000,"b":26500000},"4":{"a":56000000,"b":44000000},"5":{"a":82000000,"b":64000000}},"/items/advanced_tailoring_charm":{"0":{"a":21000000,"b":15000000},"1":{"a":28000000,"b":-1},"2":{"a":38000000,"b":-1},"3":{"a":40000000,"b":29000000},"4":{"a":68000000,"b":-1},"5":{"a":96000000,"b":64000000}},"/items/advanced_woodcutting_charm":{"0":{"a":22000000,"b":15000000},"1":{"a":38000000,"b":-1},"3":{"a":40000000,"b":-1}},"/items/alchemists_bottoms":{"0":{"a":-1,"b":150000000},"5":{"a":255000000,"b":225000000},"6":{"a":500000000,"b":-1},"7":{"a":265000000,"b":250000000},"8":{"a":310000000,"b":270000000},"10":{"a":480000000,"b":440000000}},"/items/alchemists_top":{"0":{"a":-1,"b":150000000},"1":{"a":-1,"b":3800000},"3":{"a":-1,"b":3500000},"5":{"a":210000000,"b":180000000},"6":{"a":230000000,"b":80000000},"7":{"a":240000000,"b":210000000},"8":{"a":270000000,"b":240000000},"10":{"a":440000000,"b":380000000}},"/items/alchemy_essence":{"0":{"a":400,"b":390}},"/items/alchemy_tea":{"0":{"a":860,"b":820}},"/items/amber":{"0":{"a":21500,"b":21000}},"/items/amethyst":{"0":{"a":34000,"b":33000}},"/items/anchorbound_plate_body":{"0":{"a":96000000,"b":92000000},"1":{"a":-1,"b":84000000},"2":{"a":-1,"b":84000000},"3":{"a":-1,"b":84000000},"4":{"a":-1,"b":86000000},"5":{"a":110000000,"b":100000000},"6":{"a":-1,"b":90000000},"7":{"a":125000000,"b":120000000},"8":{"a":170000000,"b":145000000},"9":{"a":-1,"b":180000000},"10":{"a":410000000,"b":390000000},"12":{"a":1300000000,"b":960000000}},"/items/anchorbound_plate_body_refined":{"10":{"a":-1,"b":4500000}},"/items/anchorbound_plate_legs":{"0":{"a":76000000,"b":72000000},"1":{"a":-1,"b":68000000},"2":{"a":-1,"b":70000000},"4":{"a":-1,"b":66000000},"5":{"a":94000000,"b":84000000},"6":{"a":-1,"b":72000000},"7":{"a":105000000,"b":98000000},"8":{"a":150000000,"b":120000000},"10":{"a":370000000,"b":-1}},"/items/anchorbound_plate_legs_refined":{},"/items/apple":{"0":{"a":23,"b":21}},"/items/apple_gummy":{"0":{"a":19,"b":17}},"/items/apple_yogurt":{"0":{"a":500,"b":440}},"/items/aqua_arrow":{"0":{"a":33000,"b":32000}},"/items/aqua_essence":{"0":{"a":30,"b":25}},"/items/arabica_coffee_bean":{"0":{"a":320,"b":310}},"/items/arcane_bow":{"0":{"a":1000000,"b":980000},"1":{"a":1250000,"b":-1},"2":{"a":1400000,"b":-1},"3":{"a":1300000,"b":-1},"4":{"a":1550000,"b":-1},"5":{"a":1650000,"b":250000},"6":{"a":13000000,"b":-1},"7":{"a":15000000,"b":-1}},"/items/arcane_crossbow":{"0":{"a":760000,"b":740000},"1":{"a":800000,"b":-1},"2":{"a":820000,"b":390000},"3":{"a":840000,"b":400000},"4":{"a":1000000,"b":420000},"5":{"a":1450000,"b":460000},"6":{"a":4700000,"b":460000},"7":{"a":10000000,"b":-1},"10":{"a":72000000,"b":-1}},"/items/arcane_fire_staff":{"0":{"a":760000,"b":740000},"1":{"a":-1,"b":360000},"2":{"a":1200000,"b":-1},"3":{"a":800000,"b":350000},"4":{"a":840000,"b":490000},"5":{"a":920000,"b":440000}},"/items/arcane_log":{"0":{"a":430,"b":410}},"/items/arcane_lumber":{"0":{"a":2200,"b":2150}},"/items/arcane_nature_staff":{"0":{"a":780000,"b":760000},"1":{"a":880000,"b":450000},"2":{"a":880000,"b":-1},"3":{"a":880000,"b":-1},"4":{"a":1000000,"b":460000},"5":{"a":1350000,"b":1000000},"7":{"a":8600000,"b":860000},"9":{"a":9000000,"b":900000}},"/items/arcane_shield":{"0":{"a":520000,"b":490000},"3":{"a":1000000,"b":-1},"4":{"a":980000,"b":-1},"5":{"a":2850000,"b":820000},"6":{"a":-1,"b":540000}},"/items/arcane_water_staff":{"0":{"a":780000,"b":760000},"1":{"a":820000,"b":-1},"2":{"a":760000,"b":-1},"3":{"a":880000,"b":-1},"5":{"a":1650000,"b":500000}},"/items/artisan_tea":{"0":{"a":1750,"b":1700}},"/items/attack_coffee":{"0":{"a":900,"b":880}},"/items/azure_alembic":{"0":{"a":54000,"b":44000},"1":{"a":115000000,"b":-1},"3":{"a":230000,"b":-1}},"/items/azure_boots":{"0":{"a":28500,"b":26000},"1":{"a":36000,"b":-1},"4":{"a":195000,"b":-1}},"/items/azure_brush":{"0":{"a":41000,"b":31000},"1":{"a":64000,"b":2250},"2":{"a":80000,"b":2250},"3":{"a":100000,"b":-1},"9":{"a":720000,"b":-1}},"/items/azure_buckler":{"0":{"a":39000,"b":32000},"1":{"a":70000,"b":-1},"2":{"a":86000,"b":-1},"3":{"a":110000,"b":-1},"5":{"a":150000,"b":-1}},"/items/azure_bulwark":{"0":{"a":50000,"b":45000},"5":{"a":500000,"b":-1}},"/items/azure_cheese":{"0":{"a":940,"b":920}},"/items/azure_chisel":{"0":{"a":56000,"b":32000},"1":{"a":115000,"b":-1},"2":{"a":120000,"b":-1},"3":{"a":235000,"b":-1}},"/items/azure_enhancer":{"0":{"a":68000,"b":39000},"3":{"a":90000,"b":-1},"4":{"a":125000,"b":-1}},"/items/azure_gauntlets":{"0":{"a":26500,"b":23000},"1":{"a":47000,"b":-1},"2":{"a":-1,"b":2350},"3":{"a":205000,"b":-1},"4":{"a":250000,"b":-1}},"/items/azure_hammer":{"0":{"a":54000,"b":37000},"1":{"a":250000,"b":2050},"2":{"a":-1,"b":2050},"3":{"a":400000,"b":2050},"7":{"a":500000,"b":-1}},"/items/azure_hatchet":{"0":{"a":48000,"b":36000},"3":{"a":390000,"b":-1},"5":{"a":380000,"b":-1}},"/items/azure_helmet":{"0":{"a":35000,"b":32000},"1":{"a":45000,"b":-1},"2":{"a":-1,"b":2900}},"/items/azure_mace":{"0":{"a":54000,"b":49000},"1":{"a":115000,"b":-1},"3":{"a":120000,"b":-1}},"/items/azure_milk":{"0":{"a":195,"b":185}},"/items/azure_needle":{"0":{"a":45000,"b":41000},"1":{"a":98000,"b":-1},"3":{"a":235000,"b":-1},"5":{"a":330000,"b":-1}},"/items/azure_plate_body":{"0":{"a":54000,"b":47000},"1":{"a":54000,"b":-1},"2":{"a":105000,"b":78000},"4":{"a":200000,"b":-1},"5":{"a":275000,"b":-1}},"/items/azure_plate_legs":{"0":{"a":46000,"b":44000},"1":{"a":200000,"b":-1},"4":{"a":300000,"b":-1},"5":{"a":430000,"b":-1}},"/items/azure_pot":{"0":{"a":94000,"b":43000},"1":{"a":265000,"b":-1},"2":{"a":175000,"b":-1},"3":{"a":250000,"b":-1}},"/items/azure_shears":{"0":{"a":46000,"b":42000},"1":{"a":32000000,"b":-1},"2":{"a":420000,"b":-1},"3":{"a":78000,"b":-1}},"/items/azure_spatula":{"0":{"a":54000,"b":45000},"2":{"a":150000,"b":-1},"3":{"a":235000,"b":2050},"4":{"a":-1,"b":2050},"6":{"a":-1,"b":2050}},"/items/azure_spear":{"0":{"a":52000,"b":50000},"1":{"a":10000000,"b":-1},"2":{"a":10000000,"b":-1}},"/items/azure_sword":{"0":{"a":56000,"b":52000},"1":{"a":17000000,"b":-1},"2":{"a":200000,"b":-1},"4":{"a":300000,"b":-1},"5":{"a":175000,"b":-1}},"/items/bag_of_10_cowbells":{"0":{"a":540000,"b":500000}},"/items/bamboo_boots":{"0":{"a":25500,"b":20500},"1":{"a":46000,"b":-1},"2":{"a":66000,"b":-1},"3":{"a":160000,"b":-1},"4":{"a":115000,"b":-1},"5":{"a":92000,"b":-1},"6":{"a":680000,"b":-1},"7":{"a":700000,"b":-1},"8":{"a":1200000,"b":-1}},"/items/bamboo_branch":{"0":{"a":25,"b":24}},"/items/bamboo_fabric":{"0":{"a":320,"b":290}},"/items/bamboo_gloves":{"0":{"a":24000,"b":18500},"1":{"a":60000,"b":-1},"2":{"a":86000,"b":-1},"3":{"a":190000,"b":-1},"4":{"a":120000,"b":-1},"5":{"a":380000,"b":-1},"6":{"a":640000,"b":-1}},"/items/bamboo_hat":{"0":{"a":30000,"b":24500},"1":{"a":100000,"b":-1},"2":{"a":135000,"b":-1},"3":{"a":310000,"b":-1}},"/items/bamboo_robe_bottoms":{"0":{"a":37000,"b":34000},"2":{"a":160000,"b":-1},"3":{"a":300000,"b":-1}},"/items/bamboo_robe_top":{"0":{"a":44000,"b":42000},"2":{"a":160000,"b":-1},"3":{"a":220000,"b":-1}},"/items/basic_alchemy_charm":{"0":{"a":4000000,"b":3400000},"1":{"a":12500000,"b":-1}},"/items/basic_attack_charm":{"0":{"a":840000,"b":820000},"1":{"a":960000,"b":-1},"2":{"a":4900000,"b":-1},"3":{"a":7400000,"b":-1},"5":{"a":28500000,"b":-1}},"/items/basic_brewing_charm":{"0":{"a":1800000,"b":1650000},"2":{"a":7800000,"b":-1}},"/items/basic_cheesesmithing_charm":{"0":{"a":2850000,"b":2650000}},"/items/basic_cooking_charm":{"0":{"a":3000000,"b":2600000},"2":{"a":15000000,"b":-1}},"/items/basic_crafting_charm":{"0":{"a":3400000,"b":-1}},"/items/basic_defense_charm":{"0":{"a":860000,"b":840000},"1":{"a":12500000,"b":-1}},"/items/basic_enhancing_charm":{"0":{"a":8200000,"b":7200000},"1":{"a":9600000,"b":-1},"3":{"a":23000000,"b":-1}},"/items/basic_foraging_charm":{"0":{"a":2800000,"b":2300000}},"/items/basic_intelligence_charm":{"0":{"a":840000,"b":820000}},"/items/basic_magic_charm":{"0":{"a":1300000,"b":1250000},"2":{"a":9800000,"b":-1},"3":{"a":9400000,"b":-1}},"/items/basic_melee_charm":{"0":{"a":840000,"b":820000},"1":{"a":1550000,"b":-1},"3":{"a":600000000,"b":-1}},"/items/basic_milking_charm":{"0":{"a":2450000,"b":1800000},"1":{"a":18500000,"b":-1}},"/items/basic_ranged_charm":{"0":{"a":840000,"b":820000},"1":{"a":3800000,"b":-1},"2":{"a":7400000,"b":-1},"3":{"a":7000000,"b":-1}},"/items/basic_stamina_charm":{"0":{"a":1500000,"b":1400000},"2":{"a":7800000,"b":-1}},"/items/basic_tailoring_charm":{"0":{"a":2550000,"b":1750000},"1":{"a":2850000,"b":-1}},"/items/basic_woodcutting_charm":{"0":{"a":2500000,"b":1750000},"1":{"a":3200000,"b":-1}},"/items/bear_essence":{"0":{"a":88,"b":86}},"/items/beast_boots":{"0":{"a":66000,"b":62000},"3":{"a":260000,"b":-1},"5":{"a":280000,"b":-1},"7":{"a":1200000,"b":-1},"8":{"a":1950000,"b":-1}},"/items/beast_bracers":{"0":{"a":96000,"b":92000},"1":{"a":240000,"b":-1},"2":{"a":175000,"b":-1},"3":{"a":220000,"b":-1},"4":{"a":250000,"b":-1},"5":{"a":470000,"b":100000},"6":{"a":800000,"b":-1},"7":{"a":15500000,"b":-1}},"/items/beast_chaps":{"0":{"a":145000,"b":140000},"1":{"a":165000,"b":-1},"2":{"a":165000,"b":-1},"3":{"a":220000,"b":-1},"5":{"a":420000,"b":100000}},"/items/beast_hide":{"0":{"a":22,"b":20}},"/items/beast_hood":{"0":{"a":72000,"b":68000},"2":{"a":78000,"b":-1},"3":{"a":125000,"b":-1},"4":{"a":290000,"b":-1},"5":{"a":480000,"b":100000}},"/items/beast_leather":{"0":{"a":1150,"b":1100}},"/items/beast_tunic":{"0":{"a":180000,"b":175000},"2":{"a":300000,"b":-1},"3":{"a":190000,"b":-1},"4":{"a":310000,"b":-1},"5":{"a":380000,"b":100000},"10":{"a":-1,"b":3000000}},"/items/berserk":{"0":{"a":195000,"b":190000}},"/items/birch_bow":{"0":{"a":23500,"b":18000},"2":{"a":145000,"b":-1},"5":{"a":400000,"b":-1},"6":{"a":700000,"b":-1}},"/items/birch_crossbow":{"0":{"a":34000,"b":13000},"1":{"a":5600000,"b":-1},"3":{"a":145000,"b":-1},"4":{"a":200000,"b":-1},"6":{"a":1400000,"b":-1}},"/items/birch_fire_staff":{"0":{"a":19000,"b":17500},"1":{"a":49000,"b":-1},"2":{"a":49000,"b":-1},"3":{"a":145000,"b":-1},"5":{"a":700000,"b":-1}},"/items/birch_log":{"0":{"a":70,"b":68}},"/items/birch_lumber":{"0":{"a":560,"b":540}},"/items/birch_nature_staff":{"0":{"a":26000,"b":18500},"2":{"a":56000,"b":-1},"8":{"a":1150000,"b":-1},"10":{"a":22000000,"b":-1}},"/items/birch_shield":{"0":{"a":13000,"b":4100}},"/items/birch_water_staff":{"0":{"a":21000,"b":17500},"1":{"a":47000,"b":-1},"2":{"a":280000,"b":-1},"3":{"a":340000,"b":-1}},"/items/bishops_codex":{"0":{"a":98000000,"b":96000000},"1":{"a":-1,"b":80000000},"2":{"a":-1,"b":80000000},"3":{"a":-1,"b":80000000},"4":{"a":-1,"b":80000000},"5":{"a":100000000,"b":96000000},"6":{"a":-1,"b":90000000},"7":{"a":125000000,"b":115000000},"8":{"a":160000000,"b":140000000},"9":{"a":-1,"b":180000000},"10":{"a":360000000,"b":350000000},"11":{"a":-1,"b":440000000},"12":{"a":1200000000,"b":1050000000},"13":{"a":2000000000,"b":1900000000}},"/items/bishops_codex_refined":{"10":{"a":700000000,"b":680000000}},"/items/bishops_scroll":{"0":{"a":8000000,"b":7800000}},"/items/black_bear_fluff":{"0":{"a":125000,"b":120000}},"/items/black_bear_shoes":{"0":{"a":720000,"b":700000},"2":{"a":740000,"b":-1},"3":{"a":940000,"b":-1},"5":{"a":1200000,"b":-1},"6":{"a":1700000,"b":-1},"7":{"a":3200000,"b":-1},"8":{"a":4500000,"b":-1},"9":{"a":9000000,"b":-1},"10":{"a":13000000,"b":12500000},"11":{"a":24000000,"b":-1},"12":{"a":47000000,"b":43000000},"13":{"a":90000000,"b":-1},"14":{"a":165000000,"b":155000000},"15":{"a":320000000,"b":-1},"16":{"a":620000000,"b":-1}},"/items/black_tea_leaf":{"0":{"a":17,"b":16}},"/items/blackberry":{"0":{"a":98,"b":96}},"/items/blackberry_cake":{"0":{"a":800,"b":780}},"/items/blackberry_donut":{"0":{"a":700,"b":680}},"/items/blazing_trident":{"0":{"a":250000000,"b":240000000},"1":{"a":-1,"b":205000000},"2":{"a":-1,"b":205000000},"3":{"a":-1,"b":195000000},"4":{"a":-1,"b":210000000},"5":{"a":250000000,"b":210000000},"6":{"a":-1,"b":210000000},"7":{"a":280000000,"b":265000000},"8":{"a":380000000,"b":310000000},"9":{"a":-1,"b":360000000},"10":{"a":620000000,"b":600000000},"11":{"a":1150000000,"b":860000000},"12":{"a":1750000000,"b":1550000000},"14":{"a":-1,"b":4000000000}},"/items/blazing_trident_refined":{"0":{"a":-1,"b":5000000},"10":{"a":1700000000,"b":1600000000},"12":{"a":-1,"b":110000000},"14":{"a":8600000000,"b":-1}},"/items/blessed_tea":{"0":{"a":1750,"b":1650}},"/items/blooming_trident":{"0":{"a":270000000,"b":265000000},"1":{"a":-1,"b":205000000},"2":{"a":-1,"b":205000000},"3":{"a":-1,"b":205000000},"4":{"a":-1,"b":210000000},"5":{"a":-1,"b":250000000},"6":{"a":-1,"b":255000000},"7":{"a":295000000,"b":285000000},"8":{"a":-1,"b":340000000},"9":{"a":-1,"b":350000000},"10":{"a":660000000,"b":620000000},"11":{"a":-1,"b":680000000},"12":{"a":1850000000,"b":1750000000},"13":{"a":3100000000,"b":-1},"14":{"a":6400000000,"b":-1}},"/items/blooming_trident_refined":{"10":{"a":-1,"b":1050000000},"14":{"a":7200000000,"b":-1}},"/items/blue_key_fragment":{"0":{"a":740000,"b":720000}},"/items/blueberry":{"0":{"a":72,"b":70}},"/items/blueberry_cake":{"0":{"a":720,"b":660}},"/items/blueberry_donut":{"0":{"a":620,"b":600}},"/items/branch_of_insight":{"0":{"a":21000000,"b":20500000}},"/items/brewers_bottoms":{"0":{"a":-1,"b":33000000},"5":{"a":220000000,"b":-1},"7":{"a":240000000,"b":220000000},"8":{"a":275000000,"b":250000000},"9":{"a":-1,"b":235000000},"10":{"a":410000000,"b":390000000},"12":{"a":-1,"b":600000000}},"/items/brewers_top":{"0":{"a":280000000,"b":-1},"5":{"a":185000000,"b":155000000},"6":{"a":190000000,"b":165000000},"7":{"a":230000000,"b":190000000},"8":{"a":235000000,"b":64000000},"9":{"a":-1,"b":235000000},"10":{"a":380000000,"b":370000000},"12":{"a":1150000000,"b":-1}},"/items/brewing_essence":{"0":{"a":200,"b":195}},"/items/brewing_tea":{"0":{"a":520,"b":470}},"/items/brown_key_fragment":{"0":{"a":960000,"b":940000}},"/items/burble_alembic":{"0":{"a":98000,"b":94000},"3":{"a":390000,"b":-1},"5":{"a":-1,"b":400000}},"/items/burble_boots":{"0":{"a":62000,"b":52000},"1":{"a":62000,"b":-1},"2":{"a":280000,"b":-1},"3":{"a":320000,"b":-1}},"/items/burble_brush":{"0":{"a":98000,"b":90000},"1":{"a":145000,"b":-1},"2":{"a":200000,"b":-1},"3":{"a":350000,"b":-1},"5":{"a":500000,"b":-1},"20":{"a":-1,"b":88000}},"/items/burble_buckler":{"0":{"a":76000,"b":60000},"1":{"a":140000,"b":-1},"7":{"a":500000000,"b":-1}},"/items/burble_bulwark":{"0":{"a":125000,"b":110000},"2":{"a":4400000,"b":-1},"5":{"a":300000,"b":-1}},"/items/burble_cheese":{"0":{"a":1250,"b":1200}},"/items/burble_chisel":{"0":{"a":96000,"b":80000},"1":{"a":185000,"b":5200},"2":{"a":-1,"b":5200},"3":{"a":370000,"b":5200}},"/items/burble_enhancer":{"0":{"a":98000,"b":86000},"1":{"a":110000,"b":-1},"2":{"a":120000,"b":-1},"3":{"a":145000,"b":-1},"4":{"a":175000,"b":-1},"5":{"a":160000,"b":-1},"6":{"a":1150000,"b":-1},"7":{"a":6200000,"b":-1}},"/items/burble_gauntlets":{"0":{"a":62000,"b":58000},"1":{"a":90000,"b":2900},"2":{"a":160000,"b":2900},"3":{"a":300000,"b":2900},"4":{"a":-1,"b":2900},"5":{"a":500000,"b":-1},"6":{"a":700000,"b":2900}},"/items/burble_hammer":{"0":{"a":110000,"b":92000},"1":{"a":125000,"b":-1},"2":{"a":300000,"b":-1},"3":{"a":390000,"b":-1}},"/items/burble_hatchet":{"0":{"a":98000,"b":86000},"1":{"a":145000,"b":-1},"2":{"a":170000,"b":-1},"3":{"a":340000,"b":-1},"8":{"a":2500000,"b":-1},"20":{"a":-1,"b":340000}},"/items/burble_helmet":{"0":{"a":74000,"b":70000},"1":{"a":115000,"b":-1}},"/items/burble_mace":{"0":{"a":120000,"b":110000},"3":{"a":340000,"b":-1},"5":{"a":500000,"b":-1},"6":{"a":720000,"b":-1}},"/items/burble_milk":{"0":{"a":255,"b":240}},"/items/burble_needle":{"0":{"a":98000,"b":92000},"2":{"a":2450000,"b":-1},"3":{"a":390000,"b":-1}},"/items/burble_plate_body":{"0":{"a":110000,"b":105000},"1":{"a":110000,"b":-1},"3":{"a":300000,"b":-1},"5":{"a":940000,"b":-1}},"/items/burble_plate_legs":{"0":{"a":96000,"b":94000},"1":{"a":185000,"b":-1},"3":{"a":320000,"b":-1},"5":{"a":540000,"b":-1},"10":{"a":7600000,"b":-1}},"/items/burble_pot":{"0":{"a":105000,"b":84000},"1":{"a":100000,"b":-1},"2":{"a":240000,"b":-1},"3":{"a":380000,"b":-1}},"/items/burble_shears":{"0":{"a":96000,"b":90000},"1":{"a":330000,"b":-1},"2":{"a":490000,"b":-1},"3":{"a":380000,"b":-1},"4":{"a":760000,"b":-1},"5":{"a":-1,"b":640000}},"/items/burble_spatula":{"0":{"a":120000,"b":98000},"2":{"a":230000,"b":-1},"3":{"a":380000,"b":-1}},"/items/burble_spear":{"0":{"a":115000,"b":110000},"3":{"a":200000,"b":-1},"5":{"a":295000,"b":-1},"6":{"a":560000,"b":-1}},"/items/burble_sword":{"0":{"a":120000,"b":115000},"1":{"a":120000,"b":6600},"2":{"a":120000,"b":6600},"3":{"a":180000,"b":6600},"5":{"a":400000,"b":-1},"6":{"a":560000,"b":-1}},"/items/burble_tea_leaf":{"0":{"a":26,"b":24}},"/items/burning_key_fragment":{"0":{"a":2050000,"b":2000000}},"/items/butter_of_proficiency":{"0":{"a":13000000,"b":12500000}},"/items/catalyst_of_coinification":{"0":{"a":4200,"b":4100}},"/items/catalyst_of_decomposition":{"0":{"a":4600,"b":4500}},"/items/catalyst_of_transmutation":{"0":{"a":8200,"b":8000}},"/items/catalytic_tea":{"0":{"a":1650,"b":1600}},"/items/cedar_bow":{"0":{"a":66000,"b":52000},"3":{"a":500000,"b":-1},"5":{"a":3300000,"b":-1}},"/items/cedar_crossbow":{"0":{"a":72000,"b":52000},"2":{"a":80000,"b":-1},"3":{"a":98000,"b":-1},"5":{"a":350000,"b":-1},"7":{"a":4600000,"b":-1}},"/items/cedar_fire_staff":{"0":{"a":54000,"b":48000},"1":{"a":82000,"b":-1},"2":{"a":130000,"b":-1},"4":{"a":490000,"b":-1},"5":{"a":300000,"b":-1}},"/items/cedar_log":{"0":{"a":200,"b":190}},"/items/cedar_lumber":{"0":{"a":1050,"b":1000}},"/items/cedar_nature_staff":{"0":{"a":58000,"b":56000},"1":{"a":98000,"b":-1},"2":{"a":98000,"b":-1},"4":{"a":490000,"b":-1},"7":{"a":600000,"b":-1}},"/items/cedar_shield":{"0":{"a":40000,"b":31000},"1":{"a":50000,"b":-1},"2":{"a":145000,"b":-1},"3":{"a":56000,"b":-1},"4":{"a":520000,"b":-1}},"/items/cedar_water_staff":{"0":{"a":58000,"b":50000},"1":{"a":140000,"b":-1},"2":{"a":160000,"b":-1},"5":{"a":350000,"b":-1},"7":{"a":500000,"b":-1}},"/items/celestial_alembic":{"0":{"a":-1,"b":22000000},"6":{"a":-1,"b":7600000},"7":{"a":440000000,"b":410000000},"8":{"a":520000000,"b":470000000},"10":{"a":820000000,"b":800000000},"20":{"a":-1,"b":5000000}},"/items/celestial_brush":{"0":{"a":350000000,"b":230000000},"5":{"a":-1,"b":220000000},"6":{"a":-1,"b":225000000},"7":{"a":410000000,"b":380000000},"8":{"a":470000000,"b":420000000},"10":{"a":740000000,"b":700000000},"12":{"a":-1,"b":1200000000},"14":{"a":-1,"b":2500000000},"20":{"a":-1,"b":150000000}},"/items/celestial_chisel":{"0":{"a":-1,"b":115000000},"5":{"a":-1,"b":360000000},"7":{"a":420000000,"b":370000000},"8":{"a":490000000,"b":470000000},"10":{"a":740000000,"b":720000000}},"/items/celestial_enhancer":{"0":{"a":450000000,"b":400000000},"10":{"a":1000000000,"b":900000000},"11":{"a":1500000000,"b":-1},"12":{"a":2500000000,"b":-1},"13":{"a":4700000000,"b":-1},"14":{"a":9200000000,"b":21500000},"15":{"a":-1,"b":5000000000}},"/items/celestial_hammer":{"0":{"a":-1,"b":175000000},"1":{"a":-1,"b":25500000},"2":{"a":-1,"b":17500000},"5":{"a":-1,"b":240000000},"6":{"a":-1,"b":300000000},"7":{"a":430000000,"b":370000000},"8":{"a":490000000,"b":380000000},"10":{"a":760000000,"b":410000000}},"/items/celestial_hatchet":{"0":{"a":-1,"b":220000000},"5":{"a":-1,"b":255000000},"7":{"a":400000000,"b":390000000},"8":{"a":-1,"b":400000000},"9":{"a":620000000,"b":140000000},"10":{"a":740000000,"b":700000000}},"/items/celestial_needle":{"0":{"a":410000000,"b":70000000},"1":{"a":-1,"b":27500000},"5":{"a":-1,"b":200000000},"6":{"a":-1,"b":340000000},"7":{"a":400000000,"b":370000000},"8":{"a":470000000,"b":400000000},"10":{"a":720000000,"b":680000000},"20":{"a":-1,"b":5200000}},"/items/celestial_pot":{"0":{"a":-1,"b":5800000},"6":{"a":360000000,"b":300000000},"7":{"a":400000000,"b":350000000},"8":{"a":460000000,"b":430000000},"10":{"a":720000000,"b":660000000},"12":{"a":-1,"b":440000000}},"/items/celestial_shears":{"0":{"a":-1,"b":270000000},"1":{"a":-1,"b":15000000},"2":{"a":-1,"b":200000000},"3":{"a":390000000,"b":-1},"5":{"a":-1,"b":350000000},"7":{"a":410000000,"b":370000000},"8":{"a":460000000,"b":400000000},"10":{"a":740000000,"b":680000000},"11":{"a":1200000000,"b":580000000},"12":{"a":-1,"b":1300000000},"20":{"a":-1,"b":5000000}},"/items/celestial_spatula":{"0":{"a":-1,"b":140000000},"4":{"a":-1,"b":8200000},"5":{"a":-1,"b":340000000},"6":{"a":400000000,"b":360000000},"7":{"a":420000000,"b":380000000},"8":{"a":480000000,"b":400000000},"10":{"a":740000000,"b":720000000},"14":{"a":-1,"b":6200000000}},"/items/centaur_boots":{"0":{"a":900000,"b":860000},"1":{"a":-1,"b":700000},"2":{"a":900000,"b":700000},"5":{"a":1200000,"b":1150000},"6":{"a":1600000,"b":1500000},"7":{"a":2600000,"b":2500000},"8":{"a":8800000,"b":4000000},"9":{"a":8000000,"b":-1},"10":{"a":13500000,"b":13000000},"11":{"a":24000000,"b":14000000},"12":{"a":45000000,"b":42000000},"13":{"a":88000000,"b":80000000},"14":{"a":180000000,"b":170000000},"15":{"a":340000000,"b":-1},"16":{"a":900000000,"b":880000}},"/items/centaur_hoof":{"0":{"a":180000,"b":175000}},"/items/channeling_coffee":{"0":{"a":3100,"b":3000}},"/items/chaotic_chain":{"0":{"a":9800000,"b":9600000}},"/items/chaotic_flail":{"0":{"a":230000000,"b":220000000},"1":{"a":-1,"b":160000000},"2":{"a":-1,"b":165000000},"3":{"a":-1,"b":165000000},"4":{"a":-1,"b":160000000},"5":{"a":255000000,"b":225000000},"6":{"a":-1,"b":170000000},"7":{"a":265000000,"b":255000000},"8":{"a":310000000,"b":275000000},"9":{"a":-1,"b":300000000},"10":{"a":580000000,"b":540000000},"12":{"a":1650000000,"b":1550000000}},"/items/chaotic_flail_refined":{"0":{"a":-1,"b":5400000},"10":{"a":-1,"b":1100000000},"12":{"a":-1,"b":700000000},"14":{"a":-1,"b":6400000000}},"/items/cheese":{"0":{"a":440,"b":430}},"/items/cheese_alembic":{"0":{"a":5000,"b":4300},"1":{"a":9200,"b":-1},"2":{"a":90000000,"b":-1},"3":{"a":14000,"b":-1},"6":{"a":420000,"b":-1},"8":{"a":600000,"b":-1}},"/items/cheese_boots":{"0":{"a":3700,"b":3600},"1":{"a":1750000,"b":-1},"2":{"a":1500000,"b":-1},"4":{"a":380000,"b":-1},"10":{"a":4000000,"b":-1},"12":{"a":4500000,"b":-1},"13":{"a":10000000,"b":-1}},"/items/cheese_brush":{"0":{"a":4000,"b":3800},"1":{"a":5800,"b":-1},"2":{"a":5000,"b":-1},"3":{"a":6600,"b":-1},"4":{"a":8200,"b":-1},"5":{"a":8800,"b":-1},"6":{"a":130000,"b":-1},"10":{"a":2450000,"b":-1}},"/items/cheese_buckler":{"0":{"a":4300,"b":3800},"1":{"a":46000,"b":-1},"2":{"a":78000,"b":-1},"5":{"a":1000000,"b":-1},"7":{"a":280000,"b":-1},"8":{"a":2500000,"b":-1},"9":{"a":3000000,"b":-1}},"/items/cheese_bulwark":{"0":{"a":6400,"b":4800},"1":{"a":90000,"b":-1},"2":{"a":35000,"b":-1},"4":{"a":86000,"b":-1},"5":{"a":88000,"b":-1},"12":{"a":38000000,"b":-1}},"/items/cheese_chisel":{"0":{"a":5000,"b":4800},"5":{"a":220000,"b":-1}},"/items/cheese_enhancer":{"0":{"a":5200,"b":4800},"1":{"a":30000,"b":-1},"5":{"a":60000,"b":-1},"7":{"a":600000,"b":-1},"10":{"a":1500000,"b":-1}},"/items/cheese_gauntlets":{"0":{"a":3700,"b":3600},"1":{"a":25000,"b":-1},"2":{"a":49000,"b":-1},"4":{"a":52000,"b":-1},"5":{"a":64000,"b":-1},"6":{"a":100000,"b":-1},"9":{"a":16000000,"b":-1},"12":{"a":4000000,"b":-1},"13":{"a":8200000,"b":4800000}},"/items/cheese_hammer":{"0":{"a":5200,"b":4600},"1":{"a":5000,"b":-1},"2":{"a":14000,"b":-1}},"/items/cheese_hatchet":{"0":{"a":4600,"b":4100},"1":{"a":50000000,"b":-1},"2":{"a":7000,"b":-1},"10":{"a":4500000,"b":-1}},"/items/cheese_helmet":{"0":{"a":4600,"b":4300},"1":{"a":100000,"b":-1},"3":{"a":115000,"b":-1}},"/items/cheese_mace":{"0":{"a":5000,"b":4200},"1":{"a":4800000,"b":-1},"2":{"a":100000,"b":-1},"5":{"a":100000,"b":-1}},"/items/cheese_needle":{"0":{"a":5000,"b":4500},"1":{"a":245000,"b":-1},"5":{"a":700000,"b":-1}},"/items/cheese_plate_body":{"0":{"a":6600,"b":4800},"1":{"a":11000,"b":-1},"5":{"a":1000000,"b":-1},"10":{"a":6000000,"b":-1}},"/items/cheese_plate_legs":{"0":{"a":6000,"b":4900}},"/items/cheese_pot":{"0":{"a":4800,"b":4600},"1":{"a":30000,"b":-1},"5":{"a":110000,"b":-1}},"/items/cheese_shears":{"0":{"a":4900,"b":4100},"1":{"a":5600,"b":-1},"3":{"a":12000,"b":-1},"5":{"a":98000,"b":-1}},"/items/cheese_spatula":{"0":{"a":7200,"b":4500},"2":{"a":50000,"b":-1}},"/items/cheese_spear":{"0":{"a":5200,"b":5000},"1":{"a":5000,"b":-1},"3":{"a":200000,"b":-1}},"/items/cheese_sword":{"0":{"a":5200,"b":4800},"1":{"a":5000,"b":-1},"3":{"a":43000,"b":-1},"4":{"a":90000,"b":-1},"5":{"a":90000,"b":-1},"7":{"a":1000000,"b":-1},"8":{"a":3700000,"b":-1},"10":{"a":35000000,"b":-1},"12":{"a":9800000,"b":-1},"15":{"a":45000000,"b":-1}},"/items/cheesemakers_bottoms":{"0":{"a":-1,"b":145000000},"5":{"a":230000000,"b":-1},"7":{"a":255000000,"b":210000000},"8":{"a":295000000,"b":-1},"10":{"a":470000000,"b":400000000}},"/items/cheesemakers_top":{"0":{"a":-1,"b":80000000},"5":{"a":200000000,"b":105000000},"6":{"a":210000000,"b":130000000},"7":{"a":210000000,"b":-1},"8":{"a":250000000,"b":8400000},"10":{"a":430000000,"b":-1}},"/items/cheesesmithing_essence":{"0":{"a":340,"b":330}},"/items/cheesesmithing_tea":{"0":{"a":740,"b":640}},"/items/chefs_bottoms":{"0":{"a":-1,"b":140000000},"5":{"a":240000000,"b":190000000},"6":{"a":-1,"b":120000000},"7":{"a":245000000,"b":210000000},"8":{"a":285000000,"b":260000000},"10":{"a":460000000,"b":390000000}},"/items/chefs_top":{"0":{"a":-1,"b":30000000},"5":{"a":195000000,"b":-1},"6":{"a":100000000000,"b":3500000},"7":{"a":210000000,"b":-1},"8":{"a":250000000,"b":205000000},"10":{"a":420000000,"b":390000000}},"/items/chimerical_chest_key":{"0":{"a":2800000,"b":2750000}},"/items/chimerical_entry_key":{"0":{"a":380000,"b":360000}},"/items/chimerical_essence":{"0":{"a":840,"b":820}},"/items/chimerical_refinement_shard":{"0":{"a":2000000,"b":1850000}},"/items/chrono_gloves":{"0":{"a":6800000,"b":6400000},"3":{"a":-1,"b":3600000},"4":{"a":-1,"b":3700000},"5":{"a":8800000,"b":7600000},"6":{"a":9800000,"b":9400000},"7":{"a":15000000,"b":12000000},"8":{"a":20500000,"b":20000000},"9":{"a":-1,"b":27000000},"10":{"a":56000000,"b":54000000},"11":{"a":-1,"b":105000000},"12":{"a":210000000,"b":205000000},"13":{"a":440000000,"b":-1},"14":{"a":880000000,"b":800000000},"15":{"a":1750000000,"b":-1},"16":{"a":3400000000,"b":-1}},"/items/chrono_sphere":{"0":{"a":820000,"b":800000}},"/items/cleave":{"0":{"a":34000,"b":32000}},"/items/cocoon":{"0":{"a":320,"b":300}},"/items/collectors_boots":{"0":{"a":3800000,"b":3500000},"2":{"a":-1,"b":2950000},"3":{"a":4400000,"b":3400000},"4":{"a":-1,"b":3800000},"5":{"a":5400000,"b":4700000},"6":{"a":7200000,"b":200000},"7":{"a":9600000,"b":-1},"8":{"a":16000000,"b":9000000},"9":{"a":28000000,"b":-1},"10":{"a":39000000,"b":36000000},"12":{"a":125000000,"b":105000000},"13":{"a":-1,"b":205000000},"15":{"a":-1,"b":310000000},"20":{"a":-1,"b":440000000}},"/items/colossus_core":{"0":{"a":920000,"b":900000}},"/items/colossus_plate_body":{"0":{"a":9200000,"b":8400000},"1":{"a":-1,"b":8000000},"2":{"a":9000000,"b":8000000},"3":{"a":-1,"b":8000000},"5":{"a":9600000,"b":8200000},"6":{"a":12500000,"b":-1},"7":{"a":19500000,"b":17500000},"8":{"a":29500000,"b":-1},"9":{"a":38000000,"b":-1},"10":{"a":60000000,"b":41000000},"12":{"a":310000000,"b":10000000}},"/items/colossus_plate_legs":{"0":{"a":7400000,"b":6400000},"5":{"a":7600000,"b":6000000},"6":{"a":12000000,"b":-1},"7":{"a":18000000,"b":14500000},"8":{"a":30000000,"b":12000000},"10":{"a":52000000,"b":32000000},"12":{"a":-1,"b":10000000}},"/items/cooking_essence":{"0":{"a":290,"b":285}},"/items/cooking_tea":{"0":{"a":740,"b":620}},"/items/corsair_crest":{"0":{"a":8400000,"b":8200000}},"/items/corsair_helmet":{"0":{"a":96000000,"b":94000000},"3":{"a":130000000,"b":4300000},"5":{"a":105000000,"b":96000000},"6":{"a":110000000,"b":88000000},"7":{"a":120000000,"b":115000000},"8":{"a":160000000,"b":145000000},"9":{"a":220000000,"b":210000000},"10":{"a":370000000,"b":360000000},"11":{"a":640000000,"b":500000000},"12":{"a":1200000000,"b":1100000000}},"/items/corsair_helmet_refined":{"10":{"a":720000000,"b":680000000},"12":{"a":-1,"b":1500000000},"14":{"a":-1,"b":3500000}},"/items/cotton":{"0":{"a":70,"b":64}},"/items/cotton_boots":{"0":{"a":3600,"b":3500},"1":{"a":54000,"b":-1},"2":{"a":300000,"b":-1},"10":{"a":1400000,"b":-1},"11":{"a":4100000,"b":-1},"12":{"a":7600000,"b":-1},"20":{"a":-1,"b":64}},"/items/cotton_fabric":{"0":{"a":420,"b":410}},"/items/cotton_gloves":{"0":{"a":3900,"b":2200},"12":{"a":-1,"b":2700000},"20":{"a":-1,"b":3800}},"/items/cotton_hat":{"0":{"a":3800,"b":3300},"3":{"a":480000,"b":-1},"20":{"a":-1,"b":80}},"/items/cotton_robe_bottoms":{"0":{"a":5000,"b":4700},"2":{"a":82000,"b":-1},"3":{"a":88000,"b":-1},"5":{"a":580000,"b":-1},"20":{"a":-1,"b":115}},"/items/cotton_robe_top":{"0":{"a":6200,"b":5400},"5":{"a":350000,"b":-1},"10":{"a":10000000,"b":-1},"20":{"a":-1,"b":130}},"/items/crab_pincer":{"0":{"a":9200,"b":8800}},"/items/crafters_bottoms":{"0":{"a":350000000,"b":26500000},"5":{"a":240000000,"b":205000000},"7":{"a":255000000,"b":235000000},"8":{"a":300000000,"b":265000000},"10":{"a":460000000,"b":410000000}},"/items/crafters_top":{"5":{"a":195000000,"b":170000000},"6":{"a":245000000,"b":8400000},"7":{"a":215000000,"b":200000000},"8":{"a":255000000,"b":200000000},"10":{"a":420000000,"b":360000000}},"/items/crafting_essence":{"0":{"a":330,"b":320}},"/items/crafting_tea":{"0":{"a":780,"b":640}},"/items/crimson_alembic":{"0":{"a":180000,"b":170000},"1":{"a":285000,"b":-1},"2":{"a":390000,"b":-1},"3":{"a":320000,"b":-1},"5":{"a":820000,"b":210000}},"/items/crimson_boots":{"0":{"a":115000,"b":98000},"1":{"a":140000,"b":-1},"2":{"a":150000,"b":-1},"3":{"a":170000,"b":-1},"5":{"a":350000,"b":-1},"6":{"a":620000,"b":-1},"8":{"a":3000000,"b":-1}},"/items/crimson_brush":{"0":{"a":140000,"b":125000},"2":{"a":260000,"b":-1},"3":{"a":450000,"b":-1},"4":{"a":1200000,"b":-1},"5":{"a":1650000,"b":700000},"8":{"a":5600000,"b":-1}},"/items/crimson_buckler":{"0":{"a":145000,"b":140000},"1":{"a":170000,"b":-1},"2":{"a":170000,"b":-1},"3":{"a":190000,"b":-1},"5":{"a":1550000,"b":-1}},"/items/crimson_bulwark":{"0":{"a":195000,"b":170000},"1":{"a":220000,"b":-1},"3":{"a":330000,"b":-1},"4":{"a":700000,"b":-1}},"/items/crimson_cheese":{"0":{"a":1250,"b":1200}},"/items/crimson_chisel":{"0":{"a":140000,"b":135000},"2":{"a":330000,"b":-1},"3":{"a":430000,"b":-1},"4":{"a":820000,"b":-1},"5":{"a":1900000,"b":270000},"6":{"a":-1,"b":205000}},"/items/crimson_enhancer":{"0":{"a":175000,"b":160000},"1":{"a":180000,"b":-1},"2":{"a":220000,"b":-1},"3":{"a":275000,"b":-1},"4":{"a":620000,"b":-1},"5":{"a":880000,"b":295000},"6":{"a":2800000,"b":680000},"7":{"a":5800000,"b":-1},"10":{"a":6800000,"b":-1}},"/items/crimson_gauntlets":{"0":{"a":100000,"b":96000},"2":{"a":330000,"b":-1},"3":{"a":340000,"b":-1},"4":{"a":500000,"b":-1},"5":{"a":500000,"b":-1}},"/items/crimson_hammer":{"0":{"a":210000,"b":145000},"1":{"a":300000,"b":-1},"2":{"a":350000,"b":-1},"3":{"a":430000,"b":-1},"4":{"a":10000000,"b":-1},"5":{"a":1550000,"b":300000},"6":{"a":-1,"b":420000}},"/items/crimson_hatchet":{"0":{"a":160000,"b":135000},"1":{"a":185000,"b":-1},"3":{"a":4000000,"b":-1},"5":{"a":9000000,"b":700000},"6":{"a":11000000,"b":-1},"10":{"a":52000000,"b":-1}},"/items/crimson_helmet":{"0":{"a":130000,"b":120000},"2":{"a":185000,"b":-1},"3":{"a":330000,"b":-1},"5":{"a":1900000,"b":-1},"8":{"a":60000000,"b":-1}},"/items/crimson_mace":{"0":{"a":200000,"b":195000},"3":{"a":350000,"b":-1}},"/items/crimson_milk":{"0":{"a":350,"b":340}},"/items/crimson_needle":{"0":{"a":175000,"b":140000},"1":{"a":270000,"b":-1},"2":{"a":420000,"b":-1},"3":{"a":600000,"b":-1},"4":{"a":820000,"b":-1},"5":{"a":1050000,"b":-1},"10":{"a":-1,"b":1300000}},"/items/crimson_plate_body":{"0":{"a":190000,"b":185000},"1":{"a":290000,"b":-1},"4":{"a":350000,"b":-1},"5":{"a":400000,"b":100000}},"/items/crimson_plate_legs":{"0":{"a":175000,"b":170000}},"/items/crimson_pot":{"0":{"a":150000,"b":145000},"1":{"a":180000,"b":-1},"2":{"a":230000,"b":-1},"3":{"a":420000,"b":-1},"5":{"a":-1,"b":260000}},"/items/crimson_shears":{"0":{"a":160000,"b":150000},"1":{"a":320000,"b":-1},"2":{"a":-1,"b":11000},"3":{"a":700000,"b":11000},"5":{"a":2600000,"b":235000},"6":{"a":-1,"b":540000}},"/items/crimson_spatula":{"0":{"a":170000,"b":135000},"1":{"a":4500000,"b":-1},"5":{"a":1400000,"b":285000}},"/items/crimson_spear":{"0":{"a":200000,"b":195000},"1":{"a":245000,"b":-1},"2":{"a":400000,"b":-1},"3":{"a":880000,"b":760000},"6":{"a":1000000,"b":-1}},"/items/crimson_sword":{"0":{"a":215000,"b":200000},"1":{"a":220000,"b":-1},"2":{"a":230000,"b":14000},"3":{"a":350000,"b":-1},"4":{"a":860000,"b":-1},"5":{"a":1000000,"b":-1},"8":{"a":6600000,"b":-1}},"/items/crippling_slash":{"0":{"a":48000,"b":47000}},"/items/critical_aura":{"0":{"a":2000000,"b":1950000}},"/items/critical_coffee":{"0":{"a":3700,"b":3600}},"/items/crushed_amber":{"0":{"a":1350,"b":1300}},"/items/crushed_amethyst":{"0":{"a":2150,"b":2100}},"/items/crushed_garnet":{"0":{"a":2150,"b":2100}},"/items/crushed_jade":{"0":{"a":2150,"b":2100}},"/items/crushed_moonstone":{"0":{"a":3100,"b":3000}},"/items/crushed_pearl":{"0":{"a":860,"b":840}},"/items/crushed_philosophers_stone":{"0":{"a":2100000,"b":2050000}},"/items/crushed_sunstone":{"0":{"a":7600,"b":7400}},"/items/cupcake":{"0":{"a":200,"b":155}},"/items/cursed_ball":{"0":{"a":7600000,"b":7400000}},"/items/cursed_bow":{"0":{"a":185000000,"b":175000000},"1":{"a":-1,"b":160000000},"2":{"a":-1,"b":165000000},"3":{"a":-1,"b":165000000},"4":{"a":-1,"b":160000000},"5":{"a":-1,"b":170000000},"6":{"a":205000000,"b":170000000},"7":{"a":230000000,"b":195000000},"8":{"a":340000000,"b":205000000},"9":{"a":-1,"b":255000000},"10":{"a":540000000,"b":420000000},"12":{"a":1550000000,"b":1100000000}},"/items/cursed_bow_refined":{"0":{"a":-1,"b":40000000},"10":{"a":1250000000,"b":6000000}},"/items/dairyhands_bottoms":{"0":{"a":-1,"b":100000000},"1":{"a":-1,"b":60000000},"3":{"a":-1,"b":4100000},"5":{"a":230000000,"b":200000000},"7":{"a":245000000,"b":205000000},"8":{"a":285000000,"b":245000000},"10":{"a":450000000,"b":400000000},"12":{"a":-1,"b":700000000}},"/items/dairyhands_top":{"0":{"a":-1,"b":130000000},"5":{"a":190000000,"b":155000000},"6":{"a":195000000,"b":125000000},"7":{"a":205000000,"b":190000000},"8":{"a":240000000,"b":200000000},"10":{"a":410000000,"b":380000000}},"/items/damaged_anchor":{"0":{"a":8000000,"b":7800000}},"/items/dark_key_fragment":{"0":{"a":1750000,"b":1700000}},"/items/defense_coffee":{"0":{"a":880,"b":840}},"/items/demonic_core":{"0":{"a":920000,"b":900000}},"/items/demonic_plate_body":{"0":{"a":8800000,"b":7800000},"3":{"a":9600000,"b":4000000},"4":{"a":-1,"b":4200000},"5":{"a":12000000,"b":8600000},"6":{"a":14500000,"b":9400000},"7":{"a":20000000,"b":16500000},"8":{"a":-1,"b":20000000},"10":{"a":-1,"b":72000000}},"/items/demonic_plate_legs":{"0":{"a":6800000,"b":6000000},"4":{"a":-1,"b":4000000},"5":{"a":5800000,"b":4900000},"6":{"a":10000000,"b":5200000},"7":{"a":16000000,"b":14000000},"8":{"a":25500000,"b":15500000},"10":{"a":80000000,"b":64000000},"13":{"a":250000000,"b":-1}},"/items/dodocamel_gauntlets":{"0":{"a":50000000,"b":46000000},"4":{"a":-1,"b":8200000},"5":{"a":52000000,"b":48000000},"6":{"a":60000000,"b":-1},"7":{"a":-1,"b":60000000},"8":{"a":90000000,"b":84000000},"9":{"a":-1,"b":100000000},"10":{"a":240000000,"b":235000000},"12":{"a":920000000,"b":880000000}},"/items/dodocamel_gauntlets_refined":{"10":{"a":430000000,"b":410000000},"12":{"a":1150000000,"b":1100000000},"14":{"a":-1,"b":3000000}},"/items/dodocamel_plume":{"0":{"a":7000000,"b":6800000}},"/items/donut":{"0":{"a":165,"b":145}},"/items/dragon_fruit":{"0":{"a":390,"b":380}},"/items/dragon_fruit_gummy":{"0":{"a":1050,"b":1000}},"/items/dragon_fruit_yogurt":{"0":{"a":1400,"b":1350}},"/items/earrings_of_armor":{"0":{"a":6600000,"b":6400000},"1":{"a":9000000,"b":-1},"2":{"a":10500000,"b":-1},"3":{"a":11000000,"b":-1},"4":{"a":29000000,"b":-1},"6":{"a":120000000,"b":-1}},"/items/earrings_of_critical_strike":{"0":{"a":10000000,"b":8200000},"1":{"a":-1,"b":7800000},"2":{"a":-1,"b":10000000},"3":{"a":20500000,"b":18000000},"4":{"a":40000000,"b":31000000},"5":{"a":74000000,"b":72000000},"6":{"a":-1,"b":76000000}},"/items/earrings_of_essence_find":{"0":{"a":6600000,"b":6400000},"7":{"a":175000000,"b":-1}},"/items/earrings_of_gathering":{"0":{"a":7000000,"b":6600000},"2":{"a":14500000,"b":-1},"3":{"a":20000000,"b":-1},"5":{"a":-1,"b":58000000},"10":{"a":-1,"b":400000000}},"/items/earrings_of_rare_find":{"0":{"a":7600000,"b":7000000},"1":{"a":9600000,"b":-1},"2":{"a":-1,"b":9000000},"3":{"a":20500000,"b":18000000},"4":{"a":34000000,"b":32000000},"5":{"a":66000000,"b":64000000},"6":{"a":140000000,"b":-1},"10":{"a":-1,"b":90000000}},"/items/earrings_of_regeneration":{"0":{"a":6600000,"b":6000000},"1":{"a":7200000,"b":6000000},"2":{"a":10000000,"b":7600000},"3":{"a":16000000,"b":14000000},"4":{"a":30000000,"b":26500000},"5":{"a":60000000,"b":54000000},"6":{"a":110000000,"b":70000000},"7":{"a":175000000,"b":165000000},"8":{"a":390000000,"b":-1}},"/items/earrings_of_resistance":{"0":{"a":6800000,"b":6600000},"2":{"a":9800000,"b":-1},"3":{"a":9800000,"b":-1},"4":{"a":21500000,"b":-1},"5":{"a":47000000,"b":-1}},"/items/efficiency_tea":{"0":{"a":1500,"b":1450}},"/items/egg":{"0":{"a":58,"b":56}},"/items/elemental_affinity":{"0":{"a":180000,"b":175000}},"/items/elusiveness":{"0":{"a":68000,"b":66000}},"/items/emp_tea_leaf":{"0":{"a":105,"b":100}},"/items/enchanted_chest_key":{"0":{"a":5200000,"b":5000000}},"/items/enchanted_entry_key":{"0":{"a":640000,"b":620000}},"/items/enchanted_essence":{"0":{"a":1650,"b":1600}},"/items/enchanted_gloves":{"0":{"a":8600000,"b":8000000},"2":{"a":-1,"b":3600000},"5":{"a":9800000,"b":8400000},"6":{"a":12500000,"b":8000000},"7":{"a":18500000,"b":12000000},"8":{"a":27000000,"b":19500000},"9":{"a":-1,"b":10500000},"10":{"a":72000000,"b":64000000},"12":{"a":245000000,"b":210000000}},"/items/enchanted_refinement_shard":{"0":{"a":3600000,"b":3500000}},"/items/enhancers_bottoms":{"0":{"a":-1,"b":25000000},"5":{"a":350000000,"b":25000000},"7":{"a":340000000,"b":265000000},"8":{"a":400000000,"b":280000000},"10":{"a":580000000,"b":560000000}},"/items/enhancers_top":{"5":{"a":340000000,"b":200000000},"6":{"a":265000000,"b":-1},"7":{"a":295000000,"b":205000000},"8":{"a":330000000,"b":250000000},"10":{"a":520000000,"b":500000000},"12":{"a":-1,"b":1400000000}},"/items/enhancing_essence":{"0":{"a":880,"b":860}},"/items/enhancing_tea":{"0":{"a":1150,"b":1100}},"/items/entangle":{"0":{"a":23500,"b":23000}},"/items/excelsa_coffee_bean":{"0":{"a":820,"b":800}},"/items/expert_alchemy_charm":{"3":{"a":280000000,"b":-1},"5":{"a":340000000,"b":250000000}},"/items/expert_attack_charm":{"0":{"a":47000000,"b":43000000},"2":{"a":-1,"b":40000000},"3":{"a":80000000,"b":72000000},"4":{"a":135000000,"b":-1},"5":{"a":185000000,"b":170000000},"6":{"a":310000000,"b":-1}},"/items/expert_brewing_charm":{"0":{"a":105000000,"b":-1},"4":{"a":240000000,"b":-1},"5":{"a":240000000,"b":190000000}},"/items/expert_cheesesmithing_charm":{"0":{"a":245000000,"b":3000000},"5":{"a":295000000,"b":-1}},"/items/expert_cooking_charm":{"3":{"a":160000000,"b":-1},"5":{"a":285000000,"b":-1}},"/items/expert_crafting_charm":{"0":{"a":165000000,"b":42000000},"1":{"a":190000000,"b":-1},"3":{"a":240000000,"b":-1},"5":{"a":310000000,"b":-1}},"/items/expert_defense_charm":{"0":{"a":48000000,"b":31000000},"1":{"a":78000000,"b":-1},"2":{"a":-1,"b":54000000},"3":{"a":76000000,"b":68000000},"4":{"a":140000000,"b":100000000},"5":{"a":195000000,"b":175000000}},"/items/expert_enhancing_charm":{"0":{"a":390000000,"b":-1},"5":{"a":520000000,"b":-1}},"/items/expert_foraging_charm":{"0":{"a":165000000,"b":3300000},"3":{"a":220000000,"b":-1},"5":{"a":275000000,"b":265000000},"7":{"a":-1,"b":5600000}},"/items/expert_intelligence_charm":{"0":{"a":50000000,"b":31000000},"2":{"a":-1,"b":44000000},"3":{"a":-1,"b":68000000},"4":{"a":-1,"b":100000000},"5":{"a":-1,"b":170000000}},"/items/expert_magic_charm":{"0":{"a":76000000,"b":60000000},"1":{"a":84000000,"b":-1},"2":{"a":88000000,"b":-1},"3":{"a":98000000,"b":94000000},"4":{"a":-1,"b":140000000},"5":{"a":210000000,"b":200000000},"6":{"a":340000000,"b":285000000}},"/items/expert_melee_charm":{"0":{"a":48000000,"b":43000000},"3":{"a":78000000,"b":70000000},"5":{"a":185000000,"b":170000000}},"/items/expert_milking_charm":{"0":{"a":160000000,"b":-1},"1":{"a":160000000,"b":-1},"3":{"a":195000000,"b":-1},"5":{"a":275000000,"b":-1},"10":{"a":-1,"b":820000000}},"/items/expert_ranged_charm":{"0":{"a":46000000,"b":40000000},"1":{"a":66000000,"b":-1},"3":{"a":72000000,"b":68000000},"4":{"a":130000000,"b":100000000},"5":{"a":180000000,"b":170000000},"7":{"a":400000000,"b":-1}},"/items/expert_stamina_charm":{"0":{"a":-1,"b":66000000},"1":{"a":80000000,"b":-1},"2":{"a":96000000,"b":74000000},"3":{"a":120000000,"b":-1},"5":{"a":255000000,"b":205000000}},"/items/expert_tailoring_charm":{"0":{"a":-1,"b":52000000},"5":{"a":250000000,"b":-1}},"/items/expert_woodcutting_charm":{"0":{"a":125000000,"b":-1},"3":{"a":230000000,"b":10000000},"5":{"a":275000000,"b":-1}},"/items/eye_of_the_watcher":{"0":{"a":780000,"b":760000}},"/items/eye_watch":{"0":{"a":7400000,"b":7000000},"1":{"a":-1,"b":3100000},"2":{"a":9600000,"b":3100000},"3":{"a":9000000,"b":6000000},"4":{"a":9200000,"b":5800000},"5":{"a":9600000,"b":8800000},"6":{"a":12500000,"b":6000000},"7":{"a":16000000,"b":12500000},"8":{"a":27000000,"b":20000000},"9":{"a":46000000,"b":36000000},"10":{"a":70000000,"b":68000000},"12":{"a":-1,"b":3800000},"13":{"a":-1,"b":100000000}},"/items/eyessence":{"0":{"a":37,"b":36}},"/items/fierce_aura":{"0":{"a":2200000,"b":2150000}},"/items/fieriosa_coffee_bean":{"0":{"a":940,"b":920}},"/items/fighter_necklace":{"0":{"a":14000000,"b":11500000},"1":{"a":-1,"b":8000000},"2":{"a":-1,"b":14000000},"3":{"a":26500000,"b":20500000},"5":{"a":-1,"b":26000000}},"/items/fireball":{"0":{"a":6600,"b":6400}},"/items/firestorm":{"0":{"a":180000,"b":175000}},"/items/flame_arrow":{"0":{"a":33000,"b":32000}},"/items/flame_blast":{"0":{"a":33000,"b":32000}},"/items/flaming_cloth":{"0":{"a":62000,"b":58000}},"/items/flaming_robe_bottoms":{"0":{"a":210000,"b":200000},"2":{"a":260000,"b":-1},"3":{"a":200000,"b":-1},"5":{"a":270000,"b":-1},"6":{"a":800000,"b":-1},"7":{"a":1050000,"b":520000},"8":{"a":1900000,"b":-1},"9":{"a":2500000,"b":600000},"10":{"a":3000000,"b":2300000},"12":{"a":24000000,"b":-1}},"/items/flaming_robe_top":{"0":{"a":260000,"b":255000},"1":{"a":275000,"b":-1},"2":{"a":300000,"b":210000},"3":{"a":275000,"b":-1},"4":{"a":350000,"b":-1},"5":{"a":420000,"b":240000},"6":{"a":700000,"b":-1},"7":{"a":780000,"b":560000},"8":{"a":1750000,"b":580000},"9":{"a":3500000,"b":600000},"10":{"a":4600000,"b":3100000}},"/items/flax":{"0":{"a":84,"b":78}},"/items/fluffy_red_hat":{"0":{"a":5400000,"b":5200000},"5":{"a":5600000,"b":5200000},"6":{"a":6600000,"b":660000},"7":{"a":10000000,"b":8400000},"8":{"a":15500000,"b":11000000},"9":{"a":28000000,"b":15500000},"10":{"a":42000000,"b":40000000}},"/items/foragers_bottoms":{"0":{"a":-1,"b":200000000},"5":{"a":230000000,"b":210000000},"6":{"a":235000000,"b":-1},"7":{"a":250000000,"b":245000000},"8":{"a":290000000,"b":255000000},"10":{"a":450000000,"b":390000000},"11":{"a":-1,"b":260000000}},"/items/foragers_top":{"0":{"a":185000000,"b":100000000},"1":{"a":-1,"b":30000000},"5":{"a":190000000,"b":155000000},"6":{"a":210000000,"b":-1},"7":{"a":210000000,"b":190000000},"8":{"a":245000000,"b":220000000},"10":{"a":410000000,"b":380000000}},"/items/foraging_essence":{"0":{"a":290,"b":285}},"/items/foraging_tea":{"0":{"a":640,"b":620}},"/items/fracturing_impact":{"0":{"a":54000,"b":52000}},"/items/frenzy":{"0":{"a":360000,"b":350000}},"/items/frost_sphere":{"0":{"a":560000,"b":540000}},"/items/frost_staff":{"0":{"a":11000000,"b":10500000},"5":{"a":11000000,"b":10500000},"6":{"a":14000000,"b":-1},"7":{"a":14500000,"b":9400000},"8":{"a":16000000,"b":-1},"9":{"a":23500000,"b":14000000},"10":{"a":44000000,"b":30000000}},"/items/frost_surge":{"0":{"a":320000,"b":310000}},"/items/furious_spear":{"0":{"a":235000000,"b":230000000},"1":{"a":-1,"b":190000000},"2":{"a":-1,"b":185000000},"3":{"a":-1,"b":175000000},"4":{"a":-1,"b":180000000},"5":{"a":255000000,"b":225000000},"6":{"a":-1,"b":200000000},"7":{"a":295000000,"b":270000000},"8":{"a":-1,"b":310000000},"10":{"a":620000000,"b":580000000},"12":{"a":-1,"b":1550000000},"14":{"a":-1,"b":6600000}},"/items/furious_spear_refined":{"10":{"a":-1,"b":5600000},"15":{"a":-1,"b":5000000}},"/items/garnet":{"0":{"a":35000,"b":34000}},"/items/gathering_tea":{"0":{"a":680,"b":600}},"/items/gator_vest":{"0":{"a":18000,"b":17500},"1":{"a":27500,"b":16000},"2":{"a":26000,"b":16000},"3":{"a":32000,"b":16000},"4":{"a":47000,"b":16000},"5":{"a":34000,"b":32000},"6":{"a":76000,"b":56000},"7":{"a":135000,"b":105000},"8":{"a":310000,"b":250000},"9":{"a":900000,"b":500000},"10":{"a":1000000,"b":980000}},"/items/giant_pouch":{"0":{"a":6600000,"b":6400000},"1":{"a":7200000,"b":6400000},"2":{"a":7200000,"b":6400000},"3":{"a":7600000,"b":6400000},"4":{"a":9000000,"b":8200000},"5":{"a":11000000,"b":10000000},"6":{"a":20500000,"b":13500000},"7":{"a":-1,"b":14500000},"10":{"a":-1,"b":1100000}},"/items/ginkgo_bow":{"0":{"a":310000,"b":300000},"3":{"a":560000,"b":-1},"5":{"a":680000,"b":-1},"6":{"a":1550000,"b":-1}},"/items/ginkgo_crossbow":{"0":{"a":220000,"b":195000},"1":{"a":390000,"b":-1},"5":{"a":1400000,"b":-1},"6":{"a":430000000,"b":-1}},"/items/ginkgo_fire_staff":{"0":{"a":250000,"b":220000},"2":{"a":275000,"b":-1},"3":{"a":310000,"b":-1},"5":{"a":480000,"b":-1},"6":{"a":880000,"b":-1},"7":{"a":4100000,"b":-1}},"/items/ginkgo_log":{"0":{"a":230,"b":210}},"/items/ginkgo_lumber":{"0":{"a":1600,"b":1550}},"/items/ginkgo_nature_staff":{"0":{"a":300000,"b":225000},"3":{"a":440000,"b":-1}},"/items/ginkgo_shield":{"0":{"a":140000,"b":135000},"3":{"a":110000,"b":-1},"4":{"a":195000,"b":-1},"5":{"a":350000,"b":-1},"6":{"a":660000,"b":-1}},"/items/ginkgo_water_staff":{"0":{"a":340000,"b":220000},"4":{"a":4500000,"b":-1},"5":{"a":5000000,"b":-1}},"/items/gluttonous_energy":{"0":{"a":16500000,"b":14500000}},"/items/gluttonous_pouch":{"0":{"a":215000000,"b":20500000},"5":{"a":265000000,"b":245000000}},"/items/gobo_boomstick":{"0":{"a":80000,"b":78000},"1":{"a":88000,"b":-1},"2":{"a":98000,"b":-1},"5":{"a":110000,"b":28000},"6":{"a":225000,"b":-1},"7":{"a":520000,"b":-1},"8":{"a":1150000,"b":-1},"10":{"a":4500000,"b":-1}},"/items/gobo_boots":{"0":{"a":38000,"b":24000},"1":{"a":295000,"b":-1},"5":{"a":1100000,"b":-1}},"/items/gobo_bracers":{"0":{"a":43000,"b":37000},"2":{"a":460000,"b":-1},"3":{"a":470000,"b":-1},"5":{"a":330000,"b":-1}},"/items/gobo_chaps":{"0":{"a":64000,"b":60000},"1":{"a":100000,"b":-1},"2":{"a":110000,"b":-1},"3":{"a":225000,"b":-1},"5":{"a":1000000,"b":-1},"6":{"a":1200000,"b":-1}},"/items/gobo_defender":{"0":{"a":420000,"b":410000},"1":{"a":-1,"b":330000},"2":{"a":430000,"b":320000},"3":{"a":430000,"b":310000},"4":{"a":-1,"b":400000},"5":{"a":460000,"b":410000},"6":{"a":540000,"b":410000},"7":{"a":680000,"b":500000},"8":{"a":1100000,"b":900000},"10":{"a":3900000,"b":2550000},"13":{"a":-1,"b":6600000}},"/items/gobo_essence":{"0":{"a":90,"b":88}},"/items/gobo_hide":{"0":{"a":19,"b":17}},"/items/gobo_hood":{"0":{"a":45000,"b":38000},"1":{"a":100000,"b":-1},"2":{"a":290000,"b":-1},"3":{"a":250000,"b":-1},"4":{"a":300000,"b":-1}},"/items/gobo_leather":{"0":{"a":840,"b":800}},"/items/gobo_rag":{"0":{"a":360000,"b":350000}},"/items/gobo_shooter":{"0":{"a":80000,"b":78000},"1":{"a":82000,"b":-1},"2":{"a":96000,"b":-1},"3":{"a":96000,"b":-1},"5":{"a":92000,"b":28000},"6":{"a":145000,"b":-1},"7":{"a":340000,"b":-1},"8":{"a":660000,"b":-1},"10":{"a":3500000,"b":-1}},"/items/gobo_slasher":{"0":{"a":80000,"b":78000},"1":{"a":80000,"b":-1},"2":{"a":92000,"b":-1},"3":{"a":94000,"b":-1},"4":{"a":100000,"b":-1},"5":{"a":120000,"b":100000},"6":{"a":400000,"b":200000},"7":{"a":620000,"b":-1},"8":{"a":2000000,"b":1100000},"10":{"a":4500000,"b":4000000},"11":{"a":10000000,"b":5200000}},"/items/gobo_smasher":{"0":{"a":80000,"b":78000},"1":{"a":270000,"b":-1},"2":{"a":4100000,"b":-1},"3":{"a":100000,"b":-1},"5":{"a":125000,"b":28000},"6":{"a":900000,"b":-1},"7":{"a":1000000,"b":-1},"8":{"a":6600000,"b":-1},"10":{"a":6800000,"b":-1},"14":{"a":160000000,"b":-1}},"/items/gobo_stabber":{"0":{"a":80000,"b":78000},"1":{"a":84000,"b":-1},"2":{"a":100000,"b":-1},"3":{"a":98000,"b":-1},"4":{"a":490000,"b":-1},"5":{"a":100000,"b":-1},"6":{"a":220000,"b":-1},"7":{"a":500000,"b":-1},"8":{"a":1950000,"b":-1},"10":{"a":4900000,"b":-1},"12":{"a":20000000,"b":-1}},"/items/gobo_tunic":{"0":{"a":70000,"b":64000},"1":{"a":105000,"b":-1},"2":{"a":620000,"b":-1},"3":{"a":640000,"b":-1},"4":{"a":1250000,"b":-1},"5":{"a":600000,"b":-1}},"/items/goggles":{"0":{"a":520000,"b":500000}},"/items/golem_essence":{"0":{"a":260,"b":255}},"/items/gourmet_tea":{"0":{"a":720,"b":680}},"/items/grandmaster_alchemy_charm":{},"/items/grandmaster_attack_charm":{"5":{"a":-1,"b":700000000},"8":{"a":-1,"b":2500000000}},"/items/grandmaster_brewing_charm":{},"/items/grandmaster_cheesesmithing_charm":{},"/items/grandmaster_cooking_charm":{"0":{"a":-1,"b":62000000}},"/items/grandmaster_crafting_charm":{},"/items/grandmaster_defense_charm":{"5":{"a":960000000,"b":-1}},"/items/grandmaster_enhancing_charm":{},"/items/grandmaster_foraging_charm":{"0":{"a":-1,"b":14500000},"5":{"a":-1,"b":16000000},"7":{"a":-1,"b":10000000},"8":{"a":-1,"b":1900000000},"10":{"a":-1,"b":3000000000},"20":{"a":-1,"b":14500000}},"/items/grandmaster_intelligence_charm":{},"/items/grandmaster_magic_charm":{"0":{"a":1100000000,"b":-1},"7":{"a":2400000000,"b":-1},"10":{"a":-1,"b":6000000000}},"/items/grandmaster_melee_charm":{"0":{"a":-1,"b":160000000},"5":{"a":-1,"b":1000000000}},"/items/grandmaster_milking_charm":{},"/items/grandmaster_ranged_charm":{"0":{"a":-1,"b":240000000},"5":{"a":-1,"b":225000000},"20":{"a":-1,"b":40000000}},"/items/grandmaster_stamina_charm":{},"/items/grandmaster_tailoring_charm":{"0":{"a":-1,"b":11000000},"5":{"a":-1,"b":1000000000}},"/items/grandmaster_woodcutting_charm":{"0":{"a":-1,"b":10000000},"5":{"a":-1,"b":100000000}},"/items/granite_bludgeon":{"0":{"a":16500000,"b":9800000},"5":{"a":13000000,"b":-1},"6":{"a":15000000,"b":-1},"7":{"a":20000000,"b":12000000},"8":{"a":28000000,"b":18000000},"10":{"a":62000000,"b":49000000},"12":{"a":220000000,"b":21500000},"14":{"a":580000000,"b":560000}},"/items/green_key_fragment":{"0":{"a":580000,"b":560000}},"/items/green_tea_leaf":{"0":{"a":14,"b":13}},"/items/griffin_bulwark":{"0":{"a":185000000,"b":170000000},"5":{"a":-1,"b":180000000},"6":{"a":-1,"b":190000000},"7":{"a":250000000,"b":215000000},"8":{"a":-1,"b":245000000},"10":{"a":480000000,"b":470000000},"11":{"a":820000000,"b":6800000},"12":{"a":1300000000,"b":-1},"14":{"a":-1,"b":5000000000}},"/items/griffin_bulwark_refined":{"10":{"a":-1,"b":115000000},"12":{"a":1950000000,"b":5000000}},"/items/griffin_chaps":{"0":{"a":7600000,"b":7000000},"5":{"a":9800000,"b":8200000},"6":{"a":13000000,"b":-1},"7":{"a":13500000,"b":-1},"8":{"a":15000000,"b":-1},"10":{"a":38000000,"b":20000000},"12":{"a":120000000,"b":-1}},"/items/griffin_leather":{"0":{"a":1100000,"b":1050000}},"/items/griffin_talon":{"0":{"a":6600000,"b":6400000}},"/items/griffin_tunic":{"0":{"a":10500000,"b":10000000},"1":{"a":-1,"b":8400000},"2":{"a":-1,"b":8400000},"3":{"a":-1,"b":8400000},"5":{"a":12000000,"b":8200000},"6":{"a":14000000,"b":-1},"7":{"a":16000000,"b":-1},"8":{"a":24500000,"b":-1},"10":{"a":33000000,"b":-1},"12":{"a":120000000,"b":-1}},"/items/grizzly_bear_fluff":{"0":{"a":92000,"b":90000}},"/items/grizzly_bear_shoes":{"0":{"a":520000,"b":490000},"1":{"a":580000,"b":-1},"4":{"a":800000,"b":-1},"5":{"a":1200000,"b":800000},"6":{"a":2000000,"b":1200000},"7":{"a":2350000,"b":1900000},"8":{"a":4000000,"b":3300000},"10":{"a":11500000,"b":10500000},"11":{"a":-1,"b":12000000},"12":{"a":44000000,"b":35000000},"13":{"a":78000000,"b":-1},"14":{"a":150000000,"b":-1},"15":{"a":290000000,"b":270000000},"16":{"a":600000000,"b":-1}},"/items/guardian_aura":{"0":{"a":1100000,"b":1050000}},"/items/gummy":{"0":{"a":130,"b":115}},"/items/guzzling_energy":{"0":{"a":21500000,"b":21000000}},"/items/guzzling_pouch":{"0":{"a":270000000,"b":260000000},"1":{"a":-1,"b":16000000},"2":{"a":-1,"b":265000000},"3":{"a":-1,"b":265000000},"4":{"a":-1,"b":230000000},"5":{"a":290000000,"b":270000000},"6":{"a":320000000,"b":310000000},"7":{"a":380000000,"b":370000000},"8":{"a":520000000,"b":500000000},"9":{"a":-1,"b":660000000},"10":{"a":1050000000,"b":1000000000},"12":{"a":3000000000,"b":26500000}},"/items/heal":{"0":{"a":33000,"b":32000}},"/items/holy_alembic":{"0":{"a":520000,"b":500000},"1":{"a":540000,"b":210000},"2":{"a":760000,"b":220000},"3":{"a":800000,"b":265000},"4":{"a":1500000,"b":520000},"5":{"a":2000000,"b":1900000},"6":{"a":4800000,"b":-1},"7":{"a":8000000,"b":6600000},"8":{"a":17500000,"b":12000000},"10":{"a":47000000,"b":43000000},"12":{"a":165000000,"b":-1}},"/items/holy_boots":{"0":{"a":240000,"b":225000},"1":{"a":255000,"b":-1},"2":{"a":310000,"b":-1},"3":{"a":370000,"b":-1},"4":{"a":620000,"b":-1},"5":{"a":920000,"b":250000},"6":{"a":4800000,"b":480000}},"/items/holy_brush":{"0":{"a":520000,"b":500000},"1":{"a":520000,"b":100000},"2":{"a":700000,"b":100000},"3":{"a":1050000,"b":-1},"4":{"a":1350000,"b":-1},"5":{"a":2000000,"b":1950000},"6":{"a":4300000,"b":3000000},"7":{"a":7800000,"b":6600000},"8":{"a":15000000,"b":13000000},"9":{"a":27000000,"b":-1},"10":{"a":49000000,"b":42000000},"12":{"a":-1,"b":48000000}},"/items/holy_buckler":{"0":{"a":500000,"b":490000},"1":{"a":470000,"b":-1},"2":{"a":560000,"b":-1},"3":{"a":450000,"b":-1},"5":{"a":1100000,"b":200000},"6":{"a":3900000,"b":-1}},"/items/holy_bulwark":{"0":{"a":900000,"b":800000},"1":{"a":840000,"b":-1},"2":{"a":1000000,"b":-1},"3":{"a":1400000,"b":140000},"4":{"a":1900000,"b":190000},"5":{"a":1700000,"b":175000},"6":{"a":4800000,"b":480000}},"/items/holy_cheese":{"0":{"a":2200,"b":2150}},"/items/holy_chisel":{"0":{"a":520000,"b":500000},"1":{"a":500000,"b":235000},"2":{"a":800000,"b":245000},"3":{"a":1000000,"b":240000},"4":{"a":1250000,"b":-1},"5":{"a":2300000,"b":1800000},"6":{"a":4200000,"b":2900000},"7":{"a":8200000,"b":6000000},"8":{"a":14500000,"b":13000000},"9":{"a":27000000,"b":-1},"10":{"a":49000000,"b":47000000}},"/items/holy_enhancer":{"0":{"a":540000,"b":500000},"1":{"a":560000,"b":-1},"2":{"a":700000,"b":-1},"3":{"a":820000,"b":-1},"4":{"a":1200000,"b":-1},"5":{"a":1950000,"b":1900000},"6":{"a":3900000,"b":1900000},"7":{"a":7800000,"b":6800000},"8":{"a":16000000,"b":13500000},"9":{"a":29000000,"b":-1},"10":{"a":47000000,"b":45000000},"11":{"a":84000000,"b":43000000},"12":{"a":185000000,"b":165000000}},"/items/holy_gauntlets":{"0":{"a":300000,"b":200000},"1":{"a":560000,"b":-1},"2":{"a":560000,"b":-1},"3":{"a":460000,"b":-1},"4":{"a":880000,"b":-1},"5":{"a":1500000,"b":300000},"6":{"a":4400000,"b":2250000},"10":{"a":-1,"b":1000000}},"/items/holy_hammer":{"0":{"a":520000,"b":500000},"1":{"a":640000,"b":225000},"2":{"a":740000,"b":225000},"3":{"a":780000,"b":245000},"4":{"a":1400000,"b":255000},"5":{"a":2000000,"b":1900000},"6":{"a":4200000,"b":2000000},"7":{"a":8000000,"b":6600000},"8":{"a":15000000,"b":13000000},"9":{"a":27500000,"b":-1},"10":{"a":49000000,"b":46000000},"12":{"a":100000000,"b":-1}},"/items/holy_hatchet":{"0":{"a":520000,"b":500000},"1":{"a":540000,"b":200000},"2":{"a":760000,"b":265000},"3":{"a":860000,"b":340000},"5":{"a":1900000,"b":1850000},"6":{"a":4700000,"b":2850000},"7":{"a":7800000,"b":7200000},"8":{"a":15000000,"b":13500000},"9":{"a":-1,"b":20000000},"10":{"a":48000000,"b":47000000}},"/items/holy_helmet":{"0":{"a":430000,"b":420000},"2":{"a":430000,"b":-1},"3":{"a":470000,"b":-1},"4":{"a":600000,"b":-1},"5":{"a":540000,"b":-1},"6":{"a":4200000,"b":420000}},"/items/holy_mace":{"0":{"a":860000,"b":720000},"1":{"a":780000,"b":300000},"2":{"a":-1,"b":230000},"3":{"a":680000,"b":-1},"4":{"a":900000,"b":-1},"5":{"a":1250000,"b":-1},"6":{"a":2000000,"b":200000}},"/items/holy_milk":{"0":{"a":460,"b":450}},"/items/holy_needle":{"0":{"a":500000,"b":460000},"1":{"a":620000,"b":-1},"3":{"a":1050000,"b":720000},"4":{"a":1250000,"b":-1},"5":{"a":2000000,"b":1800000},"6":{"a":4200000,"b":-1},"7":{"a":7600000,"b":6000000},"8":{"a":14500000,"b":-1},"9":{"a":27500000,"b":22500000},"10":{"a":44000000,"b":40000000},"12":{"a":100000000,"b":-1}},"/items/holy_plate_body":{"0":{"a":660000,"b":640000},"1":{"a":840000,"b":-1},"2":{"a":800000,"b":-1},"3":{"a":820000,"b":320000},"4":{"a":860000,"b":-1},"5":{"a":1500000,"b":600000},"6":{"a":4500000,"b":450000}},"/items/holy_plate_legs":{"0":{"a":580000,"b":560000},"1":{"a":440000,"b":-1},"2":{"a":640000,"b":-1},"3":{"a":520000,"b":295000},"4":{"a":1000000,"b":180000},"5":{"a":1550000,"b":350000},"6":{"a":4700000,"b":470000}},"/items/holy_pot":{"0":{"a":520000,"b":490000},"1":{"a":580000,"b":-1},"3":{"a":940000,"b":280000},"4":{"a":1350000,"b":270000},"5":{"a":2000000,"b":1950000},"6":{"a":4500000,"b":3000000},"7":{"a":8200000,"b":6200000},"8":{"a":16500000,"b":13000000},"9":{"a":-1,"b":20000000},"10":{"a":48000000,"b":46000000},"11":{"a":96000000,"b":31000000}},"/items/holy_shears":{"0":{"a":540000,"b":520000},"1":{"a":560000,"b":230000},"2":{"a":880000,"b":230000},"3":{"a":1250000,"b":250000},"4":{"a":1450000,"b":-1},"5":{"a":2000000,"b":1950000},"6":{"a":4800000,"b":3000000},"7":{"a":7800000,"b":6800000},"8":{"a":15000000,"b":13500000},"9":{"a":27000000,"b":-1},"10":{"a":52000000,"b":48000000},"12":{"a":-1,"b":90000000}},"/items/holy_spatula":{"0":{"a":540000,"b":520000},"1":{"a":560000,"b":155000},"2":{"a":680000,"b":275000},"3":{"a":840000,"b":215000},"5":{"a":2000000,"b":1900000},"6":{"a":4400000,"b":3000000},"7":{"a":8400000,"b":7200000},"8":{"a":15000000,"b":13000000},"9":{"a":38000000,"b":62000},"10":{"a":47000000,"b":43000000}},"/items/holy_spear":{"0":{"a":720000,"b":700000},"1":{"a":700000,"b":-1},"2":{"a":760000,"b":-1},"3":{"a":740000,"b":330000},"4":{"a":1100000,"b":-1},"5":{"a":1450000,"b":920000},"6":{"a":5000000,"b":500000},"10":{"a":-1,"b":20000000}},"/items/holy_sword":{"0":{"a":540000,"b":460000},"1":{"a":560000,"b":-1},"2":{"a":980000,"b":440000},"3":{"a":700000,"b":-1},"4":{"a":1650000,"b":410000},"5":{"a":1450000,"b":560000},"6":{"a":4200000,"b":560000},"7":{"a":-1,"b":1000000},"10":{"a":-1,"b":700000}},"/items/ice_spear":{"0":{"a":33000,"b":32000}},"/items/icy_cloth":{"0":{"a":58000,"b":56000}},"/items/icy_robe_bottoms":{"0":{"a":210000,"b":190000},"1":{"a":200000,"b":110000},"2":{"a":-1,"b":110000},"4":{"a":350000,"b":-1},"5":{"a":460000,"b":-1},"6":{"a":490000,"b":-1},"7":{"a":920000,"b":100000},"8":{"a":1400000,"b":-1},"10":{"a":4000000,"b":1650000}},"/items/icy_robe_top":{"0":{"a":265000,"b":255000},"1":{"a":6400000,"b":100000},"3":{"a":300000,"b":100000},"4":{"a":350000,"b":-1},"5":{"a":380000,"b":295000},"6":{"a":740000,"b":330000},"7":{"a":1150000,"b":370000},"8":{"a":1900000,"b":-1},"10":{"a":5000000,"b":2300000}},"/items/impale":{"0":{"a":33000,"b":32000}},"/items/infernal_battlestaff":{"0":{"a":11000000,"b":10500000},"4":{"a":11500000,"b":-1},"5":{"a":11000000,"b":10500000},"6":{"a":12000000,"b":10000000},"7":{"a":13000000,"b":11500000},"8":{"a":17000000,"b":12000000},"10":{"a":39000000,"b":36000000},"12":{"a":170000000,"b":-1}},"/items/infernal_ember":{"0":{"a":540000,"b":520000}},"/items/insanity":{"0":{"a":840000,"b":820000}},"/items/intelligence_coffee":{"0":{"a":740,"b":700}},"/items/invincible":{"0":{"a":820000,"b":800000}},"/items/jackalope_antler":{"0":{"a":2100000,"b":2050000}},"/items/jackalope_staff":{"0":{"a":40000000,"b":34000000},"5":{"a":40000000,"b":34000000},"6":{"a":42000000,"b":35000000},"7":{"a":52000000,"b":44000000},"10":{"a":120000000,"b":88000000}},"/items/jade":{"0":{"a":35000,"b":34000}},"/items/jungle_essence":{"0":{"a":27,"b":26}},"/items/knights_aegis":{"0":{"a":98000000,"b":96000000},"1":{"a":-1,"b":80000000},"3":{"a":-1,"b":80000000},"5":{"a":100000000,"b":96000000},"6":{"a":-1,"b":90000000},"7":{"a":125000000,"b":120000000},"8":{"a":155000000,"b":135000000},"9":{"a":-1,"b":155000000},"10":{"a":360000000,"b":340000000},"11":{"a":-1,"b":400000000},"12":{"a":1250000000,"b":10000000},"20":{"a":-1,"b":6000000}},"/items/knights_aegis_refined":{"10":{"a":680000000,"b":70000000},"14":{"a":-1,"b":4000000}},"/items/knights_ingot":{"0":{"a":7800000,"b":7600000}},"/items/kraken_chaps":{"0":{"a":78000000,"b":74000000},"1":{"a":-1,"b":68000000},"2":{"a":140000000,"b":70000000},"3":{"a":-1,"b":68000000},"4":{"a":-1,"b":66000000},"5":{"a":82000000,"b":68000000},"7":{"a":110000000,"b":100000000},"8":{"a":150000000,"b":125000000},"9":{"a":-1,"b":140000000},"10":{"a":370000000,"b":360000000},"11":{"a":-1,"b":420000000},"12":{"a":-1,"b":1150000000}},"/items/kraken_chaps_refined":{"10":{"a":-1,"b":500000000},"12":{"a":-1,"b":1600000000},"15":{"a":-1,"b":500000000}},"/items/kraken_fang":{"0":{"a":11000000,"b":10500000}},"/items/kraken_leather":{"0":{"a":8400000,"b":8200000}},"/items/kraken_tunic":{"0":{"a":98000000,"b":94000000},"1":{"a":-1,"b":76000000},"2":{"a":165000000,"b":84000000},"3":{"a":-1,"b":84000000},"4":{"a":-1,"b":84000000},"5":{"a":98000000,"b":88000000},"6":{"a":110000000,"b":92000000},"7":{"a":125000000,"b":115000000},"8":{"a":170000000,"b":150000000},"9":{"a":300000000,"b":175000000},"10":{"a":400000000,"b":390000000},"11":{"a":680000000,"b":560000000},"12":{"a":1350000000,"b":1300000000}},"/items/kraken_tunic_refined":{"10":{"a":720000000,"b":660000000},"12":{"a":-1,"b":4500000},"15":{"a":-1,"b":5200000}},"/items/large_pouch":{"0":{"a":780000,"b":740000},"1":{"a":1000000,"b":-1},"2":{"a":1300000,"b":540000},"3":{"a":1400000,"b":-1},"4":{"a":1650000,"b":-1},"5":{"a":2750000,"b":1450000}},"/items/liberica_coffee_bean":{"0":{"a":640,"b":620}},"/items/life_drain":{"0":{"a":52000,"b":49000}},"/items/linen_boots":{"0":{"a":16500,"b":10500},"3":{"a":88000,"b":-1}},"/items/linen_fabric":{"0":{"a":640,"b":620}},"/items/linen_gloves":{"0":{"a":17500,"b":13000},"1":{"a":94000,"b":-1},"2":{"a":110000,"b":-1},"5":{"a":440000,"b":-1}},"/items/linen_hat":{"0":{"a":18500,"b":16500},"1":{"a":86000,"b":-1},"2":{"a":1600000,"b":-1},"5":{"a":350000,"b":-1}},"/items/linen_robe_bottoms":{"0":{"a":24000,"b":22000},"6":{"a":7200000,"b":-1}},"/items/linen_robe_top":{"0":{"a":28000,"b":23000},"2":{"a":115000,"b":-1},"3":{"a":1300000,"b":-1},"5":{"a":700000,"b":-1},"10":{"a":-1,"b":1000000}},"/items/living_granite":{"0":{"a":580000,"b":560000}},"/items/log":{"0":{"a":28,"b":26}},"/items/lucky_coffee":{"0":{"a":2500,"b":2450}},"/items/lumber":{"0":{"a":320,"b":300}},"/items/lumberjacks_bottoms":{"0":{"a":235000000,"b":-1},"5":{"a":230000000,"b":190000000},"7":{"a":240000000,"b":200000000},"8":{"a":270000000,"b":240000000},"10":{"a":450000000,"b":400000000}},"/items/lumberjacks_top":{"5":{"a":190000000,"b":180000000},"6":{"a":195000000,"b":-1},"7":{"a":200000000,"b":175000000},"8":{"a":240000000,"b":-1},"10":{"a":410000000,"b":370000000}},"/items/luna_robe_bottoms":{"0":{"a":2200000,"b":1900000},"1":{"a":2150000,"b":-1},"2":{"a":2200000,"b":-1},"4":{"a":3100000,"b":-1},"5":{"a":3600000,"b":2600000},"6":{"a":4000000,"b":-1},"7":{"a":6200000,"b":5000000},"8":{"a":10500000,"b":8000000},"9":{"a":19500000,"b":11500000},"10":{"a":27000000,"b":26000000},"12":{"a":98000000,"b":-1}},"/items/luna_robe_top":{"0":{"a":2600000,"b":2300000},"2":{"a":3000000,"b":-1},"3":{"a":2950000,"b":-1},"4":{"a":3400000,"b":-1},"5":{"a":4900000,"b":3400000},"6":{"a":5400000,"b":-1},"7":{"a":7000000,"b":-1},"8":{"a":11000000,"b":7800000},"9":{"a":18000000,"b":520000},"10":{"a":29000000,"b":28500000},"11":{"a":-1,"b":43000000},"12":{"a":105000000,"b":86000000}},"/items/luna_wing":{"0":{"a":285000,"b":280000}},"/items/maelstrom_plate_body":{"0":{"a":105000000,"b":98000000},"1":{"a":-1,"b":86000000},"2":{"a":-1,"b":86000000},"3":{"a":-1,"b":86000000},"4":{"a":-1,"b":88000000},"5":{"a":125000000,"b":100000000},"6":{"a":-1,"b":86000000},"7":{"a":125000000,"b":120000000},"8":{"a":175000000,"b":145000000},"9":{"a":-1,"b":180000000},"10":{"a":420000000,"b":400000000},"12":{"a":1350000000,"b":1200000000}},"/items/maelstrom_plate_body_refined":{"1":{"a":-1,"b":4800000},"10":{"a":780000000,"b":700000000},"12":{"a":-1,"b":1250000000},"14":{"a":-1,"b":4500000}},"/items/maelstrom_plate_legs":{"0":{"a":84000000,"b":76000000},"1":{"a":-1,"b":72000000},"2":{"a":-1,"b":72000000},"3":{"a":-1,"b":72000000},"4":{"a":-1,"b":70000000},"5":{"a":92000000,"b":78000000},"6":{"a":98000000,"b":74000000},"7":{"a":110000000,"b":105000000},"8":{"a":150000000,"b":130000000},"9":{"a":-1,"b":170000000},"10":{"a":380000000,"b":370000000},"12":{"a":1200000000,"b":1100000000},"13":{"a":2400000000,"b":-1}},"/items/maelstrom_plate_legs_refined":{"10":{"a":760000000,"b":700000000},"12":{"a":-1,"b":4000000},"14":{"a":-1,"b":4000000}},"/items/maelstrom_plating":{"0":{"a":8400000,"b":8200000}},"/items/magic_coffee":{"0":{"a":1200,"b":1150}},"/items/magicians_cloth":{"0":{"a":6800000,"b":6600000}},"/items/magicians_hat":{"0":{"a":74000000,"b":72000000},"1":{"a":-1,"b":58000000},"2":{"a":-1,"b":58000000},"3":{"a":-1,"b":56000000},"4":{"a":-1,"b":58000000},"5":{"a":76000000,"b":64000000},"6":{"a":-1,"b":68000000},"7":{"a":90000000,"b":86000000},"8":{"a":120000000,"b":100000000},"9":{"a":190000000,"b":170000000},"10":{"a":300000000,"b":295000000},"11":{"a":-1,"b":480000000},"12":{"a":1100000000,"b":880000000},"14":{"a":4200000000,"b":3500000}},"/items/magicians_hat_refined":{"10":{"a":600000000,"b":560000000},"12":{"a":1350000000,"b":1250000000}},"/items/magnet":{"0":{"a":270000,"b":265000}},"/items/magnetic_gloves":{"0":{"a":2600000,"b":2200000},"1":{"a":2900000,"b":-1},"3":{"a":-1,"b":1050000},"5":{"a":3100000,"b":2800000},"6":{"a":4500000,"b":-1},"7":{"a":7000000,"b":6200000},"8":{"a":13500000,"b":8400000},"9":{"a":20500000,"b":-1},"10":{"a":32000000,"b":27500000},"12":{"a":115000000,"b":-1}},"/items/magnifying_glass":{"0":{"a":1800000,"b":1750000}},"/items/maim":{"0":{"a":96000,"b":94000}},"/items/mana_spring":{"0":{"a":74000,"b":72000}},"/items/manticore_shield":{"0":{"a":21000000,"b":20500000},"2":{"a":-1,"b":11000000},"3":{"a":-1,"b":10500000},"5":{"a":23000000,"b":21000000},"6":{"a":27500000,"b":20000000},"7":{"a":31000000,"b":29500000},"8":{"a":58000000,"b":30000000},"9":{"a":88000000,"b":50000000},"10":{"a":130000000,"b":120000000},"12":{"a":440000000,"b":410000000}},"/items/manticore_sting":{"0":{"a":2300000,"b":2250000}},"/items/marine_chaps":{"0":{"a":440000,"b":400000},"2":{"a":680000,"b":-1},"8":{"a":2000000,"b":200000}},"/items/marine_scale":{"0":{"a":64000,"b":62000}},"/items/marine_tunic":{"0":{"a":520000,"b":500000},"3":{"a":620000,"b":-1},"4":{"a":760000,"b":-1}},"/items/marksman_bracers":{"0":{"a":98000000,"b":94000000},"5":{"a":100000000,"b":82000000},"6":{"a":-1,"b":94000000},"7":{"a":115000000,"b":110000000},"8":{"a":150000000,"b":130000000},"9":{"a":-1,"b":160000000},"10":{"a":320000000,"b":310000000},"12":{"a":-1,"b":1000000000}},"/items/marksman_bracers_refined":{"10":{"a":680000000,"b":640000000},"11":{"a":-1,"b":3100000},"12":{"a":-1,"b":1250000000},"15":{"a":-1,"b":5200000}},"/items/marksman_brooch":{"0":{"a":8400000,"b":8200000}},"/items/marsberry":{"0":{"a":135,"b":125}},"/items/marsberry_cake":{"0":{"a":1350,"b":1300}},"/items/marsberry_donut":{"0":{"a":1000,"b":980}},"/items/master_alchemy_charm":{"5":{"a":-1,"b":1000000000}},"/items/master_attack_charm":{"0":{"a":255000000,"b":165000000},"5":{"a":450000000,"b":420000000},"6":{"a":-1,"b":86000000}},"/items/master_brewing_charm":{},"/items/master_cheesesmithing_charm":{"0":{"a":1000000000,"b":-1}},"/items/master_cooking_charm":{},"/items/master_crafting_charm":{"0":{"a":-1,"b":105000000}},"/items/master_defense_charm":{"5":{"a":450000000,"b":-1}},"/items/master_enhancing_charm":{"0":{"a":1700000000,"b":-1}},"/items/master_foraging_charm":{"5":{"a":-1,"b":460000000},"6":{"a":-1,"b":520000000},"7":{"a":-1,"b":6000000}},"/items/master_intelligence_charm":{"5":{"a":580000000,"b":-1}},"/items/master_magic_charm":{"5":{"a":580000000,"b":390000000},"6":{"a":740000000,"b":560000000}},"/items/master_melee_charm":{"0":{"a":-1,"b":130000000},"5":{"a":450000000,"b":400000000}},"/items/master_milking_charm":{"0":{"a":-1,"b":155000000},"10":{"a":-1,"b":2000000000}},"/items/master_ranged_charm":{"0":{"a":290000000,"b":165000000},"1":{"a":320000000,"b":-1},"5":{"a":430000000,"b":400000000}},"/items/master_stamina_charm":{"5":{"a":600000000,"b":400000000}},"/items/master_tailoring_charm":{"0":{"a":-1,"b":12000000}},"/items/master_woodcutting_charm":{"0":{"a":-1,"b":6200000},"1":{"a":-1,"b":10000000}},"/items/medium_pouch":{"0":{"a":155000,"b":140000},"2":{"a":340000,"b":-1},"3":{"a":580000,"b":-1}},"/items/melee_coffee":{"0":{"a":1150,"b":1100}},"/items/milk":{"0":{"a":96,"b":92}},"/items/milking_essence":{"0":{"a":265,"b":260}},"/items/milking_tea":{"0":{"a":540,"b":440}},"/items/minor_heal":{"0":{"a":2900,"b":2750}},"/items/mirror_of_protection":{"0":{"a":11000000,"b":10500000}},"/items/mooberry":{"0":{"a":180,"b":175}},"/items/mooberry_cake":{"0":{"a":1350,"b":1200}},"/items/mooberry_donut":{"0":{"a":880,"b":860}},"/items/moolong_tea_leaf":{"0":{"a":34,"b":32}},"/items/moonstone":{"0":{"a":52000,"b":50000}},"/items/mystic_aura":{"0":{"a":900000,"b":880000}},"/items/natures_veil":{"0":{"a":540000,"b":520000}},"/items/necklace_of_efficiency":{"0":{"a":12000000,"b":11000000},"1":{"a":20000000,"b":-1},"3":{"a":-1,"b":21000000},"6":{"a":-1,"b":100000000}},"/items/necklace_of_speed":{"0":{"a":14500000,"b":13500000},"1":{"a":17000000,"b":13500000},"2":{"a":23000000,"b":17500000},"3":{"a":33000000,"b":31000000},"4":{"a":64000000,"b":52000000},"5":{"a":115000000,"b":110000000},"6":{"a":200000000,"b":150000000},"7":{"a":-1,"b":175000000}},"/items/necklace_of_wisdom":{"0":{"a":11000000,"b":10000000},"1":{"a":14000000,"b":10000000},"2":{"a":19000000,"b":14000000},"3":{"a":31000000,"b":27500000},"4":{"a":58000000,"b":50000000},"5":{"a":105000000,"b":98000000},"6":{"a":-1,"b":92000000},"7":{"a":-1,"b":170000000},"9":{"a":540000000,"b":300000000},"10":{"a":-1,"b":340000000}},"/items/orange":{"0":{"a":18,"b":17}},"/items/orange_gummy":{"0":{"a":86,"b":82}},"/items/orange_key_fragment":{"0":{"a":1050000,"b":1000000}},"/items/orange_yogurt":{"0":{"a":560,"b":540}},"/items/panda_fluff":{"0":{"a":62000,"b":60000}},"/items/panda_gloves":{"0":{"a":470000,"b":360000},"2":{"a":430000,"b":-1},"3":{"a":450000,"b":-1},"4":{"a":480000,"b":-1},"5":{"a":580000,"b":400000},"6":{"a":1200000,"b":150000},"7":{"a":1650000,"b":1150000},"8":{"a":4000000,"b":450000},"9":{"a":-1,"b":360000},"10":{"a":5600000,"b":4200000},"11":{"a":17000000,"b":-1},"12":{"a":35000000,"b":-1}},"/items/peach":{"0":{"a":195,"b":190}},"/items/peach_gummy":{"0":{"a":740,"b":700}},"/items/peach_yogurt":{"0":{"a":1050,"b":1000}},"/items/pearl":{"0":{"a":14000,"b":13500}},"/items/penetrating_shot":{"0":{"a":300000,"b":295000}},"/items/penetrating_strike":{"0":{"a":190000,"b":185000}},"/items/pestilent_shot":{"0":{"a":49000,"b":47000}},"/items/philosophers_earrings":{"0":{"a":660000000,"b":600000000},"1":{"a":-1,"b":560000000},"2":{"a":-1,"b":600000000},"3":{"a":760000000,"b":720000000},"4":{"a":-1,"b":680000000},"5":{"a":980000000,"b":960000000},"6":{"a":-1,"b":1100000000},"7":{"a":1600000000,"b":1550000000},"8":{"a":2150000000,"b":1600000000},"10":{"a":-1,"b":3800000000}},"/items/philosophers_necklace":{"0":{"a":680000000,"b":640000000},"1":{"a":-1,"b":580000000},"2":{"a":-1,"b":620000000},"3":{"a":820000000,"b":780000000},"4":{"a":-1,"b":780000000},"5":{"a":1100000000,"b":1050000000},"6":{"a":-1,"b":1150000000},"7":{"a":1850000000,"b":1800000000},"8":{"a":-1,"b":1900000000},"10":{"a":6000000000,"b":5800000000},"20":{"a":-1,"b":12000000}},"/items/philosophers_ring":{"0":{"a":660000000,"b":600000000},"1":{"a":-1,"b":540000000},"2":{"a":-1,"b":580000000},"3":{"a":760000000,"b":720000000},"4":{"a":-1,"b":780000000},"5":{"a":980000000,"b":960000000},"6":{"a":1250000000,"b":1100000000},"7":{"a":1600000000,"b":1550000000},"8":{"a":2150000000,"b":1800000000},"10":{"a":-1,"b":3800000000}},"/items/philosophers_stone":{"0":{"a":600000000,"b":580000000}},"/items/pincer_gloves":{"0":{"a":27000,"b":24500},"1":{"a":40000,"b":-1},"2":{"a":44000,"b":-1},"3":{"a":50000,"b":-1},"4":{"a":86000,"b":-1},"5":{"a":125000,"b":-1},"6":{"a":340000,"b":-1},"8":{"a":500000,"b":-1},"10":{"a":3700000,"b":1300000},"11":{"a":5800000,"b":-1},"12":{"a":15500000,"b":10500}},"/items/pirate_chest_key":{"0":{"a":5800000,"b":5600000}},"/items/pirate_entry_key":{"0":{"a":640000,"b":620000}},"/items/pirate_essence":{"0":{"a":1950,"b":1900}},"/items/pirate_refinement_shard":{"0":{"a":3600000,"b":3500000}},"/items/plum":{"0":{"a":52,"b":50}},"/items/plum_gummy":{"0":{"a":390,"b":370}},"/items/plum_yogurt":{"0":{"a":740,"b":700}},"/items/poke":{"0":{"a":2950,"b":2900}},"/items/polar_bear_fluff":{"0":{"a":120000,"b":115000}},"/items/polar_bear_shoes":{"0":{"a":820000,"b":760000},"1":{"a":980000,"b":-1},"3":{"a":1250000,"b":-1},"5":{"a":-1,"b":1200000},"6":{"a":-1,"b":1400000},"7":{"a":3000000,"b":2450000},"8":{"a":5000000,"b":-1},"9":{"a":8800000,"b":7600000},"10":{"a":13500000,"b":13000000},"11":{"a":29500000,"b":-1},"12":{"a":46000000,"b":43000000},"13":{"a":92000000,"b":80000000},"14":{"a":200000000,"b":180000000},"15":{"a":440000000,"b":-1}},"/items/precision":{"0":{"a":56000,"b":54000}},"/items/prime_catalyst":{"0":{"a":170000,"b":160000}},"/items/processing_tea":{"0":{"a":2450,"b":2400}},"/items/provoke":{"0":{"a":68000,"b":66000}},"/items/puncture":{"0":{"a":96000,"b":94000}},"/items/purple_key_fragment":{"0":{"a":740000,"b":720000}},"/items/purpleheart_bow":{"0":{"a":165000,"b":135000},"5":{"a":5600000,"b":-1}},"/items/purpleheart_crossbow":{"0":{"a":150000,"b":105000},"1":{"a":155000,"b":-1},"2":{"a":145000,"b":-1},"3":{"a":225000,"b":-1},"4":{"a":14000000,"b":-1},"5":{"a":2000000,"b":-1},"7":{"a":8600000,"b":-1}},"/items/purpleheart_fire_staff":{"0":{"a":130000,"b":115000},"2":{"a":150000,"b":-1},"3":{"a":200000,"b":-1},"5":{"a":1000000,"b":-1},"7":{"a":1200000,"b":-1}},"/items/purpleheart_log":{"0":{"a":265,"b":260}},"/items/purpleheart_lumber":{"0":{"a":1350,"b":1300}},"/items/purpleheart_nature_staff":{"0":{"a":145000,"b":120000},"1":{"a":350000,"b":-1},"2":{"a":260000,"b":-1},"5":{"a":490000,"b":-1}},"/items/purpleheart_shield":{"0":{"a":125000,"b":88000},"1":{"a":120000,"b":-1},"3":{"a":190000,"b":-1},"4":{"a":440000,"b":-1},"5":{"a":390000,"b":-1},"6":{"a":620000,"b":-1}},"/items/purpleheart_water_staff":{"0":{"a":130000,"b":115000},"1":{"a":200000,"b":-1},"2":{"a":8000000,"b":-1},"4":{"a":2200000,"b":-1},"5":{"a":4900000,"b":-1},"8":{"a":7000000,"b":-1}},"/items/quick_aid":{"0":{"a":120000,"b":115000}},"/items/quick_shot":{"0":{"a":2800,"b":2750}},"/items/radiant_boots":{"0":{"a":180000,"b":175000},"2":{"a":245000,"b":-1},"3":{"a":250000,"b":-1},"4":{"a":560000,"b":-1},"5":{"a":1350000,"b":700000},"6":{"a":2800000,"b":280000},"10":{"a":-1,"b":20000000}},"/items/radiant_fabric":{"0":{"a":2750,"b":2700}},"/items/radiant_fiber":{"0":{"a":580,"b":560}},"/items/radiant_gloves":{"0":{"a":185000,"b":175000},"1":{"a":180000,"b":-1},"2":{"a":200000,"b":-1},"3":{"a":300000,"b":-1},"5":{"a":920000,"b":560000},"6":{"a":2950000,"b":295000}},"/items/radiant_hat":{"0":{"a":295000,"b":290000},"1":{"a":370000,"b":215000},"3":{"a":410000,"b":-1},"5":{"a":620000,"b":500000},"6":{"a":2800000,"b":1000000},"7":{"a":-1,"b":3000000},"10":{"a":30000000,"b":25500000}},"/items/radiant_robe_bottoms":{"0":{"a":520000,"b":500000},"1":{"a":660000,"b":-1},"2":{"a":620000,"b":-1},"3":{"a":620000,"b":-1},"4":{"a":980000,"b":-1},"5":{"a":2200000,"b":-1},"7":{"a":8800000,"b":-1}},"/items/radiant_robe_top":{"0":{"a":580000,"b":560000},"1":{"a":620000,"b":-1},"2":{"a":700000,"b":-1},"3":{"a":780000,"b":-1},"4":{"a":900000,"b":-1},"5":{"a":1100000,"b":820000},"6":{"a":4300000,"b":430000}},"/items/rain_of_arrows":{"0":{"a":195000,"b":190000}},"/items/rainbow_alembic":{"0":{"a":300000,"b":260000},"1":{"a":520000,"b":-1},"2":{"a":420000,"b":-1},"3":{"a":700000,"b":100000},"4":{"a":860000,"b":-1},"5":{"a":940000,"b":-1},"6":{"a":-1,"b":540000}},"/items/rainbow_boots":{"0":{"a":195000,"b":190000},"1":{"a":225000,"b":-1},"4":{"a":390000,"b":-1},"5":{"a":360000,"b":-1}},"/items/rainbow_brush":{"0":{"a":250000,"b":210000},"1":{"a":450000,"b":-1},"2":{"a":460000,"b":-1},"3":{"a":600000,"b":100000},"4":{"a":920000,"b":-1},"5":{"a":820000,"b":270000},"6":{"a":5200000,"b":1100000},"7":{"a":10000000,"b":-1}},"/items/rainbow_buckler":{"0":{"a":255000,"b":215000},"1":{"a":330000,"b":-1},"2":{"a":290000,"b":-1},"4":{"a":620000,"b":-1},"5":{"a":940000,"b":-1},"6":{"a":1150000,"b":-1}},"/items/rainbow_bulwark":{"0":{"a":350000,"b":340000},"1":{"a":310000,"b":-1},"2":{"a":580000,"b":-1},"3":{"a":540000,"b":-1},"4":{"a":1000000,"b":-1},"5":{"a":1400000,"b":-1}},"/items/rainbow_cheese":{"0":{"a":1800,"b":1700}},"/items/rainbow_chisel":{"0":{"a":240000,"b":225000},"1":{"a":-1,"b":130000},"2":{"a":255000,"b":135000},"3":{"a":-1,"b":100000},"4":{"a":700000,"b":-1},"5":{"a":1150000,"b":-1},"6":{"a":2000000,"b":1250000}},"/items/rainbow_enhancer":{"0":{"a":310000,"b":240000},"1":{"a":490000,"b":-1},"2":{"a":520000,"b":-1},"3":{"a":-1,"b":100000},"4":{"a":840000,"b":-1},"5":{"a":960000,"b":320000},"6":{"a":1750000,"b":1300000},"7":{"a":5000000,"b":-1}},"/items/rainbow_gauntlets":{"0":{"a":195000,"b":145000},"1":{"a":230000,"b":-1},"2":{"a":200000,"b":-1},"3":{"a":350000,"b":-1},"5":{"a":920000,"b":-1},"6":{"a":2500000,"b":-1}},"/items/rainbow_hammer":{"0":{"a":265000,"b":245000},"1":{"a":390000,"b":-1},"2":{"a":350000,"b":-1},"3":{"a":760000,"b":100000},"5":{"a":1200000,"b":800000},"6":{"a":5400000,"b":1150000},"7":{"a":-1,"b":1300000}},"/items/rainbow_hatchet":{"0":{"a":295000,"b":260000},"1":{"a":320000,"b":-1},"2":{"a":450000,"b":-1},"3":{"a":680000,"b":100000},"4":{"a":1000000,"b":-1},"5":{"a":1500000,"b":800000},"6":{"a":6000000,"b":1300000},"7":{"a":11000000,"b":-1}},"/items/rainbow_helmet":{"0":{"a":235000,"b":220000},"1":{"a":250000,"b":-1},"3":{"a":370000,"b":-1},"4":{"a":440000,"b":-1},"5":{"a":700000,"b":-1}},"/items/rainbow_mace":{"0":{"a":460000,"b":380000},"1":{"a":350000,"b":-1},"3":{"a":470000,"b":-1},"4":{"a":540000,"b":-1}},"/items/rainbow_milk":{"0":{"a":370,"b":360}},"/items/rainbow_needle":{"0":{"a":250000,"b":240000},"3":{"a":-1,"b":100000},"4":{"a":500000,"b":-1},"5":{"a":1150000,"b":-1},"6":{"a":-1,"b":1400000}},"/items/rainbow_plate_body":{"0":{"a":340000,"b":330000},"1":{"a":390000,"b":-1},"2":{"a":520000,"b":-1},"3":{"a":600000,"b":-1},"4":{"a":980000,"b":-1},"5":{"a":1750000,"b":29500}},"/items/rainbow_plate_legs":{"0":{"a":295000,"b":170000},"3":{"a":560000,"b":-1},"4":{"a":4500000,"b":-1},"5":{"a":4500000,"b":-1},"6":{"a":6800000,"b":-1}},"/items/rainbow_pot":{"0":{"a":285000,"b":270000},"1":{"a":320000,"b":-1},"2":{"a":420000,"b":-1},"3":{"a":600000,"b":350000},"5":{"a":1400000,"b":780000},"6":{"a":5400000,"b":1300000},"7":{"a":5000000,"b":-1},"8":{"a":6000000,"b":-1}},"/items/rainbow_shears":{"0":{"a":300000,"b":290000},"1":{"a":400000,"b":-1},"2":{"a":460000,"b":-1},"3":{"a":900000,"b":100000},"4":{"a":1350000,"b":-1},"5":{"a":1100000,"b":-1},"6":{"a":5200000,"b":1450000},"7":{"a":17500000,"b":1250000},"8":{"a":13000000,"b":-1}},"/items/rainbow_spatula":{"0":{"a":430000,"b":280000},"1":{"a":380000,"b":-1},"2":{"a":390000,"b":-1},"3":{"a":560000,"b":100000},"4":{"a":860000,"b":-1},"5":{"a":1150000,"b":-1},"6":{"a":4800000,"b":640000}},"/items/rainbow_spear":{"0":{"a":390000,"b":380000},"1":{"a":700000,"b":-1},"2":{"a":700000,"b":-1},"3":{"a":1050000,"b":-1},"5":{"a":-1,"b":740000}},"/items/rainbow_sword":{"0":{"a":420000,"b":390000},"2":{"a":380000,"b":-1},"3":{"a":430000,"b":-1},"6":{"a":640000,"b":-1},"7":{"a":820000,"b":-1}},"/items/ranged_coffee":{"0":{"a":1200,"b":1100}},"/items/ranger_necklace":{"0":{"a":12000000,"b":11500000},"1":{"a":15000000,"b":8000000},"2":{"a":17000000,"b":10000000},"3":{"a":24500000,"b":16000000},"7":{"a":-1,"b":120000000}},"/items/red_culinary_hat":{"0":{"a":5400000,"b":5200000},"2":{"a":8200000,"b":860000},"4":{"a":-1,"b":1550000},"5":{"a":9000000,"b":6800000},"6":{"a":10500000,"b":-1},"7":{"a":13000000,"b":8800000},"8":{"a":20000000,"b":18000000},"9":{"a":-1,"b":8800000},"10":{"a":50000000,"b":48000000},"12":{"a":190000000,"b":150000000},"15":{"a":1500000000,"b":100000000}},"/items/red_panda_fluff":{"0":{"a":540000,"b":520000}},"/items/red_tea_leaf":{"0":{"a":50,"b":48}},"/items/redwood_bow":{"0":{"a":560000,"b":540000},"3":{"a":1200000,"b":-1},"5":{"a":680000,"b":-1},"6":{"a":2700000,"b":-1}},"/items/redwood_crossbow":{"0":{"a":460000,"b":410000},"1":{"a":400000,"b":-1},"2":{"a":500000,"b":-1},"3":{"a":560000,"b":-1},"5":{"a":660000,"b":-1},"6":{"a":2500000,"b":-1},"7":{"a":6400000,"b":3000000},"8":{"a":14000000,"b":-1},"10":{"a":20500000,"b":-1}},"/items/redwood_fire_staff":{"0":{"a":400000,"b":390000},"2":{"a":900000,"b":-1},"3":{"a":900000,"b":-1},"4":{"a":1200000,"b":-1},"5":{"a":1400000,"b":-1},"8":{"a":6000000,"b":-1}},"/items/redwood_log":{"0":{"a":380,"b":370}},"/items/redwood_lumber":{"0":{"a":1850,"b":1800}},"/items/redwood_nature_staff":{"0":{"a":440000,"b":400000},"1":{"a":520000,"b":-1},"2":{"a":760000,"b":-1},"3":{"a":800000,"b":-1},"5":{"a":1450000,"b":-1}},"/items/redwood_shield":{"0":{"a":265000,"b":250000},"1":{"a":270000,"b":-1},"2":{"a":270000,"b":-1},"3":{"a":460000,"b":-1},"5":{"a":800000,"b":-1},"6":{"a":920000,"b":-1},"10":{"a":21000000,"b":-1}},"/items/redwood_water_staff":{"0":{"a":540000,"b":390000},"1":{"a":540000,"b":-1},"2":{"a":520000,"b":-1},"3":{"a":860000,"b":-1},"4":{"a":600000,"b":-1},"5":{"a":1100000,"b":-1},"7":{"a":2000000,"b":-1},"10":{"a":10000000,"b":-1}},"/items/regal_jewel":{"0":{"a":10500000,"b":10000000}},"/items/regal_sword":{"0":{"a":220000000,"b":180000000},"4":{"a":220000000,"b":-1},"5":{"a":225000000,"b":215000000},"7":{"a":265000000,"b":245000000},"8":{"a":330000000,"b":290000000},"9":{"a":440000000,"b":-1},"10":{"a":600000000,"b":560000000},"12":{"a":1750000000,"b":-1}},"/items/regal_sword_refined":{"0":{"a":-1,"b":5200000},"1":{"a":-1,"b":5600000},"2":{"a":-1,"b":6200000},"3":{"a":-1,"b":6200000},"10":{"a":1650000000,"b":5600000},"12":{"a":2750000000,"b":5800000}},"/items/rejuvenate":{"0":{"a":120000,"b":115000}},"/items/reptile_boots":{"0":{"a":18000,"b":11000},"1":{"a":29500,"b":-1}},"/items/reptile_bracers":{"0":{"a":14500,"b":10000},"1":{"a":60000,"b":-1},"2":{"a":86000,"b":-1},"3":{"a":96000,"b":-1}},"/items/reptile_chaps":{"0":{"a":23000,"b":21000},"2":{"a":250000,"b":-1}},"/items/reptile_hide":{"0":{"a":24,"b":23}},"/items/reptile_hood":{"0":{"a":16000,"b":12000}},"/items/reptile_leather":{"0":{"a":580,"b":560}},"/items/reptile_tunic":{"0":{"a":25500,"b":23000},"1":{"a":80000,"b":-1},"2":{"a":170000,"b":-1}},"/items/retribution":{"0":{"a":52000,"b":50000}},"/items/revenant_anima":{"0":{"a":920000,"b":900000}},"/items/revenant_chaps":{"0":{"a":7200000,"b":6600000},"5":{"a":7200000,"b":6600000},"6":{"a":10000000,"b":-1},"7":{"a":15500000,"b":14000000},"8":{"a":22500000,"b":15000000},"9":{"a":50000000,"b":-1},"10":{"a":70000000,"b":43000000}},"/items/revenant_tunic":{"0":{"a":8600000,"b":8200000},"3":{"a":-1,"b":3200000},"5":{"a":9600000,"b":9200000},"6":{"a":12000000,"b":11000000},"7":{"a":16000000,"b":14000000},"8":{"a":23500000,"b":15000000},"9":{"a":45000000,"b":-1},"10":{"a":66000000,"b":37000000}},"/items/revive":{"0":{"a":820000,"b":800000}},"/items/ring_of_armor":{"0":{"a":6200000,"b":5600000},"1":{"a":6400000,"b":-1},"2":{"a":9800000,"b":-1},"3":{"a":11000000,"b":-1},"4":{"a":30000000,"b":-1}},"/items/ring_of_critical_strike":{"0":{"a":9600000,"b":8200000},"1":{"a":-1,"b":7800000},"2":{"a":-1,"b":10000000},"3":{"a":20500000,"b":18000000},"4":{"a":40000000,"b":32000000},"5":{"a":74000000,"b":70000000},"6":{"a":110000000,"b":74000000}},"/items/ring_of_essence_find":{"0":{"a":7400000,"b":6400000}},"/items/ring_of_gathering":{"0":{"a":6200000,"b":5800000},"1":{"a":11000000,"b":-1}},"/items/ring_of_rare_find":{"0":{"a":7400000,"b":7000000},"1":{"a":9000000,"b":7000000},"2":{"a":-1,"b":9400000},"3":{"a":20000000,"b":17000000},"4":{"a":40000000,"b":29500000},"5":{"a":70000000,"b":66000000},"6":{"a":140000000,"b":-1},"7":{"a":-1,"b":7200000}},"/items/ring_of_regeneration":{"0":{"a":6600000,"b":6000000},"1":{"a":7200000,"b":6400000},"2":{"a":12000000,"b":8400000},"3":{"a":16000000,"b":14500000},"4":{"a":30000000,"b":27000000},"5":{"a":66000000,"b":60000000},"6":{"a":110000000,"b":70000000},"7":{"a":190000000,"b":145000000},"10":{"a":900000000,"b":-1}},"/items/ring_of_resistance":{"0":{"a":5800000,"b":5600000},"1":{"a":9000000,"b":-1},"3":{"a":13000000,"b":-1},"5":{"a":49000000,"b":-1}},"/items/rippling_trident":{"0":{"a":230000000,"b":220000000},"1":{"a":-1,"b":200000000},"2":{"a":-1,"b":200000000},"3":{"a":-1,"b":205000000},"4":{"a":-1,"b":190000000},"5":{"a":300000000,"b":220000000},"6":{"a":-1,"b":220000000},"7":{"a":260000000,"b":245000000},"8":{"a":330000000,"b":285000000},"9":{"a":-1,"b":320000000},"10":{"a":620000000,"b":580000000},"12":{"a":1700000000,"b":1450000000},"14":{"a":6600000000,"b":-1}},"/items/rippling_trident_refined":{"10":{"a":1700000000,"b":1250000000},"12":{"a":2850000000,"b":-1},"14":{"a":7000000000,"b":6000000000}},"/items/robusta_coffee_bean":{"0":{"a":440,"b":420}},"/items/rough_boots":{"0":{"a":2950,"b":2150},"2":{"a":16000,"b":-1}},"/items/rough_bracers":{"0":{"a":3600,"b":2700},"1":{"a":14000,"b":-1},"2":{"a":18000,"b":-1}},"/items/rough_chaps":{"0":{"a":6000,"b":4900},"3":{"a":28000,"b":-1}},"/items/rough_hide":{"0":{"a":76,"b":64}},"/items/rough_hood":{"0":{"a":4900,"b":3400},"2":{"a":20000,"b":-1},"5":{"a":-1,"b":290},"10":{"a":-1,"b":290}},"/items/rough_leather":{"0":{"a":450,"b":440}},"/items/rough_tunic":{"0":{"a":7000,"b":5400},"2":{"a":38000,"b":-1},"3":{"a":76000,"b":-1}},"/items/royal_cloth":{"0":{"a":8000000,"b":7800000}},"/items/royal_fire_robe_bottoms":{"0":{"a":76000000,"b":66000000},"5":{"a":78000000,"b":68000000},"7":{"a":96000000,"b":90000000},"8":{"a":160000000,"b":110000000},"9":{"a":-1,"b":175000000},"10":{"a":370000000,"b":350000000},"12":{"a":1250000000,"b":1150000000}},"/items/royal_fire_robe_bottoms_refined":{"10":{"a":700000000,"b":80000000}},"/items/royal_fire_robe_top":{"0":{"a":88000000,"b":82000000},"3":{"a":-1,"b":80000000},"5":{"a":-1,"b":84000000},"6":{"a":105000000,"b":90000000},"7":{"a":115000000,"b":110000000},"8":{"a":165000000,"b":140000000},"9":{"a":-1,"b":190000000},"10":{"a":400000000,"b":380000000},"12":{"a":1350000000,"b":1200000000}},"/items/royal_fire_robe_top_refined":{"10":{"a":-1,"b":720000000}},"/items/royal_nature_robe_bottoms":{"0":{"a":78000000,"b":68000000},"5":{"a":78000000,"b":70000000},"7":{"a":96000000,"b":92000000},"8":{"a":145000000,"b":115000000},"10":{"a":370000000,"b":360000000},"12":{"a":-1,"b":1150000000}},"/items/royal_nature_robe_bottoms_refined":{"10":{"a":700000000,"b":660000000},"12":{"a":-1,"b":1450000000}},"/items/royal_nature_robe_top":{"0":{"a":90000000,"b":88000000},"5":{"a":94000000,"b":88000000},"6":{"a":100000000,"b":86000000},"7":{"a":115000000,"b":110000000},"8":{"a":160000000,"b":135000000},"9":{"a":255000000,"b":200000000},"10":{"a":410000000,"b":390000000},"12":{"a":1300000000,"b":1100000000}},"/items/royal_nature_robe_top_refined":{"10":{"a":760000000,"b":680000000},"12":{"a":-1,"b":1550000000}},"/items/royal_water_robe_bottoms":{"0":{"a":76000000,"b":68000000},"5":{"a":70000000,"b":64000000},"6":{"a":105000000,"b":64000000},"7":{"a":94000000,"b":92000000},"8":{"a":140000000,"b":110000000},"9":{"a":-1,"b":155000000},"10":{"a":370000000,"b":360000000}},"/items/royal_water_robe_bottoms_refined":{},"/items/royal_water_robe_top":{"0":{"a":90000000,"b":84000000},"5":{"a":96000000,"b":82000000},"6":{"a":105000000,"b":84000000},"7":{"a":-1,"b":110000000},"8":{"a":160000000,"b":140000000},"9":{"a":-1,"b":200000000},"10":{"a":400000000,"b":380000000},"12":{"a":1400000000,"b":-1}},"/items/royal_water_robe_top_refined":{"10":{"a":-1,"b":700000000},"12":{"a":-1,"b":1600000000}},"/items/scratch":{"0":{"a":3300,"b":3200}},"/items/shard_of_protection":{"0":{"a":60000,"b":58000}},"/items/shield_bash":{"0":{"a":48000,"b":47000}},"/items/shoebill_feather":{"0":{"a":110000,"b":105000}},"/items/shoebill_shoes":{"0":{"a":920000,"b":900000},"1":{"a":1100000,"b":110000},"3":{"a":980000,"b":105000},"4":{"a":1650000,"b":170000},"5":{"a":1350000,"b":1200000},"6":{"a":-1,"b":1400000},"7":{"a":2750000,"b":2300000},"8":{"a":8000000,"b":3500000},"9":{"a":8600000,"b":860000},"10":{"a":12000000,"b":10000000},"11":{"a":-1,"b":15000000},"12":{"a":39000000,"b":31000000},"14":{"a":150000000,"b":130000000},"15":{"a":-1,"b":490000}},"/items/sighted_bracers":{"0":{"a":1800000,"b":1700000},"1":{"a":-1,"b":105000},"2":{"a":1800000,"b":105000},"3":{"a":-1,"b":105000},"4":{"a":2000000,"b":105000},"5":{"a":1750000,"b":1000000},"6":{"a":1850000,"b":105000},"7":{"a":2350000,"b":225000},"8":{"a":2600000,"b":225000},"9":{"a":4900000,"b":520000},"10":{"a":5600000,"b":5400000},"11":{"a":14000000,"b":8000000},"12":{"a":31000000,"b":-1}},"/items/silencing_shot":{"0":{"a":96000,"b":94000}},"/items/silk_boots":{"0":{"a":76000,"b":50000},"1":{"a":84000,"b":-1},"2":{"a":125000,"b":-1},"5":{"a":500000,"b":100000},"6":{"a":480000,"b":-1}},"/items/silk_fabric":{"0":{"a":1800,"b":1750}},"/items/silk_gloves":{"0":{"a":68000,"b":66000},"1":{"a":96000,"b":-1},"2":{"a":130000,"b":-1},"3":{"a":220000,"b":-1},"5":{"a":340000,"b":120000},"6":{"a":560000,"b":8000},"7":{"a":2000000,"b":-1}},"/items/silk_hat":{"0":{"a":100000,"b":80000},"1":{"a":120000,"b":-1},"2":{"a":125000,"b":-1},"3":{"a":135000,"b":-1},"4":{"a":200000,"b":-1},"5":{"a":350000,"b":100000}},"/items/silk_robe_bottoms":{"0":{"a":200000,"b":185000},"3":{"a":340000,"b":-1},"5":{"a":500000,"b":170000}},"/items/silk_robe_top":{"0":{"a":210000,"b":200000},"2":{"a":260000,"b":-1},"3":{"a":270000,"b":-1},"5":{"a":500000,"b":230000},"6":{"a":2650000,"b":-1},"7":{"a":6600000,"b":-1}},"/items/sinister_chest_key":{"0":{"a":4100000,"b":4000000}},"/items/sinister_entry_key":{"0":{"a":500000,"b":490000}},"/items/sinister_essence":{"0":{"a":1200,"b":1150}},"/items/sinister_refinement_shard":{"0":{"a":2850000,"b":2800000}},"/items/smack":{"0":{"a":2800,"b":2700}},"/items/small_pouch":{"0":{"a":25000,"b":17500},"1":{"a":33000,"b":-1}},"/items/smoke_burst":{"0":{"a":76000,"b":74000}},"/items/snail_shell":{"0":{"a":9600,"b":9200}},"/items/snail_shell_helmet":{"0":{"a":32000,"b":29000},"1":{"a":62000,"b":-1},"2":{"a":96000,"b":-1},"3":{"a":145000,"b":-1},"4":{"a":960000,"b":-1},"5":{"a":1350000,"b":-1},"6":{"a":2900000,"b":-1},"7":{"a":2000000,"b":-1}},"/items/snake_fang":{"0":{"a":5600,"b":5400}},"/items/snake_fang_dirk":{"0":{"a":38000,"b":27000},"1":{"a":44000,"b":16500},"2":{"a":38000,"b":6400},"3":{"a":45000,"b":6600},"4":{"a":74000,"b":26500},"5":{"a":125000,"b":28000},"6":{"a":310000,"b":31000},"7":{"a":660000,"b":26500},"8":{"a":1150000,"b":68000},"9":{"a":1400000,"b":125000},"10":{"a":1400000,"b":200000},"11":{"a":7000000,"b":1000000},"12":{"a":13500000,"b":1200000},"13":{"a":21500000,"b":-1},"14":{"a":32000000,"b":2000000},"15":{"a":50000000,"b":8000000}},"/items/sorcerer_boots":{"0":{"a":800000,"b":780000},"1":{"a":-1,"b":780000},"2":{"a":-1,"b":780000},"3":{"a":-1,"b":780000},"4":{"a":1050000,"b":780000},"5":{"a":1350000,"b":1300000},"6":{"a":1900000,"b":1800000},"7":{"a":3300000,"b":3200000},"8":{"a":5800000,"b":5000000},"9":{"a":9800000,"b":8200000},"10":{"a":16500000,"b":15000000},"11":{"a":32000000,"b":23000000},"12":{"a":54000000,"b":52000000},"13":{"a":110000000,"b":80000000},"14":{"a":210000000,"b":205000000},"15":{"a":450000000,"b":380000000},"16":{"a":880000000,"b":-1}},"/items/sorcerer_essence":{"0":{"a":125,"b":120}},"/items/sorcerers_sole":{"0":{"a":170000,"b":165000}},"/items/soul_fragment":{"0":{"a":540000,"b":520000}},"/items/soul_hunter_crossbow":{"0":{"a":12000000,"b":9800000},"3":{"a":11000000,"b":-1},"5":{"a":12000000,"b":10000000},"6":{"a":13500000,"b":-1},"7":{"a":15500000,"b":14500000},"8":{"a":20500000,"b":-1},"10":{"a":43000000,"b":40000000}},"/items/spaceberry":{"0":{"a":240,"b":235}},"/items/spaceberry_cake":{"0":{"a":1800,"b":1750}},"/items/spaceberry_donut":{"0":{"a":1400,"b":1350}},"/items/spacia_coffee_bean":{"0":{"a":1100,"b":1050}},"/items/speed_aura":{"0":{"a":2500000,"b":2400000}},"/items/spike_shell":{"0":{"a":70000,"b":68000}},"/items/spiked_bulwark":{"0":{"a":11500000,"b":9800000},"1":{"a":-1,"b":8000000},"2":{"a":-1,"b":8000000},"3":{"a":-1,"b":8000000},"5":{"a":14500000,"b":10000000},"6":{"a":-1,"b":8400000},"7":{"a":25000000,"b":19500000},"8":{"a":24500000,"b":21000000},"10":{"a":-1,"b":42000000}},"/items/stalactite_shard":{"0":{"a":560000,"b":540000}},"/items/stalactite_spear":{"0":{"a":13000000,"b":9800000},"1":{"a":12000000,"b":-1},"3":{"a":15000000,"b":-1},"5":{"a":14000000,"b":12000000},"6":{"a":-1,"b":13000000},"7":{"a":19500000,"b":18000000},"8":{"a":28000000,"b":18000000},"10":{"a":74000000,"b":60000000},"14":{"a":-1,"b":500000}},"/items/stamina_coffee":{"0":{"a":680,"b":620}},"/items/star_fragment":{"0":{"a":13000,"b":12500}},"/items/star_fruit":{"0":{"a":540,"b":520}},"/items/star_fruit_gummy":{"0":{"a":1300,"b":1250}},"/items/star_fruit_yogurt":{"0":{"a":1750,"b":1700}},"/items/steady_shot":{"0":{"a":96000,"b":94000}},"/items/stone_key_fragment":{"0":{"a":1600000,"b":1550000}},"/items/strawberry":{"0":{"a":140,"b":135}},"/items/strawberry_cake":{"0":{"a":1100,"b":1000}},"/items/strawberry_donut":{"0":{"a":740,"b":720}},"/items/stunning_blow":{"0":{"a":96000,"b":94000}},"/items/sugar":{"0":{"a":12,"b":11}},"/items/sundering_crossbow":{"0":{"a":240000000,"b":225000000},"1":{"a":-1,"b":180000000},"2":{"a":-1,"b":185000000},"3":{"a":-1,"b":180000000},"4":{"a":-1,"b":180000000},"5":{"a":255000000,"b":235000000},"6":{"a":-1,"b":225000000},"7":{"a":295000000,"b":265000000},"8":{"a":-1,"b":300000000},"9":{"a":-1,"b":360000000},"10":{"a":620000000,"b":600000000},"11":{"a":-1,"b":760000000},"12":{"a":1800000000,"b":1300000000},"14":{"a":-1,"b":3000000000},"15":{"a":-1,"b":5000000}},"/items/sundering_crossbow_refined":{"0":{"a":-1,"b":5200000},"8":{"a":-1,"b":50000000},"10":{"a":-1,"b":1500000000},"12":{"a":-1,"b":1150000000},"13":{"a":-1,"b":5600000},"14":{"a":-1,"b":6000000},"15":{"a":-1,"b":5800000},"16":{"a":-1,"b":5600000},"20":{"a":-1,"b":5400000}},"/items/sundering_jewel":{"0":{"a":10500000,"b":10000000}},"/items/sunstone":{"0":{"a":520000,"b":500000}},"/items/super_alchemy_tea":{"0":{"a":4000,"b":3900}},"/items/super_attack_coffee":{"0":{"a":3700,"b":3600}},"/items/super_brewing_tea":{"0":{"a":3300,"b":3100}},"/items/super_cheesesmithing_tea":{"0":{"a":4100,"b":3900}},"/items/super_cooking_tea":{"0":{"a":3200,"b":2950}},"/items/super_crafting_tea":{"0":{"a":4400,"b":4000}},"/items/super_defense_coffee":{"0":{"a":3700,"b":3600}},"/items/super_enhancing_tea":{"0":{"a":4800,"b":4700}},"/items/super_foraging_tea":{"0":{"a":7600,"b":2650}},"/items/super_intelligence_coffee":{"0":{"a":2800,"b":2750}},"/items/super_magic_coffee":{"0":{"a":5000,"b":4900}},"/items/super_melee_coffee":{"0":{"a":4900,"b":4800}},"/items/super_milking_tea":{"0":{"a":2250,"b":1850}},"/items/super_ranged_coffee":{"0":{"a":4900,"b":4800}},"/items/super_stamina_coffee":{"0":{"a":2750,"b":2700}},"/items/super_tailoring_tea":{"0":{"a":4400,"b":4200}},"/items/super_woodcutting_tea":{"0":{"a":2700,"b":2500}},"/items/swamp_essence":{"0":{"a":50,"b":47}},"/items/sweep":{"0":{"a":33000,"b":32000}},"/items/swiftness_coffee":{"0":{"a":3000,"b":2950}},"/items/tailoring_essence":{"0":{"a":225,"b":215}},"/items/tailoring_tea":{"0":{"a":740,"b":700}},"/items/tailors_bottoms":{"0":{"a":200000000,"b":25000000},"5":{"a":235000000,"b":160000000},"7":{"a":240000000,"b":170000000},"8":{"a":275000000,"b":240000000},"10":{"a":420000000,"b":360000000},"12":{"a":-1,"b":660000000}},"/items/tailors_top":{"0":{"a":-1,"b":3500000},"3":{"a":175000000,"b":-1},"5":{"a":190000000,"b":160000000},"7":{"a":205000000,"b":180000000},"8":{"a":250000000,"b":8000000},"10":{"a":400000000,"b":330000000}},"/items/taunt":{"0":{"a":56000,"b":54000}},"/items/thread_of_expertise":{"0":{"a":10500000,"b":10000000}},"/items/tome_of_healing":{"0":{"a":38000,"b":37000},"1":{"a":39000,"b":24000},"2":{"a":40000,"b":24000},"3":{"a":41000,"b":25000},"4":{"a":43000,"b":29000},"5":{"a":56000,"b":48000},"6":{"a":84000,"b":68000},"7":{"a":170000,"b":150000},"8":{"a":380000,"b":330000},"10":{"a":1400000,"b":-1},"11":{"a":4700000,"b":-1},"12":{"a":8000000,"b":-1},"15":{"a":80000000,"b":-1},"19":{"a":2000000000,"b":-1}},"/items/tome_of_the_elements":{"0":{"a":2150000,"b":2100000},"1":{"a":-1,"b":1450000},"2":{"a":2200000,"b":1850000},"3":{"a":2500000,"b":1800000},"4":{"a":-1,"b":1650000},"5":{"a":2150000,"b":1050000},"6":{"a":2250000,"b":1800000},"7":{"a":2300000,"b":1950000},"8":{"a":2700000,"b":1600000},"9":{"a":3300000,"b":1750000},"10":{"a":5600000,"b":4800000},"11":{"a":11000000,"b":1050000},"12":{"a":25000000,"b":1100000},"15":{"a":300000000,"b":1250000}},"/items/toughness":{"0":{"a":56000,"b":54000}},"/items/toxic_pollen":{"0":{"a":220000,"b":215000}},"/items/treant_bark":{"0":{"a":30000,"b":29500}},"/items/treant_shield":{"0":{"a":140000,"b":135000},"3":{"a":210000,"b":-1},"4":{"a":170000,"b":-1},"5":{"a":190000,"b":160000},"6":{"a":-1,"b":150000},"7":{"a":1050000,"b":-1},"10":{"a":7400000,"b":-1}},"/items/turtle_shell":{"0":{"a":21500,"b":19000}},"/items/turtle_shell_body":{"0":{"a":80000,"b":78000},"2":{"a":100000,"b":-1},"3":{"a":215000,"b":-1},"4":{"a":220000,"b":-1},"5":{"a":160000,"b":-1}},"/items/turtle_shell_legs":{"0":{"a":62000,"b":50000},"3":{"a":490000,"b":-1},"5":{"a":820000,"b":-1}},"/items/twilight_essence":{"0":{"a":265,"b":260}},"/items/ultra_alchemy_tea":{"0":{"a":7400,"b":7000}},"/items/ultra_attack_coffee":{"0":{"a":10500,"b":10000}},"/items/ultra_brewing_tea":{"0":{"a":7000,"b":6800}},"/items/ultra_cheesesmithing_tea":{"0":{"a":8400,"b":8000}},"/items/ultra_cooking_tea":{"0":{"a":7600,"b":7000}},"/items/ultra_crafting_tea":{"0":{"a":8400,"b":8200}},"/items/ultra_defense_coffee":{"0":{"a":10500,"b":10000}},"/items/ultra_enhancing_tea":{"0":{"a":11000,"b":10500}},"/items/ultra_foraging_tea":{"0":{"a":6600,"b":6200}},"/items/ultra_intelligence_coffee":{"0":{"a":9000,"b":7200}},"/items/ultra_magic_coffee":{"0":{"a":12000,"b":11500}},"/items/ultra_melee_coffee":{"0":{"a":12000,"b":11500}},"/items/ultra_milking_tea":{"0":{"a":6200,"b":6000}},"/items/ultra_ranged_coffee":{"0":{"a":12000,"b":11500}},"/items/ultra_stamina_coffee":{"0":{"a":9400,"b":9200}},"/items/ultra_tailoring_tea":{"0":{"a":8200,"b":8000}},"/items/ultra_woodcutting_tea":{"0":{"a":6200,"b":5800}},"/items/umbral_boots":{"0":{"a":145000,"b":130000},"1":{"a":135000,"b":-1},"2":{"a":180000,"b":-1},"3":{"a":210000,"b":-1},"5":{"a":4700000,"b":320000},"7":{"a":50000000,"b":-1},"8":{"a":68000000,"b":-1}},"/items/umbral_bracers":{"0":{"a":240000,"b":235000},"1":{"a":300000,"b":-1},"2":{"a":300000,"b":-1},"3":{"a":380000,"b":-1},"4":{"a":1050000,"b":-1},"5":{"a":8800000,"b":-1},"10":{"a":25000000,"b":15000000}},"/items/umbral_chaps":{"0":{"a":400000,"b":380000},"1":{"a":700000,"b":-1},"2":{"a":1200000,"b":-1},"3":{"a":1950000,"b":-1},"4":{"a":2500000,"b":-1},"5":{"a":3800000,"b":-1},"6":{"a":6200000,"b":-1}},"/items/umbral_hide":{"0":{"a":240,"b":235}},"/items/umbral_hood":{"0":{"a":180000,"b":175000},"2":{"a":290000,"b":-1},"3":{"a":330000,"b":-1},"4":{"a":600000,"b":-1},"5":{"a":820000,"b":205000},"6":{"a":5800000,"b":-1}},"/items/umbral_leather":{"0":{"a":2050,"b":2000}},"/items/umbral_tunic":{"0":{"a":460000,"b":450000},"2":{"a":90000,"b":-1},"3":{"a":960000,"b":-1},"5":{"a":4000000,"b":700000}},"/items/vampire_fang":{"0":{"a":560000,"b":540000}},"/items/vampire_fang_dirk":{"0":{"a":12000000,"b":9800000},"5":{"a":12500000,"b":10500000},"6":{"a":16000000,"b":-1},"7":{"a":18000000,"b":16000000},"8":{"a":29500000,"b":22000000},"9":{"a":-1,"b":20000000},"10":{"a":58000000,"b":48000000}},"/items/vampiric_bow":{"0":{"a":13000000,"b":10000000},"2":{"a":16500000,"b":-1},"3":{"a":21500000,"b":-1},"4":{"a":20500000,"b":-1},"5":{"a":26000000,"b":-1},"8":{"a":24000000,"b":-1},"10":{"a":80000000,"b":-1}},"/items/vampirism":{"0":{"a":68000,"b":66000}},"/items/verdant_alembic":{"0":{"a":20000,"b":15500},"2":{"a":38000,"b":-1}},"/items/verdant_boots":{"0":{"a":12000,"b":11500},"1":{"a":68000,"b":-1}},"/items/verdant_brush":{"0":{"a":18500,"b":9800},"1":{"a":35000,"b":-1},"2":{"a":66000,"b":-1},"3":{"a":68000,"b":-1},"4":{"a":74000,"b":-1}},"/items/verdant_buckler":{"0":{"a":28000,"b":8600},"1":{"a":22500,"b":-1},"3":{"a":100000,"b":-1},"4":{"a":120000,"b":-1},"5":{"a":390000,"b":-1},"6":{"a":640000,"b":-1},"7":{"a":780000,"b":-1}},"/items/verdant_bulwark":{"0":{"a":23500,"b":18500},"2":{"a":20000,"b":-1},"3":{"a":10000000,"b":-1}},"/items/verdant_cheese":{"0":{"a":660,"b":640}},"/items/verdant_chisel":{"0":{"a":18500,"b":14500}},"/items/verdant_enhancer":{"0":{"a":19000,"b":16000},"2":{"a":25500,"b":-1},"4":{"a":68000,"b":-1},"5":{"a":135000,"b":-1}},"/items/verdant_gauntlets":{"0":{"a":12000,"b":11500},"1":{"a":98000,"b":-1},"2":{"a":20000,"b":-1},"5":{"a":80000,"b":-1}},"/items/verdant_hammer":{"0":{"a":19500,"b":15500}},"/items/verdant_hatchet":{"0":{"a":17500,"b":9800},"4":{"a":70000,"b":-1}},"/items/verdant_helmet":{"0":{"a":15500,"b":14000},"2":{"a":100000,"b":-1}},"/items/verdant_mace":{"0":{"a":20500,"b":19500},"1":{"a":-1,"b":740},"4":{"a":17000,"b":720},"5":{"a":300000,"b":-1}},"/items/verdant_milk":{"0":{"a":135,"b":130}},"/items/verdant_needle":{"0":{"a":18000,"b":16500}},"/items/verdant_plate_body":{"0":{"a":23500,"b":21500}},"/items/verdant_plate_legs":{"0":{"a":19500,"b":18500},"2":{"a":25000000,"b":-1},"5":{"a":1100000,"b":-1}},"/items/verdant_pot":{"0":{"a":20000,"b":18000},"1":{"a":160000,"b":-1},"2":{"a":300000,"b":-1}},"/items/verdant_shears":{"0":{"a":20500,"b":16500},"1":{"a":58000,"b":-1}},"/items/verdant_spatula":{"0":{"a":20000,"b":10000},"3":{"a":560000,"b":560}},"/items/verdant_spear":{"0":{"a":20500,"b":19500},"1":{"a":50000,"b":-1},"2":{"a":50000,"b":-1},"3":{"a":170000,"b":-1},"5":{"a":125000,"b":-1}},"/items/verdant_sword":{"0":{"a":20500,"b":19000},"1":{"a":5600000,"b":-1},"2":{"a":40000,"b":-1},"3":{"a":300000,"b":-1},"4":{"a":200000,"b":-1},"5":{"a":100000,"b":-1}},"/items/vision_helmet":{"0":{"a":520000,"b":500000},"1":{"a":600000,"b":-1},"3":{"a":640000,"b":-1},"4":{"a":1050000,"b":105000},"5":{"a":1250000,"b":160000},"6":{"a":1500000,"b":300000},"7":{"a":3000000,"b":420000},"8":{"a":7000000,"b":1550000},"9":{"a":-1,"b":2500000}},"/items/vision_shield":{"0":{"a":1700000,"b":1600000},"2":{"a":-1,"b":1600000},"4":{"a":-1,"b":100000},"5":{"a":3000000,"b":100000},"6":{"a":-1,"b":100000},"7":{"a":-1,"b":100000},"8":{"a":7800000,"b":100000}},"/items/watchful_relic":{"0":{"a":7600000,"b":7200000},"3":{"a":-1,"b":3100000},"5":{"a":10000000,"b":-1},"7":{"a":12000000,"b":1000000},"8":{"a":16000000,"b":12000000},"9":{"a":-1,"b":500000},"10":{"a":-1,"b":1000000}},"/items/water_strike":{"0":{"a":7600,"b":7400}},"/items/werewolf_claw":{"0":{"a":560000,"b":540000}},"/items/werewolf_slasher":{"0":{"a":15500000,"b":10000000},"5":{"a":13500000,"b":11000000},"6":{"a":20000000,"b":11000000},"7":{"a":22000000,"b":16000000},"8":{"a":30000000,"b":25000000},"9":{"a":-1,"b":10000000},"10":{"a":70000000,"b":50000000},"15":{"a":-1,"b":640000000}},"/items/wheat":{"0":{"a":62,"b":60}},"/items/white_key_fragment":{"0":{"a":980000,"b":960000}},"/items/wisdom_coffee":{"0":{"a":1800,"b":1750}},"/items/wisdom_tea":{"0":{"a":980,"b":960}},"/items/wizard_necklace":{"0":{"a":12500000,"b":10500000},"1":{"a":15000000,"b":-1},"2":{"a":21500000,"b":15000000},"3":{"a":26000000,"b":23500000},"4":{"a":54000000,"b":47000000},"5":{"a":105000000,"b":92000000},"10":{"a":-1,"b":280000000}},"/items/woodcutting_essence":{"0":{"a":260,"b":255}},"/items/woodcutting_tea":{"0":{"a":720,"b":560}},"/items/wooden_bow":{"0":{"a":5000,"b":4900},"1":{"a":88000,"b":-1},"2":{"a":150000,"b":-1},"3":{"a":100000,"b":-1},"4":{"a":68000,"b":-1},"5":{"a":250000,"b":-1},"6":{"a":500000000,"b":-1},"20":{"a":-1,"b":5000}},"/items/wooden_crossbow":{"0":{"a":4900,"b":4100},"1":{"a":9200,"b":5000},"2":{"a":20000,"b":9400},"4":{"a":580000,"b":-1},"5":{"a":160000,"b":-1}},"/items/wooden_fire_staff":{"0":{"a":5200,"b":4700},"2":{"a":40000,"b":-1},"4":{"a":14500000,"b":-1}},"/items/wooden_nature_staff":{"0":{"a":5200,"b":4600},"1":{"a":30000,"b":-1},"2":{"a":84000,"b":-1},"3":{"a":98000,"b":-1},"20":{"a":-1,"b":145}},"/items/wooden_shield":{"0":{"a":3900,"b":3400},"1":{"a":10500000,"b":-1},"2":{"a":92000000,"b":-1},"7":{"a":880000,"b":-1},"10":{"a":-1,"b":3100}},"/items/wooden_water_staff":{"0":{"a":6800,"b":4700},"1":{"a":215000,"b":-1},"4":{"a":280000,"b":-1}},"/items/yogurt":{"0":{"a":350,"b":270}}},"timestamp":1760432846}`;

    let isUsingExpiredMarketJson = false;
    let reasonForUsingExpiredMarketJson = "";

    let initData_characterSkills = null;
    let initData_characterItems = null;
    let initData_combatAbilities = null;
    let initData_characterHouseRoomMap = null;
    let initData_actionTypeDrinkSlotsMap = null;
    let initData_actionDetailMap = null;
    let initData_levelExperienceTable = null;
    let initData_itemDetailMap = null;
    let initData_actionCategoryDetailMap = null;
    let initData_abilityDetailMap = null;
    let initData_characterAbilities = null;
    let initData_myMarketListings = null;

    let currentActionsHridList = [];
    let currentEquipmentMap = {};

    if (localStorage.getItem("initClientData")) {
        const obj = localStorageUtil.getInitClientData();
        console.log(obj);
        GM_setValue("init_client_data", JSON.stringify(obj));

        initData_actionDetailMap = obj.actionDetailMap;
        initData_levelExperienceTable = obj.levelExperienceTable;
        initData_itemDetailMap = obj.itemDetailMap;
        initData_actionCategoryDetailMap = obj.actionCategoryDetailMap;
        initData_abilityDetailMap = obj.abilityDetailMap;

        for (const [key, value] of Object.entries(initData_itemDetailMap)) {
            itemEnNameToHridMap[value.name] = key;
        }
    }

    hookWS();

    const currentApiVersion = 2;
    const ApiVersion = localStorage.getItem("MWITools_marketAPI_ApiVersion");
    if (!ApiVersion || parseInt(ApiVersion) < currentApiVersion) {
        console.log("Clearing API cache due to ApiVersion update");
        localStorage.setItem("MWITools_marketAPI_timestamp", JSON.stringify(0));
        localStorage.setItem("MWITools_marketAPI_json", JSON.stringify(null));
        localStorage.setItem("MWITools_marketAPI_ApiVersion", JSON.stringify(currentApiVersion));
    }
    fetchMarketJSON(true);

    function hookWS() {
        const dataProperty = Object.getOwnPropertyDescriptor(MessageEvent.prototype, "data");
        const oriGet = dataProperty.get;

        dataProperty.get = hookedGet;
        Object.defineProperty(MessageEvent.prototype, "data", dataProperty);

        function hookedGet() {
            const socket = this.currentTarget;
            if (!(socket instanceof WebSocket)) {
                return oriGet.call(this);
            }
            if (
                socket.url.indexOf("api.milkywayidle.com/ws") <= -1 &&
                socket.url.indexOf("api-test.milkywayidle.com/ws") <= -1 &&
                socket.url.indexOf("api.milkywayidlecn.com/ws") <= -1 &&
                socket.url.indexOf("api-test.milkywayidlecn.com/ws") <= -1
            ) {
                return oriGet.call(this);
            }

            const message = oriGet.call(this);

            // Several MWI userscripts hook MessageEvent.data. Do not leave a
            // non-configurable own property that prevents the next hook in the
            // chain from reading the same WebSocket message.
            try {
                const ownDataProperty = Object.getOwnPropertyDescriptor(this, "data");
                if (!ownDataProperty || ownDataProperty.configurable) {
                    Object.defineProperty(this, "data", {
                        configurable: true,
                        value: message,
                    });
                }
            } catch (error) {
                // Another userscript may have already locked the property.
                // The parsed message is still safe to process directly.
            }

            return handleMessage(message);
        }
    }

    function handleMessage(message) {
        let obj = JSON.parse(message);
        if (obj && obj.type === "init_character_data") {
            console.log(obj);
            GM_setValue("init_character_data", message);
            GM_setValue("init_character_data_saved_at", Date.now());
            GM_setValue("init_character_data_character_id", String(obj?.character?.id ?? ""));
            // A fresh character snapshot invalidates battle data from an older
            // character or party. The next new_battle packet will repopulate it.
            GM_setValue("new_battle", "");
            GM_setValue("new_battle_saved_at", 0);

            initData_characterSkills = obj.characterSkills;
            initData_characterItems = obj.characterItems;
            initData_characterHouseRoomMap = obj.characterHouseRoomMap;
            initData_actionTypeDrinkSlotsMap = obj.actionTypeDrinkSlotsMap;
            initData_characterAbilities = obj.characterAbilities;
            initData_myMarketListings = obj.myMarketListings;
            initData_combatAbilities = obj.combatUnit.combatAbilities;
            currentActionsHridList = [...obj.characterActions];
            if (settingsMap.totalActionTime.isTrue) {
                showTotalActionTime();
            }
            waitForActionPanelParent();
            if (settingsMap.skillbook.isTrue) {
                waitForItemDict();
            }
            if (settingsMap.ThirdPartyLinks.isTrue) {
                add3rdPartyLinks();
            }
            if (settingsMap.networth.isTrue) {
                calculateNetworth();
            }
            for (const item of obj.characterItems) {
                if (item.itemLocationHrid !== "/item_locations/inventory") {
                    currentEquipmentMap[item.itemLocationHrid] = item;
                }
            }
            if (settingsMap.checkEquipment.isTrue) {
                checkEquipment();
            }
            if (settingsMap.notifiEmptyAction.isTrue) {
                notificate();
            }
            if (settingsMap.fillMarketOrderPrice.isTrue) {
                waitForMarketOrders();
            }
        } else if (obj && obj.type === "init_client_data") {
            console.log(obj);
            GM_setValue("init_client_data", message);

            initData_actionDetailMap = obj.actionDetailMap;
            initData_levelExperienceTable = obj.levelExperienceTable;
            initData_itemDetailMap = obj.itemDetailMap;
            initData_actionCategoryDetailMap = obj.actionCategoryDetailMap;
            initData_abilityDetailMap = obj.abilityDetailMap;

            for (const [key, value] of Object.entries(initData_itemDetailMap)) {
                itemEnNameToHridMap[value.name] = key;
            }
        } else if (obj && obj.type === "actions_updated") {
            for (const action of obj.endCharacterActions) {
                if (action.isDone === false) {
                    currentActionsHridList.push(action);
                } else {
                    currentActionsHridList = currentActionsHridList.filter((o) => {
                        return o.id !== action.id;
                    });
                }
            }
            if (settingsMap.checkEquipment.isTrue) {
                checkEquipment();
            }
            if (settingsMap.notifiEmptyAction.isTrue) {
                setTimeout(notificate, 1000);
            }
            if (settingsMap.showDamage.isTrue) {
                if (currentActionsHridList.length === 0 || !currentActionsHridList[0].actionHrid.startsWith("/actions/combat/")) {
                    // Clear damage statistics panel
                    players = [];
                    monsters = [];
                    monstersHP = [];
                    monstersDamageCounters = [];
                    playersMP = [];
                    startTime = null;
                    endTime = null;
                    totalDuration = 0;
                    totalDamage = new Array(players.length).fill(0);
                    inferredDamage = new Array(players.length).fill(0);
                    unassignedDamage = 0;
                    totalHealing = new Array(players.length).fill(0);
                    healingReceived = new Array(players.length).fill(0);
                    unassignedHealing = 0;
                    totalDamageTaken = new Array(players.length).fill(0);
                    damageTakenHits = new Array(players.length).fill(0);
                    playersHP = [];
                    playersDamageCounters = [];
                    unassignedHitSamples = 0;
                    monsterCounts = {};
                    monsterEvasion = {};
                    monsterHrids = {};
                }
            }
        } else if (obj && obj.type === "action_completed") {
            const action = obj.endCharacterAction;
            if (action.isDone === false) {
                for (const a of currentActionsHridList) {
                    if (a.id === action.id) {
                        a.currentCount = action.currentCount;
                    }
                }
            }
        } else if (obj && obj.type === "battle_unit_fetched") {
            if (settingsMap.battlePanel.isTrue) {
                handleBattleSummary(obj);
            }
        } else if (obj && obj.type === "items_updated" && obj.endCharacterItems) {
            for (const item of obj.endCharacterItems) {
                if (item.itemLocationHrid !== "/item_locations/inventory") {
                    if (item.count === 0) {
                        currentEquipmentMap[item.itemLocationHrid] = null;
                    } else {
                        currentEquipmentMap[item.itemLocationHrid] = item;
                    }
                }
            }
            if (settingsMap.checkEquipment.isTrue) {
                checkEquipment();
            }
        } else if (obj && obj.type === "new_battle") {
            GM_setValue("new_battle", message); // This is the only place to get other party members' equipted consumables.
            GM_setValue("new_battle_saved_at", Date.now());

            if (settingsMap.showDamage.isTrue) {
                const incomingPlayers = Array.isArray(obj.players) ? obj.players : [];
                const isSameRoster =
                    players.length === incomingPlayers.length &&
                    incomingPlayers.every((player, index) => players[index]?.name === player.name);

                if (isSameRoster && startTime && endTime) {
                    totalDuration += (endTime - startTime) / 1000;
                }

                if (!isSameRoster) {
                    // The party can change without leaving combat. Reset the accumulated
                    // statistics so pMap indices always match the current battle roster.
                    totalDuration = 0;
                    totalDamage = new Array(incomingPlayers.length).fill(0);
                    inferredDamage = new Array(incomingPlayers.length).fill(0);
                    unassignedDamage = 0;
                    totalHealing = new Array(incomingPlayers.length).fill(0);
                    healingReceived = new Array(incomingPlayers.length).fill(0);
                    unassignedHealing = 0;
                    totalDamageTaken = new Array(incomingPlayers.length).fill(0);
                    damageTakenHits = new Array(incomingPlayers.length).fill(0);
                    unassignedHitSamples = 0;
                    monsterCounts = {};
                    monsterEvasion = {};
                    monsterHrids = {};
                }

                startTime = Date.now();
                endTime = null;
                monstersHP = obj.monsters.map((monster) => monster.currentHitpoints);
                monstersDamageCounters = obj.monsters.map((monster) =>
                    getPacketCounter(monster.damageSplatCounter, 0)
                );
                playersMP = incomingPlayers.map((player) => player.currentManapoints);
                playersHP = incomingPlayers.map(getUnitCurrentHP);
                playersDamageCounters = incomingPlayers.map((player) =>
                    getPacketCounter(player.damageSplatCounter, 0)
                );
                players = incomingPlayers.map((player, index) => {
                    if (isSameRoster && players[index]?.damageMap) {
                        player.damageMap = players[index].damageMap;
                    }
                    if (isSameRoster && players[index]?.hitMap) {
                        player.hitMap = players[index].hitMap;
                    }
                    if (isSameRoster && players[index]?.healingMap) {
                        player.healingMap = players[index].healingMap;
                    }
                    player.lastAttackCounter = getPacketCounter(
                        player.attackAttemptCounter,
                        0
                    );
                    return player;
                });
                const playerIndices = Object.keys(players);
                playerIndices.forEach((userIndex) => {
                    players[userIndex].currentAction = players[userIndex].preparingAbilityHrid
                        ? players[userIndex].preparingAbilityHrid
                        : players[userIndex].isPreparingAutoAttack
                        ? "auto"
                        : "idle";
                });
                monsters = obj.monsters;
                if (!totalDamage.length) {
                    totalDamage = new Array(players.length).fill(0);
                }
                if (!inferredDamage.length) {
                    inferredDamage = new Array(players.length).fill(0);
                }
                if (!totalHealing.length) {
                    totalHealing = new Array(players.length).fill(0);
                }
                if (!healingReceived.length) {
                    healingReceived = new Array(players.length).fill(0);
                }
                if (!totalDamageTaken.length) {
                    totalDamageTaken = new Array(players.length).fill(0);
                }
                if (!damageTakenHits.length) {
                    damageTakenHits = new Array(players.length).fill(0);
                }
                // Accumulate monster counts and store evasion ratings by combat style
                obj.monsters.forEach((monster) => {
                    const name = monster.name;
                    monsterHrids[name] = monster.hrid;
                    monsterCounts[name] = (monsterCounts[name] || 0) + 1;
                    if (!monsterEvasion[name]) {
                        monsterEvasion[name] = {};
                    }
                    players.forEach((player) => {
                        if (player.combatDetails && player.combatDetails.combatStats.combatStyleHrids) {
                            player.combatDetails.combatStats.combatStyleHrids.forEach((styleHrid) => {
                                const style = styleHrid.split("/").pop(); // Get the combat style (e.g., "ranged")
                                const evasionRating = monster.combatDetails[`${style}EvasionRating`];
                                monsterEvasion[name][player.name + "-" + style] = evasionRating;
                            });
                        }
                    });
                });
            }
        } else if (obj && (obj.type === "new_guild_battle" || obj.type === "guild_battle_new")) {
            if (settingsMap.showDamage.isTrue) {
                handleGuildBattleNew(obj);
            }
        } else if (obj && obj.type === "guild_battle_updated") {
            if (settingsMap.showDamage.isTrue) {
                handleGuildBattleUpdated(obj);
            }
        } else if (obj && (obj.type === "end_guild_battle" || obj.type === "guild_battle_end")) {
            if (settingsMap.showDamage.isTrue) {
                handleGuildBattleEnd();
            }
        } else if (obj && obj.type === "profile_shared") {
            let profileExportListString = GM_getValue("profile_export_list", null);
            let profileExportList = null;
            // Remove invalid
            // GM_setValue("profile_export_list", JSON.stringify(new Array())); // Remove stored profiles. Only for testing.
            if (profileExportListString) {
                profileExportList = JSON.parse(profileExportListString);
                if (!profileExportList || !profileExportList.filter) {
                    console.error("Found invalid profileExportList in store. profileExportList cleared.");
                    GM_setValue("profile_export_list", JSON.stringify(new Array()));
                }
            } else {
                GM_setValue("profile_export_list", JSON.stringify(new Array()));
            }

            obj.characterID = obj.profile.characterSkills[0].characterID;
            obj.characterName = obj.profile.sharableCharacter.name;
            obj.timestamp = Date.now();

            profileExportListString = GM_getValue("profile_export_list", null) || JSON.stringify(new Array());
            profileExportList = JSON.parse(profileExportListString);
            profileExportList = profileExportList.filter((item) => item.characterID !== obj.characterID);
            profileExportList.unshift(obj);
            if (profileExportList.length > 20) {
                profileExportList.pop();
            }
            // console.log(profileExportList);
            GM_setValue("profile_export_list", JSON.stringify(profileExportList));

            addExportButton(obj);

            if (settingsMap.profileBuildScore.isTrue) {
                showBuildScoreOnProfile(obj);
            }
        } else if (obj && obj.type === "battle_updated" && monstersHP.length) {
            if (settingsMap.showDamage.isTrue) {
                const mMap = obj.mMap || {};
                const pMap = obj.pMap || {};
                const playerIndices = Object.keys(pMap).filter(
                    (userIndex) => players[userIndex] && pMap[userIndex]
                );

                // Decide which player cast a spell by MP decrease.
                const castPlayers = [];
                const completedAttackSamples = [];
                playerIndices.forEach((userIndex) => {
                    const update = pMap[userIndex];
                    const previousAttackCounter = getPacketCounter(
                        players[userIndex].lastAttackCounter,
                        getPacketCounter(update.atkCounter, 0)
                    );
                    const currentAttackCounter = getPacketCounter(
                        update.atkCounter,
                        previousAttackCounter
                    );
                    const attackDelta = Math.max(
                        0,
                        currentAttackCounter - previousAttackCounter
                    );
                    if (attackDelta === 1) {
                        completedAttackSamples.push({
                            index: userIndex,
                            action: players[userIndex].currentAction || "unknown",
                        });
                    } else if (attackDelta > 1) {
                        unassignedHitSamples += attackDelta;
                    }
                    players[userIndex].lastAttackCounter = currentAttackCounter;

                    if (
                        Number.isFinite(update.cMP) &&
                        Number.isFinite(playersMP[userIndex]) &&
                        update.cMP < playersMP[userIndex]
                    ) {
                        castPlayers.push(userIndex);
                    }
                    if (Number.isFinite(update.cMP)) {
                        playersMP[userIndex] = update.cMP;
                    }
                    if (!Number.isFinite(totalDamage[userIndex])) {
                        totalDamage[userIndex] = 0;
                    }
                    if (!Number.isFinite(inferredDamage[userIndex])) {
                        inferredDamage[userIndex] = 0;
                    }
                });

                const damageSourcePlayers =
                    completedAttackSamples.length === 1
                        ? [completedAttackSamples[0].index]
                        : castPlayers;
                let packetResolvedTargets = 0;
                let packetHitTargets = 0;
                monstersHP.forEach((mHP, mIndex) => {
                    const monster = mMap[mIndex];
                    if (monster) {
                        const hpDiff = mHP - monster.cHP;
                        monstersHP[mIndex] = monster.cHP;
                        const previousDamageCounter = getPacketCounter(
                            monstersDamageCounters[mIndex],
                            0
                        );
                        const hasDamageCounter = Number.isFinite(
                            Number(monster.dmgCounter)
                        );
                        const currentDamageCounter = getPacketCounter(
                            monster.dmgCounter,
                            previousDamageCounter
                        );
                        const damageCounterDelta = Math.max(
                            0,
                            currentDamageCounter - previousDamageCounter
                        );
                        monstersDamageCounters[mIndex] = currentDamageCounter;
                        const targetResolved = hasDamageCounter
                            ? damageCounterDelta > 0
                            : hpDiff > 0;
                        if (targetResolved) {
                            packetResolvedTargets += 1;
                            if (hpDiff > 0) packetHitTargets += 1;
                        }
                        if (hpDiff > 0) {
                            if (playerIndices.length > 1) {
                                if (damageSourcePlayers.length === 1) {
                                    recordDamageForState(
                                        getPartyDamageStats(),
                                        damageSourcePlayers[0],
                                        hpDiff,
                                        true
                                    );
                                } else {
                                    unassignedDamage += hpDiff;
                                }
                            } else if (playerIndices.length === 1) {
                                recordDamageForState(
                                    getPartyDamageStats(),
                                    playerIndices[0],
                                    hpDiff,
                                    false
                                );
                            } else {
                                unassignedDamage += hpDiff;
                            }
                        }
                    }
                });

                if (completedAttackSamples.length === 1) {
                    const sample = completedAttackSamples[0];
                    const recorded = recordPacketHitSample(
                        getPartyDamageStats(),
                        sample.index,
                        sample.action,
                        packetResolvedTargets,
                        packetHitTargets
                    );
                    if (!recorded && isDamageActionForHitTracking(players[sample.index], sample.action)) {
                        unassignedHitSamples += 1;
                    }
                } else if (completedAttackSamples.length > 1) {
                    unassignedHitSamples += completedAttackSamples.length;
                }

                recordPlayerHealthChangesForState(
                    getPartyDamageStats(),
                    pMap,
                    completedAttackSamples
                );

                playerIndices.forEach((userIndex) => {
                    players[userIndex].currentAction = pMap[userIndex].abilityHrid
                        ? pMap[userIndex].abilityHrid
                        : pMap[userIndex].isAutoAtk
                        ? "auto"
                        : "idle";
                });
                endTime = Date.now();
                if (!isGuildStatisticsViewActive()) {
                    updateStatisticsPanel(getPartyDamageStats());
                }
            }
        }
        return message;
    }

    /* 計算Networth */
    async function calculateNetworth() {
        const marketAPIJson = await fetchMarketJSON();
        if (!marketAPIJson) {
            console.error("calculateNetworth marketAPIJson is null");
            return;
        }

        let networthAsk = 0;
        let networthBid = 0;
        let marketListingsNetworthAsk = 0;
        let marketListingsNetworthBid = 0;
        let equippedNetworthAsk = 0;
        let equippedNetworthBid = 0;
        let inventoryNetworthAsk = 0;
        let inventoryNetworthBid = 0;

        for (const item of initData_characterItems) {
            const enhanceLevel = item.enhancementLevel;
            const marketPrices = marketAPIJson.marketData[item.itemHrid];

            if (enhanceLevel && enhanceLevel > 1) {
                input_data.item_hrid = item.itemHrid;
                input_data.stop_at = enhanceLevel;
                const best = await findBestEnhanceStratWithPhiMirror(input_data);
                let totalCost = best?.totalCost;
                totalCost = totalCost ? Math.round(totalCost) : 0;
                if (item.itemLocationHrid !== "/item_locations/inventory") {
                    equippedNetworthAsk += item.count * (totalCost > 0 ? totalCost : 0);
                    equippedNetworthBid += item.count * (totalCost > 0 ? totalCost : 0);
                } else {
                    inventoryNetworthAsk += item.count * (totalCost > 0 ? totalCost : 0);
                    inventoryNetworthBid += item.count * (totalCost > 0 ? totalCost : 0);
                }
            } else if (marketPrices && marketPrices[0]) {
                if (item.itemLocationHrid !== "/item_locations/inventory") {
                    equippedNetworthAsk += item.count * (marketPrices[0].a > 0 ? marketPrices[0].a : 0);
                    equippedNetworthBid += item.count * (marketPrices[0].b > 0 ? marketPrices[0].b : 0);
                } else {
                    inventoryNetworthAsk += item.count * (marketPrices[0].a > 0 ? marketPrices[0].a : 0);
                    inventoryNetworthBid += item.count * (marketPrices[0].b > 0 ? marketPrices[0].b : 0);
                }
            } else {
                console.log("calculateNetworth cannot find price of " + item.itemHrid);
            }
        }

        for (const item of initData_myMarketListings) {
            const quantity = item.orderQuantity - item.filledQuantity;
            const enhancementLevel = item.enhancementLevel;
            const marketPrices = marketAPIJson.marketData[item.itemHrid];
            if (!marketPrices) {
                console.log("calculateNetworth cannot get marketPrices of " + item.itemHrid);
                continue;
            }
            let askPrice = marketPrices[0]?.a ?? 0;
            let bidPrice = marketPrices[0]?.b ?? 0;
            if (item.isSell) {
                if (item.itemHrid === "/items/bag_of_10_cowbells") {
                    askPrice *= 1 - 18 / 100;
                    bidPrice *= 1 - 18 / 100;
                } else {
                    askPrice *= 1 - 2 / 100;
                    bidPrice *= 1 - 2 / 100;
                }
                if (!enhancementLevel || enhancementLevel <= 1) {
                    marketListingsNetworthAsk += quantity * (askPrice > 0 ? askPrice : 0);
                    marketListingsNetworthBid += quantity * (bidPrice > 0 ? bidPrice : 0);
                } else {
                    input_data.item_hrid = item.itemHrid;
                    input_data.stop_at = enhancementLevel;
                    const best = await findBestEnhanceStratWithPhiMirror(input_data);
                    let totalCost = best?.totalCost;
                    totalCost = totalCost ? Math.round(totalCost) : 0;
                    marketListingsNetworthAsk += quantity * (totalCost > 0 ? totalCost : 0);
                    marketListingsNetworthBid += quantity * (totalCost > 0 ? totalCost : 0);
                }
                marketListingsNetworthAsk += item.unclaimedCoinCount;
                marketListingsNetworthBid += item.unclaimedCoinCount;
            } else {
                marketListingsNetworthAsk += quantity * item.price;
                marketListingsNetworthBid += quantity * item.price;
                marketListingsNetworthAsk += item.unclaimedItemCount * (askPrice > 0 ? askPrice : 0);
                marketListingsNetworthBid += item.unclaimedItemCount * (bidPrice > 0 ? bidPrice : 0);
            }
        }

        networthAsk = equippedNetworthAsk + inventoryNetworthAsk + marketListingsNetworthAsk;
        networthBid = equippedNetworthBid + inventoryNetworthBid + marketListingsNetworthBid;

        /* 倉庫搜尋欄下方顯示人物總結 */
        // Some code of networth summery is by Stella.
        const addInventorySummery = async (invElem) => {
            const [battleHouseScore, nonBattleHouseScore, abilityScore, allAbilityScore, equipmentScore] = await getSelfBuildScores(
                equippedNetworthAsk * 0.5 + equippedNetworthBid * 0.5
            );
            const totalScore = battleHouseScore + abilityScore + equipmentScore;
            const totalHouseScore = battleHouseScore + nonBattleHouseScore;
            const totalNetworth = networthAsk * 0.5 + networthBid * 0.5 + (totalHouseScore + allAbilityScore) * 1000000;

            invElem.insertAdjacentHTML(
                "beforebegin",
                `<div style="text-align: left; color: ${SCRIPT_COLOR_MAIN}; font-size: 0.875rem;">
                    <!-- 戰力打造分 -->
                    <div style="cursor: pointer; font-weight: bold" id="toggleScores">${
                        isZH ? "+ 戰力打造分: " : "+ Character Build Score: "
                    }${totalScore.toFixed(1)}</div>
                    <div id="buildScores" style="display: none; margin-left: 20px;">
                            <div>${isZH ? "房子分：" : "House score: "}${battleHouseScore.toFixed(1)}</div>
                            <div>${isZH ? "技能分：" : "Ability score: "}${abilityScore.toFixed(1)}</div>
                            <div>${isZH ? "裝備分：" : "Equipment score: "}${equipmentScore.toFixed(1)}</div>
                    </div>

                    <!-- 總NetWorth -->
                    <div style="cursor: pointer; font-weight: bold;" id="toggleNetWorth">
                        ${isZH ? "+ 總NetWorth：" : "+ Total NetWorth: "}${numberFormatter(totalNetworth)}
                    </div>

                    <div id="netWorthDetails" style="display: none; margin-left: 20px;">
                        <!-- 流動資產 -->
                        <div style="cursor: pointer;" id="toggleCurrentAssets">
                            ${isZH ? "+ 流動資產價值" : "+ Current assets value"}
                        </div>
                        <div id="currentAssets" style="display: none; margin-left: 20px;">
                            <div>${isZH ? "裝備價值：" : "Equipment value: "}${numberFormatter(equippedNetworthAsk)}</div>
                            <div>${isZH ? "庫存價值：" : "Inventory value: "}${numberFormatter(inventoryNetworthAsk)}</div>
                            <div>${isZH ? "訂單價值：" : "Market listing value: "}${numberFormatter(marketListingsNetworthAsk)}</div>
                        </div>

                        <!-- 非流動資產 -->
                        <div style="cursor: pointer;" id="toggleNonCurrentAssets">
                            ${isZH ? "+ 非流動資產價值" : "+ Fixed assets value"}
                        </div>
                        <div id="nonCurrentAssets" style="display: none; margin-left: 20px;">
                            <div>${isZH ? "房子價值：" : "Houses value: "}${numberFormatter(totalHouseScore * 1000000)}</div>
                            <div>${isZH ? "技能價值：" : "Abilities value: "}${numberFormatter(allAbilityScore * 1000000)}</div>
                        </div>
                    </div>
                </div>`
            );

            // 監聽點選事件，控制摺疊和展開
            const toggleScores = document.getElementById("toggleScores");
            const ScoreDetails = document.getElementById("buildScores");
            const toggleButton = document.getElementById("toggleNetWorth");
            const netWorthDetails = document.getElementById("netWorthDetails");
            const toggleCurrentAssets = document.getElementById("toggleCurrentAssets");
            const currentAssets = document.getElementById("currentAssets");
            const toggleNonCurrentAssets = document.getElementById("toggleNonCurrentAssets");
            const nonCurrentAssets = document.getElementById("nonCurrentAssets");

            toggleScores.addEventListener("click", () => {
                const isCollapsed = ScoreDetails.style.display === "none";
                ScoreDetails.style.display = isCollapsed ? "block" : "none";
                toggleScores.textContent = (isCollapsed ? "↓ " : "+ ") + (isZH ? "戰力打造分: " : "Character Build Score: ") + totalScore.toFixed(1);
            });

            toggleButton.addEventListener("click", () => {
                const isCollapsed = netWorthDetails.style.display === "none";
                netWorthDetails.style.display = isCollapsed ? "block" : "none";
                toggleButton.textContent =
                    (isCollapsed ? "↓ " : "+ ") + (isZH ? "總NetWorth：" : "Total NetWorth: ") + numberFormatter(totalNetworth);
                currentAssets.style.display = isCollapsed ? "block" : "none";
                toggleCurrentAssets.textContent = (isCollapsed ? "↓ " : "+ ") + (isZH ? "流動資產價值" : "Current assets value");
                nonCurrentAssets.style.display = isCollapsed ? "block" : "none";
                toggleNonCurrentAssets.textContent = (isCollapsed ? "↓ " : "+ ") + (isZH ? "非流動資產價值" : "Fixed assets value");
            });

            toggleCurrentAssets.addEventListener("click", () => {
                const isCollapsed = currentAssets.style.display === "none";
                currentAssets.style.display = isCollapsed ? "block" : "none";
                toggleCurrentAssets.textContent = (isCollapsed ? "↓ " : "+ ") + (isZH ? "流動資產價值" : "Current assets value");
            });

            toggleNonCurrentAssets.addEventListener("click", () => {
                const isCollapsed = nonCurrentAssets.style.display === "none";
                nonCurrentAssets.style.display = isCollapsed ? "block" : "none";
                toggleNonCurrentAssets.textContent = (isCollapsed ? "↓ " : "+ ") + (isZH ? "非流動資產價值" : "Fixed assets value");
            });
        };

        const waitForHeader = () => {
            const targetNode = document.querySelector("div.Header_totalLevel__8LY3Q");
            if (targetNode) {
                targetNode.insertAdjacentHTML(
                    "afterend",
                    `<div style="font-size: 0.875rem; font-weight: 500; color: ${SCRIPT_COLOR_MAIN}; text-wrap: nowrap;">Current Assets: ${numberFormatter(
                        networthAsk
                    )} / ${numberFormatter(networthBid)}${`<div id="script_api_fail_alert" style="color: ${SCRIPT_COLOR_ALERT};">${
                        isZH ? "無法從API更新市場資料" : "Can't update market prices"
                    }</div>`}</div>`
                );

                const alertDiv = document.querySelector("div#script_api_fail_alert");
                if (alertDiv) {
                    alertDiv.style.cursor = "pointer";
                    alertDiv.addEventListener("click", () => {
                        showApiFailAlertPopup();
                    });

                    if (isUsingExpiredMarketJson && settingsMap.networkAlert.isTrue) {
                        alertDiv.style.display = "block";
                    } else {
                        alertDiv.style.display = "none";
                    }
                }

                document.body.insertAdjacentHTML(
                    "beforeend",
                    `<div id="script_api_fail_popout" style="display: none; position: absolute; top: 50px; left: 0; padding: 10px; background: white; border: 1px solid black; box-shadow: 2px 2px 10px rgba(0, 0, 0, 0.2); border-radius: 8px; white-space: pre-wrap;"></div>`
                );

                const popout = document.querySelector("#script_api_fail_popout");
                if (popout) {
                    popout.addEventListener("click", function () {
                        const popout = document.querySelector("#script_api_fail_popout");
                        popout.style.display = popout.style.display === "block" ? "none" : "block";
                    });
                }
            } else {
                setTimeout(waitForHeader, 200);
            }
        };
        waitForHeader();

        function showApiFailAlertPopup() {
            console.log(reasonForUsingExpiredMarketJson);
            const popout = document.querySelector("#script_api_fail_popout");
            if (popout) {
                popout.textContent = reasonForUsingExpiredMarketJson;
                popout.style.display = "block";
            }
        }

        const waitForInv = () => {
            const targetNodes = document.querySelectorAll("div.Inventory_items__6SXv0");
            for (const node of targetNodes) {
                if (settingsMap.invWorth.isTrue) {
                    if (!node.classList.contains("script_buildScore_added")) {
                        node.classList.add("script_buildScore_added");
                        addInventorySummery(node);
                    }
                }
                if (settingsMap.invSort.isTrue) {
                    if (!node.classList.contains("script_invSort_added")) {
                        node.classList.add("script_invSort_added");
                        addInvSortButton(node);
                    }
                }
            }
            setTimeout(waitForInv, 1000);
        };
        waitForInv();
    }

    /* 倉庫物品排序 */
    // by daluo, bot7420
    async function addInvSortButton(invElem) {
        const price_data = await fetchMarketJSON();
        if (!price_data || !price_data.marketData) {
            console.error("addInvSortButton fetchMarketJSON null");
            return;
        }

        const askButton = `<button
            id="script_sortByAsk_btn"
            style="border-radius: 3px; background-color: ${SCRIPT_COLOR_MAIN}; color: black;">
            ${isZH ? "出售價" : "Ask"}
            </button>`;
        const bidButton = `<button
            id="script_sortByBid_btn"
            style="border-radius: 3px; background-color: ${SCRIPT_COLOR_MAIN}; color: black;">
            ${isZH ? "收購價" : "Bid"}
            </button>`;
        const noneButton = `<button
            id="script_sortByNone_btn"
            style="border-radius: 3px; background-color: ${SCRIPT_COLOR_MAIN}; color: black;">
            ${isZH ? "無" : "None"}
            </button>`;
        const buttonsDiv = `<div style="color: ${SCRIPT_COLOR_MAIN}; font-size: 0.875rem; text-align: left; ">${
            isZH ? "物品排序：" : "Sort items by: "
        }${askButton} ${bidButton} ${noneButton}</div>`;
        invElem.insertAdjacentHTML("beforebegin", buttonsDiv);

        invElem.parentElement.querySelector("button#script_sortByAsk_btn").addEventListener("click", function (e) {
            sortItemsBy("ask");
        });
        invElem.parentElement.querySelector("button#script_sortByBid_btn").addEventListener("click", function (e) {
            sortItemsBy("bid");
        });
        invElem.parentElement.querySelector("button#script_sortByNone_btn").addEventListener("click", function (e) {
            sortItemsBy("none");
        });

        const sortItemsBy = (order) => {
            for (const typeDiv of invElem.children) {
                const typeName = getOriTextFromElement(typeDiv.getElementsByClassName("Inventory_categoryButton__35s1x")[0]);
                const notNeedSortTypes = ["Loots", "Currencies", "Equipment"];
                if (notNeedSortTypes.includes(typeName)) {
                    continue;
                }

                typeDiv.querySelector(".Inventory_label__XEOAx").style.order = Number.MIN_SAFE_INTEGER;

                const itemElems = typeDiv.querySelectorAll(".Item_itemContainer__x7kH1");
                for (const itemElem of itemElems) {
                    let itemName = itemElem.querySelector("svg").attributes["aria-label"].value;
                    if (isZHInGameSetting) {
                        itemName = getItemEnNameFromZhName(itemName);
                    }
                    const itemHrid = itemEnNameToHridMap[itemName];
                    let itemCount = itemElem.querySelector(".Item_count__1HVvv").innerText;
                    itemCount = Number(itemCount.toLowerCase().replaceAll("k", "000").replaceAll("m", "000000"));
                    let askPrice = 0;
                    if (price_data.marketData[itemHrid] && price_data.marketData[itemHrid][0])
                        askPrice = price_data.marketData[itemHrid][0].a;
                    let bidPrice = 0;
                    if (price_data.marketData[itemHrid] && price_data.marketData[itemHrid][0])
                        bidPrice = price_data.marketData[itemHrid][0].b;
                    const itemAskmWorth = askPrice * itemCount;
                    const itemBidWorth = bidPrice * itemCount;

                    // 價格角標
                    if (!itemElem.querySelector("#script_stack_price")) {
                        itemElem.style.position = "relative";
                        const priceElemHTML = `<div
                            id="script_stack_price"
                            style="z-index: 1; position: absolute; top: 2px; left: 2px; text-align: left;">
                        </div>`;
                        itemElem.querySelector(".Item_item__2De2O.Item_clickable__3viV6").insertAdjacentHTML("beforeend", priceElemHTML);
                    }
                    const priceElem = itemElem.querySelector("#script_stack_price");

                    // 排序
                    if (order === "ask") {
                        itemElem.style.order = -itemAskmWorth;
                        priceElem.textContent = numberFormatter(itemAskmWorth);
                    } else if (order === "bid") {
                        itemElem.style.order = -itemBidWorth;
                        priceElem.textContent = numberFormatter(itemBidWorth);
                    } else if (order === "none") {
                        itemElem.style.order = 0;
                        priceElem.textContent = "";
                    }
                }
            }
        };
    }

    /* 計算打造分 */
    // BuildScore algorithm by Ratatatata (https://greasyfork.org/zh-CN/scripts/511240)
    async function getSelfBuildScores(equippedNetworth) {
        // 房子分：戰鬥相關房子升級所需總金幣
        const battleHouses = ["dining_room", "library", "dojo", "gym", "armory", "archery_range", "mystical_study"];
        let battleHouseScore = 0;
        let nonBattleHouseScore = 0;
        for (const key in initData_characterHouseRoomMap) {
            if (battleHouses.some((house) => initData_characterHouseRoomMap[key].houseRoomHrid.includes(house))) {
                battleHouseScore += (await getHouseFullBuildPrice(initData_characterHouseRoomMap[key])) / 1000000;
            } else {
                nonBattleHouseScore += (await getHouseFullBuildPrice(initData_characterHouseRoomMap[key])) / 1000000;
            }
        }

        // 技能分：當前使用的戰鬥技能所需技能書總價，單位M
        let abilityScore = 0;
        try {
            abilityScore = await calculateAbilityScore();
        } catch (error) {
            console.error("Error in calculateAbilityScore()", error);
        }
        // console.log("abilityScore " + abilityScore);

        // 總技能分：全部已學技能所需技能書總價，單位M
        let allAbilityScore = 0;
        try {
            allAbilityScore = await calculateAbilityScore(true);
        } catch (error) {
            console.error("Error in calculateAbilityScore(true)", error);
        }
        // console.log("allAbilityScore " + allAbilityScore);

        // 裝備分：當前身上裝備總價，單位M
        let equipmentScore = equippedNetworth / 1000000;
        // console.log("equipmentScore " + equipmentScore);

        return [battleHouseScore, nonBattleHouseScore, abilityScore, allAbilityScore, equipmentScore];
    }

    // 計算單個房子完整造價
    async function getHouseFullBuildPrice(house) {
        const marketAPIJson = await fetchMarketJSON();
        if (!marketAPIJson) {
            return 0;
        }
        const clientObj = JSON.parse(GM_getValue("init_client_data", ""));

        const upgradeCostsMap = clientObj.houseRoomDetailMap[house.houseRoomHrid].upgradeCostsMap;
        const level = house.level;

        let cost = 0;
        for (let i = 1; i <= level; i++) {
            for (const item of upgradeCostsMap[i]) {
                const marketPrices = marketAPIJson.marketData[item.itemHrid];
                if (marketPrices && marketPrices[0]) {
                    cost += item.count * getWeightedMarketPrice(marketPrices);
                } else {
                    console.log("getHouseFullBuildPrice cannot find price of " + item.itemHrid);
                }
            }
        }
        return cost;
    }

    function getWeightedMarketPrice(marketPrices, ratio = 0.5) {
        let ask = marketPrices[0].a;
        let bid = marketPrices[0].b;
        if (ask > 0 && bid < 0) {
            bid = ask;
        }
        if (bid > 0 && ask < 0) {
            ask = bid;
        }
        const weightedPrice = ask * ratio + bid * (1 - ratio);
        return weightedPrice;
    }

    // 技能價格計算
    async function calculateAbilityScore(isAll = false) {
        const marketAPIJson = await fetchMarketJSON();
        if (!marketAPIJson) {
            return 0;
        }
        let exp_50_skill = ["poke", "scratch", "smack", "quick_shot", "water_strike", "fireball", "entangle", "minor_heal"];
        const getNeedBooksToLevel = (targetLevel, abilityPerBookExp) => {
            const needExp = initData_levelExperienceTable[targetLevel];
            let needBooks = needExp / abilityPerBookExp;
            needBooks += 1;
            return needBooks.toFixed(1);
        };
        // 技能淨值
        let price = 0;
        const abilities = isAll ? initData_characterAbilities : initData_combatAbilities;
        abilities.forEach((item) => {
            let numBooks = 0;
            if (exp_50_skill.some((skill) => item.abilityHrid.includes(skill))) {
                numBooks = getNeedBooksToLevel(item.level, 50);
            } else {
                numBooks = getNeedBooksToLevel(item.level, 500);
            }
            const itemHrid = item.abilityHrid.replace("/abilities/", "/items/");
            const marketPrices = marketAPIJson.marketData[itemHrid];
            if (marketPrices && marketPrices[0]) {
                price += numBooks * getWeightedMarketPrice(marketPrices);
            } else {
                console.log("calculateAbilityScore cannot find price of " + itemHrid);
            }
            // console.log(`技能:${itemHrid},價值${numBooks * (marketPrices[0].b > 0 ? marketPrices[0].b : 0)}`)
        });

        return (price /= 1000000);
    }

    /* 檢視人物面板顯示打造分 */
    // by Ratatatata (https://greasyfork.org/zh-CN/scripts/511240)
    function getInfoPanel() {
        const selectedElement = document.querySelector(`div.SharableProfile_overviewTab__W4dCV`);
        if (selectedElement) {
            return selectedElement;
        } else {
            return new Promise((resolve) => {
                setTimeout(() => resolve(getInfoPanel()), 500);
            });
        }
    }

    async function showBuildScoreOnProfile(profile_shared_obj) {
        const [battleHouseScore, abilityScore, equipmentScore] = await getBuildScoreByProfile(profile_shared_obj);
        const totalBuildScore = battleHouseScore + abilityScore + equipmentScore;
        const isEquipmentHiddenText = abilityScore + equipmentScore <= 0 ? (isZH ? " (裝備隱藏)" : " (Equipment hidden)") : " ";

        const panel = await getInfoPanel();
        panel.style.height = "auto";
        panel.insertAdjacentHTML(
            "beforeend",
            `<div style="text-align: left; color: ${SCRIPT_COLOR_MAIN}; font-size: 0.875rem;">
                <div style="cursor: pointer; font-weight: bold" id="toggleScores_profile">${
                    isZH ? "+ 戰力打造分: " : "+ Character Build Score: "
                }${totalBuildScore.toFixed(1)}${isEquipmentHiddenText}</div>
                <div id="buildScores_profile" style="display: none; margin-left: 20px;">
                        <div>${isZH ? "房子分：" : "House score: "}${battleHouseScore.toFixed(1)}</div>
                        <div>${isZH ? "技能分：" : "Ability score: "}${abilityScore.toFixed(1)}</div>
                        <div>${isZH ? "裝備分：" : "Equipment score: "}${equipmentScore.toFixed(1)}</div>
                </div>
            </div>`
        );
        // 監聽點選事件，控制摺疊和展開
        const toggleScores = document.getElementById("toggleScores_profile");
        const ScoreDetails = document.getElementById("buildScores_profile");
        toggleScores.addEventListener("click", () => {
            const isCollapsed = ScoreDetails.style.display === "none";
            ScoreDetails.style.display = isCollapsed ? "block" : "none";
            toggleScores.textContent =
                (isCollapsed ? "↓ " : "+ ") +
                (isZH ? "戰力打造分: " : "Character Build Score: ") +
                totalBuildScore.toFixed(1) +
                isEquipmentHiddenText;
        });
    }

    // 計算打造分
    async function getBuildScoreByProfile(profile_shared_obj) {
        // 房子分：戰鬥相關房子升級所需總金幣
        const battleHouses = ["dining_room", "library", "dojo", "gym", "armory", "archery_range", "mystical_study"];
        let battleHouseScore = 0;
        for (const key in profile_shared_obj.profile.characterHouseRoomMap) {
            if (battleHouses.some((house) => profile_shared_obj.profile.characterHouseRoomMap[key].houseRoomHrid.includes(house))) {
                battleHouseScore += (await getHouseFullBuildPrice(profile_shared_obj.profile.characterHouseRoomMap[key])) / 1000000;
            }
        }
        // console.log("房屋分：" + battleHouseScore);
        if (profile_shared_obj.profile.hideWearableItems) {
            // 對方未展示裝備
            return [battleHouseScore, 0, 0];
        }

        // 技能分：當前使用的戰鬥技能所需技能書總價，單位M
        let abilityScore = 0;
        try {
            abilityScore = await calculateSkill(profile_shared_obj);
            // console.log("技能分：" + abilityScore);
        } catch (error) {
            console.error("Error in calculate skill:", error);
        }

        // 裝備分：當前身上裝備總價，單位M
        let equipmentScore = 0;
        try {
            equipmentScore = await calculateEquipment(profile_shared_obj);
            // console.log("裝備分：" + equipmentScore);
        } catch (error) {
            console.error("Error in calculateEquipmen:", error);
        }

        return [battleHouseScore, abilityScore, equipmentScore];
    }

    // 技能價格計算
    async function calculateSkill(profile_shared_obj) {
        const marketAPIJson = await fetchMarketJSON();
        if (!marketAPIJson) {
            return 0;
        }
        let obj = profile_shared_obj.profile;
        let exp_50_skill = ["poke", "scratch", "smack", "quick_shot", "water_strike", "fireball", "entangle", "minor_heal"];
        const getNeedBooksToLevel = (targetLevel, abilityPerBookExp) => {
            const needExp = initData_levelExperienceTable[targetLevel];
            let needBooks = needExp / abilityPerBookExp;
            needBooks += 1;
            return needBooks.toFixed(1);
        };
        // 技能淨值
        let price = 0;
        obj.equippedAbilities.forEach((item) => {
            let numBooks = 0;
            if (exp_50_skill.some((skill) => item.abilityHrid.includes(skill))) {
                numBooks = getNeedBooksToLevel(item.level, 50);
            } else {
                numBooks = getNeedBooksToLevel(item.level, 500);
            }
            const itemHrid = item.abilityHrid.replace("/abilities/", "/items/");
            const marketPrices = marketAPIJson.marketData[itemHrid];
            if (marketPrices && marketPrices[0]) {
                price += numBooks * getWeightedMarketPrice(marketPrices);
            } else {
                console.log("calculateSkill cannot find price of " + itemHrid);
            }
            // console.log(`技能:${itemHrid},價值${numBooks * (marketPrices[0].b > 0 ? marketPrices[0].b : 0)}`)
        });

        return (price /= 1000000);
    }

    // 裝備價格計算
    async function calculateEquipment(profile_shared_obj) {
        const marketAPIJson = await fetchMarketJSON();
        if (!marketAPIJson) {
            return 0;
        }
        let obj = profile_shared_obj.profile;
        // 裝備淨值
        let networthAsk = 0;
        let networthBid = 0;
        for (const key in obj.wearableItemMap) {
            let item = obj.wearableItemMap[key];
            const enhanceLevel = obj.wearableItemMap[key].enhancementLevel;
            const itemHrid = obj.wearableItemMap[key].itemHrid;
            const marketPrices = marketAPIJson.marketData[itemHrid];

            if (enhanceLevel && enhanceLevel > 1) {
                input_data.item_hrid = item.itemHrid;
                input_data.stop_at = enhanceLevel;
                const best = await findBestEnhanceStratWithPhiMirror(input_data);
                let totalCost = best?.totalCost;
                totalCost = totalCost ? Math.round(totalCost) : 0;
                networthAsk += item.count * (totalCost > 0 ? totalCost : 0);
                networthBid += item.count * (totalCost > 0 ? totalCost : 0);
            } else if (marketPrices && marketPrices[0]) {
                networthAsk += item.count * (marketPrices[0].a > 0 ? marketPrices[0].a : 0);
                networthBid += item.count * (marketPrices[0].b > 0 ? marketPrices[0].b : 0);
            } else {
                console.log("calculateEquipment cannot find price of " + itemHrid);
            }
        }

        return (networthAsk * 0.5 + networthBid * 0.5) / 1000000;
    }

    /* 顯示當前動作總時間 */
    const showTotalActionTime = () => {
        const targetNode = document.querySelector("div.Header_actionName__31-L2");
        if (targetNode) {
            console.log("start observe action progress bar");
            calculateTotalTime(targetNode);
            new MutationObserver((mutationsList) =>
                mutationsList.forEach((mutation) => {
                    calculateTotalTime();
                })
            ).observe(targetNode, { characterData: true, subtree: true, childList: true });
        } else {
            setTimeout(showTotalActionTime, 200);
        }
    };

    function calculateTotalTime() {
        const targetNode = document.querySelector("div.Header_actionName__31-L2 > div.Header_displayName__1hN09");
        if (targetNode.textContent.includes("[")) {
            return;
        }

        let totalTimeStr = "Error";
        const content = targetNode.innerText;
        const match = content.match(/\((\d+)\)/);
        if (match) {
            const numOfTimes = +match[1];
            const timePerActionSec = +getOriTextFromElement(document.querySelector(".ProgressBar_text__102Yn")).match(/[\d\.]+/)[0];
            const actionHrid = currentActionsHridList[0].actionHrid;
            let effBuff = 1 + getTotalEffiPercentage(actionHrid) / 100;
            if (actionHrid.includes("enhanc")) {
                effBuff = 1;
            }
            const actualNumberOfTimes = Math.round(numOfTimes / effBuff);
            const totalTimeSeconds = actualNumberOfTimes * timePerActionSec;
            totalTimeStr = " [" + timeReadable(totalTimeSeconds) + "]";

            const currentTime = new Date();
            currentTime.setSeconds(currentTime.getSeconds() + totalTimeSeconds);
            totalTimeStr += ` ${String(currentTime.getHours()).padStart(2, "0")}:${String(currentTime.getMinutes()).padStart(2, "0")}:${String(
                currentTime.getSeconds()
            ).padStart(2, "0")}`;
        } else {
            totalTimeStr = " [∞]";
        }

        targetNode.textContent += totalTimeStr;
    }

    function timeReadable(sec) {
        if (sec >= 86400) {
            return Number(sec / 86400).toFixed(1) + (isZH ? " 天" : " days");
        }
        const d = new Date(Math.round(sec * 1000));
        function pad(i) {
            return ("0" + i).slice(-2);
        }
        let str = d.getUTCHours() + "h " + pad(d.getUTCMinutes()) + "m " + pad(d.getUTCSeconds()) + "s";
        return str;
    }

    GM_addStyle(`div.Header_actionName__31-L2 {
        overflow: visible !important;
        white-space: normal !important;
        height: auto !important;
      }`);

    GM_addStyle(`span.NavigationBar_label__1uH-y {
        width: 10px !important;
      }`);

    /* 物品 ToolTips */
    const tooltipObserver = new MutationObserver(async function (mutations) {
        for (const mutation of mutations) {
            for (const added of mutation.addedNodes) {
                if (added.classList.contains("MuiTooltip-popper")) {
                    if (added.querySelector("div.ItemTooltipText_name__2JAHA")) {
                        await handleTooltipItem(added);
                    } else if (added.querySelector("div.QueuedActions_queuedActionsEditMenu__3OoQH")) {
                        handleActionQueueMenue(added.querySelector("div.QueuedActions_queuedActionsEditMenu__3OoQH"));
                    }
                }
            }
        }
    });
    tooltipObserver.observe(document.body, { attributes: false, childList: true, characterData: false });

    const actionHridToToolsSpeedBuffNamesMap = {
        "/action_types/brewing": "brewingSpeed",
        "/action_types/cheesesmithing": "cheesesmithingSpeed",
        "/action_types/cooking": "cookingSpeed",
        "/action_types/crafting": "craftingSpeed",
        "/action_types/foraging": "foragingSpeed",
        "/action_types/milking": "milkingSpeed",
        "/action_types/tailoring": "tailoringSpeed",
        "/action_types/woodcutting": "woodcuttingSpeed",
        "/action_types/alchemy": "alchemySpeed",
    };

    const actionHridToHouseNamesMap = {
        "/action_types/brewing": "/house_rooms/brewery",
        "/action_types/cheesesmithing": "/house_rooms/forge",
        "/action_types/cooking": "/house_rooms/kitchen",
        "/action_types/crafting": "/house_rooms/workshop",
        "/action_types/foraging": "/house_rooms/garden",
        "/action_types/milking": "/house_rooms/dairy_barn",
        "/action_types/tailoring": "/house_rooms/sewing_parlor",
        "/action_types/woodcutting": "/house_rooms/log_shed",
        "/action_types/alchemy": "/house_rooms/laboratory",
    };

    const itemEnhanceLevelToBuffBonusMap = {
        0: 0,
        1: 2,
        2: 4.2,
        3: 6.6,
        4: 9.2,
        5: 12,
        6: 15,
        7: 18.2,
        8: 21.6,
        9: 25.2,
        10: 29,
        11: 33.4,
        12: 38.4,
        13: 44,
        14: 50.2,
        15: 57,
        16: 64.4,
        17: 72.4,
        18: 81,
        19: 90.2,
        20: 100,
    };

    function getToolsSpeedBuffByActionHrid(actionHrid) {
        let totalBuff = 0;
        for (const item of initData_characterItems) {
            if (item.itemLocationHrid.includes("_tool")) {
                const buffName = actionHridToToolsSpeedBuffNamesMap[initData_actionDetailMap[actionHrid].type];
                const enhanceBonus = 1 + itemEnhanceLevelToBuffBonusMap[item.enhancementLevel] / 100;
                const buff = initData_itemDetailMap[item.itemHrid].equipmentDetail.noncombatStats[buffName] || 0;
                totalBuff += buff * enhanceBonus;
            }
        }
        return Number(totalBuff * 100).toFixed(1);
    }

    function getItemEffiBuffByActionHrid(actionHrid) {
        let buff = 0;
        const propertyName = initData_actionDetailMap[actionHrid].type.replace("/action_types/", "") + "Efficiency";
        for (const item of initData_characterItems) {
            if (item.itemLocationHrid === "/item_locations/inventory") {
                continue;
            }
            const itemDetail = initData_itemDetailMap[item.itemHrid];

            const specificStat = itemDetail?.equipmentDetail?.noncombatStats[propertyName];
            if (specificStat && specificStat > 0) {
                let enhanceBonus = 1;
                if (item.itemLocationHrid.includes("earrings") || item.itemLocationHrid.includes("ring") || item.itemLocationHrid.includes("neck")) {
                    enhanceBonus = 1 + (itemEnhanceLevelToBuffBonusMap[item.enhancementLevel] * 5) / 100;
                } else {
                    enhanceBonus = 1 + itemEnhanceLevelToBuffBonusMap[item.enhancementLevel] / 100;
                }
                buff += specificStat * enhanceBonus;
            }

            const skillingStat = itemDetail?.equipmentDetail?.noncombatStats["skillingEfficiency"];
            if (skillingStat && skillingStat > 0) {
                let enhanceBonus = 1;
                if (item.itemLocationHrid.includes("earrings") || item.itemLocationHrid.includes("ring") || item.itemLocationHrid.includes("neck")) {
                    enhanceBonus = 1 + (itemEnhanceLevelToBuffBonusMap[item.enhancementLevel] * 5) / 100;
                } else {
                    enhanceBonus = 1 + itemEnhanceLevelToBuffBonusMap[item.enhancementLevel] / 100;
                }
                buff += skillingStat * enhanceBonus;
            }
        }
        return Number(buff * 100).toFixed(1);
    }

    function getHousesEffBuffByActionHrid(actionHrid) {
        const houseName = actionHridToHouseNamesMap[initData_actionDetailMap[actionHrid].type];
        if (!houseName) {
            return 0;
        }
        const house = initData_characterHouseRoomMap[houseName];
        if (!house) {
            return 0;
        }
        return house.level * 1.5;
    }

    function getTeaBuffsByActionHrid(actionHrid) {
        const teaBuffs = {
            efficiency: 0, // Efficiency tea, specific teas, -Artisan tea.
            quantity: 0, // Gathering tea, Gourmet tea.
            lessResource: 0, // Artisan tea.
            extraExp: 0, // Wisdom tea. Not used.
            upgradedProduct: 0, // Processing tea. Not used.
        };

        const actionTypeId = initData_actionDetailMap[actionHrid].type;
        const teaList = initData_actionTypeDrinkSlotsMap[actionTypeId];
        for (const tea of teaList) {
            if (!tea || !tea.itemHrid) {
                continue;
            }

            for (const buff of initData_itemDetailMap[tea.itemHrid].consumableDetail.buffs) {
                if (buff.typeHrid === "/buff_types/artisan") {
                    teaBuffs.lessResource += buff.flatBoost * 100;
                } else if (buff.typeHrid === "/buff_types/action_level") {
                    teaBuffs.efficiency -= buff.flatBoost;
                } else if (buff.typeHrid === "/buff_types/gathering") {
                    teaBuffs.quantity += buff.flatBoost * 100;
                } else if (buff.typeHrid === "/buff_types/gourmet") {
                    teaBuffs.quantity += buff.flatBoost * 100;
                } else if (buff.typeHrid === "/buff_types/wisdom") {
                    teaBuffs.extraExp += buff.flatBoost * 100;
                } else if (buff.typeHrid === "/buff_types/processing") {
                    teaBuffs.upgradedProduct += buff.flatBoost * 100;
                } else if (buff.typeHrid === "/buff_types/efficiency") {
                    teaBuffs.efficiency += buff.flatBoost * 100;
                } else if (buff.typeHrid === `/buff_types/${actionTypeId.replace("/action_types/", "")}_level`) {
                    teaBuffs.efficiency += buff.flatBoost;
                }
            }
        }

        return teaBuffs;
    }

    async function handleTooltipItem(tooltip) {
        const itemNameElems = tooltip.querySelectorAll("div.ItemTooltipText_name__2JAHA span");

        // 帶強化等級的物品單獨處理
        if (itemNameElems.length > 1) {
            handleItemTooltipWithEnhancementLevel(tooltip);
            return;
        }

        const itemNameElem = itemNameElems[0];
        let itemName = getOriTextFromElement(itemNameElem);
        if (isZHInGameSetting) {
            itemName = getItemEnNameFromZhName(itemName);
        }
        const itemHrid = itemEnNameToHridMap[itemName];

        let amount = 0;
        let insertAfterElem = null;
        const amountSpan = tooltip.querySelectorAll("span")[1];
        if (amountSpan) {
            amount = +getOriTextFromElement(amountSpan).split(": ")[1].replaceAll(THOUSAND_SEPERATOR, "");
            insertAfterElem = amountSpan.parentNode.nextSibling;
        } else {
            insertAfterElem = tooltip.querySelectorAll("span")[0].parentNode.nextSibling;
        }

        let appendHTMLStr = "";
        let marketJson = null;
        let ask = null;
        let bid = null;

        // 物品市場價格
        if (settingsMap.itemTooltip_prices.isTrue) {
            marketJson = await fetchMarketJSON();
            if (!marketJson || !marketJson.marketData) {
                console.error("jsonObj null");
            }

            ask = marketJson?.marketData[itemHrid]?.[0]?.a ?? 0;
            bid = marketJson?.marketData[itemHrid]?.[0]?.b ?? 0;
            appendHTMLStr += `
        <div style="color: ${SCRIPT_COLOR_TOOLTIP};">${isZH ? "價格: " : "Price: "}${numberFormatter(ask)} / ${numberFormatter(bid)} (${
                ask && ask > 0 ? numberFormatter(ask * amount) : ""
            } / ${bid && bid > 0 ? numberFormatter(bid * amount) : ""})</div>
        `;
        }

        // 消耗品回覆計算
        if (settingsMap.showConsumTips.isTrue) {
            let itemDetail = initData_itemDetailMap[itemHrid];
            const hp = itemDetail?.consumableDetail?.hitpointRestore;
            const mp = itemDetail?.consumableDetail?.manapointRestore;
            const cd = itemDetail?.consumableDetail?.cooldownDuration;
            if (hp && cd) {
                const hpPerMiniute = (60 / (cd / 1000000000)) * hp;
                const pricePer100Hp = ask ? ask / (hp / 100) : null;
                const usePerday = (24 * 60 * 60) / (cd / 1000000000);
                appendHTMLStr += `<div style="color: ${SCRIPT_COLOR_TOOLTIP}; font-size: 0.625rem;">${
                    pricePer100Hp ? pricePer100Hp.toFixed(0) + (isZH ? "金/100血, " : "coins/100hp, ") : ""
                }${hpPerMiniute.toFixed(0) + (isZH ? "血/分" : "hp/min")}, ${usePerday.toFixed(0)}${isZH ? "個/天" : "/day"}</div>`;
            } else if (mp && cd) {
                const mpPerMiniute = (60 / (cd / 1000000000)) * mp;
                const pricePer100Mp = ask ? ask / (mp / 100) : null;
                const usePerday = (24 * 60 * 60) / (cd / 1000000000);
                appendHTMLStr += `<div style="color: ${SCRIPT_COLOR_TOOLTIP}; font-size: 0.625rem;">${
                    pricePer100Mp ? pricePer100Mp.toFixed(0) + (isZH ? "金/100藍, " : "coins/100hp, ") : ""
                }${mpPerMiniute.toFixed(0) + (isZH ? "藍/分" : "hp/min")}, ${usePerday.toFixed(0)}${isZH ? "個/天" : "/day"}</div>`;
            } else if (cd) {
                const usePerday = (24 * 60 * 60) / (cd / 1000000000);
                appendHTMLStr += `<div style="color: ${SCRIPT_COLOR_TOOLTIP}">${usePerday.toFixed(0)}${isZH ? "個/天" : "/day"}</div>`;
            }
        }

        // 生產利潤計算
        if (
            settingsMap.itemTooltip_profit.isTrue &&
            marketJson &&
            getActionHridFromItemName(itemName) &&
            initData_actionDetailMap &&
            initData_itemDetailMap
        ) {
            // 區分生產類動作和採集類動作
            const isProduction =
                initData_actionDetailMap[getActionHridFromItemName(itemName)].inputItems &&
                initData_actionDetailMap[getActionHridFromItemName(itemName)].inputItems.length > 0;

            const actionHrid = getActionHridFromItemName(itemName);
            // 茶效率
            const teaBuffs = getTeaBuffsByActionHrid(actionHrid);

            // 原料資訊
            let inputItems = [];
            let totalResourcesAskPricePerAction = 0;
            let totalResourcesBidPricePerAction = 0;

            if (isProduction) {
                inputItems = JSON.parse(JSON.stringify(initData_actionDetailMap[actionHrid].inputItems));
                for (const item of inputItems) {
                    item.name = initData_itemDetailMap[item.itemHrid].name;
                    item.zhName = ZHItemNames[item.itemHrid];
                    item.perAskPrice = marketJson?.marketData[item.itemHrid]?.[0]?.a ?? 0;
                    item.perBidPrice = marketJson?.marketData[item.itemHrid]?.[0]?.b ?? 0;
                    totalResourcesAskPricePerAction += item.perAskPrice * item.count;
                    totalResourcesBidPricePerAction += item.perBidPrice * item.count;
                }

                // 茶減少原料消耗（對於升級物品，不影響上一級物品消耗）
                const lessResourceBuff = teaBuffs.lessResource;
                totalResourcesAskPricePerAction *= 1 - lessResourceBuff / 100;
                totalResourcesBidPricePerAction *= 1 - lessResourceBuff / 100;

                // 上級物品作為原料
                const upgradedFromItemHrid = initData_actionDetailMap[actionHrid]?.upgradeItemHrid;
                let upgradedFromItemName = null;
                let upgradedFromItemZhName = null;
                let upgradedFromItemAsk = null;
                let upgradedFromItemBid = null;
                if (upgradedFromItemHrid) {
                    upgradedFromItemName = initData_itemDetailMap[upgradedFromItemHrid].name;
                    upgradedFromItemZhName = ZHItemNames[upgradedFromItemHrid];
                    upgradedFromItemAsk += marketJson?.marketData[upgradedFromItemHrid]?.[0]?.a ?? 0;
                    upgradedFromItemBid += marketJson?.marketData[upgradedFromItemHrid]?.[0]?.b ?? 0;
                    totalResourcesAskPricePerAction += upgradedFromItemAsk;
                    totalResourcesBidPricePerAction += upgradedFromItemBid;
                }

                // 使用表格顯示原料資訊
                appendHTMLStr += `
                                <div style="color: ${SCRIPT_COLOR_TOOLTIP}; font-size: 0.625rem;">
                                    <table style="width:100%; border-collapse: collapse;">
                                        <tr style="border-bottom: 1px solid ${SCRIPT_COLOR_TOOLTIP};">
                                            <th style="text-align: left;">${isZH ? "原料" : "Material"}</th>
                                            <th style="text-align: center;">${isZH ? "數量" : "Count"}</th>
                                            <th style="text-align: right;">${isZH ? "出售價" : "Ask"}</th>
                                            <th style="text-align: right;">${isZH ? "收購價" : "Bid"}</th>
                                        </tr>
                                        <tr style="border-bottom: 1px solid ${SCRIPT_COLOR_TOOLTIP};">
                                            <td style="text-align: left;"><b>${isZH ? "合計" : "Total"}</b></td>
                                            <td style="text-align: center;"><b>${inputItems.reduce((sum, item) => sum + item.count, 0)}</b></td>
                                            <td style="text-align: right;"><b>${numberFormatter(totalResourcesAskPricePerAction)}</b></td>
                                            <td style="text-align: right;"><b>${numberFormatter(totalResourcesBidPricePerAction)}</b></td>
                                        </tr>`;

                for (const item of inputItems) {
                    appendHTMLStr += `
                                        <tr>
                                            <td style="text-align: left;">${isZH ? item.zhName : item.name}</td>
                                            <td style="text-align: center;">${item.count}</td>
                                            <td style="text-align: right;">${numberFormatter(item.perAskPrice)}</td>
                                            <td style="text-align: right;">${numberFormatter(item.perBidPrice)}</td>
                                        </tr>`;
                }
                appendHTMLStr += `</table></div>`;

                if (upgradedFromItemHrid) {
                    appendHTMLStr += `
                    <div style="color: ${SCRIPT_COLOR_TOOLTIP}; font-size: 0.625rem;"> ${
                        isZH ? upgradedFromItemZhName : upgradedFromItemName
                    }: ${numberFormatter(upgradedFromItemAsk)} / ${numberFormatter(upgradedFromItemBid)}</div>
                    `;
                }
            }

            // 消耗飲料
            let drinksConsumedPerHourAskPrice = 0;
            let drinksConsumedPerHourBidPrice = 0;

            const drinksList = initData_actionTypeDrinkSlotsMap[initData_actionDetailMap[actionHrid].type];
            for (const drink of drinksList) {
                if (!drink || !drink.itemHrid) {
                    continue;
                }
                drinksConsumedPerHourAskPrice += (marketJson?.marketData[drink.itemHrid]?.[0].a ?? 0) * 12;
                drinksConsumedPerHourBidPrice += (marketJson?.marketData[drink.itemHrid]?.[0].b ?? 0) * 12;
            }

            // 每小時動作數（包含工具縮減動作時間）
            const baseTimePerActionSec = initData_actionDetailMap[actionHrid].baseTimeCost / 1000000000;
            const toolPercent = getToolsSpeedBuffByActionHrid(actionHrid);
            const actualTimePerActionSec = baseTimePerActionSec / (1 + toolPercent / 100);

            let actionPerHour = 3600 / actualTimePerActionSec;

            // 每小時產品數
            let droprate = null;
            if (isProduction) {
                droprate = initData_actionDetailMap[actionHrid].outputItems[0].count;
            } else {
                droprate =
                    (initData_actionDetailMap[actionHrid].dropTable[0].minCount + initData_actionDetailMap[actionHrid].dropTable[0].maxCount) / 2;
            }
            let itemPerHour = actionPerHour * droprate;

            // 等級碾壓提高效率（人物等級不及最低要求等級時，按最低要求等級計算）
            const requiredLevel = initData_actionDetailMap[actionHrid].levelRequirement.level;
            let currentLevel = requiredLevel;
            for (const skill of initData_characterSkills) {
                if (skill.skillHrid === initData_actionDetailMap[actionHrid].levelRequirement.skillHrid) {
                    currentLevel = skill.level;
                    break;
                }
            }
            const levelEffBuff = currentLevel - requiredLevel > 0 ? currentLevel - requiredLevel : 0;

            // 房子效率
            const houseEffBuff = getHousesEffBuffByActionHrid(actionHrid);

            // 特殊裝備效率
            const itemEffiBuff = Number(getItemEffiBuffByActionHrid(actionHrid));

            // 總效率影響動作數/生產物品數
            actionPerHour *= 1 + (levelEffBuff + houseEffBuff + teaBuffs.efficiency + itemEffiBuff) / 100;
            itemPerHour *= 1 + (levelEffBuff + houseEffBuff + teaBuffs.efficiency + itemEffiBuff) / 100;

            // 茶額外產品數量（不消耗原料）
            const extraFreeItemPerHour = (itemPerHour * teaBuffs.quantity) / 100;

            // 出售市場稅
            const bidAfterTax = bid * 0.98;

            // 每小時利潤
            const profitPerHour =
                itemPerHour * (bidAfterTax - totalResourcesAskPricePerAction / droprate) +
                extraFreeItemPerHour * bidAfterTax -
                drinksConsumedPerHourAskPrice;

            appendHTMLStr += `<div style="color: ${SCRIPT_COLOR_TOOLTIP}; font-size: 0.625rem;">${
                isZH
                    ? "生產利潤(賣單價進、買單價出，包含銷售稅；不包括加工茶、社群增益、稀有掉落、袋子飲食增益；重新整理網頁更新人物資料)："
                    : "Production profit(Sell price in, bid price out, including sales tax; Not including processing tea, comm buffs, rare drops, pouch consumables buffs; Refresh page to update player data): "
            }</div>`;

            appendHTMLStr += `<div style="color: ${SCRIPT_COLOR_TOOLTIP}; font-size: 0.625rem;">${baseTimePerActionSec.toFixed(2)}s ${
                isZH ? "基礎速度" : "base speed,"
            } x${droprate} ${isZH ? "基礎掉率" : "base drop rate,"} +${toolPercent}%${isZH ? "工具速度" : " tool speed,"} +${levelEffBuff}%${
                isZH ? "等級效率" : " level eff,"
            } +${houseEffBuff}%${isZH ? "房子效率" : " house eff,"} +${teaBuffs.efficiency}%${isZH ? "茶效率" : " tea eff,"} +${itemEffiBuff}%${
                isZH ? "裝備效率" : " equipment eff,"
            } +${teaBuffs.quantity}%${isZH ? "茶額外數量" : " tea extra outcome,"} +${teaBuffs.lessResource}%${
                isZH ? "茶減少消耗" : " tea lower resource"
            }</div>`;

            appendHTMLStr += `<div style="color: ${SCRIPT_COLOR_TOOLTIP}; font-size: 0.625rem;">${
                isZH ? "每小時飲料消耗: " : "Drinks consumed per hour: "
            }${numberFormatter(drinksConsumedPerHourAskPrice)}  / ${numberFormatter(drinksConsumedPerHourBidPrice)}</div>`;

            appendHTMLStr += `<div style="color: ${SCRIPT_COLOR_TOOLTIP}; font-size: 0.625rem;">${isZH ? "每小時動作" : "Actions per hour"} ${Number(
                actionPerHour
            ).toFixed(1)}${isZH ? " 次" : " times"}, ${isZH ? "每小時生產" : "Production per hour"} ${Number(
                itemPerHour + extraFreeItemPerHour
            ).toFixed(1)}${isZH ? " 個" : " items"}</div>`;

            appendHTMLStr += `<div style="color: ${SCRIPT_COLOR_TOOLTIP};">${isZH ? "利潤: " : "Profit: "}${numberFormatter(
                profitPerHour / actionPerHour
            )}${isZH ? "/動作" : "/action"}, ${numberFormatter(profitPerHour)}${isZH ? "/小時" : "/hour"}, ${numberFormatter(24 * profitPerHour)}${
                isZH ? "/天" : "/day"
            }</div>`;
        }

        insertAfterElem.insertAdjacentHTML("afterend", appendHTMLStr);

        // Make sure the tooltip is fully visible in the viewport
        const tootip = insertAfterElem.closest(".MuiTooltip-popper");
        const fixOverflow = (tootip) => {
            if (!tootip.isConnected) {
                return;
            }
            const bBox = tootip.getBoundingClientRect();
            if (bBox.top < 0 || bBox.bottom > window.innerHeight) {
                const transformString = tootip.style.transform.split(/\w+\(|\);?/);
                const transformValues = transformString[1].split(/,\s?/g).map((numStr) => parseInt(numStr));
                tootip.style.transform = `translate3d(${transformValues[0]}px, 0px, ${transformValues[2]}px)`;
            }
        };
        setTimeout(fixOverflow, 100, tootip); // A delay is added because the game seems to reset the style if applied immediately.
    }

    function validateMarketJsonFetch(jsonStr, isSave) {
        if (!jsonStr) {
            console.error("validateMarketJson jsonStr is null");
            return null;
        }

        let jsonObj = null;
        try {
            jsonObj = JSON.parse(jsonStr);
        } catch (error) {
            console.error("validateMarketJson failed to parse JSON:", error.message);
        }

        if (jsonObj && jsonObj.timestamp && jsonObj.marketData) {
            // Add modifications to API data
            jsonObj.marketData["/items/coin"] = { 0: { a: 1, b: 1 } };
            jsonObj.marketData["/items/task_token"] = { 0: { a: 0, b: 0 } };
            jsonObj.marketData["/items/cowbell"] = { 0: { a: 0, b: 0 } };

            jsonObj.marketData["/items/small_treasure_chest"] = { 0: { a: 0, b: 0 } };
            jsonObj.marketData["/items/medium_treasure_chest"] = { 0: { a: 0, b: 0 } };
            jsonObj.marketData["/items/large_treasure_chest"] = { 0: { a: 0, b: 0 } };

            jsonObj.marketData["/items/basic_task_badge"] = { 0: { a: 0, b: 0 } };
            jsonObj.marketData["/items/advanced_task_badge"] = { 0: { a: 0, b: 0 } };
            jsonObj.marketData["/items/expert_task_badge"] = { 0: { a: 0, b: 0 } };

            if (isSave) {
                console.log(jsonObj);
                localStorage.setItem("MWITools_marketAPI_timestamp", Date.now());
                localStorage.setItem("MWITools_marketAPI_json", JSON.stringify(jsonObj));
            }

            return jsonObj;
        } else {
            console.error("validateMarketJson invalid json structure");
            return null;
        }
    }

    async function fetchMarketJSON(forceFetch = false) {
        // console.log(GM_xmlhttpRequest); // Tampermonkey
        // console.log(GM.xmlHttpRequest); // Tampermonkey promise based, Greasemonkey 4.0+

        // Has recently fetched
        if (
            !forceFetch &&
            localStorage.getItem("MWITools_marketAPI_timestamp") &&
            Date.now() - localStorage.getItem("MWITools_marketAPI_timestamp") < 3600000 // 1 hr
        ) {
            return JSON.parse(localStorage.getItem("MWITools_marketAPI_json"));
        }

        // Broswer does not support fetch
        const sendRequest =
            typeof GM.xmlHttpRequest === "function" ? GM.xmlHttpRequest : typeof GM_xmlhttpRequest === "function" ? GM_xmlhttpRequest : null;
        if (typeof sendRequest != "function") {
            console.error("fetchMarketJSON null GM xmlHttpRequest function");
            if (!isUsingExpiredMarketJson) {
                reasonForUsingExpiredMarketJson += new Date().toUTCString() + " Setting isUsingExpiredMarketJson to true:\n";
                reasonForUsingExpiredMarketJson += "GM_xmlhttpRequest " + typeof GM_xmlhttpRequest + "\n";
                reasonForUsingExpiredMarketJson += "GM.xmlHttpRequest " + typeof GM.xmlHttpRequest + "\n";
            }
            isUsingExpiredMarketJson = true;
            const alertDiv = document.querySelector("div#script_api_fail_alert");
            if (alertDiv) {
                alertDiv.style.display = "block";
            }
            reasonForUsingExpiredMarketJson += "\nusing hard-coded backup version\n";

            const jsonStr = MARKET_JSON_LOCAL_BACKUP;
            return validateMarketJsonFetch(jsonStr, false);
        }

        // Start fetch
        console.log("fetchMarketJSON fetch start");
        reasonForUsingExpiredMarketJson += new Date().toUTCString() + " fetch start \n";
        const response = await sendRequest({
            url: MARKET_API_URL,
            method: "GET",
            synchronous: true,
            timeout: 5000,
            onload: (response) => {
                if (response.status == 200) {
                    console.log("fetchMarketJSON fetch success 200");
                    reasonForUsingExpiredMarketJson += new Date().toUTCString() + " fetch onload 200 \n";
                } else {
                    console.error("fetchMarketJSON fetch onload with HTTP status failure " + response.status);
                    reasonForUsingExpiredMarketJson += new Date().toUTCString() + " fetch onload NOT 200 \n";
                }
            },
            onabort: () => {
                console.error("fetchMarketJSON fetch onabort");
                reasonForUsingExpiredMarketJson += new Date().toUTCString() + " fetch onabort \n";
            },
            onerror: () => {
                console.error("fetchMarketJSON fetch onerror");
                reasonForUsingExpiredMarketJson += new Date().toUTCString() + " fetch onerror \n";
            },
            ontimeout: () => {
                console.error("fetchMarketJSON fetch ontimeout");
                reasonForUsingExpiredMarketJson += new Date().toUTCString() + " fetch ontimeout \n";
            },
        });
        console.log("fetchMarketJSON fetch end with response status: " + response?.status);
        reasonForUsingExpiredMarketJson += new Date().toUTCString() + " fetch end with response status " + response?.status + "\n";

        let jsonStr = response?.status === 200 ? response.responseText : null;
        let jsonObj = validateMarketJsonFetch(jsonStr, true);

        if (jsonObj) {
            isUsingExpiredMarketJson = false;
            reasonForUsingExpiredMarketJson = "";
            const alertDiv = document.querySelector("div#script_api_fail_alert");
            if (alertDiv) {
                alertDiv.style.display = "none";
            }
            return jsonObj;
        }

        // Fetch failed
        isUsingExpiredMarketJson = true;
        reasonForUsingExpiredMarketJson += new Date().toUTCString() + " Setting isUsingExpiredMarketJson to true:\n";
        reasonForUsingExpiredMarketJson += "Failed fetch";
        const alertDiv = document.querySelector("div#script_api_fail_alert");
        if (alertDiv) {
            alertDiv.style.display = "block";
        }

        // Try previously fetched version
        if (
            localStorage.getItem("MWITools_marketAPI_json") &&
            localStorage.getItem("MWITools_marketAPI_timestamp") &&
            JSON.parse(MARKET_JSON_LOCAL_BACKUP).timestamp * 1000 < localStorage.getItem("MWITools_marketAPI_timestamp")
        ) {
            console.error("fetchMarketJSON network error, using previously fetched version");
            const jsonStr = localStorage.getItem("MWITools_marketAPI_json");
            const jsonObj = validateMarketJsonFetch(jsonStr, false);
            if (jsonObj) {
                reasonForUsingExpiredMarketJson += "\nusing previously fetched version\n";
                return jsonObj;
            }
        }

        // Use hard-coded backup version
        reasonForUsingExpiredMarketJson += "\nusing hard-coded backup version\n";
        return validateMarketJsonFetch(MARKET_JSON_LOCAL_BACKUP, false);
    }

    function numberFormatter(num, digits = 1) {
        if (num === null || num === undefined) {
            return null;
        }
        if (num < 0) {
            return "-" + numberFormatter(-num);
        }
        const lookup = [
            { value: 1, symbol: "" },
            { value: 1e3, symbol: "k" },
            { value: 1e6, symbol: "M" },
        ];
        if (!settingsMap.displayCapMM.isTrue) {
            lookup.push({ value: 1e9, symbol: "B" });
        }
        const rx = /\.0+$|(\.[0-9]*[1-9])0+$/;
        var item = lookup
            .slice()
            .reverse()
            .find(function (item) {
                return num >= item.value;
            });
        return item ? (num / item.value).toFixed(digits).replace(rx, "$1") + item.symbol : "0";
    }

    function getActionHridFromItemName(name) {
        let newName = name.replace("Milk", "Cow");
        newName = newName.replace("Log", "Tree");
        newName = newName.replace("Cowing", "Milking");
        newName = newName.replace("Rainbow Cow", "Unicow");
        newName = newName.replace("Collector's Boots", "Collectors Boots");
        newName = newName.replace("Knight's Aegis", "Knights Aegis");
        if (!initData_actionDetailMap) {
            console.error("getActionHridFromItemName no initData_actionDetailMap: " + name);
            return null;
        }
        for (const action of Object.values(initData_actionDetailMap)) {
            if (action.name === newName) {
                return action.hrid;
            }
        }
        return null;
    }

    /* 動作面板 */
    const waitForActionPanelParent = () => {
        const targetNode = document.querySelector("div.GamePage_mainPanel__2njyb");
        if (targetNode) {
            console.log("start observe action panel");
            const actionPanelObserver = new MutationObserver(async function (mutations) {
                for (const mutation of mutations) {
                    for (const added of mutation.addedNodes) {
                        if (
                            added?.classList?.contains("Modal_modalContainer__3B80m") &&
                            added.querySelector("div.SkillActionDetail_regularComponent__3oCgr")
                        ) {
                            handleActionPanel(added.querySelector("div.SkillActionDetail_regularComponent__3oCgr"));
                        }
                    }
                }
            });
            actionPanelObserver.observe(targetNode, { attributes: false, childList: true, subtree: true });
        } else {
            setTimeout(waitForActionPanelParent, 200);
        }
    };

    async function handleActionPanel(panel) {
        if (!settingsMap.actionPanel_totalTime.isTrue) {
            return;
        }

        if (!panel.querySelector("div.SkillActionDetail_expGain__F5xHu")) {
            return; // 不處理戰鬥ActionPanel
        }
        let actionName = getOriTextFromElement(panel.querySelector("div.SkillActionDetail_name__3erHV"));
        if (isZHInGameSetting) {
            actionName = getActionEnNameFromZhName(actionName);
        }

        const exp = Number(
            getOriTextFromElement(panel.querySelector("div.SkillActionDetail_expGain__F5xHu"))
                .replaceAll(THOUSAND_SEPERATOR, "")
                .replaceAll(DECIMAL_SEPERATOR, ".")
        );

        const elems = panel.querySelectorAll("div.SkillActionDetail_value__dQjYH");
        const duration = Number(
            getOriTextFromElement(elems[elems.length - 2])
                .replaceAll(THOUSAND_SEPERATOR, "")
                .replaceAll(DECIMAL_SEPERATOR, ".")
                .replace("s", "")
        );
        const inputElem = panel.querySelector("div.SkillActionDetail_maxActionCountInput__1C0Pw input");

        const actionHrid = initData_actionDetailMap[getActionHridFromItemName(actionName)].hrid;
        const effBuff = 1 + getTotalEffiPercentage(actionHrid, false) / 100;

        // 顯示總時間
        let hTMLStr = `<div id="showTotalTime" style="color: ${SCRIPT_COLOR_MAIN}; text-align: left;">${getTotalTimeStr(
            inputElem.value,
            duration,
            effBuff
        )}</div>`;
        const gatherDiv = inputElem.parentNode.parentNode.parentNode;
        gatherDiv.insertAdjacentHTML("afterend", hTMLStr);
        const showTotalTimeDiv = panel.querySelector("div#showTotalTime");

        panel.addEventListener("click", function (evt) {
            setTimeout(() => {
                showTotalTimeDiv.textContent = getTotalTimeStr(inputElem.value, duration, effBuff);
            }, 50);
        });
        inputElem.addEventListener("keyup", function (evt) {
            if (inputElem.value.toLowerCase().includes("k") || inputElem.value.toLowerCase().includes("m")) {
                reactInputTriggerHack(inputElem, inputElem.value.toLowerCase().replaceAll("k", "000").replaceAll("m", "000000"));
            }
            showTotalTimeDiv.textContent = getTotalTimeStr(inputElem.value, duration, effBuff);
        });

        let appendAfterElem = showTotalTimeDiv;

        // 顯示快捷按鈕
        if (settingsMap.actionPanel_totalTime_quickInputs.isTrue) {
            hTMLStr = `<div id="quickInputHourButtons" style="color: ${SCRIPT_COLOR_MAIN}; text-align: left; display:flex;">${isZH ? "做 " : "Do "}</div>`;
            showTotalTimeDiv.insertAdjacentHTML("afterend", hTMLStr);
            const quickInputHourButtonsDiv = panel.querySelector("div#quickInputHourButtons");

            const presetHours = [0.5, 1, 2, 3, 4, 5, 6, 10, 12, 24];
            for (const value of presetHours) {
                const btn = document.createElement("button");
                btn.className = "Button_button__1Fe9z Button_small__3fqC7";
                btn.style.backgroundColor = "white";
                btn.style.color = "black";
                btn.style.padding = "1px 6px 1px 6px";
                btn.style.margin = "1px";
                btn.innerText = value === 0.5 ? 0.5 : numberFormatter(value);
                btn.onclick = () => {
                    reactInputTriggerHack(inputElem, Math.round((value * 60 * 60 * effBuff) / duration));
                };
                quickInputHourButtonsDiv.append(btn);
            }
            quickInputHourButtonsDiv.append(document.createTextNode(isZH ? " 小時" : " hours"));

            hTMLStr = `<div id="quickInputCountButtons" style="color: ${SCRIPT_COLOR_MAIN}; text-align: left; display:flex;">${isZH ? "做 " : "Do "}</div>`;
            quickInputHourButtonsDiv.insertAdjacentHTML("afterend", hTMLStr);
            const quickInputCountButtonsDiv = panel.querySelector("div#quickInputCountButtons");
            const presetTimes = [10, 100, 300, 500, 1000, 2000];
            for (const value of presetTimes) {
                const btn = document.createElement("button");
                btn.className = "Button_button__1Fe9z Button_small__3fqC7";
                btn.style.backgroundColor = "white";
                btn.style.color = "black";
                btn.style.padding = "1px 6px 1px 6px";
                btn.style.margin = "1px";
                btn.innerText = numberFormatter(value);
                btn.onclick = () => {
                    reactInputTriggerHack(inputElem, value);
                };
                quickInputCountButtonsDiv.append(btn);
            }
            quickInputCountButtonsDiv.append(document.createTextNode(isZH ? " 次" : " times"));

            appendAfterElem = quickInputCountButtonsDiv;
        }

        // 還有多久到多少技能等級
        const skillHrid = initData_actionDetailMap[getActionHridFromItemName(actionName)].experienceGain.skillHrid;
        let currentExp = null;
        let currentLevel = null;
        for (const skill of initData_characterSkills) {
            if (skill.skillHrid === skillHrid) {
                currentExp = skill.experience;
                currentLevel = skill.level;
                break;
            }
        }
        if (currentExp && currentLevel) {
            const calculateNeedToLevel = (currentLevel, targetLevel, effBuff, duration, exp) => {
                let needTotalTimeSec = 0;
                let needTotalNumOfActions = 0;
                for (let level = currentLevel; level < targetLevel; level++) {
                    let needExpToNextLevel = null;
                    if (level === currentLevel) {
                        needExpToNextLevel = initData_levelExperienceTable[level + 1] - currentExp;
                    } else {
                        needExpToNextLevel = initData_levelExperienceTable[level + 1] - initData_levelExperienceTable[level];
                    }
                    const extraLevelEffBuff = (level - currentLevel) * 0.01; // 升級過程中，每升一級，額外多1%效率
                    const needNumOfActionsToNextLevel = Math.round(needExpToNextLevel / exp);
                    needTotalNumOfActions += needNumOfActionsToNextLevel;
                    needTotalTimeSec += (needNumOfActionsToNextLevel / (effBuff + extraLevelEffBuff)) * duration;
                }
                return { numOfActions: needTotalNumOfActions, timeSec: needTotalTimeSec };
            };

            const need = calculateNeedToLevel(currentLevel, currentLevel + 1, effBuff, duration, exp);
            hTMLStr = `<div id="tillLevel" style="color: ${SCRIPT_COLOR_MAIN}; text-align: left;">${
                isZH ? "到 " : "To reach level "
            }<input id="tillLevelInput" type="number" value="${currentLevel + 1}" min="${currentLevel + 1}" max="200">${
                isZH ? " 級還需做 " : ", need to do "
            }<span id="tillLevelNumber">${need.numOfActions}${isZH ? " 次" : " times "}[${timeReadable(need.timeSec)}]${
                isZH ? " (重新整理網頁更新當前等級)" : " (Refresh page to update current level)"
            }</span></div>`;

            appendAfterElem.insertAdjacentHTML("afterend", hTMLStr);
            const tillLevelInput = panel.querySelector("input#tillLevelInput");
            const tillLevelNumber = panel.querySelector("span#tillLevelNumber");
            tillLevelInput.onchange = () => {
                const targetLevel = Number(tillLevelInput.value);
                if (targetLevel > currentLevel && targetLevel <= 200) {
                    const need = calculateNeedToLevel(currentLevel, targetLevel, effBuff, duration, exp);
                    tillLevelNumber.textContent = `${need.numOfActions}${isZH ? " 次" : " times "}[${timeReadable(need.timeSec)}]${
                        isZH ? " (重新整理網頁更新當前等級)" : " (Refresh page to update current level)"
                    }`;
                } else {
                    tillLevelNumber.textContent = "Error";
                }
            };
            tillLevelInput.addEventListener("keyup", function (evt) {
                const targetLevel = Number(tillLevelInput.value);
                if (targetLevel > currentLevel && targetLevel <= 200) {
                    const need = calculateNeedToLevel(currentLevel, targetLevel, effBuff, duration, exp);
                    tillLevelNumber.textContent = `${need.numOfActions}${isZH ? " 次" : " times "}[${timeReadable(need.timeSec)}]${
                        isZH ? " (重新整理網頁更新當前等級)" : " (Refresh page to update current level)"
                    }`;
                } else {
                    tillLevelNumber.textContent = "Error";
                }
            });
        }

        // 顯示每小時經驗
        panel
            .querySelector("div#tillLevel")
            .insertAdjacentHTML(
                "afterend",
                `<div id="expPerHour" style="color: ${SCRIPT_COLOR_MAIN}; text-align: left;">${isZH ? "每小時經驗: " : "Exp/hour: "}${numberFormatter(
                    Math.round((3600 / duration) * exp * effBuff)
                )} (+${Number((effBuff - 1) * 100).toFixed(1)}%${isZH ? "效率" : " eff"})</div>`
            );

        // 顯示Foraging最後一個圖綜合收益
        if (panel.querySelector("div.SkillActionDetail_dropTable__3ViVp").children.length > 1 && settingsMap.actionPanel_foragingTotal.isTrue) {
            const marketJson = await fetchMarketJSON();
            const actionHrid = "/actions/foraging/" + actionName.toLowerCase().replaceAll(" ", "_");

            // 茶效率
            const teaBuffs = getTeaBuffsByActionHrid(actionHrid);

            // 消耗飲料
            let drinksConsumedPerHourAskPrice = 0;
            let drinksConsumedPerHourBidPrice = 0;

            const drinksList = initData_actionTypeDrinkSlotsMap[initData_actionDetailMap[actionHrid].type];
            for (const drink of drinksList) {
                if (!drink || !drink.itemHrid) {
                    continue;
                }
                drinksConsumedPerHourAskPrice += (marketJson?.marketData[drink.itemHrid]?.[0].a ?? 0) * 12;
                drinksConsumedPerHourBidPrice += (marketJson?.marketData[drink.itemHrid]?.[0].b ?? 0) * 12;
            }

            // 每小時動作數（包含工具縮減動作時間）
            const baseTimePerActionSec = initData_actionDetailMap[actionHrid].baseTimeCost / 1000000000;
            const toolPercent = getToolsSpeedBuffByActionHrid(actionHrid);
            const actualTimePerActionSec = baseTimePerActionSec / (1 + toolPercent / 100);
            let actionPerHour = 3600 / actualTimePerActionSec;

            // 將掉落表看作每次動作掉落一件虛擬物品
            const dropTable = initData_actionDetailMap[actionHrid].dropTable;
            let virtualItemBid = 0;
            for (const drop of dropTable) {
                const bid = marketJson?.marketData[drop.itemHrid]?.[0].b;
                const amount = drop.dropRate * ((drop.minCount + drop.maxCount) / 2);
                virtualItemBid += bid * amount;
            }
            let droprate = 1;
            let itemPerHour = actionPerHour * droprate;

            // 等級碾壓提高效率（人物等級不及最低要求等級時，按最低要求等級計算）
            const requiredLevel = initData_actionDetailMap[actionHrid].levelRequirement.level;
            let currentLevel = requiredLevel;
            for (const skill of initData_characterSkills) {
                if (skill.skillHrid === initData_actionDetailMap[actionHrid].levelRequirement.skillHrid) {
                    currentLevel = skill.level;
                    break;
                }
            }
            const levelEffBuff = currentLevel - requiredLevel > 0 ? currentLevel - requiredLevel : 0;

            // 房子效率
            const houseEffBuff = getHousesEffBuffByActionHrid(actionHrid);

            // 特殊裝備效率
            const itemEffiBuff = Number(getItemEffiBuffByActionHrid(actionHrid));

            // 總效率影響動作數/生產物品數
            actionPerHour *= 1 + (levelEffBuff + houseEffBuff + teaBuffs.efficiency + itemEffiBuff) / 100;
            itemPerHour *= 1 + (levelEffBuff + houseEffBuff + teaBuffs.efficiency + itemEffiBuff) / 100;

            // 茶額外產品數量（不消耗原料）
            const extraFreeItemPerHour = (itemPerHour * teaBuffs.quantity) / 100;

            // 出售市場稅
            const bidAfterTax = virtualItemBid * 0.98;

            // 每小時利潤
            const profitPerHour = itemPerHour * bidAfterTax + extraFreeItemPerHour * bidAfterTax - drinksConsumedPerHourAskPrice;

            let htmlStr = `<div id="totalProfit"  style="color: ${SCRIPT_COLOR_MAIN}; text-align: left;">${
                isZH ? "綜合利潤: " : "Overall profit: "
            }${numberFormatter(profitPerHour)}${isZH ? "/小時" : "/hour"}, ${numberFormatter(24 * profitPerHour)}${isZH ? "/天" : "/day"}</div>`;
            panel.querySelector("div#expPerHour").insertAdjacentHTML("afterend", htmlStr);
        }
    }

    function getTotalEffiPercentage(actionHrid, debug = false) {
        if (debug) {
            console.log("----- getTotalEffiPercentage " + actionHrid);
        }
        // 等級碾壓效率
        const requiredLevel = initData_actionDetailMap[actionHrid].levelRequirement.level;
        let currentLevel = requiredLevel;
        for (const skill of initData_characterSkills) {
            if (skill.skillHrid === initData_actionDetailMap[actionHrid].levelRequirement.skillHrid) {
                currentLevel = skill.level;
                break;
            }
        }
        const levelEffBuff = currentLevel - requiredLevel > 0 ? currentLevel - requiredLevel : 0;
        if (debug) {
            console.log("等級碾壓 " + levelEffBuff);
        }
        // 房子效率
        const houseEffBuff = getHousesEffBuffByActionHrid(actionHrid);
        if (debug) {
            console.log("房子 " + houseEffBuff);
        }
        // 茶
        const teaBuffs = getTeaBuffsByActionHrid(actionHrid);
        if (debug) {
            console.log("茶 " + teaBuffs.efficiency);
        }
        // 特殊裝備
        const itemEffiBuff = getItemEffiBuffByActionHrid(actionHrid);
        if (debug) {
            console.log("特殊裝備 " + itemEffiBuff);
        }
        // 總效率
        const total = levelEffBuff + houseEffBuff + teaBuffs.efficiency + Number(itemEffiBuff);
        if (debug) {
            console.log("總計 " + total);
        }
        return total;
    }

    function getTotalTimeStr(input, duration, effBuff) {
        if (input === "∞") {
            return "[∞]";
        } else if (isNaN(input)) {
            return "Error";
        }
        return "[" + timeReadable(Math.round(input / effBuff) * duration) + "]";
    }

    function reactInputTriggerHack(inputElem, value) {
        let lastValue = inputElem.value;
        inputElem.value = value;
        let event = new Event("input", { bubbles: true });
        event.simulated = true;
        let tracker = inputElem._valueTracker;
        if (tracker) {
            tracker.setValue(lastValue);
        }
        inputElem.dispatchEvent(event);
    }

    /* 左側欄顯示技能百分比 */
    const waitForProgressBar = () => {
        const elements = document.querySelectorAll(".NavigationBar_currentExperience__3GDeX");
        if (elements.length) {
            removeInsertedDivs();
            elements.forEach((element) => {
                let text = element.style.width;
                text = Number(text.replace("%", "")).toFixed(2) + "%";

                const span = document.createElement("span");
                span.textContent = text;
                span.classList.add("insertedSpan");
                span.style.fontSize = "0.875rem";
                span.style.color = SCRIPT_COLOR_MAIN;

                element.parentNode.parentNode.querySelector("span.NavigationBar_level__3C7eR").style.width = "auto";

                const insertParent = element.parentNode.parentNode.children[0];
                insertParent.insertBefore(span, insertParent.children[1]);
            });
        } else {
            setTimeout(waitForProgressBar, 200);
        }
    };

    const removeInsertedDivs = () => document.querySelectorAll("span.insertedSpan").forEach((div) => div.parentNode.removeChild(div));

    if (settingsMap.expPercentage.isTrue) {
        window.setInterval(() => {
            removeInsertedDivs();
            waitForProgressBar();
        }, 1000);
    }

    /* 戰鬥總結 */
    async function handleBattleSummary(message) {
        const marketJson = await fetchMarketJSON();
        let hasMarketJson = true;
        if (!marketJson) {
            console.error("handleBattleSummary null marketAPI");
            hasMarketJson = false;
        }
        let totalPriceAsk = 0;
        let totalPriceAskBid = 0;
        let totalRawCoins = 0; // For IC

        if (hasMarketJson && message.unit.totalLootMap) {
            for (const loot of Object.values(message.unit.totalLootMap)) {
                const itemCount = loot.count;
                if (loot.itemHrid === "/items/coin") {
                    totalRawCoins += itemCount;
                }
                if (marketJson.marketData[loot.itemHrid]) {
                    totalPriceAsk += marketJson.marketData[loot.itemHrid][0].a * itemCount;
                    totalPriceAskBid += marketJson.marketData[loot.itemHrid][0].b * itemCount;
                } else {
                    console.log("handleBattleSummary failed to read price of " + loot.itemHrid);
                }
            }
        }

        let totalSkillsExp = 0;
        if (message.unit.totalSkillExperienceMap) {
            for (const exp of Object.values(message.unit.totalSkillExperienceMap)) {
                totalSkillsExp += exp;
            }
        }

        let tryTimes = 0;
        findElem();
        function findElem() {
            tryTimes++;
            let elem = document.querySelector(".BattlePanel_gainedExp__3SaCa")?.parentElement;
            if (elem) {
                // 戰鬥時長和次數
                let battleDurationSec = null;
                const combatInfoElement = document.querySelector(".BattlePanel_combatInfo__sHGCe");
                if (combatInfoElement) {
                    let matches = combatInfoElement.innerHTML.match(
                        /(戰鬥時間|戰鬥時長|Combat Duration): (?:(\d+)d\s*)?(?:(\d+)h\s*)?(?:(\d+)m\s*)?(?:(\d+)s).*?(交戰|戰鬥|Battles): (\d+).*?(戰敗|死亡次數|Deaths): (\d+)/
                    );
                    if (matches) {
                        let days = parseInt(matches[2], 10) || 0;
                        let hours = parseInt(matches[3], 10) || 0;
                        let minutes = parseInt(matches[4], 10) || 0;
                        let seconds = parseInt(matches[5], 10) || 0;
                        let battles = parseInt(matches[7], 10) - 1; // 排除當前戰鬥
                        battleDurationSec = days * 86400 + hours * 3600 + minutes * 60 + seconds;
                        let efficiencyPerHour = ((battles / battleDurationSec) * 3600).toFixed(1);
                        elem.insertAdjacentHTML(
                            "beforeend",
                            `<div id="script_battleNumbers" style="color: ${SCRIPT_COLOR_MAIN};">${
                                isZH ? "每小時戰鬥: " : "Encounters/hour: "
                            }${efficiencyPerHour}${isZH ? " 次" : ""}</div>`
                        );
                    }
                }
                // 總收入
                document
                    .querySelector("div#script_battleNumbers")
                    .insertAdjacentHTML(
                        "afterend",
                        `<div id="script_totalIncome" style="color: ${SCRIPT_COLOR_MAIN};">${isZH ? "總收穫: " : "Total revenue: "}${numberFormatter(
                            totalPriceAsk
                        )} / ${numberFormatter(totalPriceAskBid)}</div>`
                    );
                // 平均收入
                if (battleDurationSec) {
                    document
                        .querySelector("div#script_totalIncome")
                        .insertAdjacentHTML(
                            "afterend",
                            `<div id="script_averageIncome" style="color: ${SCRIPT_COLOR_MAIN};">${
                                isZH ? "每小時收穫: " : "Revenue/hour: "
                            }${numberFormatter(totalPriceAsk / (battleDurationSec / 60 / 60))} / ${numberFormatter(
                                totalPriceAskBid / (battleDurationSec / 60 / 60)
                            )}</div>`
                        );
                    document
                        .querySelector("div#script_averageIncome")
                        .insertAdjacentHTML(
                            "afterend",
                            `<div id="script_totalIncomeDay" style="color: ${SCRIPT_COLOR_MAIN};">${
                                isZH ? "每天收穫: " : "Revenue/day: "
                            }${numberFormatter((totalPriceAsk / (battleDurationSec / 60 / 60)) * 24)} / ${numberFormatter(
                                (totalPriceAskBid / (battleDurationSec / 60 / 60)) * 24
                            )}</div>`
                        );
                    document
                        .querySelector("div#script_totalIncomeDay")
                        .insertAdjacentHTML(
                            "afterend",
                            `<div id="script_avgRawCoinHour" style="color: ${SCRIPT_COLOR_MAIN};">${
                                isZH ? "每小時僅金幣收穫: " : "Raw coins/hour: "
                            }${numberFormatter(totalRawCoins / (battleDurationSec / 60 / 60))}</div>`
                        );
                }
                // 總經驗
                document
                    .querySelector("div#script_avgRawCoinHour")
                    .insertAdjacentHTML(
                        "afterend",
                        `<div id="script_totalSkillsExp" style="color: ${SCRIPT_COLOR_MAIN};">${isZH ? "總經驗: " : "Total exp: "}${numberFormatter(
                            totalSkillsExp
                        )}</div>`
                    );
                // 平均經驗
                if (battleDurationSec) {
                    document
                        .querySelector("div#script_totalSkillsExp")
                        .insertAdjacentHTML(
                            "afterend",
                            `<div id="script_averageSkillsExp" style="color: ${SCRIPT_COLOR_MAIN};">${
                                isZH ? "每小時總經驗: " : "Total exp/hour: "
                            }${numberFormatter(totalSkillsExp / (battleDurationSec / 60 / 60))}</div>`
                        );

                    [
                        { skillHrid: "/skills/magic", zhName: "魔法", enName: "Magic" },
                        { skillHrid: "/skills/ranged", zhName: "遠程", enName: "Ranged" },
                        { skillHrid: "/skills/defense", zhName: "防禦", enName: "Defense" },
                        { skillHrid: "/skills/melee", zhName: "近戰", enName: "Melee" },
                        { skillHrid: "/skills/attack", zhName: "攻擊", enName: "Attack" },
                        { skillHrid: "/skills/intelligence", zhName: "智力", enName: "Intelligence" },
                        { skillHrid: "/skills/stamina", zhName: "耐力", enName: "Stamina" },
                    ].forEach((skill) => {
                        const expGained = message.unit.totalSkillExperienceMap[skill.skillHrid];
                        if (expGained) {
                            document
                                .querySelector("div#script_totalSkillsExp")
                                .insertAdjacentHTML(
                                    "afterend",
                                    `<div style="color: ${SCRIPT_COLOR_MAIN};">${isZH ? "每小時" : ""}${isZH ? skill.zhName : skill.enName}${
                                        isZH ? "經驗: " : " exp/hour: "
                                    }${numberFormatter(expGained / (battleDurationSec / 60 / 60))}</div>`
                                );
                        }
                    });
                } else {
                    console.error("handleBattleSummary unable to display average exp due to null battleDurationSec");
                }
            } else if (tryTimes <= 10) {
                setTimeout(findElem, 200);
            } else {
                console.error("handleBattleSummary: Elem not found after 10 tries.");
            }
        }
    }

    /* 圖示上顯示裝備等級 */
    function addItemLevels() {
        const iconDivs = document.querySelectorAll("div.Item_itemContainer__x7kH1 div.Item_item__2De2O.Item_clickable__3viV6");
        for (const div of iconDivs) {
            if (div.querySelector("div.Item_name__2C42x")) {
                continue;
            }
            const href = div.querySelector("use").getAttribute("href");
            const hrefName = href.split("#")[1];
            const itemHrid = "/items/" + hrefName;
            const itemLevel = initData_itemDetailMap[itemHrid]?.itemLevel;
            const itemAbilityLevel = initData_itemDetailMap[itemHrid]?.abilityBookDetail?.levelRequirements?.[0]?.level;

            if (initData_itemDetailMap[itemHrid]?.equipmentDetail && itemLevel && itemLevel > 0) {
                if (!div.querySelector("div.script_itemLevel")) {
                    div.style.position = "relative";
                    div.insertAdjacentHTML(
                        "beforeend",
                        `<div class="script_itemLevel" style="z-index: 1; position: absolute; top: 2px; right: 2px; text-align: right; color: ${SCRIPT_COLOR_MAIN};">${itemLevel}</div>`
                    );
                }
                if (
                    !initData_itemDetailMap[itemHrid]?.equipmentDetail?.type?.includes("_tool") &&
                    div.parentElement.parentElement.parentElement.parentElement.className.includes("MarketplacePanel_marketItems__D4k7e")
                ) {
                    handleMarketItemFilter(div, initData_itemDetailMap[itemHrid]);
                }
            } else if (itemAbilityLevel && itemAbilityLevel > 0) {
                if (!div.querySelector("div.script_itemLevel")) {
                    div.style.position = "relative";
                    div.insertAdjacentHTML(
                        "beforeend",
                        `<div class="script_itemLevel" style="z-index: 1; position: absolute; top: 2px; right: 2px; text-align: right; color: ${SCRIPT_COLOR_MAIN};">${itemAbilityLevel}</div>`
                    );
                }
            } else if (settingsMap.showsKeyInfoInIcon.isTrue && (itemHrid.includes("_key_fragment") || itemHrid.includes("_key"))) {
                const map = new Map();
                map.set("/items/blue_key_fragment", isZH ? "圖3" : "Z3");
                map.set("/items/green_key_fragment", isZH ? "圖4" : "Z4");
                map.set("/items/purple_key_fragment", isZH ? "圖5" : "Z5");
                map.set("/items/white_key_fragment", isZH ? "圖6" : "Z6");
                map.set("/items/orange_key_fragment", isZH ? "圖7" : "Z7");
                map.set("/items/brown_key_fragment", isZH ? "圖8" : "Z8");
                map.set("/items/stone_key_fragment", isZH ? "圖9" : "Z9");
                map.set("/items/dark_key_fragment", isZH ? "圖10" : "Z10");
                map.set("/items/burning_key_fragment", isZH ? "圖11" : "Z11");

                map.set("/items/chimerical_entry_key", isZH ? "牢1" : "D1");
                map.set("/items/sinister_entry_key", isZH ? "牢2" : "D2");
                map.set("/items/enchanted_entry_key", isZH ? "牢3" : "D3");
                map.set("/items/pirate_entry_key", isZH ? "牢4" : "D4");

                map.set("/items/chimerical_chest_key", "3.4.5.6");
                map.set("/items/sinister_chest_key", "5.7.8.10");
                map.set("/items/enchanted_chest_key", "7.8.9.11");
                map.set("/items/pirate_chest_key", "6.9.10.11");

                if (!div.querySelector("div.script_key")) {
                    div.style.position = "relative";
                    div.insertAdjacentHTML(
                        "beforeend",
                        `<div class="script_key" style="z-index: 1; position: absolute; top: 2px; right: 2px; text-align: right; color: ${SCRIPT_COLOR_MAIN};">${map.get(
                            itemHrid
                        )}</div>`
                    );
                }
            }
        }
    }
    if (settingsMap.itemIconLevel.isTrue) {
        setInterval(addItemLevels, 500);
    }

    /* 市場物品篩選 */
    let onlyShowItemsAboveLevel = 1;
    let onlyShowItemsBelowLevel = 1000;
    let onlyShowItemsType = "all";
    let onlyShowItemsSkillReq = "all";

    function addMarketFilterButtons() {
        const oriFilter = document.querySelector(".MarketplacePanel_itemFilterContainer__3F3td");
        let filters = document.querySelector("#script_filters");
        if (oriFilter && !filters) {
            oriFilter.insertAdjacentHTML("afterend", `<div id="script_filters" style="float: left; color: ${SCRIPT_COLOR_MAIN};"></div>`);
            filters = document.querySelector("#script_filters");
            filters.insertAdjacentHTML(
                "beforeend",
                `<span id="script_filter_level" style="float: left; color: ${SCRIPT_COLOR_MAIN};">${isZH ? "等級: 大於等於 " : "Equipment level: >= "}
                <select name="script_filter_level_select" id="script_filter_level_select">
                <option value="1">All</option>
                <option value="10">10</option>
                <option value="20">20</option>
                <option value="30">30</option>
                <option value="40">40</option>
                <option value="50">50</option>
                <option value="60">60</option>
                <option value="65">65</option>
                <option value="70">70</option>
                <option value="75">75</option>
                <option value="80">80</option>
                <option value="85">85</option>
                <option value="90">90</option>
                <option value="95">95</option>
                <option value="100">100</option>
            </select>&nbsp;</span>`
            );
            filters.insertAdjacentHTML(
                "beforeend",
                `<span id="script_filter_level_to" style="float: left; color: ${SCRIPT_COLOR_MAIN};">${isZH ? "小於 " : "< "}
                <select name="script_filter_level_select_to" id="script_filter_level_select_to">
                <option value="1000">All</option>
                <option value="10">10</option>
                <option value="20">20</option>
                <option value="30">30</option>
                <option value="40">40</option>
                <option value="50">50</option>
                <option value="60">60</option>
                <option value="65">65</option>
                <option value="70">70</option>
                <option value="75">75</option>
                <option value="80">80</option>
                <option value="85">85</option>
                <option value="90">90</option>
                <option value="95">95</option>
                <option value="100">100</option>
            </select>&emsp;</span>`
            );
            filters.insertAdjacentHTML(
                "beforeend",
                `<span id="script_filter_skill" style="float: left; color: ${SCRIPT_COLOR_MAIN};">${isZH ? "職業: " : "Class: "}
                <select name="script_filter_skill_select" id="script_filter_skill_select">
                    <option value="all">All</option>
                    <option value="attack">Attack</option>
                    <option value="melee">Melee</option>
                    <option value="defense">Defense</option>
                    <option value="ranged">Ranged</option>
                    <option value="magic">Magic</option>
                    <option value="others">Others</option>
                </select>&emsp;</span>`
            );
            filters.insertAdjacentHTML(
                "beforeend",
                `<span id="script_filter_location" style="float: left; color: ${SCRIPT_COLOR_MAIN};">${isZH ? "部位: " : "Slot: "}
                <select name="script_filter_location_select" id="script_filter_location_select">
                    <option value="all">All</option>
                    <option value="main_hand">Main Hand</option>
                    <option value="off_hand">Off Hand</option>
                    <option value="two_hand">Two Hand</option>
                    <option value="head">Head</option>
                    <option value="body">Body</option>
                    <option value="hands">Hands</option>
                    <option value="legs">Legs</option>
                    <option value="feet">Feet</option>
                    <option value="neck">Neck</option>
                    <option value="earrings">Earrings</option>
                    <option value="ring">Ring</option>
                    <option value="pouch">Pouch</option>
                    <option value="back">Back</option>
                </select>&emsp;</span>`
            );

            const levelFilter = document.querySelector("#script_filter_level_select");
            levelFilter.addEventListener("change", function () {
                if (levelFilter.value && !isNaN(levelFilter.value)) {
                    onlyShowItemsAboveLevel = Number(levelFilter.value);
                }
            });
            const levelToFilter = document.querySelector("#script_filter_level_select_to");
            levelToFilter.addEventListener("change", function () {
                if (levelToFilter.value && !isNaN(levelToFilter.value)) {
                    onlyShowItemsBelowLevel = Number(levelToFilter.value);
                }
            });
            const skillFilter = document.querySelector("#script_filter_skill_select");
            skillFilter.addEventListener("change", function () {
                if (skillFilter.value) {
                    onlyShowItemsSkillReq = skillFilter.value;
                }
            });
            const locationFilter = document.querySelector("#script_filter_location_select");
            locationFilter.addEventListener("change", function () {
                if (locationFilter.value) {
                    onlyShowItemsType = locationFilter.value;
                }
            });
        }
    }
    if (settingsMap.marketFilter.isTrue) {
        setInterval(addMarketFilterButtons, 500);
    }

    function handleMarketItemFilter(div, itemDetal) {
        if (!itemDetal.equipmentDetail) {
            return;
        }

        const itemLevel = itemDetal.itemLevel;
        const type = itemDetal.equipmentDetail.type;
        const levelRequirements = itemDetal.equipmentDetail.levelRequirements;

        let isType = false;
        isType = type && type.includes(onlyShowItemsType);
        if (onlyShowItemsType === "all") {
            isType = true;
        }

        let isRequired = false;
        for (const requirement of levelRequirements) {
            if (requirement.skillHrid.includes(onlyShowItemsSkillReq)) {
                isRequired = true;
            }
        }
        if (onlyShowItemsSkillReq === "others") {
            const combatTypes = ["attack", "melee", "defense", "ranged", "magic"];
            isRequired = !combatTypes.some((type) => {
                for (const requirement of levelRequirements) {
                    if (requirement.skillHrid.includes(type)) {
                        return true;
                    }
                }
            });
        }
        if (onlyShowItemsSkillReq === "all") {
            isRequired = true;
        }

        if (itemLevel >= onlyShowItemsAboveLevel && itemLevel < onlyShowItemsBelowLevel && isType && isRequired) {
            div.style.display = "block";
        } else {
            div.style.display = "none";
        }
    }

    /* 任務卡片顯示戰鬥地圖序號 */
    function handleTaskCard() {
        const taskNameDivs = document.querySelectorAll("div.RandomTask_randomTask__3B9fA div.RandomTask_name__1hl1b");
        for (const div of taskNameDivs) {
            if (div.querySelector("span.script_taskMapIndex")) {
                continue;
            }

            const taskStr = getOriTextFromElement(div);
            if (!taskStr.startsWith("Defeat - ") && !taskStr.startsWith("擊敗 - ")) {
                continue;
            }

            let monsterName = taskStr.replace("Defeat - ", "").replace("擊敗 - ", "");
            let actionHrid = null;
            if (isZHInGameSetting) {
                actionHrid = (
                    getOthersFromZhName(monsterName) ? getOthersFromZhName(monsterName) : getActionEnNameFromZhName(monsterName)
                )?.replaceAll("/monsters/", "/actions/combat/");
            }

            let actionObj = null;
            for (const action of Object.values(initData_actionDetailMap)) {
                if (action.hrid.includes("/combat/")) {
                    if (action.hrid === actionHrid || action.name.toLowerCase() === monsterName.toLowerCase()) {
                        actionObj = action;
                        break;
                    } else if (action.combatZoneInfo.fightInfo.battlesPerBoss === 10) {
                        if (
                            actionHrid?.replaceAll("/actions/combat/", "/monsters/") ===
                                action.combatZoneInfo.fightInfo.bossSpawns[0].combatMonsterHrid ||
                            "/monsters/" + monsterName.toLowerCase().replaceAll(" ", "_") ===
                                action.combatZoneInfo.fightInfo.bossSpawns[0].combatMonsterHrid
                        ) {
                            actionObj = action;
                            break;
                        }
                    }
                }
            }
            const actionCategoryHrid = actionObj?.category;
            const index = initData_actionCategoryDetailMap?.[actionCategoryHrid]?.sortIndex;
            if (index) {
                div.insertAdjacentHTML(
                    "beforeend",
                    `<span class="script_taskMapIndex" style="text-align: right; color: ${SCRIPT_COLOR_MAIN};"> ${isZH ? "圖" : "Z"}${index}</span>`
                );
            }
        }
    }
    if (settingsMap.taskMapIndex.isTrue) {
        setInterval(handleTaskCard, 500);
    }

    /* 顯示戰鬥地圖序號 */
    function addIndexToMaps() {
        const buttons = document.querySelectorAll(
            "div.MainPanel_subPanelContainer__1i-H9 div.CombatPanel_tabsComponentContainer__GsQlg div.MuiTabs-root.MuiTabs-vertical.css-6x4ics button.MuiButtonBase-root.MuiTab-root.MuiTab-textColorPrimary.css-1q2h7u5 span.MuiBadge-root.TabsComponent_badge__1Du26.css-1rzb3uu"
        );
        let index = 1;
        for (const button of buttons) {
            if (!button.querySelector("span.script_mapIndex")) {
                button.insertAdjacentHTML("afterbegin", `<span class="script_mapIndex" style="color: ${SCRIPT_COLOR_MAIN};">${index++}. </span>`);
            }
        }
    }
    if (settingsMap.mapIndex.isTrue) {
        setInterval(addIndexToMaps, 500);
    }

    /* 物品詞典視窗顯示還需多少技能書到X級 */
    const waitForItemDict = () => {
        const targetNode = document.querySelector("div.GamePage_gamePage__ixiPl");
        if (targetNode) {
            console.log("start observe item dict");
            const itemDictPanelObserver = new MutationObserver(async function (mutations) {
                for (const mutation of mutations) {
                    for (const added of mutation.addedNodes) {
                        if (
                            added?.classList?.contains("ItemDictionary_modalWrapper__1Ywn2") &&
                            added.querySelector("div.ItemDictionary_modalContent__WvEBY")
                        ) {
                            handleItemDict(added.querySelector("div.ItemDictionary_modalContent__WvEBY"));
                        }
                    }
                }
            });
            itemDictPanelObserver.observe(targetNode, { attributes: false, childList: true, subtree: true });
        } else {
            setTimeout(waitForItemDict, 200);
        }
    };

    async function handleItemDict(panel) {
        let abilityHrid = null;

        // 優先從物品圖示取得不受語言影響的 HRID。繁體中文名稱可能和原版字典不同，
        // 因此不應再用顯示名稱作為唯一識別方式。
        const iconHref = panel.querySelector("use")?.getAttribute("href") || panel.querySelector("use")?.getAttribute("xlink:href") || "";
        const iconId = iconHref.includes("#") ? iconHref.split("#").at(-1) : "";
        const iconItemHrid = iconId ? `/items/${iconId}` : "";
        if (initData_itemDetailMap[iconItemHrid]?.abilityBookDetail) {
            abilityHrid = iconItemHrid.replace("/items/", "/abilities/");
        }

        const titleElement = panel.querySelector('h1[class*="ItemDictionary_title"]');
        if (!abilityHrid && isZHInGameSetting && titleElement) {
            abilityHrid = getOthersFromZhName(titleElement.textContent);
        } else if (!abilityHrid && titleElement) {
            const itemName = getOriTextFromElement(titleElement)
                .toLowerCase()
                .replaceAll(" ", "_")
                .replaceAll("'", "");
            for (const skillHrid of Object.keys(initData_abilityDetailMap)) {
                if (skillHrid.includes("/" + itemName)) {
                    abilityHrid = skillHrid;
                }
            }
        }
        if (!abilityHrid) {
            return;
        }

        const itemHrid = abilityHrid.replace("/abilities/", "/items/");
        const abilityPerBookExp = initData_itemDetailMap[itemHrid]?.abilityBookDetail?.experienceGain;
        if (!Number.isFinite(abilityPerBookExp) || abilityPerBookExp <= 0 || panel.querySelector("#tillLevel")) {
            return;
        }

        let currentLevel = 0;
        let currentExp = 0;
        for (const a of Object.values(initData_characterAbilities)) {
            if (a.abilityHrid === abilityHrid) {
                currentLevel = a.level;
                currentExp = a.experience;
            }
        }

        const getNeedBooksToLevel = (currentLevel, currentExp, targetLevel, abilityPerBookExp) => {
            const needExp = initData_levelExperienceTable[targetLevel] - currentExp;
            let needBooks = needExp / abilityPerBookExp;
            if (currentLevel === 0) {
                needBooks += 1;
            }
            return (Math.ceil(needBooks * 10) / 10).toFixed(1);
        };

        let numBooks = getNeedBooksToLevel(currentLevel, currentExp, currentLevel + 1, abilityPerBookExp);

        const marketAPIJson = await fetchMarketJSON();
        const marketEntry = marketAPIJson?.marketData?.[itemHrid]?.[0] || {};
        const ask = marketEntry.a || 0;
        const bid = marketEntry.b || 0;

        let hTMLStr = `<div id="tillLevel" style="color: ${SCRIPT_COLOR_MAIN}; text-align: left;">${
            isZH ? "到 " : "To "
        }<input id="tillLevelInput" type="number" value="${currentLevel + 1}" min="${currentLevel + 1}" max="200">${
            isZH ? " 級還需 " : " level need "
        }
        <span id="tillLevelNumber">${numBooks} (${numberFormatter(numBooks * ask)} / ${numberFormatter(numBooks * bid)})</span>
        <div>${isZH ? " 本書 (重新整理網頁更新當前等級)" : " books (Refresh page to update current level.)"}</div>
        </div>`;
        panel.insertAdjacentHTML("beforeend", hTMLStr);

        const tillLevelInput = panel.querySelector("input#tillLevelInput");
        const tillLevelNumber = panel.querySelector("span#tillLevelNumber");
        tillLevelInput.onchange = () => {
            const targetLevel = Number(tillLevelInput.value);
            if (targetLevel > currentLevel && targetLevel <= 200) {
                let numBooks = getNeedBooksToLevel(currentLevel, currentExp, targetLevel, abilityPerBookExp);
                tillLevelNumber.textContent = `${numBooks} (${numberFormatter(numBooks * ask)} / ${numberFormatter(numBooks * bid)})`;
            } else {
                tillLevelNumber.textContent = "Error";
            }
        };
        tillLevelInput.addEventListener("keyup", function (evt) {
            const targetLevel = Number(tillLevelInput.value);
            if (targetLevel > currentLevel && targetLevel <= 200) {
                let numBooks = getNeedBooksToLevel(currentLevel, currentExp, targetLevel, abilityPerBookExp);
                tillLevelNumber.textContent = `${numBooks} (${numberFormatter(numBooks * ask)} / ${numberFormatter(numBooks * bid)})`;
            } else {
                tillLevelNumber.textContent = "Error";
            }
        });
    }

    /* 新增第三方網站連結 */
    function add3rdPartyLinks() {
        const waitForNavi = () => {
            const targetNode = document.querySelector("div.NavigationBar_minorNavigationLinks__dbxh7");
            if (targetNode) {
                let div = document.createElement("div");
                div.setAttribute("class", "NavigationBar_minorNavigationLink__31K7Y");
                div.style.color = SCRIPT_COLOR_MAIN;
                div.innerHTML = isZH ? "插件設定" : "Script settings";
                div.addEventListener("click", () => {
                    const array = document.querySelectorAll(".NavigationBar_navigationLink__3eAHA");
                    array[array.length - 1]?.click();
                });
                targetNode.insertAdjacentElement("afterbegin", div);

                if (isZH) {
                    div = document.createElement("div");
                    div.setAttribute("class", "NavigationBar_minorNavigationLink__31K7Y");
                    div.style.color = SCRIPT_COLOR_MAIN;
                    div.innerHTML = isZH ? "牛牛手冊" : "牛牛手冊";
                    div.addEventListener("click", () => {
                        window.open("https://test-ctmd6jnzo6t9.feishu.cn/docx/KG9ddER6Eo2uPoxJFkicsvbEnCe", "_blank");
                    });
                    targetNode.insertAdjacentElement("afterbegin", div);
                }

                div = document.createElement("div");
                div.setAttribute("class", "NavigationBar_minorNavigationLink__31K7Y");
                div.style.color = SCRIPT_COLOR_MAIN;
                div.innerHTML = isZH ? "利潤計算 Mooneycalc" : "Profit calc Mooneycalc";
                div.addEventListener("click", () => {
                    window.open("https://mooneycalc.netlify.app/", "_blank");
                });
                targetNode.insertAdjacentElement("afterbegin", div);

                div = document.createElement("div");
                div.setAttribute("class", "NavigationBar_minorNavigationLink__31K7Y");
                div.style.color = SCRIPT_COLOR_MAIN;
                div.innerHTML = isZH ? "利潤計算 Milkonomy" : "Profit calc Milkonomy";
                div.addEventListener("click", () => {
                    window.open("https://milkonomy.pages.dev/", "_blank");
                });
                targetNode.insertAdjacentElement("afterbegin", div);

                div = document.createElement("div");
                div.setAttribute("class", "NavigationBar_minorNavigationLink__31K7Y");
                div.style.color = SCRIPT_COLOR_MAIN;
                div.innerHTML = isZH ? "利潤計算 Cowculator" : "Profit calc Cowculator";
                div.addEventListener("click", () => {
                    window.open("https://danthegoodman.github.io/cowculator/", "_blank");
                });
                targetNode.insertAdjacentElement("afterbegin", div);

                div = document.createElement("div");
                div.setAttribute("class", "NavigationBar_minorNavigationLink__31K7Y");
                div.style.color = SCRIPT_COLOR_MAIN;
                div.innerHTML = isZH ? "強化模擬 Enhancelator" : "Enhancement sim Enhancelator";
                div.addEventListener("click", () => {
                    window.open("https://doh-nuts.github.io/Enhancelator/", "_blank");
                });
                targetNode.insertAdjacentElement("afterbegin", div);

                div = document.createElement("div");
                div.setAttribute("class", "NavigationBar_minorNavigationLink__31K7Y");
                div.style.color = SCRIPT_COLOR_MAIN;
                div.innerHTML = isZH ? "戰鬥榜 socko" : "Combat Tracker socko";
                div.addEventListener("click", () => {
                    window.open("https://sockosnewcombattracker.pages.dev/", "_blank");
                });
                targetNode.insertAdjacentElement("afterbegin", div);

                div = document.createElement("div");
                div.setAttribute("class", "NavigationBar_minorNavigationLink__31K7Y");
                div.style.color = SCRIPT_COLOR_MAIN;
                div.innerHTML = isZH ? "戰鬥模擬 shykai" : "Combat sim shykai";
                div.addEventListener("click", () => {
                    window.open("https://shykai.github.io/MWICombatSimulatorTest/dist/", "_blank");
                });
                targetNode.insertAdjacentElement("afterbegin", div);

                div = document.createElement("div");
                div.setAttribute("class", "NavigationBar_minorNavigationLink__31K7Y");
                div.style.color = SCRIPT_COLOR_MAIN;
                div.innerHTML = isZH ? "戰鬥模擬 神龕版" : "Combat sim Shrine edition";
                div.addEventListener("click", () => {
                    window.open("https://szerra.github.io/mwi-shrine-combat-simulator/", "_blank");
                });
                targetNode.insertAdjacentElement("afterbegin", div);
            } else {
                setTimeout(add3rdPartyLinks, 200);
            }
        };
        waitForNavi();
    }

    /* 動作列表選單計算時間 */
    function handleActionQueueMenue(added) {
        if (!settingsMap.actionQueue.isTrue) {
            return;
        }

        handleActionQueueMenueCalculateTime(added);

        const listDiv = added.querySelector(".QueuedActions_actions__2Lur6");
        new MutationObserver((mutationsList) => {
            handleActionQueueMenueCalculateTime(added);
        }).observe(listDiv, { characterData: false, subtree: false, childList: true });
    }

    function handleActionQueueMenueCalculateTime(added) {
        const actionDivList = added.querySelectorAll("div.QueuedActions_action__r3HlD");
        if (!actionDivList || actionDivList.length === 0) {
            return;
        }
        if (actionDivList.length !== currentActionsHridList.length - 1) {
            console.error("handleActionQueueTooltip action queue length inconsistency");
            return;
        }

        let actionDivListIndex = 0;
        let hasSkippedfirstActionObj = false;
        let accumulatedTimeSec = 0;
        let isAccumulatedTimeInfinite = false;
        for (const actionObj of currentActionsHridList) {
            const actionHrid = actionObj.actionHrid;
            const count = actionObj.maxCount - actionObj.currentCount;
            let isInfinit = false;
            if (count === 0 || actionHrid.includes("/combat/")) {
                isInfinit = true;
                isAccumulatedTimeInfinite = true;
            }

            const baseTimePerActionSec = initData_actionDetailMap[actionHrid].baseTimeCost / 1000000000;
            const totalEffBuff = getTotalEffiPercentage(actionHrid);
            const toolSpeedBuff = getToolsSpeedBuffByActionHrid(actionHrid);

            let timePerActionSec = baseTimePerActionSec / (1 + toolSpeedBuff / 100);
            timePerActionSec /= 1 + totalEffBuff / 100;
            let totalTimeSec = count * timePerActionSec;

            let str = isZH ? "到 ∞ " : "Complete at ∞ ";
            if (!isAccumulatedTimeInfinite) {
                accumulatedTimeSec += totalTimeSec;
                const currentTime = new Date();
                currentTime.setSeconds(currentTime.getSeconds() + accumulatedTimeSec);
                str = `${isZH ? "到 " : "Complete at "}${String(currentTime.getHours()).padStart(2, "0")}:${String(currentTime.getMinutes()).padStart(
                    2,
                    "0"
                )}:${String(currentTime.getSeconds()).padStart(2, "0")}`;
            }

            if (hasSkippedfirstActionObj) {
                const html = `<div class="script_actionTime" style="color: ${SCRIPT_COLOR_MAIN};">${
                    isInfinit ? "[ ∞ ] " : `[${timeReadable(totalTimeSec)}]`
                } ${str}</div>`;
                if (actionDivList[actionDivListIndex].querySelector("div div.script_actionTime")) {
                    actionDivList[actionDivListIndex].querySelector("div div.script_actionTime").innerHTML = html;
                } else {
                    actionDivList[actionDivListIndex].querySelector("div").insertAdjacentHTML("beforeend", html);
                }
                actionDivListIndex++;
            }
            hasSkippedfirstActionObj = true;
        }
        const html = `<div id="script_queueTotalTime" style="color: ${SCRIPT_COLOR_MAIN};">${isZH ? "總時間：" : "Total time: "}${
            isAccumulatedTimeInfinite ? "[ ∞ ] " : `[${timeReadable(accumulatedTimeSec)}]`
        }</div>`;
        if (document.querySelector("div#script_queueTotalTime")) {
            document.querySelector("div#script_queueTotalTime").innerHTML = html;
        } else {
            document.querySelector("div.QueuedActions_queuedActionsEditMenu__3OoQH").insertAdjacentHTML("afterend", html);
        }
    }

    /* 支援修改版漢化插件 */
    function getOriTextFromElement(elem) {
        if (!elem) {
            console.error("getTextFromElement null elem");
            return "";
        }
        const translatedfrom = elem.getAttribute("script_translatedfrom");
        if (translatedfrom) {
            return translatedfrom;
        }
        return elem.textContent;
    }

    /* 強化模擬器 */
    async function handleItemTooltipWithEnhancementLevel(tooltip) {
        if (!settingsMap.enhanceSim.isTrue) {
            return;
        }

        if (typeof math === "undefined") {
            console.error(`handleItemTooltipWithEnhancementLevel no math lib`);
            tooltip
                .querySelector(".ItemTooltipText_itemTooltipText__zFq3A")
                .insertAdjacentHTML(
                    "beforeend",
                    `<div style="color: ${SCRIPT_COLOR_ALERT};">${
                        isZH ? "由於網路問題無法強化模擬: 1. 手機可能不支援指令碼聯網；2. 請嘗試科學網路；" : "Enhancement sim Internet error"
                    }</div>`
                );
            return;
        }

        const itemNameElems = tooltip.querySelectorAll("div.ItemTooltipText_name__2JAHA span");
        let itemName = getOriTextFromElement(itemNameElems[0]);
        if (isZHInGameSetting) {
            itemName = getItemEnNameFromZhName(itemName);
        }
        const enhancementLevel = Number(itemNameElems[1].textContent.replace("+", ""));

        let itemHrid = itemEnNameToHridMap[itemName];
        if (!itemHrid || !initData_itemDetailMap[itemHrid]) {
            console.error(`handleItemTooltipWithEnhancementLevel invalid itemHrid ${itemName} ${itemHrid}`);
            return;
        }

        input_data.item_hrid = itemHrid;
        input_data.stop_at = enhancementLevel;
        const best = await findBestEnhanceStratWithPhiMirror(input_data);

        let appendHTMLStr = `<div style="color: ${SCRIPT_COLOR_TOOLTIP};">${
            isZH ? "不支援模擬+1裝備" : "Enhancement sim of +1 equipments not supported"
            }</div>`;
        if (best) {
            let needMatStr = "";
            if (best.costs.needMap) {
                for (const [key, value] of Object.entries(best.costs.needMap)) {
                    needMatStr += `<div>${isZH ? ZHItemNames[initData_itemDetailMap[key].hrid] : initData_itemDetailMap[key].name} ${isZH ? "單價: " : "price per item: "}${numberFormatter(value)}<div>`;
                }
            }
            appendHTMLStr = `<div style="color: ${SCRIPT_COLOR_TOOLTIP};"><div>${
                isZH
                ? "強化模擬（預設125級強化，6級房子，10級星空工具，10級手套，究極茶，幸運茶，賣單價收貨，不包括工時費，不包括市場稅）："
                : "Enhancement simulator: Default level 12 enhancing, level 6 house, level 10 celestial tool, level 10 gloves, ultra tea, blessed tea, sell order price in, no player time fee, no market tax: "
            }</div><div>${isZH ? "總成本 " : "Total cost "}${numberFormatter(best.totalCost.toFixed(0))}</div>
            <div>${isZH ? "耗時 " : "Time spend "}${best.simResult.totalActionTimeStr}</div>
            ${
                best.protect_count > 0
                    ? `<div>${isZH ? "從 " : "Use protection from level "}` + best.protect_at + `${isZH ? " 級開始保護" : ""}</div>`
                    : `<div>${isZH ? "不需要保護" : "No protection use"}</div>`
            }
            <div>${isZH ? "保護 " : "Protection "}${best.protect_count.toFixed(1)}${isZH ? " 次" : " times"}</div>
            ${
                best.costs.inputCount 
                    ? `<div>+${best.protect_at}${isZH ? "底子價格: " : " Base item Price: "}${numberFormatter(best.costs.baseCost)}</div>` +
                      `<div>+${best.protect_at}${isZH ? "底子數量: " : " Base item Count: "}${numberFormatter(best.costs.baseCount)}</div>` +
                      `<div>+${best.protect_at-1}${isZH ? "材料價格: " : " Base item Price: "}${numberFormatter(best.costs.inputCost)}</div>` +
                      `<div>+${best.protect_at-1}${isZH ? "材料數量: " : " Base item Count: "}${numberFormatter(best.costs.inputCount)}</div>`
                    : `<div>${isZH ? "+0底子價格: " : "+0 Base item Price: "}${numberFormatter(best.costs.baseCost)}</div>`
            }
            <div>${
                best.protect_count > 0
                    ? (isZH ? "保護單價: " : "Price per protection: ") +
                     (isZH ? ZHItemNames[initData_itemDetailMap[best.costs.choiceOfProtection].hrid] : initData_itemDetailMap[best.costs.choiceOfProtection].name) +
                    " " +
                    numberFormatter(best.costs.minProtectionCost)
                    : ""
                }
             </div>${needMatStr}</div>`;
        }

        tooltip.querySelector(".ItemTooltipText_itemTooltipText__zFq3A").insertAdjacentHTML("beforeend", appendHTMLStr);
    }

    async function findBestEnhanceStratWithPhiMirror(input_data) {
        const price_data = await fetchMarketJSON();
        if (!price_data || !price_data.marketData) {
            console.error("findBestEnhanceStrat fetchMarketJSON null");
            return null;
        }

        let best = await findBestEnhanceStrat(input_data);
        if (!best) {
            return best;
        }

        const pMirrorHrid = "/items/philosophers_mirror";
        const pMirrorCost = getItemMarketPrice(pMirrorHrid, price_data);
        if (pMirrorCost <= 0) {
            return best;
        }

        const enhancementLevel = input_data.stop_at;
        if (enhancementLevel <= 3) {
            return best;
        }

        const keyRefined = "_refined";
        const refinedHrid = input_data.item_hrid;
        const isRefined = input_data.item_hrid.includes(keyRefined);

        input_data.item_hrid = isRefined ? input_data.item_hrid.replace(keyRefined, "") : input_data.item_hrid;

        const lowerBest = {};
        const lowestAt = 9; // from 9 begin
        for (let i = lowestAt; i < enhancementLevel; i++) {
            input_data.stop_at = i;
            lowerBest[i] = await findBestEnhanceStrat(input_data);
        }

        const refinedNeedMap = {};
        let refinedCost = 0;
        if (isRefined) {
            const actionHrid = getActionHridFromItemName(initData_itemDetailMap[refinedHrid].name);
            if (actionHrid && initData_actionDetailMap[actionHrid].inputItems && initData_actionDetailMap[actionHrid].inputItems.length > 0) {
                const inputItems = JSON.parse(JSON.stringify(initData_actionDetailMap[actionHrid].inputItems));
                for (const item of inputItems) {
                    refinedNeedMap[item.itemHrid] = getItemMarketPrice(item.itemHrid, price_data);
                    refinedCost += getItemMarketPrice(item.itemHrid, price_data) * item.count;
                }
            }
        }

        const allResults = [];
        for (let protect_at = lowestAt+1; protect_at < enhancementLevel; protect_at++)
        {
            const fibonacci = [ 0,1,1,2,3,5,8,13,21,34,55,89,144,233,377,610,987,1597,2584,4181];

            const baseCount = fibonacci[enhancementLevel - protect_at + 1];
            const inputCount = fibonacci[enhancementLevel - protect_at];
            const protectCount = baseCount + inputCount - 1;

            const totalCost = baseCount * lowerBest[protect_at].totalCost + inputCount * lowerBest[protect_at-1].totalCost + pMirrorCost * protectCount + refinedCost;

            const cost = {
                minProtectionCost: pMirrorCost,
                choiceOfProtection: pMirrorHrid,
                baseCost: lowerBest[protect_at].totalCost,
                baseCount: baseCount,
                inputCost : lowerBest[protect_at-1].totalCost,
                inputCount : inputCount,
                needMap : refinedNeedMap
            };

            const itemLevel = initData_itemDetailMap[input_data.item_hrid].itemLevel;
            const effective_level =
                input_data.enhancing_level +
                (input_data.tea_enhancing ? 3 : 0) +
                (input_data.tea_super_enhancing ? 6 : 0) +
                (input_data.tea_ultra_enhancing ? 8 : 0);
            const perActionTimeSec = (
                12 /
                (1 +
                    (input_data.enhancing_level > itemLevel
                        ? (effective_level + input_data.laboratory_level - itemLevel + input_data.glove_bonus) / 100
                        : (input_data.laboratory_level + input_data.glove_bonus) / 100))
            ).toFixed(2);
            const totalActionTimeSec = protectCount * perActionTimeSec;
            const simResult = {
                totalActionTimeStr: timeReadable(totalActionTimeSec)
            };

            const r = {};
            r.protect_at = protect_at;
            r.protect_count = protectCount;
            r.intput_count = inputCount;
            r.simResult = simResult;
            r.costs = cost;
            r.totalCost = totalCost;
            allResults.push(r);
        }

        for (const r of allResults) {
            if (r.totalCost < best.totalCost) {
                best = r;
            }
        }
        return best;
    }

    async function findBestEnhanceStrat(input_data) {
        const price_data = await fetchMarketJSON();
        if (!price_data || !price_data.marketData) {
            console.error("findBestEnhanceStrat fetchMarketJSON null");
            return [];
        }

        const allResults = [];
        for (let protect_at = 2; protect_at <= input_data.stop_at; protect_at++) {
            const simResult = Enhancelate(input_data, protect_at);
            const costs = getCosts(input_data.item_hrid, price_data);
            const totalCost = costs.baseCost + costs.minProtectionCost * simResult.protect_count + costs.perActionCost * simResult.actions;
            const r = {};
            r.protect_at = protect_at;
            r.protect_count = simResult.protect_count;
            r.simResult = simResult;
            r.costs = costs;
            r.totalCost = totalCost;
            allResults.push(r);
        }

        let best = null;
        for (const r of allResults) {
            if (best === null || r.totalCost < best.totalCost) {
                best = r;
            }
        }
        return best;
    }

    // Source: https://doh-nuts.github.io/Enhancelator/
    function Enhancelate(input_data, protect_at) {
        const success_rate = [
            50, //+1
            45, //+2
            45, //+3
            40, //+4
            40, //+5
            40, //+6
            35, //+7
            35, //+8
            35, //+9
            35, //+10
            30, //+11
            30, //+12
            30, //+13
            30, //+14
            30, //+15
            30, //+16
            30, //+17
            30, //+18
            30, //+19
            30, //+20
        ];

        // 物品等級
        const itemLevel = initData_itemDetailMap[input_data.item_hrid].itemLevel;

        // 總強化buff
        let total_bonus = null;
        const effective_level =
            input_data.enhancing_level +
            (input_data.tea_enhancing ? 3 : 0) +
            (input_data.tea_super_enhancing ? 6 : 0) +
            (input_data.tea_ultra_enhancing ? 8 : 0);
        if (effective_level >= itemLevel) {
            total_bonus = 1 + (0.05 * (effective_level + input_data.laboratory_level - itemLevel) + input_data.enhancer_bonus) / 100;
        } else {
            total_bonus = 1 - 0.5 * (1 - effective_level / itemLevel) + (0.05 * input_data.laboratory_level + input_data.enhancer_bonus) / 100;
        }

        // 模擬
        let markov = math.zeros(20, 20);
        for (let i = 0; i < input_data.stop_at; i++) {
            const success_chance = (success_rate[i] / 100.0) * total_bonus;
            const destination = i >= protect_at ? i - 1 : 0;
            if (input_data.tea_blessed) {
                markov.set([i, i + 2], success_chance * 0.01);
                markov.set([i, i + 1], success_chance * 0.99);
                markov.set([i, destination], 1 - success_chance);
            } else {
                markov.set([i, i + 1], success_chance);
                markov.set([i, destination], 1.0 - success_chance);
            }
        }
        markov.set([input_data.stop_at, input_data.stop_at], 1.0);
        let Q = markov.subset(math.index(math.range(0, input_data.stop_at), math.range(0, input_data.stop_at)));
        const M = math.inv(math.subtract(math.identity(input_data.stop_at), Q));
        const attemptsArray = M.subset(math.index(math.range(0, 1), math.range(0, input_data.stop_at)));
        const attempts = math.flatten(math.row(attemptsArray, 0).valueOf()).reduce((a, b) => a + b, 0);
        const protectAttempts = M.subset(math.index(math.range(0, 1), math.range(protect_at, input_data.stop_at)));
        const protectAttemptsArray = typeof protectAttempts === "number" ? [protectAttempts] : math.flatten(math.row(protectAttempts, 0).valueOf());
        const protects = protectAttemptsArray.map((a, i) => a * markov.get([i + protect_at, i + protect_at - 1])).reduce((a, b) => a + b, 0);

        // 動作時間
        const perActionTimeSec = (
            12 /
            (1 +
                (input_data.enhancing_level > itemLevel
                    ? (effective_level + input_data.laboratory_level - itemLevel + input_data.glove_bonus) / 100
                    : (input_data.laboratory_level + input_data.glove_bonus) / 100))
        ).toFixed(2);

        const result = {};
        result.actions = attempts;
        result.protect_count = protects;
        result.totalActionTimeSec = perActionTimeSec * attempts;
        result.totalActionTimeStr = timeReadable(result.totalActionTimeSec);
        return result;
    }

    // 自定義強化模擬輸入引數
    // Customization
    let input_data = {
        item_hrid: null,
        stop_at: null,

        enhancing_level: 125, // 人物 Enhancing 技能等級
        laboratory_level: 6, // 房子等級
        enhancer_bonus: 5.42, // 工具提高成功率，10級星空強化工具
        glove_bonus: 12.9, // 手套提高強化速度，0級=10，5級=11.2，10級=12.9

        tea_enhancing: false, // 強化茶
        tea_super_enhancing: false, // 超級強化茶
        tea_ultra_enhancing: true,
        tea_blessed: true, // 祝福茶

        priceAskBidRatio: 1, // 取市場賣單價買單價比例，1=只用賣單價，0=只用買單價
    };

    function getCosts(hrid, price_data) {
        const itemDetailObj = initData_itemDetailMap[hrid];

        // +0本體成本
        const baseCost = getRealisticBaseItemPrice(hrid, price_data);

        // 保護成本
        let minProtectionPrice = null;
        let minProtectionHrid = null;
        let protect_item_hrids =
            itemDetailObj.protectionItemHrids == null
                ? [hrid, "/items/mirror_of_protection"]
                : [hrid, "/items/mirror_of_protection"].concat(itemDetailObj.protectionItemHrids);
        protect_item_hrids.forEach((protection_hrid, i) => {
            const this_cost = getRealisticBaseItemPrice(protection_hrid, price_data);
            if (i === 0) {
                minProtectionPrice = this_cost;
                minProtectionHrid = protection_hrid;
            } else {
                if (this_cost > 0 && (minProtectionPrice < 0 || this_cost < minProtectionPrice)) {
                    minProtectionPrice = this_cost;
                    minProtectionHrid = protection_hrid;
                }
            }
        });

        // 強化材料成本
        const needMap = {};
        let totalNeedPrice = 0;
        for (const need of itemDetailObj.enhancementCosts) {
            const price = need.itemHrid.startsWith("/items/trainee_") ? 250000 : getItemMarketPrice(need.itemHrid, price_data); // Trainee charms have a fixed price of 250k
            totalNeedPrice += price * need.count;
            if (!need.itemHrid.includes("/coin")) {
                needMap[need.itemHrid] = price;
            }
        }

        return {
            baseCost: baseCost,
            minProtectionCost: minProtectionPrice,
            perActionCost: totalNeedPrice,
            choiceOfProtection: minProtectionHrid,
            needMap: needMap,
        };
    }

    function getRealisticBaseItemPrice(hrid, price_data) {
        const itemDetailObj = initData_itemDetailMap[hrid];
        const productionCost = getBaseItemProductionCost(itemDetailObj.name, price_data); // Inacuracy warning: productionCost is unreliable, it may be low or 0 due to missing market data.

        const item_price_data = price_data.marketData[hrid];
        const ask = item_price_data?.[0]?.a;
        const bid = item_price_data?.[0]?.b;

        let result = 0;

        if (ask && ask > 0) {
            if (bid && bid > 0) {
                // Both ask and bid.
                if (ask / bid > 1.3) {
                    result = Math.max(bid, productionCost);
                } else {
                    result = ask;
                }
            } else {
                // Only ask.
                if (ask / productionCost > 1.3) {
                    result = productionCost;
                } else {
                    result = Math.max(ask, productionCost);
                }
            }
        } else {
            if (bid && bid > 0) {
                // Only bid.
                result = Math.max(bid, productionCost);
            } else {
                // Neither ask nor bid.
                result = productionCost;
            }
        }

        return result;
    }

    function getItemMarketPrice(hrid, price_data) {
        const item_price_data = price_data.marketData[hrid];

        // Return 0 if the item does not have neither ask nor bid prices for enhancement level 0.
        if (!item_price_data || !item_price_data[0] || (item_price_data[0].a < 0 && item_price_data[0].b < 0)) {
            return 0;
        }

        // Return the other price if the item does not have ask or bid price.
        let ask = item_price_data[0]?.a;
        let bid = item_price_data[0]?.b;
        if (ask > 0 && bid < 0) {
            return ask;
        }
        if (bid > 0 && ask < 0) {
            return bid;
        }

        let final_cost = ask * input_data.priceAskBidRatio + bid * (1 - input_data.priceAskBidRatio);
        return final_cost;
    }

    // +0底子製作成本，僅單層製作，考慮茶減少消耗
    function getBaseItemProductionCost(itemName, price_data) {
        const actionHrid = getActionHridFromItemName(itemName);
        if (!actionHrid || !initData_actionDetailMap[actionHrid]) {
            return -1;
        }

        let totalPrice = 0;

        const inputItems = JSON.parse(JSON.stringify(initData_actionDetailMap[actionHrid].inputItems));
        for (let item of inputItems) {
            totalPrice += getItemMarketPrice(item.itemHrid, price_data) * item.count;
        }
        totalPrice *= 0.9; // 茶減少消耗

        const upgradedFromItemHrid = initData_actionDetailMap[actionHrid]?.upgradeItemHrid;
        if (upgradedFromItemHrid) {
            totalPrice += getItemMarketPrice(upgradedFromItemHrid, price_data) * 1;
        }

        return totalPrice;
    }

    /* 指令碼設定面板 */
    const waitForSetttins = () => {
        const targetNode = document.querySelector("div.SettingsPanel_profileTab__214Bj");
        if (targetNode) {
            if (!targetNode.querySelector("#script_settings")) {
                targetNode.insertAdjacentHTML("beforeend", `<div id="script_settings"></div>`);
                const insertElem = targetNode.querySelector("div#script_settings");
                insertElem.insertAdjacentHTML(
                    "beforeend",
                    `<div style="float: left; color: ${SCRIPT_COLOR_MAIN}">${
                        isZH ? "MWITools 設定 （重新整理生效）：" : "MWITools Settings (refresh page to apply): "
                    }</div></br>`
                );

                for (const setting of Object.values(settingsMap)) {
                    insertElem.insertAdjacentHTML(
                        "beforeend",
                        `<div style="float: left;"><input type="checkbox" id="${setting.id}" ${setting.isTrue ? "checked" : ""}></input>${
                            setting.desc
                        }</div></br>`
                    );
                }

                insertElem.insertAdjacentHTML(
                    "beforeend",
                    `<div style="float: left;">${
                        isZH
                            ? "程式碼裡搜尋“自定義”可以手動修改字型顏色、強化模擬預設引數"
                            : `Search "Customization" in code to customize font colors and default enhancement simulation parameters.`
                    }</div></br>`
                );
                insertElem.addEventListener("change", saveSettings);
            }
        }
        setTimeout(waitForSetttins, 500);
    };
    waitForSetttins();

    function saveSettings() {
        for (const checkbox of document.querySelectorAll("div#script_settings input")) {
            settingsMap[checkbox.id].isTrue = checkbox.checked;
            localStorage.setItem("script_settingsMap", JSON.stringify(settingsMap));
        }
    }

    function readSettings() {
        const ls = localStorage.getItem("script_settingsMap");
        if (ls) {
            const lsObj = JSON.parse(ls);
            for (const option of Object.values(lsObj)) {
                if (settingsMap.hasOwnProperty(option.id)) {
                    settingsMap[option.id].isTrue = option.isTrue;
                }
            }
        }

        if (settingsMap.forceMWIToolsDisplayZH.isTrue) {
            isZH = true; // For Traditional Chinese users.
        }

        if (settingsMap.useOrangeAsMainColor.isTrue && SCRIPT_COLOR_MAIN === "green") {
            SCRIPT_COLOR_MAIN = "orange";
        }
        if (settingsMap.useOrangeAsMainColor.isTrue && SCRIPT_COLOR_TOOLTIP === "darkgreen") {
            SCRIPT_COLOR_TOOLTIP = "#804600";
        }
    }

    /* 檢查是否穿錯生產/戰鬥裝備 */
    function checkEquipment() {
        if (currentActionsHridList.length === 0) {
            return;
        }
        const currentActionHrid = currentActionsHridList[0].actionHrid;
        const hasHat = currentEquipmentMap["/item_locations/head"]?.itemHrid === "/items/red_chefs_hat" ? true : false; // Cooking, Brewing
        const hasOffHand = currentEquipmentMap["/item_locations/off_hand"]?.itemHrid === "/items/eye_watch" ? true : false; // Cheesesmithing, Crafting, Tailoring
        const hasBoot = currentEquipmentMap["/item_locations/feet"]?.itemHrid === "/items/collectors_boots" ? true : false; // Milking, Foraging, Woodcutting
        const hasGlove = currentEquipmentMap["/item_locations/hands"]?.itemHrid === "/items/enchanted_gloves" ? true : false; // Enhancing

        let warningStr = null;
        if (currentActionHrid.includes("/actions/combat/")) {
            if (hasHat || hasOffHand || hasBoot || hasGlove) {
                warningStr = isZH ? "正穿著生產裝備" : "Production equipment equipted";
            }
        } else if (currentActionHrid.includes("/actions/cooking/") || currentActionHrid.includes("/actions/brewing/")) {
            if (!hasHat && hasItemHridInInv("/items/red_chefs_hat")) {
                warningStr = isZH ? "沒穿生產帽" : "Not wearing production hat";
            }
        } else if (
            currentActionHrid.includes("/actions/cheesesmithing/") ||
            currentActionHrid.includes("/actions/crafting/") ||
            currentActionHrid.includes("/actions/tailoring/")
        ) {
            if (!hasOffHand && hasItemHridInInv("/items/eye_watch")) {
                warningStr = isZH ? "沒穿生產副手" : "Not wearing production off-hand";
            }
        } else if (
            currentActionHrid.includes("/actions/milking/") ||
            currentActionHrid.includes("/actions/foraging/") ||
            currentActionHrid.includes("/actions/woodcutting/")
        ) {
            if (!hasBoot && hasItemHridInInv("/items/collectors_boots")) {
                warningStr = isZH ? "沒穿生產鞋" : "Not wearing production boots";
            }
        } else if (currentActionHrid.includes("/actions/enhancing")) {
            if (!hasGlove && hasItemHridInInv("/items/enchanted_gloves")) {
                warningStr = isZH ? "沒穿強化手套" : "Not wearing enhancing gloves";
            }
        }

        document.body.querySelector("#script_item_warning")?.remove();
        if (warningStr) {
            document.body.insertAdjacentHTML(
                "beforeend",
                `<div id="script_item_warning" style="position: fixed; top: 1%; left: 30%; color: ${SCRIPT_COLOR_ALERT}; font-size: 1rem;">${warningStr}</div>`
            );
        }
    }

    function hasItemHridInInv(hrid) {
        let result = null;
        for (const item of initData_characterItems) {
            if (item.itemHrid === hrid && item.itemLocationHrid === "/item_locations/inventory") {
                result = item;
            }
        }
        return result ? true : false;
    }

    /* 空閒時彈窗通知 */
    function notificate() {
        if (typeof GM_notification === "undefined" || !GM_notification) {
            console.error("notificate null GM_notification");
            return;
        }
        if (currentActionsHridList.length > 0) {
            return;
        }
        console.log("notificate empty action");
        GM_notification({
            text: isZH ? "動作佇列為空" : "Action queue is empty.",
            title: "MWITools",
        });
    }

    /* 市場價格自動輸入最小壓價 */
    const waitForMarketOrders = () => {
        const element = document.querySelector(".MarketplacePanel_marketListings__1GCyQ");
        if (element) {
            console.log("start observe market order");
            new MutationObserver((mutationsList) => {
                mutationsList.forEach((mutation) => {
                    mutation.addedNodes.forEach((node) => {
                        if (node.classList.contains("Modal_modalContainer__3B80m")) {
                            handleMarketNewOrder(node);
                        }
                    });
                });
            }).observe(element, {
                characterData: false,
                subtree: false,
                childList: true,
            });
        } else {
            setTimeout(waitForMarketOrders, 500);
        }
    };

    function handleMarketNewOrder(node) {
        const title = getOriTextFromElement(node.querySelector(".MarketplacePanel_header__yahJo"));
        if (!title || title.includes(" Now") || title.includes("立即")) {
            return;
        }
        const label = node.querySelector("span.MarketplacePanel_bestPrice__3bgKp");
        const inputDiv = node.querySelector(".MarketplacePanel_inputContainer__3xmB2 .MarketplacePanel_priceInputs__3iWxy");
        if (!label || !inputDiv) {
            console.error("handleMarketNewOrder can not find elements");
            return;
        }

        label.click();

        if (getOriTextFromElement(label.parentElement).toLowerCase().includes("best buy") || label.parentElement.textContent.includes("購買")) {
            inputDiv.querySelectorAll(".MarketplacePanel_buttonContainer__vJQud")[2]?.querySelector("div button")?.click();
        } else if (
            getOriTextFromElement(label.parentElement).toLowerCase().includes("best sell") ||
            label.parentElement.textContent.includes("出售")
        ) {
            inputDiv.querySelectorAll(".MarketplacePanel_buttonContainer__vJQud")[1]?.querySelector("div button")?.click();
        }
    }

    /* 傷害統計 */
    // 此功能基於以下作者的程式碼：
    // 傷害統計 by ponchain
    // 圖表 by Stella
    // 頭像下方顯示數字 by Truth_Light
    const lang = {
        toggleButtonHide: isZH ? "收起" : "Hide",
        toggleButtonShow: isZH ? "展開" : "Show",
        players: isZH ? "玩家" : "Players",
        dpsTextDPS: isZH ? "DPS" : "DPS",
        dpsTextTotalDamage: isZH ? "總傷害" : "Total Damage",
        totalRuntime: isZH ? "執行時間" : "Runtime",
        totalTeamDPS: isZH ? "團隊DPS" : "Total Team DPS",
        totalTeamDamage: isZH ? "團隊總傷害" : "Total Team Damage",
        damagePercentage: isZH ? "傷害佔比" : "Damage %",
        monstername: isZH ? "怪物" : "Monster",
        encountertimes: isZH ? "遭遇數" : "Encounter",
        hitChance: isZH ? "命中率" : "Hit Chance",
        aura: isZH ? "光環" : "Aura",
    };

    let totalDamage = [];
    let inferredDamage = [];
    let unassignedDamage = 0;
    let totalHealing = [];
    let healingReceived = [];
    let unassignedHealing = 0;
    let totalDamageTaken = [];
    let damageTakenHits = [];
    let totalDuration = 0;
    let startTime = null;
    let endTime = null;
    let monstersHP = [];
    let monstersDamageCounters = [];
    let playersMP = [];
    let playersHP = [];
    let playersDamageCounters = [];
    let players = [];
    let monsters = [];
    let dragging = false;
    let chart = null;
    let monsterCounts = {}; // Object to store monster counts
    let monsterEvasion = {}; // Object to store monster evasion ratings by combat style
    let monsterHrids = {};
    let unassignedHitSamples = 0;
    let guildDamageStats = createDamageStats("guild");
    let dpsPanelLastRenderAt = 0;
    const COMBAT_STATS_TAB_KEY = "mwiTools_combatStatsTab";
    let combatStatsActiveTab = ["damage", "healing", "taken"].includes(
        localStorage.getItem(COMBAT_STATS_TAB_KEY)
    )
        ? localStorage.getItem(COMBAT_STATS_TAB_KEY)
        : "damage";

    function createDamageStats(mode) {
        return {
            mode,
            sessionKey: "",
            totalDamage: [],
            inferredDamage: [],
            unassignedDamage: 0,
            totalHealing: [],
            healingReceived: [],
            unassignedHealing: 0,
            totalDamageTaken: [],
            damageTakenHits: [],
            totalDuration: 0,
            startTime: null,
            endTime: null,
            monstersHP: [],
            monstersDamageCounters: [],
            playersMP: [],
            playersHP: [],
            playersDamageCounters: [],
            players: [],
            monsters: [],
            unassignedHitSamples: 0,
        };
    }

    function getPartyDamageStats() {
        return {
            mode: "party",
            totalDamage,
            inferredDamage,
            get unassignedDamage() {
                return unassignedDamage;
            },
            set unassignedDamage(value) {
                unassignedDamage = Number(value) || 0;
            },
            totalHealing,
            healingReceived,
            get unassignedHealing() {
                return unassignedHealing;
            },
            set unassignedHealing(value) {
                unassignedHealing = Number(value) || 0;
            },
            totalDamageTaken,
            damageTakenHits,
            totalDuration,
            startTime,
            endTime,
            monstersHP,
            monstersDamageCounters,
            playersMP,
            playersHP,
            playersDamageCounters,
            players,
            monsters,
            unassignedHitSamples,
        };
    }

    function getPlayerDisplayName(player, index = 0) {
        return player?.character?.name || player?.name || `玩家 ${index + 1}`;
    }

    function getUnitCurrentHP(unit) {
        const value = unit?.currentHitpoints ?? unit?.cHP ?? unit?.combatDetails?.currentHitpoints;
        return Number.isFinite(value) ? value : 0;
    }

    function getOptionalUnitCurrentHP(unit) {
        const value = unit?.currentHitpoints ?? unit?.cHP ?? unit?.combatDetails?.currentHitpoints;
        return Number.isFinite(value) ? value : Number.NaN;
    }

    function recordDamageForState(state, playerIndex, amount, isInferred) {
        const index = Number(playerIndex);
        if (!Number.isInteger(index) || !state.players[index] || !(amount > 0)) {
            state.unassignedDamage += amount > 0 ? amount : 0;
            return;
        }

        const target = isInferred ? state.inferredDamage : state.totalDamage;
        target[index] = (Number(target[index]) || 0) + amount;

        const player = state.players[index];
        if (!player.damageMap) {
            player.damageMap = new Map();
        }
        const action = player.currentAction || "unknown";
        player.damageMap.set(action, (player.damageMap.get(action) || 0) + amount);
    }

    const HEAL_ACTION_HRIDS = new Set([
        "/abilities/minor_heal",
        "/abilities/heal",
        "/abilities/quick_aid",
        "/abilities/rejuvenate",
        "/abilities/revive",
        "/abilities/life_drain",
    ]);

    function isHealingAction(action) {
        if (HEAL_ACTION_HRIDS.has(action)) return true;
        const normalized = String(action || "").toLowerCase();
        return (
            normalized.includes("heal") ||
            normalized.includes("quick_aid") ||
            normalized.includes("rejuvenate") ||
            normalized.includes("revive") ||
            normalized.includes("life_drain")
        );
    }

    function recordHealingForState(state, playerIndex, action, amount) {
        const index = Number(playerIndex);
        const healing = Math.max(0, Number(amount) || 0);
        const player = state.players[index];
        if (!Number.isInteger(index) || !player || !(healing > 0)) {
            state.unassignedHealing += healing;
            return;
        }

        state.totalHealing[index] = (Number(state.totalHealing[index]) || 0) + healing;
        if (!(player.healingMap instanceof Map)) {
            player.healingMap = new Map();
        }
        const ability = action || "unknown";
        const current = player.healingMap.get(ability) || { healing: 0, casts: 0 };
        current.healing += healing;
        current.casts += 1;
        player.healingMap.set(ability, current);
    }

    function recordPlayerHealthChangesForState(state, pMap, completedAttackSamples) {
        const healingSamples = completedAttackSamples.filter((sample) =>
            isHealingAction(sample.action)
        );
        const observedHeals = [];

        Object.entries(pMap || {}).forEach(([playerIndex, update]) => {
            const index = Number(playerIndex);
            if (!state.players[index] || !Number.isFinite(update?.cHP)) return;

            const previousHP = Number(state.playersHP[index]);
            const currentHP = Number(update.cHP);
            const previousCounter = Number(state.playersDamageCounters[index]);
            const hasDamageCounter = Number.isFinite(Number(update.dmgCounter));
            const currentCounter = hasDamageCounter
                ? Number(update.dmgCounter)
                : previousCounter;

            if (Number.isFinite(previousHP)) {
                const hpDelta = previousHP - currentHP;
                if (hpDelta > 0) {
                    state.totalDamageTaken[index] =
                        (Number(state.totalDamageTaken[index]) || 0) + hpDelta;
                    const counterDelta =
                        Number.isFinite(previousCounter) && Number.isFinite(currentCounter)
                            ? Math.max(0, currentCounter - previousCounter)
                            : 0;
                    state.damageTakenHits[index] =
                        (Number(state.damageTakenHits[index]) || 0) +
                        (counterDelta > 0 ? counterDelta : 1);
                } else if (hpDelta < 0) {
                    const receivedHealing = -hpDelta;
                    observedHeals.push({ index, healing: receivedHealing });
                    state.healingReceived[index] =
                        (Number(state.healingReceived[index]) || 0) + receivedHealing;
                }
            }

            state.playersHP[index] = currentHP;
            if (hasDamageCounter) {
                state.playersDamageCounters[index] = currentCounter;
            }
        });

        const effectiveHealing = observedHeals.reduce(
            (sum, entry) => sum + entry.healing,
            0
        );
        if (!(effectiveHealing > 0)) return;

        if (healingSamples.length === 1) {
            const sample = healingSamples[0];
            recordHealingForState(
                state,
                sample.index,
                sample.action,
                effectiveHealing
            );
        } else {
            state.unassignedHealing += effectiveHealing;
        }
    }

    const DAMAGE_ACTION_HRIDS = new Set([
        "auto",
        "/abilities/poke",
        "/abilities/impale",
        "/abilities/puncture",
        "/abilities/penetrating_strike",
        "/abilities/scratch",
        "/abilities/cleave",
        "/abilities/maim",
        "/abilities/crippling_slash",
        "/abilities/smack",
        "/abilities/sweep",
        "/abilities/stunning_blow",
        "/abilities/fracturing_impact",
        "/abilities/shield_bash",
        "/abilities/quick_shot",
        "/abilities/aqua_arrow",
        "/abilities/flame_arrow",
        "/abilities/rain_of_arrows",
        "/abilities/silencing_shot",
        "/abilities/steady_shot",
        "/abilities/pestilent_shot",
        "/abilities/penetrating_shot",
        "/abilities/water_strike",
        "/abilities/ice_spear",
        "/abilities/frost_surge",
        "/abilities/entangle",
        "/abilities/toxic_pollen",
        "/abilities/life_drain",
        "/abilities/fireball",
        "/abilities/flame_blast",
        "/abilities/firestorm",
        "/abilities/smoke_burst",
    ]);

    function isDamageActionForHitTracking(player, action) {
        return (
            DAMAGE_ACTION_HRIDS.has(action) ||
            (player?.damageMap instanceof Map && player.damageMap.has(action))
        );
    }

    function recordPacketHitSample(
        state,
        playerIndex,
        action,
        attempts = 1,
        hits = 0
    ) {
        const index = Number(playerIndex);
        const player = state.players[index];
        const safeAttempts = Math.max(0, Math.floor(Number(attempts) || 0));
        const safeHits = Math.min(
            safeAttempts,
            Math.max(0, Math.floor(Number(hits) || 0))
        );
        if (
            !Number.isInteger(index) ||
            !player ||
            !(safeAttempts > 0) ||
            !isDamageActionForHitTracking(player, action)
        ) {
            return false;
        }
        if (!(player.hitMap instanceof Map)) {
            player.hitMap = new Map();
        }
        const current = player.hitMap.get(action) || { attempts: 0, hits: 0 };
        current.attempts += safeAttempts;
        current.hits += safeHits;
        player.hitMap.set(action, current);
        return true;
    }

    function getPacketCounter(value, fallback = 0) {
        const number = Number(value);
        return Number.isFinite(number) ? number : fallback;
    }

    function handleGuildBattleNew(obj) {
        const incomingPlayers = Array.isArray(obj.players) ? obj.players : [];
        const normalizedPlayers = incomingPlayers.map((player, index) => ({
            ...player,
            name: getPlayerDisplayName(player, index),
            currentAction: player.preparingAbilityHrid
                ? player.preparingAbilityHrid
                : player.isPreparingAutoAttack
                ? "auto"
                : "idle",
        }));
        const rosterKey = normalizedPlayers.map((player) => player.name).join("|");
        const sessionKey = `${obj.battleId ?? ""}|${obj.tier ?? ""}|${rosterKey}`;
        const isSameSession =
            guildDamageStats.sessionKey === sessionKey &&
            guildDamageStats.players.length === normalizedPlayers.length;

        normalizedPlayers.forEach((player, index) => {
            if (isSameSession && guildDamageStats.players[index]?.damageMap) {
                player.damageMap = guildDamageStats.players[index].damageMap;
            }
            if (isSameSession && guildDamageStats.players[index]?.hitMap) {
                player.hitMap = guildDamageStats.players[index].hitMap;
            }
            if (isSameSession && guildDamageStats.players[index]?.healingMap) {
                player.healingMap = guildDamageStats.players[index].healingMap;
            }
            player.lastAttackCounter = getPacketCounter(
                incomingPlayers[index]?.attackAttemptCounter,
                0
            );
        });

        if (isSameSession && guildDamageStats.startTime && guildDamageStats.endTime) {
            guildDamageStats.totalDuration +=
                (guildDamageStats.endTime - guildDamageStats.startTime) / 1000;
        } else if (!isSameSession) {
            guildDamageStats = createDamageStats("guild");
            guildDamageStats.sessionKey = sessionKey;
            guildDamageStats.totalDamage = new Array(normalizedPlayers.length).fill(0);
            guildDamageStats.inferredDamage = new Array(normalizedPlayers.length).fill(0);
            guildDamageStats.totalHealing = new Array(normalizedPlayers.length).fill(0);
            guildDamageStats.healingReceived = new Array(normalizedPlayers.length).fill(0);
            guildDamageStats.totalDamageTaken = new Array(normalizedPlayers.length).fill(0);
            guildDamageStats.damageTakenHits = new Array(normalizedPlayers.length).fill(0);
        }

        guildDamageStats.startTime = Date.now();
        guildDamageStats.endTime = null;
        guildDamageStats.players = normalizedPlayers;
        guildDamageStats.monsters = Array.isArray(obj.monsters) ? obj.monsters : [];
        guildDamageStats.monstersHP = guildDamageStats.monsters.map(getUnitCurrentHP);
        guildDamageStats.monstersDamageCounters = guildDamageStats.monsters.map(
            (monster) => getPacketCounter(monster.damageSplatCounter, 0)
        );
        guildDamageStats.playersMP = incomingPlayers.map(
            (player) => player.currentManapoints ?? player.cMP ?? 0
        );
        guildDamageStats.playersHP = incomingPlayers.map(getOptionalUnitCurrentHP);
        guildDamageStats.playersDamageCounters = incomingPlayers.map((player) =>
            getPacketCounter(player.damageSplatCounter, 0)
        );
        updateStatisticsPanel(guildDamageStats);
    }

    function handleGuildBattleUpdated(obj) {
        const state = guildDamageStats;
        if (!state.players.length || !state.monstersHP.length) {
            return;
        }

        const pMap = obj.pMap || {};
        const mMap = obj.mMap || {};
        const playerIndices = Object.keys(pMap).filter(
            (playerIndex) => state.players[playerIndex] && pMap[playerIndex]
        );
        const castPlayers = [];
        const completedAttackSamples = [];

        playerIndices.forEach((playerIndex) => {
            const update = pMap[playerIndex];
            const previousAttackCounter = getPacketCounter(
                state.players[playerIndex].lastAttackCounter,
                getPacketCounter(update.atkCounter, 0)
            );
            const currentAttackCounter = getPacketCounter(
                update.atkCounter,
                previousAttackCounter
            );
            const attackDelta = Math.max(
                0,
                currentAttackCounter - previousAttackCounter
            );
            if (attackDelta === 1) {
                completedAttackSamples.push({
                    index: playerIndex,
                    action: state.players[playerIndex].currentAction || "unknown",
                });
            } else if (attackDelta > 1) {
                state.unassignedHitSamples += attackDelta;
            }
            state.players[playerIndex].lastAttackCounter = currentAttackCounter;

            if (
                Number.isFinite(update.cMP) &&
                Number.isFinite(state.playersMP[playerIndex]) &&
                update.cMP < state.playersMP[playerIndex]
            ) {
                castPlayers.push(playerIndex);
            }
            if (Number.isFinite(update.cMP)) {
                state.playersMP[playerIndex] = update.cMP;
            }
        });

        const damageSourcePlayers =
            completedAttackSamples.length === 1
                ? [completedAttackSamples[0].index]
                : castPlayers;
        let packetResolvedTargets = 0;
        let packetHitTargets = 0;
        state.monstersHP.forEach((previousHP, monsterIndex) => {
            const monsterUpdate = mMap[monsterIndex];
            if (!monsterUpdate || !Number.isFinite(monsterUpdate.cHP)) {
                return;
            }
            const damage = previousHP - monsterUpdate.cHP;
            state.monstersHP[monsterIndex] = monsterUpdate.cHP;
            const previousDamageCounter = getPacketCounter(
                state.monstersDamageCounters[monsterIndex],
                0
            );
            const hasDamageCounter = Number.isFinite(Number(monsterUpdate.dmgCounter));
            const currentDamageCounter = getPacketCounter(
                monsterUpdate.dmgCounter,
                previousDamageCounter
            );
            const damageCounterDelta = Math.max(
                0,
                currentDamageCounter - previousDamageCounter
            );
            state.monstersDamageCounters[monsterIndex] = currentDamageCounter;
            const targetResolved = hasDamageCounter
                ? damageCounterDelta > 0
                : damage > 0;
            if (targetResolved) {
                packetResolvedTargets += 1;
                if (damage > 0) packetHitTargets += 1;
            }
            if (!(damage > 0)) {
                return;
            }

            // Guild updates often include HP/MP snapshots for players who did
            // not cause the monster HP loss. Only attribute damage when the
            // packet exposes one completed attack/cast source.
            if (damageSourcePlayers.length === 1) {
                recordDamageForState(state, damageSourcePlayers[0], damage, true);
            } else {
                state.unassignedDamage += damage;
            }
        });

        if (completedAttackSamples.length === 1) {
            const sample = completedAttackSamples[0];
            const recorded = recordPacketHitSample(
                state,
                sample.index,
                sample.action,
                packetResolvedTargets,
                packetHitTargets
            );
            if (
                !recorded &&
                isDamageActionForHitTracking(
                    state.players[sample.index],
                    sample.action
                )
            ) {
                state.unassignedHitSamples += 1;
            }
        } else if (completedAttackSamples.length > 1) {
            state.unassignedHitSamples += completedAttackSamples.length;
        }

        recordPlayerHealthChangesForState(state, pMap, completedAttackSamples);

        playerIndices.forEach((playerIndex) => {
            const update = pMap[playerIndex];
            state.players[playerIndex].currentAction = update.abilityHrid
                ? update.abilityHrid
                : update.isAutoAtk
                ? "auto"
                : "idle";
        });
        state.endTime = Date.now();
        updateStatisticsPanel(state);
    }

    function handleGuildBattleEnd() {
        const state = guildDamageStats;
        if (state.startTime) {
            const finishedAt = state.endTime || Date.now();
            state.totalDuration += (finishedAt - state.startTime) / 1000;
            state.startTime = null;
            state.endTime = null;
        }
        updateStatisticsPanel(state);
    }
    const calculateHitChance = (accuracy, evasion) => {
        const hitChance = (Math.pow(accuracy, 1.4) / (Math.pow(accuracy, 1.4) + Math.pow(evasion, 1.4))) * 100;
        return hitChance;
    };

    function getDamageActionLabel(action) {
        if (action === "auto") return "自動攻擊";
        if (!action || action === "idle" || action === "unknown") return "無法判定";

        const localized =
            typeof ZHOthersDic !== "undefined" && ZHOthersDic
                ? ZHOthersDic[action]
                : null;
        const abilityName = initData_abilityDetailMap?.[action]?.name;
        if (localized || abilityName) return localized || abilityName;

        return String(action).split("/").pop().replaceAll("_", " ");
    }

    function getActionCombatStyleHrid(player, action) {
        const ability = initData_abilityDetailMap?.[action];
        const candidates = [
            ability?.combatStyleHrid,
            ability?.combatStyleHrids?.[0],
            ability?.baseCombatStats?.combatStyleHrid,
            ability?.baseCombatStats?.combatStyleHrids?.[0],
            ability?.combatStats?.combatStyleHrid,
            ability?.combatStats?.combatStyleHrids?.[0],
            player?.combatDetails?.combatStats?.combatStyleHrid,
            player?.combatDetails?.combatStats?.combatStyleHrids?.[0],
        ];
        return candidates.find((value) => typeof value === "string" && value) || "";
    }

    function getEncounteredMonsterEntries(stats) {
        if (stats.mode !== "guild" && Object.keys(monsterCounts).length) {
            return Object.entries(monsterCounts);
        }

        const counts = {};
        (Array.isArray(stats.monsters) ? stats.monsters : []).forEach((monster, index) => {
            const name = monster?.name || monster?.hrid || `monster-${index}`;
            counts[name] = (counts[name] || 0) + 1;
        });
        return Object.entries(counts);
    }

    function getActionEstimatedHitChance(stats, player, playerIndex, action) {
        const styleHrid = getActionCombatStyleHrid(player, action);
        const style = styleHrid.split("/").pop();
        if (!style) return null;

        const accuracy = Number(player?.combatDetails?.[`${style}AccuracyRating`]);
        if (!Number.isFinite(accuracy) || accuracy < 0) return null;

        const playerName = getPlayerDisplayName(player, playerIndex);
        const monsterEntries = getEncounteredMonsterEntries(stats);
        let weightedChance = 0;
        let totalWeight = 0;

        monsterEntries.forEach(([monsterName, count]) => {
            const directMonster = (Array.isArray(stats.monsters) ? stats.monsters : []).find(
                (monster) => (monster?.name || monster?.hrid) === monsterName
            );
            const storedEvasion =
                monsterEvasion[monsterName]?.[`${playerName}-${style}`] ??
                monsterEvasion[monsterName]?.[`${player?.name || ""}-${style}`];
            const evasion = Number(
                storedEvasion ?? directMonster?.combatDetails?.[`${style}EvasionRating`]
            );
            const weight = Math.max(0, Number(count) || 0);
            if (!Number.isFinite(evasion) || evasion < 0 || !(weight > 0)) return;

            const chance = calculateHitChance(accuracy, evasion);
            if (!Number.isFinite(chance)) return;
            weightedChance += chance * weight;
            totalWeight += weight;
        });

        return totalWeight > 0 ? weightedChance / totalWeight : null;
    }

    function getPlayerSkillDamageRows(stats, player, playerIndex, playerDamage) {
        const damageEntries =
            player?.damageMap instanceof Map
                ? Array.from(player.damageMap.entries())
                : Object.entries(player?.damageMap || {});

        return damageEntries
            .map(([action, damage]) => {
                const numericDamage = Math.max(0, Number(damage) || 0);
                const hitSample =
                    player?.hitMap instanceof Map
                        ? player.hitMap.get(action)
                        : player?.hitMap?.[action];
                const observedAttempts = Math.max(
                    0,
                    Number(hitSample?.attempts) || 0
                );
                const observedHits = Math.min(
                    observedAttempts,
                    Math.max(0, Number(hitSample?.hits) || 0)
                );
                return {
                    action,
                    label: getDamageActionLabel(action),
                    damage: numericDamage,
                    share: playerDamage > 0 ? (numericDamage / playerDamage) * 100 : 0,
                    observedAttempts,
                    observedHits,
                    observedHitRate:
                        observedAttempts > 0
                            ? (observedHits / observedAttempts) * 100
                            : null,
                    hitChance: getActionEstimatedHitChance(
                        stats,
                        player,
                        playerIndex,
                        action
                    ),
                };
            })
            .filter((row) => row.damage > 0)
            .sort((a, b) => b.damage - a.damage);
    }

    function isGuildStatisticsViewActive() {
        if (
            !guildDamageStats.players.length
            || !guildDamageStats.monsters.length
        ) {
            return false;
        }

        const battleArea = document.querySelector(
            '[class*="BattlePanel_battleArea"]'
        );
        const playersArea = battleArea?.querySelector(
            '[class*="BattlePanel_playersArea"]'
        );
        const monstersArea = battleArea?.querySelector(
            '[class*="BattlePanel_monstersArea"]'
        );
        if (!playersArea || !monstersArea) return false;

        const guildPlayerNames = new Set(
            guildDamageStats.players.map((player, index) =>
                getPlayerDisplayName(player, index)
            )
        );
        const displayedPlayerNames = Array.from(
            playersArea.querySelectorAll('[class*="CombatUnit_name"]')
        )
            .map((element) => element.textContent.trim())
            .filter(Boolean);
        if (
            !displayedPlayerNames.length
            || !displayedPlayerNames.every((name) => guildPlayerNames.has(name))
        ) {
            return false;
        }

        const guildMonsterHrids = new Set(
            guildDamageStats.monsters
                .map((monster) => monster?.hrid)
                .filter(Boolean)
        );
        const displayedMonsterHrids = Array.from(
            monstersArea.querySelectorAll('img[alt^="/monsters/"]')
        )
            .map((image) => image.getAttribute("alt"))
            .filter(Boolean);
        if (displayedMonsterHrids.length) {
            return displayedMonsterHrids.some((hrid) =>
                guildMonsterHrids.has(hrid)
            );
        }

        const guildMonsterNames = new Set(
            guildDamageStats.monsters
                .map((monster) => monster?.name)
                .filter(Boolean)
        );
        const displayedMonsterNames = Array.from(
            monstersArea.querySelectorAll('[class*="CombatUnit_name"]')
        )
            .map((element) => element.textContent.trim())
            .filter(Boolean);
        return displayedMonsterNames.some((name) =>
            guildMonsterNames.has(name)
        );
    }

    const getStatisticsDom = (stats = getPartyDamageStats()) => {
        {
            const battleArea = document.querySelector('[class*="BattlePanel_battleArea"]');
            if (!battleArea) {
                return null;
            }
            const playersArea = battleArea.querySelector('[class*="BattlePanel_playersArea"]');
            if (!playersArea) {
                return null;
            }
            const monstersArea = battleArea.querySelector('[class*="BattlePanel_monstersArea"]');
            const panelHost =
                stats.mode === "guild" && monstersArea ? monstersArea : playersArea;
            panelHost.style.position = "relative";

            const displayedNames = Array.from(
                playersArea.querySelectorAll('[class*="CombatUnit_name"]')
            ).map((element) => element.textContent.trim());
            const expectedNames = stats.players.map((player, index) =>
                getPlayerDisplayName(player, index)
            );
            // Normal party combat renders every player card. Guild trials only
            // render the viewer's own combat card even though the packet roster
            // contains every participant, so an exact-length comparison hides
            // the entire guild statistics panel.
            const isDisplayedRoster =
                stats.mode === "guild"
                    ? displayedNames.length > 0 &&
                      displayedNames.every((name) => expectedNames.includes(name))
                    : displayedNames.length === expectedNames.length &&
                      expectedNames.every((name) => displayedNames.includes(name));
            if (!isDisplayedRoster) {
                return null;
            }

            let panel = document.querySelector(".script_dps_panel");
            if (panel && panel.parentElement !== panelHost) {
                panel.remove();
                panel = null;
            }
            if (!panel) {
                panel = document.createElement("section");
                panel.className = "script_dps_panel";
                panel.setAttribute("aria-label", "戰鬥統計");
                Object.assign(panel.style, {
                    position: "absolute",
                    top: "8px",
                    left: "8px",
                    transform: "none",
                    zIndex: "4",
                    width: "calc(100% - 16px)",
                    maxHeight: "min(450px, calc(100% - 360px))",
                    overflow: "auto",
                    boxSizing: "border-box",
                    padding: "9px 12px",
                    borderRadius: "10px",
                    color: "#f4f7ff",
                    fontSize: "13px",
                    lineHeight: "1.4",
                    pointerEvents: "auto",
                    scrollbarWidth: "thin",
                    scrollbarGutter: "stable",
                    fontVariantNumeric: "tabular-nums",
                });
                panelHost.appendChild(panel);
            }

            if (panel.dataset.statsTabsBound !== "true") {
                panel.dataset.statsTabsBound = "true";
                panel.addEventListener("click", (event) => {
                    if (!(event.target instanceof Element)) return;
                    const button = event.target.closest("[data-combat-stats-tab]");
                    if (!button || !panel.contains(button)) return;
                    const nextTab = button.dataset.combatStatsTab;
                    if (!["damage", "healing", "taken"].includes(nextTab)) return;
                    combatStatsActiveTab = nextTab;
                    localStorage.setItem(COMBAT_STATS_TAB_KEY, nextTab);
                    panel.scrollTop = 0;
                    dpsPanelLastRenderAt = 0;
                    updateStatisticsPanel(
                        panel.dataset.mode === "guild"
                            ? guildDamageStats
                            : getPartyDamageStats()
                    );
                });
            }

            panel.style.background = settingsMap.damageGraphTransparentBackground.isTrue
                ? "rgba(15, 18, 28, 0.86)"
                : "rgb(15, 18, 28)";
            panel.style.border = "1px solid rgba(116, 167, 255, 0.42)";
            panel.style.boxShadow = "0 3px 14px rgba(0, 0, 0, 0.34)";
            panel.style.backdropFilter = settingsMap.damageGraphTransparentBackground.isTrue
                ? "blur(5px)"
                : "none";
            return panel;
        }

        const numPlayers = players.length;
        const chartHeight = numPlayers * 35 + 20;

        if (!document.querySelector(".script_dps_panel")) {
            let panel = document.createElement("div");
            panel.style.position = "fixed";
            panel.style.top = "50px";
            panel.style.left = "50px";
            panel.style.zIndex = "9999";
            panel.style.fontSize = "0.875rem";
            panel.style.padding = "10px";
            panel.style.borderRadius = "16px";
            panel.style.boxShadow = "0 4px 12px rgba(0, 0, 0, 0.3)";
            panel.style.overflow = "auto";
            panel.style.width = "auto";
            panel.style.height = "auto";
            panel.style.backdropFilter = "blur(8px)";
            if (settingsMap.damageGraphTransparentBackground.isTrue) {
                panel.style.background = "rgba(0, 0, 0, 0.5)";
                panel.style.border = "1px solid rgba(255, 255, 255, 0.2)";
                panel.style.boxShadow = "0 4px 12px rgba(0, 0, 0, 0.3)";
                panel.style.backdropFilter = "blur(8px)";
            } else {
                panel.style.background = "rgba(0, 0, 0)";
                panel.style.border = "1px solid rgba(255, 255, 255)";
                panel.style.boxShadow = "0 4px 12px rgba(0, 0, 0)";
            }

            panel.innerHTML = `
            <div id="panelHeader" style="display: flex; justify-content: space-between; align-items: center; cursor: move; width: auto; height: auto;">
                <span style="font-weight: bold; font-size: 1rem; color: #0078d4;">DPS</span>
                <button id="script_toggleButton" style="background-color: #0078d4; color: white; border: none; padding: 5px 10px; margin-left: 10px; border-radius: 8px; cursor: pointer;">${lang.toggleButtonHide}</button>
            </div>
            <div id="script_panelContent">
                <div id="script_dpsChart_div" style="width: 400px; height: ${chartHeight}px;">
                    <canvas id="script_dpsChart"></canvas></div>
                <div id="script_dpsText"></div>
                <div id="script_hitChanceTable" style="margin-top: 10px;"></div>
            </div>`;
            panel.className = "script_dps_panel";

            let offsetX, offsetY;
            let dragging = false;

            const panelHeader = panel.querySelector("#panelHeader");

            // 滑鼠拖動面板
            panelHeader.addEventListener("mousedown", function (e) {
                const rect = panel.getBoundingClientRect();
                const isResizing = e.clientX > rect.right - 10 || e.clientY > rect.bottom - 10;
                if (isResizing || e.target.id === "script_toggleButton") return;
                dragging = true;
                offsetX = e.clientX - panel.offsetLeft;
                offsetY = e.clientY - panel.offsetTop;
                e.preventDefault(); // 阻止預設行為，防止選擇文字
            });

            let dragStartTime = 0;

            document.addEventListener("mousemove", function (e) {
                if (dragging) {
                    const now = Date.now();
                    if (now - dragStartTime < 16) return; // 限制每16毫秒更新一次
                    dragStartTime = now;

                    var newX = e.clientX - offsetX;
                    var newY = e.clientY - offsetY;
                    panel.style.left = newX + "px";
                    panel.style.top = newY + "px";
                }
            });

            document.addEventListener("mouseup", function () {
                dragging = false;
            });

            panel.addEventListener("touchstart", function (e) {
                const rect = panel.getBoundingClientRect();
                const isResizing = e.clientX > rect.right - 10 || e.clientY > rect.bottom - 10;
                if (isResizing || e.target.id === "script_toggleButton") return;
                dragging = true;
                let touch = e.touches[0];
                offsetX = touch.clientX - panel.offsetLeft;
                offsetY = touch.clientY - panel.offsetTop;
                e.preventDefault();
            });

            document.addEventListener("touchmove", function (e) {
                if (dragging) {
                    const now = Date.now();
                    if (now - dragStartTime < 16) return; // 限制每16毫秒更新一次
                    dragStartTime = now;

                    let touch = e.touches[0];
                    var newX = touch.clientX - offsetX;
                    var newY = touch.clientY - offsetY;
                    panel.style.left = newX + "px";
                    panel.style.top = newY + "px";
                }
            });

            document.addEventListener("touchend", function () {
                dragging = false;
            });

            document.body.appendChild(panel);

            // Toggle button functionality
            if (!localStorage.getItem("script_dpsPanel_isExpanded")) {
                localStorage.setItem("script_dpsPanel_isExpanded", true);
            }
            if (localStorage.getItem("script_dpsPanel_isExpanded") !== "true") {
                document.getElementById("script_panelContent").style.display = "none";
                document.getElementById("script_toggleButton").textContent = lang.toggleButtonShow;
            }

            document.getElementById("script_toggleButton").addEventListener("click", function () {
                let isExpanded = localStorage.getItem("script_dpsPanel_isExpanded") === "true";
                isExpanded = !isExpanded;
                localStorage.setItem("script_dpsPanel_isExpanded", isExpanded ? true : false);
                this.textContent = isExpanded ? lang.toggleButtonHide : lang.toggleButtonShow;
                const panelContent = document.getElementById("script_panelContent");
                if (isExpanded) {
                    panelContent.style.display = "block";
                    this.textContent = lang.toggleButtonHide;
                } else {
                    panelContent.style.display = "none";
                    this.textContent = lang.toggleButtonShow;
                }
            });

            // Create chart
            const ctx = document.getElementById("script_dpsChart").getContext("2d");
            chart = new Chart(ctx, {
                type: "bar",
                data: {
                    labels: [],
                    datasets: [
                        {
                            data: [],
                            backgroundColor: [
                                "rgba(255, 99, 132, 0.6)", // 淺粉色
                                "rgba(54, 162, 235, 0.6)", // 淺藍色
                                "rgba(255, 206, 86, 0.6)", // 淺黃色
                                "rgba(75, 192, 192, 0.6)", // 淺綠色
                                "rgba(153, 102, 255, 0.6)", // 淺紫色
                                "rgba(255, 159, 64, 0.6)", // 淺橙色
                            ],
                            borderColor: [
                                "rgba(255, 99, 132, 1)", // 淺粉色邊框
                                "rgba(54, 162, 235, 1)", // 淺藍色邊框
                                "rgba(255, 206, 86, 1)", // 淺黃色邊框
                                "rgba(75, 192, 192, 1)", // 淺綠色邊框
                                "rgba(153, 102, 255, 1)", // 淺紫色邊框
                                "rgba(255, 159, 64, 1)", // 淺橙色邊框
                            ],
                            borderWidth: 1,
                            barPercentage: 0.9,
                            categoryPercentage: 1.0,
                        },
                    ],
                },
                options: {
                    responsive: true,
                    maintainAspectRatio: false,
                    indexAxis: "y",
                    scales: {
                        x: {
                            beginAtZero: true,
                            grace: "20%",
                            display: false,
                            grid: {
                                display: false,
                            },
                        },
                        y: {
                            grid: {
                                display: false,
                            },
                            ticks: {
                                font: {
                                    size: 12, // 字型大小
                                    weight: "bold", // 加粗字型
                                },
                                color: "rgba(255, 255, 255, 0.7)", // 淺色字型（你可以根據背景調整顏色）
                            },
                        },
                    },
                    layout: {
                        padding: {
                            left: 0,
                            right: 0,
                            top: 0,
                            bottom: 0,
                        },
                    },
                    plugins: {
                        legend: {
                            display: false,
                        },
                        tooltip: {
                            enabled: false,
                        },
                        datalabels: {
                            anchor: "end",
                            align: "right",
                            color: function (context) {
                                const value = context.dataset.data[context.dataIndex];
                                return value > 0 ? "white" : "transparent";
                            },
                            font: {
                                weight: "bold",
                                size: 12,
                            },
                            formatter: function (value) {
                                return `${value.toLocaleString()}`;
                            },
                            clip: false,
                            display: true,
                        },
                    },
                },

                plugins: [ChartDataLabels],
            });
        } else if (document.getElementById("script_dpsChart_div")) {
            document.getElementById("script_dpsChart_div").style.height = `${chartHeight}px`;
        }
        return document.querySelector(".script_dps_panel");
    };

    const updateStatisticsPanel = (stats = getPartyDamageStats()) => {
        {
            const now = Date.now();
            // Keep live values responsive without rebuilding and reordering the
            // entire statistics panel several times per second.
            if (now - dpsPanelLastRenderAt < 750) {
                return;
            }
            dpsPanelLastRenderAt = now;

            const panel = getStatisticsDom(stats);
            if (!panel) {
                return;
            }

            const runningSeconds =
                stats.startTime && stats.endTime ? (stats.endTime - stats.startTime) / 1000 : 0;
            const totalTime = Math.max(0, stats.totalDuration + runningSeconds);
            const confirmedDamage = stats.totalDamage.map((value) => Number(value) || 0);
            const inferredByPlayer = stats.inferredDamage.map((value) => Number(value) || 0);
            const attributedDamage = confirmedDamage.map(
                (value, index) => value + (inferredByPlayer[index] || 0)
            );
            const playerDps = attributedDamage.map((damage) =>
                totalTime > 0 ? Math.round(damage / totalTime) : 0
            );
            const confirmedTotal = confirmedDamage.reduce((sum, value) => sum + value, 0);
            const inferredTotal = inferredByPlayer.reduce((sum, value) => sum + value, 0);
            const unassignedTotal = Number(stats.unassignedDamage) || 0;
            const teamDamage = confirmedTotal + inferredTotal + unassignedTotal;
            const teamDps = totalTime > 0 ? Math.round(teamDamage / totalTime) : 0;

            const formatDamage = (value) => {
                const number = Math.round(Number(value) || 0);
                const abs = Math.abs(number);
                if (abs >= 1e9) return `${(number / 1e9).toFixed(1).replace(/\.0$/, "")}B`;
                if (abs >= 1e6) return `${(number / 1e6).toFixed(1).replace(/\.0$/, "")}M`;
                if (abs >= 1e3) return `${(number / 1e3).toFixed(1).replace(/\.0$/, "")}k`;
                return String(number);
            };
            const formatDuration = (seconds) => {
                const whole = Math.max(0, Math.floor(seconds));
                const hours = Math.floor(whole / 3600);
                const minutes = Math.floor((whole % 3600) / 60);
                const secs = whole % 60;
                return hours > 0
                    ? `${hours}:${String(minutes).padStart(2, "0")}:${String(secs).padStart(2, "0")}`
                    : `${minutes}:${String(secs).padStart(2, "0")}`;
            };
            const escapeHtml = (value) =>
                String(value)
                    .replaceAll("&", "&amp;")
                    .replaceAll("<", "&lt;")
                    .replaceAll(">", "&gt;")
                    .replaceAll('"', "&quot;")
                    .replaceAll("'", "&#039;");

            const skillBreakdowns = stats.players.map((player, index) => {
                const skillRows = getPlayerSkillDamageRows(
                    stats,
                    player,
                    index,
                    attributedDamage[index] || 0
                );
                const hitChanceRows = skillRows.filter((row) =>
                    Number.isFinite(row.hitChance)
                );
                const hitChanceWeight = hitChanceRows.reduce(
                    (sum, row) => sum + row.damage,
                    0
                );
                const hitChance =
                    hitChanceWeight > 0
                        ? hitChanceRows.reduce(
                              (sum, row) => sum + row.hitChance * row.damage,
                              0
                          ) / hitChanceWeight
                        : getActionEstimatedHitChance(
                              stats,
                              player,
                              index,
                              player?.currentAction || "auto"
                          );
                const observedAttempts = skillRows.reduce(
                    (sum, row) => sum + row.observedAttempts,
                    0
                );
                const observedHits = skillRows.reduce(
                    (sum, row) => sum + row.observedHits,
                    0
                );
                return {
                    index,
                    name: getPlayerDisplayName(player, index),
                    rows: skillRows,
                    hitChance,
                    hitChanceWeight,
                    observedAttempts,
                    observedHits,
                    observedHitRate:
                        observedAttempts > 0
                            ? (observedHits / observedAttempts) * 100
                            : null,
                };
            });
            const playerHitChanceByIndex = new Map(
                skillBreakdowns.map((player) => [player.index, player.hitChance])
            );
            const playerObservedHitRateByIndex = new Map(
                skillBreakdowns.map((player) => [
                    player.index,
                    {
                        rate: player.observedHitRate,
                        attempts: player.observedAttempts,
                        hits: player.observedHits,
                    },
                ])
            );
            const skillSections =
                skillBreakdowns
                    .filter((player) => player.rows.length)
                    .map((player) => {
                        const skillRows = player.rows
                            .map(
                                (row) => `
                                    <div style="display:grid;grid-template-columns:minmax(105px,1fr) 72px 48px 92px 68px;gap:8px;align-items:center;padding:3px 5px;border-top:1px solid rgba(255,255,255,.07);">
                                        <span style="overflow:hidden;text-overflow:ellipsis;white-space:nowrap;" title="${escapeHtml(row.label)}">${escapeHtml(row.label)}</span>
                                        <span style="text-align:right;color:#e8f2ff;">${formatDamage(row.damage)}</span>
                                        <span style="text-align:right;color:#c2cee3;">${row.share.toFixed(1)}%</span>
                                        <span style="text-align:right;color:#7fd8ff;" title="封包中可單獨歸屬的命中目標／已結算目標">${Number.isFinite(row.observedHitRate) ? `${row.observedHitRate.toFixed(1)}% (${row.observedHits}/${row.observedAttempts})` : "—"}</span>
                                        <span style="text-align:right;color:#9fe1c1;">${Number.isFinite(row.hitChance) ? `${row.hitChance.toFixed(1)}%` : "—"}</span>
                                    </div>`
                            )
                            .join("");
                        return `
                            <div style="margin-top:5px;border:1px solid rgba(116,167,255,.18);border-radius:6px;overflow:hidden;background:rgba(255,255,255,.025);">
                                <div style="display:flex;align-items:center;justify-content:space-between;gap:8px;padding:4px 6px;background:rgba(75,105,155,.12);">
                                    <b>${escapeHtml(player.name)}－技能傷害</b>
                                    <span><span style="color:#7fd8ff;">封包命中 ${Number.isFinite(player.observedHitRate) ? `${player.observedHitRate.toFixed(1)}% (${player.observedHits}/${player.observedAttempts})` : "—"}</span>　<span style="color:#9fe1c1;">預估 ${Number.isFinite(player.hitChance) ? `${player.hitChance.toFixed(1)}%` : "—"}</span></span>
                                </div>
                                <div style="display:grid;grid-template-columns:minmax(105px,1fr) 72px 48px 92px 68px;gap:8px;padding:2px 5px;color:#91a3c3;font-size:11px;">
                                    <span>技能</span><span style="text-align:right;">傷害</span><span style="text-align:right;">占比</span><span style="text-align:right;">封包命中</span><span style="text-align:right;">預估</span>
                                </div>
                                ${skillRows}
                            </div>`;
                    })
                    .join("") ||
                `<div style="margin-top:5px;padding:6px;color:#91a3c3;text-align:center;">尚無可歸屬的技能傷害資料</div>`;

            const maxPlayerDps = Math.max(1, ...playerDps);
            const barColors = [
                "rgba(255, 99, 132, 0.42)",
                "rgba(54, 162, 235, 0.42)",
                "rgba(255, 206, 86, 0.42)",
                "rgba(75, 192, 192, 0.42)",
                "rgba(153, 102, 255, 0.42)",
                "rgba(255, 159, 64, 0.42)",
            ];
            const rows = stats.players
                .map((player, index) => ({
                    index,
                    name: getPlayerDisplayName(player, index),
                    damage: attributedDamage[index] || 0,
                    inferred: inferredByPlayer[index] || 0,
                    dps: playerDps[index] || 0,
                    hitChance: playerHitChanceByIndex.get(index),
                    observed: playerObservedHitRateByIndex.get(index),
                }))
                .sort((a, b) => b.damage - a.damage)
                .map((row, rank) => {
                    const percentage = teamDamage > 0 ? (row.damage / teamDamage) * 100 : 0;
                    const barWidth = Math.max(0, Math.min(100, (row.dps / maxPlayerDps) * 100));
                    const barColor = barColors[rank % barColors.length];
                    return `
                        <div style="position:relative;display:grid;grid-template-columns:28px minmax(88px,1fr) 66px 78px 50px 68px;gap:8px;align-items:center;padding:4px;border-top:1px solid rgba(255,255,255,.09);overflow:hidden;">
                            <span aria-hidden="true" style="position:absolute;inset:2px 0;width:100%;border-radius:4px;background:${barColor};opacity:${(0.06 + (barWidth / 100) * 0.18).toFixed(3)};box-shadow:inset 0 0 8px rgba(255,255,255,.08);"></span>
                            <span style="position:relative;color:#b9c8e5;">${rank + 1}</span>
                            <span style="position:relative;font-weight:700;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;" title="${escapeHtml(row.name)}">${escapeHtml(row.name)}</span>
                            <span style="position:relative;text-align:right;color:#b9e8ff;font-weight:700;" title="${row.inferred > 0 ? "包含推測歸屬傷害" : "確定歸屬傷害"}">${row.dps}</span>
                            <span style="position:relative;text-align:right;">${formatDamage(row.damage)}</span>
                            <span style="position:relative;text-align:right;color:#c2cee3;">${percentage.toFixed(1)}%</span>
                            <span style="position:relative;text-align:right;color:#7fd8ff;" title="${row.observed?.attempts ? `封包可歸屬樣本 ${row.observed.hits}/${row.observed.attempts}` : "尚無封包可歸屬樣本"}">${Number.isFinite(row.observed?.rate) ? `${row.observed.rate.toFixed(1)}%` : "—"}</span>
                        </div>`;
                })
                .join("");

            const healingByPlayer = stats.players.map(
                (_, index) => Math.max(0, Number(stats.totalHealing?.[index]) || 0)
            );
            const attributedHealing = healingByPlayer.reduce(
                (sum, value) => sum + value,
                0
            );
            const unassignedHealingTotal = Math.max(
                0,
                Number(stats.unassignedHealing) || 0
            );
            const observedHealing = attributedHealing + unassignedHealingTotal;
            const teamHps = totalTime > 0 ? Math.round(observedHealing / totalTime) : 0;
            const healerHps = healingByPlayer.map((value) =>
                totalTime > 0 ? Math.round(value / totalTime) : 0
            );
            const unassignedHps =
                totalTime > 0 ? Math.round(unassignedHealingTotal / totalTime) : 0;
            const maxHealerHps = Math.max(1, unassignedHps, ...healerHps);
            const healingRows =
                stats.players
                .map((player, index) => ({
                    index,
                    name: getPlayerDisplayName(player, index),
                    healing: healingByPlayer[index],
                    hps: healerHps[index],
                }))
                .filter((row) => row.healing > 0)
                .sort((a, b) => b.healing - a.healing)
                .map((row, rank) => {
                    const percentage =
                        observedHealing > 0
                            ? (row.healing / observedHealing) * 100
                            : 0;
                    const barWidth = Math.max(
                        0,
                        Math.min(100, (row.hps / maxHealerHps) * 100)
                    );
                    return `
                        <div style="position:relative;display:grid;grid-template-columns:28px minmax(100px,1fr) 72px 82px 54px;gap:8px;align-items:center;padding:4px;border-top:1px solid rgba(255,255,255,.09);overflow:hidden;">
                            <span aria-hidden="true" style="position:absolute;inset:2px 0;width:100%;border-radius:4px;background:rgba(75,192,125,.32);opacity:${(0.06 + (barWidth / 100) * 0.18).toFixed(3)};"></span>
                            <span style="position:relative;color:#b9c8e5;">${rank + 1}</span>
                            <span style="position:relative;font-weight:700;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;" title="${escapeHtml(row.name)}">${escapeHtml(row.name)}</span>
                            <span style="position:relative;text-align:right;color:#9ff2bf;font-weight:700;">${row.hps}</span>
                            <span style="position:relative;text-align:right;">${formatDamage(row.healing)}</span>
                            <span style="position:relative;text-align:right;color:#c2cee3;">${percentage.toFixed(1)}%</span>
                        </div>`;
                })
                .join("") ||
                `<div style="padding:6px;color:#91a3c3;text-align:center;border-top:1px solid rgba(255,255,255,.09);">目前沒有可確認的治療者</div>`;
            const unassignedHealingPercentage =
                observedHealing > 0
                    ? (unassignedHealingTotal / observedHealing) * 100
                    : 0;
            const unassignedHealingBarWidth = Math.max(
                0,
                Math.min(100, (unassignedHps / maxHealerHps) * 100)
            );
            const unassignedHealingRow =
                unassignedHealingTotal > 0
                    ? `<div style="position:relative;display:grid;grid-template-columns:28px minmax(100px,1fr) 72px 82px 54px;gap:8px;align-items:center;padding:4px;border-top:1px solid rgba(255,255,255,.09);overflow:hidden;">
                            <span aria-hidden="true" style="position:absolute;inset:2px 0;width:100%;border-radius:4px;background:rgba(236,180,76,.28);opacity:${(0.06 + (unassignedHealingBarWidth / 100) * 0.18).toFixed(3)};"></span>
                            <span style="position:relative;color:#ffd27a;">—</span>
                            <span style="position:relative;font-weight:700;color:#ffd27a;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;" title="封包沒有提供治療者 ID">無法歸屬來源</span>
                            <span style="position:relative;text-align:right;color:#ffe3a3;font-weight:700;">${unassignedHps}</span>
                            <span style="position:relative;text-align:right;">${formatDamage(unassignedHealingTotal)}</span>
                            <span style="position:relative;text-align:right;color:#ffd27a;">${unassignedHealingPercentage.toFixed(1)}%</span>
                        </div>`
                    : "";
            const healingReceivedByPlayer = stats.players.map(
                (_, index) => Math.max(0, Number(stats.healingReceived?.[index]) || 0)
            );
            const receivedHealingTotal = healingReceivedByPlayer.reduce(
                (sum, value) => sum + value,
                0
            );
            const receivedHpsByPlayer = healingReceivedByPlayer.map((value) =>
                totalTime > 0 ? Math.round(value / totalTime) : 0
            );
            const maxReceivedHps = Math.max(1, ...receivedHpsByPlayer);
            const healingReceivedRows =
                stats.players
                    .map((player, index) => ({
                        name: getPlayerDisplayName(player, index),
                        healing: healingReceivedByPlayer[index],
                        hps: receivedHpsByPlayer[index],
                    }))
                    .filter((row) => row.healing > 0)
                    .sort((a, b) => b.healing - a.healing)
                    .map((row, rank) => {
                        const percentage =
                            receivedHealingTotal > 0
                                ? (row.healing / receivedHealingTotal) * 100
                                : 0;
                        const barWidth = Math.max(
                            0,
                            Math.min(100, (row.hps / maxReceivedHps) * 100)
                        );
                        return `<div style="position:relative;display:grid;grid-template-columns:28px minmax(100px,1fr) 72px 82px 54px;gap:8px;align-items:center;padding:4px;border-top:1px solid rgba(255,255,255,.09);overflow:hidden;">
                                <span aria-hidden="true" style="position:absolute;inset:2px 0;width:100%;border-radius:4px;background:rgba(77,177,204,.25);opacity:${(0.06 + (barWidth / 100) * 0.18).toFixed(3)};"></span>
                                <span style="position:relative;color:#b9c8e5;">${rank + 1}</span>
                                <span style="position:relative;font-weight:700;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;" title="${escapeHtml(row.name)}">${escapeHtml(row.name)}</span>
                                <span style="position:relative;text-align:right;color:#9fe5f2;font-weight:700;">${row.hps}</span>
                                <span style="position:relative;text-align:right;">${formatDamage(row.healing)}</span>
                                <span style="position:relative;text-align:right;color:#c2cee3;">${percentage.toFixed(1)}%</span>
                            </div>`;
                    })
                    .join("") ||
                `<div style="padding:6px;color:#91a3c3;text-align:center;border-top:1px solid rgba(255,255,255,.09);">目前沒有觀察到 HP 上升</div>`;
            const healingSkillSections =
                stats.players
                    .map((player, index) => {
                        const entries =
                            player?.healingMap instanceof Map
                                ? Array.from(player.healingMap.entries())
                                : Object.entries(player?.healingMap || {});
                        const playerHealing = healingByPlayer[index] || 0;
                        const skillRows = entries
                            .map(([action, value]) => ({
                                action,
                                label: getDamageActionLabel(action),
                                healing: Math.max(
                                    0,
                                    Number(value?.healing ?? value) || 0
                                ),
                                casts: Math.max(0, Number(value?.casts) || 0),
                            }))
                            .filter((row) => row.healing > 0)
                            .sort((a, b) => b.healing - a.healing);
                        if (!skillRows.length) return "";
                        return `
                            <div style="margin-top:5px;border:1px solid rgba(104,219,151,.20);border-radius:6px;overflow:hidden;background:rgba(255,255,255,.025);">
                                <div style="padding:4px 6px;background:rgba(55,145,94,.13);"><b>${escapeHtml(getPlayerDisplayName(player, index))}－治療技能</b></div>
                                <div style="display:grid;grid-template-columns:minmax(120px,1fr) 82px 56px 54px;gap:8px;padding:2px 5px;color:#91a3c3;font-size:11px;">
                                    <span>技能</span><span style="text-align:right;">有效治療</span><span style="text-align:right;">占比</span><span style="text-align:right;">次數</span>
                                </div>
                                ${skillRows
                                    .map(
                                        (row) => `
                                            <div style="display:grid;grid-template-columns:minmax(120px,1fr) 82px 56px 54px;gap:8px;padding:3px 5px;border-top:1px solid rgba(255,255,255,.07);">
                                                <span style="overflow:hidden;text-overflow:ellipsis;white-space:nowrap;" title="${escapeHtml(row.label)}">${escapeHtml(row.label)}</span>
                                                <span style="text-align:right;color:#bdfbd2;">${formatDamage(row.healing)}</span>
                                                <span style="text-align:right;color:#c2cee3;">${playerHealing > 0 ? ((row.healing / playerHealing) * 100).toFixed(1) : "0.0"}%</span>
                                                <span style="text-align:right;color:#91dcae;">${row.casts}</span>
                                            </div>`
                                    )
                                    .join("")}
                            </div>`;
                    })
                    .join("") ||
                `<div style="margin-top:5px;padding:6px;color:#91a3c3;text-align:center;">尚無可歸屬的治療技能資料</div>`;

            const damageTakenByPlayer = stats.players.map(
                (_, index) => Math.max(0, Number(stats.totalDamageTaken?.[index]) || 0)
            );
            const takenHitsByPlayer = stats.players.map(
                (_, index) => Math.max(0, Math.floor(Number(stats.damageTakenHits?.[index]) || 0))
            );
            const teamDamageTaken = damageTakenByPlayer.reduce(
                (sum, value) => sum + value,
                0
            );
            const teamTakenHits = takenHitsByPlayer.reduce(
                (sum, value) => sum + value,
                0
            );
            const teamDtps = totalTime > 0 ? Math.round(teamDamageTaken / totalTime) : 0;
            const playerDtps = damageTakenByPlayer.map((value) =>
                totalTime > 0 ? Math.round(value / totalTime) : 0
            );
            const maxPlayerDtps = Math.max(1, ...playerDtps);
            const damageTakenRows = stats.players
                .map((player, index) => ({
                    index,
                    name: getPlayerDisplayName(player, index),
                    damage: damageTakenByPlayer[index],
                    dtps: playerDtps[index],
                    hits: takenHitsByPlayer[index],
                }))
                .sort((a, b) => b.damage - a.damage)
                .map((row, rank) => {
                    const percentage =
                        teamDamageTaken > 0
                            ? (row.damage / teamDamageTaken) * 100
                            : 0;
                    const barWidth = Math.max(
                        0,
                        Math.min(100, (row.dtps / maxPlayerDtps) * 100)
                    );
                    return `
                        <div style="position:relative;display:grid;grid-template-columns:28px minmax(100px,1fr) 72px 82px 54px 58px;gap:8px;align-items:center;padding:4px;border-top:1px solid rgba(255,255,255,.09);overflow:hidden;">
                            <span aria-hidden="true" style="position:absolute;inset:2px 0;width:100%;border-radius:4px;background:rgba(232,96,105,.28);opacity:${(0.06 + (barWidth / 100) * 0.18).toFixed(3)};"></span>
                            <span style="position:relative;color:#b9c8e5;">${rank + 1}</span>
                            <span style="position:relative;font-weight:700;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;" title="${escapeHtml(row.name)}">${escapeHtml(row.name)}</span>
                            <span style="position:relative;text-align:right;color:#ffb4ba;font-weight:700;">${row.dtps}</span>
                            <span style="position:relative;text-align:right;">${formatDamage(row.damage)}</span>
                            <span style="position:relative;text-align:right;color:#c2cee3;">${percentage.toFixed(1)}%</span>
                            <span style="position:relative;text-align:right;color:#ffced2;">${row.hits}</span>
                        </div>`;
                })
                .join("");

            const damageContent = `
                <div style="display:flex;flex-wrap:wrap;gap:5px 14px;padding:5px 7px;margin-bottom:4px;border-radius:6px;background:rgba(75,105,155,.18);">
                    <span>團隊 DPS <b style="color:#ffffff;">${teamDps}</b></span>
                    <span>總傷害 <b>${formatDamage(teamDamage)}</b></span>
                </div>
                <div style="display:grid;grid-template-columns:28px minmax(88px,1fr) 66px 78px 50px 68px;gap:8px;padding:2px 4px;color:#91a3c3;font-size:11px;">
                    <span>#</span><span>玩家</span><span style="text-align:right;">DPS</span><span style="text-align:right;">傷害</span><span style="text-align:right;">占比</span><span style="text-align:right;">封包命中</span>
                </div>
                ${rows}
                ${skillSections}
                <div style="margin-top:5px;color:#7f90ad;font-size:10px;">封包命中只統計單一玩家完成攻擊，且怪物端同時回傳結算計數的目標；多人同時完成、連續合併或無來源傷害不納入。預估命中依玩家精準與怪物閃避計算。</div>`;
            const healingContent = `
                <div style="display:flex;flex-wrap:wrap;gap:5px 14px;padding:5px 7px;margin-bottom:4px;border-radius:6px;background:rgba(54,145,91,.18);">
                    <span>團隊 HPS <b style="color:#bdfbd2;">${teamHps}</b></span>
                    <span>有效治療 <b>${formatDamage(observedHealing)}</b></span>
                    <span>可確認來源 <b style="color:#8be3ae;">${formatDamage(attributedHealing)}</b></span>
                    <span>無法歸屬來源 <b style="color:#ffd27a;">${formatDamage(unassignedHealingTotal)}</b></span>
                </div>
                <div style="display:grid;grid-template-columns:28px minmax(100px,1fr) 72px 82px 54px;gap:8px;padding:2px 4px;color:#91a3c3;font-size:11px;">
                    <span>#</span><span>治療來源</span><span style="text-align:right;">HPS</span><span style="text-align:right;">治療</span><span style="text-align:right;">占比</span>
                </div>
                ${unassignedHealingRow}
                ${healingRows}
                ${healingSkillSections}
                <div style="margin-top:7px;padding:4px 6px;border-radius:6px;background:rgba(45,130,155,.16);color:#bcecf4;font-weight:700;">接受治療排行</div>
                <div style="display:grid;grid-template-columns:28px minmax(100px,1fr) 72px 82px 54px;gap:8px;padding:2px 4px;color:#91a3c3;font-size:11px;">
                    <span>#</span><span>被治療玩家</span><span style="text-align:right;">受療／秒</span><span style="text-align:right;">有效治療</span><span style="text-align:right;">占比</span>
                </div>
                ${healingReceivedRows}
                <div style="margin-top:5px;color:#7f90ad;font-size:10px;">有效治療與接受治療依隊員 HP 實際上升量計算，溢補不計。官方公會封包通常不提供其他玩家的治療技能與治療者 ID，因此來源不明的數值會保留在「無法歸屬來源」；只有可確認唯一治療技能時才列入治療者。</div>`;
            const takenContent = `
                <div style="display:flex;flex-wrap:wrap;gap:5px 14px;padding:5px 7px;margin-bottom:4px;border-radius:6px;background:rgba(155,62,72,.18);">
                    <span>隊伍承傷／秒 <b style="color:#ffb4ba;">${teamDtps}</b></span>
                    <span>總承傷 <b>${formatDamage(teamDamageTaken)}</b></span>
                    <span>受擊次數 <b style="color:#ffced2;">${teamTakenHits}</b></span>
                </div>
                <div style="display:grid;grid-template-columns:28px minmax(100px,1fr) 72px 82px 54px 58px;gap:8px;padding:2px 4px;color:#91a3c3;font-size:11px;">
                    <span>#</span><span>受傷隊員</span><span style="text-align:right;">承傷／秒</span><span style="text-align:right;">承傷</span><span style="text-align:right;">占比</span><span style="text-align:right;">受擊</span>
                </div>
                ${damageTakenRows}
                <div style="margin-top:5px;color:#7f90ad;font-size:10px;">承傷依每位隊員 HP 下降量計算；受擊次數優先採用封包傷害計數，若該次未提供計數則以一次扣血更新計。</div>`;

            const activeTab = ["damage", "healing", "taken"].includes(
                combatStatsActiveTab
            )
                ? combatStatsActiveTab
                : "damage";
            const tabButton = (tab, label) => {
                const active = activeTab === tab;
                return `<button type="button" data-combat-stats-tab="${tab}" aria-pressed="${active}" style="border:1px solid ${active ? "rgba(124,203,255,.8)" : "rgba(135,153,187,.32)"};border-radius:6px;padding:3px 10px;background:${active ? "rgba(65,135,190,.52)" : "rgba(36,43,60,.78)"};color:${active ? "#fff" : "#aebbd3"};font-weight:${active ? "700" : "500"};cursor:pointer;">${label}</button>`;
            };
            const modeTitle = stats.mode === "guild" ? "公會戰鬥統計" : "隊伍戰鬥統計";
            panel.dataset.mode = stats.mode;
            const savedScrollTop = panel.scrollTop;
            panel.innerHTML = `
                <div style="display:flex;align-items:center;justify-content:space-between;gap:10px;flex-wrap:wrap;margin-bottom:5px;">
                    <strong style="font-size:14px;color:#8dd8ff;">${modeTitle}</strong>
                    <div role="tablist" aria-label="戰鬥統計頁面" style="display:flex;gap:5px;">${tabButton("damage", "傷害")}${tabButton("healing", "治療")}${tabButton("taken", "承傷")}</div>
                    <span style="color:#aebbd3;">${formatDuration(totalTime)}</span>
                </div>
                ${activeTab === "healing" ? healingContent : activeTab === "taken" ? takenContent : damageContent}`;
            panel.scrollTop = savedScrollTop;

            const statsBattleArea = panel.closest('[class*="BattlePanel_battleArea"]');
            const statsPlayersArea = statsBattleArea?.querySelector(
                '[class*="BattlePanel_playersArea"]'
            );
            const playerUnits = Array.from(
                statsPlayersArea?.querySelectorAll('[class*="CombatUnit_combatUnit"]') || []
            );
            const playerIndexByName = new Map(
                stats.players.map((player, index) => [getPlayerDisplayName(player, index), index])
            );
            playerUnits.forEach((unit) => {
                const name = unit.querySelector('[class*="CombatUnit_name"]')?.textContent?.trim();
                const status = unit.querySelector('[class*="CombatUnit_status"]');
                const index = playerIndexByName.get(name);
                if (!status || index === undefined) {
                    return;
                }
                let dpsElement = status.querySelector(".dps-info");
                if (!dpsElement) {
                    dpsElement = document.createElement("div");
                    dpsElement.className = "dps-info";
                    status.appendChild(dpsElement);
                }
                dpsElement.textContent = `DPS: ${playerDps[index]} (${formatDamage(
                    attributedDamage[index]
                )})`;
                Object.assign(dpsElement.style, {
                    width: "100%",
                    boxSizing: "border-box",
                    overflow: "visible",
                    whiteSpace: "nowrap",
                    textAlign: "center",
                    fontSize: "11px",
                    fontWeight: "700",
                    lineHeight: "20px",
                    letterSpacing: "-0.15px",
                });
                dpsElement.title =
                    (inferredByPlayer[index] || 0) > 0
                        ? "包含推測歸屬傷害；無法歸屬傷害未分配給玩家"
                        : "確定歸屬傷害；無法歸屬傷害未分配給玩家";
            });
            return;
        }

        const totalTime = totalDuration + (endTime - startTime) / 1000;
        const dps = totalDamage.map((damage) => (totalTime ? Math.round(damage / totalTime) : 0));
        const totalTeamDamage = totalDamage.reduce((acc, damage) => acc + damage, 0);
        const totalTeamDPS = totalTime ? Math.round(totalTeamDamage / totalTime) : 0;

        // 人物頭像下方顯示數字
        const playersContainer = document.querySelector(".BattlePanel_combatUnitGrid__2hTAM");
        if (playersContainer) {
            players.forEach((player, index) => {
                const playerElement = playersContainer.children[index];
                if (playerElement) {
                    const statusElement = playerElement.querySelector(".CombatUnit_status__3bH7W");
                    if (statusElement) {
                        let dpsElement = statusElement.querySelector(".dps-info");
                        if (!dpsElement) {
                            dpsElement = document.createElement("div");
                            dpsElement.className = "dps-info";
                            statusElement.appendChild(dpsElement);
                        }
                        dpsElement.textContent = `DPS: ${dps[index].toLocaleString()} (${numberFormatter(totalDamage[index])})`;
                    }
                }
            });
        }

        // 顯示圖表
        if (settingsMap.showDamageGraph.isTrue && !dragging) {
            const panel = getStatisticsDom();
            chart.data.labels = players.map((player) => player?.name);
            chart.data.datasets[0].data = dps;
            chart.update();

            // Update text information
            const days = Math.floor(totalTime / (24 * 3600));
            const hours = Math.floor((totalTime % (24 * 3600)) / 3600);
            const minutes = Math.floor((totalTime % 3600) / 60);
            const seconds = Math.floor(totalTime % 60);
            const formattedTime = `${days}d ${hours}h ${minutes}m ${seconds}s`;

            const dpsText = document.getElementById("script_dpsText");
            const playerRows = players
                .map((player, index) => {
                    const dpsFormatted = dps[index].toLocaleString();
                    const totalDamageFormatted = totalDamage[index].toLocaleString();
                    const damagePercentage = totalTeamDamage ? ((totalDamage[index] / totalTeamDamage) * 100).toFixed(2) : 0;

                    // Get auraskill for the current player
                    let auraskill = "N/A";
                    let auraskillHrid = null;
                    if (player.combatAbilities && Array.isArray(player.combatAbilities)) {
                        const firstAbility = player.combatAbilities[0];
                        if (firstAbility && firstAbility.abilityHrid) {
                            auraskillHrid = firstAbility.abilityHrid;
                            auraskill = firstAbility.abilityHrid.split("/").pop().replace(/_/g, " ");
                            const validSkills = [
                                "revive",
                                "insanity",
                                "invincible",
                                "fierce aura",
                                "aqua aura",
                                "sylvan aura",
                                "flame aura",
                                "speed aura",
                                "critical aura",
                            ];
                            if (!validSkills.includes(auraskill)) {
                                auraskill = "N/A";
                            }
                        }
                    }

                    // Capitalize the first letter of each word in aura skill
                    auraskill = auraskill
                        .split(" ")
                        .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
                        .join(" ");

                    // Highlight the player with the highest DPS
                    const isHighestDPS = dps[index] === Math.max(...dps);
                    const dpsPrefix = isHighestDPS ? "🔥" : "";

                    return `
            <tr style="color: white;">
                <td style="font-weight: bold;">${dpsPrefix} ${player.name}</td>
                <td>${isZH ? (auraskillHrid ? ZHOthersDic[auraskillHrid] : "無") : auraskill}</td>
                <td>${dpsFormatted}</td>
                <td>${totalDamageFormatted}</td>
                <td>${damagePercentage}%</td>
            </tr>`;
                })
                .join("");

            dpsText.innerHTML = `
    <table style="width: 100%; border-collapse: collapse; font-size: smaller;">
        <thead>
            <tr style="text-align: left; color: white;">
                <th style="font-weight: bold;">${lang.players}</th>
                <th style="font-weight: bold;">${lang.aura}</th>
                <th style="font-weight: bold;">${lang.dpsTextDPS}</th>
                <th style="font-weight: bold;">${lang.dpsTextTotalDamage}</th>
                <th style="font-weight: bold;">${lang.damagePercentage}</th>
            </tr>
        </thead>
        <tbody>
            ${playerRows}
        </tbody>
        <tbody>
            <tr style="border-top: 2px solid white; font-weight: bold; text-align: left; color: white;">
                <td>${formattedTime}</td>
                <td></td>
                <td>${totalTeamDPS.toLocaleString()}</td>
                <td>${totalTeamDamage.toLocaleString()}</td>
                <td>100%</td>
            </tr>
        </tbody>
    </table>`;

            // Update hit chance table
            const hitChanceTable = document.getElementById("script_hitChanceTable");
            const hitChanceRows = players
                .map((player) => {
                    const playerName = player.name;
                    const playerHitChances = Object.entries(monsterCounts)
                        .map(([monsterName, count]) => {
                            const combatStyle = player.combatDetails.combatStats.combatStyleHrids[0].split("/").pop(); // Assuming only one combat style for simplicity
                            const evasionRating = monsterEvasion[monsterName][`${player.name}-${combatStyle}`];
                            const accuracy = player.combatDetails[`${combatStyle}AccuracyRating`];
                            const hitChance = calculateHitChance(accuracy, evasionRating);
                            return `<td style="color: white;">${hitChance.toFixed(0)}%</td>`;
                        })
                        .join("");
                    return `<tr><td style="color: white;">${playerName}</td>${playerHitChances}</tr>`;
                })
                .join("");

            hitChanceTable.innerHTML = `
    <table style="width: 100%; border-collapse: collapse; font-size: smaller;">
        <thead>
            <tr>
                <th style="font-size: smaller; white-space: normal; text-align: left; color: white;">${lang.hitChance}</th>
                ${Object.entries(monsterCounts)
                    .map(
                        ([monsterName, count]) =>
                            `<th style="font-size: smaller; white-space: normal; text-align: left; color: white;">${
                                isZH ? ZHOthersDic[monsterHrids[monsterName]] : monsterName
                            } (${count})</th>`
                    )
                    .join("")}
            </tr>
        </thead>
        <tbody>
            ${hitChanceRows}
        </tbody>
    </table>`;
        }
    };

    function isRecentLiveImportValue(timestamp, maxAgeMs) {
        const numericTimestamp = Number(timestamp);
        return Number.isFinite(numericTimestamp) && numericTimestamp > 0 && Date.now() - numericTimestamp <= maxAgeMs;
    }

    function readGuildBuffLevelValue(value) {
        const rawLevel = value && typeof value === "object"
            ? value.level ?? value.currentLevel ?? value.guildBuffLevel
            : value;
        const level = Number(rawLevel);
        return Number.isFinite(level) ? Math.max(0, Math.min(20, Math.floor(level))) : 0;
    }

    function findGuildBuffLevel(source, key) {
        if (!source || typeof source !== "object") return 0;
        const expectedHrids = [
            `/guild_buffs/${key}_combat`,
            `/guild_buffs/combat_${key}`,
            `/guild_buffs/${key}`,
            key,
        ];
        if (Array.isArray(source)) {
            const exact = source.find((entry) => expectedHrids.includes(entry?.guildBuffHrid ?? entry?.hrid));
            if (exact) return readGuildBuffLevelValue(exact);
            const fuzzy = source.find((entry) => {
                const hrid = String(entry?.guildBuffHrid ?? entry?.hrid ?? "").toLowerCase();
                return hrid.includes(key) && (hrid.includes("combat") || hrid.includes("battle"));
            });
            return readGuildBuffLevelValue(fuzzy);
        }
        for (const hrid of expectedHrids) {
            if (Object.prototype.hasOwnProperty.call(source, hrid)) {
                return readGuildBuffLevelValue(source[hrid]);
            }
        }
        const fuzzyKey = Object.keys(source).find((hrid) => {
            const normalized = hrid.toLowerCase();
            return normalized.includes(key) && (normalized.includes("combat") || normalized.includes("battle"));
        });
        return fuzzyKey ? readGuildBuffLevelValue(source[fuzzyKey]) : 0;
    }

    function extractGuildCombatBuffLevels(source) {
        const candidates = [
            source?.characterGuildBuffMap,
            source?.characterGuildBuffDict,
            source?.characterGuildBuffs,
            source?.characterGuildBuffLevelMap,
            source?.characterGuildBuffLevelDict,
            source?.guildBuffLevelMap,
            source?.guildBuffLevelDict,
        ];
        const guildBuffSource = candidates.find((candidate) => candidate && typeof candidate === "object");
        return Object.fromEntries(LIVE_IMPORT_GUILD_KEYS.map((key) => [key, findGuildBuffLevel(guildBuffSource, key)]));
    }

    function getFreshBattleForRoster(partyCharacterIDs) {
        if (!isRecentLiveImportValue(GM_getValue("new_battle_saved_at", 0), LIVE_IMPORT_BATTLE_MAX_AGE_MS)) return null;
        try {
            const battleObj = JSON.parse(GM_getValue("new_battle", ""));
            const battleCharacterIDs = (battleObj?.players ?? []).map((player) => String(player?.character?.id ?? "")).filter(Boolean);
            const expected = new Set(partyCharacterIDs.map(String));
            if (battleCharacterIDs.length !== expected.size || !battleCharacterIDs.every((id) => expected.has(id))) return null;
            return battleObj;
        } catch {
            return null;
        }
    }

    /* 為 https://amvoidguy.github.io/MWICombatSimulatorTest/ 新增匯入按鈕 */
    // Parts of code regarding group export are by Ratatatata (https://greasyfork.org/en/scripts/507255).
    function addImportButtonForAmvoidguy() {
        const checkElem = () => {
            const selectedElement = document.querySelector(`button#buttonImportExport`);
            if (selectedElement) {
                clearInterval(timer);
                let button = document.createElement("button");
                selectedElement.parentNode.parentElement.parentElement.insertBefore(button, selectedElement.parentElement.parentElement.nextSibling);
                button.id = "buttonMWIToolsLiveImport";
                button.textContent = isZH
                    ? "單人/組隊匯入(重新整理遊戲網頁更新人物資料)"
                    : "Import solo/group (Refresh game page to update character set)";
                button.style.backgroundColor = SCRIPT_COLOR_MAIN;
                button.style.padding = "5px";
                button.onclick = async function () {
                    console.log("Importer: Import button onclick");
                    if (
                        !GM_getValue("init_character_data", "") ||
                        !GM_getValue("init_client_data", "") ||
                        !isRecentLiveImportValue(
                            GM_getValue("init_character_data_saved_at", 0),
                            LIVE_IMPORT_CHARACTER_MAX_AGE_MS
                        )
                    ) {
                        button.textContent = isZH ? "請先重新整理遊戲頁面" : "Refresh the game page first";
                        button.style.backgroundColor = "#b02a37";
                        return false;
                    }
                    const getPriceButton = document.querySelector(`button#buttonGetPrices`);
                    if (getPriceButton) {
                        console.log("Click getPriceButton");
                        getPriceButton.click();
                    }
                    try {
                        await importDataForAmvoidguy(button);
                    } catch (error) {
                        console.error("MWITools live import failed", error);
                        button.textContent = isZH ? "匯入失敗，請重新整理遊戲後再試" : "Import failed; refresh the game and retry";
                        button.style.backgroundColor = "#b02a37";
                    }
                    return false;
                };
            }
        };
        let timer = setInterval(checkElem, 200);
    }

    async function importDataForAmvoidguy(button) {
        const [exportObj, playerIDs, importedPlayerPositions, zone, difficultyTier, isZoneDungeon, isParty] = constructGroupExportObj();
        console.log(exportObj);
        console.log(playerIDs);

        document.querySelector(`a#group-combat-tab`).click();
        const importInputElem = document.querySelector(`input#inputSetGroupCombatAll`);
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
                document.querySelector(`input#simDungeonToggle`).dispatchEvent(new Event("change"));
                const selectDungeon = document.querySelector(`select#selectDungeon`);
                for (let i = 0; i < selectDungeon.options.length; i++) {
                    if (selectDungeon.options[i].value === zone) {
                        selectDungeon.options[i].selected = true;
                        break;
                    }
                }
            } else {
                document.querySelector(`input#simDungeonToggle`).checked = false;
                document.querySelector(`input#simDungeonToggle`).dispatchEvent(new Event("change"));
                const selectZone = document.querySelector(`select#selectZone`);
                for (let i = 0; i < selectZone.options.length; i++) {
                    if (selectZone.options[i].value === zone) {
                        selectZone.options[i].selected = true;
                        break;
                    }
                }
            }

            if (difficultyTier) {
                const selectDifficulty = document.querySelector(`select#selectDifficulty`);
                for (let i = 0; i < selectDifficulty.options.length; i++) {
                    if  (Number(selectDifficulty.options[i].value) === difficultyTier) {
                        selectDifficulty.options[i].selected = true;
                        break;
                    }
                }
            }
        }

        // Select sim players
        for (let i = 0; i < 5; i++) {
            if (importedPlayerPositions[i]) {
                if (document.querySelector(`input#player${i + 1}.form-check-input.player-checkbox`)) {
                    document.querySelector(`input#player${i + 1}.form-check-input.player-checkbox`).checked = true;
                    document.querySelector(`input#player${i + 1}.form-check-input.player-checkbox`).dispatchEvent(new Event("change"));
                }
            } else {
                if (document.querySelector(`input#player${i + 1}.form-check-input.player-checkbox`)) {
                    document.querySelector(`input#player${i + 1}.form-check-input.player-checkbox`).checked = false;
                    document.querySelector(`input#player${i + 1}.form-check-input.player-checkbox`).dispatchEvent(new Event("change"));
                }
            }
        }

        // Input simulation time
        document.querySelector(`input#inputSimulationTime`).value = 24;

        button.textContent = isZH ? "已匯入" : "Imported";
        if (!isParty) {
            setTimeout(() => {
                document.querySelector(`button#buttonStartSimulation`).click();
            }, 500);
        }
    }

    function constructGroupExportObj() {
        const characterObj = JSON.parse(GM_getValue("init_character_data", ""));
        const clientObj = JSON.parse(GM_getValue("init_client_data", ""));
        const activePartyMembers = Object.values(characterObj?.partyInfo?.partySlotMap ?? {}).filter(
            (member) => member?.characterID
        );
        const activePartyCharacterIDs = activePartyMembers.map((member) => String(member.characterID));
        const battleObj = getFreshBattleForRoster(activePartyCharacterIDs);
        let storedProfileList = [];
        try {
            storedProfileList = JSON.parse(GM_getValue("profile_export_list", "[]"));
            if (!Array.isArray(storedProfileList)) storedProfileList = [];
        } catch {
            storedProfileList = [];
        }

        const BLANK_PLAYER_JSON = `{\"player\":{\"attackLevel\":1,\"magicLevel\":1,\"meleeLevel\":1,\"rangedLevel\":1,\"defenseLevel\":1,\"staminaLevel\":1,\"intelligenceLevel\":1,\"equipment\":[]},\"food\":{\"/action_types/combat\":[{\"itemHrid\":\"\"},{\"itemHrid\":\"\"},{\"itemHrid\":\"\"}]},\"drinks\":{\"/action_types/combat\":[{\"itemHrid\":\"\"},{\"itemHrid\":\"\"},{\"itemHrid\":\"\"}]},\"abilities\":[{\"abilityHrid\":\"\",\"level\":\"1\"},{\"abilityHrid\":\"\",\"level\":\"1\"},{\"abilityHrid\":\"\",\"level\":\"1\"},{\"abilityHrid\":\"\",\"level\":\"1\"},{\"abilityHrid\":\"\",\"level\":\"1\"}],\"triggerMap\":{},\"zone\":\"/actions/combat/fly\",\"simulationTime\":\"100\",\"houseRooms\":{\"/house_rooms/dairy_barn\":0,\"/house_rooms/garden\":0,\"/house_rooms/log_shed\":0,\"/house_rooms/forge\":0,\"/house_rooms/workshop\":0,\"/house_rooms/sewing_parlor\":0,\"/house_rooms/kitchen\":0,\"/house_rooms/brewery\":0,\"/house_rooms/laboratory\":0,\"/house_rooms/observatory\":0,\"/house_rooms/dining_room\":0,\"/house_rooms/library\":0,\"/house_rooms/dojo\":0,\"/house_rooms/gym\":0,\"/house_rooms/armory\":0,\"/house_rooms/archery_range\":0,\"/house_rooms/mystical_study\":0}}`;

        const exportObj = {};
        exportObj[1] = BLANK_PLAYER_JSON;
        exportObj[2] = BLANK_PLAYER_JSON;
        exportObj[3] = BLANK_PLAYER_JSON;
        exportObj[4] = BLANK_PLAYER_JSON;
        exportObj[5] = BLANK_PLAYER_JSON;

        let isParty = false;
        const playerIDs = ["Player 1", "Player 2", "Player 3", "Player 4", "Player 5"];
        const importedPlayerPositions = [false, false, false, false, false];
        let zone = "/actions/combat/fly";
        let isZoneDungeon = false;
        let difficultyTier = 0;

        if (!characterObj?.partyInfo?.partySlotMap) {
            exportObj[1] = JSON.stringify(constructSelfPlayerExportObjFromInitCharacterData(characterObj, clientObj));
            playerIDs[0] = characterObj.character.name;
            importedPlayerPositions[0] = true;
            // Zone
            for (const action of characterObj.characterActions) {
                if (action && action.actionHrid.includes("/actions/combat/")) {
                    zone = action.actionHrid;
                    difficultyTier = action.difficultyTier;
                    isZoneDungeon = clientObj.actionDetailMap[action.actionHrid]?.combatZoneInfo?.isDungeon;
                    break;
                }
            }
        } else {
            isParty = true;
            let i = 1;
            for (const member of Object.values(characterObj.partyInfo.partySlotMap)) {
                if (member.characterID) {
                    if (String(member.characterID) === String(characterObj.character.id)) {
                        exportObj[i] = JSON.stringify(constructSelfPlayerExportObjFromInitCharacterData(characterObj, clientObj));
                        playerIDs[i - 1] = characterObj.character.name;
                        importedPlayerPositions[i - 1] = true;
                    } else {
                        const profileList = storedProfileList.filter(
                            (item) =>
                                String(item?.characterID) === String(member.characterID) &&
                                isRecentLiveImportValue(item?.timestamp, LIVE_IMPORT_PROFILE_MAX_AGE_MS)
                        );
                        if (profileList.length !== 1) {
                            console.log("Can not find stored profile for " + member.characterID);
                            playerIDs[i - 1] = isZH ? "請重新點開此隊友名片" : "Reopen this teammate's profile";
                            i++;
                            continue;
                        }
                        const profile = profileList[0];

                        const battlePlayerList = (battleObj?.players ?? []).filter(
                            (item) => String(item?.character?.id) === String(member.characterID)
                        );
                        let battlePlayer = null;
                        if (battlePlayerList.length === 1) {
                            battlePlayer = battlePlayerList[0];
                        }

                        exportObj[i] = JSON.stringify(constructPlayerExportObjFromStoredProfile(profile, clientObj, battlePlayer));
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

        return [exportObj, playerIDs, importedPlayerPositions, zone, difficultyTier, isZoneDungeon, isParty];
    }

    function constructSelfPlayerExportObjFromInitCharacterData(characterObj, clientObj) {
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
        for (const food of characterObj.actionTypeFoodSlotsMap["/action_types/combat"]) {
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
        for (const drink of characterObj.actionTypeDrinkSlotsMap["/action_types/combat"]) {
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
            if (ability && clientObj.abilityDetailMap[ability.abilityHrid].isSpecialAbility) {
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
        playerObj.triggerMap = { ...characterObj.abilityCombatTriggersMap, ...characterObj.consumableCombatTriggersMap };

        // HouseRooms
        playerObj.houseRooms = {};
        for (const house of Object.values(characterObj.characterHouseRoomMap)) {
            playerObj.houseRooms[house.houseRoomHrid] = house.level;
        }

        // Achievements
        playerObj.achievements = {};
        for (const achievement of Object.values(characterObj.characterAchievements)) {
            playerObj.achievements[achievement.achievementHrid] = achievement.isCompleted;
        }

        playerObj.guildCombatBuffLevels = extractGuildCombatBuffLevels(characterObj);

        return playerObj;
    }

    function constructPlayerExportObjFromStoredProfile(profile, clientObj, battlePlayer) {
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
            // Assume food and drinks based on equipted weapon
            const weapon =
                profile.profile.wearableItemMap &&
                (profile.profile.wearableItemMap["/item_locations/main_hand"]?.itemHrid ||
                    profile.profile.wearableItemMap["/item_locations/two_hand"]?.itemHrid);
            if (weapon) {
                if (weapon.includes("shooter") || weapon.includes("bow")) {
                    // 遠程
                    // xp,超遠,暴擊
                    playerObj.drinks["/action_types/combat"].push({
                        itemHrid: "/items/wisdom_coffee",
                    });
                    playerObj.drinks["/action_types/combat"].push({
                        itemHrid: "/items/super_ranged_coffee",
                    });
                    playerObj.drinks["/action_types/combat"].push({
                        itemHrid: "/items/critical_coffee",
                    });
                    // 2紅1藍
                    playerObj.food["/action_types/combat"].push({
                        itemHrid: "/items/spaceberry_donut",
                    });
                    playerObj.food["/action_types/combat"].push({
                        itemHrid: "/items/spaceberry_cake",
                    });
                    playerObj.food["/action_types/combat"].push({
                        itemHrid: "/items/star_fruit_yogurt",
                    });
                } else if (weapon.includes("boomstick") || weapon.includes("staff") || weapon.includes("trident")) {
                    // 法師
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
                    // 1紅2藍
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
                    // 雙手盾 精暮光
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
                    // 2紅1藍
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
                    // 戰士
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
                    // 2紅1藍
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
                if (ability && clientObj.abilityDetailMap[ability.abilityHrid].isSpecialAbility) {
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
        if (profile.profile.abilityCombatTriggersMap && profile.profile.consumableCombatTriggersMap) {
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
        for (const achievement of Object.values(profile.profile.characterAchievements)) {
            playerObj.achievements[achievement.achievementHrid] = achievement.isCompleted;
        }

        // Shared profiles do not always expose guild data. Explicit zeroes are
        // still exported so the simulator never reuses another player's shrine levels.
        playerObj.guildCombatBuffLevels = extractGuildCombatBuffLevels(profile.profile);

        return playerObj;
    }

    async function observeResultsForAmvoidguy() {
        let resultDiv = document.querySelector(`div.row`)?.querySelectorAll(`div.col-md-5`)?.[2]?.querySelector(`div.row > div.col-md-5`);
        while (!resultDiv) {
            await new Promise((resolve) => setTimeout(resolve, 100));
            resultDiv = document.querySelector(`div.row`)?.querySelectorAll(`div.col-md-5`)?.[2]?.querySelector(`div.row > div.col-md-5`);
        }

        const deathDiv = document.querySelector(`div#simulationResultPlayerDeaths`);
        const expDiv = document.querySelector(`div#simulationResultExperienceGain`);
        const consumeDiv = document.querySelector(`div#simulationResultConsumablesUsed`);
        deathDiv.style.backgroundColor = "#FFEAE9";
        deathDiv.style.color = "black";
        expDiv.style.backgroundColor = "#CDFFDD";
        expDiv.style.color = "black";
        consumeDiv.style.backgroundColor = "#F0F8FF";
        consumeDiv.style.color = "black";

        let div = document.createElement("div");
        div.id = "tillLevel";
        div.style.backgroundColor = "#FFFFE0";
        div.style.color = "black";
        div.textContent = "";
        resultDiv.append(div);

        new MutationObserver((mutationsList) => {
            mutationsList.forEach((mutation) => {
                if (mutation.addedNodes.length >= 3) {
                    handleResultForAmvoidguy(mutation.addedNodes, div);
                }
            });
        }).observe(expDiv, { childList: true, subtree: true });
    }

    function handleResultForAmvoidguy(expNodes, parentDiv) {
        const isZHIn3rdPartyWebsites = localStorage.getItem("i18nextLng")?.toLowerCase()?.startsWith("zh");

        let perHourGainExp = {
            stamina: 0,
            intelligence: 0,
            attack: 0,
            melee: 0,
            defense: 0,
            ranged: 0,
            magic: 0,
        };

        expNodes.forEach((expNode) => {
            if (getOriTextFromElement(expNode.children[0]).includes("Stamina") || getOriTextFromElement(expNode.children[0]).includes("耐力")) {
                perHourGainExp.stamina = Number(expNode.children[1].textContent);
            } else if (
                getOriTextFromElement(expNode.children[0]).includes("Intelligence") ||
                getOriTextFromElement(expNode.children[0]).includes("智力")
            ) {
                perHourGainExp.intelligence = Number(expNode.children[1].textContent);
            } else if (getOriTextFromElement(expNode.children[0]).includes("Attack") || getOriTextFromElement(expNode.children[0]).includes("攻擊")) {
                perHourGainExp.attack = Number(expNode.children[1].textContent);
            } else if (getOriTextFromElement(expNode.children[0]).includes("Melee") || getOriTextFromElement(expNode.children[0]).includes("近戰")) {
                perHourGainExp.melee = Number(expNode.children[1].textContent);
            } else if (
                getOriTextFromElement(expNode.children[0]).includes("Defense") ||
                getOriTextFromElement(expNode.children[0]).includes("防禦")
            ) {
                perHourGainExp.defense = Number(expNode.children[1].textContent);
            } else if (getOriTextFromElement(expNode.children[0]).includes("Ranged") || getOriTextFromElement(expNode.children[0]).includes("遠程")) {
                perHourGainExp.ranged = Number(expNode.children[1].textContent);
            } else if (getOriTextFromElement(expNode.children[0]).includes("Magic") || getOriTextFromElement(expNode.children[0]).includes("魔法")) {
                perHourGainExp.magic = Number(expNode.children[1].textContent);
            }
        });

        let data = GM_getValue("init_character_data", null);
        let obj = JSON.parse(data);
        if (!obj || !obj.characterSkills || !obj.currentTimestamp) {
            console.error("handleResult no character localstorage");
            return;
        }

        let skillLevels = {};
        for (const skill of obj.characterSkills) {
            if (skill.skillHrid.includes("stamina")) {
                skillLevels.stamina = {};
                skillLevels.stamina.skillName = "Stamina";
                skillLevels.stamina.skillZhName = "耐力";
                skillLevels.stamina.currentLevel = skill.level;
                skillLevels.stamina.currentExp = skill.experience;
            } else if (skill.skillHrid.includes("intelligence")) {
                skillLevels.intelligence = {};
                skillLevels.intelligence.skillName = "Intelligence";
                skillLevels.intelligence.skillZhName = "智力";
                skillLevels.intelligence.currentLevel = skill.level;
                skillLevels.intelligence.currentExp = skill.experience;
            } else if (skill.skillHrid.includes("attack")) {
                skillLevels.attack = {};
                skillLevels.attack.skillName = "Attack";
                skillLevels.attack.skillZhName = "攻擊";
                skillLevels.attack.currentLevel = skill.level;
                skillLevels.attack.currentExp = skill.experience;
            } else if (skill.skillHrid.includes("melee")) {
                skillLevels.melee = {};
                skillLevels.melee.skillName = "Melee";
                skillLevels.melee.skillZhName = "近戰";
                skillLevels.melee.currentLevel = skill.level;
                skillLevels.melee.currentExp = skill.experience;
            } else if (skill.skillHrid.includes("defense")) {
                skillLevels.defense = {};
                skillLevels.defense.skillName = "Defense";
                skillLevels.defense.skillZhName = "防禦";
                skillLevels.defense.currentLevel = skill.level;
                skillLevels.defense.currentExp = skill.experience;
            } else if (skill.skillHrid.includes("ranged")) {
                skillLevels.ranged = {};
                skillLevels.ranged.skillName = "Ranged";
                skillLevels.ranged.skillZhName = "遠程";
                skillLevels.ranged.currentLevel = skill.level;
                skillLevels.ranged.currentExp = skill.experience;
            } else if (skill.skillHrid.includes("magic")) {
                skillLevels.magic = {};
                skillLevels.magic.skillName = "Magic";
                skillLevels.magic.skillZhName = "魔法";
                skillLevels.magic.currentLevel = skill.level;
                skillLevels.magic.currentExp = skill.experience;
            }
        }

        const skillNamesInOrder = ["stamina", "intelligence", "attack", "melee", "defense", "ranged", "magic"];
        let hTMLStr = "";
        for (const skill of skillNamesInOrder) {
            hTMLStr += `<div id="${"inputDiv_" + skill}" style="display: flex; justify-content: flex-end">${
                isZHIn3rdPartyWebsites ? skillLevels[skill].skillZhName : skillLevels[skill].skillName
            }${isZHIn3rdPartyWebsites ? "到" : " to level "}<input id="${"input_" + skill}" type="number" value="${
                skillLevels[skill].currentLevel + 1
            }" min="${skillLevels[skill].currentLevel + 1}" max="200">${isZHIn3rdPartyWebsites ? "級" : ""}</div>`;
        }

        hTMLStr += `<div id="script_afterDays" style="display: flex; justify-content: flex-end"><input id="script_afterDays_input" type="number" value="1" min="0" max="200">${
            isZHIn3rdPartyWebsites ? "天后" : "days after"
        }</div>`;

        hTMLStr += `<div id="needDiv"></div>`;
        hTMLStr += `<div id="needListDiv"></div>`;
        parentDiv.innerHTML = hTMLStr;

        for (const skill of skillNamesInOrder) {
            const skillDiv = parentDiv.querySelector(`div#${"inputDiv_" + skill}`);
            const skillInput = parentDiv.querySelector(`input#${"input_" + skill}`);
            skillInput.onchange = () => {
                calculateTill(skill, skillInput, skillLevels, parentDiv, perHourGainExp, isZHIn3rdPartyWebsites);
            };
            skillInput.addEventListener("keyup", function (evt) {
                calculateTill(skill, skillInput, skillLevels, parentDiv, perHourGainExp, isZHIn3rdPartyWebsites);
            });
            skillDiv.onclick = () => {
                calculateTill(skill, skillInput, skillLevels, parentDiv, perHourGainExp, isZHIn3rdPartyWebsites);
            };
        }

        const daysAfterDiv = parentDiv.querySelector(`div#script_afterDays`);
        const daysAfterInput = parentDiv.querySelector(`input#script_afterDays_input`);
        daysAfterInput.onchange = () => {
            calculateAfterDays(daysAfterInput, skillLevels, parentDiv, perHourGainExp, skillNamesInOrder, isZHIn3rdPartyWebsites);
        };
        daysAfterInput.addEventListener("keyup", function (evt) {
            calculateAfterDays(daysAfterInput, skillLevels, parentDiv, perHourGainExp, skillNamesInOrder, isZHIn3rdPartyWebsites);
        });
        daysAfterDiv.onclick = () => {
            calculateAfterDays(daysAfterInput, skillLevels, parentDiv, perHourGainExp, skillNamesInOrder, isZHIn3rdPartyWebsites);
        };

        // 提取成本和收益
        const expensesSpan = document.querySelector(`span#expensesSpan`);
        const revenueSpan = document.querySelector(`span#revenueSpan`);
        const profitSpan = document.querySelector(`span#profitPreview`);
        const expenseDiv = document.querySelector(`div#script_expense`);
        const revenueDiv = document.querySelector(`div#script_revenue`);
        if (expenseDiv && expenseDiv) {
            expenseDiv.textContent = expensesSpan.parentNode.textContent;
            revenueDiv.textContent = revenueSpan.parentNode.textContent;
        } else {
            profitSpan.parentNode.insertAdjacentHTML(
                "beforeend",
                `<div id="script_expense" style="background-color: #DCDCDC; color: black;">${expensesSpan.parentNode.textContent}</div><div id="script_revenue" style="background-color: #DCDCDC; color: black;">${revenueSpan.parentNode.textContent}</div>`
            );
        }
    }

    function calculateAfterDays(daysAfterInput, skillLevels, parentDiv, perHourGainExp, skillNamesInOrder, isZHIn3rdPartyWebsites) {
        const initData_levelExperienceTable = JSON.parse(GM_getValue("init_client_data", null)).levelExperienceTable;
        const days = Number(daysAfterInput.value);
        parentDiv.querySelector(`div#needDiv`).textContent = `${isZHIn3rdPartyWebsites ? "" : "After"} ${days} ${
            isZHIn3rdPartyWebsites ? "天后：" : "days: "
        }`;
        const listDiv = parentDiv.querySelector(`div#needListDiv`);

        let html = "";
        let resultLevels = {};
        for (const skillName of skillNamesInOrder) {
            for (const skill of Object.values(skillLevels)) {
                if (skill.skillName.toLowerCase() === skillName.toLowerCase()) {
                    const exp = skill.currentExp + perHourGainExp[skill.skillName.toLowerCase()] * days * 24;
                    let level = 1;
                    while (initData_levelExperienceTable[level] < exp) {
                        level++;
                    }
                    level--;
                    const minExpAtLevel = initData_levelExperienceTable[level];
                    const maxExpAtLevel = initData_levelExperienceTable[level + 1] - 1;
                    const expSpanInLevel = maxExpAtLevel - minExpAtLevel;
                    const levelPercentage = Number(((exp - minExpAtLevel) / expSpanInLevel) * 100).toFixed(1);
                    resultLevels[skillName.toLowerCase()] = level;
                    html += `<div>${isZHIn3rdPartyWebsites ? skill.skillZhName : skill.skillName} ${isZHIn3rdPartyWebsites ? "" : "level"} ${level} ${
                        isZHIn3rdPartyWebsites ? "級" : ""
                    } ${levelPercentage}%</div>`;
                    break;
                }
            }
        }
        const combatLevel =
            0.1 * (resultLevels.stamina + resultLevels.intelligence + resultLevels.defense + resultLevels.attack + Math.max(resultLevels.melee, resultLevels.ranged, resultLevels.magic)) +
            0.5 * Math.max(resultLevels.attack, resultLevels.defense, resultLevels.melee, resultLevels.ranged, resultLevels.magic);
        html += `<div>${isZHIn3rdPartyWebsites ? "戰鬥等級：" : "Combat level: "} ${combatLevel.toFixed(1)}</div>`;
        listDiv.innerHTML = html;
    }

    function calculateTill(skillName, skillInputElem, skillLevels, parentDiv, perHourGainExp, isZHIn3rdPartyWebsites) {
        const initData_levelExperienceTable = JSON.parse(GM_getValue("init_client_data", null)).levelExperienceTable;
        const targetLevel = Number(skillInputElem.value);
        parentDiv.querySelector(`div#needDiv`).textContent = `${
            isZHIn3rdPartyWebsites ? skillLevels[skillName].skillZhName : skillLevels[skillName].skillName
        } ${isZHIn3rdPartyWebsites ? "到" : "to level"} ${targetLevel} ${isZHIn3rdPartyWebsites ? "級 還需：" : " takes: "}`;
        const listDiv = parentDiv.querySelector(`div#needListDiv`);

        const currentLevel = Number(skillLevels[skillName].currentLevel);
        const currentExp = Number(skillLevels[skillName].currentExp);
        if (targetLevel > currentLevel && targetLevel <= 200) {
            if (perHourGainExp[skillName] === 0) {
                listDiv.innerHTML = isZHIn3rdPartyWebsites ? "永遠" : "Forever";
            } else {
                let needExp = initData_levelExperienceTable[targetLevel] - currentExp;
                let needHours = needExp / perHourGainExp[skillName];
                let html = "";
                html += `<div>[${hoursToReadableString(needHours)}]</div>`;

                const consumeDivs = document.querySelectorAll(`div#simulationResultConsumablesUsed div.row`);
                for (const elem of consumeDivs) {
                    const conName = elem.children[0].textContent;
                    const conPerHour = Number(elem.children[1].textContent);
                    html += `<div>${conName} ${Number(conPerHour * needHours).toFixed(0)}</div>`;
                }

                listDiv.innerHTML = html;
            }
        } else {
            listDiv.innerHTML = isZHIn3rdPartyWebsites ? "輸入錯誤" : "Input error";
        }
    }

    function addImportButtonForMooneycalc() {
        const checkElem = () => {
            const selectedElement = document.querySelector(`div[role="tablist"]`);
            if (selectedElement) {
                clearInterval(timer);
                const button = document.createElement("button");
                selectedElement.parentNode.insertBefore(button, selectedElement.nextSibling);
                button.textContent = isZH
                    ? "匯入人物資料 (重新整理遊戲網頁更新人物資料)"
                    : "Import character settings (Refresh game page to update character settings)";
                button.style.backgroundColor = SCRIPT_COLOR_MAIN;
                button.style.color = "black";
                button.style.padding = "5px";
                button.onclick = function () {
                    console.log("Mooneycalc-Importer: Button onclick");
                    importDataForMooneycalc(button);
                    return false;
                };
            }
        };
        let timer = setInterval(checkElem, 200);
    }

    async function importDataForMooneycalc(button) {
        const characterData = JSON.parse(GM_getValue("init_character_data", ""));
        console.log(characterData);
        if (!characterData || !characterData.characterSkills || !characterData.currentTimestamp) {
            button.textContent = isZH ? "錯誤：沒有人物資料" : "Error: no character settings found";
            return;
        }

        const ls = constructMooneycalcLocalStorage(characterData);
        localStorage.setItem("settings", ls);

        button.textContent = isZH ? "已匯入" : "Imported";
        await new Promise((r) => setTimeout(r, 500));
        location.reload();
    }

    function constructMooneycalcLocalStorage(characterData) {
        const ls = localStorage.getItem("settings");
        let lsObj = JSON.parse(ls);

        // 人物技能等級
        lsObj.state.settings.levels = {};
        for (const skill of characterData.characterSkills) {
            lsObj.state.settings.levels[skill.skillHrid] = skill.level;
        }

        // 社群全域性buff
        lsObj.state.settings.communityBuffs = {};
        for (const buff of characterData.communityBuffs) {
            lsObj.state.settings.communityBuffs[buff.hrid] = buff.level;
        }

        // 裝備 & 裝備強化等級
        lsObj.state.settings.equipment = {};
        lsObj.state.settings.equipmentLevels = {};
        for (const item of characterData.characterItems) {
            if (item.itemLocationHrid !== "/item_locations/inventory") {
                lsObj.state.settings.equipment[item.itemLocationHrid.replace("item_locations", "equipment_types")] = item.itemHrid;
                lsObj.state.settings.equipmentLevels[item.itemLocationHrid.replace("item_locations", "equipment_types")] = item.enhancementLevel;
            }
        }

        // 房子
        lsObj.state.settings.houseRooms = {};
        for (const house of Object.values(characterData.characterHouseRoomMap)) {
            lsObj.state.settings.houseRooms[house.houseRoomHrid] = house.level;
        }

        return JSON.stringify(lsObj);
    }

    function hoursToReadableString(hours) {
        const sec = hours * 60 * 60;
        if (sec >= 86400) {
            return Number(sec / 86400).toFixed(1) + (isZH ? " 天" : " days");
        }
        const d = new Date(Math.round(sec * 1000));
        function pad(i) {
            return ("0" + i).slice(-2);
        }
        let str = d.getUTCHours() + "h " + pad(d.getUTCMinutes()) + "m " + pad(d.getUTCSeconds()) + "s";
        return str;
    }

    function addExportButton(obj) {
        const checkElem = () => {
            const selectedElement = document.querySelector(`div.SharableProfile_overviewTab__W4dCV`);
            if (selectedElement) {
                clearInterval(timer);

                const button = document.createElement("button");
                selectedElement.appendChild(button);
                button.textContent = isZH ? "匯出人物到剪貼簿" : "Export to clipboard";
                button.style.borderRadius = "5px";
                button.style.height = "30px";
                button.style.backgroundColor = SCRIPT_COLOR_MAIN;
                button.style.color = "black";
                button.style.boxShadow = "none";
                button.style.border = "0px";
                button.onclick = function () {
                    let exportString = "";
                    const playerID = obj.profile.characterSkills[0].characterID;
                    const clientObj = JSON.parse(GM_getValue("init_client_data", ""));
                    const characterObj = JSON.parse(GM_getValue("init_character_data", ""));

                    if (playerID === characterObj.character.id) {
                        exportString = JSON.stringify(constructSelfPlayerExportObjFromInitCharacterData(characterObj, clientObj));
                    } else {
                        const storedProfileList = JSON.parse(GM_getValue("profile_export_list", "[]"));
                        const profileList = storedProfileList.filter((item) => item.characterID === playerID);
                        let profile = null;
                        if (profileList.length !== 1) {
                            console.log("Can not find stored profile for " + playerID);
                            return;
                        }
                        profile = profileList[0];

                        let battlePlayer = null;
                        if (GM_getValue("new_battle", "")) {
                            const battleObj = JSON.parse(GM_getValue("new_battle", ""));
                            const battlePlayerList = battleObj.players.filter((item) => item.character.id === playerID);
                            if (battlePlayerList.length === 1) {
                                battlePlayer = battlePlayerList[0];
                            }
                        }

                        exportString = JSON.stringify(constructPlayerExportObjFromStoredProfile(profile, clientObj, battlePlayer));
                    }

                    console.log(exportString);
                    navigator.clipboard.writeText(exportString);
                    button.textContent = isZH ? "已複製" : "Copied";
                    return false;
                };
                return false;
            }
        };
        let timer = setInterval(checkElem, 200);
    }
})();
