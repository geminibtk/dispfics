import Link from "next/link";
import AppShell from "../components/AppShell";
import {footballDb,dateLabel,catalogLeagueIds,preferredLeagueNames} from "../../lib/football-center";
import styles from "./style.module.css";
import LeaguePicker from "./LeaguePicker";
import {sortOverviewLeagues} from "../../lib/league-presentation";
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
 const displayLeagueName=chosenName||Object.entries(catalogLeagueIds).find(([,id])=>id===league)?.[0]||"Trendyol Süper Lig";
 const today=istanbulDate(new Date());
 const toFixture=(x:any):Fixture=>({fixture_id:x.fixture.id,league_id:x.league.id,kickoff:x.fixture.date,status:x.fixture.status.short,home_team_id:x.teams.home.id,away_team_id:x.teams.away.id,home_goals:x.goals.home,away_goals:x.goals.away,raw:x});
 const [standingsResult,catalogResult]=await Promise.all([db.from("api_football_standings").select("league_id,season,team_id,rank,points,played,goal_difference,raw").eq("league_id",league).eq("season",season).order("rank").limit(100),db.from("league_catalog_summary").select("name,rating,averageAge,averageValue").limit(100)]);
 let seasonFixtures:Fixture[]=[];
 let sourceUnavailable=Boolean(chosenName&&!resolved);
 if(apiKey&&league){
  try{
   const query=new URLSearchParams({league:String(league),season:String(season),timezone:"Europe/Istanbul"});
   const res=await fetch("https://v3.football.api-sports.io/fixtures?"+query.toString(),{headers:{"x-apisports-key":apiKey},next:{revalidate:120},signal:AbortSignal.timeout(12000)});
   const json=await res.json();
   if(!res.ok||Object.keys(json.errors||{}).length)throw new Error("API unavailable");
   seasonFixtures=(json.response||[]).map(toFixture);
  }catch{sourceUnavailable=true}
 }else sourceUnavailable=true;
 if((sourceUnavailable||seasonFixtures.length===0)&&league){
  const {data}=await db.from("api_football_fixtures").select("fixture_id,league_id,kickoff,status,home_team_id,away_team_id,home_goals,away_goals,raw").eq("league_id",league).eq("season",season).order("kickoff").limit(700);
  seasonFixtures=(data||[]) as Fixture[];
 }
 // Refresh in-progress matches by fixture ID, matching the detail page's data source.
 // This avoids stale league-wide fixture caches while keeping season schedules cacheable.
 const liveFixtures=seasonFixtures.filter(f=>LIVE.includes(f.status));
 if(apiKey&&liveFixtures.length){
  const updates=await Promise.all(liveFixtures.slice(0,15).map(async fixture=>{
   try{
    const res=await fetch("https://v3.football.api-sports.io/fixtures?id="+fixture.fixture_id,{headers:{"x-apisports-key":apiKey},cache:"no-store",signal:AbortSignal.timeout(5000)});
    const json=await res.json();
    const x=json.response?.[0];
    return res.ok&&x?.fixture?.id===fixture.fixture_id&&x?.league?.id===league?toFixture(x):null;
   }catch{return null}
  }));
  const latest=new Map(updates.filter((f):f is Fixture=>f!==null).map(f=>[f.fixture_id,f]));
  seasonFixtures=seasonFixtures.map(f=>latest.get(f.fixture_id)||f);
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
 // Competition formats vary: Apertura/Clausura, split groups, playoffs and cups.
 // Never infer or truncate rounds from a double round-robin formula.
 const isUefaCompetition=[2,3,848].includes(league);
 const orderedRounds=Array.from(roundMap.keys()).sort((a,b)=>{
  const first=(round:string)=>Math.min(...(roundMap.get(round)||[]).map(f=>new Date(f.kickoff).getTime()));
  return first(a)-first(b)||a.localeCompare(b,undefined,{numeric:true});
 });
 // A new matchweek becomes the default at 00:00 Istanbul time on its first match day.
 const todayStart=new Date(today+"T00:00:00+03:00").getTime();
 const roundStart=(round:string)=>Math.min(...(roundMap.get(round)||[]).map(f=>new Date(istanbulDate(new Date(f.kickoff))+"T00:00:00+03:00").getTime()));
 const startedRounds=orderedRounds.filter(round=>roundStart(round)<=todayStart);
 const defaultRound=startedRounds.length?startedRounds.reduce((best,round)=>roundStart(round)>roundStart(best)?round:best):orderedRounds[0]||"";
 const selectedRound=params.week&&orderedRounds.includes(params.week)?params.week:defaultRound;
 const matches=(roundMap.get(selectedRound)||[]).slice().sort((a,b)=>new Date(a.kickoff).getTime()-new Date(b.kickoff).getTime());
 const groupedMatches=Array.from(matches.reduce((map,fixture)=>{const date=istanbulDate(new Date(fixture.kickoff));if(!map.has(date))map.set(date,[]);map.get(date)!.push(fixture);return map},new Map<string,Fixture[]>()).entries());
 const roundOptions=orderedRounds.map(round=>({value:round,label:round.replace(/^Regular Season[ ]*-[ ]*/i,"").replace(/^Group Stage[ ]*-[ ]*/i,"Grup ").replace(/^League Stage[ ]*-[ ]*/i,"Lig aşaması ").replace(/^Apertura[ ]*-[ ]*/i,"Apertura ").replace(/^Clausura[ ]*-[ ]*/i,"Clausura ").replace(/^Championship Group[ ]*-[ ]*/i,"Şampiyonluk grubu ").replace(/^Relegation Group[ ]*-[ ]*/i,"Düşme grubu ").replace(/^Round of 32$/i,"Son 32").replace(/^Round of 16$/i,"Son 16").replace(/^Quarter-finals$/i,"Çeyrek final").replace(/^Semi-finals$/i,"Yarı final")}));
 let standings:any[]=standingsResult.data||[];
 let provisionalStandings=false;
 let standingGroups:{label:string;rows:any[]}[]=[];
 if(process.env.API_FOOTBALL_KEY&&league){
  try{
   const sid=league;
   const res=await fetch("https://v3.football.api-sports.io/standings?league="+sid+"&season="+season,{headers:{"x-apisports-key":process.env.API_FOOTBALL_KEY},cache:"no-store",signal:AbortSignal.timeout(9000)});
   const json=await res.json();
   if(res.ok&&!Object.keys(json.errors||{}).length){
    // API responses can contain stale or mixed league groups after navigation.
    // Never render a standing row unless its team belongs to the selected league's fixtures.
    const responseLeague=json.response?.[0]?.league;
    const groups=Number(responseLeague?.id)===sid?responseLeague?.standings||[]:[];
    standingGroups=groups.map((group:any[],index:number)=>({label:String(group[0]?.group||"Grup "+(index+1)),rows:group.filter((x:any)=>leagueTeamIds.has(Number(x?.team?.id))).map((x:any)=>({league_id:sid,season,team_id:x.team.id,rank:x.rank,points:x.points,played:x.all?.played,goal_difference:x.goalsDiff,raw:x}))})).filter((g:{rows:any[]})=>g.rows.length>0);
    if(standingGroups.length){standings=standingGroups.flatMap(g=>g.rows)}
   }
  }catch{}
 }
 // Enforce the selected league on every standings source before rendering.
 standings=standings.filter(s=>Number(s.league_id)===league&&Number(s.season)===season&&leagueTeamIds.has(Number(s.team_id)));
 // Some leagues have no published API standings (e.g. LPF, Finland, Colombia).
 // Derive a provisional table from completed regular-stage fixtures rather than show nothing.
 if(!standings.length&&seasonFixtures.length){
  const finished=seasonFixtures.filter(f=>f.league_id===league&&f.status==="FT"&&f.home_goals!==null&&f.away_goals!==null);
  const stage=(round:string)=>round.replace(/\\s*-\\s*\\d+$/,"").trim();
  const eligible=finished.filter(f=>!/(final|quarter|semi|round of|qualification|relegation|championship|playoff)/i.test(String(f.raw?.league?.round||"")));
  const stages=Array.from(new Set(eligible.map(f=>stage(String(f.raw?.league?.round||""))).filter(Boolean)));
  const chosenStage=stages.includes(stage(selectedRound))?stage(selectedRound):stages.includes("Clausura")?"Clausura":stages.includes("Regular Season")?"Regular Season":stages[0];
  const games=eligible.filter(f=>stage(String(f.raw?.league?.round||""))===chosenStage);
  const totals=new Map<number,{team_id:number;rank:number;points:number;played:number;goal_difference:number;scored:number;raw:any}>();
  for(const f of games){
   for(const [id,goals,against] of [[f.home_team_id,f.home_goals!,f.away_goals!],[f.away_team_id,f.away_goals!,f.home_goals!]]){
    const row=totals.get(id)||{team_id:id,rank:0,points:0,played:0,goal_difference:0,scored:0,raw:{team:{id}}};
    row.played++;row.points+=goals>against?3:goals===against?1:0;row.goal_difference+=goals-against;row.scored+=goals;totals.set(id,row);
   }
  }
  provisionalStandings=totals.size>0;
  standings=Array.from(totals.values()).sort((a,b)=>b.points-a.points||b.goal_difference-a.goal_difference||b.scored-a.scored).map((row,i)=>({...row,rank:i+1,league_id:league,season}));
 }
 if(standingGroups.length){
  const stage=String(selectedRound).split(" - ")[0].toLowerCase();
  const matching=standingGroups.filter(g=>g.label.toLowerCase().includes(stage));
  if(matching.length)standingGroups=matching;
  standings=standingGroups.flatMap(g=>g.rows);
 }
 if(!standingGroups.length&&standings.length)standingGroups=[{label:provisionalStandings?"Maç sonuçlarından hesaplandı":"Genel puan durumu",rows:standings}];
 const catalog=(catalogResult.data||[]).map(x=>x.name).filter(Boolean);
 const others=sortOverviewLeagues((catalogResult.data||[])).map(l=>l.name).filter(n=>!preferredLeagueNames.includes(n));
 const ids=Array.from(new Set([...matches.flatMap(f=>[f.home_team_id,f.away_team_id]),...standings.map(s=>s.team_id)].filter(Boolean)));
 const {data:names}=ids.length?await db.from("api_football_teams").select("api_team_id,name").in("api_team_id",ids.slice(0,500)):{data:[] as any[]};
 const nameMap=new Map((names||[]).map(t=>[t.api_team_id,t]));
 // Only use the app's own team-logo catalog, via verified API-to-local team mappings.
 const {data:localMatches}=ids.length?await db.from("api_football_team_matches").select("api_team_id,local_team_name").eq("status","matched").in("api_team_id",ids.slice(0,500)):{data:[] as any[]};
 const localNames=Array.from(new Set((localMatches||[]).map(m=>m.local_team_name).filter(Boolean)));
 const {data:localLogos}=localNames.length?await db.from("team_logo_catalog").select("name,image_url").in("name",localNames.slice(0,500)):{data:[] as any[]};
 const logoByName=new Map((localLogos||[]).map(t=>[t.name,t.image_url]));
 const localTeamById=new Map((localMatches||[]).map(t=>[t.api_team_id,t.local_team_name]));
 const logoFor=(id:number)=>logoByName.get(localTeamById.get(id))||"";
 const teamInitials=(name:string)=>name.trim().split(/\s+/).slice(0,2).map(part=>part[0]).join("").toLocaleUpperCase("tr-TR");
 const teamBadge=(id:number,raw:any)=>{const localName=localTeamById.get(id)||nameMap.get(id)?.name||raw?.name||"Takım";const logo=logoFor(id);return logo?<img src={logo} alt={localName+" arması"} loading="lazy"/>:<span aria-label={localName+" arması bulunamadı"} style={{width:28,height:28,display:"inline-grid",placeItems:"center",flexShrink:0,borderRadius:6,background:"#193124",color:"#c6e3cf",fontSize:11,fontWeight:800}}>{teamInitials(localName)}</span>};
 const link=(overrides:Record<string,string>)=>"/futbol?"+new URLSearchParams({league:String(league),...(chosenName?{name:chosenName}:{}),...overrides}).toString();
 const formatDate=(date:string)=>new Intl.DateTimeFormat("tr-TR",{day:"numeric",month:"long",year:"numeric",timeZone:"Europe/Istanbul"}).format(new Date(date+"T12:00:00+03:00"));
 return <AppShell title="Futbol Merkezi" hideTitle><div key={league+"-"+season} className={styles.root}>
  <div className={styles.hero}><div><span className={styles.kicker}>YANIMDAFUTBOL · FUTBOL MERKEZİ</span><h1>Futbolun <em>nabzı.</em></h1><p>Maçlar, sonuçlar ve lig tabloları. Hepsi tek yerde.</p></div><div className={styles.heroIcon}>⚽</div></div>
  <div className={styles.toolbar}><div className={styles.sectionTitle}><h2>Maçlar</h2></div></div>
  <div className={styles.leagueNav}><div className={styles.leagueStrip}>{preferredLeagueNames.map(name=><a key={name} className={(chosenName===name||(!chosenName&&catalogLeagueIds[name]===league))?styles.selected:""} href={link({league:String(catalogLeagueIds[name]||""),name:catalogLeagueIds[name]?"":name})}>{(chosenName===name||(!chosenName&&catalogLeagueIds[name]===league))?<img className={styles.leagueLogo} src={"https://media.api-sports.io/football/leagues/"+catalogLeagueIds[name]+".png"} alt="" loading="lazy" width={24} height={24}/>:null}<span>{name}</span></a>)} </div><LeaguePicker names={others} selected={chosenName||Object.keys(catalogLeagueIds).find(n=>catalogLeagueIds[n]===league)||""} tab="results"/></div>
  <WeekPicker rounds={roundOptions} selected={selectedRound} league={league} name={chosenName}/>
  <div className={styles.layout}><section className={styles.primary}>
  {matches.length?groupedMatches.map(([date,fixtures])=><div className={styles.panel} style={{marginBottom:14}} key={date}><div className={styles.panelTitle}><strong>{formatDate(date)}</strong></div>
  {fixtures.map(f=><Link className={styles.match} href={"/futbol/mac/"+f.fixture_id} key={f.fixture_id}><div className={styles.matchLeague}><span>{dateLabel(f.kickoff)}</span><span>{FINISHED.includes(f.status)?"Maç sonu":LIVE.includes(f.status)?"CANLI "+(f.raw?.fixture?.status?.elapsed||"")+"′":"Başlamadı"}</span></div><div className={styles.matchLine}><div className={styles.teamName}>{teamBadge(f.home_team_id,f.raw?.teams?.home)}<span>{nameMap.get(f.home_team_id)?.name||f.raw?.teams?.home?.name||"Ev sahibi"}</span></div><strong className={styles.score}>{f.home_goals??"–"} <span>:</span> {f.away_goals??"–"}</strong><div className={styles.teamName+" "+styles.away}><span>{nameMap.get(f.away_team_id)?.name||f.raw?.teams?.away?.name||"Deplasman"}</span>{teamBadge(f.away_team_id,f.raw?.teams?.away)}</div></div></Link>)}</div>):<div className={styles.panel}><div className={styles.empty}>{"Bu hafta için maç bulunamadı."}{sourceUnavailable?" API bağlantısı kullanılamadığından kayıtlı veriler kontrol edildi.":""}</div></div>}
  </section>
  <aside className={styles.secondary}><div className={styles.panel}><div className={styles.panelTitle}><strong>{displayLeagueName} · Puan durumu{provisionalStandings?" (maç sonuçlarından hesaplandı)":""}</strong></div><div className={styles.tableHead}><span>Takım</span><span>O</span><span>AV</span><span>P</span></div>{standingGroups.length?standingGroups.map((group,i)=><div key={group.label+"-"+i}><div className={styles.panelTitle}><strong>{group.label}</strong></div>{group.rows.map(s=><Link key={s.team_id+"-"+s.season+"-"+i} href={"/futbol/takim/"+s.team_id} className={styles.tableRow}><span className={styles.tableTeam}><b>{s.rank}</b>{teamBadge(s.team_id,s.raw?.team)}<span>{nameMap.get(s.team_id)?.name||s.raw?.team?.name||"Takım"}</span></span><span>{s.played}</span><span>{s.goal_difference}</span><strong>{s.points}</strong></Link>)}</div>):<div className={styles.empty}>Bu lig için puan durumu bulunamadı.</div>}</div></aside></div>
 </div></AppShell>;
}