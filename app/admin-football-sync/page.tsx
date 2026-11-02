"use client";
import {useState} from "react";
import AppShell from "../components/AppShell";
import {createClient} from "../../lib/supabase";

type Audit={league:number;teams?:number;matched?:number;unresolved?:number;fixtures?:number;standings?:number;error?:string};
type SyncResult={league:number;fixtures:number;standings:number;fixturesError?:string;standingsError?:string};

export default function AdminFootballSync(){
 const [busy,setBusy]=useState(false),[message,setMessage]=useState(""),[audits,setAudits]=useState<Audit[]>([]),[results,setResults]=useState<SyncResult[]>([]);
 const [batch,setBatch]=useState("main");
 async function request(audit:boolean){
  setBusy(true);setMessage("");if(!audit)setResults([]);
  try{
   const supabase=createClient();
   const {data:{session},error}=await supabase.auth.getSession();
   if(error||!session?.access_token)throw new Error("Önce yetkili hesabınızla giriş yapın.");
   const query=new URLSearchParams({batch});if(audit)query.set("audit","1");
   const response=await fetch("/api/football-data-import?"+query,{headers:{Authorization:"Bearer "+session.access_token},cache:"no-store"});
   const json=await response.json();
   if(!response.ok)throw new Error(json.error||"İstek başarısız ("+response.status+")");
   if(audit){setAudits(json.audits||[]);setMessage("Denetim tamamlandı.");}
   else{setResults(json.results||[]);setMessage("Güncelleme isteği tamamlandı. Hata alan ligleri aşağıda kontrol edin.");}
  }catch(e){setMessage(e instanceof Error?e.message:"Bilinmeyen hata");}
  finally{setBusy(false)}
 }
 return <AppShell title="Futbol Verisi Yönetimi"><section style={{maxWidth:950,display:"grid",gap:20}}>
 <div className="panel"><h2>2026 sezonu veri güncellemesi</h2><p>API-Football üzerinden fikstürleri ve puan durumlarını günceller. Bu işlem yalnızca yetkili hesapla çalışır. Oyuncu kayıtlarını silmez.</p>
 <label htmlFor="sync-batch" style={{display:"block",marginBottom:8}}>Lig grubu</label>
 <select id="sync-batch" value={batch} onChange={e=>setBatch(e.target.value)} disabled={busy} style={{padding:12,borderRadius:8,background:"#14251a",color:"white",border:"1px solid #406b4d",maxWidth:"100%"}}>
 <option value="main">Ana ligler (5)</option><option value="second-a">Diğer ligler A (5)</option><option value="second-b">Diğer ligler B (5)</option>
 </select>
 <div style={{display:"flex",gap:12,flexWrap:"wrap",marginTop:16}}>
 <button type="button" disabled={busy} onClick={()=>request(true)}>{busy?"İşleniyor…":"Verileri denetle"}</button>
 <button type="button" disabled={busy} onClick={()=>{if(window.confirm("Seçili lig grubunun 2026 fikstür ve puan durumu verileri API-Football'dan güncellensin mi?"))void request(false)}}>{busy?"İşleniyor…":"Seçili grubu güncelle"}</button>
 </div>{message&&<p role="status" style={{marginTop:12}}>{message}</p>}</div>
 {audits.length>0&&<div className="panel"><h3>Lig denetimi</h3><div style={{overflowX:"auto"}}><table style={{width:"100%",textAlign:"left",borderSpacing:"12px 10px"}}><thead><tr><th>Lig ID</th><th>Takım</th><th>Eşleşmeyen</th><th>Fikstür</th><th>Puan durumu</th></tr></thead><tbody>{audits.map(a=><tr key={a.league}><td>{a.league}</td><td>{a.teams??"—"}</td><td>{a.unresolved??"—"}</td><td>{a.fixtures??"—"}</td><td>{a.standings??"—"}{a.error&&<small style={{display:"block",color:"#ffb4a8"}}>{a.error}</small>}</td></tr>)}</tbody></table></div></div>}
 {results.length>0&&<div className="panel"><h3>Güncelleme sonuçları</h3><div style={{overflowX:"auto"}}><table style={{width:"100%",textAlign:"left",borderSpacing:"12px 10px"}}><thead><tr><th>Lig ID</th><th>Fikstür</th><th>Puan durumu</th><th>Durum</th></tr></thead><tbody>{results.map(r=><tr key={r.league}><td>{r.league}</td><td>{r.fixtures}</td><td>{r.standings}</td><td>{r.fixturesError||r.standingsError?<span style={{color:"#ffb4a8"}}>{[r.fixturesError,r.standingsError].filter(Boolean).join("; ")}</span>:"Başarılı"}</td></tr>)}</tbody></table></div></div>}
 </section></AppShell>
}
