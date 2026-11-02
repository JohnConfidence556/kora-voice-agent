import type { CSSProperties } from "react";
import { Mic, PhoneOff } from "lucide-react";
import { LogoMark } from "@/components/Logo";
import { BRAND } from "@/lib/brand";

// A static picture of the call experience, built from markup. No images needed.
export default function HeroPreview() {
  return (
    <div className="preview" aria-hidden="true">
      <div className="preview__phone">
        <div className="preview__screen">
          <div className="preview__top">
            <span>Voice call</span>
            <span className="preview__time">00:42</span>
          </div>

          <div className="preview__avatar">
            <LogoMark size={34} />
          </div>
          <p className="preview__name">{BRAND.assistantName}</p>
          <p className="preview__state">Speaking</p>

          <div className="preview__wave">
            {Array.from({ length: 19 }, (_, i) => (
              <span key={i} style={{ "--i": i } as CSSProperties} />
            ))}
          </div>

          <div className="preview__talk">
            <p className="preview__bubble preview__bubble--you">How much is the 1GB weekly plan?</p>
            <p className="preview__bubble preview__bubble--agent">
              It&apos;s 800 naira and lasts 7 days. Want me to prepare it for you to confirm?
            </p>
          </div>

          <div className="preview__ctls">
            <span className="preview__ctl"><Mic size={22} /></span>
            <span className="preview__ctl preview__ctl--end"><PhoneOff size={22} /></span>
          </div>
        </div>
      </div>

      <div className="preview__sim">
        <span className="preview__simName">Kora SIM</span>
        <span className="preview__simRow"><b className="num">₦1,850</b><small>airtime</small></span>
        <span className="preview__simRow"><b className="num">2.46 GB</b><small>data</small></span>
      </div>
    </div>
  );
}
