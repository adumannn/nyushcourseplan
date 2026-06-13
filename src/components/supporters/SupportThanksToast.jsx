import { useState } from "react";
import { X } from "lucide-react";

/**
 * Post-purchase thank-you. Lets a confirmed supporter set a wall display name
 * and opt in. `isSupporter` becomes true once the webhook lands (parent polls).
 */
export default function SupportThanksToast({ isSupporter, onSaveWallProfile, onClose }) {
  const [name, setName] = useState("");
  const [isPublic, setIsPublic] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  const save = async () => {
    setSaving(true);
    try {
      await onSaveWallProfile({ displayName: name, isPublic });
      setSaved(true);
    } catch {
      /* surfaced via parent refetch; keep the toast forgiving */
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed bottom-4 right-4 z-50 w-80 rounded-lg border border-border bg-card p-4 shadow-lg">
      <button
        onClick={onClose}
        className="absolute right-2 top-2 text-muted-foreground hover:text-foreground"
        aria-label="Close"
      >
        <X size={16} />
      </button>
      <p className="text-sm font-medium">Thank you for supporting! 💛</p>
      {!isSupporter && (
        <p className="mt-1 text-xs text-muted-foreground">
          Confirming your payment… your badge will appear shortly.
        </p>
      )}
      {isSupporter && !saved && (
        <div className="mt-3 space-y-2">
          <label className="block text-xs text-muted-foreground">
            Show on the Supporters wall as (optional):
          </label>
          <input
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Your name"
            className="w-full rounded-md border border-border bg-background px-2 py-1 text-sm"
          />
          <label className="flex items-center gap-2 text-xs text-muted-foreground">
            <input
              type="checkbox"
              checked={isPublic}
              onChange={(e) => setIsPublic(e.target.checked)}
            />
            List me publicly
          </label>
          <button
            onClick={save}
            disabled={saving}
            className="w-full rounded-md bg-primary px-2 py-1 text-sm text-primary-foreground disabled:opacity-50"
          >
            {saving ? "Saving…" : "Save"}
          </button>
        </div>
      )}
      {saved && <p className="mt-2 text-xs text-muted-foreground">Saved — see you on the wall!</p>}
    </div>
  );
}
