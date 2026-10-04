"use client";
import {useState} from "react";
import {useRouter} from "next/navigation";
import {createClient} from "../../lib/supabase";
export default function Login(){
 const [email,setEmail]=useState(""); const [password,setPassword]=useState(""); const [msg,setMsg]=useState(""); const [mode,setMode]=useState<"login"|"signup">("login"); const router=useRouter();
 async function submit(e:React.FormEvent){e.preventDefault();setMsg("İşleniyor...");const s=createClient();
  if(mode==="signup"){const {error}=await s.auth.signUp({email,password});if(error)return setMsg(error.message);setMsg("Kayıt oluşturuldu. E-posta doğrulaması gerekiyorsa gelen kutunuzu kontrol edin.");return;}
  const {error}=await s.auth.signInWithPassword({email,password});if(error)return setMsg(error.message);router.push("/");router.refresh();
 }
 return <div style={{minHeight:"100vh",display:"grid",placeItems:"center",background:"#080d0b",color:"white",fontFamily:"Arial"}}>
 <form onSubmit={submit} style={{width:360,maxWidth:"90vw",padding:30,border:"1px solid #203027",borderRadius:16,background:"#0e1512"}}>
 <h1 style={{color:"#49ad60"}}>DISPFICS</h1><p>{mode==="login"?"Kulüp hesabınıza giriş yapın.":"Yeni kulüp hesabınızı oluşturun."}</p>
 <input required value={email} onChange={e=>setEmail(e.target.value)} placeholder="E-posta" type="email" style={input}/>
 <input required minLength={6} value={password} onChange={e=>setPassword(e.target.value)} placeholder="Şifre" type="password" style={input}/>
 <button style={{width:"100%",padding:12,marginTop:10,background:"#2e9d4b",color:"white",border:0,borderRadius:8}}>{mode==="login"?"Giriş Yap":"Kayıt Ol"}</button>
 <button type="button" onClick={()=>{setMode(mode==="login"?"signup":"login");setMsg("")}} style={{width:"100%",padding:10,marginTop:8,background:"transparent",color:"#9bcba7",border:"1px solid #294032",borderRadius:8}}>{mode==="login"?"Hesap oluştur":"Girişe dön"}</button>
 <p style={{fontSize:12,color:"#aab7af"}}>{msg}</p></form></div>
}
const input={width:"100%",boxSizing:"border-box" as const,padding:12,margin:"8px 0",background:"#080d0b",color:"white",border:"1px solid #294032",borderRadius:8};
