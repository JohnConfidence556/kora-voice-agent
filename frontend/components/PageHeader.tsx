"use client";

import { ReactNode, useEffect } from "react";
import { BRAND } from "@/lib/brand";

export default function PageHeader({
  title, subtitle, children,
}: { title: string; subtitle?: string; children?: ReactNode }) {
  useEffect(() => {
    document.title = `${title} | ${BRAND.name}`;
  }, [title]);

  return (
    <header className="pageHead">
      <div>
        <h1 className="pageHead__title">{title}</h1>
        {subtitle && <p className="pageHead__sub">{subtitle}</p>}
      </div>
      {children && <div className="pageHead__actions">{children}</div>}
    </header>
  );
}
