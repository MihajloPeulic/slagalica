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
        <div className="rounded-xl border border-red-500/20 bg-red-500/10 px-3 py-2.5 text-xs font-bold text-red-400">
          {error}
        </div>
      )}

      {success && (
        <div className="rounded-xl border border-emerald-500/20 bg-emerald-500/10 px-3 py-2.5 text-xs font-bold text-emerald-400">
          {success}
        </div>
      )}
    </div>
  );
}