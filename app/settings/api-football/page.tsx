"use client";
import {useState} from "react";
import {createClient} from "../../../lib/supabase";
import AppShell from "../../components/AppShell";

export default function FootballImportPage(){
 const [loading,setLoading]=useState(false);
 const [result,setResult]=useState<any>(null);
 const [error,setError]=useState("");
 const [footballData,setFootballData]=useState<any>(null);
 async function importMatches(){
  setLoading(true);setError("");
  try{const {data:{session}}=await createClient().auth.getSession();if(!session)throw new Error("Önce giriş yapmalısın.");const response=await fetch("/api/football-data-import",{headers:{Authorization:"Bearer "+session.access_token}});const json=await response.json();if(!response.ok)throw new Error(json.error||"Aktarım başarısız");setFootballData(json)}catch(e){setError(e instanceof Error?e.message:"Bilinmeyen hata")}finally{setLoading(false)}
 }
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
   <p>Süper Lig, Premier League, La Liga, Bundesliga ve Serie A (2026–2027 sezonu). Yalnızca API-Football tablolarına kayıt yapılır; mevcut scouting verileri değiştirilmez. Sadece yetkili hesap çalıştırabilir.</p>
   <button className="playerBack" type="button" disabled={loading} onClick={run}>{loading?"API verileri alınıyor…":"Pilotu çalıştır"}</button>
   <button className="playerBack" type="button" disabled={loading} onClick={importMatches} style={{marginLeft:12}}>{loading?"Veriler alınıyor…":"Fikstür ve puan durumunu aktar"}</button>
   {footballData&&<div><h3>Fikstür ve Puan Durumu Aktarımı</h3>{footballData.results?.map((r:any)=><p key={r.league}>Lig {r.league}: {r.fixtures} maç, {r.standings} puan durumu kaydı {r.fixturesError||r.standingsError?"· Hata: "+[r.fixturesError,r.standingsError].filter(Boolean).join(", "):""}</p>)}</div>}
   {error&&<p role="alert" style={{color:"#ffaaa5"}}>{error}</p>}
  </section>
  {result&&<section className="clubSquadPanel" style={{padding:24}}>
   <h2>Eşleştirme Raporu</h2>
   <p>Mevcut takım kataloğu: {result.existingTeams}</p>
   {(result.report||[]).map((r:any)=><div key={r.apiLeagueId||r.league} style={{borderTop:"1px solid #294032",padding:"16px 0"}}>
    <h3>{r.league}</h3>{r.error?<p role="alert">{r.error}</p>:<><p>API takımı: {r.apiTeams} · Onaylı eşleşme: {r.confirmedMatches} · Takma ad eşleşmesi: {r.aliasMatches||0} · İncelenecek: {r.ambiguous?.length||0} · Eşleşmeyen: {r.unmatched?.length||0} · Kaydedilen: {r.saved||0}</p>
    {!!r.unmatched?.length&&<details><summary>Eşleşmeyen takımlar</summary><p>{r.unmatched.join(", ")}</p></details>}
    {!!r.ambiguous?.length&&<details><summary>Belirsiz eşleşmeler</summary><p>{r.ambiguous.join(", ")}</p></details>}</>}
   </div>)}
  </section>}
 </div></AppShell>
}
