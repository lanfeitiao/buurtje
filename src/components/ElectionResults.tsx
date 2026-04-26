import { PostcodeData } from "@/lib/types";

interface ElectionResultsProps {
  data: PostcodeData;
}

const BAR_COLORS: Record<string, string> = {
  "GROENLINKS / Partij van de Arbeid (PvdA)": "#6B9E1F",
  "D66": "#00A651",
  "VVD": "#FF6D00",
  "PVV (Partij voor de Vrijheid)": "#002B5C",
  "CDA": "#007B5F",
  "SP (Socialistische Partij)": "#EE2E22",
  "Partij voor de Dieren": "#006B2D",
  "BIJ1": "#FFFF00",
  "Volt": "#502379",
  "BBB": "#95C11F",
  "JA21": "#1B3A5C",
  "FvD": "#8B1A1A",
  "CU": "#00AEEF",
  "DENK": "#00A7A0",
  "SGP": "#F36F21",
  "50PLUS": "#93117E",
  "NSC": "#003366",
};

function getColor(party: string): string {
  return BAR_COLORS[party] || "#9CA3AF";
}

function shortName(party: string): string {
  const map: Record<string, string> = {
    "GROENLINKS / Partij van de Arbeid (PvdA)": "GL-PvdA",
    "PVV (Partij voor de Vrijheid)": "PVV",
    "SP (Socialistische Partij)": "SP",
    "Partij voor de Dieren": "PvdD",
    "Belang Van Nederland (BVNL)": "BVNL",
    "Libertaire Partij (LP)": "LP",
  };
  return map[party] || party;
}

function captionFor(
  source: { kind: "area" } | { kind: "postcode"; code: string },
  dataCode: string
): string {
  if (source.kind === "area") {
    return "Aggregated from polling stations in this area";
  }
  const isAreaSearch = dataCode.startsWith("buurt:") || dataCode.startsWith("wijk:");
  const areaType = dataCode.startsWith("wijk:") ? "wijk" : "buurt";
  if (isAreaSearch) {
    return `No polling stations in this ${areaType} — showing data from postcode ${source.code}`;
  }
  return `Aggregated from polling stations in postcode ${source.code}`;
}

export default function ElectionResults({ data }: ElectionResultsProps) {
  if (!data.election) return null;

  const { parties, totalVotes, year, source } = data.election;
  const topParties = parties.slice(0, 8);
  const maxPct = topParties[0]?.percentage || 1;

  return (
    <div className="bg-white rounded-xl p-5 border border-gray-100">
      <h3 className="text-sm font-semibold text-gray-800 mb-1">
        Tweede Kamer {year}{" "}
        <span className="text-gray-400 font-normal">
          ({totalVotes.toLocaleString("nl-NL")} stemmen)
        </span>
      </h3>
      <p className="text-[11px] text-gray-400 mb-4">
        {captionFor(source, data.code)}
      </p>
      <div className="space-y-2">
        {topParties.map((party) => (
          <div key={party.name} className="flex items-center gap-3">
            <span className="text-xs text-gray-600 min-w-[70px] text-right truncate">
              {shortName(party.name)}
            </span>
            <div className="flex-1 bg-gray-100 rounded h-5 overflow-hidden">
              <div
                className="h-full rounded flex items-center pl-2"
                style={{
                  width: `${(party.percentage / maxPct) * 100}%`,
                  backgroundColor: getColor(party.name),
                  minWidth: "2rem",
                }}
              >
                <span className="text-[10px] font-semibold text-white drop-shadow-sm">
                  {party.percentage}%
                </span>
              </div>
            </div>
            <span className="text-[11px] text-gray-400 min-w-[50px]">
              {party.votes.toLocaleString("nl-NL")}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}
