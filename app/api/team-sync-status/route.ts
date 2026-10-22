import {NextResponse} from "next/server";
export const runtime="nodejs";
export const dynamic="force-dynamic";
export async function GET(){
 if(!process.env.API_FOOTBALL_KEY)return NextResponse.json({configured:false,connected:false},{status:503});
 try{
  const r=await fetch("https://v3.football.api-sports.io/status",{headers:{"x-apisports-key":process.env.API_FOOTBALL_KEY},cache:"no-store",signal:AbortSignal.timeout(10000)});
  const j=await r.json();
  return NextResponse.json({configured:true,connected:r.ok&&!j.errors?.token&&!j.errors?.requests,apiStatus:r.status,account:j.response?.account?.firstname?"authenticated":"unverified",subscription:j.response?.subscription?.plan||null,requestsRemaining:j.response?.requests?.current==null?null:Math.max(0,Number(j.response.requests.limit_day||0)-Number(j.response.requests.current||0))});
 }catch{return NextResponse.json({configured:true,connected:false,error:"provider_unreachable"},{status:502})}
}
