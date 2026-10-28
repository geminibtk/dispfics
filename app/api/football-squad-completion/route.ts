import {NextResponse} from "next/server";
import {createClient} from "@supabase/supabase-js";
export const dynamic="force-dynamic";
export const maxDuration=60;
const BATCH=5;
export async function GET(req:Request){
 const token=req.headers.get("authorization")?.replace(/^Bearer /,"");
 if(!token)return NextResponse.json({error:"Unauthorized"},{status:401});
 const url=process.env.SUPABASE_URL||process.env.NEXT_PUBLIC_SUPABASE_URL;
 const secret=process.env.SUPABASE_SERVICE_ROLE_KEY||process.env.SUPABASE_SECRET_KEY;
 const key=process.env.API_FOOTBALL_KEY;
 if(!url||!secret||!key)return NextResponse.json({error:"Missing configuration"},{status:503});
 const db=createClient(url,secret,{auth:{persistSession:false}});
 const {data:{user},error:authError}=await db.auth.getUser(token);
 if(authError||user?.email?.toLowerCase()!=="gemini.btk@gmail.com")return NextResponse.json({error:"Forbidden"},{status:403});
 const {data:rows,error}=await db.from("api_football_team_squads_staging").select("api_team_id,local_team_name,source_endpoint,players").eq("source_endpoint","players").order("api_team_id").limit(1000);
 if(error)return NextResponse.json({error:error.message},{status:500});
 const pending=(rows||[]).filter(x=>Array.isArray(x.players)&&x.players.length===20);
 const results:any[]=[];
 for(const team of pending.slice(0,BATCH)){
  const id=Number(team.api_team_id);
  const result:any={api_team_id:id,team:team.local_team_name,old_count:20};
  try{
   const response=await fetch("https://v3.football.api-sports.io/players/squads?team="+id,{headers:{"x-apisports-key":key},cache:"no-store",signal:AbortSignal.timeout(9000)});
   if(!response.ok)throw new Error("API HTTP "+response.status);
   const body=await response.json();
   if(body.errors&&Object.keys(body.errors).length)throw new Error(JSON.stringify(body.errors));
   let squad=body.response?.find((r:any)=>Number(r.team?.id)===id)?.players;
   let endpoint="players/squads";
   let season:number|null=null;
   if(!Array.isArray(squad)||squad.length===0){
    const {data:metadata}=await db.from("api_football_teams").select("season").eq("api_team_id",id).maybeSingle();
    season=Number(metadata?.season)||2026;
    const collected=new Map<number,any>();
    for(let page=1;page<=15;page++){
     const apiUrl="https://v3.football.api-sports.io/players?team="+id+"&season="+season+"&page="+page;
     const res=await fetch(apiUrl,{headers:{"x-apisports-key":key},cache:"no-store",signal:AbortSignal.timeout(9000)});
     if(!res.ok)throw new Error("Players page "+page+": HTTP "+res.status);
     const data=await res.json();
     if(data.errors&&Object.keys(data.errors).length)throw new Error("Players page "+page+": "+JSON.stringify(data.errors));
     for(const entry of data.response||[]){
      if(!Array.isArray(entry.statistics)||!entry.statistics.some((x:any)=>Number(x.team?.id)===id))continue;
      if(entry.player?.id)collected.set(Number(entry.player.id),entry.player);
     }
     if(page>=(Number(data.paging?.total)||1))break;
     if(page===15)throw new Error("More than 15 pages; old data retained");
    }
    squad=Array.from(collected.values());
    endpoint="players";
   }
   if(!Array.isArray(squad)||squad.length===0)throw new Error("No valid squad");
   if(squad.length<20)throw new Error("New squad smaller than old; retained old data");
   const now=new Date().toISOString();
   const {error:saveError}=await db.from("api_football_team_squads_staging").update({players:squad,source_endpoint:endpoint,source_season:season,fetched_at:now}).eq("api_team_id",id).eq("source_endpoint","players");
   if(saveError)throw saveError;
   const {error:dataError}=endpoint==="players/squads"?await db.from("api_football_team_data").upsert({api_team_id:id,data_type:"squad",season:0,payload:body.response,fetched_at:now},{onConflict:"api_team_id,data_type,season"}):{error:null};
   if(dataError)result.warning="Squad staging updated, team_data: "+dataError.message;
   result.new_count=squad.length;result.endpoint=endpoint;result.status="updated";
  }catch(e){result.status="error";result.error=e instanceof Error?e.message:"Unknown error";}
  results.push(result);
 }
 return NextResponse.json({pending_before:pending.length,processed:results.length,remaining_estimate:pending.length-results.filter(r=>r.status==="updated").length,results},{headers:{"Cache-Control":"no-store"}});
}
