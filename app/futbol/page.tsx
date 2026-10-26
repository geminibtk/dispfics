import Link from "next/link";
import AppShell from "../components/AppShell";
import {footballDb,leagueName,dateLabel,catalogLeagueIds,preferredLeagueNames} from "../../lib/football-center";
import styles from "./style.module.css";
import LeaguePicker from "./LeaguePicker";
export const dynamic="force-dynamic";
export const metadata={title:"Futbol Merkezi | YanımdaFutbol"};
const TOP=[203,39,140,135,78,61];
const FINISHED=["FT","AET","PEN"];
type Fixture={fixture_id:number;league_id:number;kickoff:string;status:string;home_team_id:number;away_team_id:number;home_goals:number|null;away_goals:number|null;raw:any};
function istanbulDate(d:Date){return new Intl.DateTimeFormat("en-CA",{timeZone:"Europe/Istanbul",year:"numeric",month:"2-digit",day:"2-digit"}).format(d)}
export default async function FootballCenter({searchParams}:{searchParams:Promise<{league?:string;date?:string;tab?:string;name?:string}>}){
 const params=await searchParams;const db=footballDb();
 const league=Number(params.league||0);const chosenName=params.name||"";
 const today=istanbulDate(new Date());
 const selectedDate=/^\d{4}-\d{2}-\d{2}$/.test(params.date||"")?params.date!:today;
 const tab=params.tab==="results"?"results":params.tab==="upcoming"?"upcoming":"all";
 const start=new Date(selectedDate+"T00:00:00+03:00"),end=new Date(start.getTime()+86400000);
 let query=db.from("api_football_fixtures").select("fixture_id,league_id,kickoff,status,home_team_id,away_team_id,home_goals,away_goals,raw").gte("kickoff",start.toISOString()).lt("kickoff",end.toISOString()).order("kickoff").limit(300);
 if(league)query=query.eq("league_id",league);
 const [stored,standingsResult,catalogResult]=await Promise.all([query,db.from("api_football_standings").select("league_id,season,team_id,rank,points,played,goal_difference,raw").eq("league_id",league||203).order("rank").limit(30),db.from("league_catalog_summary").select("name,rating").limit(100)]);
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
 const matches=day.filter(f=>(!chosenName||catalogLeagueIds[chosenName]===f.league_id)&&(tab==="all"||(tab==="results"?FINISHED.includes(f.status):!FINISHED.includes(f.status))));
 let standings:any[]=standingsResult.data||[];let standingsCurrent=false;
 if(process.env.API_FOOTBALL_KEY&&!chosenName){
  try{
   const sid=league||203;
   const res=await fetch("https://v3.football.api-sports.io/standings?league="+sid+"&season=2026",{headers:{"x-apisports-key":process.env.API_FOOTBALL_KEY},cache:"no-store",signal:AbortSignal.timeout(9000)});
   const json=await res.json();
   if(res.ok&&!Object.keys(json.errors||{}).length){
    const groups=json.response?.[0]?.league?.standings||[];
    const fresh=groups.flat().map((x:any)=>({league_id:sid,season:2026,team_id:x.team.id,rank:x.rank,points:x.points,played:x.all?.played,goal_difference:x.goalsDiff,raw:x}));
    if(fresh.length){standings=fresh;standingsCurrent=true}
   }
  }catch{}
 }
 const catalog=(catalogResult.data||[]).map(x=>x.name).filter(Boolean);
 const others=catalog.filter(n=>!preferredLeagueNames.includes(n)).sort((a,b)=>a.localeCompare(b,"tr"));
 const ids=Array.from(new Set([...matches.flatMap(f=>[f.home_team_id,f.away_team_id]),...standings.map(s=>s.team_id)].filter(Boolean)));
 const {data:names}=ids.length?await db.from("api_football_teams").select("api_team_id,name,logo").in("api_team_id",ids.slice(0,500)):{data:[] as any[]};
 const nameMap=new Map((names||[]).map(t=>[t.api_team_id,t]));
 const link=(overrides:Record<string,string>)=>"/futbol?"+new URLSearchParams({date:selectedDate,league:String(league||""),tab,...(chosenName?{name:chosenName}:{}),...overrides}).toString();
 const shownDate=new Intl.DateTimeFormat("tr-TR",{day:"numeric",month:"long",year:"numeric",timeZone:"Europe/Istanbul"}).format(start);
 return <AppShell title="Futbol Merkezi" hideTitle><div className={styles.root}>
  <div className={styles.hero}><div><span className={styles.kicker}>YANIMDAFUTBOL · FUTBOL MERKEZİ</span><h1>Futbolun <em>nabzı.</em></h1><p>Maçlar, sonuçlar ve lig tabloları. Hepsi tek yerde.</p></div><div className={styles.heroIcon}>⚽</div></div>
  <div className={styles.toolbar}><div className={styles.sectionTitle}><h2>Maçlar</h2></div><form action="/futbol" className={styles.dateForm}><input type="date" name="date" defaultValue={selectedDate} aria-label="Maç tarihi"/>{league>0&&<input type="hidden" name="league" value={league}/>}<button type="submit">Göster</button><Link className={styles.todayButton} href="/futbol">Bugün</Link></form></div>
  <div className={styles.leagueStrip}><Link className={!league&&!chosenName?styles.selected:""} href={link({league:"",name:""})}>Tüm ligler</Link>{preferredLeagueNames.map(name=><Link key={name} className={(chosenName===name||(!chosenName&&catalogLeagueIds[name]===league))?styles.selected:""} href={link({league:String(catalogLeagueIds[name]||""),name:catalogLeagueIds[name]?"":name})}>{name}</Link>)}<LeaguePicker names={others} selected={chosenName||catalog.find(n=>catalogLeagueIds[n]===league)||""} date={selectedDate} tab={tab}/></div>
  <div className={styles.tabs}><Link className={tab==="all"?styles.selected:""} href={link({tab:"all"})}>Tüm maçlar</Link><Link className={tab==="results"?styles.selected:""} href={link({tab:"results"})}>Sonuçlar</Link><Link className={tab==="upcoming"?styles.selected:""} href={link({tab:"upcoming"})}>Gelecek maçlar</Link></div>
  <div className={styles.layout}><section className={styles.primary}><div className={styles.panel}><div className={styles.panelTitle}><strong>{shownDate}</strong></div>{liveError&&<p className={styles.liveNotice}>{liveError}</p>}{(() => {const grouped=new Map<number,Fixture[]>();for(const m of matches){if(!grouped.has(m.league_id))grouped.set(m.league_id,[]);grouped.get(m.league_id)!.push(m)}const order=[203,39,140,135,78,61,40,79,88,94,136,144,179,253,307];const ids=Array.from(grouped.keys()).sort((a,b)=>(order.indexOf(a)<0?999:order.indexOf(a))-(order.indexOf(b)<0?999:order.indexOf(b)));const visible=league||chosenName?ids:ids.slice(0,5);return visible.length?visible.map(id=><div key={id} className={styles.leagueGroup}><div className={styles.groupTitle}><strong>{leagueName(id)}</strong><span>{grouped.get(id)!.length} maç</span></div>{grouped.get(id)!.map(f=><Link className={styles.match} href={"/futbol/mac/"+f.fixture_id} key={f.fixture_id}><div className={styles.matchLeague}><span>{dateLabel(f.kickoff)}</span><span>{FINISHED.includes(f.status)?"Maç sonu":f.status==="NS"?"Başlamadı":f.status==="HT"?"Devre":f.status==="1H"||f.status==="2H"?"CANLI "+(f.raw?.fixture?.status?.elapsed||"")+"′":f.status}</span></div><div className={styles.matchLine}><div className={styles.teamName}>{(nameMap.get(f.home_team_id)?.logo||f.raw?.teams?.home?.logo)&&<img src={nameMap.get(f.home_team_id)?.logo||f.raw?.teams?.home?.logo} alt=""/>}<span>{nameMap.get(f.home_team_id)?.name||f.raw?.teams?.home?.name||"Ev sahibi"}</span></div><strong className={styles.score}>{f.home_goals??"–"} <span>:</span> {f.away_goals??"–"}</strong><div className={styles.teamName+" "+styles.away}><span>{nameMap.get(f.away_team_id)?.name||f.raw?.teams?.away?.name||"Deplasman"}</span>{(nameMap.get(f.away_team_id)?.logo||f.raw?.teams?.away?.logo)&&<img src={nameMap.get(f.away_team_id)?.logo||f.raw?.teams?.away?.logo} alt=""/>}</div></div></Link>)}</div>):<div className={styles.empty}>Seçilen tarihte bu liglerde maç bulunamadı.</div>})()}</div></section>
  <aside className={styles.secondary}><div className={styles.panel}><div className={styles.panelTitle}><strong>{leagueName(league||203)} · Puan durumu</strong><span>{standingsCurrent?"Güncel API verisi":"Son kayıtlı · "+(standings[0]?.season||"sezon")}</span></div><div className={styles.tableHead}><span>Takım</span><span>O</span><span>AV</span><span>P</span></div>{standings.length?standings.map(s=><Link key={s.team_id+"-"+s.season} href={"/futbol/takim/"+s.team_id} className={styles.tableRow}><span className={styles.tableTeam}><b>{s.rank}</b>{nameMap.get(s.team_id)?.logo&&<img src={nameMap.get(s.team_id)?.logo} alt=""/>}<span>{nameMap.get(s.team_id)?.name||s.raw?.team?.name||"Takım"}</span></span><span>{s.played}</span><span>{s.goal_difference}</span><strong>{s.points}</strong></Link>):<div className={styles.empty}>Bu lig için puan durumu bulunamadı.</div>}</div></aside></div>
 </div></AppShell>;
}