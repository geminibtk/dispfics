import Link from "next/link";
import AppShell from "../../../components/AppShell";
import {notFound} from "next/navigation";
import {footballDb,leagueName,dateLabel} from "../../../../lib/football-center";
import styles from "../../style.module.css";
export const dynamic="force-dynamic";
export default async function MatchPage({params}:{params:Promise<{id:string}>}){
 const {id}=await params;const fixtureId=Number(id);if(!Number.isSafeInteger(fixtureId)||fixtureId<=0)notFound();
 const db=footballDb();const {data:stored}=await db.from("api_football_fixtures").select("*").eq("fixture_id",fixtureId).maybeSingle();
 let f:any=stored;
 if(!f&&process.env.API_FOOTBALL_KEY){
  try{const res=await fetch("https://v3.football.api-sports.io/fixtures?id="+fixtureId,{headers:{"x-apisports-key":process.env.API_FOOTBALL_KEY},cache:"no-store",signal:AbortSignal.timeout(8000)});
  const json=await res.json();const x=json.response?.[0];
  if(res.ok&&x)f={fixture_id:x.fixture.id,league_id:x.league.id,season:x.league.season,kickoff:x.fixture.date,status:x.fixture.status.short,home_team_id:x.teams.home.id,away_team_id:x.teams.away.id,home_goals:x.goals.home,away_goals:x.goals.away,raw:x};
  }catch{}
 }
 if(!f)notFound();
 const home=f.raw?.teams?.home,away=f.raw?.teams?.away;
 return <AppShell title="Maç Detayı" hideTitle><div className={styles.root}><Link className={styles.back} href="/futbol">← Futbol Merkezi</Link><header className={styles.header}><span className={styles.kicker}>{leagueName(f.league_id)} · {f.season}</span><h1>Maç <em>Detayı</em></h1><p>{dateLabel(f.kickoff)} · {f.raw?.fixture?.venue?.name||"Stadyum bilgisi yok"} · {f.status}</p></header>
 <div className={styles.panel} style={{padding:32}}><div className={styles.matchTeams} style={{fontSize:20,textAlign:"center"}}><div>{home?.logo&&<img src={home.logo} width="64" height="64" alt=""/>}<p><Link href={"/futbol/takim/"+f.home_team_id} style={{color:"inherit"}}>{home?.name||"Ev sahibi"}</Link></p></div><strong style={{fontSize:36}}>{f.home_goals??"–"} : {f.away_goals??"–"}</strong><div>{away?.logo&&<img src={away.logo} width="64" height="64" alt=""/>}<p><Link href={"/futbol/takim/"+f.away_team_id} style={{color:"inherit"}}>{away?.name||"Deplasman"}</Link></p></div></div></div>
 <div className={styles.sectionHead}><h2>Maç bilgileri</h2></div><div className={styles.panel}><div className={styles.match}>Hakem: {f.raw?.fixture?.referee||"Bilgi yok"}</div><div className={styles.match}>Devre: {f.raw?.score?.halftime?.home??"–"} : {f.raw?.score?.halftime?.away??"–"}</div><div className={styles.match}>Durum: {f.raw?.fixture?.status?.long||f.status}</div></div>
 </div></AppShell>
}
