import { NextResponse } from "next/server";
import { requireUser } from "@/lib/auth";
import { getInterview } from "@/lib/db";

export const runtime="nodejs";

export async function GET(_req:Request,ctx:{params:Promise<{id:string}>}){
  try{const user=await requireUser();const {id}=await ctx.params;const interview=await getInterview(id,user.id);if(!interview)return NextResponse.json({error:"Interview not found"},{status:404});return NextResponse.json({interview});}
  catch(e){const message=e instanceof Error?e.message:"Unexpected error";return NextResponse.json({error:message},{status:message==="UNAUTHORIZED"?401:500});}
}
