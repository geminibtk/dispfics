import {NextResponse} from "next/server";
export const runtime="nodejs";
export const dynamic="force-dynamic";
// Daily low-quota bootstrap. Does not read or write scouting_players.
export async function GET(req:Request){
 const secret=process.env.CRON_SECRET;
 if(!secret||req.headers.get("authorization")!==`Bearer ${secret}`)return NextResponse.json({error:"Unauthorized"},{status:401});
 const origin=new URL(req.url).origin;
 const results=[];
 for(const category of ["countries","seasons","leagues"]){
  try{
   const res=await fetch(`${origin}/api/cron/football-reference?category=${category}`,{headers:{authorization:`Bearer ${secret}`},cache:"no-store",signal:AbortSignal.timeout(25000)});
   const body=await res.json();
   results.push({category,status:res.status,result:body});
   if(!res.ok)break;
  }catch(e){results.push({category,error:e instanceof Error?e.message:"Request failed"});break}
 }
 return NextResponse.json({results,playerRecordsChanged:0});
}
