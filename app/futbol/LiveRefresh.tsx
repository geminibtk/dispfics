"use client";
import {useEffect} from "react";
import {useRouter} from "next/navigation";
export default function LiveRefresh(){const router=useRouter();useEffect(()=>{const timer=setInterval(()=>router.refresh(),60000);return()=>clearInterval(timer)},[router]);return <span style={{marginLeft:8,fontSize:11,color:"#72ca8b"}}>60 sn'de yenilenir</span>}
