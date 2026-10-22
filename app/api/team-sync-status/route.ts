import {NextResponse} from "next/server";
import {createClient} from "@supabase/supabase-js";
export const runtime="nodejs";
export const dynamic="force-dynamic";
export async function GET(){
 if(!process.env.API_FOOTBALL_KEY)return NextResponse.json({configured:false,connected:false},{status:503});
 try{
  const r=await fetch("https://v3.football.api-sports.io/status",{headers:{"x-apisports-key":process.env.API_FOOTBALL_KEY},cache:"no-store",signal:AbortSignal.timeout(10000)});
  const j=await r.json();
  const result:{[key:string]:unknown}={configured:true,connected:r.ok&&!j.errors?.token&&!j.errors?.requests,apiStatus:r.status,subscription:j.response?.subscription?.plan||null,requestsRemaining:j.response?.requests?.current==null?null:Math.max(0,Number(j.response.requests.limit_day||0)-Number(j.response.requests.current||0))};
  if(process.env.SUPABASE_URL&&process.env.SUPABASE_SERVICE_ROLE_KEY){const db=createClient(process.env.SUPABASE_URL,process.env.SUPABASE_SERVICE_ROLE_KEY,{auth:{persistSession:false}});const [players,links,changes]=await Promise.all([db.from("scouting_players").select("*",{head:true,count:"exact"}),db.from("football_player_links").select("*",{head:true,count:"exact"}),db.from("football_team_sync_audit").select("*",{head:true,count:"exact"})]);result.playerCount=players.count;result.verifiedLinks=links.count;result.loggedChanges=changes.count;}
  return NextResponse.json(result);
 }catch{return NextResponse.json({configured:true,connected:false,error:"provider_unreachable"},{status:502})}
}
