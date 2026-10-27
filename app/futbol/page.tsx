import Link from "next/link";
import AppShell from "../components/AppShell";
import {footballDb,leagueName,dateLabel,catalogLeagueIds,preferredLeagueNames} from "../../lib/football-center";
import styles from "./style.module.css";
import LeaguePicker from "./LeaguePicker";
import WeekPicker from "./WeekPicker";
import {resolveFootballLeague} from "../../lib/football-league-resolver";
export const dynamic="force-dynamic";
export const metadata={title:"Futbol Merkezi | YanımdaFutbol"};
const TOP=[203,39,140,135,78,61];
const FINISHED=["FT","AET","PEN"];const LIVE=["1H","2H","HT","ET","BT","P","LIVE","INT"];
type Fixture={fixture_id:number;league_id:number;kickoff:string;status:string;home_team_id:number;away_team_id:number;home_goals:number|null;away_goals:number|null;raw:any};
function istanbulDate(d:Date){return new Intl.DateTimeFormat("en-CA",{timeZone:"Europe/Istanbul",year:"numeric",month:"2-digit",day:"2-digit"}).format(d)}
export default async function FootballCenter({searchParams}:{searchParams:Promise<{league?:string;date?:string;tab?:string;name?:string;week?:string}>}){
 const params=await searchParams;const db=footballDb();
 const chosenName=params.name||"";
 const apiKey=process.env.API_FOOTBALL_KEY||"";
 const resolved=chosenName?await resolveFootballLeague(chosenName,apiKey):null;
 const league=chosenName?(resolved?.id||0):Number(params.league||203);
 const season=resolved?.season||2026;
 const today=istanbulDate(new Date());
 const toFixture=(x:any):Fixture=>({fixture_id:x.fixture.id,league_id:x.league.id,kickoff:x.fixture.date,status:x.fixture.status.short,home_team_id:x.teams.home.id,away_team_id:x.teams.away.id,home_goals:x.goals.home,away_goals:x.goals.away,raw:x});
 const [standingsResult,catalogResult]=await Promise.all([db.from("api_football_standings").select("league_id,season,team_id,rank,points,played,goal_difference,raw").eq("league_id",league).order("rank").limit(30),db.from("league_catalog_summary").select("name,rating").limit(100)]);
 let seasonFixtures:Fixture[]=[];
 let sourceUnavailable=false;
 if(apiKey&&league){
  try{
   const query=new URLSearchParams({league:String(league),season:String(season),timezone:"Europe/Istanbul"});
   const res=await fetch("https://v3.football.api-sports.io/fixtures?"+query.toString(),{headers:{"x-apisports-key":apiKey},next:{revalidate:120},signal:AbortSignal.timeout(12000)});
   const json=await res.json();
   if(!res.ok||Object.keys(json.errors||{}).length)throw new Error("API unavailable");
   seasonFixtures=(json.response||[]).map(toFixture);
  }catch{sourceUnavailable=true}
 }else sourceUnavailable=true;
 if(sourceUnavailable&&league){
  const {data}=await db.from("api_football_fixtures").select("fixture_id,league_id,kickoff,status,home_team_id,away_team_id,home_goals,away_goals,raw").eq("league_id",league).eq("season",season).order("kickoff").limit(700);
  seasonFixtures=(data||[]) as Fixture[];
 }
 const roundMap=new Map<string,Fixture[]>();
 for(const fixture of seasonFixtures){
  const round=fixture.raw?.league?.round;
  if(!round||fixture.league_id!==league)continue;
  if(!roundMap.has(round))roundMap.set(round,[]);
  roundMap.get(round)!.push(fixture);
 }
 const roundNumber=(round:string)=>{const match=round.match(/([0-9]+)$/);return match?Number(match[1]):0};
 // A double round-robin league with N teams has 2*(N-1) matchweeks.
 // Count distinct clubs from the selected league's fixtures, never a global 38-week default.
 const leagueTeamIds=new Set(seasonFixtures.filter(f=>f.league_id===league).flatMap(f=>[f.home_team_id,f.away_team_id]).filter(id=>id>0));
 const teamCount=leagueTeamIds.size>=4?leagueTeamIds.size:new Set((standingsResult.data||[]).map(s=>s.team_id).filter(Boolean)).size;
 const regularSeasonWeeks=teamCount>=4?2*(teamCount-1):null;
 const isUefaCompetition=[2,3,848].includes(league);
 const regularRounds=Array.from(roundMap.keys()).filter(round=>/^Regular Season[ ]*-[ ]*[0-9]+$/i.test(round));
 const roundCandidates=isUefaCompetition?Array.from(roundMap.keys()):regularRounds.length?regularRounds:Array.from(roundMap.keys());
 const orderedRounds=roundCandidates.filter(round=>isUefaCompetition||roundNumber(round)>0&&(!regularSeasonWeeks||roundNumber(round)<=regularSeasonWeeks)).sort((a,b)=>isUefaCompetition?Math.min(...(roundMap.get(a)||[]).map(f=>new Date(f.kickoff).getTime()))-Math.min(...(roundMap.get(b)||[]).map(f=>new Date(f.kickoff).getTime())):roundNumber(a)-roundNumber(b));
 // A new matchweek becomes the default at 00:00 Istanbul time on its first match day.
 const todayStart=new Date(today+"T00:00:00+03:00").getTime();
 const roundStart=(round:string)=>Math.min(...(roundMap.get(round)||[]).map(f=>new Date(istanbulDate(new Date(f.kickoff))+"T00:00:00+03:00").getTime()));
 const startedRounds=orderedRounds.filter(round=>roundStart(round)<=todayStart);
 const defaultRound=startedRounds.length?startedRounds.reduce((best,round)=>roundStart(round)>roundStart(best)?round:best):orderedRounds[0]||"";
 const selectedRound=params.week&&orderedRounds.includes(params.week)?params.week:defaultRound;
 const matches=(roundMap.get(selectedRound)||[]).slice().sort((a,b)=>new Date(a.kickoff).getTime()-new Date(b.kickoff).getTime());
 const groupedMatches=Array.from(matches.reduce((map,fixture)=>{const date=istanbulDate(new Date(fixture.kickoff));if(!map.has(date))map.set(date,[]);map.get(date)!.push(fixture);return map},new Map<string,Fixture[]>()).entries());
 const roundOptions=orderedRounds.map(round=>({value:round,label:isUefaCompetition?round.replace(/^League Stage[ ]*-[ ]*/i,"Lig aşaması ").replace(/^Group Stage[ ]*-[ ]*/i,"Grup aşaması ").replace(/^Round of 16$/i,"Son 16").replace(/^Quarter-finals$/i,"Çeyrek final").replace(/^Semi-finals$/i,"Yarı final").replace(/^Final$/i,"Final"):roundNumber(round)?roundNumber(round)+". hafta":round}));
 let standings:any[]=standingsResult.data||[];
 if(process.env.API_FOOTBALL_KEY&&league){
  try{
   const sid=league;
   const res=await fetch("https://v3.football.api-sports.io/standings?league="+sid+"&season="+season,{headers:{"x-apisports-key":process.env.API_FOOTBALL_KEY},cache:"no-store",signal:AbortSignal.timeout(9000)});
   const json=await res.json();
   if(res.ok&&!Object.keys(json.errors||{}).length){
    const groups=json.response?.[0]?.league?.standings||[];
    const fresh=groups.flat().map((x:any)=>({league_id:sid,season,team_id:x.team.id,rank:x.rank,points:x.points,played:x.all?.played,goal_difference:x.goalsDiff,raw:x}));
    if(fresh.length){standings=fresh}
   }
  }catch{}
 }
 const catalog=(catalogResult.data||[]).map(x=>x.name).filter(Boolean);
 const others=Array.from(new Set([...Object.keys(catalogLeagueIds),...catalog])).filter(n=>!preferredLeagueNames.includes(n)).sort((a,b)=>a.localeCompare(b,"tr"));
 const ids=Array.from(new Set([...matches.flatMap(f=>[f.home_team_id,f.away_team_id]),...standings.map(s=>s.team_id)].filter(Boolean)));
 const {data:names}=ids.length?await db.from("api_football_teams").select("api_team_id,name,logo").in("api_team_id",ids.slice(0,500)):{data:[] as any[]};
 const nameMap=new Map((names||[]).map(t=>[t.api_team_id,t]));const logoFor=(id:number,raw:any)=>raw?.logo||nameMap.get(id)?.logo||`https://media.api-sports.io/football/teams/${id}.png`;
 const link=(overrides:Record<string,string>)=>"/futbol?"+new URLSearchParams({league:String(league),...(chosenName?{name:chosenName}:{}),...overrides}).toString();
 const formatDate=(date:string)=>new Intl.DateTimeFormat("tr-TR",{day:"numeric",month:"long",year:"numeric",timeZone:"Europe/Istanbul"}).format(new Date(date+"T12:00:00+03:00"));
 return <AppShell title="Futbol Merkezi" hideTitle><div className={styles.root}>
  <div className={styles.hero}><div><span className={styles.kicker}>YANIMDAFUTBOL · FUTBOL MERKEZİ</span><h1>Futbolun <em>nabzı.</em></h1><p>Maçlar, sonuçlar ve lig tabloları. Hepsi tek yerde.</p></div><div className={styles.heroIcon}>⚽</div></div>
  <div className={styles.toolbar}><div className={styles.sectionTitle}><h2>Maçlar</h2></div></div>
  <div className={styles.leagueNav}><div className={styles.leagueStrip}>{preferredLeagueNames.map(name=><Link key={name} className={(chosenName===name||(!chosenName&&catalogLeagueIds[name]===league))?styles.selected:""} href={link({league:String(catalogLeagueIds[name]||""),name:catalogLeagueIds[name]?"":name})}>{(chosenName===name||(!chosenName&&catalogLeagueIds[name]===league))?<img className={styles.leagueLogo} src={"https://media.api-sports.io/football/leagues/"+catalogLeagueIds[name]+".png"} alt="" loading="lazy" width={24} height={24}/>:null}<span>{name}</span></Link>)} </div><LeaguePicker names={others} selected={chosenName||Object.keys(catalogLeagueIds).find(n=>catalogLeagueIds[n]===league)||""} tab="results"/></div>
  <WeekPicker rounds={roundOptions} selected={selectedRound} league={league} name={chosenName}/>
  <div className={styles.layout}><section className={styles.primary}>
  {matches.length?groupedMatches.map(([date,fixtures])=><div className={styles.panel} style={{marginBottom:14}} key={date}><div className={styles.panelTitle}><strong>{formatDate(date)}</strong></div>
  {fixtures.map(f=><Link className={styles.match} href={"/futbol/mac/"+f.fixture_id} key={f.fixture_id}><div className={styles.matchLeague}><span>{dateLabel(f.kickoff)}</span><span>{FINISHED.includes(f.status)?"Maç sonu":LIVE.includes(f.status)?"CANLI "+(f.raw?.fixture?.status?.elapsed||"")+"′":"Başlamadı"}</span></div><div className={styles.matchLine}><div className={styles.teamName}><img src={logoFor(f.home_team_id,f.raw?.teams?.home)} alt="" loading="lazy"/><span>{nameMap.get(f.home_team_id)?.name||f.raw?.teams?.home?.name||"Ev sahibi"}</span></div><strong className={styles.score}>{f.home_goals??"–"} <span>:</span> {f.away_goals??"–"}</strong><div className={styles.teamName+" "+styles.away}><span>{nameMap.get(f.away_team_id)?.name||f.raw?.teams?.away?.name||"Deplasman"}</span><img src={logoFor(f.away_team_id,f.raw?.teams?.away)} alt="" loading="lazy"/></div></div></Link>)}</div>):<div className={styles.panel}><div className={styles.empty}>{"Bu hafta için maç bulunamadı."}{sourceUnavailable?" API bağlantısı kullanılamadığından kayıtlı veriler kontrol edildi.":""}</div></div>}
  </section>
  <aside className={styles.secondary}><div className={styles.panel}><div className={styles.panelTitle}><strong>{(chosenName||leagueName(league||203))} · Puan durumu</strong></div><div className={styles.tableHead}><span>Takım</span><span>O</span><span>AV</span><span>P</span></div>{standings.length?standings.map(s=><Link key={s.team_id+"-"+s.season} href={"/futbol/takim/"+s.team_id} className={styles.tableRow}><span className={styles.tableTeam}><b>{s.rank}</b><img src={s.raw?.team?.logo||nameMap.get(s.team_id)?.logo||`https://media.api-sports.io/football/teams/${s.team_id}.png`} alt="" loading="lazy"/><span>{nameMap.get(s.team_id)?.name||s.raw?.team?.name||"Takım"}</span></span><span>{s.played}</span><span>{s.goal_difference}</span><strong>{s.points}</strong></Link>):<div className={styles.empty}>Bu lig için puan durumu bulunamadı.</div>}</div></aside></div>
 </div></AppShell>;
}