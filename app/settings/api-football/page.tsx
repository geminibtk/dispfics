"use client";
import {useState} from "react";
import {createClient} from "../../../lib/supabase";
import AppShell from "../../components/AppShell";

export default function FootballImportPage(){
 const [loading,setLoading]=useState(false);
 const [result,setResult]=useState<any>(null);
 const [error,setError]=useState("");
 const [footballData,setFootballData]=useState<any>(null);
 const [audit,setAudit]=useState<any>(null);
 const [discovery,setDiscovery]=useState<any>(null);
 async function discoverLeagues(){
  setLoading(true);setError("");
  try{const {data:{session}}=await createClient().auth.getSession();if(!session)throw new Error("Önce giriş yapmalısın.");const response=await fetch("/api/football-league-discovery",{headers:{Authorization:"Bearer "+session.access_token},cache:"no-store"});const json=await response.json();if(!response.ok)throw new Error(json.error||"Lig taraması başarısız");setDiscovery(json)}catch(e){setError(e instanceof Error?e.message:"Bilinmeyen hata")}finally{setLoading(false)}
 }
 async function runAudit(){
  setLoading(true);setError("");
  try{const {data:{session}}=await createClient().auth.getSession();if(!session)throw new Error("Önce giriş yapmalısın.");const response=await fetch("/api/football-data-import?audit=1",{headers:{Authorization:"Bearer "+session.access_token},cache:"no-store"});const json=await response.json();if(!response.ok)throw new Error(json.error||"Denetim başarısız");setAudit(json)}catch(e){setError(e instanceof Error?e.message:"Bilinmeyen hata")}finally{setLoading(false)}
 }
 async function importMatches(batch=""){
  setLoading(true);setError("");
  try{const {data:{session}}=await createClient().auth.getSession();if(!session)throw new Error("Önce giriş yapmalısın.");const response=await fetch("/api/football-data-import"+(batch?"?batch="+batch:""),{headers:{Authorization:"Bearer "+session.access_token}});const json=await response.json();if(!response.ok)throw new Error(json.error||"Aktarım başarısız");setFootballData(json);setAudit(null)}catch(e){setError(e instanceof Error?e.message:"Bilinmeyen hata")}finally{setLoading(false)}
 }
 async function run(batch=""){
  setLoading(true);setError("");setResult(null);
  try{
   const supabase=createClient();
   const {data:{session}}=await supabase.auth.getSession();
   if(!session)throw new Error("Önce yetkili hesabınla giriş yapmalısın.");
   const response=await fetch("/api/football-match-report"+(batch?"?batch="+batch:""),{headers:{Authorization:"Bearer "+session.access_token},cache:"no-store"});
   const json=await response.json();
   if(!response.ok)throw new Error(json.error||"API raporu çalıştırılamadı.");
   setResult(json);
  }catch(e){setError(e instanceof Error?e.message:"Bilinmeyen hata")}finally{setLoading(false)}
 }
 return <AppShell title="API-Football Pilot"><div style={{maxWidth:900,display:"grid",gap:20}}>
  <section className="clubSquadPanel" style={{padding:24}}>
   <h2>Takım Eşleştirme Pilotu</h2>
   <p>Süper Lig, Premier League, La Liga, Bundesliga ve Serie A (2026–2027 sezonu). Yalnızca API-Football tablolarına kayıt yapılır; mevcut scouting verileri değiştirilmez. Sadece yetkili hesap çalıştırabilir.</p>
   <button className="playerBack" type="button" disabled={loading} onClick={()=>run()}>{loading?"API verileri alınıyor…":"Pilotu çalıştır"}</button>
   <div style={{display:"flex",flexWrap:"wrap",gap:10,marginTop:12}}><button className="playerBack" type="button" disabled={loading} onClick={()=>run("second-a")}>2. Pilot: İlk 5 lig</button><button className="playerBack" type="button" disabled={loading} onClick={()=>run("second-b")}>2. Pilot: Son 5 lig</button></div>
   <p style={{fontSize:13,opacity:.8}}>İkinci pilot: Eredivisie, Ligue 1, Liga Portugal, Championship, Bundesliga 2, Serie B, MLS, Suudi Arabistan, İskoçya ve Belçika. Eşleşmeyen API takımları scouting profiline yönlendirilmez.</p>
   <button className="playerBack" type="button" disabled={loading} onClick={()=>importMatches()} style={{marginLeft:12}}>{loading?"Veriler alınıyor…":"Fikstür ve puan durumunu aktar"}</button>
   <div style={{display:"flex",flexWrap:"wrap",gap:10,marginTop:12}}><button className="playerBack" type="button" disabled={loading} onClick={()=>importMatches("second-a")}>İlk 5 yeni lig: Fikstür ve puan durumu</button><button className="playerBack" type="button" disabled={loading} onClick={()=>importMatches("second-b")}>Son 5 yeni lig: Fikstür ve puan durumu</button></div>
   <button className="playerBack" type="button" disabled={loading} onClick={()=>runAudit()} style={{marginTop:12}}>15 ligin veri durumunu denetle</button>
   <button className="playerBack" type="button" disabled={loading} onClick={()=>discoverLeagues()} style={{marginTop:12,marginLeft:10}}>Kalan 34 ligi API-Football'da tara</button>
   {discovery&&<div><h3>Kalan {discovery.remaining} Lig: API Karşılıkları (2026)</h3><p>Bu tarama yalnızca aday ligleri gösterir. Takım eşleştirmesi veya scouting verisi değiştirmez.</p>{discovery.results?.map((r:any)=><p key={r.league}><strong>{r.league}</strong>: {r.status==="not_found"?"API lig adı bulunamadı":r.status==="review"?"Birden çok aday; inceleme gerekli":"Aday bulundu"} {r.candidates?.map((x:any)=>`${x.name} (#${x.id}, ${x.country})`).join(" · ")}</p>)}</div>}
   {audit&&<div><h3>Lig Bazlı Veri Denetimi (2026)</h3><p>Bu denetim yalnızca veritabanındaki kayıtları sayar; API verisinin doğruluğunu tek başına garanti etmez.</p>{audit.audits?.map((r:any)=><p key={r.league}>Lig {r.league}: {r.error?"Hata: "+r.error:`${r.matched}/${r.teams} eşleşme · ${r.unresolved} açık · ${r.fixtures} fikstür · ${r.standings} puan kaydı`}</p>)}</div>}
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
