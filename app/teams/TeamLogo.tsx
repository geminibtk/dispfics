"use client";
import {useEffect,useRef,useState} from "react";
const cache=new Map<string,string>();
const pending=new Map<string,Promise<string>>();
function normalize(v:string){return v.toLocaleLowerCase("tr-TR").normalize("NFD").replace(/[\u0300-\u036f]/g,"").replace(/[^a-z0-9ğüşıöç]/g,"")}
async function resolveLogo(name:string):Promise<string>{
 const key=normalize(name);if(cache.has(key))return cache.get(key)||"";
 if(pending.has(key))return pending.get(key)!;
 const task=(async()=>{try{const {createClient}=await import("../../lib/supabase");const {data,error}=await createClient().from("team_logo_catalog").select("image_url").eq("name",name).maybeSingle();if(error)return "";return String(data?.image_url||"")}catch{return ""}})();
 pending.set(key,task);const result=await task;pending.delete(key);if(result)cache.set(key,result);return result;
}
export default function TeamLogo({name}:{name:string}){
 const [src,setSrc]=useState(()=>cache.get(normalize(name))||"");
 const [visible,setVisible]=useState(false);
 const ref=useRef<HTMLSpanElement>(null);
 useEffect(()=>{const node=ref.current;if(!node)return;const observer=new IntersectionObserver(entries=>{if(entries.some(x=>x.isIntersecting)){setVisible(true);observer.disconnect()}},{rootMargin:"240px"});observer.observe(node);return()=>observer.disconnect()},[name]);
 useEffect(()=>{let alive=true;setSrc(cache.get(normalize(name))||"");if(visible)void resolveLogo(name).then(url=>{if(alive)setSrc(url)});return()=>{alive=false}},[name,visible]);
 return <span ref={ref} style={{width:52,height:52,flexShrink:0,display:"grid",placeItems:"center",borderRadius:12,background:"#15251c",border:"1px solid #294032",overflow:"hidden"}}>
 {src?<img src={src} alt={name+" arması"} loading="lazy" onError={()=>{cache.set(normalize(name),"");setSrc("")}} style={{width:44,height:44,objectFit:"contain"}}/>:<span aria-hidden="true" style={{fontWeight:800,fontSize:16,color:"#90bca0"}}>{name.trim().split(/\s+/).slice(0,2).map(x=>x[0]).join("").toLocaleUpperCase("tr-TR")}</span>}
 </span>
}
