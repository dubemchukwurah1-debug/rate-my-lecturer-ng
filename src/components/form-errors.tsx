export default function FormErrors({ messages }: { messages: string[] }) {
  if (messages.length === 0) return null;
  return (
    <ul role="alert" className="rounded-lg border border-red-300 bg-red-50 p-3 text-sm text-red-800 dark:border-red-800 dark:bg-red-950 dark:text-red-200">
      {messages.map((m) => (
        <li key={m}>{m}</li>
      ))}
    </ul>
  );
}
