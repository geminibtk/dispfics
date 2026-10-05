"use client";
import {useEffect,useMemo,useState} from "react";import {useRouter} from "next/navigation";import {createClient} from "../../lib/supabase";
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
const keys=FORMATIONS.map((f,i)=>({key:`${f[0]}|${i}`,name:f[0],roles:f[1],variant:FORMATIONS.slice(0,i).filter(x=>x[0]===f[0]).length+1}));
export default function Lineup(){const s=createClient();const router=useRouter();const [players,setPlayers]=useState<any[]>([]);const [lineup,setLineup]=useState<any>(null);const [selected,setSelected]=useState<Record<string,string>>({});const [formationKey,setFormationKey]=useState("");const [msg,setMsg]=useState("");
const formation=useMemo(()=>keys.find(x=>x.key===formationKey)||keys.find(x=>x.name==="4-2-3-1")||keys[0],[formationKey]);
const slots=useMemo(()=>{const count:Record<string,number>={};return formation.roles.map(role=>{count[role]=(count[role]||0)+1;return {slot:`${role}_${count[role]}`,role,label:LABELS[role]||role}})},[formation]);
async function load(){const {data:{user}}=await s.auth.getUser();if(!user)return router.push("/login");const {data:m}=await s.from("club_members").select("club_id").eq("user_id",user.id).order("created_at",{ascending:false}).limit(1).maybeSingle();if(!m)return router.push("/onboarding");const {data:club}=await s.from("clubs").select("name").eq("id",m.club_id).maybeSingle();let squad:any[]=[];if(club?.name){const {data:sp}=await s.from("scouting_players").select("external_id,name,position,overall,club,league").eq("is_active",true).eq("club",club.name).order("overall",{ascending:false});squad=(sp||[]).map((x:any)=>({id:String(x.external_id),name:x.name,position:x.position,rating:Number(x.overall||0),source:"scouting"}))}if(!squad.length){const {data:p}=await s.from("players").select("*").eq("club_id",m.club_id).order("rating",{ascending:false});squad=p||[]}setPlayers(squad);let {data:l}=await s.from("lineups").select("*").eq("club_id",m.club_id).eq("is_active",true).limit(1).maybeSingle();if(!l){const x=await s.from("lineups").insert({club_id:m.club_id,name:"İlk 11",formation:"4-2-3-1"}).select().single();l=x.data}setLineup(l);if(l){const found=keys.find(x=>x.name===l.formation)||keys.find(x=>x.name==="4-2-3-1")||keys[0];setFormationKey(found.key);const {data:lp}=await s.from("lineup_players").select("*").eq("lineup_id",l.id);const map:Record<string,string>={};(lp||[]).forEach(x=>map[x.slot]=x.player_id);setSelected(map)}}
useEffect(()=>{load()},[]);
function changeFormation(key:string){setFormationKey(key);setSelected({});setMsg("Diziliş değişti. Oyuncuları yeni pozisyonlara atayın.")}
async function save(){if(!lineup)return;const vals=Object.entries(selected).filter(([,v])=>v);if(new Set(vals.map(x=>x[1])).size!==vals.length)return setMsg("Aynı oyuncu iki pozisyonda olamaz.");const {error:le}=await s.from("lineups").update({formation:formation.name}).eq("id",lineup.id);if(le)return setMsg(le.message);await s.from("lineup_players").delete().eq("lineup_id",lineup.id);if(vals.length){const {error}=await s.from("lineup_players").insert(vals.map(([slot,player_id])=>({lineup_id:lineup.id,slot,player_id})));if(error)return setMsg(error.message)}setMsg("İlk 11 ve diziliş kaydedildi.")}
return <AppShell title="Aktif Kadro"><div style={{maxWidth:1050}}><small style={{color:"#49ad60"}}>İLK 11 • {formation.name}</small><p style={{color:"#aab7af"}}>Dizilişi seçin, kulübünüzdeki oyuncuları 11 pozisyona atayın ve aktif kadroyu kaydedin.</p><label style={{display:"block",maxWidth:360,margin:"18px 0"}}>Diziliş<select value={formation.key} onChange={e=>changeFormation(e.target.value)} style={input}>{keys.map(x=><option key={x.key} value={x.key}>{x.name}{keys.filter(y=>y.name===x.name).length>1?` • Varyasyon ${x.variant}`:""}</option>)}</select></label><div style={{display:"grid",gridTemplateColumns:"repeat(3,minmax(0,1fr))",gap:12,margin:"24px 0"}}>{slots.map(({slot,role,label})=><label key={slot} style={{padding:14,border:"1px solid #203027",borderRadius:12,background:"#0e1512"}}><small style={{color:"#49ad60"}}>{role} • {label}</small><select value={selected[slot]||""} onChange={e=>setSelected({...selected,[slot]:e.target.value})} style={input}><option value="">Oyuncu seç</option>{players.map(p=><option key={p.id} value={p.id}>{p.name} • {p.position} • {Number(p.rating).toFixed(1)}</option>)}</select></label>)}</div><button onClick={save} style={primary}>İlk 11'i Kaydet</button><span style={{marginLeft:14,color:"#9bcba7"}}>{msg}</span></div></AppShell>}
const input={display:"block",width:"100%",marginTop:9,padding:11,background:"#080d0b",color:"white",border:"1px solid #294032",borderRadius:8};const primary={padding:"12px 20px",background:"#2e9d4b",color:"white",border:0,borderRadius:8,fontWeight:700,cursor:"pointer"};
