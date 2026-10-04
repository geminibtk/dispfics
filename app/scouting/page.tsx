"use client";
import {useEffect,useMemo,useState} from "react";
import {useRouter} from "next/navigation";
import {createClient} from "../../lib/supabase";
import AppShell from "../components/AppShell";

type EAPlayer={id:number;overallRating:number;firstName:string;lastName:string;commonName?:string|null;leagueName?:string;avatarUrl?:string;team?:{label?:string};nationality?:{label?:string};position?:{shortLabel?:string;label?:string};stats?:Record<string,{value:number}>};
type Row={id:number;name:string;club:string;league:string;nationality:string;position:string;overall:number;pace?:number;shooting?:number;passing?:number;dribbling?:number;defending?:number;physical?:number;avatarUrl?:string;age?:number;estimatedValue?:number};

const EA_URL="/api/ea-ratings";
const PAGE_SIZE=100,TOTAL=19789;

export default function Scouting(){
 const s=createClient(),router=useRouter();
 const [rows,setRows]=useState<Row[]>([]),[q,setQ]=useState(""),[pos,setPos]=useState(""),[min,setMin]=useState(""),[msg,setMsg]=useState(""),[offset,setOffset]=useState(0),[loading,setLoading]=useState(true);
 async function load(next=0, search=q.trim()){
  setLoading(true);setMsg("");
  const {data:{user}}=await s.auth.getUser();if(!user){router.replace("/login");return}
  try{
   const r=await fetch(`${EA_URL}?offset=${next}${search?`&search=${encodeURIComponent(search)}`:""}`);
   if(!r.ok)throw new Error("EA Ratings isteği başarısız.");
   const j=await r.json();const raw:EAPlayer[]=Array.isArray(j)?j:(j.items||j.results||j.players||[]);
   setRows(raw.map(x=>({id:x.id,name:x.commonName||[x.firstName,x.lastName].filter(Boolean).join(" "),club:x.team?.label||"—",league:x.leagueName||"—",nationality:x.nationality?.label||"—",position:x.position?.shortLabel||x.position?.label||"—",overall:x.overallRating,pace:x.stats?.pac?.value,shooting:x.stats?.sho?.value,passing:x.stats?.pas?.value,dribbling:x.stats?.dri?.value,defending:x.stats?.def?.value,physical:x.stats?.phy?.value,avatarUrl:x.avatarUrl})));
   setOffset(next);
  }catch(e){setRows([]);setMsg(e instanceof Error?e.message:"EA Ratings yüklenemedi.");}
  finally{setLoading(false)}
 }
 useEffect(()=>{load(0)},[]);
 const list=useMemo(()=>rows.filter(x=>(!pos||x.position===pos)&&(!min||x.overall>=Number(min))),[rows,pos,min]);
 const page=Math.floor(offset/PAGE_SIZE)+1,totalPages=Math.ceil(TOTAL/PAGE_SIZE);
 const positions=Array.from(new Set(rows.map(x=>x.position))).filter(Boolean);
 async function syncEA(){setLoading(true);setMsg("EA verileri Supabase’e senkronize ediliyor…");const {data:{session}}=await s.auth.getSession();if(!session){router.replace("/login");return}try{const r=await fetch("/api/ea-sync",{method:"POST",headers:{Authorization:`Bearer ${session.access_token}`}});const j=await r.json();if(!r.ok)throw new Error(j.error||"Senkronizasyon başarısız.");setMsg(`${j.synced?.toLocaleString("tr-TR")||0} oyuncu Supabase’e senkronize edildi.`)}catch(e){setMsg(e instanceof Error?e.message:"Senkronizasyon başarısız.")}finally{setLoading(false)}}
 async function shortlist(x:Row){const {data:{user}}=await s.auth.getUser();if(!user)return;const {data:m}=await s.from("club_members").select("club_id").eq("user_id",user.id).limit(1).maybeSingle();if(!m)return;const {error}=await s.from("transfer_targets").insert({club_id:m.club_id,name:x.name,position:x.position,current_club:x.club,market_value:0,rating:x.overall/10,priority:"medium",notes:"EA SPORTS FC Ratings görünümünden shortlist'e eklendi"});setMsg(error?error.message:x.name+" shortlist'e eklendi.")}
 return <AppShell title="Oyuncu Keşfi"><div>
  <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",gap:12,flexWrap:"wrap"}}><p style={{color:"#8fa399",marginTop:0}}>EA SPORTS FC Ratings • 19.789 oyuncu • {q.trim()?`tüm veritabanında arama`:`${offset+1}–${offset+100}`}</p><button onClick={syncEA} disabled={loading} style={button}>EA Verilerini Senkronize Et</button></div>
  <div className="scoutFilters"><input placeholder="19.789 oyuncuda ara" value={q} onChange={e=>setQ(e.target.value)} onKeyDown={e=>{if(e.key==="Enter")load(0,q.trim())}} style={input}/><button onClick={()=>load(0,q.trim())} disabled={loading} style={button}>Ara</button><select value={pos} onChange={e=>setPos(e.target.value)} style={input}><option value="">Tüm pozisyonlar</option>{positions.map(x=><option key={x}>{x}</option>)}</select><input type="number" placeholder="Minimum OVR" value={min} onChange={e=>setMin(e.target.value)} style={input}/></div>
  <p style={{color:"#9bcba7"}}>{msg}</p>
  {loading?<div style={empty}>EA Ratings yükleniyor…</div>:<div style={{display:"grid",gap:10}}>{list.map(x=><div className="scoutRow" key={x.id}>
   <div style={{display:"flex",alignItems:"center",gap:10}}>{x.avatarUrl&&<img src={x.avatarUrl} alt="" width={48} height={48} style={{objectFit:"contain"}}/>}<div><b>{x.name}</b><small style={{display:"block",color:"#aab7af"}}>{x.club} • {x.league}</small></div></div><span>{x.position}</span><strong style={{fontSize:22,color:"#49ad60"}}>{x.overall}</strong><Stat n="YAŞ" v={x.age}/><span style={{textAlign:"center"}}><small style={{display:"block",color:"#718078"}}>DEĞER</small><b>{x.estimatedValue!=null?formatValue(x.estimatedValue):"—"}</b></span><Stat n="PAC" v={x.pace}/><Stat n="SHO" v={x.shooting}/><Stat n="PAS" v={x.passing}/><Stat n="DRI" v={x.dribbling}/><Stat n="DEF" v={x.defending}/><Stat n="PHY" v={x.physical}/><button onClick={()=>shortlist(x)} style={button}>Shortlist</button>
  </div>)}{!list.length&&<div style={empty}>Bu filtrelerle oyuncu bulunamadı.</div>}</div>}
  {!q.trim()&&<div style={{display:"flex",justifyContent:"space-between",gap:10,marginTop:18}}><button disabled={offset===0||loading} onClick={()=>load(Math.max(0,offset-100),"")} style={navButton}>← Önceki 100</button><span style={{color:"#8fa399",alignSelf:"center"}}>{offset+1}–{Math.min(offset+100,19789)}</span><button disabled={loading||offset+100>=19789} onClick={()=>load(offset+100,"")} style={navButton}>Sonraki 100 →</button></div>}
 </div></AppShell>
}
function formatValue(v:number){return v>=1000000?`€${(v/1000000).toLocaleString("tr-TR",{maximumFractionDigits:1})}M`:`€${Math.round(v/1000).toLocaleString("tr-TR")}K`}
function Stat({n,v}:{n:string;v?:number}){return <span style={{textAlign:"center"}}><small style={{display:"block",color:"#718078"}}>{n}</small><b>{v??"—"}</b></span>}
const input={padding:12,background:"#0e1512",color:"white",border:"1px solid #294032",borderRadius:9,minWidth:0};
const button={padding:"9px 12px",background:"#2e9d4b",color:"white",border:0,borderRadius:8,fontWeight:700};
const navButton={...button,background:"#132019",border:"1px solid #294032"};
const empty={padding:30,border:"1px solid #203027",borderRadius:12,color:"#aab7af"};
