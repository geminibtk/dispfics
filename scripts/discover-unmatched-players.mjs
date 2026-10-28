/**
 * Third-pass identity discovery. READ-ONLY: never writes database tables.
 * Searches API-Football player profiles by surname, requiring exact birthdate
 * and full-name identity. Review results before any separate linking workflow.
 * Run: node --env-file=.env.production.local scripts/discover-unmatched-players.mjs
 * Optional: --limit=100 (maximum API requests per run, default 100)
 */
import {createClient} from "@supabase/supabase-js";
import {existsSync,readFileSync,writeFileSync,mkdirSync,renameSync} from "node:fs";
import {resolve,dirname} from "node:path";
const url=process.env.SUPABASE_URL||process.env.NEXT_PUBLIC_SUPABASE_URL;
const key=process.env.SUPABASE_SERVICE_ROLE_KEY||process.env.SUPABASE_SECRET_KEY;
const apiKey=process.env.API_FOOTBALL_KEY;
if(!url||!key||!apiKey||[url,key,apiKey].some(v=>v.includes("[SENSITIVE]")))throw Error("Missing usable credentials");
const db=createClient(url,key,{auth:{persistSession:false}});
const norm=v=>String(v||"").normalize("NFD").replace(/[\u0300-\u036f]/g,"").toLowerCase().replace(/[^a-z0-9]/g,"");
const limitArg=process.argv.find(v=>v.startsWith("--limit="));
const limit=limitArg?Number(limitArg.split("=")[1]):100;
if(!Number.isSafeInteger(limit)||limit<1||limit>500)throw Error("--limit must be 1..500");
async function all(table,cols){
 const result=[];
 for(let offset=0;;offset+=1000){
  const {data,error}=await db.from(table).select(cols).order("external_id").range(offset,offset+999);
  if(error)throw error;
  result.push(...data);
  if(data.length<1000)break;
 }
 return result;
}
const players=await all("scouting_players","external_id,name,first_name,last_name,common_name,club,birthdate");
const links=await all("football_player_links","external_id,api_football_player_id");
const existingLocal=new Set(links.map(x=>x.external_id));
const existingApi=new Set(links.map(x=>Number(x.api_football_player_id)));
const unmatched=players.filter(p=>!existingLocal.has(p.external_id));
const path=resolve(".vercel/player-third-pass-discovery.json");
let state={version:1,queries:{},nextIndex:0};
if(existsSync(path)){
 state=JSON.parse(readFileSync(path,"utf8"));
 if(state.version!==1||!state.queries||!Number.isSafeInteger(state.nextIndex))throw Error("Invalid discovery checkpoint");
}
function save(){
 mkdirSync(dirname(path),{recursive:true});
 writeFileSync(path+".tmp",JSON.stringify(state));
 renameSync(path+".tmp",path);
}
const searches=[...new Set(unmatched.map(p=>norm(p.last_name)).filter(x=>x.length>=4))].sort();
let requests=0,errors=0,quotaStopped=false;
for(let i=state.nextIndex;i<searches.length&&requests<limit;i++){
 const surname=searches[i];
 if(Object.hasOwn(state.queries,surname)){state.nextIndex=i+1;continue}
 if(requests)await new Promise(r=>setTimeout(r,3100));
 try{
  const response=await fetch("https://v3.football.api-sports.io/players/profiles?search="+encodeURIComponent(surname),{headers:{"x-apisports-key":apiKey},signal:AbortSignal.timeout(25000)});
  requests++;
  const body=await response.json();
  if(!response.ok||(body.errors&&Object.keys(body.errors).length)){
   errors++;
   console.error("API_ERROR",JSON.stringify({surname,status:response.status,errors:body.errors}));
   if(response.status===429||response.status===401||response.status===403||/rate|limit|quota|requests/i.test(JSON.stringify(body.errors||{}))){quotaStopped=true;break}
   continue;
  }
  if(!Array.isArray(body.response))throw Error("Unexpected profile response");
  // Only store the minimum identity fields. No private credentials or player stats.
  state.queries[surname]=body.response.map(x=>x.player||x).filter(x=>Number.isSafeInteger(Number(x.id))).map(x=>({id:Number(x.id),name:x.name||"",firstname:x.firstname||"",lastname:x.lastname||"",birth:x.birth?.date||null}));
  state.nextIndex=i+1;
  save();
 }catch(e){errors++;console.error("NETWORK_ERROR",JSON.stringify({surname,message:String(e.message||e)}));break}
}
const bySurname=new Map(unmatched.map(p=>[norm(p.last_name),null]));
for(const p of unmatched){
 const surname=norm(p.last_name);
 if(!bySurname.has(surname)||bySurname.get(surname)===null)bySurname.set(surname,[]);
 bySurname.get(surname).push(p);
}
const proposals=[];
for(const [surname,remotes] of Object.entries(state.queries)){
 for(const local of bySurname.get(surname)||[]){
  if(!local.birthdate)continue;
  const names=new Set([norm(local.name),norm(local.common_name),norm(local.first_name+" "+local.last_name)].filter(Boolean));
  const matched=remotes.filter(r=>!existingApi.has(r.id)&&r.birth===String(local.birthdate).slice(0,10)&&[norm(r.name),norm(r.firstname+" "+r.lastname)].some(n=>names.has(n)));
  if(matched.length===1)proposals.push({external_id:local.external_id,api_football_player_id:matched[0].id,club:local.club,name:local.name,birthdate:local.birthdate});
 }
}
const localCounts=new Map(),apiCounts=new Map();
for(const p of proposals){localCounts.set(p.external_id,(localCounts.get(p.external_id)||0)+1);apiCounts.set(p.api_football_player_id,(apiCounts.get(p.api_football_player_id)||0)+1)}
const unique=proposals.filter(p=>localCounts.get(p.external_id)===1&&apiCounts.get(p.api_football_player_id)===1);
const report=resolve(".vercel/player-third-pass-candidates.json");
writeFileSync(report,JSON.stringify({readOnly:true,warning:"Identity-only candidates; verify current club/team before linking.",candidates:unique},null,2));
console.log("FINISHED",JSON.stringify({mode:"read-only",unmatched:unmatched.length,searchesTotal:searches.length,searchesCompleted:Object.keys(state.queries).length,requests,errors,quotaStopped,candidates:unique.length,report}));
