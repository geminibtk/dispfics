import {NextResponse} from "next/server";
import {createClient} from "@supabase/supabase-js";
export const dynamic="force-dynamic";
export const maxDuration=60;
const LEAGUES=[203,39,140,78,135];
const SECOND_A=[88,61,94,40,79];
const SECOND_B=[136,253,307,179,144];
export async function GET(req:Request){
 const token=req.headers.get("authorization")?.replace(/^Bearer /,"");
 if(!token)return NextResponse.json({error:"Unauthorized"},{status:401});
 const url=process.env.SUPABASE_URL||process.env.NEXT_PUBLIC_SUPABASE_URL;
 const secret=process.env.SUPABASE_SERVICE_ROLE_KEY||process.env.SUPABASE_SECRET_KEY;
 const apiKey=process.env.API_FOOTBALL_KEY;
 if(!url||!secret||!apiKey)return NextResponse.json({error:"Server configuration incomplete"},{status:503});
 const db=createClient(url,secret,{auth:{persistSession:false}});
 const {data:{user}}=await db.auth.getUser(token);
 if(user?.email?.toLowerCase()!=="gemini.btk@gmail.com")return NextResponse.json({error:"Forbidden"},{status:403});
 const batch=new URL(req.url).searchParams.get("batch");
 const selected=batch==="second-a"?SECOND_A:batch==="second-b"?SECOND_B:LEAGUES;
 if(new URL(req.url).searchParams.get("audit")==="1"){
  const ids=[203,39,140,78,135,88,61,94,40,79,136,253,307,179,144];
  const audits:any[]=[];
  for(const league of ids){
   const [{data:teams,error:teamError},{data:fixtures,error:fixtureError},{data:standings,error:standingError}]=await Promise.all([
    db.from("api_football_teams").select("api_team_id").eq("league_id",league).eq("season",2026),
    db.from("api_football_fixtures").select("fixture_id").eq("league_id",league).eq("season",2026),
    db.from("api_football_standings").select("team_id").eq("league_id",league).eq("season",2026)
   ]);
   if(teamError||fixtureError||standingError){audits.push({league,error:[teamError?.message,fixtureError?.message,standingError?.message].filter(Boolean).join("; ")});continue}
   const teamIds=(teams||[]).map(x=>x.api_team_id);
   let matched=0;
   if(teamIds.length){const {data:matches,error:matchError}=await db.from("api_football_team_matches").select("api_team_id").in("api_team_id",teamIds).eq("status","matched");if(matchError){audits.push({league,error:matchError.message});continue}matched=matches?.length||0}
   audits.push({league,teams:teamIds.length,matched,unresolved:teamIds.length-matched,fixtures:fixtures?.length||0,standings:standings?.length||0});
  }
  return NextResponse.json({season:2026,audits},{headers:{"Cache-Control":"no-store"}});
 }
 const results:any[]=[];
 for(const league of selected){
  const result:any={league,fixtures:0,standings:0};
  for(const kind of ["fixtures","standings"]){
   try{
    const response=await fetch("https://v3.football.api-sports.io/"+kind+"?league="+league+"&season=2026",{headers:{"x-apisports-key":apiKey},cache:"no-store",signal:AbortSignal.timeout(15000)});
    if(!response.ok)throw new Error("API HTTP "+response.status);
    const json=await response.json();
    if(json.errors&&Object.keys(json.errors).length)throw new Error(JSON.stringify(json.errors));
    if(kind==="fixtures"){
     const rows=(json.response||[]).map((x:any)=>({fixture_id:x.fixture.id,league_id:league,season:2026,kickoff:x.fixture.date,status:x.fixture.status?.short||null,home_team_id:x.teams.home?.id,away_team_id:x.teams.away?.id,home_goals:x.goals.home,away_goals:x.goals.away,raw:x,fetched_at:new Date().toISOString()}));
     for(let i=0;i<rows.length;i+=200){const {error}=await db.from("api_football_fixtures").upsert(rows.slice(i,i+200),{onConflict:"fixture_id"});if(error)throw error}
     result.fixtures=rows.length;
    }else{
     const rows=(json.response?.[0]?.league?.standings||[]).flat().map((x:any)=>({league_id:league,season:2026,team_id:x.team.id,rank:x.rank,points:x.points,played:x.all?.played,wins:x.all?.win,draws:x.all?.draw,losses:x.all?.lose,goal_difference:x.goalsDiff,raw:x,fetched_at:new Date().toISOString()}));
     if(rows.length){const {error}=await db.from("api_football_standings").upsert(rows,{onConflict:"league_id,season,team_id"});if(error)throw error}
     result.standings=rows.length;
    }
   }catch(e){result[kind+"Error"]=e instanceof Error?e.message:"Unknown error"}
  }
  results.push(result);
 }
 return NextResponse.json({season:2026,results},{headers:{"Cache-Control":"no-store"}});
}
