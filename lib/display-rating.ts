/** Presentation-only scaling: stored EA ratings remain unchanged. */
export function displayRating(value:number|null|undefined):number{
  if(value==null||!Number.isFinite(Number(value)))return 0;
  return Math.max(1,Math.min(100,Math.round(Number(value)+9)));
}
/** Convert a displayed rating filter bound back to the stored EA scale. */
export function rawRating(value:number):number{
  return value-9;
}
