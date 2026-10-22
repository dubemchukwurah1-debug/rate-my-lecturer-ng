export function StarDisplay({ value, label }: { value: number; label?: string }) {
  const full = Math.round(value);
  return (
    <span aria-label={`${label ? `${label}: ` : ""}${value} out of 5`} className="whitespace-nowrap text-amber-500">
      {"★".repeat(full)}
      <span className="text-neutral-300 dark:text-neutral-700">{"★".repeat(5 - full)}</span>
    </span>
  );
}

export function StarInput({
  name,
  label,
  value,
  onChange,
  required,
}: {
  name: string;
  label: string;
  value: number | undefined;
  onChange: (v: number) => void;
  required?: boolean;
}) {
  return (
    <fieldset className="flex items-center justify-between gap-3">
      <legend className="sr-only">{label}</legend>
      <span className="text-sm">
        {label}
        {required && " *"}
      </span>
      <span className="flex">
        {[1, 2, 3, 4, 5].map((n) => (
          <label key={n} className="cursor-pointer px-0.5 text-2xl leading-none">
            <input type="radio" name={name} value={n} checked={value === n} onChange={() => onChange(n)} className="sr-only" />
            <span className={value && n <= value ? "text-amber-500" : "text-neutral-300 dark:text-neutral-700"}>★</span>
            <span className="sr-only">{n} stars</span>
          </label>
        ))}
      </span>
    </fieldset>
  );
}
