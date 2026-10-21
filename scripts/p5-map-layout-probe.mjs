/**
 * Read-only, synthetic WebView map-layout preflight for QA.
 * It does not patch the Android instrumentation or approve an Android run.
 * The expression is designed to be executed atomically in a single JS turn.
 */
export const placeLayoutProbeExpression = "JSON.stringify((()=>{\n  const mapNode=document.querySelector('#map');\n  const button=document.querySelector('#map .gmap-marker.place.open button');\n  const expected='map';\n  const missing=[];\n  if(view!==expected)missing.push('wrong-view');\n  if(!mapNode)missing.push('map-detached');\n  if(!button)missing.push('marker-detached');\n  if(!map||map.el!==mapNode)missing.push('presenter-replaced');\n  if(mapStateReadsInFlight!==0)missing.push('map-state-in-flight');\n  const rect=button?.getBoundingClientRect();\n  const mapRect=mapNode?.getBoundingClientRect();\n  const ready=missing.length===0&&!!rect&&!!mapRect;\n  const result={\n    kind:ready?'READY':'NOT_READY',\n    missing,\n    viewport:innerWidth,\n    markerCount:document.querySelectorAll('#map .gmap-marker.place button').length,\n    focused:!!button&&document.activeElement===button,\n    markerInside:!!rect&&rect.width>=44&&rect.height>=44,\n    noOverflow:document.documentElement.scrollWidth<=innerWidth+3,\n    mapInside:!!mapRect&&mapRect.left>=-2&&mapRect.right<=innerWidth+2\n  };\n  return result;\n})())";

const fields=['kind','missing','focused','markerInside','noOverflow','mapInside'];
/** Throws explicit blocking errors instead of treating ERR:/null/partial JSON as PASS. */
export function parsePlaceLayoutProof(raw){
  if(typeof raw!=='string'||!raw.trim())throw new Error('BLOCK_QA: EMPTY_WEBVIEW_RESULT');
  if(raw.startsWith('ERR:'))throw new Error('BLOCK_QA: WEBVIEW_JS_ERROR '+raw.slice(4));
  let data;
  try { data=JSON.parse(raw); }
  catch {throw new Error('BLOCK_QA: NON_JSON_WEBVIEW_RESULT');}
  if(!data||typeof data!=='object'||Array.isArray(data)||fields.some(k=>!(k in data)))
    throw new Error('BLOCK_QA: INCOMPLETE_PLACE_LAYOUT_PROOF');
  if(!['READY','NOT_READY'].includes(data.kind)||!Array.isArray(data.missing)||
     ['focused','markerInside','noOverflow','mapInside'].some(k=>typeof data[k]!=='boolean'))
    throw new Error('BLOCK_QA: INVALID_PLACE_LAYOUT_PROOF');
  if(data.kind==='NOT_READY')return {status:'RETRYABLE_NOT_READY',missing:data.missing};
  if(data.missing.length)throw new Error('BLOCK_QA: INCONSISTENT_READY_STATE');
  if(!data.focused||!data.markerInside||!data.noOverflow||!data.mapInside)
    return {status:'FAIL_REQUIREMENT',proof:data};
  return {status:'PASS',proof:data};
}
