"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import type { InterviewRound, ResumeAnalysis, Scorecard, TranscriptItem } from "@/lib/types";

export type InterviewData = {
  id: string;
  role_title: string;
  job_description: string;
  resume_analysis: ResumeAnalysis;
  status: string;
  scorecards?: Array<{ round: InterviewRound; scorecard: Scorecard }>;
  interview_rounds?: Array<{ round: InterviewRound; transcript: TranscriptItem[] }>;
};

type Props = { interview: InterviewData };
type State = "idle" | "connecting" | "listening" | "speaking" | "finishing" | "complete" | "error";

export function InterviewRoom({ interview }: Props) {
  const initialRound: InterviewRound = interview.status === "hr" ? "hr" : "technical";
  const [round, setRound] = useState<InterviewRound>(initialRound);
  const [transcript, setTranscript] = useState<TranscriptItem[]>(
    () => interview.interview_rounds?.find(item => item.round === initialRound)?.transcript ?? [],
  );
  const [state, setState] = useState<State>("idle");
  const [muted, setMuted] = useState(false);
  const [error, setError] = useState("");
  const [score, setScore] = useState<Scorecard | null>(
    () => interview.scorecards?.find(item => item.round === initialRound)?.scorecard ?? null,
  );
  const [showBrief, setShowBrief] = useState(true);

  const pcRef = useRef<RTCPeerConnection | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const channelRef = useRef<RTCDataChannel | null>(null);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const transcriptRef = useRef<HTMLDivElement | null>(null);
  const draftsRef = useRef(new Map<string, string>());

  useEffect(() => {
    transcriptRef.current?.scrollTo({ top: transcriptRef.current.scrollHeight, behavior: "smooth" });
  }, [transcript]);

  useEffect(() => () => {
    channelRef.current?.close();
    pcRef.current?.close();
    streamRef.current?.getTracks().forEach(track => track.stop());
  }, []);

  function selectRound(nextRound: InterviewRound) {
    if (state !== "idle" && state !== "complete") return;
    const nextTranscript = interview.interview_rounds?.find(item => item.round === nextRound)?.transcript ?? [];
    const nextScore = interview.scorecards?.find(item => item.round === nextRound)?.scorecard ?? null;
    setRound(nextRound);
    setTranscript(nextTranscript);
    setScore(nextScore);
    setError("");
    setState("idle");
    setMuted(false);
  }

  function upsert(item: TranscriptItem) {
    setTranscript(current => {
      const index = current.findIndex(value => value.id === item.id);
      if (index === -1) return [...current, item].sort((a,b) => a.at - b.at);
      const next = [...current];
      next[index] = item;
      return next;
    });
  }

  function handleEvent(raw: string) {
    try {
      const event = JSON.parse(raw) as Record<string, unknown>;
      const type = String(event.type || "");
      if (type === "input_audio_buffer.speech_started") setState("listening");
      if (type === "response.done") setState("listening");

      if (type === "response.output_audio_transcript.delta") {
        const itemId = String(event.item_id || event.response_id || crypto.randomUUID());
        const text = (draftsRef.current.get(itemId) || "") + String(event.delta || "");
        draftsRef.current.set(itemId, text);
        upsert({ id: `assistant-${itemId}`, role: "assistant", text, at: Date.now() });
        setState("speaking");
      }

      if (type === "response.output_audio_transcript.done") {
        const itemId = String(event.item_id || event.response_id || crypto.randomUUID());
        const text = String(event.transcript || draftsRef.current.get(itemId) || "").trim();
        if (text) upsert({ id: `assistant-${itemId}`, role: "assistant", text, at: Date.now() });
        draftsRef.current.delete(itemId);
      }

      if (type === "conversation.item.input_audio_transcription.completed") {
        const text = String(event.transcript || "").trim();
        if (text) upsert({ id: `candidate-${String(event.item_id || crypto.randomUUID())}`, role: "user", text, at: Date.now() });
        setState("speaking");
      }

      if (type === "error") {
        const errorValue = event.error;
        const message = errorValue && typeof errorValue === "object" && "message" in errorValue
          ? String((errorValue as {message?: unknown}).message || "Voice error")
          : "Voice session error.";
        setError(message);
        setState("error");
      }
    } catch {
      // Ignore malformed event payloads.
    }
  }

  async function waitForIce(pc: RTCPeerConnection) {
    if (pc.iceGatheringState === "complete") return;
    await new Promise<void>(resolve => {
      const timeout = window.setTimeout(resolve, 3000);
      const done = () => {
        if (pc.iceGatheringState === "complete") {
          window.clearTimeout(timeout);
          pc.removeEventListener("icegatheringstatechange", done);
          resolve();
        }
      };
      pc.addEventListener("icegatheringstatechange", done);
    });
  }

  async function stopSession() {
    channelRef.current?.close();
    pcRef.current?.close();
    streamRef.current?.getTracks().forEach(track => track.stop());
    channelRef.current = null;
    pcRef.current = null;
    streamRef.current = null;
  }

  async function startSession() {
    setError("");
    setScore(null);
    setState("connecting");

    try {
      const roundResponse = await fetch(`/api/interviews/${interview.id}/round`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ round }),
      });
      const roundPayload = await roundResponse.json().catch(() => ({}));
      if (!roundResponse.ok) throw new Error(roundPayload.error || "Unable to start the round.");

      const tokenResponse = await fetch("/api/realtime-token", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ interviewId: interview.id, round }),
        cache: "no-store",
      });
      const tokenPayload = await tokenResponse.json().catch(() => ({}));
      if (!tokenResponse.ok || typeof tokenPayload.value !== "string") {
        throw new Error(tokenPayload.error || "Unable to create the secure voice session.");
      }

      await stopSession();
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: { echoCancellation: true, noiseSuppression: true, autoGainControl: true },
      });
      streamRef.current = stream;

      const pc = new RTCPeerConnection();
      pcRef.current = pc;
      pc.ontrack = event => {
        const stream = event.streams[0];
        if (!audioRef.current || !stream) return;
        audioRef.current.srcObject = stream;
        void audioRef.current.play().catch(() => {});
      };
      pc.onconnectionstatechange = () => {
        if (pc.connectionState === "failed" || pc.connectionState === "disconnected") {
          setError("Voice connection dropped. Start the round again.");
          setState("error");
        }
      };
      stream.getTracks().forEach(track => pc.addTrack(track, stream));

      const channel = pc.createDataChannel("oai-events");
      channelRef.current = channel;
      channel.onopen = () => {
        setState("listening");
        channel.send(JSON.stringify({ type: "response.create" }));
      };
      channel.onmessage = message => handleEvent(message.data);

      await pc.setLocalDescription(await pc.createOffer({ offerToReceiveAudio: true }));
      await waitForIce(pc);
      const sdp = pc.localDescription?.sdp;
      if (!sdp) throw new Error("Could not create the browser voice offer.");

      const response = await fetch("https://api.openai.com/v1/realtime/calls", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${tokenPayload.value}`,
          "Content-Type": "application/sdp",
        },
        body: sdp,
      });
      const answer = await response.text();
      if (!response.ok) throw new Error("The protected voice session could not be established.");

      await pc.setRemoteDescription({ type: "answer", sdp: answer });
    } catch (err) {
      await stopSession();
      setState("error");
      setError(err instanceof Error ? err.message : "Voice session failed.");
    }
  }

  async function finishRound() {
    if (state === "connecting" || state === "finishing") return;
    setState("finishing");
    setError("");
    await new Promise(resolve => window.setTimeout(resolve, 800));
    const finalTranscript = [...transcript].sort((a,b) => a.at - b.at);

    try {
      await stopSession();
      const response = await fetch("/api/score", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ interviewId: interview.id, round, transcript: finalTranscript }),
      });
      const payload = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(payload.error || "Could not score this round.");
      setScore(payload.score as Scorecard);
      setState("complete");
    } catch (err) {
      setState("error");
      setError(err instanceof Error ? err.message : "Scoring failed.");
    }
  }

  return (
    <section className="section">
      <audio ref={audioRef} autoPlay playsInline />
      <div className="interview">
        <div className="panel">
          <div className="top compact-top">
            <div><span className="tag">{round === "technical" ? "Technical" : "HR / Behavioral"}</span><h2>{interview.role_title}</h2></div>
            <Link className="button ghost" href="/dashboard">Exit</Link>
          </div>

          <div className="round-tabs">
            <button className={round === "technical" ? "tab active" : "tab"} onClick={() => selectRound("technical")} disabled={state !== "idle" && state !== "complete"}>Technical</button>
            <button className={round === "hr" ? "tab active" : "tab"} onClick={() => selectRound("hr")} disabled={!interview.scorecards?.some(item => item.round === "technical") || (state !== "idle" && state !== "complete")}>HR / Behavioral</button>
          </div>

          <div className="voice">
            <div className={`orb ${state === "listening" || state === "speaking" ? "active" : ""}`}>
              {state === "speaking" ? "●" : state === "listening" ? "◌" : "◍"}
            </div>
          </div>

          <div className="panel mini-panel">
            <div className="top compact-top">
              <div><strong>{state === "connecting" ? "Connecting…" : state === "speaking" ? "AI interviewer speaking" : state === "listening" ? "Your microphone is live" : state === "finishing" ? "Scoring transcript…" : "Ready when you are"}</strong><div className="muted tiny">~8 substantive questions • one main question at a time</div></div>
              <span className={`tag ${state === "error" ? "danger" : ""}`}>{state}</span>
            </div>
            <div className="actions">
              {(state === "idle" || state === "error" || state === "complete") && (
                <button className="button primary" onClick={startSession}>Start {round === "technical" ? "Technical" : "HR"} voice round</button>
              )}
              {state === "listening" || state === "speaking" ? (
                <>
                  <button className="button ghost" onClick={() => { const track = streamRef.current?.getAudioTracks()[0]; if (track) { track.enabled = !track.enabled; setMuted(!track.enabled); } }}>{muted ? "Unmute mic" : "Mute mic"}</button>
                  <button className="button danger" onClick={finishRound}>Finish & score</button>
                </>
              ) : null}
            </div>
            {error && <div className="error">{error}</div>}
          </div>

          {score && (
            <div className="success section">
              <strong>Round score: {score.overall.toFixed(1)} / 5</strong>
              <p className="muted tiny">Coaching feedback derived from the transcript only.</p>
              <div className="actions">
                {round === "technical"
                  ? <button className="button primary" onClick={() => selectRound("hr")}>Continue to HR / Behavioral</button>
                  : <Link className="button primary" href={`/report/${interview.id}`}>View final report</Link>}
              </div>
            </div>
          )}
        </div>

        <aside className="panel">
          <div className="top compact-top">
            <div><span className="tag">Recruiter brief</span><h3>ATS + evidence map</h3></div>
            <button className="button ghost" onClick={() => setShowBrief(value => !value)}>{showBrief ? "Hide" : "Show"}</button>
          </div>
          {showBrief && (
            <>
              <p>{interview.resume_analysis.summary}</p>
              <div className="chips">{interview.resume_analysis.atsKeywords.slice(0, 16).map(item => <span className="chip" key={item.keyword}>{item.keyword}</span>)}</div>
              <div className="section"><strong>Matched skills</strong><div className="chips">{interview.resume_analysis.matchedSkills.slice(0, 12).map(item => <span className="chip" key={item}>{item}</span>)}</div></div>
              <div className="section"><strong>Evidence gaps</strong>{interview.resume_analysis.gaps.length ? <ul className="clean-list">{interview.resume_analysis.gaps.slice(0,8).map(item => <li key={item}>{item}</li>)}</ul> : <p className="muted">No material gaps flagged.</p>}</div>
              <div className="section"><strong>Interview focus</strong><ul className="clean-list">{interview.resume_analysis.interviewFocus.slice(0,8).map(item => <li key={item}>{item}</li>)}</ul></div>
            </>
          )}
          <div className="section">
            <div className="top compact-top"><strong>Live transcript</strong><span className="muted tiny">{transcript.length} entries</span></div>
            <div ref={transcriptRef} className="transcript">
              {transcript.length ? transcript.map(item => <div className="msg" key={item.id}><div className="tiny muted">{item.role === "assistant" ? "AI interviewer" : "You"}</div><div>{item.text}</div></div>) : <div className="muted">Voice transcript will appear here.</div>}
            </div>
          </div>
        </aside>
      </div>
    </section>
  );
}
