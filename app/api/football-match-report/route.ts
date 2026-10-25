import {NextResponse} from "next/server";
import {createClient} from "@supabase/supabase-js";

export const dynamic="force-dynamic";
export const maxDuration=60;
const LEAGUES=[{id:203,name:"Trendyol Süper Lig"},{id:39,name:"Premier League"},{id:140,name:"LALIGA EA SPORTS"},{id:78,name:"Bundesliga"},{id:135,name:"Serie A Enilive"}];
function normalize(value:string){return String(value||"").normalize("NFD").replace(/[\u0300-\u036f]/g,"").replace(/ı/g,"i").toLowerCase().replace(/[^a-z0-9]/g,"")}
const ALIASES:Record<number,Record<string,string>>={
 203:{basaksehir:"İstanbul Başakşehir FK",alanyaspor:"Corendon Alanyaspor"},
 140:{barcelona:"FC Barcelona",atleticomadrid:"Atlético de Madrid"},
 78:{bayerleverkusen:"Bayer 04 Leverkusen"},
 135:{acmilan:"Milano FC",asroma:"Roma"}
};
function candidatesFor(name:string,league:{id:number,name:string},existing:{name:string,league:string,key:string}[]){
 const key=normalize(name);
 const scoped=existing.filter(x=>x.league===league.name);
 const exact=scoped.filter(x=>x.key===key);
 if(exact.length)return {candidates:exact,method:"exact"};
 const alias=ALIASES[league.id]?.[key];
 if(alias){const found=scoped.filter(x=>x.key===normalize(alias));if(found.length)return {candidates:found,method:"alias"}}
 // Only suggest potential matches for review; never mark them as confirmed.
 const suggestions=scoped.filter(x=>x.key.includes(key)||key.includes(x.key)).filter(x=>Math.min(x.key.length,key.length)>=6);
 return {candidates:suggestions,method:"review"};
}
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
  const response=await fetch("https://v3.football.api-sports.io/teams?league="+league.id+"&season=2026",{headers:{"x-apisports-key":apiKey},cache:"no-store",signal:AbortSignal.timeout(12000)});
  if(!response.ok){reports.push({league:league.name,error:"API HTTP "+response.status});continue}
  const json=await response.json();
  if(json.errors&&(Array.isArray(json.errors)?json.errors.length:Object.keys(json.errors).length)){reports.push({league:league.name,error:"API returned an error",details:json.errors});continue}
  const teams=Array.isArray(json.response)?json.response:[];
  let matched=0;let aliasMatches=0;const ambiguous:string[]=[];const unmatched:string[]=[];const examples:{api:string,local:string}[]=[];
  const teamRows:any[]=[];const matchRows:any[]=[];
  for(const entry of teams){
   const name=String(entry.team?.name||"");
   const {candidates,method}=candidatesFor(name,league,existing);
   const confirmed=(method==="exact"||method==="alias")&&candidates.length===1;
   if(confirmed&&method==="alias")aliasMatches++;
   const id=Number(entry.team?.id);
   if(Number.isSafeInteger(id)&&id>0){teamRows.push({api_team_id:id,name,country:entry.team?.country||null,logo:entry.team?.logo||null,league_id:league.id,season:2026,raw:entry.team});matchRows.push({api_team_id:id,local_team_name:confirmed?candidates[0].name:null,local_league_name:confirmed?candidates[0].league:null,status:confirmed?"matched":candidates.length?"ambiguous":"unmatched",candidates:candidates.map(x=>({name:x.name,league:x.league}))})}
   if(confirmed){matched++;if(examples.length<8)examples.push({api:name,local:candidates[0].name})}
   else if(candidates.length)ambiguous.push(name);
   else unmatched.push(name);
  }
  if(teamRows.length){const {error:teamError}=await db.from("api_football_teams").upsert(teamRows,{onConflict:"api_team_id"});if(teamError){reports.push({league:league.name,error:"Takımlar kaydedilemedi: "+teamError.message});continue}const {error:matchError}=await db.from("api_football_team_matches").upsert(matchRows,{onConflict:"api_team_id"});if(matchError){reports.push({league:league.name,error:"Eşleştirmeler kaydedilemedi: "+matchError.message});continue}}
  reports.push({league:league.name,apiLeagueId:league.id,season:2026,apiTeams:teams.length,confirmedMatches:matched,aliasMatches,ambiguous,unmatched,examples,saved:teamRows.length});
 }
 return NextResponse.json({mode:"api-catalog-persisted",existingTeams:existing.length,report:reports,notice:"API teams and matching candidates saved separately. Existing scouting records untouched."},{headers:{"Cache-Control":"no-store"}});
}
