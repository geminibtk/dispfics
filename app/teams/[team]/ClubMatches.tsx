"use client";
import {useEffect,useState} from "react";
import {createClient} from "../../../lib/supabase";
type Match={id:string;opponent:string;kickoff:string|null;home:boolean|null;goals_for:number|null;goals_against:number|null;competition:string|null};
export default function ClubMatches({name}:{name:string}){
 const [matches,setMatches]=useState<Match[]>([]);
 const [loading,setLoading]=useState(true);
 const [error,setError]=useState("");
 useEffect(()=>{let active=true;(async()=>{
   setLoading(true);setError("");
   const s=createClient();
   const clubs=await s.from("clubs").select("id").eq("name",name).limit(2);
   if(!active)return;
   if(clubs.error){setError("Kulüp kaydı yüklenemedi.");setLoading(false);return;}
   if((clubs.data||[]).length!==1){setMatches([]);setLoading(false);return;}
   const result=await s.from("matches").select("id,opponent,kickoff,home,goals_for,goals_against,competition").eq("club_id",clubs.data![0].id).order("kickoff",{ascending:false}).limit(100);
   if(!active)return;
   if(result.error)setError("Maç kayıtları yüklenemedi.");
   else setMatches((result.data||[]) as Match[]);
   setLoading(false);
 })();return()=>{active=false}},[name]);
 return <section className="module" style={{display:"grid",gap:12}}><h2>Maçlar</h2>{loading?<p>Maçlar yükleniyor…</p>:error?<p role="alert">{error}</p>:matches.length===0?<p>Bu kulüp için doğrulanmış maç kaydı bulunmuyor.</p>:<>{matches.map(m=>{const done=m.goals_for!=null&&m.goals_against!=null;const date=m.kickoff?new Date(m.kickoff).toLocaleDateString("tr-TR"):"Tarih belirtilmemiş";const left=m.home!==false?name:m.opponent;const right=m.home!==false?m.opponent:name;const score=done?(m.home!==false?m.goals_for+" - "+m.goals_against:m.goals_against+" - "+m.goals_for):"Henüz sonuç yok";return <article key={m.id} style={{border:"1px solid #294032",borderRadius:12,padding:14}}><p style={{color:"#9bcba7",fontSize:12}}>{date} · {m.competition||"Organizasyon belirtilmemiş"}</p><strong>{left} — {right}</strong><p>{score}</p></article>})}<p style={{fontSize:12,color:"#9bcba7"}}>Yalnızca sistemde kayıtlı maçlar gösterilir; skor girilmemiş fikstürler sonuç olarak sunulmaz.</p></>}</section>
}
