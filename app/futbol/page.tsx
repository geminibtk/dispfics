import Link from "next/link";
import AppShell from "../components/AppShell";
import {footballDb,leagueName,dateLabel,catalogLeagueIds,preferredLeagueNames} from "../../lib/football-center";
import styles from "./style.module.css";
import LeaguePicker from "./LeaguePicker";
export const dynamic="force-dynamic";
export const metadata={title:"Futbol Merkezi | YanımdaFutbol"};
const TOP=[203,39,140,135,78,61];
const FINISHED=["FT","AET","PEN"];const LIVE=["1H","2H","HT","ET","BT","P","LIVE","INT"];
type Fixture={fixture_id:number;league_id:number;kickoff:string;status:string;home_team_id:number;away_team_id:number;home_goals:number|null;away_goals:number|null;raw:any};
function istanbulDate(d:Date){return new Intl.DateTimeFormat("en-CA",{timeZone:"Europe/Istanbul",year:"numeric",month:"2-digit",day:"2-digit"}).format(d)}
export default async function FootballCenter({searchParams}:{searchParams:Promise<{league?:string;date?:string;tab?:string;name?:string}>}){
 const params=await searchParams;const db=footballDb();
 const chosenName=params.name||"";const league=Number(params.league||catalogLeagueIds[chosenName]||203);
 const today=istanbulDate(new Date());
 const tab=params.tab==="live"?"live":params.tab==="upcoming"?"upcoming":"results";
 const FINISHED_SET=new Set(FINISHED),LIVE_SET=new Set(LIVE);
 const qualifies=(f:Fixture,mode:string)=>mode==="results"?FINISHED_SET.has(f.status):mode==="live"?LIVE_SET.has(f.status):!FINISHED_SET.has(f.status)&&!LIVE_SET.has(f.status)&&!["PST","CANC","ABD","AWD","WO"].includes(f.status);
 const apiKey=process.env.API_FOOTBALL_KEY;
 const toFixture=(x:any):Fixture=>({fixture_id:x.fixture.id,league_id:x.league.id,kickoff:x.fixture.date,status:x.fixture.status.short,home_team_id:x.teams.home.id,away_team_id:x.teams.away.id,home_goals:x.goals.home,away_goals:x.goals.away,raw:x});
 async function apiFixtures(date:string):Promise<Fixture[]|null>{
  if(!apiKey)return null;
  try{
   const res=await fetch("https://v3.football.api-sports.io/fixtures?date="+date+"&timezone=Europe%2FIstanbul&league="+league+"&season=2026",{headers:{"x-apisports-key":apiKey},next:{revalidate:60},signal:AbortSignal.timeout(7000)});
   const json=await res.json();
   if(!res.ok||Object.keys(json.errors||{}).length)return null;
   return (json.response||[]).map(toFixture);
  }catch{return null}
 }
 async function storedFixtures(date:string):Promise<Fixture[]>{
  const begin=new Date(date+"T00:00:00+03:00"),finish=new Date(begin.getTime()+86400000);
  const {data}=await db.from("api_football_fixtures").select("fixture_id,league_id,kickoff,status,home_team_id,away_team_id,home_goals,away_goals,raw").eq("league_id",league).gte("kickoff",begin.toISOString()).lt("kickoff",finish.toISOString()).order("kickoff").limit(100);
  return (data||[]) as Fixture[];
 }
 const [standingsResult,catalogResult]=await Promise.all([db.from("api_football_standings").select("league_id,season,team_id,rank,points,played,goal_difference,raw").eq("league_id",league).order("rank").limit(30),db.from("league_catalog_summary").select("name,rating").limit(100)]);
 let matches:Fixture[]=[];let matchDate=today;let sourceUnavailable=false;
 // Today is the only valid date for live matches. Completed and upcoming fixtures
 // search backwards/forwards one calendar day at a time, stopping at the first match day.
 const offsets=tab==="live"?[0]:tab==="results"?Array.from({length:15},(_,i)=>-i):Array.from({length:15},(_,i)=>i);
 for(const offset of offsets){
  const anchor=new Date(today+"T12:00:00+03:00");
  anchor.setUTCDate(anchor.getUTCDate()+offset);
  const date=istanbulDate(anchor);
  const remote=await apiFixtures(date);
  const fixtures=remote===null?await storedFixtures(date):remote;
  if(remote===null)sourceUnavailable=true;
  const eligible=fixtures.filter(f=>f.league_id===league&&qualifies(f,tab));
  if(eligible.length){matches=eligible;matchDate=date;break}
  // When the remote API is temporarily unavailable, still check stored dates.
 }
 let standings:any[]=standingsResult.data||[];
 if(process.env.API_FOOTBALL_KEY&&!chosenName){
  try{
   const sid=league||203;
   const res=await fetch("https://v3.football.api-sports.io/standings?league="+sid+"&season=2026",{headers:{"x-apisports-key":process.env.API_FOOTBALL_KEY},cache:"no-store",signal:AbortSignal.timeout(9000)});
   const json=await res.json();
   if(res.ok&&!Object.keys(json.errors||{}).length){
    const groups=json.response?.[0]?.league?.standings||[];
    const fresh=groups.flat().map((x:any)=>({league_id:sid,season:2026,team_id:x.team.id,rank:x.rank,points:x.points,played:x.all?.played,goal_difference:x.goalsDiff,raw:x}));
    if(fresh.length){standings=fresh}
   }
  }catch{}
 }
 const catalog=(catalogResult.data||[]).map(x=>x.name).filter(Boolean);
 const others=catalog.filter(n=>!preferredLeagueNames.includes(n)).sort((a,b)=>a.localeCompare(b,"tr"));
 const ids=Array.from(new Set([...matches.flatMap(f=>[f.home_team_id,f.away_team_id]),...standings.map(s=>s.team_id)].filter(Boolean)));
 const {data:names}=ids.length?await db.from("api_football_teams").select("api_team_id,name,logo").in("api_team_id",ids.slice(0,500)):{data:[] as any[]};
 const nameMap=new Map((names||[]).map(t=>[t.api_team_id,t]));const logoFor=(id:number,raw:any)=>raw?.team?.logo||nameMap.get(id)?.logo||`https://media.api-sports.io/football/teams/${id}.png`;
 const link=(overrides:Record<string,string>)=>"/futbol?"+new URLSearchParams({league:String(league),tab,...(chosenName?{name:chosenName}:{}),...overrides}).toString();
 const shownDate=new Intl.DateTimeFormat("tr-TR",{day:"numeric",month:"long",year:"numeric",timeZone:"Europe/Istanbul"}).format(new Date(matchDate+"T12:00:00+03:00"));
 return <AppShell title="Futbol Merkezi" hideTitle><div className={styles.root}>
  <div className={styles.hero}><div><span className={styles.kicker}>YANIMDAFUTBOL · FUTBOL MERKEZİ</span><h1>Futbolun <em>nabzı.</em></h1><p>Maçlar, sonuçlar ve lig tabloları. Hepsi tek yerde.</p></div><div className={styles.heroIcon}>⚽</div></div>
  <div className={styles.toolbar}><div className={styles.sectionTitle}><h2>Maçlar</h2></div></div>
  <div className={styles.leagueStrip}>{preferredLeagueNames.map(name=><Link key={name} className={(chosenName===name||(!chosenName&&catalogLeagueIds[name]===league))?styles.selected:""} href={link({league:String(catalogLeagueIds[name]||""),name:catalogLeagueIds[name]?"":name})}>{name}</Link>)}<LeaguePicker names={others} selected={chosenName||catalog.find(n=>catalogLeagueIds[n]===league)||""} tab={tab}/></div>
  <nav className={styles.tabs} aria-label="Maç durumu"><Link className={tab==="results"?styles.selected:""} href={link({tab:"results"})}>Oynanmış maçlar</Link><Link className={tab==="live"?styles.selected:""} href={link({tab:"live"})}>Canlı maçlar</Link><Link className={tab==="upcoming"?styles.selected:""} href={link({tab:"upcoming"})}>Gelecek maçlar</Link></nav>
  <div className={styles.layout}><section className={styles.primary}><div className={styles.panel}><div className={styles.panelTitle}><strong>{matches.length?shownDate:tab==="live"?"Bugün":tab==="results"?"Son sonuçlar":"Yaklaşan maçlar"}</strong></div>
  {matches.length?matches.map(f=><Link className={styles.match} href={"/futbol/mac/"+f.fixture_id} key={f.fixture_id}><div className={styles.matchLeague}><span>{dateLabel(f.kickoff)}</span><span>{FINISHED.includes(f.status)?"Maç sonu":LIVE.includes(f.status)?"CANLI "+(f.raw?.fixture?.status?.elapsed||"")+"′":"Başlamadı"}</span></div><div className={styles.matchLine}><div className={styles.teamName}><img src={logoFor(f.home_team_id,f.raw?.teams?.home)} alt="" loading="lazy"/><span>{nameMap.get(f.home_team_id)?.name||f.raw?.teams?.home?.name||"Ev sahibi"}</span></div><strong className={styles.score}>{f.home_goals??"–"} <span>:</span> {f.away_goals??"–"}</strong><div className={styles.teamName+" "+styles.away}><span>{nameMap.get(f.away_team_id)?.name||f.raw?.teams?.away?.name||"Deplasman"}</span><img src={logoFor(f.away_team_id,f.raw?.teams?.away)} alt="" loading="lazy"/></div></div></Link>):<div className={styles.empty}>{tab==="live"?"Şu anda bu ligde canlı maç yok.":tab==="results"?"Son 15 günde tamamlanan maç bulunamadı.":"Önümüzdeki 15 günde planlanmış maç bulunamadı."}{sourceUnavailable?" API bağlantısı kullanılamadığından kayıtlı veriler kontrol edildi.":""}</div>}</div></section>
  <aside className={styles.secondary}><div className={styles.panel}><div className={styles.panelTitle}><strong>{leagueName(league||203)} · Puan durumu</strong></div><div className={styles.tableHead}><span>Takım</span><span>O</span><span>AV</span><span>P</span></div>{standings.length?standings.map(s=><Link key={s.team_id+"-"+s.season} href={"/futbol/takim/"+s.team_id} className={styles.tableRow}><span className={styles.tableTeam}><b>{s.rank}</b><img src={s.raw?.team?.logo||nameMap.get(s.team_id)?.logo||`https://media.api-sports.io/football/teams/${s.team_id}.png`} alt="" loading="lazy"/><span>{nameMap.get(s.team_id)?.name||s.raw?.team?.name||"Takım"}</span></span><span>{s.played}</span><span>{s.goal_difference}</span><strong>{s.points}</strong></Link>):<div className={styles.empty}>Bu lig için puan durumu bulunamadı.</div>}</div></aside></div>
 </div></AppShell>;
}