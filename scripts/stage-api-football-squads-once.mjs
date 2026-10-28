/**
 * One-time snapshot of API-Football squads for matched teams.
 * Writes ONLY public.api_football_team_squads_staging.
 * NEVER touches scouting_players or football_player_links.
 * Explicit invocation only: node --env-file=.env.production.local scripts/stage-api-football-squads-once.mjs
 */
import { createClient } from "@supabase/supabase-js";
const url=process.env.SUPABASE_URL||process.env.NEXT_PUBLIC_SUPABASE_URL;
const key=process.env.SUPABASE_SERVICE_ROLE_KEY||process.env.SUPABASE_SECRET_KEY;
const footballKey=process.env.API_FOOTBALL_KEY;
if(!url||!key||!footballKey)throw Error("Missing required server credentials");
const db=createClient(url,key,{auth:{persistSession:false}});
const {count:originalCount,error:countError}=await db.from("scouting_players").select("*",{head:true,count:"exact"});
if(countError)throw countError;
const teams=[];
for(let start=0;;start+=1000){
 const {data,error}=await db.from("api_football_team_matches")
  .select("api_team_id,local_team_name,status").order("api_team_id").range(start,start+999);
 if(error)throw error;
 teams.push(...data);
 if(data.length<1000)break;
}
const unique=new Map();
for(const t of teams.filter(x=>x.status==="matched"&&x.api_team_id)){
 const id=String(t.api_team_id);
 if(!unique.has(id))unique.set(id,t);
 else if(unique.get(id)?.local_team_name!==t.local_team_name)unique.set(id,null);
}
const stats={matchedTeams:unique.size,storedTeams:0,storedPlayers:0,apiErrors:0,skippedAmbiguousTeams:0};
for(const [id,team] of unique){
 if(!team){stats.skippedAmbiguousTeams++;continue}
 try{
  const response=await fetch("https://v3.football.api-sports.io/players/squads?team="+encodeURIComponent(id),{
   headers:{"x-apisports-key":footballKey},signal:AbortSignal.timeout(25000)
  });
  if(!response.ok){stats.apiErrors++;if(response.status===429)break;continue}
  const body=await response.json();
  if(body.errors&&Object.keys(body.errors).length){stats.apiErrors++;break}
  const players=(body.response||[]).flatMap(t=>t.players||[]);
  // Preserve complete API response player objects separately; no local player changes.
  const {error}=await db.from("api_football_team_squads_staging").upsert({
   api_team_id:Number(id),local_team_name:team.local_team_name,players,
   fetched_at:new Date().toISOString()
  },{onConflict:"api_team_id"});
  if(error){stats.apiErrors++;console.error("Database write failed",id,error.message);continue}
  stats.storedTeams++;stats.storedPlayers+=players.length;
  if(stats.storedTeams%25===0)console.log("PROGRESS",JSON.stringify(stats));
 }catch(error){stats.apiErrors++;console.error("Fetch failed",id,String(error))}
}
const {count:after,error:afterError}=await db.from("scouting_players").select("*",{head:true,count:"exact"});
if(afterError||after!==originalCount)throw Error("Original scouting player count changed");
console.log("FINISHED",JSON.stringify({...stats,originalPlayers:after,originalPlayerCountUnchanged:true}));
