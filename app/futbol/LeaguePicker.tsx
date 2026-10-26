"use client";
import {useRouter} from "next/navigation";
export default function LeaguePicker({names,selected,date,tab}:{names:string[];selected:string;date:string;tab:string}){
 const router=useRouter();
 return <select aria-label="Diğer ligler" value={names.includes(selected)?selected:""} onChange={e=>{const name=e.target.value;router.push("/futbol?"+new URLSearchParams({date,tab,league:"",name}).toString())}} style={{background:"#12251a",color:"#e5f5e9",border:"1px solid #365c41",borderRadius:10,padding:"10px 13px",minWidth:155,maxWidth:220,cursor:"pointer"}}>
 <option value="">Diğer ligler ({names.length})</option>{names.map(n=><option key={n} value={n}>{n}</option>)}
 </select>;
}
