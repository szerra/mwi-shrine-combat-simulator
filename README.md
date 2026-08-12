# MWI Shrine Combat Simulator

Public GitHub Pages build of the MWI combat simulator with combat-guild-shrine controls and a dedicated MWITools live importer.

Site: <https://szerra.github.io/mwi-shrine-combat-simulator/>

MWITools `26.4.5-TW.28` 以官方 `26.4.5` 為底，保留新版 DPS／HPS／承傷、戰鬥片段、歷史與資產中心，並永久保留上一次成功擷取的角色與隊友資料。資料只在重新整理遊戲頁面或重新開啟隊友名片時更新，不會因時間經過而失效；簡體與繁體物品名稱都能辨識。

這是給 Szerra 整合包使用的相容版。第一次升級會自動關閉與市場、戰鬥特效、角色功能重複的 MWITools 項目；之後玩家在遊戲設定內自行調整的開關會保留，不會在每次更新時重設。新版 DPS／HPS／承傷預設保持開啟。

## Hit Tracker 相容修正版

安裝網址：<https://szerra.github.io/mwi-shrine-combat-simulator/MWI-Hit-Tracker-Canvas-Szerra.user.js>

這版修正與 MWITools 同時使用時角色／怪物圖卡反覆縮放，以及紅色扣血殘影跑離 HP 條的問題。安裝後請在 Tampermonkey **停用原作者的 `MWI-Hit-Tracker-Canvas`**，只保留名稱含「Szerra 相容修正版」的版本，否則兩份腳本會重複產生特效。

## 使用方式

1. 停用其他所有 MWITools 腳本，避免重複攔截遊戲資料。
2. 在網站點選「安裝／更新即時匯入外掛」。
3. 回到 Milky Way Idle 遊戲頁重新整理，等角色資料載入完成。
4. 組隊匯入時，逐一打開目前隊友的角色名片；之後資料會持續保留，直到再次開啟該隊友名片更新。
5. 回到模擬器點選「單人／組隊匯入」。

這份 MWITools 已內建完整的「MWI 自訂角色圖庫」，遊戲右下角的 🎭 可開啟圖庫；拖曳圖庫標題列即可自由移動，位置會自動保存。新安裝者不需要再安裝獨立角色圖庫腳本。

戰鬥畫面會依可用寬高自動調整角色卡與統計窗；1920×1080、Windows 125% 顯示比例且展開聊天室時，會切換成緊湊版面，避免統計窗被壓成一條橫向捲軸。

傷害統計最上方摘要只顯示「團隊 DPS」與「總傷害」，不再顯示確定／推測／無法歸屬與整體命中率等診斷欄位。

已安裝舊版獨立角色圖庫的人，先把獨立版更新到 `0.1.8` 並重新整理遊戲一次，角色與圖片指派會移交給 MWITools，重複介面會自動停用。圖片本體仍保存在相同遊戲網域的 IndexedDB，不會上傳到 GitHub。

## 資料與隱私

網站只提供靜態程式檔案。角色、隊友、房屋、技能與神龕資料由 Tampermonkey 腳本保存在各使用者自己的瀏覽器中，不會寫入此 repository。

匯入器不會因時間經過清除角色或隊友資料。重新整理遊戲頁面會更新自己的角色與目前隊伍，重新開啟隊友名片會更新該隊友；戰鬥封包仍必須與目前隊伍名單一致，遊戲重新整理後舊戰鬥封包會作廢。缺少神龕欄位時會使用 0，不會沿用前一位角色的數值。

## 發布插件更新

插件使用固定網址：

`https://szerra.github.io/mwi-shrine-combat-simulator/MWITools-Shrine-Simulator.user.js`

更新時請保留檔名 `MWITools-Shrine-Simulator.user.js`，提高檔案頂端的 `@version`，再推送到 `main`。GitHub Pages 完成部署後，Tampermonkey 會透過插件內的 `@updateURL` 與 `@downloadURL` 檢查新版本。

角色圖庫的維護來源是 `mwi-szerra-suite/standalone/avatar-library.user.js`。修改後可執行 `node scripts/embed-avatar-library.mjs <avatar-library.user.js 路徑>`，再更新 MWITools 版本並發布。

升級新版 MWITools 時，先在官方模組化原始碼套用相容修改並完成官方測試與建置，再執行 `node scripts/package-mwitools-26-compat.mjs <MWITools.js 路徑>`。封裝程式會設定獨立更新網址、套用繁中物品字典、加入簡中查找別名，並沿用上一版內建角色圖庫。

## Credits

- Combat simulator based on the MWI Combat Simulator project by AmVoidGuy and contributors.
- Live importer based on MWITools by bot7420 and shykai, distributed under the license declared in the userscript header.
