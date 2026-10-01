import { NextResponse } from "next/server";
import { purgeOldData } from "@/lib/db";

export const runtime="nodejs";

export async function GET(req:Request){
  const supplied=req.headers.get("authorization")?.replace(/^Bearer\s+/i,"")||"";
  const expected=process.env.CRON_SECRET||"";
  if(!supplied||!expected||supplied.length!==expected.length)return new Response("Unauthorized",{status:401});
  const ok=Array.from(supplied).every((c,i)=>c===expected[i]);
  if(!ok)return new Response("Unauthorized",{status:401});
  await purgeOldData(Number(process.env.RETENTION_DAYS||30));
  return NextResponse.json({ok:true});
}
