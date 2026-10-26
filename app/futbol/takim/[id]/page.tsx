import Link from "next/link";
import {notFound} from "next/navigation";
import {footballDb,leagueName,dateLabel} from "../../../../lib/football-center";
import styles from "../../style.module.css";
export const dynamic="force-dynamic";
export default async function TeamPage({params}:{params:Promise<{id:string}>}){
 const {id}=await params;const teamId=Number(id);if(!Number.isSafeInteger(teamId)||teamId<=0)notFound();
 const db=footballDb();const [{data:team},{data:snapshots},{data:fixtures},{data:standings}]=await Promise.all([
 db.from("api_football_teams").select("api_team_id,name,country,logo,league_id").eq("api_team_id",teamId).maybeSingle(),
 db.from("api_football_team_data").select("data_type,payload,season,fetched_at").eq("api_team_id",teamId),
 db.from("api_football_fixtures").select("fixture_id,kickoff,status,home_team_id,away_team_id,home_goals,away_goals,raw").or("home_team_id.eq."+teamId+",away_team_id.eq."+teamId).order("kickoff",{ascending:false}).limit(20),
 db.from("api_football_standings").select("league_id,season,rank,points,played,wins,draws,losses").eq("team_id",teamId).limit(5)
 ]);if(!team)notFound();
 const squad=(snapshots||[]).find(x=>x.data_type==="squad")?.payload;
 const players=Array.isArray(squad)?squad.flatMap((s:any)=>s.players||[]):[];
 const stats=(snapshots||[]).find(x=>x.data_type==="statistics")?.payload;
 return <main className={styles.root}><div className={styles.container}><Link className={styles.back} href="/futbol">← Futbol Merkezi</Link><header className={styles.header}><div style={{display:"flex",alignItems:"center",gap:20}}>{team.logo&&<img src={team.logo} width="88" height="88" style={{objectFit:"contain"}} alt=""/>}<div><span className={styles.kicker}>{team.country||"Kulüp"} · {leagueName(team.league_id)}</span><h1 style={{fontSize:44}}>{team.name}</h1></div></div></header>
 <div className={styles.columns}><section><div className={styles.sectionHead}><h2>Maçlar ve sonuçlar</h2></div><div className={styles.panel}>{fixtures?.length?fixtures.map(f=><Link className={styles.match} href={"/futbol/mac/"+f.fixture_id} key={f.fixture_id}><div className={styles.matchMeta}>{dateLabel(f.kickoff)} · {f.status}</div><div className={styles.matchTeams}><span>{f.raw?.teams?.home?.name||"Ev sahibi"}</span><strong>{f.home_goals??"–"} : {f.away_goals??"–"}</strong><span>{f.raw?.teams?.away?.name||"Deplasman"}</span></div></Link>):<p className={styles.empty}>Bu takım için henüz maç kaydı yok.</p>}</div></section>
 <aside><div className={styles.sectionHead}><h2>Sezon performansı</h2></div><div className={styles.panel}>{standings?.length?standings.map(s=><div className={styles.match} key={s.league_id+"-"+s.season}><strong>{leagueName(s.league_id)} · {s.season}</strong><p>Sıra: {s.rank} · Puan: {s.points} · Maç: {s.played}</p><small>G {s.wins} · B {s.draws} · M {s.losses}</small></div>):<p className={styles.empty}>Puan durumu henüz yok.</p>}{stats&&<div className={styles.match}><strong>Takım istatistikleri</strong><p>Maç: {stats.fixtures?.played?.total??"—"} · Galibiyet: {stats.fixtures?.wins?.total??"—"}</p><p>Atılan gol: {stats.goals?.for?.total?.total??"—"}</p></div>}</div></aside></div>
 <section><div className={styles.sectionHead}><h2>Kadro</h2><span>API-Football</span></div>{players.length?<div className={styles.clubGrid}>{players.map((p:any)=><div className={styles.club} key={p.id||p.name}><div className={styles.logo}>{p.photo?<img src={p.photo} alt=""/>:"⚽"}</div><strong>{p.name}</strong><small>{p.position||"Oyuncu"} · #{p.number??"—"}</small></div>)}</div>:<div className={styles.panel}><p className={styles.empty}>Bu takımın API kadrosu henüz aktarılmadı. Mevcut scouting oyuncu verileri korunuyor.</p></div>}</section>
 </div></main>
}
