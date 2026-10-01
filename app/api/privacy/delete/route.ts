import { NextResponse } from "next/server";
import { requireUser } from "@/lib/auth";
import { deleteUserData } from "@/lib/db";

export const runtime="nodejs";

async function remove(req:Request){
  const origin=req.headers.get("origin");
  if(origin && origin!==new URL(req.url).origin)return new Response("Invalid origin",{status:403});
  try{const user=await requireUser();await deleteUserData(user.id);return NextResponse.json({deleted:true});}
  catch(e){const message=e instanceof Error?e.message:"Deletion failed";return NextResponse.json({error:message},{status:message==="UNAUTHORIZED"?401:500});}
}
export async function POST(req:Request){return remove(req);}
export async function DELETE(req:Request){return remove(req);}
