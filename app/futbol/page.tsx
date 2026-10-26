import Link from "next/link";
import AppShell from "../components/AppShell";
import {footballDb,leagueName,dateLabel,leagueNames} from "../../lib/football-center";
import styles from "./style.module.css";
export const dynamic="force-dynamic";
export const metadata={title:"Futbol Merkezi | YanımdaFutbol"};
const FINISHED=["FT","AET","PEN"];
const TODAY=()=>new Date().toLocaleDateString("en-CA",{timeZone:"Europe/Istanbul"});
export default async function FootballCenter({searchParams}:{searchParams:Promise<{q?:string;league?:string;date?:string;tab?:string}>}){
 const params=await searchParams;const db=footballDb();
 const q=(params.q||"").trim().slice(0,70);
 const league=Number(params.league||0);
 const selectedDate=/^\d{4}-\d{2}-\d{2}$/.test(params.date||"")?params.date!:TODAY();
 const tab=params.tab==="results"?"results":params.tab==="upcoming"?"upcoming":"all";
 const from=new Date(selectedDate+"T00:00:00+03:00"),to=new Date(from.getTime()+86400000);
 const dateFilter=(from:Date,to:Date)=>db.from("api_football_fixtures").select("fixture_id,league_id,kickoff,status,home_team_id,away_team_id,home_goals,away_goals,raw").gte("kickoff",from.toISOString()).lt("kickoff",to.toISOString()).order("kickoff").limit(160);
 const [dayResult,latestResult,upcomingResult,standingsResult,teamsResult]=await Promise.all([
  league?dateFilter(from,to).eq("league_id",league):dateFilter(from,to),
  db.from("api_football_fixtures").select("fixture_id,league_id,kickoff,status,home_team_id,away_team_id,home_goals,away_goals,raw").in("status",FINISHED).order("kickoff",{ascending:false}).limit(24),
  db.from("api_football_fixtures").select("fixture_id,league_id,kickoff,status,home_team_id,away_team_id,home_goals,away_goals,raw").gte("kickoff",new Date().toISOString()).order("kickoff").limit(24),
  db.from("api_football_standings").select("league_id,season,team_id,rank,points,played,goal_difference,raw").eq("league_id",league||203).order("rank").limit(25),
  q?db.from("api_football_teams").select("api_team_id,name,country,logo,league_id").ilike("name","%"+q.replace(/[%_,]/g,"")+"%").order("name").limit(40):db.from("api_football_teams").select("api_team_id,name,country,logo,league_id").in("league_id",[203,39,140,78,135]).order("name").limit(24)
 ]);
 const day=dayResult.data||[];
 const fallback=(tab==="upcoming"?upcomingResult.data:latestResult.data)||[];
 const matches=day.length?day.filter(f=>tab==="all"||(tab==="results"?FINISHED.includes(f.status):!FINISHED.includes(f.status))):fallback.filter(f=>!league||f.league_id===league).slice(0,16);
 const standings=standingsResult.data||[];const teams=teamsResult.data||[];
 const ids=Array.from(new Set([...matches.flatMap(f=>[f.home_team_id,f.away_team_id]),...standings.map(s=>s.team_id)].filter(Boolean)));
 const {data:names}=ids.length?await db.from("api_football_teams").select("api_team_id,name,logo").in("api_team_id",ids.slice(0,200)):{data:[] as any[]};
 const nameMap=new Map((names||[]).map(t=>[t.api_team_id,t]));
 const query=(overrides:Record<string,string>)=>"/futbol?"+new URLSearchParams({...params,...overrides}).toString();
 const dayCount=day.length,finished=day.filter(f=>FINISHED.includes(f.status)).length;
 return <AppShell title="Futbol Merkezi" hideTitle><div className={styles.root}>
  <div className={styles.hero}><div><span className={styles.kicker}>YANIMDAFUTBOL · FUTBOL MERKEZİ</span><h1>Futbolun <em>nabzı.</em></h1><p>Maç takvimi, sonuçlar, lig tabloları ve kulüpler. Hepsi tek yerde.</p></div><div className={styles.heroIcon}>⚽</div></div>
  <div className={styles.metrics}><div><span>Maç takvimi</span><strong>{dayCount}</strong><small>Seçili günün kayıtları</small></div><div><span>Tamamlanan</span><strong>{finished}</strong><small>Seçili gün</small></div><div><span>Ligler</span><strong>{Object.keys(leagueNames).length}</strong><small>Veri bulunan ligler</small></div></div>
  <div className={styles.toolbar}><div className={styles.sectionTitle}><h2>Maç Merkezi</h2><span>Takvim · Sonuçlar · Fikstür</span></div><form action="/futbol" className={styles.dateForm}><input type="date" name="date" defaultValue={selectedDate} aria-label="Maç tarihi"/>{league>0&&<input type="hidden" name="league" value={league}/>}<button type="submit">Tarihe git</button></form></div>
  <div className={styles.leagueStrip}><Link className={!league?styles.selected:""} href={query({league:""})}>Tüm ligler</Link>{Object.entries(leagueNames).map(([id,name])=><Link key={id} className={league===Number(id)?styles.selected:""} href={query({league:id})}>{name}</Link>)}</div>
  <div className={styles.tabs}><Link className={tab==="all"?styles.selected:""} href={query({tab:"all"})}>Tüm maçlar</Link><Link className={tab==="results"?styles.selected:""} href={query({tab:"results"})}>Sonuçlar</Link><Link className={tab==="upcoming"?styles.selected:""} href={query({tab:"upcoming"})}>Gelecek maçlar</Link></div>
  <div className={styles.layout}><section className={styles.primary}><div className={styles.panel}><div className={styles.panelTitle}><strong>{day.length?new Intl.DateTimeFormat("tr-TR",{day:"numeric",month:"long",year:"numeric"}).format(from):"Son kayıtlı maçlar"}</strong><span>{day.length?"Seçili tarihin maçları":"Seçili tarihte kayıt yok · alternatif liste"}</span></div>{matches.length?matches.map(f=><Link className={styles.match} href={"/futbol/mac/"+f.fixture_id} key={f.fixture_id}><div className={styles.matchLeague}><span>{leagueName(f.league_id)}</span><span>{dateLabel(f.kickoff)}</span></div><div className={styles.matchLine}><div className={styles.teamName}>{nameMap.get(f.home_team_id)?.logo&&<img src={nameMap.get(f.home_team_id)?.logo} alt=""/>}<span>{nameMap.get(f.home_team_id)?.name||f.raw?.teams?.home?.name||"Ev sahibi"}</span></div><strong className={styles.score}>{f.home_goals??"–"} <span>:</span> {f.away_goals??"–"}</strong><div className={styles.teamName+" "+styles.away}><span>{nameMap.get(f.away_team_id)?.name||f.raw?.teams?.away?.name||"Deplasman"}</span>{nameMap.get(f.away_team_id)?.logo&&<img src={nameMap.get(f.away_team_id)?.logo} alt=""/>}</div></div><div className={styles.matchStatus}>{FINISHED.includes(f.status)?"Maç sonu":f.status==="NS"?"Başlamadı":f.status}</div></Link>):<div className={styles.empty}>Bu filtre için henüz maç verisi bulunmuyor.</div>}</div></section>
  <aside className={styles.secondary}><div className={styles.panel}><div className={styles.panelTitle}><strong>{leagueName(league||203)} · Puan durumu</strong><span>{standings[0]?.season||"Sezon"}</span></div><div className={styles.tableHead}><span>Takım</span><span>O</span><span>AV</span><span>P</span></div>{standings.length?standings.map(s=><Link key={s.team_id+"-"+s.season} href={"/futbol/takim/"+s.team_id} className={styles.tableRow}><span className={styles.tableTeam}><b>{s.rank}</b>{nameMap.get(s.team_id)?.logo&&<img src={nameMap.get(s.team_id)?.logo} alt=""/>}<span>{nameMap.get(s.team_id)?.name||s.raw?.team?.name||"Takım"}</span></span><span>{s.played}</span><span>{s.goal_difference}</span><strong>{s.points}</strong></Link>):<div className={styles.empty}>Bu lig için puan durumu bulunamadı.</div>}</div></aside></div>
  <div className={styles.toolbar}><div className={styles.sectionTitle}><h2>Kulüpleri keşfet</h2><span>Takım profilleri ve sezon bilgileri</span></div><form action="/futbol" className={styles.search}><input name="q" defaultValue={q} placeholder="Kulüp ara…" aria-label="Kulüp ara"/><button type="submit">Ara</button></form></div>
  <div className={styles.clubGrid}>{teams.length?teams.map(t=><Link href={"/futbol/takim/"+t.api_team_id} className={styles.clubCard} key={t.api_team_id}><div className={styles.clubLogo}>{t.logo?<img src={t.logo} alt=""/>:"⚽"}</div><strong>{t.name}</strong><span>{t.country||leagueName(t.league_id)}</span><small>Takımı incele →</small></Link>):<div className={styles.empty}>Aradığın kulüp bulunamadı.</div>}</div>
  <p className={styles.footnote}>Gösterilen bilgiler kaydedilmiş API-Football verileridir. Canlı skor garantisi verilmez. Scouting oyuncu verileri değiştirilmez.</p>
 </div></AppShell>;
}
