/**
 * Flag — Country flag emoji from golf country codes.
 * Maps IOC/golf codes to emoji flag sequences.
 * Falls back to a gray circle with the code text.
 *
 * Sizes: sm (16px inline), md (22px)
 */

const FLAG_MAP: Record<string, { flag: string; name: string }> = {
  USA: { flag: "🇺🇸", name: "United States" },
  ENG: { flag: "🏴󠁧󠁢󠁥󠁮󠁧󠁿", name: "England" },
  SCO: { flag: "🏴󠁧󠁢󠁳󠁣󠁴󠁿", name: "Scotland" },
  WAL: { flag: "🏴󠁧󠁢󠁷󠁬󠁳󠁿", name: "Wales" },
  NIR: { flag: "🏴󠁧󠁢󠁮󠁩󠁲󠁬󠁿", name: "Northern Ireland" },
  IRE: { flag: "🇮🇪", name: "Ireland" },
  ESP: { flag: "🇪🇸", name: "Spain" },
  AUS: { flag: "🇦🇺", name: "Australia" },
  RSA: { flag: "🇿🇦", name: "South Africa" },
  JPN: { flag: "🇯🇵", name: "Japan" },
  KOR: { flag: "🇰🇷", name: "South Korea" },
  CAN: { flag: "🇨🇦", name: "Canada" },
  ARG: { flag: "🇦🇷", name: "Argentina" },
  SWE: { flag: "🇸🇪", name: "Sweden" },
  NOR: { flag: "🇳🇴", name: "Norway" },
  FIN: { flag: "🇫🇮", name: "Finland" },
  DEN: { flag: "🇩🇰", name: "Denmark" },
  FRA: { flag: "🇫🇷", name: "France" },
  GER: { flag: "🇩🇪", name: "Germany" },
  ITA: { flag: "🇮🇹", name: "Italy" },
  NED: { flag: "🇳🇱", name: "Netherlands" },
  BEL: { flag: "🇧🇪", name: "Belgium" },
  AUT: { flag: "🇦🇹", name: "Austria" },
  SUI: { flag: "🇨🇭", name: "Switzerland" },
  CZE: { flag: "🇨🇿", name: "Czech Republic" },
  POL: { flag: "🇵🇱", name: "Poland" },
  THA: { flag: "🇹🇭", name: "Thailand" },
  INA: { flag: "🇮🇩", name: "Indonesia" },
  IDN: { flag: "🇮🇩", name: "Indonesia" },
  MAS: { flag: "🇲🇾", name: "Malaysia" },
  PHI: { flag: "🇵🇭", name: "Philippines" },
  CHN: { flag: "🇨🇳", name: "China" },
  TPE: { flag: "🇹🇼", name: "Chinese Taipei" },
  IND: { flag: "🇮🇳", name: "India" },
  NZL: { flag: "🇳🇿", name: "New Zealand" },
  ZIM: { flag: "🇿🇼", name: "Zimbabwe" },
  BRA: { flag: "🇧🇷", name: "Brazil" },
  MEX: { flag: "🇲🇽", name: "Mexico" },
  CHI: { flag: "🇨🇱", name: "Chile" },
  COL: { flag: "🇨🇴", name: "Colombia" },
  VEN: { flag: "🇻🇪", name: "Venezuela" },
  URU: { flag: "🇺🇾", name: "Uruguay" },
  POR: { flag: "🇵🇹", name: "Portugal" },
  GRE: { flag: "🇬🇷", name: "Greece" },
  TUR: { flag: "🇹🇷", name: "Turkey" },
  ISR: { flag: "🇮🇱", name: "Israel" },
  HKG: { flag: "🇭🇰", name: "Hong Kong" },
  SGP: { flag: "🇸🇬", name: "Singapore" },
  PAR: { flag: "🇵🇾", name: "Paraguay" },
  ECU: { flag: "🇪🇨", name: "Ecuador" },
  PER: { flag: "🇵🇪", name: "Peru" },
  BAN: { flag: "🇧🇩", name: "Bangladesh" },
  PAK: { flag: "🇵🇰", name: "Pakistan" },
  UAE: { flag: "🇦🇪", name: "United Arab Emirates" },
  KSA: { flag: "🇸🇦", name: "Saudi Arabia" },
  QAT: { flag: "🇶🇦", name: "Qatar" },
};

interface FlagProps {
  countryCode: string | null | undefined;
  size?: "sm" | "md";
  showName?: boolean;
}

export default function Flag({
  countryCode,
  size = "sm",
  showName = false,
}: FlagProps) {
  if (!countryCode) return null;

  const entry = FLAG_MAP[countryCode.toUpperCase()];
  const fontSize = size === "sm" ? "text-base" : "text-xl";
  const dim = size === "sm" ? 16 : 22;

  if (entry) {
    return (
      <span
        className={`inline-flex items-center gap-1 ${fontSize}`}
        title={entry.name}
      >
        <span>{entry.flag}</span>
        {showName && (
          <span className="text-xs text-zinc-500 dark:text-zinc-400">
            {entry.name}
          </span>
        )}
      </span>
    );
  }

  // Fallback: gray circle with code text
  return (
    <span
      className={`inline-flex items-center gap-1 ${fontSize}`}
      title={countryCode}
    >
      <span
        className="inline-flex items-center justify-center rounded-full bg-zinc-300 dark:bg-zinc-700 text-[9px] font-bold text-zinc-600 dark:text-zinc-300"
        style={{ width: dim, height: dim }}
      >
        {countryCode.slice(0, 3)}
      </span>
      {showName && (
        <span className="text-xs text-zinc-500 dark:text-zinc-400">
          {countryCode}
        </span>
      )}
    </span>
  );
}
