import {playerPlayablePositions} from "./playerPositionOrder";
export type CountryPlayer={id:string;name:string;position:string;alternatePositions:unknown[];rating:number;age:number|null;market_value:number;avatar_url:string|null;nationality:string};
export function countryPlayerSort(a:CountryPlayer,b:CountryPlayer){
 const ap=playerPlayablePositions(a.position,a.alternatePositions),bp=playerPlayablePositions(b.position,b.alternatePositions);
 return b.rating-a.rating||bp.length-ap.length||(ap[0]||"").localeCompare(bp[0]||"","tr")||a.name.localeCompare(b.name,"tr")||(b.age??-1)-(a.age??-1)||b.market_value-a.market_value||a.id.localeCompare(b.id);
}
export function countryPlayerFromRow(p:any):CountryPlayer{return {id:String(p.id),name:String(p.name||""),position:String(p.position||""),alternatePositions:Array.isArray(p.alternate_positions)?p.alternate_positions:[],rating:Number(p.overall||0),age:p.age==null?null:Number(p.age),market_value:Number(p.estimated_value_eur||0),avatar_url:p.avatar_url||null,nationality:String(p.nationality||"").trim()}}
export function topCountryPlayers(players:CountryPlayer[]){return [...players].sort(countryPlayerSort).slice(0,26)}
