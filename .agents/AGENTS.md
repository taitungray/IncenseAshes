# Incense Ashes - 核心設計準則 (Design Rules)

## 1. 純文字視覺表現 (Typography-Only Visuals)
**絕對核心原則**：遊戲中的所有實體（神明、法器、怪物等）**都必須且只能使用「中文字體（漢字）」來表現**。
- **嚴禁**使用或建議使用任何圖示、圖片（Icons/Images）來取代文字實體。
- 所有的視覺特效、打擊感與動態，都必須建立在「字體特效（CSS `text-shadow`, `filter`）」與「排版變形（CSS `transform`, `animation`）」的基礎上。
- **「拆字」**與**「疊字」**是本遊戲最重要的視覺亮點，請在後續的任何更新中堅持這項文化特色。
