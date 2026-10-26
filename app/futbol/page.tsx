import Link from "next/link";
import {footballDb,leagueName,dateLabel} from "../../lib/football-center";
import styles from "./style.module.css";
export const dynamic="force-dynamic";
export const metadata={title:"Futbol Merkezi | YanımdaFutbol"};
export default async function FootballCenter({searchParams}:{searchParams:Promise<{q?:string;league?:string}>}){
 const params=await searchParams;const db=footballDb();const q=(params.q||"").trim().slice(0,60);const league=Number(params.league||0);
 let teamsQuery=db.from("api_football_teams").select("api_team_id,name,country,logo,league_id").order("name").limit(48);
 if(q)teamsQuery=teamsQuery.ilike("name","%"+q.replace(/[%_,]/g,"")+"%");
 if(league)teamsQuery=teamsQuery.eq("league_id",league);
 const [teamsResult,fixtureResult,standingsResult]=await Promise.all([
  teamsQuery,
  db.from("api_football_fixtures").select("fixture_id,league_id,kickoff,status,home_team_id,away_team_id,home_goals,away_goals,raw").order("kickoff",{ascending:false}).limit(80),
  db.from("api_football_standings").select("league_id,season,team_id,rank,points,played,goal_difference,raw").order("rank").limit(200)
 ]);
 const teams=teamsResult.data||[];const fixtures=(fixtureResult.data||[]).filter(f=>!league||f.league_id===league).slice(0,30);
 const standings=(standingsResult.data||[]).filter(s=>!league||s.league_id===league).slice(0,12);
 const ids=Array.from(new Set([...fixtures.flatMap(f=>[f.home_team_id,f.away_team_id]),...standings.map(s=>s.team_id)]));
 const {data:names}=ids.length?await db.from("api_football_teams").select("api_team_id,name").in("api_team_id",ids.slice(0,200)): {data:[] as any[]};
 const nameMap=new Map((names||[]).map(t=>[t.api_team_id,t.name]));
 return <main className={styles.root}><div className={styles.container}>
  <header className={styles.header}><Link href="/" className={styles.back}>← YanımdaFutbol</Link><span className={styles.kicker}>MAÇLAR · LİGLER · KULÜPLER</span><h1>Futbol <em>Merkezi</em></h1><p>Maç sonuçları, lig tabloları ve dünyanın dört bir yanından kulüpler.</p></header>
  <form className={styles.search} action="/futbol"><input name="q" defaultValue={q} placeholder="Takım ara…" aria-label="Takım ara"/><button type="submit">Ara</button></form>
  <nav className={styles.leagues}><Link href="/futbol" className={!league?styles.active:""}>Tüm ligler</Link>{Object.entries({203:"Süper Lig",39:"Premier League",140:"La Liga",78:"Bundesliga",135:"Serie A",61:"Ligue 1",253:"MLS"}).map(([id,name])=><Link key={id} href={"/futbol?league="+id} className={league===Number(id)?styles.active:""}>{name}</Link>)}</nav>
  <div className={styles.columns}><section><div className={styles.sectionHead}><h2>Son maçlar</h2><span>Veritabanındaki sonuçlar</span></div><div className={styles.panel}>{fixtures.length?fixtures.map(f=><Link className={styles.match} key={f.fixture_id} href={"/futbol/mac/"+f.fixture_id}><div className={styles.matchMeta}><span>{leagueName(f.league_id)}</span><span>{dateLabel(f.kickoff)}</span></div><div className={styles.matchTeams}><span>{nameMap.get(f.home_team_id)||f.raw?.teams?.home?.name||"Ev sahibi"}</span><strong>{f.home_goals??"–"} : {f.away_goals??"–"}</strong><span>{nameMap.get(f.away_team_id)||f.raw?.teams?.away?.name||"Deplasman"}</span></div><small>{f.status||"—"}</small></Link>):<p className={styles.empty}>Bu lig için henüz maç kaydı yok.</p>}</div></section>
  <aside><div className={styles.sectionHead}><h2>Puan durumu</h2><span>Sezon verileri</span></div><div className={styles.panel}><div className={styles.tableHead}><span>Takım</span><span>O</span><span>P</span></div>{standings.length?standings.map(s=><Link href={"/futbol/takim/"+s.team_id} className={styles.tableRow} key={s.league_id+"-"+s.season+"-"+s.team_id}><span>{s.rank}. {nameMap.get(s.team_id)||s.raw?.team?.name||"Takım"} <small>· {leagueName(s.league_id)}</small></span><span>{s.played}</span><strong>{s.points}</strong></Link>):<p className={styles.empty}>Puan durumu henüz mevcut değil.</p>}</div></aside></div>
  <section><div className={styles.sectionHead}><h2>Kulüpler</h2><span>{q?"Arama sonuçları":"Kulüp keşfi"}</span></div><div className={styles.clubGrid}>{teams.length?teams.map(t=><Link key={t.api_team_id} href={"/futbol/takim/"+t.api_team_id} className={styles.club}><div className={styles.logo}>{t.logo?<img src={t.logo} alt="" loading="lazy"/>:"⚽"}</div><strong>{t.name}</strong><small>{t.country||leagueName(t.league_id)}</small></Link>):<p className={styles.empty}>Aradığın takım bulunamadı.</p>}</div></section>
  <footer className={styles.footer}>Veriler API-Football kayıtlarından gösterilir. Scouting oyuncu bilgileri değiştirilmez.</footer>
 </div></main>
}
