type FormMessageProps = {
  error?: string;
  success?: string;
};

export function FormMessage({
  error,
  success,
}: FormMessageProps) {
  if (!error && !success) {
    return null;
  }

  return (
    <div className="mb-4 space-y-2">
      {error && (
        <div className="rounded-xl border border-red-player/20 bg-red-player/10 px-3 py-2.5 text-xs font-bold text-red-player">
          {error}
        </div>
      )}

      {success && (
        <div className="rounded-xl border border-success/20 bg-success/10 px-3 py-2.5 text-xs font-bold text-success">
          {success}
        </div>
      )}
    </div>
  );
}