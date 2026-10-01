import { NextResponse } from "next/server";
import { requireUser } from "@/lib/auth";
import { listInterviews } from "@/lib/db";

export const runtime = "nodejs";

export async function GET() {
  try { const user=await requireUser(); return NextResponse.json({interviews:await listInterviews(user.id)}); }
  catch(e){const message=e instanceof Error?e.message:"Unexpected error";return NextResponse.json({error:message},{status:message==="UNAUTHORIZED"?401:500});}
}
