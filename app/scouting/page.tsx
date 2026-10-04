"use client";
import {useEffect,useMemo,useState} from "react";
import {useRouter} from "next/navigation";
import {createClient} from "../../lib/supabase";
import AppShell from "../components/AppShell";

type EAPlayer={id:number;overallRating:number;firstName:string;lastName:string;commonName?:string|null;leagueName?:string;avatarUrl?:string;team?:{label?:string};nationality?:{label?:string};position?:{shortLabel?:string;label?:string};stats?:Record<string,{value:number}>};
type Row={id:number;name:string;club:string;league:string;nationality:string;position:string;overall:number;pace?:number;shooting?:number;passing?:number;dribbling?:number;defending?:number;physical?:number;avatarUrl?:string;age?:number;estimatedValue?:number;alternatePositions:string[];gender?:string;playStyles:string[];rank?:number};

const EA_URL="/api/ea-ratings";
const PAGE_SIZE=200,TOTAL=19789;

export default function Scouting(){
 const s=createClient(),router=useRouter();
 const [rows,setRows]=useState<Row[]>([]),[q,setQ]=useState(""),[pos,setPos]=useState(""),[min,setMin]=useState(""),[msg,setMsg]=useState(""),[offset,setOffset]=useState(0),[loading,setLoading]=useState(true),[allCountries,setAllCountries]=useState<string[]>([]),[allLeagues,setAllLeagues]=useState<string[]>([]),[allPositions,setAllPositions]=useState<string[]>([]);
 const [gender,setGender]=useState(""),[league,setLeague]=useState(""),[country,setCountry]=useState(""),[sort,setSort]=useState("overall"),[maxOverall,setMaxOverall]=useState(""),[minAge,setMinAge]=useState(""),[maxAge,setMaxAge]=useState(""),[minValue,setMinValue]=useState(""),[maxValue,setMaxValue]=useState(""),[sortDirection,setSortDirection]=useState("desc");
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
 useEffect(()=>{load(0);(async()=>{const {data}=await s.from("scouting_players").select("nationality,league,position,alternate_positions");if(data){setAllCountries(Array.from(new Set(data.map((x:any)=>x.nationality).filter(Boolean))).sort((a,b)=>a.localeCompare(b,"tr")));setAllLeagues(Array.from(new Set(data.map((x:any)=>x.league).filter(Boolean))).sort((a,b)=>a.localeCompare(b,"tr")));setAllPositions(Array.from(new Set(data.flatMap((x:any)=>[x.position,...(Array.isArray(x.alternate_positions)?x.alternate_positions.map((p:any)=>p?.shortLabel||p?.label):[])].filter(Boolean)))).sort((a,b)=>a.localeCompare(b,"tr")))}})()},[]);
 const filtered=useMemo(()=>rows.filter(x=>(!gender||x.gender===gender)&&(!league||x.league===league)&&(!pos||x.position===pos||x.alternatePositions.includes(pos))&&(!country||x.nationality===country)&&(!min||x.overall>=Number(min))&&(!maxOverall||x.overall<=Number(maxOverall))&&(!minAge||Number(x.age)>=Number(minAge))&&(!maxAge||Number(x.age)<=Number(maxAge))&&(!minValue||Number(x.estimatedValue)>=Number(minValue)*1000000)&&(!maxValue||Number(x.estimatedValue)<=Number(maxValue)*1000000)),[rows,gender,league,pos,country,min,maxOverall,minAge,maxAge,minValue,maxValue]);
 const list=useMemo(()=>[...filtered].sort((a,b)=>{const key=sort==="age"?"age":sort==="estimatedValue"?"estimatedValue":"overall";const av=Number((a as any)[key]??-1),bv=Number((b as any)[key]??-1);return sortDirection==="asc"?av-bv:bv-av}),[filtered,sort,sortDirection]);
 const leagues=allLeagues;
 const countries=allCountries;
  const positions=allPositions;
 async function syncEA(){setLoading(true);setMsg("EA verileri Supabase’e senkronize ediliyor…");const {data:{session}}=await s.auth.getSession();if(!session){router.replace("/login");return}try{const r=await fetch("/api/ea-sync",{method:"POST",headers:{Authorization:`Bearer ${session.access_token}`}});const j=await r.json();if(!r.ok)throw new Error(j.error||"Senkronizasyon başarısız.");setMsg(`${j.synced?.toLocaleString("tr-TR")||0} oyuncu Supabase’e senkronize edildi.`)}catch(e){setMsg(e instanceof Error?e.message:"Senkronizasyon başarısız.")}finally{setLoading(false)}}
 async function shortlist(x:Row){const {data:{user}}=await s.auth.getUser();if(!user)return;const {data:m}=await s.from("club_members").select("club_id").eq("user_id",user.id).limit(1).maybeSingle();if(!m)return;const {error}=await s.from("transfer_targets").insert({club_id:m.club_id,name:x.name,position:x.position,current_club:x.club,market_value:0,rating:x.overall/10,priority:"medium",notes:"EA SPORTS FC Ratings görünümünden shortlist'e eklendi"});setMsg(error?error.message:x.name+" shortlist'e eklendi.")}
 return <AppShell title="Oyuncu Keşfi"><div>
  <div className="scoutFilters"><input placeholder="Oyuncu, takım veya ülke ara" value={q} onChange={e=>setQ(e.target.value)} onKeyDown={e=>{if(e.key==="Enter")load(0,q.trim())}} style={input}/><button onClick={()=>load(0,q.trim())} disabled={loading} style={button}>Ara</button></div>
  <details className="scoutAdvanced" open><summary>Filtrele ve Sırala</summary><div className="scoutAdvancedGrid">
   <label>Cinsiyet<select value={gender} onChange={e=>setGender(e.target.value)} style={input}><option value="">Tümü</option><option>Erkek Futbolu</option><option>Kadın Futbolu</option></select></label>
   <label>Değer (€ M)<span style={{display:"flex",gap:6}}><input type="number" placeholder="Min" value={minValue} onChange={e=>setMinValue(e.target.value)} style={input}/><input type="number" placeholder="Max" value={maxValue} onChange={e=>setMaxValue(e.target.value)} style={input}/></span></label>
   <label>Genel (OVR)<span style={{display:"flex",gap:6}}><input type="number" min="0" max="99" placeholder="Min" value={min} onChange={e=>setMin(e.target.value)} style={input}/><input type="number" min="0" max="99" placeholder="Max" value={maxOverall} onChange={e=>setMaxOverall(e.target.value)} style={input}/></span></label>
   <label>Konum<select value={pos} onChange={e=>setPos(e.target.value)} style={input}><option value="">Tüm Konumlar</option>{positions.map(x=><option key={x}>{x}</option>)}</select></label>
   <label>Ligler<select value={league} onChange={e=>setLeague(e.target.value)} style={input}><option value="">Tüm Ligler</option>{leagues.map(x=><option key={x}>{x}</option>)}</select></label>
   <label>Ülke<select value={country} onChange={e=>setCountry(e.target.value)} style={input}><option value="">Tüm Ülkeler</option>{countries.map(x=><option key={x}>{x}</option>)}</select></label>
   <label>Yaş<span style={{display:"flex",gap:6}}><input type="number" placeholder="Min" value={minAge} onChange={e=>setMinAge(e.target.value)} style={input}/><input type="number" placeholder="Max" value={maxAge} onChange={e=>setMaxAge(e.target.value)} style={input}/></span></label>
   <label>Sıralama Ölçütü<select value={sort} onChange={e=>setSort(e.target.value)} style={input}><option value="estimatedValue">Değer</option><option value="overall">Genel</option><option value="age">Yaş</option></select></label>
   <label>Sıralama Yönü<select value={sortDirection} onChange={e=>setSortDirection(e.target.value)} style={input}><option value="asc">Düşükten Yükseğe</option><option value="desc">Yüksekten Düşüğe</option></select></label>
   </div><div className="scoutAdvancedActions"><button onClick={()=>{setGender("");setLeague("");setPos("");setCountry("");setMin("");setMaxOverall("");setMinAge("");setMaxAge("");setMinValue("");setMaxValue("");setSort("overall");setSortDirection("desc")}} style={navButton}>Filtreleri Sıfırla</button><button onClick={()=>load(0,q.trim())} style={button}>Filtreleri Uygula</button></div></details><p style={{color:"#9bcba7"}}>{msg}</p>
  {loading?<div style={empty}>Oyuncular yükleniyor…</div>:<div style={{display:"grid",gap:10}}>{list.map(x=><div className="scoutRow" key={x.id} onClick={()=>router.push(`/scouting/${x.id}`)} role="button" tabIndex={0}>
   <div style={{display:"flex",alignItems:"center",gap:10}}>{x.avatarUrl&&<img src={x.avatarUrl} alt="" width={48} height={48} style={{objectFit:"contain"}}/>}<div><b>{x.name}</b><small style={{display:"block",color:"#aab7af"}}>{x.club} • {x.league}</small></div></div><span><b>{x.position}</b>{x.alternatePositions.length>0&&<small style={{display:"block",color:"#7f9187",marginTop:3}}>Alt: {x.alternatePositions.join(" · ")}</small>}</span><strong style={{fontSize:22,color:"#49ad60"}}>{x.overall}</strong><Stat n="YAŞ" v={x.age}/><span style={{textAlign:"center"}}><small style={{display:"block",color:"#718078"}}>DEĞER</small><b>{x.estimatedValue!=null?formatValue(x.estimatedValue):"—"}</b></span><button onClick={e=>{e.stopPropagation();shortlist(x)}} style={button}>Shortlist</button>
  </div>)}{!list.length&&<div style={empty}>Bu filtrelerle oyuncu bulunamadı.</div>}</div>}
  {!q.trim()&&<div style={{display:"flex",justifyContent:"space-between",gap:10,marginTop:18}}><button disabled={offset===0||loading} onClick={()=>load(Math.max(0,offset-PAGE_SIZE),"")} style={navButton}>← Önceki 200</button><span style={{color:"#8fa399",alignSelf:"center"}}>{offset+1}–{Math.min(offset+PAGE_SIZE,TOTAL)}</span><button disabled={loading||offset+PAGE_SIZE>=TOTAL} onClick={()=>load(offset+PAGE_SIZE,"")} style={navButton}>Sonraki 200 →</button></div>}
 </div></AppShell>
}
function formatValue(v:number){return v>=1000000?`€${(v/1000000).toLocaleString("tr-TR",{maximumFractionDigits:1})}M`:`€${Math.round(v/1000).toLocaleString("tr-TR")}K`}
function Stat({n,v}:{n:string;v?:number}){return <span style={{textAlign:"center"}}><small style={{display:"block",color:"#718078"}}>{n}</small><b>{v??"—"}</b></span>}
const input={padding:12,background:"#0e1512",color:"white",border:"1px solid #294032",borderRadius:9,minWidth:0};
const button={padding:"9px 12px",background:"#2e9d4b",color:"white",border:0,borderRadius:8,fontWeight:700};
const navButton={...button,background:"#132019",border:"1px solid #294032"};
const empty={padding:30,border:"1px solid #203027",borderRadius:12,color:"#aab7af"};
