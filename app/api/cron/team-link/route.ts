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
 // Cover the full roster in rotating windows; API quota and execution time still apply.
 const params=new URL(req.url).searchParams;
 const requestedOffset=params.get("offset");
 const requestedLimit=params.get("limit");
 const windowSize=requestedLimit===null?100:Math.min(1000,Math.max(1,Number(requestedLimit)||100));
 const day=Math.floor(Date.now()/86400000);
 const offset=requestedOffset===null?(day%Math.max(1,Math.ceil((before||0)/windowSize)))*windowSize:Math.min(Math.max(0,Number(requestedOffset)||0),Math.max(0,(before||0)-1));
 const {data:players,error}=await db.from("scouting_players").select("external_id,name,birthdate,club").order("external_id").range(offset,Math.min(offset+windowSize-1,(before||0)-1));
 if(error)return NextResponse.json({error:"Player fetch failed"},{status:503});
 let linked=0,ambiguous=0,notFound=0,apiErrors=0,requests=0,checked=0,processed=0;
 let apiFailure:string|null=null;
 const cache=new Map<string,any[]>();
 const deadline=Date.now()+45000;
 for(const p of players||[]){
  processed++;
  if(!p.birthdate||!p.name)continue;
  const {data:existing}=await db.from("football_player_links").select("external_id").eq("external_id",p.external_id).maybeSingle();
  if(existing)continue;
  // API-Football search accepts only ASCII letters, digits and spaces.
  const search=String(p.name).trim().split(/\s+/).pop()?.normalize("NFD").replace(/[\u0300-\u036f]/g,"").replace(/[^a-zA-Z0-9 ]/g," ").replace(/\s+/g," ").trim()||"";
  if(search.length<4)continue;
  try{
   let profiles=cache.get(search);
   if(!profiles){
    profiles=[];
    let complete=true;
    for(let page=1;page<=3;page++){
     const url=`https://v3.football.api-sports.io/players/profiles?search=${encodeURIComponent(search)}&page=${page}`;
     const response=await fetch(url,{headers:{"x-apisports-key":process.env.API_FOOTBALL_KEY},cache:"no-store",signal:AbortSignal.timeout(8000)});
     requests++;
     if(!response.ok){apiErrors++;apiFailure=`HTTP ${response.status}: ${(await response.text()).slice(0,350)}`;complete=false;break}
     const body=await response.json();
     if(body.errors&&Object.keys(body.errors).length){apiErrors++;apiFailure=JSON.stringify(body.errors).slice(0,350);complete=false;break}
     profiles.push(...(body.response||[]));
     if(page>=Number(body.paging?.total||1))break;
     if(page===3)complete=false;
    }
    if(!complete){ambiguous++;continue}
    cache.set(search,profiles);
   }
   checked++;
   const matches=profiles.filter((r:any)=>fold(String((r.player||r)?.name||""))===fold(p.name)&&String((r.player||r)?.birth?.date||"")===String(p.birthdate).slice(0,10));
   if(matches.length!==1){if(matches.length>1)ambiguous++;else notFound++;continue}
   const id=Number((matches[0].player||matches[0]).id);
   if(!Number.isSafeInteger(id)||id<=0)continue;
   const {error:insertError}=await db.from("football_player_links").insert({external_id:p.external_id,api_football_player_id:id});
   if(insertError){ambiguous++;continue}
   linked++;
  }catch(e){apiErrors++;apiFailure=e instanceof Error?e.message:String(e);break}
  // Continue until the provider quota or server execution budget is reached.
  if(Date.now()>deadline)break;
 }
 const {count:after}=await db.from("scouting_players").select("*",{head:true,count:"exact"});
 if(before!==after)return NextResponse.json({error:"Player count changed",before,after},{status:500});
 return NextResponse.json({playerCount:after,linked,ambiguous,notFound,apiErrors,requests,checked,processed,apiFailure,offset,windowSize,nextOffset:offset+windowSize,totalPlayers:before});
}
