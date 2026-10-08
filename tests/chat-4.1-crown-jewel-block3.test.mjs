import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";

const app=fs.readFileSync("android/app/src/main/assets/mobile/app.js","utf8");
const css=fs.readFileSync("android/app/src/main/assets/mobile/app.css","utf8");
const edge=fs.readFileSync("supabase/functions/android-companion/index.ts","utf8");
const bridge=fs.readFileSync("android/app/src/main/java/com/nuestragalaxia/companion/GalaxyBridge.java","utf8");
const api=fs.readFileSync("android/app/src/main/java/com/nuestragalaxia/companion/MobileApiClient.java","utf8");

test("Block 3 Galaxy Cards are searchable, categorized and identity-aware",()=>{
 assert.match(app,/function chatGalaxyLibraryRows\(/);assert.match(app,/chat-galaxy-category/);assert.match(app,/id="chatGalaxySearch"/);assert.match(app,/data-role="galaxy-empty"/);assert.match(app,/type==='POLL'/);assert.match(app,/type==='CHECKLIST'/);assert.match(css,/content-visibility:auto/);assert.doesNotMatch(app,/rows\.slice\(0,120\)\.map/);
});
test("Poll 4.1 uses real option rows and accessible reorder",()=>{
 assert.match(app,/data-kind="poll"/);assert.match(app,/chat-studio-row-add/);assert.match(app,/chat-studio-row-remove/);assert.match(app,/chat-studio-row-move/);assert.match(app,/fd\.getAll\('options'\)/);assert.match(app,/allowMultiple/);assert.match(app,/closesAt/);assert.doesNotMatch(app,/Opciones, una por línea/);assert.doesNotMatch(app,/<textarea name="options"/);
});
test("Checklist 4.1 shares the interactive composer pattern",()=>{
 assert.match(app,/data-kind="checklist"/);assert.match(app,/chatStudioOptionRow\('checklist'/);assert.match(app,/fd\.getAll\('items'\)/);assert.match(app,/VISTA PREVIA/);assert.doesNotMatch(app,/Elementos, uno por línea/);assert.doesNotMatch(app,/<textarea name="items"/);
});
test("GIF and Sticker Studio separates sources and supports sticker discovery",()=>{
 for(const label of ["Recientes","Favoritos","GIFs","Stickers","Nuestros"])assert.match(app,new RegExp(label));assert.match(app,/searchGiphy',chatStickerStudio\.query,isSticker/);assert.match(app,/Descubriendo tendencias/);assert.match(app,/scheduleChatStickerSearch/);assert.match(app,/loading="lazy"/);assert.match(app,/Powered by GIPHY/);assert.doesNotMatch(app,/clave protegida en servidor/);
});
test("Online stickers persist as GIPHY references without copying provider files",()=>{
 assert.match(edge,/operation==="import-online"/);
 assert.match(edge,/bucket:"giphy-external"/);
 assert.match(edge,/chatGiphyMediaUrl\(body\.url\)/);
 assert.match(edge,/chatGiphyMediaUrl\(attachmentMeta\.externalUrl\)/);
 assert.match(app,/messageType:'gif',attachment:\{provider:'giphy'/);
 assert.match(app,/messageType:'sticker',attachment:\{provider:'giphy'/);
 assert.match(app,/Powered by GIPHY/);
 assert.doesNotMatch(app,/GIPHY_API_KEY/);
 assert.doesNotMatch(bridge,/GIPHY_API_KEY/);
 assert.match(api,/BuildConfig\.GIPHY_API_KEY/);
});

test("Native bridge forwards stickers discovery to client GIPHY API",()=>{
 assert.match(bridge,/searchGiphy\(requestId,args\.optString\(0,""\),args\.optBoolean\(1,false\)\)/);assert.match(api,/stickers\?"stickers":"gifs"/);
});
