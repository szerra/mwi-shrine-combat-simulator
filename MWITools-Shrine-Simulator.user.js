// ==UserScript==
// @name         MWITools 繁體中文修正版（神龕模擬器網路版）
// @namespace    http://tampermonkey.net/
// @version      25.13-TW.19
// @description  MWITools 25.13 繁體中文修正版；支援 GitHub Pages 神龕模擬器、防止舊資料匯入並匯出戰鬥神龕等級。
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
            const unassignedHitSampleTotal = Number(stats.unassignedHitSamples) || 0;
            const teamDamage = confirmedTotal + inferredTotal + unassignedTotal;
            const teamDps = totalTime > 0 ? Math.round(teamDamage / totalTime) : 0;
            const confirmedRate = teamDamage > 0 ? (confirmedTotal / teamDamage) * 100 : 100;

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
            const overallHitChanceWeight = skillBreakdowns.reduce(
                (sum, player) =>
                    sum +
                    (Number.isFinite(player.hitChance)
                        ? player.hitChanceWeight || attributedDamage[player.index] || 0
                        : 0),
                0
            );
            const overallHitChance =
                overallHitChanceWeight > 0
                    ? skillBreakdowns.reduce(
                          (sum, player) =>
                              sum +
                              (Number.isFinite(player.hitChance)
                                  ? player.hitChance *
                                    (player.hitChanceWeight ||
                                        attributedDamage[player.index] ||
                                        0)
                                  : 0),
                          0
                      ) / overallHitChanceWeight
                    : null;
            const overallObservedAttempts = skillBreakdowns.reduce(
                (sum, player) => sum + player.observedAttempts,
                0
            );
            const overallObservedHits = skillBreakdowns.reduce(
                (sum, player) => sum + player.observedHits,
                0
            );
            const overallObservedHitRate =
                overallObservedAttempts > 0
                    ? (overallObservedHits / overallObservedAttempts) * 100
                    : null;
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
                    <span>確定 <b style="color:#8be3ae;">${formatDamage(confirmedTotal)}</b></span>
                    <span>推測 <b style="color:#ffd27a;">${formatDamage(inferredTotal)}</b></span>
                    <span>無法歸屬 <b style="color:#ff8f8f;">${formatDamage(unassignedTotal)}</b></span>
                    <span>確定率 <b>${confirmedRate.toFixed(1)}%</b></span>
                    <span>整體封包命中率 <b style="color:#7fd8ff;">${Number.isFinite(overallObservedHitRate) ? `${overallObservedHitRate.toFixed(1)}% (${overallObservedHits}/${overallObservedAttempts})` : "—"}</b></span>
                    <span>未歸屬命中樣本 <b style="color:#ffb36b;">${unassignedHitSampleTotal}</b></span>
                    <span>整體預估命中率 <b style="color:#9fe1c1;">${Number.isFinite(overallHitChance) ? `${overallHitChance.toFixed(1)}%` : "—"}</b></span>
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

    const LIVE_IMPORT_CHARACTER_MAX_AGE_MS = 10 * 60 * 1000;
    const LIVE_IMPORT_PROFILE_MAX_AGE_MS = 10 * 60 * 1000;
    const LIVE_IMPORT_BATTLE_MAX_AGE_MS = 10 * 60 * 1000;
    const LIVE_IMPORT_GUILD_KEYS = ["force", "tempo", "spirit", "rarity", "scholar"];

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
