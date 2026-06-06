// Vitest 全域前置：在任何測試模組（含 pixi.js）載入前執行。
//
// pixi.js 在 import 階段就會呼叫 isSafari() → 讀取 navigator.userAgent，
// 而 vitest 的 'node' 環境沒有 navigator，會丟 "navigator is not defined"
// 導致 MonsterSpawner.test.ts 在收集階段就整包失敗（CI 限定，視 pixi 版本而定）。
//
// 這裡補一個最小 navigator shim，讓 pixi 能在無 DOM 的 node 環境下載入。
// 只在缺少時才補，不覆蓋真實環境（jsdom / 瀏覽器）既有的 navigator。
if (typeof (globalThis as any).navigator === 'undefined') {
  ;(globalThis as any).navigator = { userAgent: 'node' }
}
