"use client";
import {useState} from "react";
import styles from "./style.module.css";
type Player={id:number;name:string;number:number|null;rating:string|null;photo:string;grid:string};
type Team={id:number;name:string;logo:string;formation:string;players:Player[];substitutes:Player[]};
type Event={minute:string;team:string;player:string;assist:string;type:string;detail:string};
type Stat={label:string;home:string;away:string};
export default function MatchDetailTabs({teams,stats,events}:{teams:Team[];stats:Stat[];events:Event[]}){
 const [active,setActive]=useState<"lineups"|"stats"|"events">("lineups");
 const tabs=[{id:"lineups",name:"İlk 11 ve dizilişler"},{id:"stats",name:"Maç istatistikleri"},{id:"events",name:"Maç olayları"}] as const;
 const rows=(players:Player[])=>{const map=new Map<number,Player[]>();for(const p of players){const n=Number(p.grid.split(":")[0]);const key=n>0?n:99;if(!map.has(key))map.set(key,[]);map.get(key)!.push(p)}return Array.from(map.entries()).sort((a,b)=>a[0]-b[0]).map(x=>x[1])};
 return <section><nav className={styles.tabs} aria-label="Maç detay bölümleri">{tabs.map(t=><button type="button" key={t.id} className={active===t.id?styles.detailTabSelected:styles.detailTab} onClick={()=>setActive(t.id)}>{t.name}</button>)}</nav>
 {active==="lineups"&&(teams.length?<div className={styles.pitchGrid}>{teams.map(t=><div key={t.id} className={styles.pitchCard}><div className={styles.pitchHeading}><img src={t.logo} width="30" height="30" alt=""/><strong>{t.name}</strong><span>{t.formation}</span></div><div className={styles.pitch}>{rows(t.players).map((row,i)=><div className={styles.pitchRow} key={i}>{row.map(p=><div className={styles.pitchPlayer} key={p.id}><div className={styles.pitchPortrait}><img src={p.photo} alt="" loading="lazy"/><span>{p.number??"–"}</span></div><span>{p.name}</span>{p.rating&&<b className={styles.playerRating}>{p.rating}</b>}</div>)}</div>)}</div><div className={styles.substitutePanel}><h3>Oyuna giren oyuncular</h3>{t.substitutes.length?t.substitutes.map(p=><div className={styles.substituteRow} key={p.id}><img src={p.photo} width="38" height="38" alt="" loading="lazy"/><span><strong>{p.name}</strong><small>Forma no: {p.number??"–"}</small></span>{p.rating&&<b className={styles.playerRating}>{p.rating}</b>}</div>):<p className={styles.substituteEmpty}>Oyuncu değişikliği bulunmuyor.</p>}</div></div>)}</div>:<div className={styles.empty}>İlk 11 bilgisi henüz açıklanmadı.</div>)}
 {active==="stats"&&(stats.length?<div className={styles.panel}>{stats.map((s,i)=><div key={i} className={styles.match} style={{display:"grid",gridTemplateColumns:"1fr 1.5fr 1fr",gap:12,textAlign:"center"}}><strong>{s.home}</strong><span>{s.label}</span><strong>{s.away}</strong></div>)}</div>:<div className={styles.empty}>Maç istatistikleri henüz sağlanmadı.</div>)}
 {active==="events"&&(events.length?<div className={styles.panel}>{events.map((e,i)=><div key={i} className={styles.match}><strong>{e.minute}</strong> · {e.team} · {e.type==="subst"?<><span style={{color:"#7ee4a0"}}>Giren: {e.assist||"Bilinmiyor"}</span> · <span style={{color:"#e6a09a"}}>Çıkan: {e.player}</span></>:<>{e.player} — {e.detail||e.type}</>}</div>)}</div>:<div className={styles.empty}>Maç olayı henüz bulunmuyor.</div>)}
 </section>
}
