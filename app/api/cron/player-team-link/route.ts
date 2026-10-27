import {NextResponse} from "next/server";
import {createClient} from "@supabase/supabase-js";
export const runtime="nodejs";
export const dynamic="force-dynamic";
export const maxDuration=60;
const fold=(v:string)=>v.normalize("NFD").replace(/[\u0300-\u036f]/g,"").toLocaleLowerCase("tr-TR").replace(/[^a-z0-9]/g,"");
export async function GET(req:Request){
 if(!process.env.CRON_SECRET||req.headers.get("authorization")!==`Bearer ${process.env.CRON_SECRET}`)return NextResponse.json({error:"Unauthorized"},{status:401});
 const url=process.env.SUPABASE_URL||process.env.NEXT_PUBLIC_SUPABASE_URL;
 const key=process.env.SUPABASE_SERVICE_ROLE_KEY||process.env.SUPABASE_SECRET_KEY;
 const apiKey=process.env.API_FOOTBALL_KEY;
 if(!url||!key||!apiKey)return NextResponse.json({error:"Missing configuration"},{status:503});
 const db=createClient(url,key,{auth:{persistSession:false}});
 const {count:before}=await db.from("scouting_players").select("*",{count:"exact",head:true});
 const {data:teams,error}=await db.from("api_football_team_matches").select("api_team_id,local_team_name").eq("status","matched").order("api_team_id").limit(1000);
 if(error||!teams)return NextResponse.json({error:"Team mapping unavailable"},{status:503});
 const unique=Array.from(new Map(teams.map(t=>[t.api_team_id,t])).values());
 const day=Math.floor(Date.now()/86400000);
 const start=(day*12)%Math.max(unique.length,1);
 const batch=Array.from({length:Math.min(12,unique.length)},(_,i)=>unique[(start+i)%unique.length]);
 let checkedTeams=0,checkedPlayers=0,linked=0,ambiguous=0,apiErrors=0;
 for(const team of batch){
  const {data:locals,error:localError}=await db.from("scouting_players").select("external_id,name,age,birthdate").eq("club",team.local_team_name).limit(1000);
  if(localError||!locals?.length)continue;
  try{
   const res=await fetch(`https://v3.football.api-sports.io/players/squads?team=${team.api_team_id}`,{headers:{"x-apisports-key":apiKey},cache:"no-store",signal:AbortSignal.timeout(8000)});
   if(!res.ok){apiErrors++;if(res.status===429)break;continue}
   const payload=await res.json();
   if(payload.errors&&Object.keys(payload.errors).length){apiErrors++;break}
   const squad=(payload.response||[]).flatMap((r:any)=>r.players||[]);
   if(!squad.length)continue;
   checkedTeams++;
   const byName=new Map<string,any[]>();
   for(const p of squad){const k=fold(String(p.name||""));if(!k)continue;byName.set(k,[...(byName.get(k)||[]),p])}
   const localCounts=new Map<string,number>();
   for(const p of locals){const k=fold(p.name||"");localCounts.set(k,(localCounts.get(k)||0)+1)}
   for(const p of locals){
    checkedPlayers++;
    const k=fold(p.name||"");
    const candidates=byName.get(k)||[];
    if(candidates.length!==1||localCounts.get(k)!==1){if(candidates.length)ambiguous++;continue}
    const candidate=candidates[0];
    const id=Number(candidate.id);
    if(!Number.isSafeInteger(id)||id<=0)continue;
    // Squad ages are approximate and can lag; reject only strong contradictions.
    if(p.age!=null&&candidate.age!=null&&Math.abs(Number(p.age)-Number(candidate.age))>2){ambiguous++;continue}
    const {error:insertError}=await db.from("football_player_links").insert({external_id:p.external_id,api_football_player_id:id,verified_at:new Date().toISOString(),last_checked_at:new Date().toISOString()});
    if(!insertError)linked++;
   }
  }catch{apiErrors++}
 }
 const {count:after}=await db.from("scouting_players").select("*",{count:"exact",head:true});
 return NextResponse.json({checkedTeams,checkedPlayers,linked,ambiguous,apiErrors,playerCount:after,playerCountUnchanged:before===after,totalMappedTeams:unique.length});
}
