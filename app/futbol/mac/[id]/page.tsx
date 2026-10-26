import Link from "next/link";
import AppShell from "../../../components/AppShell";
import {notFound} from "next/navigation";
import {footballDb,leagueName,dateLabel} from "../../../../lib/football-center";
import styles from "../../style.module.css";
export const dynamic="force-dynamic";
const FINISHED=["FT","AET","PEN"];
const statusTR:Record<string,string>={NS:"Başlamadı",FT:"Maç sona erdi",AET:"Uzatmalar sonrası",PEN:"Penaltılar sonrası",HT:"Devre arası","1H":"İlk yarı","2H":"İkinci yarı",PST:"Ertelendi",CANC:"İptal edildi"};
export default async function MatchPage({params}:{params:Promise<{id:string}>}){
 const {id}=await params;const fixtureId=Number(id);if(!Number.isSafeInteger(fixtureId)||fixtureId<=0)notFound();
 const db=footballDb();
 const {data:stored}=await db.from("api_football_fixtures").select("*").eq("fixture_id",fixtureId).maybeSingle();
 let f:any=stored;let current=false;let apiError=false;
 let events:any[]=[],statistics:any[]=[],lineups:any[]=[];
 if(process.env.API_FOOTBALL_KEY){
  try{
   const res=await fetch("https://v3.football.api-sports.io/fixtures?id="+fixtureId,{headers:{"x-apisports-key":process.env.API_FOOTBALL_KEY},next:{revalidate:60},signal:AbortSignal.timeout(9000)});
   const json=await res.json();
   if(!res.ok||Object.keys(json.errors||{}).length)throw new Error("API error");
   const x=json.response?.[0];
   if(x){
    f={fixture_id:x.fixture.id,league_id:x.league.id,season:x.league.season,kickoff:x.fixture.date,status:x.fixture.status.short,home_team_id:x.teams.home.id,away_team_id:x.teams.away.id,home_goals:x.goals.home,away_goals:x.goals.away,raw:x};
    current=true;events=x.events||[];statistics=x.statistics||[];lineups=x.lineups||[];
   }else apiError=true;
  }catch{apiError=true}
 }else apiError=true;
 if(!f)notFound();
 const home=f.raw?.teams?.home,away=f.raw?.teams?.away;
 const logo=(team:any,id:number)=>team?.logo||"https://media.api-sports.io/football/teams/"+id+".png";
 const display=(v:any)=>v===null||v===undefined?"–":String(v);
 const score=f.raw?.score||{};
 return <AppShell title="Maç Detayı" hideTitle><div className={styles.root}>
 <Link className={styles.back} href="/futbol">← Futbol Merkezi</Link>
 <header className={styles.header}><span className={styles.kicker}>{leagueName(f.league_id)} · {f.season||new Date(f.kickoff).getUTCFullYear()}</span><h1>Maç <em>Detayı</em></h1><p>{dateLabel(f.kickoff)} · {f.raw?.fixture?.venue?.name||"Stadyum bilgisi yok"}</p></header>
 {!current&&<p className={styles.liveNotice} style={{padding:14,marginBottom:16}}>Güncel API verisine erişilemedi. {stored?"Son kayıtlı maç bilgileri gösteriliyor.":"Maç bilgileri doğrulanamadı."}</p>}
 <div className={styles.panel} style={{padding:28,marginBottom:18}}>
 <div className={styles.matchTeams} style={{fontSize:19,textAlign:"center",display:"flex",alignItems:"center",justifyContent:"space-around",gap:16,flexWrap:"wrap"}}>
 <div><img src={logo(home,f.home_team_id)} width="64" height="64" alt=""/><p><Link href={"/futbol/takim/"+f.home_team_id}>{home?.name||"Ev sahibi"}</Link></p></div>
 <div><strong style={{fontSize:36}}>{display(f.home_goals)} : {display(f.away_goals)}</strong><p style={{fontSize:13,color:"#8fbaa0"}}>{statusTR[f.status]||f.raw?.fixture?.status?.long||f.status}{f.raw?.fixture?.status?.elapsed?" · "+f.raw.fixture.status.elapsed+"′":""}</p></div>
 <div><img src={logo(away,f.away_team_id)} width="64" height="64" alt=""/><p><Link href={"/futbol/takim/"+f.away_team_id}>{away?.name||"Deplasman"}</Link></p></div></div></div>
 <div className={styles.sectionHead}><h2>Maç bilgileri</h2></div>
 <div className={styles.panel} style={{marginBottom:18}}>
 <div className={styles.match}>Hakem: {f.raw?.fixture?.referee||"Henüz açıklanmadı"}</div>
 <div className={styles.match}>Devre: {display(score.halftime?.home)} : {display(score.halftime?.away)}</div>
 <div className={styles.match}>Durum: {statusTR[f.status]||f.raw?.fixture?.status?.long||f.status}</div>
 </div>
 {events.length>0&&<><div className={styles.sectionHead}><h2>Maç olayları</h2></div><div className={styles.panel} style={{marginBottom:18}}>{events.map((e:any,i:number)=><div className={styles.match} key={i}><strong>{e.time?.elapsed}′{e.time?.extra?" +"+e.time.extra:""}</strong> · {e.team?.name} · {e.player?.name||"Oyuncu"} — {e.type}{e.detail?" · "+e.detail:""}</div>)}</div></>}
 {statistics.length>0&&<><div className={styles.sectionHead}><h2>Maç istatistikleri</h2></div><div className={styles.panel} style={{marginBottom:18}}>{Array.from(new Set(statistics.flatMap((t:any)=>t.statistics?.map((s:any)=>s.type)||[]))).map((type:any)=><div key={String(type)} className={styles.match} style={{display:"grid",gridTemplateColumns:"1fr 1.5fr 1fr",gap:12,textAlign:"center"}}><strong>{display(statistics[0]?.statistics?.find((s:any)=>s.type===type)?.value)}</strong><span>{String(type)}</span><strong>{display(statistics[1]?.statistics?.find((s:any)=>s.type===type)?.value)}</strong></div>)}</div></>}
 {lineups.length>0&&<><div className={styles.sectionHead}><h2>İlk 11 ve dizilişler</h2></div><div style={{display:"grid",gridTemplateColumns:"repeat(auto-fit,minmax(240px,1fr))",gap:14}}>{lineups.map((t:any)=><div key={t.team?.id} className={styles.panel} style={{padding:18}}><strong>{t.team?.name} · {t.formation||"Diziliş açıklanmadı"}</strong>{(t.startXI||[]).map((p:any)=><div key={p.player?.id} style={{padding:"7px 0",borderBottom:"1px solid #223a29",fontSize:13}}>{p.player?.number||"–"} · {p.player?.name}</div>)}</div>)}</div></>}
 {current&&!events.length&&!statistics.length&&!lineups.length&&<p style={{color:"#92aa99",fontSize:13,marginTop:18}}>{FINISHED.includes(f.status)?"API-Football bu karşılaşma için ayrıntılı olay, istatistik veya kadro verisi döndürmedi.":"Maç olayları, istatistikler ve kadrolar API-Football tarafından sağlandığında burada gösterilecek."}</p>}
 </div></AppShell>;
}
