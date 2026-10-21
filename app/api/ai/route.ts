import OpenAI from "openai";
import {NextResponse} from "next/server";

export async function POST(req:Request){
 try{
  const contentLength=Number(req.headers.get("content-length")||0);
  if(contentLength>100000)return NextResponse.json({error:"İstek boyutu çok büyük."},{status:413});
  const {message,context}=await req.json();
  if(typeof message!=="string"||!message.trim())return NextResponse.json({error:"Mesaj gerekli."},{status:400});
  if(message.length>2000)return NextResponse.json({error:"Mesaj en fazla 2000 karakter olabilir."},{status:400});
  if(context!==null&&context!==undefined&&(typeof context!=="object"||Array.isArray(context)))return NextResponse.json({error:"Geçersiz takım verisi."},{status:400});
  if(JSON.stringify(context||{}).length>80000)return NextResponse.json({error:"Takım verisi çok büyük."},{status:413});
  if(!process.env.OPENAI_API_KEY)return NextResponse.json({error:"OpenAI API anahtarı sunucuda yapılandırılmamış."},{status:503});
  const client=new OpenAI({apiKey:process.env.OPENAI_API_KEY,timeout:25000,maxRetries:1});
  const res=await client.chat.completions.create({
   model:"gpt-4o-mini",
   messages:[
    {role:"system",content:"Sen YanımdaFutbol AI Teknik Asistanısın. Futbol kadro, performans, scouting ve taktik kararlarında kısa, açıklanabilir, veri odaklı öneriler ver. Verilmeyen veriyi uydurma."},
    {role:"user",content:`Kulüp verisi: ${JSON.stringify(context||{})}\nSoru: ${message}`}
   ],
   temperature:.3
  });
  return NextResponse.json({reply:res.choices[0]?.message?.content||"Yanıt üretilemedi."});
 }catch(e){
  const status=e instanceof OpenAI.APIError?e.status:undefined;
  const code=e instanceof OpenAI.APIError?e.code:undefined;
  console.error("AI request failed",{status,code,type:e instanceof Error?e.name:"unknown"});
  const error=status===401?"OpenAI API anahtarı geçersiz veya iptal edilmiş.":status===403?"OpenAI projesinde bu model için yetki bulunmuyor.":status===429?"OpenAI API kullanım kotası veya ödeme limiti aşıldı. API faturalandırmasını kontrol edin.":status===400?"AI isteği OpenAI tarafından reddedildi.":status===408||status===504?"AI yanıtı zaman aşımına uğradı. Yeniden deneyin.":status&&status>=500?"OpenAI servisinde geçici bir hata oluştu.":e instanceof OpenAI.APIConnectionError?"OpenAI servisine bağlanılamadı.":"AI isteği başarısız oldu. Lütfen yeniden deneyin.";
  return NextResponse.json({error},{status:status===401||status===403||status===429?status:502});
 }
}
