// Kenney Roguelike Indoors atlas registry.
// Atlas: 27 columns x 18 rows, 16px cells with 1px spacing.
import {rpgIndoorSheet,rpgIndoor} from './rpg-indoors.js';
const structuralCols=new Set([23,24,25,26]);
const generated={};
for(let row=0;row<18;row++)for(let col=0;col<27;col++){
 const n=row*27+col;
 if(n>=480)continue;
 const id=`rpg_${String(n).padStart(3,'0')}`;
 generated[id]={sheet:rpgIndoorSheet,col,row,kind:structuralCols.has(col)?'structural':col>=16?'prop':'furniture'};
}
generated.rpgFloorDefault={sheet:rpgIndoorSheet,col:1,row:0,kind:'floor'};
generated.rpgWallDefault={sheet:rpgIndoorSheet,col:24,row:0,kind:'structural'};
export const homeAssetManifest=generated;
export {rpgIndoor};
