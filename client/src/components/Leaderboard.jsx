// Leaderboard.jsx — Live finish positions during the race

const COLOR_CSS = {
  Red:'#ef4444',Blue:'#3b82f6',Green:'#22c55e',Yellow:'#eab308',
  Orange:'#f97316',Purple:'#a855f7',Pink:'#ec4899',Teal:'#14b8a6',
  Cyan:'#06b6d4',Lime:'#84cc16',Maroon:'#9b2226',Navy:'#1e40af',
  Gold:'#d97706',Black:'#4b5563',
};

const RANK_MEDALS = ['🥇','🥈','🥉'];

function msToSec(ms) {
  return (ms / 1000).toFixed(2) + 's';
}

export default function Leaderboard({ finishedPlayers, totalPlayers }) {
  if (finishedPlayers.length === 0) return null;

  return (
    <div className="bg-[#161b22] border border-[#30363d] rounded-xl overflow-hidden">
      <div className="px-4 py-2 border-b border-[#30363d]">
        <span className="text-xs uppercase tracking-widest text-[#7d8590]">
          Finished — {finishedPlayers.length}/{totalPlayers}
        </span>
      </div>
      {finishedPlayers.map((p) => (
        <div
          key={p.id}
          className="flex items-center gap-3 px-4 py-2.5 border-b border-[#30363d] last:border-0"
        >
          <span className="text-lg w-6 text-center">
            {RANK_MEDALS[p.rank - 1] || `#${p.rank}`}
          </span>
          <div
            className="w-5 h-5 rounded-full flex-shrink-0"
            style={{ backgroundColor: COLOR_CSS[p.color] }}
          />
          <span className="text-sm font-semibold flex-1 truncate">{p.name}</span>
          <span className="text-xs font-mono text-[#7d8590]">{msToSec(p.finishTime)}</span>
        </div>
      ))}
    </div>
  );
}
