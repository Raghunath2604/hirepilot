"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

export function DeleteDataButton() {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");

  async function remove() {
    if (!window.confirm("Delete all interview data for this account? This cannot be undone.")) return;
    setBusy(true);
    setMessage("");
    try {
      const response = await fetch("/api/privacy/delete", { method: "POST" });
      const payload = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(payload.error || "Deletion failed.");
      setMessage("Interview data deleted.");
      router.refresh();
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Deletion failed.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="actions">
      <button className="button danger" type="button" disabled={busy} onClick={remove}>
        {busy ? "Deleting…" : "Delete my interview data"}
      </button>
      {message && <span className="muted tiny">{message}</span>}
    </div>
  );
}
