"use client";
import {useEffect,useMemo,useState} from "react";
import {useRouter} from "next/navigation";
import {createClient} from "../../lib/supabase";
import AppShell from "../components/AppShell";

type EAPlayer={id:number;overallRating:number;firstName:string;lastName:string;commonName?:string|null;leagueName?:string;avatarUrl?:string;team?:{label?:string};nationality?:{label?:string};position?:{shortLabel?:string;label?:string};stats?:Record<string,{value:number}>};
type Row={id:number;name:string;club:string;league:string;nationality:string;position:string;overall:number;pace?:number;shooting?:number;passing?:number;dribbling?:number;defending?:number;physical?:number;avatarUrl?:string;age?:number;estimatedValue?:number;alternatePositions:string[];gender?:string;playStyles:string[];rank?:number};

const EA_URL="/api/ea-ratings";
const PAGE_SIZE=100,TOTAL=19789;

export default function Scouting(){
 const s=createClient(),router=useRouter();
 const [rows,setRows]=useState<Row[]>([]),[q,setQ]=useState(""),[pos,setPos]=useState(""),[min,setMin]=useState(""),[msg,setMsg]=useState(""),[offset,setOffset]=useState(0),[loading,setLoading]=useState(true);
 const [gender,setGender]=useState(""),[league,setLeague]=useState(""),[country,setCountry]=useState(""),[playStyle,setPlayStyle]=useState(""),[sort,setSort]=useState("rank");
 async function load(next=0, search=q.trim()){
  setLoading(true);setMsg("");
  const {data:{user}}=await s.auth.getUser();if(!user){router.replace("/login");return}
  try{
   const r=await fetch(`${EA_URL}?offset=${next}${search?`&search=${encodeURIComponent(search)}`:""}`);
   if(!r.ok)throw new Error("EA Ratings isteği başarısız.");
   const j=await r.json();const raw:EAPlayer[]=Array.isArray(j)?j:(j.items||j.results||j.players||[]);
   const ids=raw.map(x=>String(x.id));
   const {data:db,error:dbError}=await s.from("scouting_players").select("external_id,age,estimated_value_eur,alternate_positions,gender,player_abilities,rank").in("external_id",ids);
   if(dbError)throw dbError;
   const meta=new Map((db||[]).map((x:any)=>[String(x.external_id),x]));
   setRows(raw.map(x=>{const m:any=meta.get(String(x.id));return {id:x.id,name:x.commonName||[x.firstName,x.lastName].filter(Boolean).join(" "),club:x.team?.label||"—",league:x.leagueName||"—",nationality:x.nationality?.label||"—",position:x.position?.shortLabel||x.position?.label||"—",overall:x.overallRating,pace:x.stats?.pac?.value,shooting:x.stats?.sho?.value,passing:x.stats?.pas?.value,dribbling:x.stats?.dri?.value,defending:x.stats?.def?.value,physical:x.stats?.phy?.value,avatarUrl:x.avatarUrl,age:m?.age??undefined,estimatedValue:m?.estimated_value_eur!=null?Number(m.estimated_value_eur):undefined,alternatePositions:Array.isArray(m?.alternate_positions)?m.alternate_positions.map((p:any)=>p?.shortLabel||p?.label).filter(Boolean):[],gender:m?.gender?.label,playStyles:Array.isArray(m?.player_abilities)?m.player_abilities.map((p:any)=>String(p?.label||"").trim()).filter(Boolean):[],rank:m?.rank}}));
   setOffset(next);
  }catch(e){setRows([]);setMsg(e instanceof Error?e.message:"EA Ratings yüklenemedi.");}
  finally{setLoading(false)}
 }
 useEffect(()=>{load(0)},[]);
 const filtered=useMemo(()=>rows.filter(x=>(!gender||x.gender===gender)&&(!league||x.league===league)&&(!pos||x.position===pos||x.alternatePositions.includes(pos))&&(!country||x.nationality===country)&&(!playStyle||x.playStyles.includes(playStyle))&&(!min||x.overall>=Number(min))),[rows,gender,league,pos,country,playStyle,min]);
 const list=useMemo(()=>[...filtered].sort((a,b)=>{const key=sort==="overall"?"overall":sort==="pace"?"pace":sort==="shooting"?"shooting":sort==="passing"?"passing":sort==="dribbling"?"dribbling":sort==="defending"?"defending":sort==="physical"?"physical":"rank";return Number((b as any)[key]??-1)-Number((a as any)[key]??-1)}),[filtered,sort]);
 const leagues=Array.from(new Set(rows.map(x=>x.league))).filter(x=>x&&x!=="—").sort();
 const countries=Array.from(new Set(rows.map(x=>x.nationality))).filter(x=>x&&x!=="—").sort();
 const playStyles=Array.from(new Set(rows.flatMap(x=>x.playStyles))).filter(Boolean).sort();
 const page=Math.floor(offset/PAGE_SIZE)+1,totalPages=Math.ceil(TOTAL/PAGE_SIZE);
 const positions=Array.from(new Set(rows.flatMap(x=>[x.position,...x.alternatePositions]))).filter(Boolean);
 async function syncEA(){setLoading(true);setMsg("EA verileri Supabase’e senkronize ediliyor…");const {data:{session}}=await s.auth.getSession();if(!session){router.replace("/login");return}try{const r=await fetch("/api/ea-sync",{method:"POST",headers:{Authorization:`Bearer ${session.access_token}`}});const j=await r.json();if(!r.ok)throw new Error(j.error||"Senkronizasyon başarısız.");setMsg(`${j.synced?.toLocaleString("tr-TR")||0} oyuncu Supabase’e senkronize edildi.`)}catch(e){setMsg(e instanceof Error?e.message:"Senkronizasyon başarısız.")}finally{setLoading(false)}}
 async function shortlist(x:Row){const {data:{user}}=await s.auth.getUser();if(!user)return;const {data:m}=await s.from("club_members").select("club_id").eq("user_id",user.id).limit(1).maybeSingle();if(!m)return;const {error}=await s.from("transfer_targets").insert({club_id:m.club_id,name:x.name,position:x.position,current_club:x.club,market_value:0,rating:x.overall/10,priority:"medium",notes:"EA SPORTS FC Ratings görünümünden shortlist'e eklendi"});setMsg(error?error.message:x.name+" shortlist'e eklendi.")}
 return <AppShell title="Oyuncu Keşfi"><div>
  <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",gap:12,flexWrap:"wrap"}}><p style={{color:"#8fa399",marginTop:0}}>EA SPORTS FC Ratings • 19.789 oyuncu • {q.trim()?`tüm veritabanında arama`:`${offset+1}–${offset+100}`}</p><button onClick={syncEA} disabled={loading} style={button}>EA Verilerini Senkronize Et</button></div>
  <div className="scoutFilters"><input placeholder="19.789 oyuncuda ara" value={q} onChange={e=>setQ(e.target.value)} onKeyDown={e=>{if(e.key==="Enter")load(0,q.trim())}} style={input}/><button onClick={()=>load(0,q.trim())} disabled={loading} style={button}>Ara</button><select value={pos} onChange={e=>setPos(e.target.value)} style={input}><option value="">Tüm pozisyonlar</option>{positions.map(x=><option key={x}>{x}</option>)}</select><input type="number" placeholder="Minimum OVR" value={min} onChange={e=>setMin(e.target.value)} style={input}/></div>
  <details className="scoutAdvanced" open><summary>Filtrele ve Sırala</summary><div className="scoutAdvancedGrid">
   <label>Cinsiyet<select value={gender} onChange={e=>setGender(e.target.value)} style={input}><option value="">Tümü</option><option>Erkek Futbolu</option><option>Kadın Futbolu</option></select></label>
   <label>Ligler ve Takımlar<select value={league} onChange={e=>setLeague(e.target.value)} style={input}><option value="">Tüm Ligler</option>{leagues.map(x=><option key={x}>{x}</option>)}</select></label>
   <label>Konum<select value={pos} onChange={e=>setPos(e.target.value)} style={input}><option value="">Tüm Konumlar</option>{positions.map(x=><option key={x}>{x}</option>)}</select></label>
   <label>Ülke<select value={country} onChange={e=>setCountry(e.target.value)} style={input}><option value="">Tüm Ülkeler</option>{countries.map(x=><option key={x}>{x}</option>)}</select></label>
   <label>OyunTarzları<select value={playStyle} onChange={e=>setPlayStyle(e.target.value)} style={input}><option value="">Tüm OyunTarzları</option>{playStyles.map(x=><option key={x}>{x}</option>)}</select></label>
   <label>Sıralama Ölçütü<select value={sort} onChange={e=>setSort(e.target.value)} style={input}><option value="rank">Sıra</option><option value="overall">Genel</option><option value="pace">Hız</option><option value="shooting">Şut</option><option value="passing">Pas</option><option value="dribbling">Dribbling</option><option value="defending">Defans</option><option value="physical">Fizik Gücü</option></select></label>
   </div><div className="scoutAdvancedActions"><button onClick={()=>{setGender("");setLeague("");setPos("");setCountry("");setPlayStyle("");setMin("");setSort("rank")}} style={navButton}>Filtreleri Sıfırla</button><button onClick={()=>load(0,q.trim())} style={button}>Filtreleri Uygula</button></div></details><p style={{color:"#9bcba7"}}>{msg}</p>
  {loading?<div style={empty}>EA Ratings yükleniyor…</div>:<div style={{display:"grid",gap:10}}>{list.map(x=><div className="scoutRow" key={x.id}>
   <div style={{display:"flex",alignItems:"center",gap:10}}>{x.avatarUrl&&<img src={x.avatarUrl} alt="" width={48} height={48} style={{objectFit:"contain"}}/>}<div><b>{x.name}</b><small style={{display:"block",color:"#aab7af"}}>{x.club} • {x.league}</small></div></div><span><b>{x.position}</b>{x.alternatePositions.length>0&&<small style={{display:"block",color:"#7f9187",marginTop:3}}>Alt: {x.alternatePositions.join(" · ")}</small>}</span><strong style={{fontSize:22,color:"#49ad60"}}>{x.overall}</strong><Stat n="YAŞ" v={x.age}/><span style={{textAlign:"center"}}><small style={{display:"block",color:"#718078"}}>DEĞER</small><b>{x.estimatedValue!=null?formatValue(x.estimatedValue):"—"}</b></span><Stat n="PAC" v={x.pace}/><Stat n="SHO" v={x.shooting}/><Stat n="PAS" v={x.passing}/><Stat n="DRI" v={x.dribbling}/><Stat n="DEF" v={x.defending}/><Stat n="PHY" v={x.physical}/><button onClick={()=>shortlist(x)} style={button}>Shortlist</button>
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
