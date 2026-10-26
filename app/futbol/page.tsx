import Link from "next/link";
import AppShell from "../components/AppShell";
import {footballDb,leagueName,dateLabel,leagueNames} from "../../lib/football-center";
import styles from "./style.module.css";
import LiveRefresh from "./LiveRefresh";
export const dynamic="force-dynamic";
export const metadata={title:"Futbol Merkezi | YanımdaFutbol"};
const TOP=[39,140,135,78,61];
const FINISHED=["FT","AET","PEN"];
type Fixture={fixture_id:number;league_id:number;kickoff:string;status:string;home_team_id:number;away_team_id:number;home_goals:number|null;away_goals:number|null;raw:any};
function istanbulDate(d:Date){return new Intl.DateTimeFormat("en-CA",{timeZone:"Europe/Istanbul",year:"numeric",month:"2-digit",day:"2-digit"}).format(d)}
export default async function FootballCenter({searchParams}:{searchParams:Promise<{league?:string;date?:string;tab?:string}>}){
 const params=await searchParams;const db=footballDb();
 const league=Number(params.league||0);
 const today=istanbulDate(new Date());
 const selectedDate=/^\d{4}-\d{2}-\d{2}$/.test(params.date||"")?params.date!:today;
 const tab=params.tab==="results"?"results":params.tab==="upcoming"?"upcoming":"all";
 const start=new Date(selectedDate+"T00:00:00+03:00"),end=new Date(start.getTime()+86400000);
 let query=db.from("api_football_fixtures").select("fixture_id,league_id,kickoff,status,home_team_id,away_team_id,home_goals,away_goals,raw").gte("kickoff",start.toISOString()).lt("kickoff",end.toISOString()).order("kickoff").limit(300);
 if(league)query=query.eq("league_id",league);
 const [stored,standingsResult]=await Promise.all([query,db.from("api_football_standings").select("league_id,season,team_id,rank,points,played,goal_difference,raw").eq("league_id",league||203).order("rank").limit(30)]);
 let day:Fixture[]=(stored.data||[]) as Fixture[];
 let live=false,liveError="";
 if(selectedDate===today&&process.env.API_FOOTBALL_KEY){
  try{
   const response=await fetch("https://v3.football.api-sports.io/fixtures?date="+selectedDate+"&timezone=Europe%2FIstanbul"+(league?"&league="+league+"&season=2026":""),{headers:{"x-apisports-key":process.env.API_FOOTBALL_KEY},cache:"no-store",signal:AbortSignal.timeout(10000)});
   const json=await response.json();
   if(!response.ok||Object.keys(json.errors||{}).length)throw new Error("API verisi alınamadı");
   day=(json.response||[]).map((x:any)=>({fixture_id:x.fixture.id,league_id:x.league.id,kickoff:x.fixture.date,status:x.fixture.status.short,home_team_id:x.teams.home.id,away_team_id:x.teams.away.id,home_goals:x.goals.home,away_goals:x.goals.away,raw:x}));
   live=true;
  }catch{liveError="Canlı bağlantı kurulamadı; kayıtlı maçlar gösteriliyor."}
 }else if(selectedDate===today){liveError="Canlı veri bağlantısı yapılandırılmamış; kayıtlı maçlar gösteriliyor."}
 const matches=day.filter(f=>tab==="all"||(tab==="results"?FINISHED.includes(f.status):!FINISHED.includes(f.status)));
 const standings=standingsResult.data||[];
 const ids=Array.from(new Set([...matches.flatMap(f=>[f.home_team_id,f.away_team_id]),...standings.map(s=>s.team_id)].filter(Boolean)));
 const {data:names}=ids.length?await db.from("api_football_teams").select("api_team_id,name,logo").in("api_team_id",ids.slice(0,500)):{data:[] as any[]};
 const nameMap=new Map((names||[]).map(t=>[t.api_team_id,t]));
 const link=(overrides:Record<string,string>)=>"/futbol?"+new URLSearchParams({date:selectedDate,league:String(league||""),tab,...overrides}).toString();
 const shownDate=new Intl.DateTimeFormat("tr-TR",{day:"numeric",month:"long",year:"numeric",timeZone:"Europe/Istanbul"}).format(start);
 return <AppShell title="Futbol Merkezi" hideTitle><div className={styles.root}>
  <div className={styles.hero}><div><span className={styles.kicker}>YANIMDAFUTBOL · FUTBOL MERKEZİ</span><h1>Futbolun <em>nabzı.</em></h1><p>Maçlar, sonuçlar ve lig tabloları. Hepsi tek yerde.</p></div><div className={styles.heroIcon}>⚽</div></div>
  <div className={styles.toolbar}><div className={styles.sectionTitle}><h2>Maçlar</h2></div><form action="/futbol" className={styles.dateForm}><input type="date" name="date" defaultValue={selectedDate} aria-label="Maç tarihi"/>{league>0&&<input type="hidden" name="league" value={league}/>}<button type="submit">Göster</button><Link className={styles.todayButton} href="/futbol">Bugün</Link></form></div>
  <div className={styles.leagueStrip}><Link className={!league?styles.selected:""} href={link({league:""})}>Tüm ligler</Link>{TOP.map(id=><Link key={id} className={league===id?styles.selected:""} href={link({league:String(id)})}>{leagueName(id)}</Link>)}<details className={styles.otherLeagues}><summary>{league&&!TOP.includes(league)?leagueName(league):"Diğer ligler"} ▾</summary><div className={styles.otherMenu}>{Object.keys(leagueNames).map(Number).filter(id=>!TOP.includes(id)).map(id=><Link key={id} href={link({league:String(id)})}>{leagueName(id)}</Link>)}</div></details></div>
  <div className={styles.tabs}><Link className={tab==="all"?styles.selected:""} href={link({tab:"all"})}>Tüm maçlar</Link><Link className={tab==="results"?styles.selected:""} href={link({tab:"results"})}>Sonuçlar</Link><Link className={tab==="upcoming"?styles.selected:""} href={link({tab:"upcoming"})}>Gelecek maçlar</Link></div>
  <div className={styles.layout}><section className={styles.primary}><div className={styles.panel}><div className={styles.panelTitle}><strong>{shownDate}</strong><span>{live?"● API-Football · güncel":selectedDate===today?"Kayıtlı veriler":"Maç takvimi"}{live&&<LiveRefresh/>}</span></div>{liveError&&<p className={styles.liveNotice}>{liveError}</p>}{matches.length?matches.map(f=><Link className={styles.match} href={"/futbol/mac/"+f.fixture_id} key={f.fixture_id}><div className={styles.matchLeague}><span>{leagueName(f.league_id)}</span><span>{dateLabel(f.kickoff)}</span></div><div className={styles.matchLine}><div className={styles.teamName}>{(nameMap.get(f.home_team_id)?.logo||f.raw?.teams?.home?.logo)&&<img src={nameMap.get(f.home_team_id)?.logo||f.raw?.teams?.home?.logo} alt=""/>}<span>{nameMap.get(f.home_team_id)?.name||f.raw?.teams?.home?.name||"Ev sahibi"}</span></div><strong className={styles.score}>{f.home_goals??"–"} <span>:</span> {f.away_goals??"–"}</strong><div className={styles.teamName+" "+styles.away}><span>{nameMap.get(f.away_team_id)?.name||f.raw?.teams?.away?.name||"Deplasman"}</span>{(nameMap.get(f.away_team_id)?.logo||f.raw?.teams?.away?.logo)&&<img src={nameMap.get(f.away_team_id)?.logo||f.raw?.teams?.away?.logo} alt=""/>}</div></div><div className={styles.matchStatus}>{FINISHED.includes(f.status)?"Maç sonu":f.status==="NS"?"Başlamadı":f.status==="HT"?"Devre arası":f.status==="1H"||f.status==="2H"?"CANLI · "+(f.raw?.fixture?.status?.elapsed||"")+"′":f.status}</div></Link>):<div className={styles.empty}>Seçtiğin {shownDate} tarihinde bu filtreye uygun maç bulunamadı.</div>}</div></section>
  <aside className={styles.secondary}><div className={styles.panel}><div className={styles.panelTitle}><strong>{leagueName(league||203)} · Puan durumu</strong><span>{standings[0]?.season||"Sezon"}</span></div><div className={styles.tableHead}><span>Takım</span><span>O</span><span>AV</span><span>P</span></div>{standings.length?standings.map(s=><Link key={s.team_id+"-"+s.season} href={"/futbol/takim/"+s.team_id} className={styles.tableRow}><span className={styles.tableTeam}><b>{s.rank}</b>{nameMap.get(s.team_id)?.logo&&<img src={nameMap.get(s.team_id)?.logo} alt=""/>}<span>{nameMap.get(s.team_id)?.name||s.raw?.team?.name||"Takım"}</span></span><span>{s.played}</span><span>{s.goal_difference}</span><strong>{s.points}</strong></Link>):<div className={styles.empty}>Bu lig için puan durumu bulunamadı.</div>}</div></aside></div>
 </div></AppShell>;
}