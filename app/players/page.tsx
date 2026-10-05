"use client";
import {useEffect,useMemo,useState} from "react";
import {useRouter} from "next/navigation";
import {createClient} from "../../lib/supabase";
import AppShell from "../components/AppShell";

type Player={id:string;name:string;position:string;age:number|null;rating:number;market_value:number;avatar_url?:string|null};
export default function Players(){
 const s=createClient(),router=useRouter();
 const [clubName,setClubName]=useState("");const [players,setPlayers]=useState<Player[]>([]);const [msg,setMsg]=useState("");const [loading,setLoading]=useState(true);const [tab,setTab]=useState("Kadro");
 async function load(){
  const {data:{user}}=await s.auth.getUser();if(!user){router.push("/login");return}
  const {data:m}=await s.from("club_members").select("club_id").eq("user_id",user.id).order("created_at",{ascending:false}).limit(1).maybeSingle();if(!m){router.push("/onboarding");return}
  const {data:c}=await s.from("clubs").select("name").eq("id",m.club_id).maybeSingle();const name=c?.name||"";setClubName(name);
  const {data,error}=await s.from("scouting_players").select("id,name,position,age,overall,estimated_value_eur,avatar_url").eq("is_active",true).eq("club",name).order("overall",{ascending:false});
  if(error)setMsg(error.message);else setPlayers((data||[]).map((p:any)=>({id:p.id,name:p.name,position:p.position,age:p.age,rating:Number(p.overall||0),market_value:Number(p.estimated_value_eur||0),avatar_url:p.avatar_url})));
  setLoading(false)
 }
 useEffect(()=>{load()},[]);
 const total=useMemo(()=>players.reduce((a,p)=>a+p.market_value,0),[players]);
 const avg=useMemo(()=>players.length?players.reduce((a,p)=>a+p.rating,0)/players.length:0,[players]);
 return <AppShell title="Oyuncular"><div className="clubSquadPage">
  <section className="clubSquadHero"><div><small>PROFESYONEL KADRO</small><h2>{clubName||"Kulübünüz"}</h2><p>Aktif A takım kadrosu • Dispfics canlı oyuncu verisi</p></div><div className="clubSquadMetrics"><div><strong>{players.length}</strong><span>Oyuncu</span></div><div><strong>{avg.toFixed(1)}</strong><span>Ort. Reyting</span></div><div><strong>{money(total)}</strong><span>Kadro Değeri</span></div></div></section>
  <div className="clubTabs">{["Genel Bakış","Kadro","Maçlar","İstatistik","Transfer","Tarihçe"].map(x=><button key={x} className={tab===x?"on":""} onClick={()=>setTab(x)}>{x}</button>)}</div>{msg&&<p style={{color:"#9bcba7"}}>{msg}</p>}
  {tab==="Kadro"&&<section className="clubSquadPanel"><div className="clubSquadHead"><div><small>KADRO</small><h3>{clubName} Oyuncuları</h3></div><span>{loading?"Yükleniyor…":players.length+" oyuncu"}</span></div>
   <div className="clubSquadLabels"><span>OYUNCU</span><span>POZİSYON</span><span>YAŞ</span><span>DISPFICS REYTİNG</span><span>DEĞER</span><span></span></div>
   <div className="clubSquadList">{!loading&&players.length===0?<p className="clubSquadEmpty">Kulübün aktif oyuncu kadrosu bulunamadı.</p>:players.map(p=><button key={p.id} onClick={()=>router.push(`/scouting/${p.id}`)} className="clubSquadRow">
    <span className="clubSquadPlayer">{p.avatar_url?<img src={p.avatar_url} alt=""/>:<i>{initials(p.name)}</i>}<b>{p.name}</b></span><span>{p.position||"—"}</span><span>{p.age??"—"}</span><strong>{p.rating.toFixed(0)}</strong><span>{money(p.market_value)}</span><em>Detay →</em>
   </button>)}</div>
  </section>}
  {tab==="Genel Bakış"&&<section className="clubOverviewGrid"><div><small>KULÜP</small><h3>{clubName}</h3><p>Profesyonel A takım kadrosu Dispfics oyuncu verileriyle tek merkezden takip edilir.</p></div><div><small>KADRO</small><strong>{players.length}</strong><span>Aktif oyuncu</span></div><div><small>ORTALAMA REYTİNG</small><strong>{avg.toFixed(1)}</strong><span>Dispfics</span></div><div><small>KADRO DEĞERİ</small><strong>{money(total)}</strong><span>Tahmini toplam değer</span></div></section>}
  {tab==="Maçlar"&&<Empty title="Maçlar" text="Beşiktaş fikstürü ve maç sonuçları bu bölümde gösterilecek. Doğrulanmış maç verisi henüz Dispfics veritabanına bağlı değil."/>}
  {tab==="İstatistik"&&<section className="clubOverviewGrid"><div><small>KADRO ANALİZİ</small><h3>Takım İstatistikleri</h3><p>Mevcut kadro verisinden üretilen temel göstergeler.</p></div><div><small>OYUNCU</small><strong>{players.length}</strong><span>Aktif kadro</span></div><div><small>ORT. REYTİNG</small><strong>{avg.toFixed(1)}</strong><span>Takım seviyesi</span></div><div><small>TOPLAM DEĞER</small><strong>{money(total)}</strong><span>Kadro değeri</span></div></section>}
  {tab==="Transfer"&&<section className="clubLinkPanel"><div><small>TRANSFER MERKEZİ</small><h3>Kadro planlamasını yönetin</h3><p>Takip listeniz ve transfer hedefleriniz için Transfer Merkezi'ne geçin.</p></div><button onClick={()=>router.push("/transfers")}>Transfer Merkezi →</button></section>}
  {tab==="Tarihçe"&&<Empty title="Kulüp Tarihçesi" text="Tarihçe için doğrulanmış kulüp verisi henüz Dispfics veritabanında bulunmuyor. Dış kaynaktaki bilgileri doğrulamadan uygulama verisi olarak göstermiyoruz."/>}
 </div></AppShell>
}
function money(n:number){if(n>=1e9)return "€"+(n/1e9).toFixed(1)+"B";if(n>=1e6)return "€"+(n/1e6).toFixed(1)+"M";if(n>=1e3)return "€"+(n/1e3).toFixed(0)+"K";return "€"+n.toLocaleString("tr-TR")}
function initials(n:string){return n.split(" ").slice(0,2).map(x=>x[0]).join("").toUpperCase()}

function Empty({title,text}:{title:string;text:string}){return <section className="clubEmptyModule"><small>DİSPFICS KULÜP MERKEZİ</small><h3>{title}</h3><p>{text}</p></section>}
