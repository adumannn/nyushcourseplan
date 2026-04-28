const DEFAULT_FEEDBACK_ADMIN_EMAILS = ["da3762@nyu.edu"];

function readCsv(value) {
  return String(value || "")
    .split(",")
    .map((item) => item.trim())
    .filter(Boolean);
}

export function getFeedbackAdminEmails() {
  return [
    ...DEFAULT_FEEDBACK_ADMIN_EMAILS,
    ...readCsv(import.meta.env.VITE_FEEDBACK_ADMIN_EMAILS),
  ].map((email) => email.toLowerCase());
}

export function getFeedbackAdminIds() {
  return readCsv(import.meta.env.VITE_FEEDBACK_ADMIN_IDS);
}

export function isFeedbackAdmin(user) {
  if (!user) return false;

  const adminIds = getFeedbackAdminIds();
  if (adminIds.includes(user.id)) return true;

  const email = user.email?.toLowerCase();
  return Boolean(email && getFeedbackAdminEmails().includes(email));
}
