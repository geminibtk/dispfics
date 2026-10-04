import {NextRequest,NextResponse} from "next/server";

const EA_URL="https://drop-api.ea.com/rating/ea-sports-fc";
export const dynamic="force-dynamic";

export async function GET(req:NextRequest){
 const offset=Math.max(0,Number(req.nextUrl.searchParams.get("offset")||0));
 try{
  const upstream=await fetch(`${EA_URL}?locale=tr&limit=100&offset=${offset}`,{
   headers:{
    "Accept":"*/*",
    "Accept-Language":"tr-TR,tr;q=0.9,en-US;q=0.8,en;q=0.7",
    "Cache-Control":"no-cache",
    "Pragma":"no-cache",
    "Drop-Referrer":"https://www.ea.com/tr/games/ea-sports-fc/ratings",
    "Origin":"https://www.ea.com",
    "Referer":"https://www.ea.com/",
    "User-Agent":"Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/154.0.0.0 Safari/537.36"
   },
   cache:"no-store"
  });
  if(!upstream.ok)return NextResponse.json({error:"EA Ratings upstream error",status:upstream.status},{status:502});
  const data=await upstream.json();
  return NextResponse.json(data,{headers:{"Cache-Control":"no-store, max-age=0"}});
 }catch{
  return NextResponse.json({error:"EA Ratings bağlantısı kurulamadı"},{status:502});
 }
}
