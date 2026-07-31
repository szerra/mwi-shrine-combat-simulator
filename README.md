# MWI Shrine Combat Simulator

Public GitHub Pages build of the MWI combat simulator with combat-guild-shrine controls and a dedicated MWITools live importer.

Site: <https://szerra.github.io/mwi-shrine-combat-simulator/>

## 使用方式

1. 停用其他所有 MWITools 腳本，避免重複攔截遊戲資料。
2. 在網站點選「安裝／更新即時匯入外掛」。
3. 回到 Milky Way Idle 遊戲頁重新整理，等角色資料載入完成。
4. 組隊匯入時，請在 10 分鐘內逐一打開目前隊友的角色名片。
5. 回到模擬器點選「單人／組隊匯入」。

## 資料與隱私

網站只提供靜態程式檔案。角色、隊友、房屋、技能與神龕資料由 Tampermonkey 腳本保存在各使用者自己的瀏覽器中，不會寫入此 repository。

匯入器會拒絕超過 10 分鐘的角色快照、過期隊友名片，以及名單與目前隊伍不一致的戰鬥封包。缺少神龕欄位時會使用 0，不會沿用前一位角色的數值。

## Credits

- Combat simulator based on the MWI Combat Simulator project by AmVoidGuy and contributors.
- Live importer based on MWITools by bot7420 and shykai, distributed under the license declared in the userscript header.
