import {NextResponse} from "next/server";
import {createClient} from "@supabase/supabase-js";
export const dynamic="force-dynamic";
export const maxDuration=60;
const PILOT=new Set(["Trendyol Süper Lig","Premier League","LALIGA EA SPORTS","Bundesliga","Serie A Enilive","Eredivisie","Ligue 1 McDonald's","Liga Portugal","EFL Championship","Bundesliga 2","Serie BKT","MLS","ROSHN Saudi League","Scottish Premiership","1A Pro League"]);
const ALIASES:Record<string,string[]>={
 "3. Liga":["3. Liga"],"Brack Super League":["Super League","Swiss Super League"],"Česká Liga":["Czech Liga","1. Liga"],"CSL":["Chinese Super League","Super League"],"Finnliiga":["Veikkausliiga"],"Hellas Liga":["Super League 1"],"ISL":["Indian Super League"],"Isuzu UTE A League":["A-League"],"K League 1":["K League 1"],"LALIGA HYPERMOTION":["Segunda División","Segunda Division"],"Liga BBVA MX":["Liga MX"],"Liga do Brasil":["Serie A"],"Liga Hrvatska":["HNL"],"Ligue 2 BKT":["Ligue 2"],"LPF":["Liga Profesional Argentina"],"Ö. Bundesliga":["Bundesliga"],"SSE Airtricity Men's Premier Division":["Premier Division"],"SUPERLIGA":["Superliga"],"Ukrayina Liha":["Premier League"],"United Emirates League":["Pro League"],"Metropolitan Division":["Metropolitan Division"]};
function norm(s:string){return s.normalize("NFD").replace(/[\u0300-\u036f]/g,"").toLowerCase().replace(/[^a-z0-9]/g,"")}
export async function GET(req:Request){
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
 const leagues=[...new Set((catalog||[]).map(x=>String(x.league||"")))].filter(x=>x&&!PILOT.has(x)).sort();
 const response=await fetch("https://v3.football.api-sports.io/leagues?season=2026",{headers:{"x-apisports-key":key},cache:"no-store",signal:AbortSignal.timeout(20000)});
 if(!response.ok)return NextResponse.json({error:"API HTTP "+response.status},{status:502});
 const json=await response.json();
 if(json.errors&&Object.keys(json.errors).length)return NextResponse.json({error:"API-Football error",details:json.errors},{status:502});
 const available=(json.response||[]).map((x:any)=>({id:x.league?.id,name:String(x.league?.name||""),country:String(x.country?.name||""),type:x.league?.type,seasons:x.seasons?.filter((s:any)=>s.year===2026).map((s:any)=>({year:s.year,coverage:s.coverage}))||[]}));
 const results=leagues.map(league=>{
  const keys=[league,...(ALIASES[league]||[])].map(norm);
  const candidates=available.filter((x:any)=>keys.includes(norm(x.name)));
  return {league,candidates,status:candidates.length===1?"candidate":candidates.length>1?"review":"not_found"};
 });
 return NextResponse.json({season:2026,totalCatalogLeagues:leagues.length+PILOT.size,remaining:leagues.length,availableApiLeagues:available.length,results,notice:"Discovery only. No team matches or scouting data changed. Candidate IDs require review."},{headers:{"Cache-Control":"no-store"}});
}
