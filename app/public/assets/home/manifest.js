// Single asset gateway for Nuestro Hogar.
// New RPG packs plug into this manifest; app.js must not depend on pack internals.
import {freeHomeAssets} from './free-assets.js';
export const homeAssetManifest=Object.fromEntries(Object.entries(freeHomeAssets).map(([id,src])=>[id,{src,kind:'furniture',pack:'kenney-furniture-cc0'}]));
