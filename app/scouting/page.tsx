"use client";
import {useEffect,useMemo,useState} from "react";
import {useRouter} from "next/navigation";
import {createClient} from "../../lib/supabase";
import AppShell from "../components/AppShell";

type EAPlayer={id:number;overallRating:number;firstName:string;lastName:string;commonName?:string|null;leagueName?:string;avatarUrl?:string;team?:{label?:string};nationality?:{label?:string};position?:{shortLabel?:string;label?:string};stats?:Record<string,{value:number}>};
type Row={id:number;name:string;club:string;league:string;nationality:string;position:string;overall:number;pace?:number;shooting?:number;passing?:number;dribbling?:number;defending?:number;physical?:number;avatarUrl?:string};

const EA_URL="https://drop-api.ea.com/rating/ea-sports-fc";

export default function Scouting(){
 const s=createClient(),router=useRouter();
 const [rows,setRows]=useState<Row[]>([]),[q,setQ]=useState(""),[pos,setPos]=useState(""),[min,setMin]=useState(""),[msg,setMsg]=useState(""),[offset,setOffset]=useState(0),[loading,setLoading]=useState(true);
 async function load(next=0){
  setLoading(true);setMsg("");
  const {data:{user}}=await s.auth.getUser();if(!user){router.replace("/login");return}
  try{
   const r=await fetch(`${EA_URL}?locale=tr&limit=100&offset=${next}`);
   if(!r.ok)throw new Error("EA Ratings isteği başarısız.");
   const j=await r.json();const raw:EAPlayer[]=Array.isArray(j)?j:(j.items||j.results||j.players||[]);
   setRows(raw.map(x=>({id:x.id,name:x.commonName||[x.firstName,x.lastName].filter(Boolean).join(" "),club:x.team?.label||"—",league:x.leagueName||"—",nationality:x.nationality?.label||"—",position:x.position?.shortLabel||x.position?.label||"—",overall:x.overallRating,pace:x.stats?.pac?.value,shooting:x.stats?.sho?.value,passing:x.stats?.pas?.value,dribbling:x.stats?.dri?.value,defending:x.stats?.def?.value,physical:x.stats?.phy?.value,avatarUrl:x.avatarUrl})));
   setOffset(next);
  }catch(e){setRows([]);setMsg(e instanceof Error?e.message:"EA Ratings yüklenemedi.");}
  finally{setLoading(false)}
 }
 useEffect(()=>{load(0)},[]);
 const list=useMemo(()=>rows.filter(x=>(!q||[x.name,x.club,x.league,x.nationality].some(v=>v.toLowerCase().includes(q.toLowerCase())))&&(!pos||x.position===pos)&&(!min||x.overall>=Number(min))),[rows,q,pos,min]);
 const positions=Array.from(new Set(rows.map(x=>x.position))).filter(Boolean);
 async function shortlist(x:Row){const {data:{user}}=await s.auth.getUser();if(!user)return;const {data:m}=await s.from("club_members").select("club_id").eq("user_id",user.id).limit(1).maybeSingle();if(!m)return;const {error}=await s.from("transfer_targets").insert({club_id:m.club_id,name:x.name,position:x.position,current_club:x.club,market_value:0,rating:x.overall/10,priority:"medium",notes:"EA SPORTS FC Ratings görünümünden shortlist'e eklendi"});setMsg(error?error.message:x.name+" shortlist'e eklendi.")}
 return <AppShell title="Oyuncu Keşfi"><div>
  <p style={{color:"#8fa399",marginTop:0}}>EA SPORTS FC Ratings • canlı görünüm • {offset+1}–{offset+100}</p>
  <div className="scoutFilters"><input placeholder="Oyuncu, kulüp, lig veya ülke ara" value={q} onChange={e=>setQ(e.target.value)} style={input}/><select value={pos} onChange={e=>setPos(e.target.value)} style={input}><option value="">Tüm pozisyonlar</option>{positions.map(x=><option key={x}>{x}</option>)}</select><input type="number" placeholder="Minimum OVR" value={min} onChange={e=>setMin(e.target.value)} style={input}/></div>
  <p style={{color:"#9bcba7"}}>{msg}</p>
  {loading?<div style={empty}>EA Ratings yükleniyor…</div>:<div style={{display:"grid",gap:10}}>{list.map(x=><div className="scoutRow" key={x.id}>
   <div style={{display:"flex",alignItems:"center",gap:10}}>{x.avatarUrl&&<img src={x.avatarUrl} alt="" width={48} height={48} style={{objectFit:"contain"}}/>}<div><b>{x.name}</b><small style={{display:"block",color:"#aab7af"}}>{x.club} • {x.league}</small></div></div><span>{x.position}</span><strong style={{fontSize:22,color:"#49ad60"}}>{x.overall}</strong><Stat n="PAC" v={x.pace}/><Stat n="SHO" v={x.shooting}/><Stat n="PAS" v={x.passing}/><Stat n="DRI" v={x.dribbling}/><Stat n="DEF" v={x.defending}/><Stat n="PHY" v={x.physical}/><button onClick={()=>shortlist(x)} style={button}>Shortlist</button>
  </div>)}{!list.length&&<div style={empty}>Bu filtrelerle oyuncu bulunamadı.</div>}</div>}
  <div style={{display:"flex",justifyContent:"space-between",gap:10,marginTop:18}}><button disabled={offset===0||loading} onClick={()=>load(Math.max(0,offset-100))} style={navButton}>← Önceki 100</button><button disabled={loading} onClick={()=>load(offset+100)} style={navButton}>Sonraki 100 →</button></div>
 </div></AppShell>
}
function Stat({n,v}:{n:string;v?:number}){return <span style={{textAlign:"center"}}><small style={{display:"block",color:"#718078"}}>{n}</small><b>{v??"—"}</b></span>}
const input={padding:12,background:"#0e1512",color:"white",border:"1px solid #294032",borderRadius:9,minWidth:0};
const button={padding:"9px 12px",background:"#2e9d4b",color:"white",border:0,borderRadius:8,fontWeight:700};
const navButton={...button,background:"#132019",border:"1px solid #294032"};
const empty={padding:30,border:"1px solid #203027",borderRadius:12,color:"#aab7af"};
