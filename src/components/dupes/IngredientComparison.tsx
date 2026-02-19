'use client'

interface IngredientComparisonProps {
  originalName: string
  dupeName: string
  shared: string[]
  uniqueToOriginal: string[]
  uniqueToDupe: string[]
}

export default function IngredientComparison({
  originalName,
  dupeName,
  shared,
  uniqueToOriginal,
  uniqueToDupe,
}: IngredientComparisonProps) {
  return (
    <div className="space-y-3 pt-3">
      {/* Shared ingredients */}
      {shared.length > 0 && (
        <div>
          <h4 className="text-[10px] font-semibold text-emerald-400 uppercase tracking-wider mb-1.5">
            Shared Ingredients ({shared.length})
          </h4>
          <div className="flex flex-wrap gap-1">
            {shared.map(name => (
              <span
                key={name}
                className="px-2 py-0.5 rounded-full text-[10px] bg-emerald-500/10 text-emerald-300/80"
              >
                {name}
              </span>
            ))}
          </div>
        </div>
      )}

      {/* Side-by-side unique ingredients */}
      <div className="grid grid-cols-2 gap-2">
        {/* Only in original */}
        <div>
          <h4 className="text-[10px] font-semibold text-rose-400 uppercase tracking-wider mb-1.5">
            Only in {truncate(originalName, 20)}
          </h4>
          {uniqueToOriginal.length > 0 ? (
            <div className="flex flex-wrap gap-1">
              {uniqueToOriginal.map(name => (
                <span
                  key={name}
                  className="px-2 py-0.5 rounded-full text-[10px] bg-rose-500/10 text-rose-300/70"
                >
                  {name}
                </span>
              ))}
            </div>
          ) : (
            <p className="text-[10px] text-white/20 italic">None</p>
          )}
        </div>

        {/* Only in dupe */}
        <div>
          <h4 className="text-[10px] font-semibold text-blue-400 uppercase tracking-wider mb-1.5">
            Only in {truncate(dupeName, 20)}
          </h4>
          {uniqueToDupe.length > 0 ? (
            <div className="flex flex-wrap gap-1">
              {uniqueToDupe.map(name => (
                <span
                  key={name}
                  className="px-2 py-0.5 rounded-full text-[10px] bg-blue-500/10 text-blue-300/70"
                >
                  {name}
                </span>
              ))}
            </div>
          ) : (
            <p className="text-[10px] text-white/20 italic">None</p>
          )}
        </div>
      </div>
    </div>
  )
}

function truncate(str: string, max: number): string {
  return str.length > max ? str.slice(0, max) + '...' : str
}
