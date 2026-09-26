// Small white spinner shown inside buttons while an action is in progress.
export default function Spinner() {
  return <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin inline-block" aria-hidden />;
}
