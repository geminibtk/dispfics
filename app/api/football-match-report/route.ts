import {NextResponse} from "next/server";
import {createClient} from "@supabase/supabase-js";

export const dynamic="force-dynamic";
export const maxDuration=60;
const LEAGUES=[{id:203,name:"Trendyol Süper Lig"},{id:39,name:"Premier League"},{id:140,name:"LALIGA EA SPORTS"},{id:78,name:"Bundesliga"},{id:135,name:"Serie A Enilive"}];
function normalize(value:string){return String(value||"").normalize("NFD").replace(/[\u0300-\u036f]/g,"").replace(/ı/g,"i").toLowerCase().replace(/[^a-z0-9]/g,"")}
export async function GET(req:Request){
 const auth=req.headers.get("authorization");
 if(!auth?.startsWith("Bearer "))return NextResponse.json({error:"Unauthorized"},{status:401});
 const url=process.env.SUPABASE_URL||process.env.NEXT_PUBLIC_SUPABASE_URL;
 const secret=process.env.SUPABASE_SERVICE_ROLE_KEY||process.env.SUPABASE_SECRET_KEY;
 const apiKey=process.env.API_FOOTBALL_KEY;
 if(!url||!secret||!apiKey)return NextResponse.json({error:"Server configuration incomplete"},{status:503});
 const db=createClient(url,secret,{auth:{persistSession:false}});
 const {data:{user},error:authError}=await db.auth.getUser(auth.slice(7));
 if(authError||user?.email?.toLowerCase()!=="gemini.btk@gmail.com")return NextResponse.json({error:"Forbidden"},{status:403});
 const {data:catalog,error:catalogError}=await db.from("team_catalog_summary").select("name,league").limit(1000);
 if(catalogError)return NextResponse.json({error:"Team catalog unavailable"},{status:502});
 const existing=(catalog||[]).map(x=>({name:String(x.name),league:String(x.league||""),key:normalize(String(x.name))}));
 const reports=[];
 for(const league of LEAGUES){
  const response=await fetch("https://v3.football.api-sports.io/teams?league="+league.id+"&season=2025",{headers:{"x-apisports-key":apiKey},cache:"no-store",signal:AbortSignal.timeout(12000)});
  if(!response.ok){reports.push({league:league.name,error:"API HTTP "+response.status});continue}
  const json=await response.json();
  if(json.errors&&(Array.isArray(json.errors)?json.errors.length:Object.keys(json.errors).length)){reports.push({league:league.name,error:"API returned an error",details:json.errors});continue}
  const teams=Array.isArray(json.response)?json.response:[];
  let matched=0;const ambiguous:string[]=[];const unmatched:string[]=[];const examples:{api:string,local:string}[]=[];
  for(const entry of teams){
   const name=String(entry.team?.name||"");const key=normalize(name);
   const candidates=existing.filter(x=>x.key===key);
   if(candidates.length===1){matched++;if(examples.length<8)examples.push({api:name,local:candidates[0].name})}
   else if(candidates.length>1)ambiguous.push(name);
   else unmatched.push(name);
  }
  reports.push({league:league.name,apiLeagueId:league.id,season:2025,apiTeams:teams.length,exactNameMatches:matched,ambiguous,unmatched,examples});
 }
 return NextResponse.json({mode:"read-only",existingTeams:existing.length,report:reports,notice:"Exact normalized names only; no automatic database linking or updates."},{headers:{"Cache-Control":"no-store"}});
}
