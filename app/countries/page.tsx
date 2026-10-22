"use client";
import {useEffect,useMemo,useState} from "react";
import {useRouter} from "next/navigation";
import {createClient} from "../../lib/supabase";
import {displayRating} from "../../lib/display-rating";
import AppShell from "../components/AppShell";
import CountryFlag from "./CountryFlag";
import {CountryPlayer,countryPlayerFromRow,topCountryPlayers} from "../../lib/countryPlayers";

type P=CountryPlayer;
const fold=(s:string)=>s.toLocaleLowerCase("tr-TR").normalize("NFD").replace(/[\u0300-\u036f]/g,"");
const money=(v:number)=>v>=1e6?"€"+(v/1e6).toLocaleString("tr-TR",{maximumFractionDigits:0})+"M":"€"+Math.round(v/1000).toLocaleString("tr-TR")+"K";
export default function Countries(){
 const router=useRouter();const [players,setPlayers]=useState<P[]>([]),[query,setQuery]=useState(""),[loading,setLoading]=useState(true),[error,setError]=useState("");
 useEffect(()=>{let active=true;(async()=>{try{const s=createClient();let all:P[]=[];for(let start=0;;start+=1000){const {data,error}=await s.from("scouting_players").select("id,name,nationality,position,alternate_positions,overall,age,estimated_value_eur,avatar_url").eq("is_active",true).order("id").range(start,start+999);if(error)throw error;all.push(...(data||[]).map(countryPlayerFromRow));if(!data||data.length<1000)break}if(active)setPlayers(all)}catch(e){if(active)setError(e instanceof Error?e.message:"Ülkeler yüklenemedi.")}finally{if(active)setLoading(false)}})();return()=>{active=false}},[]);
 const countries=useMemo(()=>{const grouped=new Map<string,P[]>();for(const p of players){if(!p.nationality)continue;const group=grouped.get(p.nationality)||[];group.push(p);grouped.set(p.nationality,group)}return Array.from(grouped.entries()).filter(([,ps])=>ps.length>=26).map(([name,ps])=>{const squad=topCountryPlayers(ps);return {name,players:squad.length,rating:squad.reduce((s,p)=>s+p.rating,0)/26,averageAge:Math.round(squad.reduce((s,p)=>s+(p.age??0),0)/Math.max(1,squad.filter(p=>p.age!=null).length)),value:squad.reduce((s,p)=>s+p.market_value,0)}}).filter(x=>fold(x.name).includes(fold(query))).sort((a,b)=>b.rating-a.rating||(b.averageAge??-1)-(a.averageAge??-1)||b.value-a.value||a.name.localeCompare(b.name,"tr"))},[players,query]);
 return <AppShell title="Ülkeler"><div><div className="teamFilters"><input aria-label="Ülke ara" placeholder="Ülke ara" value={query} onChange={e=>setQuery(e.target.value)} style={{padding:12,background:"#0e1512",color:"white",border:"1px solid #294032",borderRadius:9}}/></div><p style={{color:"#8fa399"}}>{loading?"Ülkeler yükleniyor…":countries.length.toLocaleString("tr-TR")+" ülke"} {error}</p><div className="teamGrid">{countries.map((x,i)=><button key={x.name} className="teamCard" onClick={()=>router.push("/lineup?country="+encodeURIComponent(x.name))}><div style={{display:"flex",gap:14,alignItems:"center"}}><b style={{minWidth:34,textAlign:"center"}}><small style={{display:"block",color:"#718078",fontSize:9}}>SIRA</small>{i+1}</b><CountryFlag name={x.name}/><div><h3>{x.name}</h3></div></div><div className="teamMetrics"><b>{displayRating(x.rating)}<small>ORT. REYTİNG</small></b><b>{x.averageAge??"—"}<small>ORT. YAŞ</small></b><b>{money(x.value)}<small>KADRO DEĞERİ</small></b></div></button>)}</div></div></AppShell>
}