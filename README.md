# MWI Shrine Combat Simulator

加入公會戰鬥神龕設定的 MWI 戰鬥模擬器，並提供不依賴 MWITools 的獨立即時匯入橋接器。

- 模擬器：<https://szerra.github.io/mwi-shrine-combat-simulator/>
- [安裝／更新神龕模擬器橋接器](https://szerra.github.io/mwi-shrine-combat-simulator/MWI-Shrine-Simulator-Bridge.user.js)

## 建議使用方式

1. 安裝「MWI 神龕模擬器橋接器」。
2. 重新整理 Milky Way Idle，等待角色資料載入完成。
3. 組隊時，逐一打開隊友的遊戲內角色資料頁，讓橋接器保存隊友配裝與技能。
4. 開啟本模擬器並按「單人／組隊匯入」。
5. 角色、裝備、技能、房屋、成就、戰鬥區域及五項神龕等級會一起匯入。

橋接器只被動讀取遊戲本來就收到的 WebSocket 資料，存放在它自己的 Tampermonkey 儲存區。它不依賴 MWITools，也不讀寫 `MWI Guild Data Bridge` 的資料、API 網址、試算表或任何公會管理設定。

如果角色、隊友配裝或神龕剛更新，請重新整理遊戲並重新開啟有變更的隊友資料頁，再回模擬器匯入。

## 與公會資料插件的關係

- 公會資料插件保持原樣，現有上傳、公告、試煉配置與試算表功能不會改變。
- 沒有公會橋接整合時，只是兩個插件不互相交換資料；不會讓公會資料插件少掉功能。
- 本橋接器沒有公會後端網址，也沒有公會資料儲存鍵。

## 舊版 MWITools 相容包

`MWITools-Shrine-Simulator.user.js` 仍留在儲存庫，供已安裝舊方案的人繼續使用，但新架構不需要啟用它。原作者的 MWITools 可以獨立安裝並依原作者版本更新。

## Hit Tracker 相容修正版

- [安裝 Hit Tracker 相容修正版](https://szerra.github.io/mwi-shrine-combat-simulator/MWI-Hit-Tracker-Canvas-Szerra.user.js)

這版修正與舊 MWITools 相容包同時使用時的角色／怪物圖卡縮放與 HP 扣血殘影位置。若不再使用舊 MWITools 相容包，可優先改回原作者版本。

## 重新建置橋接器

橋接器匯入格式沿用 MWITools 的模擬器匯入邏輯，因此建置時需要指定相符版本的 `external-tools.js`：

```powershell
node .\scripts\build-standalone-shrine-bridge.mjs "C:\path\to\MWITools\src\features\external-tools.js"
node --check .\MWI-Shrine-Simulator-Bridge.user.js
node .\tests\standalone-shrine-bridge.test.cjs
```

## Credits

- Combat simulator based on the MWI Combat Simulator project by AmVoidGuy and contributors.
- Live importer based on MWITools by bot7420, shykai and Stella, under `CC-BY-NC-SA-4.0`.
