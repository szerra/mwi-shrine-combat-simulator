# MWI Shrine Combat Simulator

Public GitHub Pages build of the MWI combat simulator with combat-guild-shrine controls and a dedicated MWITools live importer.

Site: <https://szerra.github.io/mwi-shrine-combat-simulator/>

## Hit Tracker 相容修正版

安裝網址：<https://szerra.github.io/mwi-shrine-combat-simulator/MWI-Hit-Tracker-Canvas-Szerra.user.js>

這版修正與 MWITools 同時使用時角色／怪物圖卡反覆縮放，以及紅色扣血殘影跑離 HP 條的問題。安裝後請在 Tampermonkey **停用原作者的 `MWI-Hit-Tracker-Canvas`**，只保留名稱含「Szerra 相容修正版」的版本，否則兩份腳本會重複產生特效。

## 使用方式

1. 停用其他所有 MWITools 腳本，避免重複攔截遊戲資料。
2. 在網站點選「安裝／更新即時匯入外掛」。
3. 回到 Milky Way Idle 遊戲頁重新整理，等角色資料載入完成。
4. 組隊匯入時，請在 10 分鐘內逐一打開目前隊友的角色名片。
5. 回到模擬器點選「單人／組隊匯入」。

這份 MWITools 已內建完整的「MWI 自訂角色圖庫」，遊戲右下角的 🎭 可開啟圖庫；拖曳圖庫標題列即可自由移動，位置會自動保存。新安裝者不需要再安裝獨立角色圖庫腳本。

戰鬥畫面會依可用寬高自動調整角色卡與統計窗；1920×1080、Windows 125% 顯示比例且展開聊天室時，會切換成緊湊版面，避免統計窗被壓成一條橫向捲軸。

傷害統計最上方摘要只顯示「團隊 DPS」與「總傷害」，不再顯示確定／推測／無法歸屬與整體命中率等診斷欄位。

已安裝舊版獨立角色圖庫的人，先把獨立版更新到 `0.1.8` 並重新整理遊戲一次，角色與圖片指派會移交給 MWITools，重複介面會自動停用。圖片本體仍保存在相同遊戲網域的 IndexedDB，不會上傳到 GitHub。

## 資料與隱私

網站只提供靜態程式檔案。角色、隊友、房屋、技能與神龕資料由 Tampermonkey 腳本保存在各使用者自己的瀏覽器中，不會寫入此 repository。

匯入器會拒絕超過 10 分鐘的角色快照、過期隊友名片，以及名單與目前隊伍不一致的戰鬥封包。缺少神龕欄位時會使用 0，不會沿用前一位角色的數值。

## 發布插件更新

插件使用固定網址：

`https://szerra.github.io/mwi-shrine-combat-simulator/MWITools-Shrine-Simulator.user.js`

更新時請保留檔名 `MWITools-Shrine-Simulator.user.js`，提高檔案頂端的 `@version`，再推送到 `main`。GitHub Pages 完成部署後，Tampermonkey 會透過插件內的 `@updateURL` 與 `@downloadURL` 檢查新版本。

角色圖庫的維護來源是 `mwi-szerra-suite/standalone/avatar-library.user.js`。修改後可執行 `node scripts/embed-avatar-library.mjs <avatar-library.user.js 路徑>`，再更新 MWITools 版本並發布。

## Credits

- Combat simulator based on the MWI Combat Simulator project by AmVoidGuy and contributors.
- Live importer based on MWITools by bot7420 and shykai, distributed under the license declared in the userscript header.
