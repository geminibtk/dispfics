"use client";
import {useMemo} from "react";
import {computeAutomaticLineup} from "../../../lib/lineupAlgorithm";
import {displayRating} from "../../../lib/display-rating";
import {matchLineupRoles} from "../../../lib/match-lineup-roles";
const FORMATIONS=[
["3-1-4-2",["KL","MDO","MO","MO","SGO","SLO","SNT","SNT","STP","STP","STP"]],
["3-4-1-2",["KL","MO","MO","MOO","SGO","SLO","SNT","SNT","STP","STP","STP"]],
["3-4-2-1",["KL","MO","MO","MOO","MOO","SGO","SLO","SNT","STP","STP","STP"]],
["3-4-3",["KL","MO","MO","SGK","SGO","SLK","SLO","SNT","STP","STP","STP"]],
["3-5-2",["KL","MDO","MDO","MOO","SGO","SLO","SNT","SNT","STP","STP","STP"]],
["4-1-2-1-2",["KL","MDO","MO","MO","MOO","SGB","SLB","SNT","SNT","STP","STP"]],
["4-1-2-1-2",["KL","MDO","MOO","SGB","SGO","SLB","SLO","SNT","SNT","STP","STP"]],
["4-1-3-2",["KL","MDO","MO","SGB","SGO","SLB","SLO","SNT","SNT","STP","STP"]],
["4-1-4-1",["KL","MDO","MO","MO","SGB","SGO","SLB","SLO","SNT","STP","STP"]],
["4-2-1-3",["KL","MDO","MDO","MOO","SGB","SGK","SLB","SLK","SNT","STP","STP"]],
["4-2-2-2",["KL","MDO","MDO","MOO","MOO","SGB","SLB","SNT","SNT","STP","STP"]],
["4-2-3-1",["KL","MDO","MDO","MOO","MOO","MOO","SGB","SLB","SNT","STP","STP"]],
["4-2-3-1",["KL","MDO","MDO","MOO","SGB","SGO","SLB","SLO","SNT","STP","STP"]],
["4-2-4",["KL","MO","MO","SGB","SGK","SLB","SLK","SNT","SNT","STP","STP"]],
["4-3-1-2",["KL","MO","MO","MO","MOO","SGB","SLB","SNT","SNT","STP","STP"]],
["4-3-2-1",["KL","MO","MO","MO","MOO","MOO","SGB","SLB","SNT","STP","STP"]],
["4-3-3",["KL","MDO","MDO","MO","SGB","SGK","SLB","SLK","SNT","STP","STP"]],
["4-3-3",["KL","MDO","MO","MO","SGB","SGK","SLB","SLK","SNT","STP","STP"]],
["4-3-3",["KL","MO","MO","MO","SGB","SGK","SLB","SLK","SNT","STP","STP"]],
["4-3-3",["KL","MO","MO","MOO","SGB","SGK","SLB","SLK","SNT","STP","STP"]],
["4-4-1-1",["KL","MO","MO","MOO","SGB","SGO","SLB","SLO","SNT","STP","STP"]],
["4-4-2",["KL","MDO","MDO","SGB","SGO","SLB","SLO","SNT","SNT","STP","STP"]],
["4-4-2",["KL","MO","MO","SGB","SGO","SLB","SLO","SNT","SNT","STP","STP"]],
["4-5-1",["KL","MO","MO","MO","SGB","SGO","SLB","SLO","SNT","STP","STP"]],
["4-5-1",["KL","MO","MOO","MOO","SGB","SGO","SLB","SLO","SNT","STP","STP"]],
["5-2-1-2",["KL","MO","MO","MOO","SGB","SLB","SNT","SNT","STP","STP","STP"]],
["5-2-3",["KL","MO","MO","SGB","SGK","SLB","SLK","SNT","STP","STP","STP"]],
["5-3-2",["KL","MDO","MO","MO","SGB","SLB","SNT","SNT","STP","STP","STP"]],
["5-4-1",["KL","MO","MO","SGB","SGO","SLB","SLO","SNT","STP","STP","STP"]]
] as const;
type P={id:string;name:string;club:string;position:string|null;alternate_positions:unknown;overall:number|null;avatar_url?:string|null;age?:number|null;estimated_value_eur?:number|null};
function positions(p:P):string[]{const a=[p.position,...(Array.isArray(p.alternate_positions)?p.alternate_positions.map((x:any)=>typeof x==="string"?x:x?.shortLabel||x?.label):[])];return Array.from(new Set(a.map(x=>String(x||"").trim().toLocaleUpperCase("tr-TR").replace(/Ğ/g,"G").replace(/İ/g,"I").replace(/Ş/g,"S").replace(/Ü/g,"U").replace(/Ö/g,"O").replace(/Ç/g,"C")).filter(Boolean)))}
function rank(a:P,b:P){return Number(b.overall??-1)-Number(a.overall??-1)||positions(b).length-positions(a).length||(positions(a)[0]||"").localeCompare(positions(b)[0]||"","tr")||Number(b.age??-1)-Number(a.age??-1)||Number(b.estimated_value_eur??-1)-Number(a.estimated_value_eur??-1)||a.name.localeCompare(b.name,"tr")}
function bestLineup(players:P[],preferNatural=false){
 const sorted=[...players].sort(rank).map(p=>({...p,rating:p.overall}));
 const referenceIds=new Set(sorted.slice(0,11).map(p=>String(p.id)));
 const byId=new Map(sorted.map(p=>[String(p.id),p]));
 const options=FORMATIONS.map(([name,roles],index)=>{
  const result=computeAutomaticLineup(sorted,roles,index,positions);
  const entries=Object.entries(result.selected).map(([slot,id])=>{
   const player=byId.get(String(id));
   if(!player)return null;
   const role=slot.split("_")[0];
   const indexInPositions=positions(player).indexOf(role);
   return {role,player,placement:indexInPositions<0?0:indexInPositions+1};
  }).filter((x):x is {role:string;player:P&{rating:number|null};placement:number}=>x!==null);
  const starters=entries.map(({role,player})=>({role,player}));
  const placement=entries.reduce((sum,x)=>sum+x.placement,0);
  const primaryCount=entries.filter(x=>x.placement===1).length;
  const top11Placement=entries.filter(x=>referenceIds.has(String(x.player.id))).reduce((sum,x)=>sum+x.placement,0);
  const placementByPlayer=sorted.map(p=>entries.find(x=>String(x.player.id)===String(p.id))?.placement??null);
  return {name,starters,score:entries.filter(x=>referenceIds.has(String(x.player.id))).length,primaryCount,placement,top11Placement,placementByPlayer,index};
 });
 // Keep formation selection identical to the AI formation on the Active Squad page.
 options.sort((a,b)=>{
  const first=(preferNatural?b.primaryCount-a.primaryCount||b.score-a.score:b.score-a.score||b.primaryCount-a.primaryCount)||a.placement-b.placement||a.top11Placement-b.top11Placement;
  if(first)return first;
  for(let i=0;i<a.placementByPlayer.length;i++){
   const av=a.placementByPlayer[i],bv=b.placementByPlayer[i];
   if(av===bv)continue;
   if(av==null)return 1;
   if(bv==null)return -1;
   return av-bv;
  }
  return a.index-b.index;
 });
 return options[0];
}
function initials(name:string){return name.trim().split(/\s+/).slice(0,2).map(part=>part[0]||"").join("").toLocaleUpperCase("tr-TR")}
function playerCard(player:P,role:string,teamName:string){return <div className="matchupPlayerCard"><span className="matchupPlayerIdentity">{player.avatar_url?<img src={player.avatar_url} alt="" loading="lazy"/>:<i>{initials(player.name)}</i>}<span className="matchupPlayerMeta"><small className="matchupTeamLabel">{teamName}</small><b>{player.name}</b><small className="matchupPlayerRole">{role}{player.age!=null?" • "+player.age+" yaş":""}</small></span></span><strong className="matchupPlayerRating">{player.overall==null?"—":displayRating(player.overall)}</strong></div>}
export default function PlayerMatchup({team,opponent,players}:{team:string;opponent:string;players:P[]}){const own=useMemo(()=>bestLineup(players.filter(p=>p.club===team)),[players,team]);const other=useMemo(()=>bestLineup(players.filter(p=>p.club===opponent),true),[players,opponent]);const rows=matchLineupRoles(own,other,rank);return <section className="module" style={{display:"grid",gap:14}}><h2>Oyuncu Düellosu</h2>{rows.length?rows.map((x,i)=><div key={x.role+i} className="matchupDuel"><div className="matchupDuelPlayers">{playerCard(x.a,x.role,team)}<strong className="matchupVersus">VS</strong>{playerCard(x.b,x.role,opponent)}</div></div>):<p>Karşılaştırılacak oyuncu bulunamadı.</p>}</section>}
