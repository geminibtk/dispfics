"use client";
import {useEffect,useMemo,useState} from "react";
import {useRouter} from "next/navigation";
import {createClient} from "../../lib/supabase";
import {displayRating} from "../../lib/display-rating";
import AppShell from "../components/AppShell";
import CountryFlag from "./CountryFlag";


type CountrySummary={name:string;players:number;rating:number;averageAge:number|null;value:number};
const fold=(s:string)=>s.toLocaleLowerCase("tr-TR").normalize("NFD").replace(/[\u0300-\u036f]/g,"");
const money=(v:number)=>v>=1e6?"€"+(v/1e6).toLocaleString("tr-TR",{maximumFractionDigits:0})+"M":"€"+Math.round(v/1000).toLocaleString("tr-TR")+"K";
export default function Countries(){
 const router=useRouter();const [summaries,setSummaries]=useState<CountrySummary[]>([]),[query,setQuery]=useState(""),[loading,setLoading]=useState(true),[error,setError]=useState("");
 useEffect(()=>{let active=true;(async()=>{try{const s=createClient();const {data,error}=await s.from("country_catalog_summary").select("name,players,rating,averageAge,value").order("rating",{ascending:false}).limit(1000);if(error)throw error;if(active)setSummaries((data||[]) as CountrySummary[])}catch(e){if(active)setError(e instanceof Error?e.message:"Ülkeler yüklenemedi.")}finally{if(active)setLoading(false)}})();return()=>{active=false}},[]);
 const countries=useMemo(()=>summaries.filter(x=>fold(x.name).includes(fold(query))).sort((a,b)=>b.rating-a.rating||(b.averageAge??-1)-(a.averageAge??-1)||b.value-a.value||a.name.localeCompare(b.name,"tr")),[summaries,query]);
 return <AppShell title="Ülkeler"><div><div className="teamFilters"><input aria-label="Ülke ara" placeholder="Ülke ara" value={query} onChange={e=>setQuery(e.target.value)} style={{padding:12,background:"#0e1512",color:"white",border:"1px solid #294032",borderRadius:9}}/></div><p style={{color:"#8fa399"}}>{loading?"Ülkeler yükleniyor…":countries.length.toLocaleString("tr-TR")+" ülke"} {error}</p><div className="teamGrid">{countries.map((x,i)=><button key={x.name} className="teamCard" onClick={()=>router.push("/lineup?country="+encodeURIComponent(x.name))}><div style={{display:"flex",gap:14,alignItems:"center"}}><b style={{minWidth:34,textAlign:"center"}}><small style={{display:"block",color:"#718078",fontSize:9}}>SIRA</small>{i+1}</b><CountryFlag name={x.name}/><div><h3>{x.name}</h3></div></div><div className="teamMetrics"><b>{displayRating(x.rating)}<small>ORT. REYTİNG</small></b><b>{x.averageAge??"—"}<small>ORT. YAŞ</small></b><b>{money(x.value)}<small>KADRO DEĞERİ</small></b></div></button>)}</div></div></AppShell>
}