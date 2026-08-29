export function formatPlanSyncError(error) {
  const parts = [error?.message || "Unknown cloud save error"];
  if (error?.code) parts.push(`Code: ${error.code}`);
  if (error?.details) parts.push(`Details: ${error.details}`);
  if (error?.hint) parts.push(`Hint: ${error.hint}`);
  return parts.join(" · ");
}
