import {NextResponse} from "next/server";
import {createClient} from "@supabase/supabase-js";
export const runtime="nodejs";
export const dynamic="force-dynamic";
const fold=(v:string)=>v.normalize("NFD").replace(/[\u0300-\u036f]/g,"").toLowerCase().replace(/[^a-z0-9]/g,"");
export async function GET(req:Request){
 if(!process.env.CRON_SECRET||req.headers.get("authorization")!==`Bearer ${process.env.CRON_SECRET}`)return NextResponse.json({error:"Unauthorized"},{status:401});
 if(!process.env.API_FOOTBALL_KEY||!process.env.SUPABASE_SERVICE_ROLE_KEY||!process.env.SUPABASE_URL)return NextResponse.json({error:"Missing configuration"},{status:503});
 const db=createClient(process.env.SUPABASE_URL,process.env.SUPABASE_SERVICE_ROLE_KEY,{auth:{persistSession:false}});
 const {count:before,error:countError}=await db.from("scouting_players").select("*",{head:true,count:"exact"});
 if(countError)return NextResponse.json({error:"Count failed"},{status:503});
 // Each run considers a bounded batch. The deterministic offset rotates by day.
 const day=Math.floor(Date.now()/86400000);
 const offset=(day%Math.max(1,Math.ceil((before||0)/15)))*15;
 const {data:players,error}=await db.from("scouting_players").select("external_id,name,birthdate,club").order("external_id").range(offset,offset+14);
 if(error)return NextResponse.json({error:"Player fetch failed"},{status:503});
 let linked=0,ambiguous=0,notFound=0,apiErrors=0,requests=0;
 for(const p of players||[]){
  if(!p.birthdate||!p.name)continue;
  const {data:existing}=await db.from("football_player_links").select("external_id").eq("external_id",p.external_id).maybeSingle();
  if(existing)continue;
  const search=String(p.name).trim().split(/\s+/).pop()||"";
  if(search.length<4)continue;
  const url=`https://v3.football.api-sports.io/players/profiles?search=${encodeURIComponent(search)}`;
  try{
   const response=await fetch(url,{headers:{"x-apisports-key":process.env.API_FOOTBALL_KEY},cache:"no-store",signal:AbortSignal.timeout(8000)});
   requests++;
   if(!response.ok){apiErrors++;if(response.status===429)break;continue}
   const body=await response.json();
   if(body.errors&&Object.keys(body.errors).length){apiErrors++;break}
   // API search pagination may omit candidates: only accept a uniquely proven match on a complete response.
   if((body.paging?.total||1)!==1){ambiguous++;continue}
   const matches=(body.response||[]).filter((r:any)=>fold(String((r.player||r)?.name||""))===fold(p.name)&&String((r.player||r)?.birth?.date||"")===String(p.birthdate).slice(0,10));
   if(matches.length!==1){notFound++;continue}
   const id=Number((matches[0].player||matches[0]).id);
   if(!Number.isSafeInteger(id)||id<=0)continue;
   const {error:insertError}=await db.from("football_player_links").insert({external_id:p.external_id,api_football_player_id:id});
   if(insertError){ambiguous++;continue}
   linked++;
  }catch{apiErrors++}
  // Keep daily usage bounded even on paid accounts.
  if(requests>=15)break;
 }
 const {count:after}=await db.from("scouting_players").select("*",{head:true,count:"exact"});
 if(before!==after)return NextResponse.json({error:"Player count changed",before,after},{status:500});
 return NextResponse.json({playerCount:after,linked,ambiguous,notFound,apiErrors,requests,offset});
}
