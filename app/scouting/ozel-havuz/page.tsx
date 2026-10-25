"use client";
import {useEffect,useMemo,useState} from "react";
import {useRouter} from "next/navigation";
import {createClient} from "../../../lib/supabase";
import {displayRating} from "../../../lib/display-rating";
import AppShell from "../../components/AppShell";

type Player={id:string;external_id:string;name:string;club:string|null;league:string|null;position:string|null;overall:number|null;age:number|null;avatar_url:string|null};
export default function SpecialPlayerPool(){
 const router=useRouter();
 const [players,setPlayers]=useState<Player[]>([]);
 const [loading,setLoading]=useState(true);
 const [error,setError]=useState("");
 const [search,setSearch]=useState("");
 const [league,setLeague]=useState("");
 const [page,setPage]=useState(0);
 useEffect(()=>{let cancelled=false;(async()=>{
  try{
   const s=createClient();const all:Player[]=[];
   for(let start=0;;start+=1000){
    const {data,error}=await s.from("scouting_players").select("id,external_id,name,club,league,position,overall,age,avatar_url").eq("is_active",true).eq("fifaindex_status","unmatched").order("name",{ascending:true}).range(start,start+999);
    if(error)throw error;
    all.push(...(data||[]) as Player[]);
    if(!data||data.length<1000)break;
   }
   if(!cancelled)setPlayers(all);
  }catch(e){if(!cancelled)setError(e instanceof Error?e.message:"Oyuncular yüklenemedi.");}
  finally{if(!cancelled)setLoading(false);}
 })();return()=>{cancelled=true}},[]);
 const leagues=useMemo(()=>Array.from(new Set(players.map(p=>p.league||"Belirtilmemiş"))).sort((a,b)=>a.localeCompare(b,"tr")),[players]);
 const filtered=useMemo(()=>players.filter(p=>(!league||(p.league||"Belirtilmemiş")===league)&&(!search||[p.name,p.club,p.league].some(v=>String(v||"").toLocaleLowerCase("tr").includes(search.toLocaleLowerCase("tr"))))),[players,league,search]);
 const pageSize=100;const shown=filtered.slice(page*pageSize,(page+1)*pageSize);
 return <AppShell title="Özel Oyuncu Havuzu"><div style={{maxWidth:1200,margin:"0 auto"}}>
  <button onClick={()=>router.push("/scouting")} style={secondary}>← Oyuncu Keşfi</button>
  <div style={{margin:"18px 0 20px"}}><span style={{color:"#81c995",fontWeight:700,fontSize:12}}>FC27 EŞLEŞME DURUMU</span><h2 style={{margin:"8px 0"}}>Özel Oyuncu Havuzu</h2><p style={{color:"#a7b9ad",lineHeight:1.6}}>Bu oyuncuların topladığımız FIFA Index FC27 listesinde ID eşleşmesi bulunmuyor. Bu, serbest oyuncu oldukları anlamına gelmez. Mevcut kulüp ve lig bilgileri korunmuştur.</p><strong style={{color:"#81c995"}}>{loading?"Yükleniyor…":players.length.toLocaleString("tr-TR")+" oyuncu"}</strong></div>
  <div style={{display:"flex",gap:12,flexWrap:"wrap",marginBottom:18}}><input aria-label="Oyuncu veya kulüp ara" placeholder="Oyuncu veya kulüp ara" value={search} onChange={e=>{setSearch(e.target.value);setPage(0)}} style={{...input,flex:"1 1 260px"}}/><select aria-label="Lig filtrele" value={league} onChange={e=>{setLeague(e.target.value);setPage(0)}} style={{...input,flex:"1 1 220px"}}><option value="">Tüm ligler</option>{leagues.map(l=><option key={l} value={l}>{l}</option>)}</select></div>
  {error&&<p role="alert" style={{color:"#ffb4a8"}}>{error}</p>}
  {loading?<p>Oyuncular yükleniyor…</p>:<><p style={{color:"#9fb3a6"}}>{filtered.length.toLocaleString("tr-TR")} oyuncu bulundu</p><div style={{display:"grid",gap:8}}>{shown.map(p=><button key={p.id} onClick={()=>router.push("/scouting/"+p.external_id)} style={{display:"flex",alignItems:"center",gap:12,padding:14,border:"1px solid #294032",background:"#101c15",color:"white",borderRadius:12,textAlign:"left",cursor:"pointer",width:"100%"}}>{p.avatar_url?<img src={p.avatar_url} alt="" style={{width:42,height:42,borderRadius:9,objectFit:"cover"}}/>:<span style={{width:42,height:42,display:"grid",placeItems:"center",borderRadius:9,background:"#26382c"}}>⚽</span>}<span style={{flex:1,minWidth:0}}><strong style={{display:"block"}}>{p.name}</strong><small style={{color:"#9fb3a6"}}>{p.club||"Kulüp belirtilmemiş"} · {p.league||"Lig belirtilmemiş"}</small></span><span style={{color:"#b3d8bb",whiteSpace:"nowrap"}}>{p.position||"—"} · {p.overall==null?"—":displayRating(p.overall)}</span><span aria-hidden="true">→</span></button>)}{!shown.length&&<p>Bu filtreye uygun oyuncu bulunamadı.</p>}</div><div style={{display:"flex",justifyContent:"space-between",alignItems:"center",gap:12,marginTop:20}}><button style={secondary} disabled={page===0} onClick={()=>setPage(v=>Math.max(0,v-1))}>← Önceki</button><span style={{color:"#9fb3a6"}}>{filtered.length?Math.min(page*pageSize+1,filtered.length):0}–{Math.min((page+1)*pageSize,filtered.length)} / {filtered.length}</span><button style={secondary} disabled={(page+1)*pageSize>=filtered.length} onClick={()=>setPage(v=>v+1)}>Sonraki →</button></div></>}
 </div></AppShell>
}
const input={padding:12,background:"#0e1512",color:"white",border:"1px solid #294032",borderRadius:9,minWidth:0};
const secondary={padding:"10px 14px",background:"#132019",color:"white",border:"1px solid #294032",borderRadius:9,cursor:"pointer"};
