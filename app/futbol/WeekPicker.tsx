"use client";
import {useRouter} from "next/navigation";
export default function WeekPicker({rounds,selected,league,name}:{rounds:{value:string;label:string}[];selected:string;league:number;name:string}){
 const router=useRouter();
 return <label style={{display:"flex",alignItems:"center",gap:10,margin:"14px 0",fontSize:14,fontWeight:700}}>Hafta
 <select aria-label="Lig haftası" value={selected} onChange={e=>{const query=new URLSearchParams({league:String(league),week:e.target.value});if(name)query.set("name",name);router.push("/futbol?"+query.toString())}} style={{background:"#14291c",border:"1px solid #426e4c",borderRadius:9,color:"#e8f6eb",padding:"10px 14px",minWidth:150}}>
 {rounds.map(r=><option key={r.value} value={r.value}>{r.label}</option>)}
 </select></label>
}
