"use client";
import {displayRating} from "../../lib/display-rating";
import {useEffect,useMemo,useRef,useState} from "react";
import {useRouter} from "next/navigation";
import {createClient} from "../../lib/supabase";
import {computeAutomaticLineup} from "../../lib/lineupAlgorithm";
import AppShell from "../components/AppShell";import TeamLogo from "../teams/TeamLogo";

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
const keys=FORMATIONS.map((f,i)=>({key:f[0]+"|"+i,name:f[0],roles:f[1],variant:FORMATIONS.slice(0,i).filter(x=>x[0]===f[0]).length+1}));

export default function Lineup(){
 const s=createClient(),router=useRouter(),[teamContext,setTeamContext]=useState({team:"",league:""}),teamName=teamContext.team,teamLeague=teamContext.league;
 const [contextReady,setContextReady]=useState(false);const [players,setPlayers]=useState<any[]>([]),[lineup,setLineup]=useState<any>(null);
 const [selected,setSelected]=useState<Record<string,string>>({}),[autoReserves,setAutoReserves]=useState<any[]>([]);
 const [activeSlot,setActiveSlot]=useState<string|null>(null),[formationKey,setFormationKey]=useState(""),[otherFormationKey,setOtherFormationKey]=useState(""),[msg,setMsg]=useState("");
 const topInitialized=useRef(false);
 const [guestMode,setGuestMode]=useState(false);
 const GUEST_LINEUP_KEY=teamName?"yanimdafutbol-team-lineup:"+teamLeague+":"+teamName:"yanimdafutbol-guest-lineup";
 type TransferTarget={role:string;playerId:string|null;playerName:string|null};
 type TransferPlan={type:"required"|"upgrade";roles:string[];targets:TransferTarget[];rating:{min:number,max:number}|null;age:{min:number,max:number}|null;value:{min:number,max:number}|null};
 const formation=useMemo(()=>keys.find(x=>x.key===formationKey)||keys.find(x=>x.name==="3-4-2-1")||keys[0],[formationKey]);
 const slots=useMemo(()=>{const count:Record<string,number>={},totals:Record<string,number>={};formation.roles.forEach(r=>totals[r]=(totals[r]||0)+1);const y:Record<string,number>={KL:91,STP:77,SGB:72,SLB:72,SGK:53,SLK:53,MDO:61,MO:48,SGO:42,SLO:42,MOO:32,SNT:12};const sideX:Record<string,number>={SGB:88,SGK:87,SGO:84,SLB:12,SLK:13,SLO:16};return formation.roles.map(role=>{count[role]=(count[role]||0)+1;const n=count[role],total=totals[role];let x=sideX[role]??50;if(sideX[role]==null&&total>1){const spread=total>=3?27:31;x=50+(n-(total+1)/2)*spread}return {slot:role+"_"+n,role,x,y:y[role]||50}})},[formation]);
 // Keep the formation unchanged. Only nudge a few center/defender portraits
 // horizontally on narrow screens when a nearby wide player's portrait covers them.
 const photoSlots=useMemo(()=>{
  const flankRoles=new Set(["SGB","SLB","SGK","SLK","SGO","SLO"]);
  const positioned=slots.map(slot=>({...slot,mobileX:Math.max(16,Math.min(84,slot.x))}));
  for(const flank of positioned.filter(slot=>flankRoles.has(slot.role))){
   for(const inner of positioned.filter(slot=>!flankRoles.has(slot.role))){
    if(Math.abs(flank.y-inner.y)<=8 && Math.abs(flank.mobileX-inner.mobileX)<18){
     inner.mobileX=flank.mobileX+(flank.mobileX<50?18:-18);
    }
   }
  }
  return positioned;
 },[slots]);
 async function loadGuest(){
  setGuestMode(true);
  let query=s.from("scouting_players").select("id,name,position,alternate_positions,overall,age,estimated_value_eur,avatar_url").eq("is_active",true);if(teamName){query=query.eq("club",teamName);if(teamLeague)query=query.eq("league",teamLeague)}const {data,error}=await query.order("overall",{ascending:false}).limit(teamName?1000:200);
  if(error){setMsg("Oyuncular yüklenemedi: "+error.message);return}if(teamName&&!(data||[]).length)setMsg("Bu takım için oyuncu bulunamadı.");
  const squad=(data||[]).map((x:any)=>({id:String(x.id),name:x.name,position:x.position,alternatePositions:Array.isArray(x.alternate_positions)?x.alternate_positions:[],rating:Number(x.overall||0),age:x.age!=null?Number(x.age):null,marketValue:x.estimated_value_eur!=null?Number(x.estimated_value_eur):null,avatar_url:x.avatar_url||null,source:"scouting"}));
  let saved:any=null;try{saved=JSON.parse(localStorage.getItem(GUEST_LINEUP_KEY)||"null")}catch{}if(teamName){const {data:{user}}=await s.auth.getUser();if(user){const {data:cloud,error:cloudError}=await s.from("team_lineup_saves").select("formation_key,other_formation_key,selected").eq("user_id",user.id).eq("team_name",teamName).eq("league",teamLeague).maybeSingle();if(cloudError)setMsg("Bulut kadrosu yüklenemedi: "+cloudError.message);if(cloud)saved={formationKey:cloud.formation_key,otherFormationKey:cloud.other_formation_key,selected:cloud.selected}}}try{if(saved?.formationKey&&saved?.selected&&(!teamName||Object.values(saved.selected).every((id:any)=>!id||(data||[]).some((p:any)=>String(p.id)===String(id))))){const f=keys.find(x=>x.key===saved.formationKey);if(f){topInitialized.current=true;setFormationKey(f.key);setSelected(saved.selected);setOtherFormationKey(saved.otherFormationKey||"");setMsg("Cihazdaki kayıtlı kadro yüklendi.")}}}catch{}
  setPlayers(squad);
 }
 async function load(){
  if(teamName){await loadGuest();return}
  const {data:{user}}=await s.auth.getUser();if(!user){await loadGuest();return}
  const {data:m}=await s.from("club_members").select("club_id").eq("user_id",user.id).order("created_at",{ascending:false}).limit(1).maybeSingle();if(!m){await loadGuest();return}
  const {data:club}=await s.from("clubs").select("name").eq("id",m.club_id).maybeSingle();let squad:any[]=[];
  if(club?.name){const {data:sp}=await s.from("scouting_players").select("id,external_id,name,position,alternate_positions,overall,age,estimated_value_eur,avatar_url,club,league").eq("is_active",true).eq("club",club.name).order("overall",{ascending:false});squad=(sp||[]).map((x:any)=>({id:String(x.id),name:x.name,position:x.position,alternatePositions:Array.isArray(x.alternate_positions)?x.alternate_positions:[],rating:Number(x.overall||0),age:x.age!=null?Number(x.age):null,marketValue:x.estimated_value_eur!=null?Number(x.estimated_value_eur):null,avatar_url:x.avatar_url||null,source:"scouting"}))}
  if(!squad.length){const {data:p}=await s.from("players").select("*").eq("club_id",m.club_id).order("rating",{ascending:false});squad=(p||[]).map((x:any)=>({...x,marketValue:x.market_value!=null?Number(x.market_value):null}))}
  setPlayers(squad);
  let {data:l}=await s.from("lineups").select("*").eq("club_id",m.club_id).eq("is_active",true).limit(1).maybeSingle();
  if(!l){const x=await s.from("lineups").insert({club_id:m.club_id,name:"İlk 11",formation:"3-4-2-1"}).select().single();l=x.data}
  setLineup(l);
 }
 useEffect(()=>{const params=new URLSearchParams(window.location.search);setTeamContext({team:params.get("team")||"",league:params.get("league")||""});setContextReady(true)},[]);
 useEffect(()=>{if(!contextReady)return;topInitialized.current=false;setPlayers([]);setSelected({});setAutoReserves([]);setFormationKey("");setOtherFormationKey("");setLineup(null);setGuestMode(false);setMsg("");load()},[contextReady,teamName,teamLeague]);

 function normPos(v:any){return String(v||"").toLocaleUpperCase("tr-TR").replace(/Ğ/g,"G").replace(/İ/g,"I").replace(/Ş/g,"S").replace(/Ü/g,"U").replace(/Ö/g,"O").replace(/Ç/g,"C")}
 function playerPositions(p:any){const raw=[p.position,...(p.alternatePositions||[]).map((x:any)=>typeof x==="string"?x:(x?.shortLabel||x?.label))];return raw.map(normPos).filter(Boolean).filter((v:string,i:number,a:string[])=>a.indexOf(v)===i)}
 function fits(p:any,slot:string){return playerPositions(p).includes(normPos(slot.split("_")[0]))}
 function lineupMetrics(sel:Record<string,string>){const ids=Object.values(sel).filter(Boolean);const ps=ids.map(id=>players.find(p=>String(p.id)===String(id))).filter(Boolean);const avg=(vals:number[])=>vals.length?vals.reduce((a,b)=>a+b,0)/vals.length:null;return {rating:avg(ps.map(p=>Number(p.rating)).filter(Number.isFinite)),age:avg(ps.map(p=>p.age==null?NaN:Number(p.age)).filter(Number.isFinite)),value:avg(ps.map(p=>p.marketValue==null?NaN:Number(p.marketValue)).filter(Number.isFinite))}}
 const metrics=useMemo(()=>lineupMetrics(selected),[selected,players]);
 const formationStats=useMemo(()=>{if(!players.length)return [];const referenceIds=new Set(players.slice(0,11).map(p=>String(p.id)));return keys.map((f,i)=>{const r=computeAutomaticLineup(players,f.roles,i,playerPositions);const ids=Object.values(r.selected).filter(Boolean).map(String);const m=lineupMetrics(r.selected);const placementEntries=Object.entries(r.selected).map(([slot,id])=>{if(!id)return null;const p=players.find(x=>String(x.id)===String(id));if(!p)return null;const role=normPos(slot.split("_")[0]);const posIndex=playerPositions(p).indexOf(role);return {id:String(id),value:posIndex>=0?posIndex+1:0}}).filter(Boolean) as {id:string,value:number}[];const placementValue=placementEntries.reduce((sum,x)=>sum+x.value,0);const top11PlacementValue=placementEntries.filter(x=>referenceIds.has(x.id)).reduce((sum,x)=>sum+x.value,0);const placementByPlayer=players.map(p=>placementEntries.find(x=>x.id===String(p.id))?.value??null);return {...f,index:i,selected:r.selected,reserves:r.reserves,top11:ids.filter(id=>referenceIds.has(id)).length,placementValue,top11PlacementValue,placementByPlayer,...m}}).sort((a,b)=>{const first=b.top11-a.top11||a.placementValue-b.placementValue||a.top11PlacementValue-b.top11PlacementValue;if(first)return first;for(let i=0;i<Math.max(a.placementByPlayer.length,b.placementByPlayer.length);i++){const av=a.placementByPlayer[i],bv=b.placementByPlayer[i];if(av===bv)continue;if(av==null)return 1;if(bv==null)return -1;if(av!==bv)return av-bv}return a.index-b.index})},[players]);
 const topFormation=formationStats[0]||null;
 const aiFormation=topFormation&&Object.values(topFormation.selected).filter(Boolean).length===11?topFormation:null;
 useEffect(()=>{if(!players.length||!topFormation||topInitialized.current)return;topInitialized.current=true;setFormationKey(topFormation.key);setSelected(topFormation.selected);setAutoReserves(topFormation.reserves);setOtherFormationKey("")},[players,topFormation?.key]);
 function formatMarketValue(v:number|null){if(v==null)return "—";return v>=1000000?`€${(v/1000000).toLocaleString("tr-TR",{maximumFractionDigits:0})}M`:`€${Math.round(v/1000).toLocaleString("tr-TR")}K`}
 function transferPlan():TransferPlan|null{const referenceIds=new Set(players.slice(0,11).map(p=>String(p.id)));const placedEntries=Object.entries(selected).filter(([,id])=>id).map(([slot,id])=>({slot,id:String(id),player:players.find(p=>String(p.id)===String(id))})).filter(x=>x.player);const missingTargets=slots.filter(x=>!selected[x.slot]).map(x=>({role:x.role,playerId:null,playerName:null}));const upgradeTargets=placedEntries.filter(x=>!referenceIds.has(x.id)).map(x=>({role:normPos(x.slot.split("_")[0]),playerId:x.id,playerName:x.player?.name||null}));const referencePlaced=placedEntries.filter(x=>referenceIds.has(x.id)).map(x=>x.player);const nums=(ps:any[],k:string):number[]=>ps.map((p:any)=>Number(p[k])).filter((n:number)=>Number.isFinite(n));const range=(ps:any[],k:string)=>{const a=nums(ps,k);return a.length?{min:Math.min(...a),max:Math.max(...a)}:null};if(missingTargets.length)return {type:"required",roles:Array.from(new Set(missingTargets.map(x=>x.role))),targets:missingTargets,rating:range(referencePlaced,"rating"),age:range(referencePlaced,"age"),value:range(referencePlaced,"marketValue")};if(upgradeTargets.length)return {type:"upgrade",roles:Array.from(new Set(upgradeTargets.map(x=>x.role))),targets:upgradeTargets,rating:range(referencePlaced,"rating"),age:range(referencePlaced,"age"),value:range(referencePlaced,"marketValue")};return null}
 function openTransferOffer(targetIndex?:number){const plan=transferPlan();if(!plan)return;const targets=targetIndex==null?plan.targets:[plan.targets[targetIndex]].filter(Boolean);const request={...plan,targets,roles:Array.from(new Set(targets.map(t=>t.role)))};sessionStorage.setItem("dispficsTransferRequest",JSON.stringify({formation:formation.name,...request,createdAt:Date.now()}));localStorage.removeItem("dispficsTransferRequest");router.push("/ai"+(teamName?"?team="+encodeURIComponent(teamName)+"&league="+encodeURIComponent(teamLeague):""))}
 function changeFormation(key:string){setFormationKey(key);setOtherFormationKey(key===topFormation?.key?"":key);const fi=keys.findIndex(x=>x.key===key),f=keys[fi]||keys[0];const r=computeAutomaticLineup(players,f.roles,fi,playerPositions);setSelected(r.selected);setAutoReserves(r.reserves);setMsg("Diziliş için en iyi 11 otomatik hesaplandı.")}

 async function save(){
  const vals=Object.entries(selected).filter(([,v])=>v);
  if(new Set(vals.map(x=>x[1])).size!==vals.length)return setMsg("Aynı oyuncu iki pozisyonda olamaz.");
  if(guestMode||!lineup){try{localStorage.setItem(GUEST_LINEUP_KEY,JSON.stringify({formationKey:formation.key,otherFormationKey,selected}));setMsg("Kadro bu cihazda kaydedildi.")}catch{setMsg("Tarayıcıda kayıt yapılamadı.")}if(teamName){const {data:{user}}=await s.auth.getUser();if(user){const {error}=await s.from("team_lineup_saves").upsert({user_id:user.id,team_name:teamName,league:teamLeague,formation_key:formation.key,other_formation_key:otherFormationKey,selected,updated_at:new Date().toISOString()},{onConflict:"user_id,team_name,league"});setMsg(error?"Bulut kaydı başarısız: "+error.message:"Kadro hesabınıza kaydedildi; diğer cihazlarda da açabilirsiniz.")}}return}
  const {error:le}=await s.from("lineups").update({formation:formation.name}).eq("id",lineup.id);if(le)return setMsg(le.message);
  await s.from("lineup_players").delete().eq("lineup_id",lineup.id);
  if(vals.length){const rows=vals.map(([slot,id])=>{const p=players.find(x=>String(x.id)===String(id));return p?.source==="scouting"?{lineup_id:lineup.id,slot,player_id:null,scouting_player_id:id}:{lineup_id:lineup.id,slot,player_id:id,scouting_player_id:null}});const {error}=await s.from("lineup_players").insert(rows);if(error)return setMsg(error.message)}
  setMsg("İlk 11 ve diziliş kaydedildi.");
 }

 return <AppShell title={teamName?teamName+" • Aktif Kadro":"Aktif Kadro"} hideTitle><div className="lineupPage" style={{maxWidth:1050}}>{teamName&&<div className="lineupBack" style={{marginBottom:14}}><button type="button" className="playerBack" onClick={()=>router.push("/teams")}>← Takımlar</button></div>}
  
  
  <small style={{color:"#49ad60"}}>İLK 11 • {formation.name}</small>
  <p style={{color:"#aab7af"}}>Dizilişi seçtiğiniz anda YanımdaFutbol en iyi 11'i otomatik hesaplar.</p>
  {topFormation&&<div style={{...topFormationButton,cursor:"default"}}><span><b>{formation.name}{keys.filter(x=>x.name===formation.name).length>1?` • Varyasyon ${formation.variant}`:""}</b></span>{formationKey===topFormation.key&&<strong style={{color:"#9bcba7"}}>{"AI ÖNERİSİ"}</strong>}</div>}
  {topFormation&&formationKey!==topFormation.key&&<button type="button" onClick={()=>changeFormation(topFormation.key)} style={{...input,cursor:"pointer",marginBottom:10}}>AI Önerisine Dön ↩</button>}
  <label style={{display:"block",maxWidth:360,margin:"10px 0"}}>Diğer Dizilişler
   <select value={otherFormationKey} onChange={e=>{if(e.target.value)changeFormation(e.target.value)}} style={input}><option value="" disabled>Diziliş seçin</option>{formationStats.slice(1).map(x=><option key={x.key} value={x.key}>{x.name}{keys.filter(y=>y.name===x.name).length>1?" • Varyasyon "+x.variant:""}</option>)}</select>
  </label>
  <div className="lineupMetrics" style={{display:"flex",gap:10,flexWrap:"wrap",margin:"10px 0 14px"}}><span style={metricCard}><small style={metricLabel}>ORT. REYTİNG</small><b>{metrics.rating!=null?displayRating(metrics.rating):"—"}</b></span><span style={metricCard}><small style={metricLabel}>ORT. YAŞ</small><b>{metrics.age!=null?metrics.age.toFixed(0):"—"}</b></span><span style={metricCard}><small style={metricLabel}>ORT. DEĞER</small><b>{formatMarketValue(metrics.value)}</b></span></div>
  {(()=>{const plan=transferPlan();if(!plan)return null;const required=plan.type==="required";const sorted=plan.targets.map((t,i)=>({t,i,p:players.find(x=>String(x.id)===String(t.playerId))})).sort((a,b)=>Number(b.p?.rating||0)-Number(a.p?.rating||0)||(b.p?playerPositions(b.p).length:0)-(a.p?playerPositions(a.p).length:0)||(a.p?playerPositions(a.p)[0]||"":"").localeCompare(b.p?playerPositions(b.p)[0]||"":"", "tr")||Number(b.p?.age||0)-Number(a.p?.age||0)||Number(b.p?.marketValue||0)-Number(a.p?.marketValue||0));return <section className="clubSquadPanel lineupTransferPanel" style={{margin:"10px 0 14px"}}><div className="clubSquadHead"><div><small>TRANSFER ÖNERİSİ</small></div><button className="clubAction" onClick={()=>openTransferOffer()}>{required?"Transfer adayı bul →":"Alternatif oyuncuları göster →"}</button></div><div className="clubSquadLabels"><span>OYUNCU</span><span>YF REYTİNG</span><span>POZİSYON</span><span>YAŞ</span><span>DEĞER</span><span></span></div><div className="clubSquadList">{sorted.map(({t,i,p})=><div key={i} className="clubSquadRow" role={p?"link":undefined} tabIndex={p?0:undefined} onClick={()=>p&&router.push(`/scouting/${p.id}`)} onKeyDown={e=>{if(e.key==="Enter"&&p)router.push(`/scouting/${p.id}`)}}><span className="clubSquadPlayer">{p?.avatar_url?<img src={p.avatar_url} alt=""/>:<i>{initials(t.playerName||LABELS[t.role]||t.role)}</i>}<b>{t.playerName||"Transfer gerekli"}</b></span><strong>{p?displayRating(p.rating):"—"}</strong><span>{p?.position||t.role}</span><span>{p?.age??"—"}</span><span>{p?formatMarketValue(p.marketValue):"—"}</span><button type="button" className="lineupAlternativesAction" onClick={e=>{e.stopPropagation();openTransferOffer(i)}}>Alternatifler →</button></div>)}</div></section>})()}
  <div className="lineupPitch" style={pitch}>{photoSlots.map(({slot,role,x,y,mobileX})=>{const p=players.find(v=>String(v.id)===String(selected[slot]));return <button key={slot} className="lineupSpot" onClick={()=>p&&router.push(`/scouting/${p.id}`)} style={{...spot,left:x+"%",top:y+"%",["--lineup-x" as string]:x+"%",["--lineup-photo-x" as string]:mobileX+"%"}}><span className="lineupPlayerAvatar" style={playerAvatar}><PitchPhoto key={String(p?.id||slot)+":"+(p?.avatar_url||"")} url={p?.avatar_url} name={p?.name||""}/></span><span className="lineupPlayerCard" style={playerCard}><b className="lineupPlayerName" style={playerName}>{p?p.name:"Boş Pozisyon"}</b><span className="lineupPlayerStats" style={playerStats}><strong title="YF Reyting" style={ratingBadge}>{p?displayRating(p.rating):"—"}</strong><small className="lineupPlayerInfo" title="Pozisyon" style={playerInfo}>{role}</small></span></span></button>})}<div style={half}/><div style={circle}/><div style={boxTop}/><div style={boxBottom}/></div>
  {autoReserves.length>0&&<div style={{display:"grid",gap:16,marginTop:12}}>
   <section className="clubSquadPanel lineupReservePanel" style={{padding:18}}>
    <div className="clubSquadHead"><div><small>YEDEKLER</small></div><span>{Math.min(7,autoReserves.length)} oyuncu</span></div>
    {[{title:"",items:autoReserves.slice(0,5),offset:0,bold:true},{title:"",items:autoReserves.slice(5,7),offset:5,bold:false}].filter(group=>group.items.length>0).map(group=><div key={group.offset} className="lineupReserveGroup" style={{border:"1px solid #294032",borderRadius:12,padding:14,background:"#101c15",marginTop:14}}>
     
     <div className="clubSquadLabels"><span>OYUNCU</span><span>YF REYTİNG</span><span>POZİSYON</span><span>YAŞ</span><span>DEĞER</span><span></span></div>
     <div className="clubSquadList">{group.items.map((p:any,i:number)=><button key={p.id} onClick={()=>router.push(`/scouting/${p.id}`)} className="clubSquadRow" style={group.bold?{fontWeight:800}:undefined}><span className="clubSquadPlayer">{p.avatar_url?<img src={p.avatar_url} alt=""/>:<i>{initials(p.name)}</i>}<b style={{fontWeight:group.bold?900:500}}>{p.name}</b></span><strong>{displayRating(p.rating)}</strong><span>{p.position||"—"}</span><span>{p.age??"—"}</span><span>{formatMarketValue(p.marketValue)}</span><em>Detay →</em></button>)}</div>
    </div>)}
   </section>
   {autoReserves.length>7&&<section className="clubSquadPanel lineupReservePanel" style={{padding:18}}>
    <div className="clubSquadHead"><div><small>REZERV TAKIM</small></div><span>{autoReserves.length-7} oyuncu</span></div>
    <div className="clubSquadLabels"><span>OYUNCU</span><span>YF REYTİNG</span><span>POZİSYON</span><span>YAŞ</span><span>DEĞER</span><span></span></div>
    <div className="clubSquadList">{autoReserves.slice(7).map((p:any,i:number)=><button key={p.id} onClick={()=>router.push(`/scouting/${p.id}`)} className="clubSquadRow"><span className="clubSquadPlayer">{p.avatar_url?<img src={p.avatar_url} alt=""/>:<i>{initials(p.name)}</i>}<b style={{fontWeight:500}}>{p.name}</b></span><strong>{displayRating(p.rating)}</strong><span>{p.position||"—"}</span><span>{p.age??"—"}</span><span>{formatMarketValue(p.marketValue)}</span><em>Detay →</em></button>)}</div>
   </section>}
  </div>}
  <span style={{color:"#9bcba7"}}>{msg}</span>
 </div></AppShell>
}
const input={display:"block",width:"100%",marginTop:9,padding:11,background:"#080d0b",color:"white",border:"1px solid #294032",borderRadius:8};
const pitch:any={position:"relative",width:"100%",maxWidth:820,height:"min(72dvh,760px)",minHeight:560,margin:"18px auto",border:"1px solid #5b9b68",borderRadius:20,overflow:"hidden",boxShadow:"inset 0 0 60px rgba(0,0,0,.28)",background:"repeating-linear-gradient(0deg,#195f31 0,#195f31 10%,#1e6937 10%,#1e6937 20%)"};
const spot:any={position:"absolute",zIndex:5,transform:"translate(-50%,-50%)",width:150,border:0,background:"transparent",color:"#102116",cursor:"pointer",textAlign:"center",padding:0};
const playerAvatar:any={display:"grid",placeItems:"center",margin:"0 auto -9px",width:58,height:58,borderRadius:"50%",overflow:"hidden",background:"#e9f3eb",border:"3px solid #f4fff5",boxShadow:"0 5px 16px rgba(0,0,0,.28)"};
const avatarImg:any={display:"block",width:"100%",height:"100%",objectFit:"cover",objectPosition:"center"};
const avatarFallback:any={display:"grid",placeItems:"center",width:"100%",height:"100%",fontStyle:"normal",fontSize:15,fontWeight:900,color:"#176c37",background:"#eef7f0"};
const playerCard:any={display:"grid",gap:3,padding:"11px 9px 8px",borderRadius:12,background:"rgba(246,250,247,.96)",border:"1px solid rgba(255,255,255,.85)",boxShadow:"0 6px 18px rgba(0,0,0,.24)",backdropFilter:"blur(5px)"};
const playerName:any={fontSize:12,lineHeight:1.15,color:"#102116",whiteSpace:"nowrap",overflow:"hidden",textOverflow:"ellipsis"};
const playerInfo:any={fontSize:10,color:"#587061",fontWeight:700};
const playerStats:any={display:"grid",gridTemplateColumns:"auto auto",alignItems:"center",justifyContent:"center",gap:7,marginTop:2,whiteSpace:"nowrap"};
const ratingBadge:any={display:"inline-grid",placeItems:"center",minWidth:28,height:22,padding:"0 5px",borderRadius:6,background:"#176c37",color:"#fff",fontSize:12};
const half:any={position:"absolute",left:0,right:0,top:"50%",borderTop:"2px solid #b9dfc0"};
const circle:any={position:"absolute",left:"50%",top:"50%",width:110,height:110,border:"2px solid #b9dfc0",borderRadius:"50%",transform:"translate(-50%,-50%)"};
const boxTop:any={position:"absolute",left:"27%",top:-2,width:"46%",height:"15%",border:"2px solid #b9dfc0"};
const boxBottom:any={position:"absolute",left:"27%",bottom:-2,width:"46%",height:"15%",border:"2px solid #b9dfc0"};
const modal:any={position:"fixed",inset:0,zIndex:50,display:"grid",placeItems:"center",padding:16,background:"rgba(0,0,0,.72)"};
const sheet:any={width:"min(520px,100%)",maxHeight:"80vh",overflow:"auto",padding:18,border:"1px solid #294032",borderRadius:16,background:"#0e1512",color:"white"};
const close:any={fontSize:28,border:0,background:"transparent",color:"white",cursor:"pointer"};
const playerBtn:any={width:"100%",display:"flex",justifyContent:"space-between",alignItems:"center",marginTop:8,padding:12,border:"1px solid #203027",borderRadius:10,background:"#080d0b",color:"white",textAlign:"left",cursor:"pointer"};

const playerCardMeta:any={};
const metricCard:any={minWidth:140,padding:"10px 14px",background:"#0e1512",border:"1px solid #294032",borderRadius:10,display:"grid",gap:4};
const metricLabel:any={color:"#718078",fontSize:10};


const transferNotice:any={display:"grid",gap:7,padding:14,margin:"10px 0 14px",background:"#17150d",border:"1px solid #5b4a24",borderRadius:10,color:"#e7d6a8"};
const offerBtn:any={justifySelf:"start",padding:"9px 13px",background:"#2e9d4b",color:"white",border:0,borderRadius:8,fontWeight:700,cursor:"pointer"};

const topFormationButton:any={width:"100%",maxWidth:520,display:"flex",justifyContent:"space-between",alignItems:"center",gap:16,padding:"14px 16px",margin:"12px 0",background:"#132019",color:"white",border:"1px solid #49ad60",borderRadius:10,textAlign:"left",cursor:"pointer"};

// A failed/absent image never leaves an invisible or broken portrait.
function PitchPhoto({url,name}:{url?:string|null;name:string}){
 const [failed,setFailed]=useState(false);
 if(!url||failed)return <i style={avatarFallback}>{name?initials(name):"+"}</i>;
 return <img src={url} alt={name?name+" fotoğrafı":""} loading="eager" decoding="async" onError={()=>setFailed(true)} style={avatarImg}/>;
}
function initials(n:string){return n.split(" ").slice(0,2).map(x=>x[0]).join("").toUpperCase()}
