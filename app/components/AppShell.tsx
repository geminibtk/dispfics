"use client";
import {ReactNode,Suspense,useEffect,useState} from "react";import {usePathname,useRouter,useSearchParams} from "next/navigation";import {LayoutDashboard,Users,Search,BrainCircuit,BarChart3,Settings,Shield,Activity,Menu,X,Landmark} from "lucide-react";
const nav=[["Genel Bakış","/",LayoutDashboard],["Oyuncu Keşfi","/scouting",Search],["Takımlar","/teams",Landmark],["Ülkeler","/countries",Shield],] as const;
export default function AppShell({title,children,hideTitle=false}:{title:string;children:ReactNode;hideTitle?:boolean}){return <Suspense fallback={null}><AppShellContent title={title} hideTitle={hideTitle}>{children}</AppShellContent></Suspense>}
function AppShellContent({title,children,hideTitle}:{title:string;children:ReactNode;hideTitle:boolean}){
 const router=useRouter(),path=usePathname(),searchParams=useSearchParams(),[open,setOpen]=useState(false);
 const [selected,setSelected]=useState({team:"",league:""}),[selectionNotice,setSelectionNotice]=useState(false);
 const teamDetail=path.startsWith("/teams/");
 const teamLineup=path==="/lineup"&&searchParams.has("team");
 const teamAI=path==="/ai"&&searchParams.has("team");
 const routeTeam=teamDetail?decodeURIComponent(path.split("/").slice(2).join("/")):(teamLineup||teamAI)?searchParams.get("team")||"":"";
 const routeLeague=searchParams.get("league")||"";
 useEffect(()=>{
  if(routeTeam){
   const current={team:routeTeam,league:routeLeague};
   setSelected(current);
   try{sessionStorage.setItem("yf-selected-team",JSON.stringify(current))}catch{}
  }else{
   try{const stored=sessionStorage.getItem("yf-selected-team");if(stored){const parsed=JSON.parse(stored);if(typeof parsed.team==="string"&&typeof parsed.league==="string")setSelected(parsed)}}catch{}
  }
 },[routeTeam,routeLeague]);
 const teamName=routeTeam||selected.team,teamLeague=routeTeam?routeLeague:selected.league;
 const teamBase="/teams/"+encodeURIComponent(teamName)+"?league="+encodeURIComponent(teamLeague);
 const lineupHref="/lineup?team="+encodeURIComponent(teamName)+"&league="+encodeURIComponent(teamLeague);
 const teamNav=[["Aktif Kadro",lineupHref,Users],["Transfer Merkezi",teamBase+"&view=transfers",Search],["Oyuncular",teamBase+"&view=players",Users],["İstatistikler",teamBase+"&view=statistics",BarChart3],["Rakip Analizi",teamBase+"&view=matchup",Activity],["AI Teknik Asistan","/ai?team="+encodeURIComponent(teamName)+"&league="+encodeURIComponent(teamLeague),BrainCircuit],["Kulüp Merkezi",teamBase+"&view=club",Landmark]] as const;
 function go(h:string){setOpen(false);setSelectionNotice(false);router.push(h)}
 function goTeam(h:string){if(!teamName){setSelectionNotice(true);return}go(h)}
 return <div className="appShell"><button type="button" className="mobileMenu" aria-label={open?"Menüyü kapat":"Menüyü aç"} aria-expanded={open} aria-controls="app-sidebar-navigation" onClick={()=>setOpen(!open)}>{open?<X/>:<Menu/>}</button>{open&&<div className="shellBackdrop" onClick={()=>setOpen(false)}/>}<aside id="app-sidebar-navigation" className={"shellAside "+(open?"shellOpen":"")}><div className="brand"><div className="mark">YF</div><div><b>YanımdaFutbol</b><small>FUTBOLUN HER ŞEYİ YANINDA</small></div></div><nav>
 {nav.map(([n,h,I])=><button key={h} className={path===h?"on":""} onClick={()=>go(h)}><I size={18}/>{n}</button>)}
 <div style={{padding:"8px 10px 4px",fontSize:11,color:"#9bcba7",fontWeight:700}}>TAKIM MENÜSÜ{teamName?" · "+teamName:""}</div>
 {teamNav.map(([n,h,I])=><button key={n} className={((teamLineup&&n==="Aktif Kadro")||(teamAI&&n==="AI Teknik Asistan")||(teamDetail&&n!=="Aktif Kadro"&&new URLSearchParams(h.split("?")[1]||"").get("view")===(searchParams.get("view")||"players")))?"on":""} onClick={()=>goTeam(h)}><I size={18}/>{n}</button>)}
 {selectionNotice&&<div role="status" style={{margin:"6px 10px 12px",padding:10,border:"1px solid #406b4d",borderRadius:8,color:"#c5e2cb",fontSize:12}}>Önce Takımlar sayfasından bir takım seçmelisin.</div>}
 </nav><button className="settings" onClick={()=>go("/settings")}><Settings size={18}/>Ayarlar</button></aside><section className="shellContent"><header className={path==="/lineup"?"lineupShellHeader":undefined}>{!hideTitle&&<div><span className="eyebrow">FUTBOL MERKEZİ</span><h1>{title}</h1></div>}<div className="club"><Shield/><div><b>YanımdaFutbol</b><small>Futbol analiz platformu</small></div></div></header><div className="shellPage">{children}</div></section></div>
}
