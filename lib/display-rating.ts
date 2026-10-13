/** Presentation-only scaling: existing EA ratings stay unchanged in storage. */
export function displayRating(value:number|null|undefined):number{
  if(value==null||!Number.isFinite(Number(value)))return 0;
  return Math.max(1,Math.min(100,Math.round(1+(Number(value)-47)*99/44)));
}
/** Convert a displayed 1–100 filter bound back to the stored EA scale. */
export function rawRating(value:number):number{
  return 47+(value-1)*44/99;
}
