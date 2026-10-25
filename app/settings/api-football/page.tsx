"use client";
import {useState} from "react";
import {createClient} from "../../../lib/supabase";
import AppShell from "../../components/AppShell";

export default function FootballImportPage(){
 const [loading,setLoading]=useState(false);
 const [result,setResult]=useState<any>(null);
 const [error,setError]=useState("");
 async function run(){
  setLoading(true);setError("");setResult(null);
  try{
   const supabase=createClient();
   const {data:{session}}=await supabase.auth.getSession();
   if(!session)throw new Error("Önce yetkili hesabınla giriş yapmalısın.");
   const response=await fetch("/api/football-match-report",{headers:{Authorization:"Bearer "+session.access_token},cache:"no-store"});
   const json=await response.json();
   if(!response.ok)throw new Error(json.error||"API raporu çalıştırılamadı.");
   setResult(json);
  }catch(e){setError(e instanceof Error?e.message:"Bilinmeyen hata")}finally{setLoading(false)}
 }
 return <AppShell title="API-Football Pilot"><div style={{maxWidth:900,display:"grid",gap:20}}>
  <section className="clubSquadPanel" style={{padding:24}}>
   <h2>Takım Eşleştirme Pilotu</h2>
   <p>Süper Lig, Premier League, La Liga, Bundesliga ve Serie A (2025 sezonu). Yalnızca API-Football tablolarına kayıt yapılır; mevcut scouting verileri değiştirilmez. Sadece yetkili hesap çalıştırabilir.</p>
   <button className="playerBack" type="button" disabled={loading} onClick={run}>{loading?"API verileri alınıyor…":"Pilotu çalıştır"}</button>
   {error&&<p role="alert" style={{color:"#ffaaa5"}}>{error}</p>}
  </section>
  {result&&<section className="clubSquadPanel" style={{padding:24}}>
   <h2>Eşleştirme Raporu</h2>
   <p>Mevcut takım kataloğu: {result.existingTeams}</p>
   {(result.report||[]).map((r:any)=><div key={r.apiLeagueId||r.league} style={{borderTop:"1px solid #294032",padding:"16px 0"}}>
    <h3>{r.league}</h3>{r.error?<p role="alert">{r.error}</p>:<><p>API takımı: {r.apiTeams} · Kesin isim eşleşmesi: {r.exactNameMatches} · Belirsiz: {r.ambiguous?.length||0} · Eşleşmeyen: {r.unmatched?.length||0} · Kaydedilen: {r.saved||0}</p>
    {!!r.unmatched?.length&&<details><summary>Eşleşmeyen takımlar</summary><p>{r.unmatched.join(", ")}</p></details>}
    {!!r.ambiguous?.length&&<details><summary>Belirsiz eşleşmeler</summary><p>{r.ambiguous.join(", ")}</p></details>}</>}
   </div>)}
  </section>}
 </div></AppShell>
}
