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
 const [teamComparison,setTeamComparison]=useState<any>(null);
 const [remainingReport,setRemainingReport]=useState<any>(null);
 const [teamImport,setTeamImport]=useState<any>(null);
 const [teamImportPage,setTeamImportPage]=useState(0);
 const [squadCompletion,setSquadCompletion]=useState<any>(null);
 async function completeSquads(){
  setLoading(true);setError("");
  try{
   const {data:{session}}=await createClient().auth.getSession();
   if(!session)throw new Error("Önce yetkili hesabınla giriş yapmalısın.");
   const response=await fetch("/api/football-squad-completion",{headers:{Authorization:"Bearer "+session.access_token},cache:"no-store"});
   const json=await response.json();
   if(!response.ok)throw new Error(json.error||"Eksik kadrolar alınamadı");
   setSquadCompletion(json);
  }catch(e){setError(e instanceof Error?e.message:"Bilinmeyen hata")}finally{setLoading(false)}
 }
 async function importTeamData(){
  setLoading(true);setError("");
  try{
   const {data:{session}}=await createClient().auth.getSession();
   if(!session)throw new Error("Önce yetkili hesabınla giriş yapmalısın.");
   const response=await fetch("/api/football-team-data-import?page="+teamImportPage,{headers:{Authorization:"Bearer "+session.access_token},cache:"no-store"});
   const json=await response.json();
   if(!response.ok)throw new Error(json.error||"Takım verileri alınamadı");
   setTeamImport(json);
   if(json.nextPage!==null)setTeamImportPage(json.nextPage);
  }catch(e){setError(e instanceof Error?e.message:"Bilinmeyen hata")}finally{setLoading(false)}
 }
 async function importCatolica(){
  setLoading(true);setError("");
  try{
   const {data:{session}}=await createClient().auth.getSession();
   if(!session)throw new Error("Önce yetkili hesabınla giriş yapmalısın.");
   const response=await fetch("/api/football-team-data-import?team=2994",{headers:{Authorization:"Bearer "+session.access_token},cache:"no-store"});
   const json=await response.json();
   if(!response.ok)throw new Error(json.error||"Católica kadrosu alınamadı");
   setTeamImport(json);
  }catch(e){setError(e instanceof Error?e.message:"Bilinmeyen hata")}finally{setLoading(false)}
 }
 async function scanRemaining(batch:number){
  setLoading(true);setError("");
  try{const {data:{session}}=await createClient().auth.getSession();if(!session)throw new Error("Önce giriş yapmalısın.");const response=await fetch("/api/football-remaining-teams?batch="+batch,{headers:{Authorization:"Bearer "+session.access_token},cache:"no-store"});const json=await response.json();if(!response.ok)throw new Error(json.error||"Kalan takım taraması başarısız");setRemainingReport(json)}catch(e){setError(e instanceof Error?e.message:"Bilinmeyen hata")}finally{setLoading(false)}
 }

 async function confirmRemaining(name:string,league:string,apiId:number,batch:number){
  if(!window.confirm(name+" için API-Football #"+apiId+" kimliğini doğrulayıp kaydetmek istiyor musun?"))return;
  setLoading(true);setError("");
  try{
   const {data:{session}}=await createClient().auth.getSession();
   if(!session)throw new Error("Önce giriş yapmalısın.");
   const res=await fetch("/api/football-remaining-teams",{method:"POST",headers:{Authorization:"Bearer "+session.access_token,"Content-Type":"application/json"},body:JSON.stringify({name,league,apiId})});
   const json=await res.json();
   if(!res.ok)throw new Error(json.error||"Eşleştirme kaydedilemedi");
   const refreshed=await fetch("/api/football-remaining-teams?batch="+batch,{headers:{Authorization:"Bearer "+session.access_token},cache:"no-store"});
   const report=await refreshed.json();
   if(refreshed.ok)setRemainingReport(report);
   else setRemainingReport(null);
  }catch(e){setError(e instanceof Error?e.message:"Bilinmeyen hata")}finally{setLoading(false)}
 }
 async function compareTeams(batch:number,persist=false){
  setLoading(true);setError("");
  try{const {data:{session}}=await createClient().auth.getSession();if(!session)throw new Error("Önce giriş yapmalısın.");const response=await fetch("/api/football-league-discovery?teamBatch="+batch,{method:persist?"POST":"GET",headers:{Authorization:"Bearer "+session.access_token},cache:"no-store"});const json=await response.json();if(!response.ok)throw new Error(json.error||"Takım karşılaştırması başarısız");setTeamComparison(json)}catch(e){setError(e instanceof Error?e.message:"Bilinmeyen hata")}finally{setLoading(false)}
 }
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
   <div style={{marginTop:16,padding:14,border:"1px solid #7775",borderRadius:8}}>
    <strong>Eşleşmiş takımların API verilerini aktar</strong>
    <p>Yalnızca eşleşmiş takımlar: takım bilgisi, kadro ve mevcut sezon takım istatistikleri. Scouting oyuncu verileri değişmez. Her tıklamada 10 takım işlenir.</p>
    <button className="playerBack" type="button" disabled={loading} onClick={()=>importTeamData()}>{loading?"Veriler alınıyor…":"Sonraki 10 takımın verilerini getir"}</button>
    <button className="playerBack" type="button" disabled={loading} onClick={importCatolica} style={{marginLeft:10}}>Universidad Católica (#2994) kadrosunu getir</button>
    <div style={{marginTop:12}}>
     <button className="playerBack" type="button" disabled={loading} onClick={completeSquads}>20 oyuncuda kalan 5 takımın kadrosunu tamamla</button>
     {squadCompletion&&<p>Bekleyen: {squadCompletion.remaining_estimate} · İşlenen: {squadCompletion.processed} · Başarılı: {squadCompletion.results.filter((r:any)=>r.status==="updated").length}</p>}
     {squadCompletion&&<details><summary>Kadro tamamlama sonuçları</summary><pre style={{whiteSpace:"pre-wrap",fontSize:12}}>{JSON.stringify(squadCompletion.results,null,2)}</pre></details>}
    </div>
    {teamImport&&<p>İşlenen sayfa: {teamImport.page+1} · Takım: {teamImport.processed} · Sonraki sayfa: {teamImport.nextPage===null?"Bitti":teamImport.nextPage+1} · Hata: {teamImport.results.reduce((n:number,r:any)=>n+r.errors.length,0)}</p>}
    {teamImport&&<details><summary>Takım bazında sonuçlar</summary><pre style={{whiteSpace:"pre-wrap",fontSize:12}}>{JSON.stringify(teamImport.results,null,2)}</pre></details>}
   </div>
   <button className="playerBack" type="button" disabled={loading} onClick={()=>runAudit()} style={{marginTop:12}}>15 ligin veri durumunu denetle</button>
   <button className="playerBack" type="button" disabled={loading} onClick={()=>discoverLeagues()} style={{marginTop:12,marginLeft:10}}>Kalan 34 ligi API-Football'da tara</button>
   {discovery&&<div><p>Tek aday bulunan liglerde takım adlarını güvenli biçimde karşılaştır:</p><div style={{display:"flex",gap:8,flexWrap:"wrap"}}>{[0,1,2,3,4].map(n=><button key={n} className="playerBack" type="button" disabled={loading} onClick={()=>compareTeams(n)}>Takım taraması {n+1}/5</button>)}</div><div style={{display:"flex",gap:8,flexWrap:"wrap",marginTop:12}}>{[0,1,2,3,4].map(n=><button key={n} className="playerBack" type="button" disabled={loading} onClick={()=>compareTeams(n,true)}>Kesin ve doğrulanmış adları kaydet · Grup {n+1}/5</button>)}</div></div>}
   <div style={{marginTop:16}}><h3>Kalan EA takımlarını araştır</h3><p>API-Football kimlik adaylarını gösterir; doğrulanmadan hiçbir scouting eşleştirmesi kaydetmez.</p><div style={{display:"flex",gap:8,flexWrap:"wrap"}}>{Array.from({length:remainingReport?.batches||16},(_,n)=><button key={n} className="playerBack" type="button" disabled={loading} onClick={()=>scanRemaining(n)}>Kalan takım taraması {n+1}</button>)}</div>{remainingReport&&<div><p>Toplam açık: {remainingReport.total} · Grup {remainingReport.batch+1}/{remainingReport.batches}</p>{remainingReport.reports?.map((r:any)=><details key={r.league+"-"+r.name}><summary>{r.league} — {r.name} · {r.status==="exact_candidate"?"Kesin isim adayı":r.status==="error"?"API hatası":r.name==="Audax Italiano"&&!r.candidates?.length?"API-Football kaydı bulunamadı":"Kimlik incelemesi gerekli"}</summary>{r.error&&<p role="alert">{r.error}</p>}{r.diagnostics?.map((message:string,i:number)=><p key={i} style={{fontSize:13,opacity:.85}}>{message}</p>)}{!r.error&&!r.candidates?.length&&<p>{r.name==="Audax Italiano"?"API-Football kayıtlarında Audax Italiano için doğrulanabilir kimlik bulunamadı. Veri sağlayıcısına eksik kulüp bildirimi yapılmalı; doğru API kimliği gelene kadar eşleştirme açık kalır.":"Doğrulanabilir takım adayı bulunamadı. Yukarıdaki sorgu sonuçlarını kontrol edin."}</p>}{r.candidates?.map((x:any)=><p key={x.apiId}>{x.apiName} · {x.country} · API #{x.apiId} <button className="playerBack" type="button" disabled={loading} onClick={()=>confirmRemaining(r.name,r.league,x.apiId,remainingReport.batch)}>Kimliği doğrula ve eşleştir</button></p>)}</details>)}</div>}</div>
   {teamComparison&&<div><h3>Takım Karşılaştırması · Grup {teamComparison.batch+1}</h3><p>Tam ad eşleşmeleri karşılaştırılır. Kaydet düğmesi kullanıldıysa yalnızca güvenli eşleşmeler API tablolarına yazılır; scouting değişmez.</p>{teamComparison.reports?.map((r:any)=><div key={r.league}><h4>{r.league}</h4>{r.error?<p>{r.error}</p>:<><p>{r.exact}/{r.apiTeams} kesin ad eşleşmesi · {r.review} inceleme · EA kataloğunda {r.localTeams} takım · Kaydedilen: {r.saved||0}</p><details><summary>Takım detayları</summary>{r.comparisons?.map((x:any)=><p key={x.apiId}>{x.apiName} — {x.localName||"İncelenecek"}</p>)}</details></>}</div>)}</div>}
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
