/**
 * Explicit second-pass matching. Dry-run by default; --apply writes ONLY
 * football_player_links. Never modifies scouting_players.
 * Run: node --env-file=.env.production.local scripts/match-remaining-players.mjs
 * Apply after reviewing: node --env-file=.env.production.local scripts/match-remaining-players.mjs --apply
 */
import {createClient} from "@supabase/supabase-js";
import {readFileSync,writeFileSync,mkdirSync,renameSync,existsSync} from "node:fs";
import {dirname,resolve} from "node:path";
const apply=process.argv.includes("--apply");
const url=process.env.SUPABASE_URL||process.env.NEXT_PUBLIC_SUPABASE_URL;
const key=process.env.SUPABASE_SERVICE_ROLE_KEY||process.env.SUPABASE_SECRET_KEY;
const apiKey=process.env.API_FOOTBALL_KEY;
if(!url||!key||!apiKey||[url,key,apiKey].some(x=>x.includes("[SENSITIVE]")))throw Error("Missing usable environment variables");
const db=createClient(url,key,{auth:{persistSession:false}});
const norm=v=>String(v||"").normalize("NFD").replace(/[\u0300-\u036f]/g,"").toLowerCase().replace(/[^a-z0-9 ]/g," ").replace(/\s+/g," ").trim();
const tokens=v=>norm(v).split(" ").filter(Boolean);
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
const players=await all("scouting_players","external_id,name,first_name,last_name,common_name,club,age,birthdate","external_id");
const teams=await all("api_football_team_matches","api_team_id,local_team_name,status","api_team_id");
const links=await all("football_player_links","external_id,api_football_player_id","external_id");
const before=players.length;
const existingLocal=new Set(links.map(x=>x.external_id));
const existingApi=new Set(links.map(x=>Number(x.api_football_player_id)));
const byClub=new Map();
for(const p of players){
 if(existingLocal.has(p.external_id))continue;
 const a=byClub.get(p.club)||[];
 a.push(p);byClub.set(p.club,a);
}
const uniqueTeams=new Map();
for(const t of teams.filter(t=>t.status==="matched"&&t.api_team_id)){
 const k=String(t.api_team_id);
 if(uniqueTeams.has(k)&&uniqueTeams.get(k)?.local_team_name!==t.local_team_name)uniqueTeams.set(k,null);
 else if(!uniqueTeams.has(k))uniqueTeams.set(k,t);
}
function qualifies(local,remote){
 if(local.age==null||remote.age==null||Math.abs(Number(local.age)-Number(remote.age))>1)return false;
 const full=tokens(local.name),first=tokens(local.first_name),last=tokens(local.last_name);
 const common=tokens(local.common_name),api=tokens(remote.name);
 if(!api.length||!last.length)return false;
 const surname=last.join(" ");
 const apiName=api.join(" ");
 const exact=[full,common,[...first,...last]].some(a=>a.length&&a.join(" ")===apiName);
 // Only accept surname + a matching given-name token, or exact full/common name.
 const hasSurname=apiName===surname||apiName.endsWith(" "+surname);
 const given=first.filter(t=>t.length>=3);
 const hasGiven=given.some(t=>api.slice(0,-last.length).includes(t));
 return exact||(hasSurname&&hasGiven);
}
let requests=0,errors=0,ambiguous=0,candidates=0,inserted=0,skipped=0;
const checkpointPath=resolve(".vercel/player-match-second-pass-checkpoint.json");
let checkpoint={version:1,completed:{}};
if(existsSync(checkpointPath)){
 const loaded=JSON.parse(readFileSync(checkpointPath,"utf8"));
 if(loaded.version!==1||!loaded.completed||typeof loaded.completed!=="object")throw Error("Invalid checkpoint");
 checkpoint=loaded;
}
function saveCheckpoint(){
 mkdirSync(dirname(checkpointPath),{recursive:true});
 writeFileSync(checkpointPath+".tmp",JSON.stringify(checkpoint));
 renameSync(checkpointPath+".tmp",checkpointPath);
}
const proposals=[];
let reusedTeams=0,quotaStopped=false;
for(const [id,team] of uniqueTeams){
 if(!team)continue;
 const locals=byClub.get(team.local_team_name)||[];
 if(!locals.length)continue;
 let squad;
 if(checkpoint.completed[id]?.club===team.local_team_name){
  proposals.push(...checkpoint.completed[id].proposals);
  reusedTeams++;
  continue;
 }
 try{
  const response=await fetch("https://v3.football.api-sports.io/players/squads?team="+encodeURIComponent(id),{headers:{"x-apisports-key":apiKey},signal:AbortSignal.timeout(20000)});
  requests++;
  const body=await response.json().catch(()=>null);
  const apiErrors=body?.errors&&Object.keys(body.errors).length?body.errors:null;
  if(!response.ok||apiErrors){
   errors++;
   console.error("API_ERROR",JSON.stringify({team:id,status:response.status,apiErrors,minuteRemaining:response.headers.get("x-ratelimit-requests-remaining"),dailyRemaining:response.headers.get("x-ratelimit-remaining")}));
   if(response.status===429||response.status===401||response.status===403||/quota|limit|rate|requests/i.test(JSON.stringify(apiErrors||{}))){quotaStopped=true;break}
   continue;
  }
  if(!Array.isArray(body?.response))throw Error("Unexpected API response");
  squad=body.response.flatMap(x=>x.players||[]);
 }catch(e){errors++;console.error("NETWORK_ERROR",JSON.stringify({team:id,message:String(e?.message||e)}));continue}
 const teamProposals=[];
 const possible=new Map();
 const reverse=new Map();
 for(const p of locals){
  const matches=squad.filter(s=>Number.isSafeInteger(Number(s.id))&&!existingApi.has(Number(s.id))&&qualifies(p,s));
  if(matches.length!==1){if(matches.length>1)ambiguous++;continue}
  const candidate=matches[0];
  possible.set(p.external_id,{external_id:p.external_id,api_football_player_id:Number(candidate.id)});
  reverse.set(Number(candidate.id),(reverse.get(Number(candidate.id))||0)+1);
 }
 for(const proposal of possible.values()){
  if(reverse.get(proposal.api_football_player_id)!==1){ambiguous++;continue}
  teamProposals.push(proposal);
 }
 proposals.push(...teamProposals);
 checkpoint.completed[id]={club:team.local_team_name,proposals:teamProposals};
 saveCheckpoint();
 if(requests%25===0)console.log(JSON.stringify({requests,candidates:proposals.length,errors,ambiguous}));
}
const counts=new Map();
for(const p of proposals)counts.set(p.api_football_player_id,(counts.get(p.api_football_player_id)||0)+1);
const safe=proposals.filter(p=>counts.get(p.api_football_player_id)===1&&!existingApi.has(p.api_football_player_id)&&!existingLocal.has(p.external_id));
candidates=safe.length;
if(apply){
 for(const p of safe){
  const now=new Date().toISOString();
  const {data,error}=await db.from("football_player_links").upsert({...p,verified_at:now,last_checked_at:now},{onConflict:"external_id",ignoreDuplicates:true}).select("external_id");
  if(error){skipped++;continue}
  inserted+=data?.length||0;
 }
}
const {count:after,error}=await db.from("scouting_players").select("*",{head:true,count:"exact"});
if(error||after!==before)throw Error("Scouting player count mismatch");
console.log("FINISHED",JSON.stringify({mode:apply?"apply":"dry-run",scoutingPlayers:after,existingLinks:links.length,requests,reusedTeams,completedTeams:Object.keys(checkpoint.completed).length,quotaStopped,candidates,inserted,skipped,ambiguous,errors}));
