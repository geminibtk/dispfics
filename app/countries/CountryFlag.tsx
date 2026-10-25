"use client";
import {useEffect,useState} from "react";
const cache=new Map<string,string>();
const pending=new Map<string,Promise<string>>();
async function findFlag(name:string):Promise<string>{
 if(cache.has(name))return cache.get(name)||"";
 if(pending.has(name))return pending.get(name)!;
 const task=(async()=>{try{const {createClient}=await import("../../lib/supabase");const {data,error}=await createClient().from("country_flag_catalog").select("image_url").eq("name",name).maybeSingle();if(error)return "";return String(data?.image_url||"")}catch{return ""}})();
 pending.set(name,task);const result=await task;pending.delete(name);if(result)cache.set(name,result);return result;
}
export default function CountryFlag({name}:{name:string}){
 const [src,setSrc]=useState(()=>cache.get(name)||"");
 useEffect(()=>{let active=true;setSrc(cache.get(name)||"");findFlag(name).then(x=>{if(active)setSrc(x)});return()=>{active=false}},[name]);
 return <span style={{width:52,height:52,flexShrink:0,display:"grid",placeItems:"center",borderRadius:12,background:"#15251c",border:"1px solid #294032",overflow:"hidden"}}>{src?<img src={src} alt={name+" bayrağı"} loading="lazy" onError={()=>setSrc("")} style={{width:44,height:34,objectFit:"contain"}}/>:<span aria-hidden="true" style={{fontSize:18}}>🌍</span>}</span>;
}
