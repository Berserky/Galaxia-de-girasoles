// Single asset gateway for Nuestro Hogar.
import {freeHomeAssets} from './free-assets.js';
import {rpgIndoorSheet,rpgIndoor} from './rpg-indoors.js';
const legacy=Object.fromEntries(Object.entries(freeHomeAssets).map(([id,src])=>[id,{src,kind:'furniture',pack:'kenney-furniture-cc0'}]));
// Curated coordinates from Kenney Roguelike Indoors. One tile = 16px + 1px spacing.
const rpg={
 rpgChair:{sheet:rpgIndoorSheet,col:0,row:3,kind:'furniture'},rpgTable:{sheet:rpgIndoorSheet,col:3,row:1,kind:'furniture'},
 rpgShelf:{sheet:rpgIndoorSheet,col:7,row:0,kind:'furniture'},rpgPlant:{sheet:rpgIndoorSheet,col:17,row:0,kind:'prop'},
 rpgCabinet:{sheet:rpgIndoorSheet,col:0,row:14,kind:'furniture'},rpgCounter:{sheet:rpgIndoorSheet,col:8,row:14,kind:'furniture'},
 rpgRug:{sheet:rpgIndoorSheet,col:20,row:14,kind:'floor'},rpgWall:{sheet:rpgIndoorSheet,col:0,row:0,kind:'structural'}
};
export const homeAssetManifest={...legacy,...rpg};
export {rpgIndoor};
