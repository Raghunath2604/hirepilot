"use client";

import Link from "next/link";
import { useParams, useRouter, useSearchParams } from "next/navigation";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";

type InterviewRound = "technical" | "hr";
type TranscriptItem = { id: string; role: "user" | "assistant"; text: string; at: number };

type InterviewRecord = {
  id: string;
  role_title: string;
  job_description: string;
  resume_analysis: {
    summary: string;
    matchedSkills: string[];
    gaps: string[];
    interviewFocus: string[];
  };
  status: string;
  scorecards?: Array<{ round: InterviewRound; scorecard: { overall: number } }>;
  interview_rounds?: Array<{ round: InterviewRound; transcript: TranscriptItem[] }>;
};

export default function InterviewPage() {
  const params = useParams<{ id: string }>();
  const searchParams = useSearchParams();
  const router = useRouter();

  const [interview, setInterview] = useState<InterviewRecord | null>(null);
  const [round, setRound] = useState<InterviewRound>((searchParams.get("round") as InterviewRound) || "technical");
  const [transcript, setTranscript] = useState<TranscriptItem[]>([]);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);
  const [connecting, setConnecting] = useState(false);
  const [connected, setConnected] = useState(false);
  const [scoring, setScoring] = useState(false);
  const [scoreResult, setScoreResult] = useState<{ overall: number } | null>(null);
  const [muted, setMuted] = useState(false);

  const pcRef = useRef<RTCPeerConnection | null>(null);
  const channelRef = useRef<RTCDataChannel | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const audioRef = useRef<HTMLAudioElement | null>(null);

  const id = String(params.id || "");

  const loadInterview = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const response = await fetch(`/api/interviews/${id}`);
      const data = (await response.json()) as { interview?: InterviewRecord; error?: string };
      if (!response.ok || !data.interview) throw new Error(data.error || "Unable to load interview");
      setInterview(data.interview);

      const defaultRound = data.interview.scorecards?.some((entry) => entry.round === "technical") ? "hr" : "technical";
      if (!searchParams.get("round")) setRound(defaultRound);

      const existingRound = data.interview.interview_rounds?.find((entry) => entry.round === round);
      if (existingRound?.transcript?.length) setTranscript(existingRound.transcript);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unexpected error");
    } finally {
      setLoading(false);
    }
  }, [id, round, searchParams]);

  useEffect(() => {
    void loadInterview();
  }, [loadInterview]);

  useEffect(
    () => () => {
      if (streamRef.current) streamRef.current.getTracks().forEach((track) => track.stop());
      if (pcRef.current) pcRef.current.close();
    },
    []
  );

  const askedQuestions = useMemo(
    () => transcript.filter((item) => item.role === "assistant" && item.text.includes("?")).length,
    [transcript]
  );

  function appendTranscript(role: "user" | "assistant", text: string) {
    const cleaned = text.trim();
    if (!cleaned) return;
    setTranscript((items) => [
      ...items,
      {
        id: crypto.randomUUID(),
        role,
        text: cleaned,
        at: Date.now()
      }
    ]);
  }

  async function startRoundSession() {
    if (!interview) return;
    setError("");
    setConnecting(true);
    try {
      const roundResponse = await fetch(`/api/interviews/${id}/round`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ round })
      });
      const roundData = (await roundResponse.json()) as { error?: string };
      if (!roundResponse.ok) throw new Error(roundData.error || "Unable to start round");

      const realtimeResponse = await fetch(`/api/interviews/${id}/realtime`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ round })
      });
      const realtimeData = (await realtimeResponse.json()) as { clientSecret?: string; model?: string; error?: string };
      if (!realtimeResponse.ok || !realtimeData.clientSecret || !realtimeData.model) {
        throw new Error(realtimeData.error || "Unable to create realtime session");
      }

      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      streamRef.current = stream;

      const pc = new RTCPeerConnection();
      pcRef.current = pc;
      stream.getTracks().forEach((track) => pc.addTrack(track, stream));
      pc.ontrack = (event) => {
        if (!audioRef.current) return;
        audioRef.current.srcObject = event.streams[0];
      };

      const channel = pc.createDataChannel("oai-events");
      channelRef.current = channel;
      channel.onmessage = (event) => {
        try {
          const payload = JSON.parse(String(event.data)) as {
            type?: string;
            transcript?: string;
            text?: string;
            item?: { content?: Array<{ transcript?: string; text?: string }> };
          };
          if (payload.type === "response.audio_transcript.done" && payload.transcript) {
            appendTranscript("assistant", payload.transcript);
          }
          if (payload.type === "conversation.item.input_audio_transcription.completed") {
            const text = payload.transcript || payload.text || payload.item?.content?.[0]?.transcript;
            if (text) appendTranscript("user", text);
          }
        } catch {
          // ignore malformed events
        }
      };
      channel.onopen = () => {
        channel.send(
          JSON.stringify({
            type: "response.create",
            response: {
              modalities: ["audio", "text"],
              instructions: `Start the ${round.toUpperCase()} round now. Ask one main question at a time.`
            }
          })
        );
      };

      const offer = await pc.createOffer();
      await pc.setLocalDescription(offer);

      const response = await fetch(`https://api.openai.com/v1/realtime?model=${encodeURIComponent(realtimeData.model)}`, {
        method: "POST",
        headers: {
          Authorization: ["Bearer", realtimeData.clientSecret].join(" "),
          "Content-Type": "application/sdp"
        },
        body: offer.sdp
      });
      const answerSdp = await response.text();
      if (!response.ok) throw new Error(answerSdp || "Realtime handshake failed");
      await pc.setRemoteDescription({ type: "answer", sdp: answerSdp });

      setConnected(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unexpected realtime error");
      stopSession();
    } finally {
      setConnecting(false);
    }
  }

  function stopSession() {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((track) => track.stop());
      streamRef.current = null;
    }
    channelRef.current?.close();
    channelRef.current = null;
    pcRef.current?.close();
    pcRef.current = null;
    setConnected(false);
  }

  function toggleMute() {
    const stream = streamRef.current;
    if (!stream) return;
    const next = !muted;
    stream.getAudioTracks().forEach((track) => {
      track.enabled = !next;
    });
    setMuted(next);
  }

  function interruptAssistant() {
    channelRef.current?.send(JSON.stringify({ type: "response.cancel" }));
  }

  async function scoreRound() {
    if (!transcript.length) {
      setError("No transcript captured for scoring yet.");
      return;
    }

    setScoring(true);
    setError("");
    try {
      const response = await fetch("/api/score", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ interviewId: id, round, transcript })
      });
      const data = (await response.json()) as { score?: { overall: number }; error?: string };
      if (!response.ok || !data.score) throw new Error(data.error || "Scoring failed");
      setScoreResult(data.score);
      await loadInterview();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unexpected scoring error");
    } finally {
      setScoring(false);
    }
  }

  function chooseRound(value: InterviewRound) {
    setRound(value);
    setTranscript([]);
    setScoreResult(null);
    const url = `/interview/${id}?round=${value}`;
    router.replace(url);
  }

  if (loading) return <main className="shell"><p className="muted">Loading interview room...</p></main>;
  if (!interview) return <main className="shell"><p className="error">Interview not found.</p></main>;

  const technicalDone = interview.scorecards?.some((entry) => entry.round === "technical");

  return (
    <main className="shell">
      <section className="panel interview">
        <div className="panel">
          <h1>{interview.role_title}</h1>
          <p className="muted">Round: {round.toUpperCase()} · Status: {interview.status}</p>
          <p className="muted">Realtime session is private. Audio is processed only for this coaching session.</p>

          <div className="actions">
            <button className="button ghost" onClick={() => chooseRound("technical")} disabled={round === "technical"}>
              Technical
            </button>
            <button className="button ghost" onClick={() => chooseRound("hr")} disabled={round === "hr" || !technicalDone}>
              HR/Behavioral
            </button>
            {!technicalDone && round === "hr" ? <span className="tag">Complete technical first</span> : null}
          </div>

          <div className="section">
            <div className="progress">
              <span style={{ width: `${Math.min(100, (askedQuestions / 8) * 100)}%` }} />
            </div>
            <p className="muted tiny">Question progress: {Math.min(8, askedQuestions)} / 8</p>
          </div>

          <div className="actions">
            <button className="button primary" onClick={startRoundSession} disabled={connecting || connected}>
              {connecting ? "Connecting..." : connected ? "Connected" : "Start live voice"}
            </button>
            <button className="button ghost" onClick={toggleMute} disabled={!connected}>
              {muted ? "Unmute" : "Mute"}
            </button>
            <button className="button ghost" onClick={interruptAssistant} disabled={!connected}>
              Interrupt AI
            </button>
            <button className="button danger" onClick={stopSession} disabled={!connected}>
              Stop session
            </button>
          </div>

          <audio autoPlay ref={audioRef} />

          <div className="actions section">
            <button className="button primary" onClick={scoreRound} disabled={scoring || connected}>
              {scoring ? "Scoring..." : `Score ${round.toUpperCase()} round`}
            </button>
            <Link className="button ghost" href={`/report/${id}`}>
              Open report
            </Link>
          </div>

          {scoreResult ? <p className="success">Saved score: {scoreResult.overall.toFixed(2)} / 5</p> : null}
          {error ? <p className="error">{error}</p> : null}
        </div>

        <div className="panel">
          <h2>Resume evidence focus</h2>
          <p className="muted">{interview.resume_analysis.summary}</p>
          <div className="section">
            <b>Matched skills</b>
            <div className="chips">{interview.resume_analysis.matchedSkills.map((skill) => <span className="chip" key={skill}>{skill}</span>)}</div>
          </div>
          <div className="section">
            <b>Evidence gaps</b>
            <div className="chips">{interview.resume_analysis.gaps.map((gap) => <span className="chip" key={gap}>{gap}</span>)}</div>
          </div>
          <div className="section">
            <b>Interview focus</b>
            <div className="chips">{interview.resume_analysis.interviewFocus.map((focus) => <span className="chip" key={focus}>{focus}</span>)}</div>
          </div>

          <h2 className="section">Live transcript</h2>
          <div className="transcript">
            {transcript.map((item) => (
              <div className="msg" key={item.id}>
                <b>{item.role === "assistant" ? "Interviewer" : "Candidate"}</b>
                <p>{item.text}</p>
              </div>
            ))}
            {!transcript.length ? <p className="muted">No transcript yet. Start the live voice round.</p> : null}
          </div>
        </div>
      </section>
    </main>
  );
}
