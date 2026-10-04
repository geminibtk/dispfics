import {NextRequest,NextResponse} from "next/server";

const EA_URL="https://drop-api.ea.com/rating/ea-sports-fc";

export async function GET(req:NextRequest){
 const offset=Math.max(0,Number(req.nextUrl.searchParams.get("offset")||0));
 try{
  const upstream=await fetch(`${EA_URL}?locale=tr&limit=100&offset=${offset}`,{
   headers:{"Accept":"application/json","User-Agent":"Mozilla/5.0"},
   next:{revalidate:3600}
  });
  if(!upstream.ok)return NextResponse.json({error:"EA Ratings upstream error",status:upstream.status},{status:502});
  const data=await upstream.json();
  return NextResponse.json(data,{headers:{"Cache-Control":"private, max-age=300"}});
 }catch{
  return NextResponse.json({error:"EA Ratings bağlantısı kurulamadı"},{status:502});
 }
}
