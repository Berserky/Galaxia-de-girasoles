// Fechas civiles: sin desplazamientos por zona horaria y sin inventar un 29 de febrero.
export function nextOccurrence(date,annual,today) {
 if(!annual)return date;
 for(let year=Math.max(Number(date.slice(0,4)),Number(today.slice(0,4)));year<Number(today.slice(0,4))+10;year++) {
  const candidate=year+date.slice(4);
  if(candidate>=today&&new Date(candidate+'T12:00:00Z').toISOString().slice(0,10)===candidate)return candidate;
 }
 return date;
}
