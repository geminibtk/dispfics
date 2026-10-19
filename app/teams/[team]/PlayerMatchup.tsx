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
function rank(a:P,b:P){return Number(b.overall??-1)-Number(a.overall??-1)||positions(b).length-positions(a).length||(positions(a)[0]||"").localeCompare(positions(b)[0]||"","tr")||a.name.localeCompare(b.name,"tr")}
function bestLineup(players:P[]){const sorted=[...players].sort(rank).map(p=>({...p,rating:p.overall}));const options=FORMATIONS.map(([name,roles],index)=>{const result=computeAutomaticLineup(sorted,roles,index,positions);const byId=new Map(sorted.map(p=>[p.id,p]));const starters=Object.entries(result.selected).map(([slot,id])=>({role:slot.split("_")[0],player:byId.get(id)})).filter((x):x is {role:string;player:P&{rating:number|null}}=>!!x.player);const top=new Set(sorted.slice(0,11).map(p=>p.id));const score=starters.filter(x=>top.has(x.player.id)).length;const placement=starters.reduce((s,x)=>s+Math.max(0,positions(x.player).indexOf(x.role))+1,0);return {name,starters,score,placement,index}});options.sort((a,b)=>b.score-a.score||a.placement-b.placement||b.starters.length-a.starters.length||a.index-b.index);return options[0]}
function initials(name:string){return name.trim().split(/\s+/).slice(0,2).map(part=>part[0]||"").join("").toLocaleUpperCase("tr-TR")}
function playerCard(player:P,role:string,teamName:string){return <div className="matchupPlayerCard"><span className="matchupPlayerIdentity">{player.avatar_url?<img src={player.avatar_url} alt="" loading="lazy"/>:<i>{initials(player.name)}</i>}<span className="matchupPlayerMeta"><small className="matchupTeamLabel">{teamName}</small><b>{player.name}</b><small className="matchupPlayerRole">{role}{player.age!=null?" • "+player.age+" yaş":""}</small></span></span><strong className="matchupPlayerRating">{player.overall==null?"—":displayRating(player.overall)}</strong></div>}
export default function PlayerMatchup({team,opponent,players}:{team:string;opponent:string;players:P[]}){const own=useMemo(()=>bestLineup(players.filter(p=>p.club===team)),[players,team]);const other=useMemo(()=>bestLineup(players.filter(p=>p.club===opponent)),[players,opponent]);const rows=matchLineupRoles(own,other,rank).sort((a,b)=>rank(a.a,b.a)||rank(a.b,b.b)||a.role.localeCompare(b.role,"tr"));return <section className="module" style={{display:"grid",gap:14}}><h2>Oyuncu Düellosu</h2>{rows.length?rows.map((x,i)=><div key={x.role+i} className="matchupDuel"><div className="matchupDuelPlayers">{playerCard(x.a,x.role,team)}<strong className="matchupVersus">VS</strong>{playerCard(x.b,x.role,opponent)}</div></div>):<p>Karşılaştırılacak oyuncu bulunamadı.</p>}</section>}
