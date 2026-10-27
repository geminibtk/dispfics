"use client";
import {useRouter} from "next/navigation";
import {useState} from "react";
import {catalogLeagueIds} from "../../lib/football-center";
export default function LeaguePicker({names,selected,tab}:{names:string[];selected:string;tab:string}){
 const router=useRouter();
 const [open,setOpen]=useState(false);
 const logo=(name:string)=>catalogLeagueIds[name]?"https://media.api-sports.io/football/leagues/"+catalogLeagueIds[name]+".png":null;
 return <div style={{position:"relative",flexShrink:0}}>
  <button type="button" aria-expanded={open} aria-label="Diğer ligler" onClick={()=>setOpen(!open)} style={{display:"flex",alignItems:"center",gap:8,background:"#12251a",color:"#e5f5e9",border:"1px solid #365c41",borderRadius:10,padding:"10px 13px",minWidth:155,cursor:"pointer"}}>
   {names.includes(selected)&&logo(selected)?<img src={logo(selected)!} alt="" width={22} height={22} style={{objectFit:"contain"}}/>:null}
   <span>{names.includes(selected)?selected:"Diğer ligler"}</span><span aria-hidden="true">⌄</span>
  </button>
  {open?<div style={{position:"absolute",top:"100%",right:0,zIndex:20,width:265,maxHeight:330,overflowY:"auto",background:"#12251a",border:"1px solid #365c41",borderRadius:10,boxShadow:"0 12px 30px #0009",marginTop:4}}>
   {names.map(name=><button type="button" key={name} onClick={()=>{setOpen(false);router.push("/futbol?"+new URLSearchParams({league:String(catalogLeagueIds[name]||""),...(catalogLeagueIds[name]?{}:{name})}).toString())}} style={{display:"flex",alignItems:"center",gap:10,width:"100%",textAlign:"left",background:name===selected?"#204c2d":"transparent",color:"#e5f5e9",border:0,padding:"10px 12px",cursor:"pointer"}}>
    {name===selected&&logo(name)?<img src={logo(name)!} alt="" width={24} height={24} loading="lazy" style={{objectFit:"contain"}}/>:null}
    <span>{name}</span>
   </button>)}
  </div>:null}
 </div>;
}
