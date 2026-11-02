"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { getToken } from "@/lib/api";

// Landing page buttons: "Sign in / Sign up" for visitors, "Open dashboard" if already signed in.
export default function NavActions() {
  const [signedIn, setSignedIn] = useState(false);
  useEffect(() => {
    setSignedIn(Boolean(getToken()));
  }, []);

  if (signedIn) {
    return <Link className="btn btn--primary" href="/dashboard">Open dashboard</Link>;
  }
  return (
    <>
      <Link className="btn btn--ghost" href="/login">Sign in</Link>
      <Link className="btn btn--primary" href="/signup">Sign up</Link>
    </>
  );
}
