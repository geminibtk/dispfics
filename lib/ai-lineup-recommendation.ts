import {computeAutomaticLineup} from "./lineupAlgorithm";
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


const LABELS:Record<string,string>={KL:"Kaleci",STP:"Stoper",SGB:"Sağ Bek",SLB:"Sol Bek",SGK:"Sağ Kanat",SLK:"Sol Kanat",SGO:"Sağ Orta",SLO:"Sol Orta",MDO:"Defansif Orta Saha",MO:"Merkez Orta Saha",MOO:"Ofansif Orta Saha",SNT:"Santrafor"};
function norm(v:any){return String(v||"").toLocaleUpperCase("tr-TR").replace(/Ğ/g,"G").replace(/İ/g,"I").replace(/Ş/g,"S").replace(/Ü/g,"U").replace(/Ö/g,"O").replace(/Ç/g,"C")}
export function getAiLineupRecommendation(players:any[]){
 if(!players.length)return null;
 const positions=(p:any)=>[p.position,...(p.alternatePositions||[]).map((x:any)=>typeof x==="string"?x:(x?.shortLabel||x?.label))].map(norm).filter(Boolean).filter((v:string,i:number,a:string[])=>a.indexOf(v)===i);
 const referenceIds=new Set(players.slice(0,11).map(p=>String(p.id)));
 const ranked=FORMATIONS.map(([name,roles],index)=>{
 const selected=computeAutomaticLineup(players,roles,index,positions).selected;
 const entries=Object.entries(selected).filter(([,id])=>id).map(([slot,id])=>{const player=players.find(p=>String(p.id)===String(id));const role=norm(slot.split("_")[0]);const at=player?positions(player).indexOf(role):-1;return {id:String(id),role,player,value:at>=0?at+1:0}});
 const placementByPlayer=players.map(p=>entries.find(x=>x.id===String(p.id))?.value??null);
 return {name,roles,index,entries,top11:entries.filter(x=>referenceIds.has(x.id)).length,placementValue:entries.reduce((a,x)=>a+x.value,0),top11PlacementValue:entries.filter(x=>referenceIds.has(x.id)).reduce((a,x)=>a+x.value,0),placementByPlayer};
 }).sort((a,b)=>{const first=b.top11-a.top11||a.placementValue-b.placementValue||a.top11PlacementValue-b.top11PlacementValue;if(first)return first;for(let i=0;i<Math.max(a.placementByPlayer.length,b.placementByPlayer.length);i++){const av=a.placementByPlayer[i],bv=b.placementByPlayer[i];if(av===bv)continue;if(av==null)return 1;if(bv==null)return -1;if(av!==bv)return av-bv}return a.index-b.index});
 const best=ranked[0];const filled=new Set(best.entries.map(x=>x.id));const counts:Record<string,number>={};const missing=best.roles.filter(role=>{counts[role]=(counts[role]||0)+1;return best.entries.filter(x=>x.role===role).length<counts[role]});
 const recommendations:{role:string;label:string;playerName:string|null}[]=missing.map(role=>({role,label:LABELS[role]||role,playerName:null as string|null}));
 if(!recommendations.length)for(const entry of best.entries.filter(x=>!referenceIds.has(x.id)))recommendations.push({role:entry.role,label:LABELS[entry.role]||entry.role,playerName:entry.player?.name||null});
 return {name:best.name,recommendations};
}
