import {NextResponse} from "next/server";
import {createClient} from "@supabase/supabase-js";
export const dynamic="force-dynamic";
export const maxDuration=60;
const PAGE_SIZE=10;
export async function GET(req:Request){
 const token=req.headers.get("authorization")?.replace(/^Bearer /,"");
 if(!token)return NextResponse.json({error:"Unauthorized"},{status:401});
 const url=process.env.SUPABASE_URL||process.env.NEXT_PUBLIC_SUPABASE_URL;
 const secret=process.env.SUPABASE_SERVICE_ROLE_KEY||process.env.SUPABASE_SECRET_KEY;
 const key=process.env.API_FOOTBALL_KEY;
 if(!url||!secret||!key)return NextResponse.json({error:"Missing server configuration"},{status:503});
 const db=createClient(url,secret,{auth:{persistSession:false}});
 const {data:{user},error:authError}=await db.auth.getUser(token);
 if(authError||user?.email?.toLowerCase()!=="gemini.btk@gmail.com")return NextResponse.json({error:"Forbidden"},{status:403});
 const search=new URL(req.url).searchParams;
 const targetTeam=search.get("team");
 if(targetTeam!==null&&targetTeam!=="2994")return NextResponse.json({error:"Unsupported team"},{status:400});
 const page=Number(search.get("page")||"0");
 if(!Number.isSafeInteger(page)||page<0||page>1000)return NextResponse.json({error:"Invalid page"},{status:400});
 let query=db.from("api_football_team_matches").select("api_team_id,local_team_name").eq("status","matched").order("api_team_id");
 if(targetTeam)query=query.eq("api_team_id",2994);
 else query=query.range(page*PAGE_SIZE,(page+1)*PAGE_SIZE-1);
 const {data:matches,error}=await query;
 if(error)return NextResponse.json({error:error.message},{status:500});
 const results:any[]=[];
 for(const match of matches||[]){
  const id=Number(match.api_team_id);
  const result:any={team:match.local_team_name,id,saved:[],errors:[]};
  const {data:metadata}=await db.from("api_football_teams").select("league_id,season").eq("api_team_id",id).maybeSingle();
  const tasks:{type:"team"|"squad"|"statistics";season:number;path:string}[]=[
   {type:"team",season:0,path:"teams?id="+id},
   {type:"squad",season:0,path:"players/squads?team="+id}
  ];
  if(metadata?.league_id&&metadata?.season)tasks.push({type:"statistics",season:metadata.season,path:"teams/statistics?team="+id+"&league="+metadata.league_id+"&season="+metadata.season});
  for(const task of tasks){
   try{
    const response=await fetch("https://v3.football.api-sports.io/"+task.path,{headers:{"x-apisports-key":key},cache:"no-store",signal:AbortSignal.timeout(9000)});
    if(!response.ok)throw new Error("HTTP "+response.status);
    const body=await response.json();
    if(body.errors&&Object.keys(body.errors).length)throw new Error(JSON.stringify(body.errors));
    if(!body.response||(Array.isArray(body.response)&&body.response.length===0))throw new Error("No data");
    const {error:saveError}=await db.from("api_football_team_data").upsert({api_team_id:id,data_type:task.type,season:task.season,payload:body.response,fetched_at:new Date().toISOString()},{onConflict:"api_team_id,data_type,season"});
    if(saveError)throw saveError;
    if(task.type==="squad"){
     const squad=body.response?.[0]?.players;
     if(!Array.isArray(squad))throw new Error("Invalid squad response");
     const {error:stageError}=await db.from("api_football_team_squads_staging").upsert({api_team_id:id,local_team_name:match.local_team_name,players:squad,source_endpoint:"players/squads",source_season:null,fetched_at:new Date().toISOString()},{onConflict:"api_team_id"});
     if(stageError)throw stageError;
    }
    result.saved.push(task.type);
   }catch(e){result.errors.push(task.type+": "+(e instanceof Error?e.message:"Unknown error"))}
  }
  results.push(result);
 }
 return NextResponse.json({page,pageSize:PAGE_SIZE,processed:results.length,nextPage:results.length===PAGE_SIZE?page+1:null,results},{headers:{"Cache-Control":"no-store"}});
}
