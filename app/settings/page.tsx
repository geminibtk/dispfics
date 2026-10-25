"use client";
import {useEffect,useState} from "react";
import {useRouter} from "next/navigation";
import {createClient} from "../../lib/supabase";
import AppShell from "../components/AppShell";
export default function SettingsPage(){
 const router=useRouter();
 const [email,setEmail]=useState(""),[club,setClub]=useState(""),[loading,setLoading]=useState(true),[busy,setBusy]=useState(false),[error,setError]=useState(""),[signedIn,setSignedIn]=useState(false);
 useEffect(()=>{let active=true;(async()=>{try{
  const s=createClient();const {data:{user},error:authError}=await s.auth.getUser();
  if(!active)return;
  if(!user){setSignedIn(false);if(authError&&authError.message!=="Auth session missing!")setError("Oturum bilgisi doğrulanamadı. Yeniden giriş yapabilirsiniz.");return}
  setSignedIn(true);setEmail(user.email||"");
  const {data:m}=await s.from("club_members").select("club_id").eq("user_id",user.id).order("created_at",{ascending:false}).limit(1).maybeSingle();
  if(!active)return;
  if(m){const {data:c}=await s.from("clubs").select("name").eq("id",m.club_id).maybeSingle();if(active)setClub(c?.name||"")}
 }catch{if(active)setError("Hesap bilgileri yüklenemedi. Sayfayı yenileyebilirsiniz.")}finally{if(active)setLoading(false)}}})();return()=>{active=false}},[]);
 async function signOut(){setBusy(true);setError("");try{const {error}=await createClient().auth.signOut();if(error)throw error;setSignedIn(false);setEmail("");setClub("");router.replace("/login");router.refresh()}catch{setError("Çıkış işlemi tamamlanamadı. Lütfen tekrar deneyin.")}finally{setBusy(false)}}
 return <AppShell title="Ayarlar"><div style={{maxWidth:680,display:"grid",gap:20}}>{loading?<p>Ayarlar yükleniyor…":<><section className="clubSquadPanel" style={{padding:24}}><h2>Hesap Bilgileri</h2><p style={{color:"#8fa399"}}>{signedIn?"Oturum açtığınız hesabın bilgileri":"Bu cihazda açık bir oturum bulunmuyor."}</p><p><strong>E-posta:</strong> {email||"—"}</p><p><strong>Kulüp:</strong> {club||"Henüz seçilmedi"}</p></section><section className="clubSquadPanel" style={{padding:24}}><h2>Oturum</h2><p style={{color:"#8fa399"}}>{signedIn?"Bu cihazdaki YanımdaFutbol oturumunuzu kapatabilirsiniz.":"Hesap bilgilerinizi görmek için giriş yapın."}</p>{signedIn?<button type="button" className="playerBack" onClick={signOut} disabled={busy}>{busy?"Çıkış yapılıyor…":"Çıkış Yap"}</button>:<button type="button" className="playerBack" onClick={()=>router.push("/login")}>Giriş Yap</button>}</section>{error&&<p role="alert">{error}</p>}</>}</div></AppShell>
}
