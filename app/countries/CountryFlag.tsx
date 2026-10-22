"use client";
import {useEffect,useState} from "react";
const cache=new Map<string,string>();
const pending=new Map<string,Promise<string>>();
async function findFlag(name:string):Promise<string>{
 if(cache.has(name))return cache.get(name)||"";
 if(pending.has(name))return pending.get(name)!;
 const task=(async()=>{try{
  const search=new URL("https://www.wikidata.org/w/api.php");
  Object.entries({action:"wbsearchentities",search:name,language:"en",format:"json",origin:"*",limit:"10"}).forEach(([k,v])=>search.searchParams.set(k,v));
  const r=await fetch(search);if(!r.ok)return "";const items=(await r.json()).search||[];
  const key=name.toLocaleLowerCase("tr-TR");
  const item=items.find((x:any)=>x.label?.toLocaleLowerCase("tr-TR")===key&&/country|sovereign|state|nation/i.test(x.description||""))
   ||items.find((x:any)=>/country|sovereign state|nation/i.test(x.description||""));
  if(!item)return "";
  const url=new URL("https://www.wikidata.org/w/api.php");
  Object.entries({action:"wbgetentities",ids:item.id,props:"claims",format:"json",origin:"*"}).forEach(([k,v])=>url.searchParams.set(k,v));
  const detail=await fetch(url);if(!detail.ok)return "";
  const claims=(await detail.json()).entities?.[item.id]?.claims;
  const file=claims?.P41?.find((x:any)=>typeof x.mainsnak?.datavalue?.value==="string")?.mainsnak?.datavalue?.value;
  return file?"https://commons.wikimedia.org/wiki/Special:FilePath/"+encodeURIComponent(file)+"?width=96":"";
 }catch{return ""}})();
 pending.set(name,task);const result=await task;pending.delete(name);cache.set(name,result);return result;
}
export default function CountryFlag({name}:{name:string}){
 const [src,setSrc]=useState(()=>cache.get(name)||"");
 useEffect(()=>{let active=true;setSrc(cache.get(name)||"");findFlag(name).then(x=>{if(active)setSrc(x)});return()=>{active=false}},[name]);
 return <span style={{width:52,height:52,flexShrink:0,display:"grid",placeItems:"center",borderRadius:12,background:"#15251c",border:"1px solid #294032",overflow:"hidden"}}>{src?<img src={src} alt={name+" bayrağı"} loading="lazy" onError={()=>setSrc("")} style={{width:44,height:34,objectFit:"contain"}}/>:<span aria-hidden="true" style={{fontSize:18}}>🌍</span>}</span>;
}
