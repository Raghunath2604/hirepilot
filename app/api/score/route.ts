import {NextResponse} from "next/server";
import {requireUser} from "@/lib/auth";
import {getInterview,saveScore,saveTranscript} from "@/lib/db";
import {getOpenAI,analysisModel} from "@/lib/openai";
import {scoreInstructions,scoreSchema} from "@/lib/prompts";
import {scoreSchemaInput} from "@/lib/validation";

export const runtime="nodejs";

export async function POST(req:Request){
 try{
  const user=await requireUser(),body=scoreSchemaInput.parse(await req.json()),interview=await getInterview(body.interviewId,user.id);
  if(!interview)return NextResponse.json({error:"Interview not found"},{status:404});
  await saveTranscript(body.interviewId,user.id,body.round,body.transcript);
  const transcript=body.transcript.map(x=>`${x.role==="assistant"?"INTERVIEWER":"CANDIDATE"}: ${x.text}`).join("\n");
  const response=await getOpenAI().responses.create({model:analysisModel(),store:false,instructions:scoreInstructions(body.round),input:`Role: ${interview.role_title}\nResume analysis: ${JSON.stringify(interview.resume_analysis)}\nTranscript:\n${transcript}`,text:{format:{type:"json_schema",name:"scorecard",strict:true,schema:scoreSchema}}});
  const score=JSON.parse(response.output_text);
  await saveScore(body.interviewId,user.id,body.round,score);
  const hook=process.env.ZAPIER_WEBHOOK_URL;
  if(hook)void fetch(hook,{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({event:"interview.scorecard.created",interviewId:body.interviewId,role:interview.role_title,round:body.round,score})}).catch(()=>{});
  return NextResponse.json({score});
 }catch(e){const message=e instanceof Error?e.message:"Scoring failed";return NextResponse.json({error:message},{status:message==="UNAUTHORIZED"?401:400});}
}
