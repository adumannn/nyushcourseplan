import { useEffect, useState } from "react";
import { X, Heart } from "lucide-react";
import { getCheckoutUrl } from "../../lib/payments/provider";
import { getPublicSupporters } from "../../lib/supporters";

const PRODUCT_URL = import.meta.env.VITE_GUMROAD_PRODUCT_URL || "";
const TIERS = [3, 5, 10]; // suggested amounts (USD); Gumroad is pay-what-you-want

export default function SupportersView({ user, onClose }) {
  const [wall, setWall] = useState([]);

  useEffect(() => {
    getPublicSupporters().then(setWall);
  }, []);

  const startCheckout = () => {
    if (!user) return; // CTA is disabled when signed out
    const url = getCheckoutUrl({ userId: user.id, productUrl: PRODUCT_URL });
    window.location.href = url;
  };

  return (
    <div className="fixed inset-0 z-40 overflow-y-auto bg-background">
      <div className="mx-auto max-w-2xl px-4 py-8">
        <div className="mb-6 flex items-center justify-between">
          <h1 className="flex items-center gap-2 text-xl font-semibold">
            <Heart size={20} className="text-amber-500" /> Support the Planner
          </h1>
          <button onClick={onClose} aria-label="Close" className="text-muted-foreground hover:text-foreground">
            <X size={20} />
          </button>
        </div>

        <p className="text-sm text-muted-foreground">
          This planner is free and always will be. If it saved you some time, you can chip in —
          purely optional, and supporters get a small badge.
        </p>

        {/* Engineered rail: Gumroad */}
        <div className="mt-6 rounded-lg border border-border bg-card p-4">
          {!user && (
            <p className="mb-3 text-sm text-muted-foreground">Sign in to support and get your badge.</p>
          )}
          <div className="flex flex-wrap gap-2">
            {TIERS.map((amount) => (
              <button
                key={amount}
                onClick={startCheckout}
                disabled={!user || !PRODUCT_URL}
                className="rounded-md border border-border px-4 py-2 text-sm hover:bg-accent disabled:opacity-50"
              >
                ☕ ${amount}
              </button>
            ))}
            <button
              onClick={startCheckout}
              disabled={!user || !PRODUCT_URL}
              className="rounded-md bg-primary px-4 py-2 text-sm text-primary-foreground disabled:opacity-50"
            >
              Choose amount
            </button>
          </div>
        </div>

        {/* China rail: Alipay / WeChat QR (manual badge grant) */}
        <div className="mt-4 rounded-lg border border-border bg-card p-4">
          <h2 className="text-sm font-medium">Paying from China?</h2>
          <p className="mt-1 text-xs text-muted-foreground">
            Scan to tip via WeChat or Alipay. Message me your account name and I'll add your
            Supporter badge.
          </p>
          <div className="mt-3 flex gap-4">
            <img src="/wechat-tip.png" alt="WeChat tip QR" className="h-40 w-40 rounded-md border border-border" />
            <img src="/alipay-tip.png" alt="Alipay tip QR" className="h-40 w-40 rounded-md border border-border" />
          </div>
        </div>

        {/* Wall */}
        <div className="mt-6">
          <h2 className="text-sm font-medium">Supporters</h2>
          {wall.length === 0 ? (
            <p className="mt-2 text-xs text-muted-foreground">Be the first to appear here.</p>
          ) : (
            <ul className="mt-2 flex flex-wrap gap-2">
              {wall.map((s, i) => (
                <li key={i} className="rounded-full border border-border bg-card px-3 py-1 text-xs">
                  {s.display_name}
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>
    </div>
  );
}
