import Link from "next/link";
import AppShell from "../../../components/AppShell";
import {notFound} from "next/navigation";
import {footballDb,leagueName,dateLabel} from "../../../../lib/football-center";
import styles from "../../style.module.css";
import MatchDetailTabs from "../../MatchDetailTabs";
export const dynamic="force-dynamic";
const FINISHED=["FT","AET","PEN"];
const statusTR:Record<string,string>={NS:"Başlamadı",FT:"Maç sona erdi",AET:"Uzatmalar sonrası",PEN:"Penaltılar sonrası",HT:"Devre arası","1H":"İlk yarı","2H":"İkinci yarı",PST:"Ertelendi",CANC:"İptal edildi"};
export default async function MatchPage({params}:{params:Promise<{id:string}>}){
 const {id}=await params;const fixtureId=Number(id);if(!Number.isSafeInteger(fixtureId)||fixtureId<=0)notFound();
 const db=footballDb();
 const {data:stored}=await db.from("api_football_fixtures").select("*").eq("fixture_id",fixtureId).maybeSingle();
 let f:any=stored;let current=false;
 let events:any[]=[],statistics:any[]=[],lineups:any[]=[],playerStats:any[]=[];
 if(process.env.API_FOOTBALL_KEY){
  try{
   const res=await fetch("https://v3.football.api-sports.io/fixtures?id="+fixtureId,{headers:{"x-apisports-key":process.env.API_FOOTBALL_KEY},next:{revalidate:60},signal:AbortSignal.timeout(9000)});
   const json=await res.json();
   if(!res.ok||Object.keys(json.errors||{}).length)throw new Error("API error");
   const x=json.response?.[0];
   if(x){
    f={fixture_id:x.fixture.id,league_id:x.league.id,season:x.league.season,kickoff:x.fixture.date,status:x.fixture.status.short,home_team_id:x.teams.home.id,away_team_id:x.teams.away.id,home_goals:x.goals.home,away_goals:x.goals.away,raw:x};
    current=true;events=x.events||[];statistics=x.statistics||[];lineups=x.lineups||[];
   }
  }catch{}
 }
 if(current&&process.env.API_FOOTBALL_KEY){
  try{const res=await fetch("https://v3.football.api-sports.io/fixtures/players?fixture="+fixtureId,{headers:{"x-apisports-key":process.env.API_FOOTBALL_KEY},next:{revalidate:120},signal:AbortSignal.timeout(8500)});const json=await res.json();if(res.ok&&!Object.keys(json.errors||{}).length)playerStats=json.response||[]}catch{}
 }
 if(!f)notFound();
 const home=f.raw?.teams?.home,away=f.raw?.teams?.away;
 const logo=(team:any,id:number)=>team?.logo||"https://media.api-sports.io/football/teams/"+id+".png";
 const display=(v:any)=>v===null||v===undefined?"–":String(v);
 const score=f.raw?.score||{};
 const eventNames:Record<string,string>={Goal:"Gol",Card:"Kart",subst:"Oyuncu değişikliği",Var:"VAR kararı"};
 const detailNames:Record<string,string>={"Yellow Card":"Sarı kart","Red Card":"Kırmızı kart","Normal Goal":"Gol","Own Goal":"Kendi kalesine gol","Penalty":"Penaltı golü","Missed Penalty":"Kaçan penaltı","Substitution 1":"Oyuncu değişikliği","Substitution 2":"Oyuncu değişikliği","Substitution 3":"Oyuncu değişikliği","Substitution 4":"Oyuncu değişikliği","Substitution 5":"Oyuncu değişikliği"};
 const statNames:Record<string,string>={"Shots on Goal":"İsabetli şut","Shots off Goal":"İsabetsiz şut","Total Shots":"Toplam şut","Blocked Shots":"Engellenen şut","Shots insidebox":"Ceza sahası içinden şut","Shots outsidebox":"Ceza sahası dışından şut","Fouls":"Fauller","Corner Kicks":"Kornerler","Offsides":"Ofsaytlar","Ball Possession":"Topa sahip olma","Yellow Cards":"Sarı kartlar","Red Cards":"Kırmızı kartlar","Goalkeeper Saves":"Kaleci kurtarışları","Total passes":"Toplam pas","Passes accurate":"İsabetli pas","Passes %":"Pas isabet oranı","expected_goals":"Beklenen gol (xG)","goals_prevented":"Engellenen gol"};
 const ratingFor=(teamId:number,playerId:number)=>{const team=playerStats.find((t:any)=>t.team?.id===teamId);const player=team?.players?.find((p:any)=>p.player?.id===playerId);const raw=player?.statistics?.[0]?.games?.rating;const n=Number(raw);return Number.isFinite(n)&&n>0?n.toFixed(1):null};
 const shortName=(name:string|undefined)=>{if(!name)return "Bilinmiyor";const parts=name.trim().split(/\s+/);return parts.length>1?parts.slice(1).join(" "):name};
 const pitchRows=(team:any)=>{const players=team.startXI||[];const grouped=new Map<number,any[]>();for(const item of players){const row=Number(String(item.player?.grid||"").split(":")[0]);const key=Number.isFinite(row)&&row>0?row:99;if(!grouped.has(key))grouped.set(key,[]);grouped.get(key)!.push(item)}return Array.from(grouped.entries()).sort((a,b)=>a[0]-b[0]).map(x=>x[1])};

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
 <MatchDetailTabs teams={lineups.map((t:any)=>({id:t.team?.id||0,name:t.team?.name||"Takım",logo:logo(t.team,t.team?.id),formation:t.formation||"Diziliş açıklanmadı",players:(t.startXI||[]).map((p:any)=>({id:p.player?.id||0,name:shortName(p.player?.name),number:p.player?.number??null,grid:p.player?.grid||"",rating:ratingFor(t.team?.id,p.player?.id),photo:"https://media.api-sports.io/football/players/"+p.player?.id+".png"}))}))} stats={Array.from(new Set(statistics.flatMap((t:any)=>t.statistics?.map((x:any)=>x.type)||[]))).map((type:any)=>({label:statNames[String(type)]||"Diğer istatistik",home:display(statistics[0]?.statistics?.find((x:any)=>x.type===type)?.value),away:display(statistics[1]?.statistics?.find((x:any)=>x.type===type)?.value)}))} events={events.map((e:any)=>({minute:String(e.time?.elapsed??"–")+"′"+(e.time?.extra?" +"+e.time.extra:""),team:e.team?.name||"Takım",player:shortName(e.player?.name),assist:shortName(e.assist?.name),type:e.type,detail:e.type==="subst"?"":detailNames[e.detail]||eventNames[e.type]||"Maç olayı"}))}/>
 {current&&!events.length&&!statistics.length&&!lineups.length&&<p style={{color:"#92aa99",fontSize:13,marginTop:18}}>{FINISHED.includes(f.status)?"API-Football bu karşılaşma için ayrıntılı olay, istatistik veya kadro verisi döndürmedi.":"Maç olayları, istatistikler ve kadrolar API-Football tarafından sağlandığında burada gösterilecek."}</p>}
 </div></AppShell>;
}
