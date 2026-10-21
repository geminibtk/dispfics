/** Shared normalized position labels used for player ordering. */
export function normalizePlayerPosition(value:unknown):string{
 return String(value??"").trim().toLocaleUpperCase("tr-TR").replace(/Ğ/g,"G").replace(/İ/g,"I").replace(/Ş/g,"S").replace(/Ü/g,"U").replace(/Ö/g,"O").replace(/Ç/g,"C");
}
export function playerPlayablePositions(primary:unknown,alternates:unknown):string[]{
 const values=[primary,...(Array.isArray(alternates)?alternates:[])];
 return Array.from(new Set(values.map((x:any)=>normalizePlayerPosition(typeof x==="string"?x:x?.shortLabel||x?.label)).filter(Boolean)));
}
