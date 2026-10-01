"use client";
import { useEffect, useState } from "react";

export function AuthBar() {
  const [email,setEmail]=useState("");
  const [user,setUser]=useState<string|null>(null);
  const [message,setMessage]=useState("");
  useEffect(()=>{
    let cancelled=false;
    async function load(){
      const response=await fetch("/api/auth/session",{cache:"no-store"});
      const payload=await response.json().catch(()=>({}));
      if(!cancelled)setUser(payload.email??null);
    }
    void load();
    return ()=>{cancelled=true};
  },[]);
  async function login(){
    setMessage("");
    const clean=email.trim();
    if(!/^[^s@]+@[^s@]+.[^s@]+$/.test(clean)){setMessage("Enter a valid email.");return;}
    const response=await fetch("/api/auth/request-link",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({email:clean})});
    const payload=await response.json().catch(()=>({}));
    setMessage(response.ok?"Check your email for the sign-in link.":payload.error||"Authentication error.");
  }
  async function logout(){await fetch("/api/auth/signout",{method:"POST"});window.location.assign("/");}
  return <div className="authbar">{user?<><span className="pill">{user}</span><button className="button ghost" onClick={logout}>Sign out</button></>:<><input className="input compact" placeholder="email@you.com" value={email} onChange={e=>setEmail(e.target.value)}/><button className="button ghost" onClick={login}>Sign in</button></>}{message&&<span className="muted tiny">{message}</span>}</div>;
}
