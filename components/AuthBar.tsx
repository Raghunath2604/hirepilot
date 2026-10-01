"use client";
import { useEffect, useState } from "react";
import type { AuthChangeEvent, Session } from "@supabase/supabase-js";
import { getSupabaseBrowser } from "@/lib/supabase-browser";

export function AuthBar() {
  const [email,setEmail]=useState("");
  const [user,setUser]=useState<string|null>(null);
  const [message,setMessage]=useState("");
  useEffect(()=>{
    const supabase=getSupabaseBrowser(); if(!supabase)return;
    supabase.auth.getUser().then(({data}:{data:{user:Session["user"]|null}})=>setUser(data.user?.email??null));
    const {data:listener}=supabase.auth.onAuthStateChange((_event:AuthChangeEvent,session:Session|null)=>setUser(session?.user?.email??null));
    return ()=>listener.subscription.unsubscribe();
  },[]);
  async function login(){
    const supabase=getSupabaseBrowser();
    if(!supabase){setMessage("Configure Supabase first.");return;}
    const {error}=await supabase.auth.signInWithOtp({email,options:{emailRedirectTo:window.location.origin}});
    setMessage(error?"Authentication error":"Check your email for the sign-in link.");
  }
  async function logout(){await getSupabaseBrowser()?.auth.signOut();}
  return <div className="authbar">{user?<><span className="pill">{user}</span><button className="button ghost" onClick={logout}>Sign out</button></>:<><input className="input compact" placeholder="email@you.com" value={email} onChange={e=>setEmail(e.target.value)}/><button className="button ghost" onClick={login}>Sign in</button></>}{message&&<span className="muted tiny">{message}</span>}</div>;
}
