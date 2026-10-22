import {NextResponse} from "next/server";
import {createClient} from "@supabase/supabase-js";

export const runtime="nodejs";
export const dynamic="force-dynamic";

type Linked={external_id:string;api_football_player_id:number;last_checked_at:string|null};
const season=new Date().getUTCFullYear();
export async function GET(req:Request){
 if(!process.env.CRON_SECRET||req.headers.get("authorization")!==`Bearer ${process.env.CRON_SECRET}`)return NextResponse.json({error:"Unauthorized"},{status:401});
 if(!process.env.API_FOOTBALL_KEY||!process.env.SUPABASE_SERVICE_ROLE_KEY||!process.env.SUPABASE_URL)return NextResponse.json({error:"Missing server configuration"},{status:503});
 const db=createClient(process.env.SUPABASE_URL,process.env.SUPABASE_SERVICE_ROLE_KEY,{auth:{persistSession:false}});
 const before=await db.from("scouting_players").select("*",{count:"exact",head:true});
 if(before.error)return NextResponse.json({error:"Count check failed"},{status:503});
 const {data:links,error}=await db.from("football_player_links").select("external_id,api_football_player_id,last_checked_at").order("last_checked_at",{ascending:true,nullsFirst:true}).limit(20);
 if(error)return NextResponse.json({error:"Mapping query failed"},{status:503});
 let updated=0,skipped=0,failed=0,checked=0;
 for(const link of (links||[]) as Linked[]){
  try{
   const res=await fetch(`https://v3.football.api-sports.io/players?id=${encodeURIComponent(link.api_football_player_id)}&season=${season}`,{headers:{"x-apisports-key":process.env.API_FOOTBALL_KEY},cache:"no-store",signal:AbortSignal.timeout(8000)});
   if(!res.ok){failed++;if(res.status===429)break;continue}
   const payload=await res.json();
   if(payload.errors&&Object.keys(payload.errors).length){failed++;break}
   const rows=payload.response||[];
   const stats=rows.flatMap((r:any)=>r.statistics||[]).filter((s:any)=>s?.team?.name&&s?.league?.name&&Number(s?.games?.appearences||0)>0);
   // Multiple clubs or leagues in a season: cannot reliably infer current club.
   const unique=new Map(stats.map((s:any)=>[s.team.id+"|"+s.league.id,s]));
   if(unique.size!==1){skipped++;continue}
   const entry=Array.from(unique.values())[0] as any;
   const {data:player,error:readError}=await db.from("scouting_players").select("external_id,club,league").eq("external_id",link.external_id).single();
   if(readError||!player){failed++;continue}
   const club=String(entry.team.name),league=String(entry.league.name);
   if(player.club!==club){
    // Update only the two allowed columns, and only when the previous values still match.
    let update=db.from("scouting_players").update({club,league}).eq("external_id",link.external_id);
    update=player.club===null?update.is("club",null):update.eq("club",player.club);
    update=player.league===null?update.is("league",null):update.eq("league",player.league);
    const {data:changed,error:writeError}=await update.select("external_id");
    if(writeError||changed?.length!==1){failed++;continue}
    await db.from("football_team_sync_audit").insert({external_id:link.external_id,old_club:player.club,new_club:club,old_league:player.league,new_league:league,result:"updated"});
    updated++;
   }else skipped++;
   checked++;
  }catch{failed++}
  finally{await db.from("football_player_links").update({last_checked_at:new Date().toISOString()}).eq("external_id",link.external_id)}
 }
 const after=await db.from("scouting_players").select("*",{count:"exact",head:true});
 if(after.error||before.count!==after.count)return NextResponse.json({error:"Player count mismatch",before:before.count,after:after.count},{status:500});
 return NextResponse.json({playerCount:after.count,linked:links?.length||0,checked,updated,skipped,failed,season});
}
