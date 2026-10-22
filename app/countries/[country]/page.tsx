"use client";
import {useEffect} from "react";
import {useParams,useRouter} from "next/navigation";
import AppShell from "../../components/AppShell";
export default function CountryDetail(){
 const params=useParams(),router=useRouter();
 const country=String(params.country||"");
 useEffect(()=>{router.replace("/lineup?country="+encodeURIComponent(decodeURIComponent(country)))},[country,router]);
 return <AppShell title="Aktif Kadro"><p>Kadro açılıyor…</p></AppShell>;
}
