import { CirclePlus, Gift, Wifi } from "lucide-react";
import type { Transaction } from "@/lib/api";
import { formatData, formatStamp, parseDbTime, signedNaira } from "@/lib/format";

const KINDS: Record<string, { icon: typeof Wifi; tone: string }> = {
  data_purchase: { icon: Wifi, tone: "data" },
  airtime_purchase: { icon: CirclePlus, tone: "airtime" },
  credit: { icon: Gift, tone: "credit" },
};

export default function ActivityRow({ tx }: { tx: Transaction }) {
  const meta = KINDS[tx.kind] ?? KINDS.credit;
  const Icon = meta.icon;
  return (
    <li className="act">
      <span className={`act__icon act__icon--${meta.tone}`}><Icon size={18} /></span>
      <span className="act__main">
        <span className="act__title">{tx.description}</span>
        <span className="act__time">{formatStamp(parseDbTime(tx.created_at))}</span>
      </span>
      <span className="act__amt">
        <span className={tx.amount_naira < 0 ? "act__neg" : "act__pos"}>{signedNaira(tx.amount_naira)}</span>
        {tx.data_mb > 0 && <span className="act__data">+{formatData(tx.data_mb)}</span>}
      </span>
    </li>
  );
}
