"use client";
import {useEffect,useMemo,useRef,useState} from "react";
import {useRouter} from "next/navigation";
import {createClient} from "../../lib/supabase";
import {computeAutomaticLineup} from "../../lib/lineupAlgorithm";
import AppShell from "../components/AppShell";

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
 const s=createClient(),router=useRouter();
 const [players,setPlayers]=useState<any[]>([]),[lineup,setLineup]=useState<any>(null);
 const [selected,setSelected]=useState<Record<string,string>>({}),[autoReserves,setAutoReserves]=useState<any[]>([]);
 const [activeSlot,setActiveSlot]=useState<string|null>(null),[formationKey,setFormationKey]=useState(""),[otherFormationKey,setOtherFormationKey]=useState(""),[msg,setMsg]=useState("");
 const topInitialized=useRef(false);
 type TransferTarget={role:string;playerId:string|null;playerName:string|null};
 type TransferPlan={type:"required"|"upgrade";roles:string[];targets:TransferTarget[];genderId:number|null;rating:{min:number,max:number}|null;age:{min:number,max:number}|null;value:{min:number,max:number}|null};
 const formation=useMemo(()=>keys.find(x=>x.key===formationKey)||keys.find(x=>x.name==="3-4-2-1")||keys[0],[formationKey]);
 const slots=useMemo(()=>{const count:Record<string,number>={},totals:Record<string,number>={};formation.roles.forEach(r=>totals[r]=(totals[r]||0)+1);const y:Record<string,number>={KL:91,STP:76,SGB:70,SLB:70,SGK:60,SLK:60,MDO:57,MO:47,SGO:39,SLO:39,MOO:31,SNT:13};return formation.roles.map(role=>{count[role]=(count[role]||0)+1;const n=count[role],total=totals[role];let x=50;if(role==="SGB"||role==="SGK"||role==="SGO")x=84;else if(role==="SLB"||role==="SLK"||role==="SLO")x=16;else if(total>1)x=50+(n-(total+1)/2)*(total>=3?22:28);return {slot:role+"_"+n,role,x,y:y[role]||50}})},[formation]);

 async function load(){
  const {data:{user}}=await s.auth.getUser();if(!user)return router.push("/login");
  const {data:m}=await s.from("club_members").select("club_id").eq("user_id",user.id).order("created_at",{ascending:false}).limit(1).maybeSingle();if(!m)return router.push("/onboarding");
  const {data:club}=await s.from("clubs").select("name").eq("id",m.club_id).maybeSingle();let squad:any[]=[];
  if(club?.name){const {data:sp}=await s.from("scouting_players").select("id,external_id,name,position,alternate_positions,overall,age,estimated_value_eur,club,league,gender").eq("is_active",true).eq("club",club.name).order("overall",{ascending:false});squad=(sp||[]).map((x:any)=>({id:String(x.id),name:x.name,position:x.position,alternatePositions:Array.isArray(x.alternate_positions)?x.alternate_positions:[],rating:Number(x.overall||0),age:x.age!=null?Number(x.age):null,marketValue:x.estimated_value_eur!=null?Number(x.estimated_value_eur):null,genderId:x.gender?.id!=null?Number(x.gender.id):null,source:"scouting"}))}
  if(!squad.length){const {data:p}=await s.from("players").select("*").eq("club_id",m.club_id).order("rating",{ascending:false});squad=(p||[]).map((x:any)=>({...x,marketValue:x.market_value!=null?Number(x.market_value):null}))}
  setPlayers(squad);
  let {data:l}=await s.from("lineups").select("*").eq("club_id",m.club_id).eq("is_active",true).limit(1).maybeSingle();
  if(!l){const x=await s.from("lineups").insert({club_id:m.club_id,name:"İlk 11",formation:"3-4-2-1"}).select().single();l=x.data}
  setLineup(l);
 }
 useEffect(()=>{load()},[]);

 function normPos(v:any){return String(v||"").toLocaleUpperCase("tr-TR").replace(/Ğ/g,"G").replace(/İ/g,"I").replace(/Ş/g,"S").replace(/Ü/g,"U").replace(/Ö/g,"O").replace(/Ç/g,"C")}
 function playerPositions(p:any){const raw=[p.position,...(p.alternatePositions||[]).map((x:any)=>typeof x==="string"?x:(x?.shortLabel||x?.label))];return raw.map(normPos).filter(Boolean).filter((v:string,i:number,a:string[])=>a.indexOf(v)===i)}
 function fits(p:any,slot:string){return playerPositions(p).includes(normPos(slot.split("_")[0]))}
 function lineupMetrics(sel:Record<string,string>){const ids=Object.values(sel).filter(Boolean);const ps=ids.map(id=>players.find(p=>String(p.id)===String(id))).filter(Boolean);const avg=(vals:number[])=>vals.length?vals.reduce((a,b)=>a+b,0)/vals.length:null;return {rating:avg(ps.map(p=>Number(p.rating)).filter(Number.isFinite)),age:avg(ps.map(p=>p.age==null?NaN:Number(p.age)).filter(Number.isFinite)),value:avg(ps.map(p=>p.marketValue==null?NaN:Number(p.marketValue)).filter(Number.isFinite))}}
 const metrics=useMemo(()=>lineupMetrics(selected),[selected,players]);
 const formationStats=useMemo(()=>{if(!players.length)return [];const referenceIds=new Set(players.slice(0,11).map(p=>String(p.id)));return keys.map((f,i)=>{const r=computeAutomaticLineup(players,f.roles,i,playerPositions);const ids=Object.values(r.selected).filter(Boolean).map(String);const m=lineupMetrics(r.selected);const placementEntries=Object.entries(r.selected).map(([slot,id])=>{if(!id)return null;const p=players.find(x=>String(x.id)===String(id));if(!p)return null;const role=normPos(slot.split("_")[0]);const posIndex=playerPositions(p).indexOf(role);return {id:String(id),value:posIndex>=0?posIndex+1:0}}).filter(Boolean) as {id:string,value:number}[];const placementValue=placementEntries.reduce((sum,x)=>sum+x.value,0);const top11PlacementValue=placementEntries.filter(x=>referenceIds.has(x.id)).reduce((sum,x)=>sum+x.value,0);const placementByPlayer=players.map(p=>placementEntries.find(x=>x.id===String(p.id))?.value??null);return {...f,index:i,selected:r.selected,reserves:r.reserves,top11:ids.filter(id=>referenceIds.has(id)).length,placementValue,top11PlacementValue,placementByPlayer,...m}}).sort((a,b)=>{const first=b.top11-a.top11||a.placementValue-b.placementValue||a.top11PlacementValue-b.top11PlacementValue;if(first)return first;for(let i=0;i<Math.max(a.placementByPlayer.length,b.placementByPlayer.length);i++){const av=a.placementByPlayer[i],bv=b.placementByPlayer[i];if(av===bv)continue;if(av==null)return 1;if(bv==null)return -1;if(av!==bv)return av-bv}return a.index-b.index})},[players]);
 const topFormation=formationStats[0]||null;
 const aiFormation=topFormation&&Object.values(topFormation.selected).filter(Boolean).length===11?topFormation:null;
 useEffect(()=>{if(!players.length||!topFormation||topInitialized.current)return;topInitialized.current=true;setFormationKey(topFormation.key);setSelected(topFormation.selected);setAutoReserves(topFormation.reserves);setOtherFormationKey(formationStats[1]?.key||"")},[players,topFormation?.key]);
 function formatMarketValue(v:number|null){if(v==null)return "—";return v>=1000000?`€${(v/1000000).toLocaleString("tr-TR",{maximumFractionDigits:2})}M`:`€${Math.round(v/1000).toLocaleString("tr-TR")}K`}
 function transferPlan():TransferPlan|null{const referenceIds=new Set(players.slice(0,11).map(p=>String(p.id)));const placedEntries=Object.entries(selected).filter(([,id])=>id).map(([slot,id])=>({slot,id:String(id),player:players.find(p=>String(p.id)===String(id))})).filter(x=>x.player);const missingTargets=slots.filter(x=>!selected[x.slot]).map(x=>({role:x.role,playerId:null,playerName:null}));const upgradeTargets=placedEntries.filter(x=>!referenceIds.has(x.id)).map(x=>({role:normPos(x.slot.split("_")[0]),playerId:x.id,playerName:x.player?.name||null}));const referencePlaced=placedEntries.filter(x=>referenceIds.has(x.id)).map(x=>x.player);const nums=(ps:any[],k:string):number[]=>ps.map((p:any)=>Number(p[k])).filter((n:number)=>Number.isFinite(n));const range=(ps:any[],k:string)=>{const a=nums(ps,k);return a.length?{min:Math.min(...a),max:Math.max(...a)}:null};const genderId=players.map(p=>p.genderId).find((v:any)=>v===0||v===1)??null;if(missingTargets.length)return {type:"required",roles:Array.from(new Set(missingTargets.map(x=>x.role))),targets:missingTargets,genderId,rating:range(referencePlaced,"rating"),age:range(referencePlaced,"age"),value:range(referencePlaced,"marketValue")};if(upgradeTargets.length)return {type:"upgrade",roles:Array.from(new Set(upgradeTargets.map(x=>x.role))),targets:upgradeTargets,genderId,rating:range(referencePlaced,"rating"),age:range(referencePlaced,"age"),value:range(referencePlaced,"marketValue")};return null}
 function openTransferOffer(){const plan=transferPlan();if(!plan)return;sessionStorage.setItem("dispficsTransferRequest",JSON.stringify({formation:formation.name,...plan,createdAt:Date.now()}));localStorage.removeItem("dispficsTransferRequest");router.push("/ai")}
 function changeFormation(key:string){setFormationKey(key);const fi=keys.findIndex(x=>x.key===key),f=keys[fi]||keys[0];const r=computeAutomaticLineup(players,f.roles,fi,playerPositions);setSelected(r.selected);setAutoReserves(r.reserves);setMsg("Diziliş için en iyi 11 otomatik hesaplandı.")}

 async function save(){
  if(!lineup)return;const vals=Object.entries(selected).filter(([,v])=>v);
  if(new Set(vals.map(x=>x[1])).size!==vals.length)return setMsg("Aynı oyuncu iki pozisyonda olamaz.");
  const {error:le}=await s.from("lineups").update({formation:formation.name}).eq("id",lineup.id);if(le)return setMsg(le.message);
  await s.from("lineup_players").delete().eq("lineup_id",lineup.id);
  if(vals.length){const rows=vals.map(([slot,id])=>{const p=players.find(x=>String(x.id)===String(id));return p?.source==="scouting"?{lineup_id:lineup.id,slot,player_id:null,scouting_player_id:id}:{lineup_id:lineup.id,slot,player_id:id,scouting_player_id:null}});const {error}=await s.from("lineup_players").insert(rows);if(error)return setMsg(error.message)}
  setMsg("İlk 11 ve diziliş kaydedildi.");
 }

 return <AppShell title="Aktif Kadro"><div style={{maxWidth:1050}}>
  <small style={{color:"#49ad60"}}>İLK 11 • {formation.name}</small>
  <p style={{color:"#aab7af"}}>Dizilişi seçtiğiniz anda en iyi 11 otomatik hesaplanır. İsterseniz pozisyonlara tıklayıp manuel değişiklik yapabilirsiniz.</p>
  {topFormation&&<button onClick={()=>changeFormation(topFormation.key)} style={topFormationButton}><span><small style={{display:"block",color:"#718078",fontWeight:700}}>TOP DİZİLİŞ</small><b>{topFormation.name}{keys.filter(x=>x.name===topFormation.name).length>1?` • Varyasyon ${topFormation.variant}`:""}</b></span><strong style={{color:"#9bcba7"}}>{aiFormation?"AI ÖNERİSİ":"TRANSFER GEREKLİ"}</strong></button>}
  <label style={{display:"block",maxWidth:360,margin:"10px 0"}}>Diğer Dizilişler
   <select value={otherFormationKey||(formationStats[1]?.key||"")} onChange={e=>{setOtherFormationKey(e.target.value);if(e.target.value)changeFormation(e.target.value)}} style={input}>{formationStats.slice(1).map(x=><option key={x.key} value={x.key}>{x.name}{keys.filter(y=>y.name===x.name).length>1?" • Varyasyon "+x.variant:""}</option>)}</select>
  </label>
  <div style={{display:"flex",gap:10,flexWrap:"wrap",margin:"10px 0 14px"}}><span style={metricCard}><small style={metricLabel}>ORT. REYTİNG</small><b>{metrics.rating!=null?metrics.rating.toFixed(2):"—"}</b></span><span style={metricCard}><small style={metricLabel}>ORT. YAŞ</small><b>{metrics.age!=null?metrics.age.toFixed(2):"—"}</b></span><span style={metricCard}><small style={metricLabel}>ORT. DEĞER</small><b>{formatMarketValue(metrics.value)}</b></span></div>
  {(()=>{const plan=transferPlan();if(!plan)return null;const required=plan.type==="required";const targetText=plan.targets.map(t=>t.playerName?`${t.playerName} (${t.role})`:t.role).join(", ");return <div style={transferNotice}><b>Transfer Önerisi</b><span>{required?`Kadrodaki boş pozisyon için transfer önerisi: ${targetText}.`:`Transfer önerisi yapılan oyuncu: ${targetText}.`}</span><button onClick={openTransferOffer} style={offerBtn}>{required?"Transfer adayı bul":"Alternatif oyuncuları göster"}</button></div>})()}
  <div style={pitch}>{slots.map(({slot,role,x,y})=>{const p=players.find(v=>String(v.id)===String(selected[slot]));return <button key={slot} onClick={()=>setActiveSlot(slot)} style={{...spot,left:x+"%",top:y+"%"}}><span style={ball}>{p?Number(p.rating).toFixed(0):"+"}</span><b>{p?p.name:role}</b></button>})}<div style={half}/><div style={circle}/><div style={boxTop}/><div style={boxBottom}/></div>
  {autoReserves.length>0&&<div style={{maxWidth:720,margin:"8px auto 14px",color:"#aab7af",fontSize:13}}><b style={{color:"#d7e6da"}}>Yedek sırası:</b> {autoReserves.map((p,i)=>(12+i)+" "+p.name).join(" • ")}</div>}
  {activeSlot&&<div style={modal} onClick={()=>setActiveSlot(null)}><div style={sheet} onClick={e=>e.stopPropagation()}><div style={{display:"flex",justifyContent:"space-between",alignItems:"center"}}><div><b>Oyuncu Seç</b><small style={{display:"block",color:"#8fa399",marginTop:4}}>{activeSlot.split("_")[0]} • {LABELS[activeSlot.split("_")[0]]}</small></div><button onClick={()=>setActiveSlot(null)} style={close}>×</button></div><button onClick={()=>{setSelected({...selected,[activeSlot]:""});setActiveSlot(null)}} style={playerBtn}>Pozisyonu boş bırak</button>{players.filter(p=>fits(p,activeSlot)&&!Object.entries(selected).some(([k,v])=>k!==activeSlot&&String(v)===String(p.id))).map(p=><button key={p.id} onClick={()=>{setSelected({...selected,[activeSlot]:String(p.id)});setActiveSlot(null)}} style={playerBtn}><span><b>{p.name}</b><small style={{display:"block",color:"#8fa399"}}>{p.position||"—"}{p.alternatePositions?.length?" • "+p.alternatePositions.map((x:any)=>typeof x==="string"?x:x.shortLabel).join(", "):""}</small></span><strong>{Number(p.rating).toFixed(0)}</strong></button>)}</div></div>}
  <button onClick={save} style={primary}>İlk 11'i Kaydet</button><span style={{marginLeft:14,color:"#9bcba7"}}>{msg}</span>
 </div></AppShell>
}
const input={display:"block",width:"100%",marginTop:9,padding:11,background:"#080d0b",color:"white",border:"1px solid #294032",borderRadius:8};
const pitch:any={position:"relative",width:"100%",maxWidth:720,height:"min(66dvh,680px)",minHeight:460,margin:"14px auto",border:"2px solid #b9dfc0",borderRadius:8,overflow:"hidden",background:"repeating-linear-gradient(0deg,#1f7138 0,#1f7138 10%,#247b3e 10%,#247b3e 20%)"};
const spot:any={position:"absolute",zIndex:5,transform:"translate(-50%,-50%)",width:112,border:0,background:"transparent",color:"white",cursor:"pointer",textAlign:"center"};
const ball:any={display:"grid",placeItems:"center",margin:"0 auto 4px",width:46,height:46,borderRadius:"50%",background:"#0e1512",border:"2px solid #49ad60",fontSize:20,fontWeight:800};
const half:any={position:"absolute",left:0,right:0,top:"50%",borderTop:"2px solid #b9dfc0"};
const circle:any={position:"absolute",left:"50%",top:"50%",width:110,height:110,border:"2px solid #b9dfc0",borderRadius:"50%",transform:"translate(-50%,-50%)"};
const boxTop:any={position:"absolute",left:"27%",top:-2,width:"46%",height:"15%",border:"2px solid #b9dfc0"};
const boxBottom:any={position:"absolute",left:"27%",bottom:-2,width:"46%",height:"15%",border:"2px solid #b9dfc0"};
const modal:any={position:"fixed",inset:0,zIndex:50,display:"grid",placeItems:"center",padding:16,background:"rgba(0,0,0,.72)"};
const sheet:any={width:"min(520px,100%)",maxHeight:"80vh",overflow:"auto",padding:18,border:"1px solid #294032",borderRadius:16,background:"#0e1512",color:"white"};
const close:any={fontSize:28,border:0,background:"transparent",color:"white",cursor:"pointer"};
const playerBtn:any={width:"100%",display:"flex",justifyContent:"space-between",alignItems:"center",marginTop:8,padding:12,border:"1px solid #203027",borderRadius:10,background:"#080d0b",color:"white",textAlign:"left",cursor:"pointer"};
const primary={padding:"12px 20px",background:"#2e9d4b",color:"white",border:0,borderRadius:8,fontWeight:700,cursor:"pointer"};

const metricCard:any={minWidth:140,padding:"10px 14px",background:"#0e1512",border:"1px solid #294032",borderRadius:10,display:"grid",gap:4};
const metricLabel:any={color:"#718078",fontSize:10};


const transferNotice:any={display:"grid",gap:7,padding:14,margin:"10px 0 14px",background:"#17150d",border:"1px solid #5b4a24",borderRadius:10,color:"#e7d6a8"};
const offerBtn:any={justifySelf:"start",padding:"9px 13px",background:"#2e9d4b",color:"white",border:0,borderRadius:8,fontWeight:700,cursor:"pointer"};

const topFormationButton:any={width:"100%",maxWidth:520,display:"flex",justifyContent:"space-between",alignItems:"center",gap:16,padding:"14px 16px",margin:"12px 0",background:"#132019",color:"white",border:"1px solid #49ad60",borderRadius:10,textAlign:"left",cursor:"pointer"};
