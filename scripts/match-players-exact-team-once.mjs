/**
 * Explicit one-time player link job. No automatic schedule.
 * Reads existing players and matched teams; writes ONLY football_player_links.
 * Never writes scouting_players or adds API-only players.
 */
import { createClient } from "@supabase/supabase-js";
const dbUrl=process.env.SUPABASE_URL||process.env.NEXT_PUBLIC_SUPABASE_URL;
const dbKey=process.env.SUPABASE_SERVICE_ROLE_KEY||process.env.SUPABASE_SECRET_KEY;
const apiKey=process.env.API_FOOTBALL_KEY;
if(!dbUrl||!dbKey||!apiKey)throw Error("Missing server-only credentials");
const db=createClient(dbUrl,dbKey,{auth:{persistSession:false}});
const norm=s=>String(s??"").normalize("NFD").replace(/[\u0300-\u036f]/g,"").toLocaleLowerCase("en").replace(/[^a-z0-9]/g,"");
async function readAll(table,cols,order){
 const rows=[];
 for(let start=0;;start+=1000){
  const {data,error}=await db.from(table).select(cols).order(order).range(start,start+999);
  if(error)throw error;
  rows.push(...data);
  if(data.length<1000)return rows;
 }
}
const players=await readAll("scouting_players","external_id,name,first_name,last_name,common_name,club,age,birthdate","external_id");
const teams=await readAll("api_football_team_matches","api_team_id,local_team_name,status","api_team_id");
const {count:before,error:countError}=await db.from("scouting_players").select("*",{head:true,count:"exact"});
if(countError||before!==players.length)throw Error("Player count mismatch, aborting");
const byClub=new Map();
for(const p of players){const list=byClub.get(p.club)||[];list.push(p);byClub.set(p.club,list)}
const byTeamId=new Map();
for(const t of teams.filter(t=>t.status==="matched"&&t.api_team_id)){
 const id=String(t.api_team_id);
 if(byTeamId.has(id)&&byTeamId.get(id)?.local_team_name!==t.local_team_name)byTeamId.set(id,null);
 else if(!byTeamId.has(id))byTeamId.set(id,t);
}
const usedIds=new Set();
const stats={players:before,teams:0,apiRequests:0,linked:0,unmatched:0,ambiguous:0,apiErrors:0};
for(const [teamId,team] of byTeamId){
 if(!team)continue;
 const local=byClub.get(team.local_team_name)||[];
 if(!local.length)continue;
 let squad;
 try{
  const response=await fetch("https://v3.football.api-sports.io/players/squads?team="+encodeURIComponent(teamId),{
   headers:{"x-apisports-key":apiKey},signal:AbortSignal.timeout(25000)
  });
  stats.apiRequests++;
  if(!response.ok){stats.apiErrors++;if(response.status===429)break;continue}
  const json=await response.json();
  if(json.errors&&Object.keys(json.errors).length){stats.apiErrors++;break}
  squad=(json.response||[]).flatMap(t=>t.players||[]);
 }catch{stats.apiErrors++;continue}
 const localNames=new Map(),apiNames=new Map();
 for(const p of local){
  // Full display name is the matching key; name parts are preserved, never changed.
  const k=norm(p.name);
  if(k)localNames.set(k,[...(localNames.get(k)||[]),p]);
 }
 for(const p of squad){
  const k=norm(p.name);
  if(k)apiNames.set(k,[...(apiNames.get(k)||[]),p]);
 }
 const batch=[];
 for(const [name,entries] of localNames){
  const candidates=apiNames.get(name)||[];
  if(!candidates.length){stats.unmatched+=entries.length;continue}
  if(entries.length!==1||candidates.length!==1){stats.ambiguous+=entries.length;continue}
  const p=entries[0],a=candidates[0],id=Number(a.id);
  if(!Number.isSafeInteger(id)||id<=0||usedIds.has(id)||
     (p.age!=null&&a.age!=null&&Math.abs(Number(p.age)-Number(a.age))>2)){
   stats.ambiguous++;continue;
  }
  usedIds.add(id);
  batch.push({external_id:p.external_id,api_football_player_id:id,
   verified_at:new Date().toISOString(),last_checked_at:new Date().toISOString()});
 }
 // Insert-only, so existing links are never overwritten.
 if(batch.length){
  const {error}=await db.from("football_player_links").upsert(batch,{
   onConflict:"external_id",ignoreDuplicates:true
  });
  if(error){stats.apiErrors++;console.error("Link batch failed for team",teamId,error.code)}
  else stats.linked+=batch.length;
 }
 stats.teams++;
}
const {count:after,error:afterError}=await db.from("scouting_players").select("*",{head:true,count:"exact"});
if(afterError||before!==after)throw Error("Original player count changed");
const {count:actualLinks,error:linkError}=await db.from("football_player_links").select("*",{head:true,count:"exact"});
if(linkError)throw linkError;
console.log("FINISHED",JSON.stringify({...stats,actualLinks,originalPlayersUnchanged:before===after}));
