/**
 * One-time matching of existing scouting players to API-Football squad members.
 * Run: node --env-file=.env.production.local scripts/match-all-players.mjs
 * Never inserts/updates/deletes scouting_players or caches API squad responses.
 */
import {createClient} from "@supabase/supabase-js";
const url=process.env.SUPABASE_URL||process.env.NEXT_PUBLIC_SUPABASE_URL;
const key=process.env.SUPABASE_SERVICE_ROLE_KEY||process.env.SUPABASE_SECRET_KEY;
const apiKey=process.env.API_FOOTBALL_KEY;
if(!url||!key||!apiKey)throw Error("Missing Supabase or API_FOOTBALL_KEY environment variables");
const db=createClient(url,key,{auth:{persistSession:false}});
const normalize=v=>String(v||"").normalize("NFD").replace(/[\u0300-\u036f]/g,"").toLowerCase().replace(/[^a-z0-9]/g,"");
async function all(table,cols,order){
 const out=[];
 for(let offset=0;;offset+=1000){
  const {data,error}=await db.from(table).select(cols).order(order).range(offset,offset+999);
  if(error)throw error;
  out.push(...data);
  if(data.length<1000)break;
 }
 return out;
}
const players=await all("scouting_players","external_id,name,club,age,birthdate","external_id");
const teams=await all("api_football_team_matches","api_team_id,local_team_name,status","api_team_id");
const {count:before,error:countError}=await db.from("scouting_players").select("*",{head:true,count:"exact"});
if(countError)throw countError;
if(players.length!==before)throw Error("Scouting player pagination mismatch; aborting");
const grouped=new Map();
for(const p of players){
 const k=p.club||"";
 grouped.set(k,[...(grouped.get(k)||[]),p]);
}
const uniqueTeams=new Map();
for(const t of teams.filter(t=>t.status==="matched"&&t.api_team_id)){
 const k=String(t.api_team_id);
 if(uniqueTeams.has(k)&&uniqueTeams.get(k).local_team_name!==t.local_team_name){
  console.warn("Ambiguous team ID, skipping",k);
  uniqueTeams.set(k,null);
 }else if(!uniqueTeams.has(k))uniqueTeams.set(k,t);
}
let requested=0,processed=0,linked=0,ambiguous=0,unmatched=0,apiErrors=0;
const usedApiIds=new Set();
for(const [teamId,t] of uniqueTeams){
 if(!t)continue;
 const locals=grouped.get(t.local_team_name)||[];
 if(!locals.length)continue;
 let response;
 try{
  const r=await fetch(`https://v3.football.api-sports.io/players/squads?team=${encodeURIComponent(teamId)}`,{headers:{"x-apisports-key":apiKey},signal:AbortSignal.timeout(20000)});
  requested++;
  if(!r.ok){
   console.error("API error",teamId,r.status);
   apiErrors++;
   if(r.status===429)break;
   continue;
  }
  response=await r.json();
  if(response.errors&&Object.keys(response.errors).length){
   console.error("API provider error",teamId,JSON.stringify(response.errors));
   apiErrors++;
   break;
  }
 }catch(e){console.error("Network error",teamId,String(e));apiErrors++;continue}
 const squad=(response.response||[]).flatMap(x=>x.players||[]);
 const apiByName=new Map();
 const localByName=new Map();
 for(const p of squad){const k=normalize(p.name);if(k)apiByName.set(k,[...(apiByName.get(k)||[]),p])}
 for(const p of locals){const k=normalize(p.name);if(k)localByName.set(k,[...(localByName.get(k)||[]),p])}
 for(const [name,entries] of localByName){
  const matches=apiByName.get(name)||[];
  if(matches.length===0){unmatched+=entries.length;continue}
  if(matches.length!==1||entries.length!==1){ambiguous+=entries.length;continue}
  const p=entries[0],candidate=matches[0],id=Number(candidate.id);
  if(!Number.isSafeInteger(id)||id<=0){ambiguous++;continue}
  if(p.age!=null&&candidate.age!=null&&Math.abs(Number(p.age)-Number(candidate.age))>2){ambiguous++;continue}
  if(usedApiIds.has(id)){ambiguous++;continue}
  const {error}=await db.from("football_player_links").upsert({
   external_id:p.external_id,api_football_player_id:id,
   verified_at:new Date().toISOString(),last_checked_at:new Date().toISOString()
  },{onConflict:"external_id",ignoreDuplicates:true});
  if(error){console.warn("Link conflict",p.external_id,error.code);ambiguous++;continue}
  usedApiIds.add(id);
  linked++;
 }
 processed++;
 if(processed%25===0)console.log(JSON.stringify({processed,requested,linked,ambiguous,unmatched,apiErrors}));
}
const {count:after,error:afterError}=await db.from("scouting_players").select("*",{head:true,count:"exact"});
if(afterError||before!==after)throw Error("Scouting player count changed; investigate");
console.log("FINISHED",JSON.stringify({scoutingPlayers:after,teamsProcessed:processed,requests:requested,linked,ambiguous,unmatched,apiErrors,totalMappedTeams:uniqueTeams.size}));
