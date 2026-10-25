import {NextResponse} from "next/server";
import {createClient} from "@supabase/supabase-js";
export const dynamic="force-dynamic";
export const maxDuration=60;
const PILOT=new Set(["Trendyol Süper Lig","Premier League","LALIGA EA SPORTS","Bundesliga","Serie A Enilive","Eredivisie","Ligue 1 McDonald's","Liga Portugal","EFL Championship","Bundesliga 2","Serie BKT","MLS","ROSHN Saudi League","Scottish Premiership","1A Pro League"]);
const ALIASES:Record<string,string[]>={
 "3. Liga":["3. Liga"],"Brack Super League":["Super League","Swiss Super League"],"Česká Liga":["Czech Liga","1. Liga"],"CSL":["Chinese Super League","Super League"],"Finnliiga":["Veikkausliiga"],"Hellas Liga":["Super League 1"],"ISL":["Indian Super League"],"Isuzu UTE A League":["A-League"],"K League 1":["K League 1"],"LALIGA HYPERMOTION":["Segunda División","Segunda Division"],"Liga BBVA MX":["Liga MX"],"Liga do Brasil":["Serie A"],"Liga Hrvatska":["HNL"],"Ligue 2 BKT":["Ligue 2"],"LPF":["Liga Profesional Argentina"],"Ö. Bundesliga":["Bundesliga"],"SSE Airtricity Men's Premier Division":["Premier Division"],"SUPERLIGA":["Superliga"],"Ukrayina Liha":["Premier League"],"United Emirates League":["Pro League"],"Metropolitan Division":["Metropolitan Division"]};
// Country constraints prevent identically named leagues from different countries being treated as valid candidates.
const COUNTRIES:Record<string,string>={
 "3. Liga":"Germany","Allsvenskan":"Sweden","Brack Super League":"Switzerland","CSL":"China",
 "Ekstraklasa":"Poland","Eliteserien":"Norway","Finnliiga":"Finland","Hellas Liga":"Greece",
 "ISL":"India","Isuzu UTE A League":"Australia","K League 1":"South-Korea",
 "LALIGA HYPERMOTION":"Spain","Liga BBVA MX":"Mexico","Liga do Brasil":"Brazil",
 "Liga Hrvatska":"Croatia","Ligue 2 BKT":"France","LPF":"Argentina",
 "Ö. Bundesliga":"Austria","SSE Airtricity Men's Premier Division":"Ireland",
 "Ukrayina Liha":"Ukraine","United Emirates League":"United-Arab-Emirates",
 "Česká Liga":"Czech-Republic","CONMEBOL Libertadores":"World","CONMEBOL Sudamericana":"World"
};
function norm(s:string){return s.normalize("NFD").replace(/[\u0300-\u036f]/g,"").toLowerCase().replace(/[^a-z0-9]/g,"")}
async function handle(req:Request){
 const token=req.headers.get("authorization")?.replace(/^Bearer /,"");
 if(!token)return NextResponse.json({error:"Unauthorized"},{status:401});
 const url=process.env.SUPABASE_URL||process.env.NEXT_PUBLIC_SUPABASE_URL;
 const secret=process.env.SUPABASE_SERVICE_ROLE_KEY||process.env.SUPABASE_SECRET_KEY;
 const key=process.env.API_FOOTBALL_KEY;
 if(!url||!secret||!key)return NextResponse.json({error:"Server configuration incomplete"},{status:503});
 const db=createClient(url,secret,{auth:{persistSession:false}});
 const {data:{user},error}=await db.auth.getUser(token);
 if(error||user?.email?.toLowerCase()!=="gemini.btk@gmail.com")return NextResponse.json({error:"Forbidden"},{status:403});
 const {data:catalog,error:catalogError}=await db.from("team_catalog_summary").select("league").limit(1000);
 if(catalogError)return NextResponse.json({error:catalogError.message},{status:502});
 const leagues=Array.from(new Set((catalog||[]).map(x=>String(x.league||"")))).filter(x=>x&&!PILOT.has(x)).sort();
 const response=await fetch("https://v3.football.api-sports.io/leagues?season=2026",{headers:{"x-apisports-key":key},cache:"no-store",signal:AbortSignal.timeout(20000)});
 if(!response.ok)return NextResponse.json({error:"API HTTP "+response.status},{status:502});
 const json=await response.json();
 if(json.errors&&Object.keys(json.errors).length)return NextResponse.json({error:"API-Football error",details:json.errors},{status:502});
 const available=(json.response||[]).map((x:any)=>({id:x.league?.id,name:String(x.league?.name||""),country:String(x.country?.name||""),type:x.league?.type,seasons:x.seasons?.filter((s:any)=>s.year===2026).map((s:any)=>({year:s.year,coverage:s.coverage}))||[]}));
 const results=leagues.map(league=>{
  const keys=[league,...(ALIASES[league]||[])].map(norm);
  const candidates=available.filter((x:any)=>keys.includes(norm(x.name))&&(!COUNTRIES[league]||norm(x.country)===norm(COUNTRIES[league])));
  return {league,candidates,status:candidates.length===1?"candidate":candidates.length>1?"review":"not_found"};
 });
 const teamBatch=new URL(req.url).searchParams.get("teamBatch");
 if(teamBatch!==null){
  const batch=Number(teamBatch);
  if(!Number.isInteger(batch)||batch<0||batch>4)return NextResponse.json({error:"Invalid team batch"},{status:400});
  const eligible=results.filter(x=>x.status==="candidate"&&x.candidates[0]?.type==="League");
  const selected=eligible.slice(batch*5,batch*5+5);
  const {data:localTeams,error:localError}=await db.from("team_catalog_summary").select("name,league").limit(1000);
  if(localError)return NextResponse.json({error:localError.message},{status:502});
  const reports=[];
  const persist=req.method==="POST";
  for(const item of selected){
   const candidate=item.candidates[0];
   try{
    const res=await fetch("https://v3.football.api-sports.io/teams?league="+candidate.id+"&season=2026",{headers:{"x-apisports-key":key},cache:"no-store",signal:AbortSignal.timeout(10000)});
    if(!res.ok)throw new Error("API HTTP "+res.status);
    const payload=await res.json();
    if(payload.errors&&Object.keys(payload.errors).length)throw new Error("API error");
    const apiTeams=(payload.response||[]).map((x:any)=>({id:x.team?.id,name:String(x.team?.name||"")}));
    const locals=(localTeams||[]).filter(x=>x.league===item.league).map(x=>String(x.name));
    const used=new Set<string>();
    const comparisons=apiTeams.map((t:any)=>{
     const matches=locals.filter(n=>norm(n)===norm(t.name));
     const matched=matches.length===1&&!used.has(matches[0]);
     if(matched)used.add(matches[0]);
     return {apiId:t.id,apiName:t.name,localName:matched?matches[0]:null,status:matched?"exact":"review"};
    });
    let saved=0;
    if(persist){
     const exact=comparisons.filter((x:any)=>x.status==="exact"&&Number.isSafeInteger(Number(x.apiId))&&Number(x.apiId)>0);
     const ids=apiTeams.map((x:any)=>Number(x.id)).filter((x:number)=>Number.isSafeInteger(x)&&x>0);
     const {data:prior,error:priorError}=await db.from("api_football_team_matches").select("api_team_id,local_team_name,local_league_name,status").in("api_team_id",ids);
     if(priorError)throw new Error(priorError.message);
     const byId=new Map((prior||[]).map((x:any)=>[Number(x.api_team_id),x]));
     const safe=exact.filter((x:any)=>{const old:any=byId.get(Number(x.apiId));return !old||(old.status==="matched"&&old.local_team_name===x.localName&&old.local_league_name===item.league)});
     const teamRows=safe.map((x:any)=>({api_team_id:Number(x.apiId),name:x.apiName,league_id:candidate.id,season:2026}));
     const matchRows=safe.map((x:any)=>({api_team_id:Number(x.apiId),local_team_name:x.localName,local_league_name:item.league,status:"matched",candidates:[{name:x.localName,league:item.league}]}));
     if(teamRows.length){
      const {error:teamError}=await db.from("api_football_teams").upsert(teamRows,{onConflict:"api_team_id"});
      if(teamError)throw new Error(teamError.message);
      const {error:matchError}=await db.from("api_football_team_matches").upsert(matchRows,{onConflict:"api_team_id"});
      if(matchError)throw new Error(matchError.message);
      saved=matchRows.length;
     }
    }
    reports.push({league:item.league,apiLeagueId:candidate.id,apiTeams:apiTeams.length,localTeams:locals.length,exact:comparisons.filter((x:any)=>x.status==="exact").length,review:comparisons.filter((x:any)=>x.status==="review").length,saved,comparisons});
   }catch(e){reports.push({league:item.league,error:e instanceof Error?e.message:"Unknown error"})}
  }
  return NextResponse.json({season:2026,batch,eligibleLeagues:eligible.length,reports,notice:persist?"Exact matches saved to API-Football mapping tables only; scouting unchanged.":"Read-only exact-name comparison; no team links or scouting data modified."},{headers:{"Cache-Control":"no-store"}});
 }
 return NextResponse.json({season:2026,totalCatalogLeagues:leagues.length+PILOT.size,remaining:leagues.length,availableApiLeagues:available.length,results,notice:"Discovery only. No team matches or scouting data changed. Candidate IDs require review."},{headers:{"Cache-Control":"no-store"}});
}
\nexport async function GET(req:Request){return handle(req)}\nexport async function POST(req:Request){return handle(req)}\n