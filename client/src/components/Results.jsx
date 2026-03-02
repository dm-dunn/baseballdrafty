// Results.jsx — Final draft order display

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

export default function Results({ draftOrder, isHost, lobbyCode, onRestart }) {
  function copyResults() {
    const text = draftOrder.map((p, i) =>
      `${i + 1}. ${p.name} — picks ${ordinal(i + 1)}`
    ).join('\n');
    navigator.clipboard.writeText(`🏟 Draft Order:\n${text}`);
  }

  return (
    <div className="fixed inset-0 bg-black/80 backdrop-blur-sm flex items-center justify-center z-50 p-4">
      <div className="bg-[#0d1117] border border-[#30363d] rounded-2xl w-full max-w-md shadow-2xl">
        {/* Header */}
        <div className="text-center py-6 border-b border-[#30363d]">
          <div className="text-4xl mb-2">🏟</div>
          <h2 className="font-display text-4xl tracking-widest text-[#f59e0b]">DRAFT ORDER</h2>
          <p className="text-[#7d8590] text-xs uppercase tracking-widest mt-1">Final Results</p>
        </div>

        {/* Rankings */}
        <div className="p-4 space-y-2 max-h-[60vh] overflow-y-auto">
          {draftOrder.map((p, i) => (
            <div
              key={p.id}
              className="flex items-center gap-4 bg-[#161b22] border border-[#30363d] rounded-xl px-4 py-3"
              style={{
                borderColor: i === 0 ? '#f59e0b44' : i === 1 ? '#94a3b844' : i === 2 ? '#cd7f3244' : '#30363d',
              }}
            >
              {/* Rank */}
              <div className="text-2xl w-8 text-center">
                {RANK_MEDALS[i] || (
                  <span className="font-mono text-sm text-[#7d8590]">#{i+1}</span>
                )}
              </div>

              {/* Color */}
              <div
                className="w-8 h-8 rounded-full border-2 border-black/30 shadow"
                style={{ backgroundColor: COLOR_CSS[p.color] }}
              />

              {/* Name */}
              <div className="flex-1 min-w-0">
                <p className="font-bold text-sm truncate">{p.name}</p>
                <p className="text-xs text-[#7d8590]">Picks {ordinal(i + 1)}</p>
              </div>

              {/* Time */}
              <span className="font-mono text-xs text-[#7d8590]">{msToSec(p.finishTime)}</span>
            </div>
          ))}
        </div>

        {/* Actions */}
        <div className="p-4 border-t border-[#30363d] flex gap-3">
          <button
            onClick={copyResults}
            className="flex-1 py-2.5 rounded-xl text-sm font-bold uppercase tracking-widest border border-[#30363d] text-[#7d8590] hover:border-white hover:text-white transition-all"
          >
            📋 Copy Results
          </button>

          {isHost && (
            <button
              onClick={onRestart}
              className="flex-1 py-2.5 rounded-xl text-sm font-bold uppercase tracking-widest bg-[#f59e0b] hover:bg-[#d97706] text-black transition-all glow-amber"
            >
              🔄 Restart Race
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

function ordinal(n) {
  const s = ['th','st','nd','rd'];
  const v = n % 100;
  return n + (s[(v - 20) % 10] || s[v] || s[0]);
}
