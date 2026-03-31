export default function Home() {
  return (
    <div className="mx-auto w-full max-w-3xl p-6">
      <h1 className="text-2xl font-semibold">AI CFO</h1>
      <p className="mt-2 text-sm text-zinc-600">
        Use the <a className="underline" href="/dashboard">Dashboard</a> and{" "}
        <a className="underline" href="/ai">AI CFO Chat</a>.
      </p>
    </div>
  );
}
