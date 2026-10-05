"use client";
import {useEffect,useMemo,useState} from "react";
import {useRouter} from "next/navigation";
import {createClient} from "../../lib/supabase";
import AppShell from "../components/AppShell";

type EAPlayer={id:number;overallRating:number;firstName:string;lastName:string;commonName?:string|null;leagueName?:string;avatarUrl?:string;team?:{label?:string};nationality?:{label?:string};position?:{shortLabel?:string;label?:string};stats?:Record<string,{value:number}>};
type Row={id:number;name:string;club:string;league:string;nationality:string;position:string;overall:number;pace?:number;shooting?:number;passing?:number;dribbling?:number;defending?:number;physical?:number;avatarUrl?:string;age?:number;estimatedValue?:number;alternatePositions:string[];gender?:string;playStyles:string[];rank?:number};

const EA_URL="/api/ea-ratings";
const PAGE_SIZE=200,TOTAL=19789; // global DB filtering and sorting

export default function Scouting(){
 const s=createClient(),router=useRouter();
 const [rows,setRows]=useState<Row[]>([]),[q,setQ]=useState(""),[pos,setPos]=useState(""),[min,setMin]=useState(""),[msg,setMsg]=useState(""),[offset,setOffset]=useState(0),[loading,setLoading]=useState(true),[allCountries,setAllCountries]=useState<string[]>([]),[allLeagues,setAllLeagues]=useState<string[]>([]),[allPositions,setAllPositions]=useState<string[]>([]),[resultTotal,setResultTotal]=useState(TOTAL);
 const [gender,setGender]=useState(""),[league,setLeague]=useState(""),[country,setCountry]=useState(""),[sort,setSort]=useState("overall"),[maxOverall,setMaxOverall]=useState(""),[minAge,setMinAge]=useState(""),[maxAge,setMaxAge]=useState(""),[minValue,setMinValue]=useState(""),[maxValue,setMaxValue]=useState(""),[sortDirection,setSortDirection]=useState("desc");
 async function load(next=0, search=q.trim()){
  setLoading(true);setMsg("");
  const {data:{user}}=await s.auth.getUser();if(!user){router.replace("/login");return}
  try{
   let query=s.from("scouting_players").select("external_id,name,club,league,nationality,position,overall,pace,shooting,passing,dribbling,defending,physical,avatar_url,age,estimated_value_eur,alternate_positions,gender,player_abilities,rank",{count:"exact"}).eq("is_active",true);
   if(search)query=query.or(`name.ilike.%${search}%,club.ilike.%${search}%,nationality.ilike.%${search}%`);
   if(gender)query=query.contains("gender",{label:gender});
   if(league)query=query.eq("league",league);
   if(country)query=query.eq("nationality",country);
   if(pos)query=query.or(`position.eq.${pos},alternate_positions.cs.[{"shortLabel":"${pos}"}]`);
   if(min)query=query.gte("overall",Number(min));
   if(maxOverall)query=query.lte("overall",Number(maxOverall));
   if(minAge)query=query.gte("age",Number(minAge));
   if(maxAge)query=query.lte("age",Number(maxAge));
   if(minValue)query=query.gte("estimated_value_eur",Number(minValue)*1000000);
   if(maxValue)query=query.lte("estimated_value_eur",Number(maxValue)*1000000);
   const sortCol=sort==="age"?"age":sort==="estimatedValue"?"estimated_value_eur":"overall";
   query=query.order(sortCol,{ascending:sortDirection==="asc",nullsFirst:false});
    if(sort==="overall"){
      query=query.order("age",{ascending:false,nullsFirst:false}).order("estimated_value_eur",{ascending:false,nullsFirst:false});
    }else if(sort==="age"){
      query=query.order("overall",{ascending:false,nullsFirst:false}).order("estimated_value_eur",{ascending:false,nullsFirst:false});
    }else{
      query=query.order("overall",{ascending:false,nullsFirst:false}).order("age",{ascending:false,nullsFirst:false});
    }
    const {data,error,count}=await query.order("name",{ascending:true}).range(next,next+PAGE_SIZE-1);
   if(error)throw error;
   setRows((data||[]).map((x:any)=>({id:Number(x.external_id),name:x.name,club:x.club||"—",league:x.league||"—",nationality:x.nationality||"—",position:x.position||"—",overall:x.overall,pace:x.pace,shooting:x.shooting,passing:x.passing,dribbling:x.dribbling,defending:x.defending,physical:x.physical,avatarUrl:x.avatar_url,age:x.age,estimatedValue:x.estimated_value_eur!=null?Number(x.estimated_value_eur):undefined,alternatePositions:Array.isArray(x.alternate_positions)?x.alternate_positions.map((p:any)=>p?.shortLabel||p?.label).filter(Boolean):[],gender:x.gender?.label,playStyles:Array.isArray(x.player_abilities)?x.player_abilities.map((p:any)=>String(p?.label||"").trim()).filter(Boolean):[],rank:x.rank})));
   setOffset(next);setResultTotal(count||0);
  }catch(e){setRows([]);setMsg(e instanceof Error?e.message:"Oyuncular yüklenemedi.");}
  finally{setLoading(false)}
 }
 useEffect(()=>{load(0);(async()=>{const {data}=await s.from("scouting_players").select("nationality,league,position,alternate_positions").eq("is_active",true);if(data){setAllCountries(Array.from(new Set(data.map((x:any)=>x.nationality).filter(Boolean))).sort((a,b)=>a.localeCompare(b,"tr")));setAllLeagues(Array.from(new Set(data.map((x:any)=>x.league).filter(Boolean))).sort((a,b)=>a.localeCompare(b,"tr")));setAllPositions(Array.from(new Set(data.flatMap((x:any)=>[x.position,...(Array.isArray(x.alternate_positions)?x.alternate_positions.map((p:any)=>p?.shortLabel||p?.label):[])].filter(Boolean)))).sort((a,b)=>a.localeCompare(b,"tr")))}})()},[]);
 const list=rows;
 const leagues=allLeagues;
 const countries=allCountries;
 const positions=allPositions;
 async function syncEA(){setLoading(true);setMsg("FC27 oyuncuları senkronize ediliyor…");const {data:{session}}=await s.auth.getSession();if(!session){router.replace("/login");return}try{const headers={Authorization:`Bearer ${session.access_token}`};const r=await fetch("/api/ea-sync",{method:"POST",headers});const j=await r.json();if(!r.ok)throw new Error(j.error||"FC27 senkronizasyonu başarısız.");setMsg(`${j.synced?.toLocaleString("tr-TR")||0} oyuncu senkronize edildi. Eski EA boy/kilo verileri eşleştiriliyor…`);const br=await fetch("/api/ea-physical-backfill",{method:"POST",headers});const bj=await br.json();if(!br.ok)throw new Error(`FC27 senkronize edildi ancak boy/kilo backfill başarısız: ${bj.error||"Bilinmeyen hata"}`);setMsg(`${j.synced?.toLocaleString("tr-TR")||0} FC27 oyuncusu senkronize edildi. Boy/kilo: ${bj.updated?.toLocaleString("tr-TR")||0} oyuncu eski EA verisinden tamamlandı; ${bj.unmatched?.toLocaleString("tr-TR")||0} eşleşmedi; ${bj.ambiguous?.toLocaleString("tr-TR")||0} belirsiz.`);await load(0,q.trim())}catch(e){setMsg(e instanceof Error?e.message:"Senkronizasyon başarısız.")}finally{setLoading(false)}}
 async function shortlist(x:Row){const {data:{user}}=await s.auth.getUser();if(!user)return;const {data:m}=await s.from("club_members").select("club_id").eq("user_id",user.id).limit(1).maybeSingle();if(!m)return;const {error}=await s.from("transfer_targets").insert({club_id:m.club_id,name:x.name,position:x.position,current_club:x.club,market_value:0,rating:x.overall/10,priority:"medium",notes:"Oyuncu Keşfi görünümünden aday listesine eklendi"});setMsg(error?error.message:x.name+" aday listesine eklendi.")}
 return <AppShell title="Oyuncu Keşfi"><div>
  <div className="scoutFilters"><input placeholder="Oyuncu, takım veya ülke ara" value={q} onChange={e=>setQ(e.target.value)} onKeyDown={e=>{if(e.key==="Enter")load(0,q.trim())}} style={input}/><button onClick={()=>load(0,q.trim())} disabled={loading} style={button}>Ara</button><button onClick={syncEA} disabled={loading} style={navButton}>{loading?"İşleniyor…":"EA Verilerini Senkronize Et"}</button></div>
  <details className="scoutAdvanced" open><summary>Filtrele ve Sırala</summary><div className="scoutAdvancedGrid scoutFilterLayout">
   <label>Cinsiyet<select value={gender} onChange={e=>setGender(e.target.value)} style={input}><option value="">Tümü</option><option>Erkek Futbolu</option><option>Kadın Futbolu</option></select></label>
   <label>Konum<select value={pos} onChange={e=>setPos(e.target.value)} style={input}><option value="">Tüm Konumlar</option>{positions.map(x=><option key={x}>{x}</option>)}</select></label>
   <label>Ligler<select value={league} onChange={e=>setLeague(e.target.value)} style={input}><option value="">Tüm Ligler</option>{leagues.map(x=><option key={x}>{x}</option>)}</select></label>
   <label>Ülke<select value={country} onChange={e=>setCountry(e.target.value)} style={input}><option value="">Tüm Ülkeler</option>{countries.map(x=><option key={x}>{x}</option>)}</select></label>
   <label>Değer (€ M)<span style={{display:"flex",gap:6}}><input type="number" placeholder="Min" value={minValue} onChange={e=>setMinValue(e.target.value)} style={input}/><input type="number" placeholder="Max" value={maxValue} onChange={e=>setMaxValue(e.target.value)} style={input}/></span></label>
   <label>Genel (OVR)<span style={{display:"flex",gap:6}}><input type="number" min="0" max="99" placeholder="Min" value={min} onChange={e=>setMin(e.target.value)} style={input}/><input type="number" min="0" max="99" placeholder="Max" value={maxOverall} onChange={e=>setMaxOverall(e.target.value)} style={input}/></span></label>
   <label>Yaş<span style={{display:"flex",gap:6}}><input type="number" placeholder="Min" value={minAge} onChange={e=>setMinAge(e.target.value)} style={input}/><input type="number" placeholder="Max" value={maxAge} onChange={e=>setMaxAge(e.target.value)} style={input}/></span></label>
   <label>Sıralama Ölçütü<select value={sort} onChange={e=>setSort(e.target.value)} style={input}><option value="estimatedValue">Değer</option><option value="overall">Genel</option><option value="age">Yaş</option></select></label>
   <label>Sıralama Yönü<select value={sortDirection} onChange={e=>setSortDirection(e.target.value)} style={input}><option value="asc">Düşükten Yükseğe</option><option value="desc">Yüksekten Düşüğe</option></select></label>
   </div><div className="scoutAdvancedActions"><button onClick={()=>{setGender("");setLeague("");setPos("");setCountry("");setMin("");setMaxOverall("");setMinAge("");setMaxAge("");setMinValue("");setMaxValue("");setSort("overall");setSortDirection("desc");setTimeout(()=>load(0,q.trim()),0)}} style={navButton}>Filtreleri Sıfırla</button><button onClick={()=>load(0,q.trim())} style={button}>Filtreleri Uygula</button></div></details><p style={{color:"#9bcba7"}}>{msg}</p>
  {loading?<div style={empty}>Oyuncular yükleniyor…</div>:<div style={{display:"grid",gap:10}}>{list.map(x=><div className="scoutRow" key={x.id} onClick={()=>router.push(`/scouting/${x.id}`)} role="button" tabIndex={0}>
   <div style={{display:"flex",alignItems:"center",gap:10}}>{x.avatarUrl&&<img src={x.avatarUrl} alt="" width={48} height={48} style={{objectFit:"contain"}}/>}<div><b>{x.name}</b><small style={{display:"block",color:"#aab7af"}}>{x.club} • {x.league}</small></div></div><span><b>{x.position}</b>{x.alternatePositions.length>0&&<small style={{display:"block",color:"#7f9187",marginTop:3}}>Alt: {x.alternatePositions.join(" · ")}</small>}</span><span style={{textAlign:"center"}}><small style={{display:"block",color:"#718078"}}>DISPFICS REYTİNG</small><strong style={{fontSize:22,color:"#49ad60"}}>{x.overall}</strong></span><Stat n="YAŞ" v={x.age}/><span style={{textAlign:"center"}}><small style={{display:"block",color:"#718078"}}>DEĞER</small><b>{x.estimatedValue!=null?formatValue(x.estimatedValue):"—"}</b></span><button onClick={e=>{e.stopPropagation();shortlist(x)}} style={button}>Aday Listesine Ekle</button>
  </div>)}{!list.length&&<div style={empty}>Bu filtrelerle oyuncu bulunamadı.</div>}</div>}
  {resultTotal>0&&<div style={{display:"grid",gridTemplateColumns:"1fr auto 1fr",alignItems:"center",gap:10,marginTop:18}}><div>{offset>0&&<button disabled={loading} onClick={()=>load(Math.max(0,offset-PAGE_SIZE),q.trim())} style={navButton}>← Önceki 200</button>}</div><span style={{color:"#8fa399"}}>{(offset+1).toLocaleString("tr-TR")}–{Math.min(offset+PAGE_SIZE,resultTotal).toLocaleString("tr-TR")} / {resultTotal.toLocaleString("tr-TR")}</span><div style={{textAlign:"right"}}>{offset+PAGE_SIZE<resultTotal&&<button disabled={loading} onClick={()=>load(offset+PAGE_SIZE,q.trim())} style={navButton}>Sonraki 200 →</button>}</div></div>}
 </div></AppShell>
}
function formatValue(v:number){return v>=1000000?`€${(v/1000000).toLocaleString("tr-TR",{maximumFractionDigits:1})}M`:`€${Math.round(v/1000).toLocaleString("tr-TR")}K`}
function Stat({n,v}:{n:string;v?:number}){return <span style={{textAlign:"center"}}><small style={{display:"block",color:"#718078"}}>{n}</small><b>{v??"—"}</b></span>}
const input={padding:12,background:"#0e1512",color:"white",border:"1px solid #294032",borderRadius:9,minWidth:0};
const button={padding:"9px 12px",background:"#2e9d4b",color:"white",border:0,borderRadius:8,fontWeight:700};
const navButton={...button,background:"#132019",border:"1px solid #294032"};
const empty={padding:30,border:"1px solid #203027",borderRadius:12,color:"#aab7af"};
