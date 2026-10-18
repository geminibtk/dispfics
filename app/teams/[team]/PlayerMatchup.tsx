"use client";
import {useMemo} from "react";
import {computeAutomaticLineup} from "../../../lib/lineupAlgorithm";
import {displayRating} from "../../../lib/display-rating";
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
type P={id:string;name:string;club:string;position:string|null;alternate_positions:unknown;overall:number|null};
function positions(p:P):string[]{const a=[p.position,...(Array.isArray(p.alternate_positions)?p.alternate_positions.map((x:any)=>typeof x==="string"?x:x?.shortLabel||x?.label):[])];return Array.from(new Set(a.map(x=>String(x||"").trim().toLocaleUpperCase("tr-TR").replace(/Ğ/g,"G").replace(/İ/g,"I").replace(/Ş/g,"S").replace(/Ü/g,"U").replace(/Ö/g,"O").replace(/Ç/g,"C")).filter(Boolean)))}
function rank(a:P,b:P){return Number(b.overall??-1)-Number(a.overall??-1)||positions(b).length-positions(a).length||(positions(a)[0]||"").localeCompare(positions(b)[0]||"","tr")||a.name.localeCompare(b.name,"tr")}
function bestLineup(players:P[]){const sorted=[...players].sort(rank).map(p=>({...p,rating:p.overall}));const options=FORMATIONS.map(([name,roles],index)=>{const result=computeAutomaticLineup(sorted,roles,index,positions);const byId=new Map(sorted.map(p=>[p.id,p]));const starters=Object.entries(result.selected).map(([slot,id])=>({role:slot.split("_")[0],player:byId.get(id)})).filter((x):x is {role:string;player:P&{rating:number|null}}=>!!x.player);const top=new Set(sorted.slice(0,11).map(p=>p.id));const score=starters.filter(x=>top.has(x.player.id)).length;const placement=starters.reduce((s,x)=>s+Math.max(0,positions(x.player).indexOf(x.role))+1,0);return {name,starters,score,placement,index}});options.sort((a,b)=>b.score-a.score||a.placement-b.placement||b.starters.length-a.starters.length||a.index-b.index);return options[0]}
export default function PlayerMatchup({team,opponent,players}:{team:string;opponent:string;players:P[]}){const own=useMemo(()=>bestLineup(players.filter(p=>p.club===team)),[players,team]);const other=useMemo(()=>bestLineup(players.filter(p=>p.club===opponent)),[players,opponent]);const roles=Array.from(new Set(own.starters.map(x=>x.role).filter(role=>other.starters.some(y=>y.role===role)))).sort((a,b)=>a.localeCompare(b,"tr"));const rows=roles.flatMap(role=>{const left=own.starters.filter(x=>x.role===role).map(x=>x.player).sort(rank);const right=other.starters.filter(x=>x.role===role).map(x=>x.player).sort(rank);return Array.from({length:Math.min(left.length,right.length)},(_,i)=>({role,a:left[i],b:right[i]}))});return <section className="module" style={{display:"grid",gap:14}}><div><h2>AI Dizilişi · Oyuncu Düellosu</h2><p>Yalnızca iki takımın AI dizilişinde ortak bulunan pozisyonlar eşleştirilir. Bir pozisyonda oyuncu sayıları farklıysa daha az olan sayı kadar, en güçlü oyunculardan başlayarak karşılaştırılır.</p><p style={{color:"#9bcba7"}}>{team}: {own.name} · {opponent}: {other.name}</p></div>{rows.length?rows.map((x,i)=>{const ar=Number(x.a.overall??-1),br=Number(x.b.overall??-1);return <div key={x.role+i} style={{border:"1px solid #294032",borderRadius:12,padding:14}}><h4 style={{textAlign:"center",margin:"0 0 12px"}}>{x.role}</h4><div style={{display:"grid",gridTemplateColumns:"1fr auto 1fr",gap:10,alignItems:"center",textAlign:"center"}}><div><strong>{x.a.name}</strong><div style={{color:ar>br?"#49ad60":"#9bcba7"}}>{x.a.overall==null?"—":displayRating(x.a.overall)}</div></div><b>VS</b><div><strong>{x.b.name}</strong><div style={{color:br>ar?"#49ad60":"#9bcba7"}}>{x.b.overall==null?"—":displayRating(x.b.overall)}</div></div></div></div>}):<p>İki AI dizilişinde ortak pozisyonda oyuncu bulunamadı.</p>}<p style={{fontSize:13,color:"#9eb1a4"}}>Seçim önceliği: yüksek reyting, eşitse oynayabildiği pozisyon sayısı, o da eşitse ilk pozisyonun alfabetik sırası. Yalnızca mevcut kadro verileri kullanılır.</p></section>}
