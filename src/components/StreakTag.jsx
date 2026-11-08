// "W6" / "L4": a current streak of 3 or more decided picks.
export default function StreakTag({ tag }) {
  if (!tag) return null;
  const win = tag.startsWith('W');
  return (
    <span
      title={`${win ? 'Win' : 'Loss'} streak: ${tag.slice(1)} picks in a row`}
      className={`ml-1.5 align-middle text-[10px] font-bold px-1.5 py-0.5 rounded ${win ? 'bg-emerald-50 text-emerald-700' : 'bg-red-50 text-red-700'}`}
    >
      {tag}
    </span>
  );
}
