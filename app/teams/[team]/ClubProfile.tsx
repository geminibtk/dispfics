"use client";
import {useEffect,useState} from "react";

type ClubProfile={founded?:string;stadium?:string;coach?:string;chairman?:string;city?:string;country?:string;website?:string;wiki?:string};
const properties:{key:keyof ClubProfile;pid:string;label:string}[]=[
 {key:"founded",pid:"P571",label:"Kuruluş"},
 {key:"stadium",pid:"P115",label:"Stadyum"},
 {key:"city",pid:"P131",label:"Şehir / Konum"},
 {key:"country",pid:"P17",label:"Ülke"},
 {key:"website",pid:"P856",label:"Resmî site"}
];
const api="https://www.wikidata.org/w/api.php";
async function getData(params:Record<string,string>){const url=new URL(api);Object.entries({format:"json",origin:"*",...params}).forEach(([k,v])=>url.searchParams.set(k,v));const response=await fetch(url.toString());if(!response.ok)throw new Error("Wikidata");return response.json()}
export default function ClubProfile({name,league}:{name:string;league:string}){
 const [profile,setProfile]=useState<ClubProfile|null>(null),[loading,setLoading]=useState(true);
 useEffect(()=>{let active=true;setLoading(true);setProfile(null);
 (async()=>{
  const results=await getData({action:"wbsearchentities",search:name,language:"en",uselang:"tr",type:"item",limit:"12"});
  const candidates=(results.search||[]) as {id:string;label:string;description?:string}[];
  const normalized=(s:string)=>s.toLocaleLowerCase("tr").replace(/[^a-z0-9ğüşıöç]/g,"");
  const selected=candidates.find(x=>normalized(x.label)===normalized(name)&&/football|soccer|futbol|sports club/i.test(x.description||""))
   ||candidates.find(x=>/football|soccer|futbol/i.test(x.description||""))
   ||candidates.find(x=>normalized(x.label)===normalized(name));
  if(!selected){if(active)setLoading(false);return}
  const result=await getData({action:"wbgetentities",ids:selected.id,props:"claims|sitelinks",languages:"tr|en"});
  const entity=result.entities?.[selected.id];
  const claims=entity?.claims||{};
  const ids:string[]=[];
  const output:ClubProfile={};
  for(const prop of properties){
   const claim=claims[prop.pid]?.find((x:any)=>x.mainsnak?.datavalue)?.mainsnak?.datavalue?.value;
   if(!claim)continue;
   if(prop.key==="founded"){const year=String(claim.time||"").match(/[+-](\d{4})/);if(year)output.founded=year[1]}
   else if(prop.key==="website"){if(typeof claim==="string"&&claim.startsWith("https://"))output.website=claim}
   else if(claim.id){(output as any)[prop.key]=claim.id;ids.push(claim.id)}
  }
  if(ids.length){
   const names=await getData({action:"wbgetentities",ids:Array.from(new Set(ids)).join("|"),props:"labels",languages:"tr|en"});
   for(const prop of properties){const id=output[prop.key];if(id&&names.entities?.[id]){(output as any)[prop.key]=names.entities[id].labels?.tr?.value||names.entities[id].labels?.en?.value||"—"}}
  }
  const title=entity?.sitelinks?.trwiki?.title||entity?.sitelinks?.enwiki?.title;
  if(title)output.wiki="https://"+(entity.sitelinks?.trwiki?"tr":"en")+".wikipedia.org/wiki/"+encodeURIComponent(title.replace(/ /g,"_"));
  if(active){setProfile(output);setLoading(false)}
 })().catch(()=>{if(active)setLoading(false)});
 return()=>{active=false}
 },[name]);
 const fields=properties.filter(p=>p.key!=="website"&&profile?.[p.key]);
 return <div className="module"><h2>Kulüp Profili</h2><p>Kulübün temel bilgileri</p>
 <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fit,minmax(190px,1fr))",gap:12,marginTop:20}}>
 {fields.map(p=><div key={p.pid} style={{border:"1px solid #294032",borderRadius:12,padding:18}}><small style={{color:"#8fa399"}}>{p.label}</small><h3>{profile?.[p.key]}</h3></div>)}
 </div>
 {loading?<p style={{marginTop:20}}>Kulüp bilgileri getiriliyor…</p>:<div style={{marginTop:20,display:"flex",gap:16,flexWrap:"wrap"}}>
 {profile?.website&&<a href={profile.website} target="_blank" rel="noopener noreferrer">Resmî web sitesi ↗</a>}
 {!fields.length&&<p>Bu kulüp için doğrulanabilir ek profil bilgisi bulunamadı.</p>}
 </div>}
 </div>
}
