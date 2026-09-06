
import { Button } from "./Button";

export function FormActions({
  onCancel,
  loading,
  submitLabel = "Sačuvaj promjene",
}: {
  onCancel: () => void;
  loading?: boolean;
  submitLabel?: string;
}) {
  return (
    <div className="mt-5 flex gap-2">
      <Button
        type="button"
        variant="secondary"
        fullWidth
        onClick={onCancel}
      >
        Odustani
      </Button>

      <Button
        type="submit"
        fullWidth
        disabled={loading}
      >
        {loading
          ? "Čuvanje..."
          : submitLabel}
      </Button>
    </div>
  );
}