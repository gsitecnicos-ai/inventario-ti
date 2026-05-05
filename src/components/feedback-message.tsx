type FeedbackMessageProps = {
  success?: string;
  error?: string;
};

export function FeedbackMessage({ success, error }: FeedbackMessageProps) {
  const message = error || success;

  if (!message) {
    return null;
  }

  return (
    <div
      className={`rounded-lg border px-5 py-4 text-sm ${
        error
          ? "border-rose-200 bg-rose-50 text-rose-800"
          : "border-emerald-200 bg-emerald-50 text-emerald-800"
      }`}
      role="status"
    >
      {message}
    </div>
  );
}
