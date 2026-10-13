"use client";
import {displayRating} from "../../lib/display-rating";
import {useEffect,useMemo,useState} from "react";
import {useRouter} from "next/navigation";
import {createClient} from "../../lib/supabase";
import AppShell from "../components/AppShell";
import {getAiLineupRecommendation} from "../../lib/ai-lineup-recommendation";

type Player={id:string;name:string;position:string;age:number|null;rating:number;market_value:number;avatar_url?:string|null;alternatePositions?:any[]};
type Match={id:string;opponent:string;kickoff:string;home:boolean;goals_for:number|null;goals_against:number|null;competition?:string|null;kickoff_time_known?:boolean};
type Target={id:string;name:string;position:string;current_club:string;market_value:number;rating:number;priority:string;status:string};
type Profile={manager?:string;founded_year?:number;stadium?:string;stadium_capacity?:number;website?:string;external_market_value_eur?:number;source?:string;source_url?:string};
export default function Players(){
 const s=createClient(),router=useRouter();
 const [clubName,setClubName]=useState("");const [players,setPlayers]=useState<Player[]>([]);const [matches,setMatches]=useState<Match[]>([]);const [targets,setTargets]=useState<Target[]>([]);const [profile,setProfile]=useState<Profile|null>(null);const [formation,setFormation]=useState("");const [msg,setMsg]=useState("");const [loading,setLoading]=useState(true);const [tab,setTab]=useState("Genel Bakış");
 useEffect(()=>{const requested=new URLSearchParams(window.location.search).get("tab");if(requested&&["Genel Bakış","Kadro","Maçlar","İstatistik","Transfer","Tarihçe"].includes(requested))setTab(requested)},[]);
 async function load(){
  const {data:{user}}=await s.auth.getUser();if(!user){router.push("/login");return}
  const {data:m}=await s.from("club_members").select("club_id").eq("user_id",user.id).order("created_at",{ascending:false}).limit(1).maybeSingle();if(!m){router.push("/onboarding");return}
  const {data:c}=await s.from("clubs").select("name").eq("id",m.club_id).maybeSingle();const name=c?.name||"";setClubName(name);
  const [ps,ms,ts,pr,ln]=await Promise.all([
   s.from("scouting_players").select("id,name,position,age,overall,estimated_value_eur,avatar_url,alternate_positions").eq("is_active",true).eq("club",name).order("overall",{ascending:false}),
   s.from("matches").select("id,opponent,kickoff,home,goals_for,goals_against,competition,kickoff_time_known").eq("club_id",m.club_id).order("kickoff",{ascending:true}),
   s.from("transfer_targets").select("id,name,position,current_club,market_value,rating,priority,status").eq("club_id",m.club_id).order("created_at",{ascending:false}),
   s.from("club_profiles").select("*").eq("club_id",m.club_id).maybeSingle(),
   s.from("lineups").select("formation").eq("club_id",m.club_id).eq("is_active",true).limit(1).maybeSingle()
  ]);
  if(ps.error)setMsg(ps.error.message);else setPlayers((ps.data||[]).map((p:any)=>({id:p.id,name:p.name,position:p.position,age:p.age,rating:Number(p.overall||0),market_value:Number(p.estimated_value_eur||0),avatar_url:p.avatar_url,alternatePositions:Array.isArray(p.alternate_positions)?p.alternate_positions:[]})));
  setMatches((ms.data||[]) as Match[]);setTargets((ts.data||[]).map((x:any)=>({...x,market_value:Number(x.market_value||0),rating:Number(x.rating||0)})));setProfile(pr.data as any);setFormation(ln.data?.formation||"");setLoading(false)
 }
 useEffect(()=>{load()},[]);
 const total=useMemo(()=>players.reduce((a,p)=>a+p.market_value,0),[players]);const avg=useMemo(()=>players.length?players.reduce((a,p)=>a+p.rating,0)/players.length:0,[players]);
 const aiRecommendation=useMemo(()=>getAiLineupRecommendation(players),[players]);
 function openAiAlternatives(){
  if(!aiRecommendation?.recommendations.length)return;
  const suggestions=aiRecommendation.recommendations;
  const required=suggestions.some(x=>!x.playerName);
  const referenceIds=new Set(players.slice(0,11).map(p=>p.id));
  const referencePlayers=players.filter(p=>referenceIds.has(p.id)&&!suggestions.some(x=>x.playerName===p.name));
  const range=(key:"rating"|"age"|"market_value")=>{const nums=referencePlayers.map(p=>p[key]).filter((v):v is number=>typeof v==="number"&&Number.isFinite(v));return nums.length?{min:Math.min(...nums),max:Math.max(...nums)}:null};
  const genderId=null;
  const plan={formation:aiRecommendation.name,type:required?"required":"upgrade",roles:Array.from(new Set(suggestions.map(x=>x.role))),targets:suggestions.map(x=>({role:x.role,playerId:players.find(p=>p.name===x.playerName)?.id||null,playerName:x.playerName})),genderId,rating:range("rating"),age:range("age"),value:range("market_value"),createdAt:Date.now()};
  sessionStorage.setItem("dispficsTransferRequest",JSON.stringify(plan));localStorage.removeItem("dispficsTransferRequest");router.push("/ai");
 }
 const played=matches.filter(x=>x.goals_for!=null&&x.goals_against!=null),wins=played.filter(x=>Number(x.goals_for)>Number(x.goals_against)).length,draws=played.filter(x=>x.goals_for===x.goals_against).length,losses=played.length-wins-draws;
 return <AppShell title="Oyuncular"><div className="clubSquadPage">
  <section className="clubSquadHero"><div><small>PROFESYONEL KULÜP MERKEZİ</small><h2>{clubName||"Kulübünüz"}</h2><p>{profile?.founded_year||"—"} • {profile?.stadium||"Stadyum bilgisi yok"} • Teknik Direktör: {profile?.manager||"—"}</p></div><div className="clubSquadMetrics"><div><strong>{players.length}</strong><span>Oyuncu</span></div><div><strong>{displayRating(avg)}</strong><span>Ort. Reyting</span></div><div><strong>{money(total)}</strong><span><span style={{whiteSpace:"nowrap",display:"inline"}}>disp<b>F</b>ics</span> Kadro Değeri</span></div></div></section>
  <div className="clubTabs">{["Genel Bakış","Kadro","Maçlar","İstatistik","Transfer","Tarihçe"].map(x=><button key={x} className={tab===x?"on":""} onClick={()=>setTab(x)}>{x}</button>)}</div>{msg&&<p style={{color:"#9bcba7"}}>{msg}</p>}
  {tab==="Genel Bakış"&&<><section className="clubOverviewGrid"><div><small>KULÜP</small><h3>{clubName}</h3><p>{profile?.stadium||"—"} • {profile?.stadium_capacity?.toLocaleString("tr-TR")||"—"} kapasite<br/>Teknik Direktör: <b>{profile?.manager||"—"}</b><br/>Aktif diziliş: <b>{aiRecommendation?.name||"—"}</b></p></div><Metric t="KADRO" v={String(players.length)} s="Aktif oyuncu"/><Metric t="ORT. REYTİNG" v={String(displayRating(avg))} s="dispFics"/><Metric t="KADRO DEĞERİ" v={money(total)} s="dispFics tahmini"/></section><Source p={profile}/></>}
  {tab==="Kadro"&&<section className="clubSquadPanel"><div className="clubSquadHead"><div><small>KADRO</small><h3>{clubName} Oyuncuları</h3></div><span>{loading?"Yükleniyor…":players.length+" oyuncu"}</span></div><div className="clubSquadLabels"><span>OYUNCU</span><span>POZİSYON</span><span>YAŞ</span><span>disp<span style={{fontWeight:900}}>F</span>ics REYTİNG</span><span>DEĞER</span><span></span></div><div className="clubSquadList">{players.map(p=><button key={p.id} onClick={()=>router.push(`/scouting/${p.id}`)} className="clubSquadRow"><span className="clubSquadPlayer">{p.avatar_url?<img src={p.avatar_url} alt=""/>:<i>{initials(p.name)}</i>}<b>{p.name}</b></span><span>{p.position||"—"}</span><span>{p.age??"—"}</span><strong>{displayRating(p.rating)}</strong><span>{money(p.market_value)}</span><em>Detay →</em></button>)}</div></section>}
  {tab==="Maçlar"&&<section className="clubDataPanel"><div className="clubSquadHead"><div><small>2026/27</small><h3>Maçlar</h3></div><span>{matches.length} maç</span></div>{matches.map(x=><div className="clubMatchRow" key={x.id}><span><small>{x.competition||"Maç"}</small>{new Date(x.kickoff).toLocaleDateString("tr-TR")}</span><b>{x.home?clubName:x.opponent}</b><strong>{x.goals_for==null?"vs":x.home?`${x.goals_for} - ${x.goals_against}`:`${x.goals_against} - ${x.goals_for}`}</strong><b>{x.home?x.opponent:clubName}</b></div>)}</section>}
  {tab==="İstatistik"&&<><section className="clubOverviewGrid"><div><small>2026/27 MAÇ PERFORMANSI</small><h3>{played.length} oynanan maç</h3><p>Maç sonuçları ve mevcut dispFics kadro verilerinden hesaplanır.</p></div><Metric t="GALİBİYET" v={String(wins)} s="Maç"/><Metric t="BERABERLİK" v={String(draws)} s="Maç"/><Metric t="MAĞLUBİYET" v={String(losses)} s="Maç"/></section><section className="clubOverviewGrid" style={{marginTop:12}}><Metric t="ORT. REYTİNG" v={String(displayRating(avg))} s="Kadro"/><Metric t="KADRO DEĞERİ" v={money(total)} s="Tahmini"/><Metric t="EN DEĞERLİ" v={players[0]?money(Math.max(...players.map(p=>p.market_value))):"—"} s="Oyuncu değeri"/><Metric t="AKTİF DİZİLİŞ" v={aiRecommendation?`${aiRecommendation.name}`:"—"} s="İlk 11"/></section></>}
  {tab==="Transfer"&&<section className="clubDataPanel"><div className="clubSquadHead"><div><small>TRANSFER ÖNERİLERİ</small><h3>Transfer Hedefleri</h3></div><button className="clubAction" onClick={openAiAlternatives}>Alternatif oyuncuları göster →</button></div><div className="clubSquadPanel" style={{padding:0,border:0,background:"transparent",marginTop:12}}><div className="clubSquadLabels"><span>OYUNCU</span><span>POZİSYON</span><span>YAŞ</span><span>disp<b>F</b>ics REYTİNG</span><span>DEĞER</span><span></span></div><div className="clubSquadList">{aiRecommendation?.recommendations.map((x,i)=>{const p=players.find(p=>p.name===x.playerName);return <button key={i} onClick={openAiAlternatives} className="clubSquadRow"><span className="clubSquadPlayer">{p?.avatar_url?<img src={p.avatar_url} alt=""/>:<i>{initials(x.playerName||x.label)}</i>}<b>{x.playerName||"Transfer gerekli"}</b></span><span>{x.label}</span><span>{p?.age??"—"}</span><strong>{p?displayRating(p.rating):"—"}</strong><span>{p?money(p.market_value):"—"}</span><em>Alternatifler →</em></button>})}{!aiRecommendation?.recommendations.length&&<p className="clubSquadEmpty">{loading?"Yükleniyor…":"Şu anda transfer önerisi bulunmuyor."}</p>}</div></div></section>}
  {tab==="Tarihçe"&&<><section className="clubOverviewGrid"><div><small>KULÜP TARİHÇESİ</small><h3>{clubName}</h3><p>Kuruluş yılı: <b>{profile?.founded_year||"—"}</b><br/>Stadyum: <b>{profile?.stadium||"—"}</b><br/>Kapasite: <b>{profile?.stadium_capacity?.toLocaleString("tr-TR")||"—"}</b><br/>Resmî site: {profile?.website?<a href={profile.website} target="_blank" rel="noreferrer">bjk.com.tr</a>:"—"}</p></div><Metric t="DIŞ KAYNAK DEĞERİ" v={profile?.external_market_value_eur?money(profile.external_market_value_eur):"—"} s="Kaynak sayfasındaki değer"/><Metric t="KURULUŞ" v={String(profile?.founded_year||"—")} s="Yıl"/><Metric t="STADYUM" v={profile?.stadium||"—"} s="Kulüp bilgisi"/></section><Source p={profile}/></>}
 </div></AppShell>
}
function Metric({t,v,s}:{t:string;v:string;s:string}){return <div><small>{t}</small><strong>{v}</strong><span>{s}</span></div>}
function Source({p}:{p:Profile|null}){return p?.source?<p className="clubSource">Kulüp bilgileri doğrulanmış dış kaynak verileriyle desteklenmektedir.</p>:null}
function money(n:number){if(n>=1e9)return "€"+(n/1e9).toFixed(0)+"B";if(n>=1e6)return "€"+(n/1e6).toFixed(0)+"M";if(n>=1e3)return "€"+(n/1e3).toFixed(0)+"K";return "€"+n.toLocaleString("tr-TR")}
function initials(n:string){return n.split(" ").slice(0,2).map(x=>x[0]).join("").toUpperCase()}
