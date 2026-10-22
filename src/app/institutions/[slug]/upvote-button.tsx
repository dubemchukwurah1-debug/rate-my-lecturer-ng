"use client";

import { useState } from "react";

export default function UpvoteButton({ issueId, count }: { issueId: string; count: number }) {
  const [votes, setVotes] = useState(count);
  const [voted, setVoted] = useState(false);
  const [error, setError] = useState<string>();

  async function vote() {
    const res = await fetch(`/api/facilities/${issueId}/upvote`, { method: "POST" });
    const data = await res.json();
    if (!res.ok) return setError(data.error);
    if (data.counted) setVotes((v) => v + 1);
    setVoted(true);
  }

  return (
    <button
      onClick={vote}
      disabled={voted}
      title={error ?? "I'm affected too"}
      className="flex h-fit min-w-12 flex-col items-center rounded border px-2 py-1 text-sm disabled:opacity-60"
    >
      <span aria-hidden>▲</span>
      <span>{votes}</span>
      <span className="sr-only">I&apos;m affected too</span>
    </button>
  );
}
