import { useState, useEffect, useRef } from 'react';
import './UpcomingGames.css';

const STORAGE_KEY = 'upcoming_games_cities';

// All known NHL + MLS city/location names for autocomplete
const ALL_CITIES = [
  'Anaheim', 'Atlanta', 'Austin', 'Boston', 'Buffalo', 'Calgary',
  'Carolina', 'Charlotte', 'Chicago', 'Cincinnati', 'Colorado', 'Columbus',
  'Dallas', 'D.C.', 'Detroit', 'Edmonton', 'Florida', 'Houston',
  'Kansas City', 'Los Angeles', 'Miami', 'Minnesota', 'Montreal',
  'Nashville', 'New England', 'New Jersey', 'New York', 'New York City',
  'Orlando', 'Ottawa', 'Philadelphia', 'Pittsburgh', 'Portland',
  'Salt Lake City', 'San Diego', 'San Jose', 'Seattle', 'St. Louis',
  'Tampa Bay', 'Toronto', 'Utah', 'Vancouver', 'Vegas', 'Washington', 'Winnipeg',
].sort();

interface Game {
  id: string;
  sport: 'NHL' | 'MLS';
  startUtc: string;          // ISO string
  homeTeam: string;          // e.g. "Stars"
  awayTeam: string;
  homeAbbr: string;
  awayAbbr: string;
  homeCity: string;          // e.g. "Dallas"
  awayCity: string;
  timeLabel: string;         // e.g. "7:00 PM ET"
}

// ---- NHL fetch (ESPN API — same origin as MLS, CORS-safe) ----

async function fetchNHL(): Promise<Game[]> {
  const today = new Date();
  const end = new Date(today);
  end.setDate(end.getDate() + 21);
  const startStr = fmtDateParam(today);
  const endStr = fmtDateParam(end);

  let data: any;
  try {
    const resp = await fetch(
      `https://site.api.espn.com/apis/site/v2/sports/hockey/nhl/scoreboard` +
      `?dates=${startStr}-${endStr}&limit=200`,
    );
    if (!resp.ok) return [];
    data = await resp.json();
  } catch { return []; }

  const games: Game[] = [];
  for (const event of data.events ?? []) {
    const comp = event.competitions?.[0];
    if (!comp) continue;
    const home = comp.competitors?.find((c: any) => c.homeAway === 'home');
    const away = comp.competitors?.find((c: any) => c.homeAway === 'away');
    if (!home || !away) continue;

    const startUtc: string = event.date ?? '';
    if (new Date(startUtc).getTime() < Date.now() - 86_400_000) continue;

    const detail: string = comp.status?.type?.shortDetail ?? comp.status?.type?.detail ?? '';

    games.push({
      id: event.id,
      sport: 'NHL',
      startUtc,
      homeTeam: home.team.shortDisplayName ?? home.team.name ?? '',
      awayTeam: away.team.shortDisplayName ?? away.team.name ?? '',
      homeAbbr: home.team.abbreviation ?? '',
      awayAbbr: away.team.abbreviation ?? '',
      homeCity: home.team.location ?? '',
      awayCity: away.team.location ?? '',
      timeLabel: detail || fmtTime(startUtc),
    });
  }

  return games;
}

// ---- MLS fetch (ESPN API) ----

async function fetchMLS(): Promise<Game[]> {
  const today = new Date();
  const end = new Date(today);
  end.setDate(end.getDate() + 21);
  const startStr = fmtDateParam(today);
  const endStr = fmtDateParam(end);

  let data: any;
  try {
    const resp = await fetch(
      `https://site.api.espn.com/apis/site/v2/sports/soccer/usa.1/scoreboard` +
      `?dates=${startStr}-${endStr}&limit=200`,
    );
    if (!resp.ok) return [];
    data = await resp.json();
  } catch { return []; }

  const games: Game[] = [];
  for (const event of data.events ?? []) {
    const comp = event.competitions?.[0];
    if (!comp) continue;
    const home = comp.competitors?.find((c: any) => c.homeAway === 'home');
    const away = comp.competitors?.find((c: any) => c.homeAway === 'away');
    if (!home || !away) continue;

    const startUtc: string = event.date ?? '';
    if (new Date(startUtc).getTime() < Date.now() - 86_400_000) continue;

    const detail: string = comp.status?.type?.shortDetail ?? comp.status?.type?.detail ?? '';

    games.push({
      id: event.id,
      sport: 'MLS',
      startUtc,
      homeTeam: home.team.shortDisplayName ?? home.team.name ?? '',
      awayTeam: away.team.shortDisplayName ?? away.team.name ?? '',
      homeAbbr: home.team.abbreviation ?? '',
      awayAbbr: away.team.abbreviation ?? '',
      homeCity: home.team.location ?? '',
      awayCity: away.team.location ?? '',
      timeLabel: detail || fmtTime(startUtc),
    });
  }

  return games;
}

// ---- Helpers ----

function fmtDateParam(d: Date): string {
  return `${d.getFullYear()}${String(d.getMonth() + 1).padStart(2, '0')}${String(d.getDate()).padStart(2, '0')}`;
}

function fmtTime(iso: string): string {
  try {
    return new Date(iso).toLocaleTimeString('en-US', {
      hour: 'numeric', minute: '2-digit', timeZoneName: 'short',
    });
  } catch { return ''; }
}

function dayLabel(iso: string): string {
  const d = new Date(iso);
  const today = new Date();
  const tomorrow = new Date(today);
  tomorrow.setDate(tomorrow.getDate() + 1);
  if (d.toDateString() === today.toDateString()) return 'Today';
  if (d.toDateString() === tomorrow.toDateString()) return 'Tomorrow';
  return d.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' });
}

function matchesCity(game: Game, cities: string[]): boolean {
  return cities.some(city =>
    game.homeCity.toLowerCase().includes(city.toLowerCase()),
  );
}

// ---- Component ----

export function UpcomingGames() {
  const [cities, setCities] = useState<string[]>(() => {
    try { return JSON.parse(localStorage.getItem(STORAGE_KEY) ?? '[]'); } catch { return []; }
  });
  const [games, setGames] = useState<Game[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);

  const [inputVal, setInputVal] = useState('');
  const [suggestions, setSuggestions] = useState<string[]>([]);
  const inputRef = useRef<HTMLInputElement>(null);

  // Fetch schedule once on mount
  useEffect(() => {
    setLoading(true);
    setError(false);
    Promise.all([fetchNHL(), fetchMLS()])
      .then(([nhl, mls]) => {
        const all = [...nhl, ...mls].sort(
          (a, b) => new Date(a.startUtc).getTime() - new Date(b.startUtc).getTime(),
        );
        setGames(all);
        setLoading(false);
      })
      .catch(() => { setError(true); setLoading(false); });
  }, []);

  // Persist city list
  useEffect(() => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(cities));
  }, [cities]);

  const handleInput = (val: string) => {
    setInputVal(val);
    if (!val.trim()) { setSuggestions([]); return; }
    const lower = val.toLowerCase();
    setSuggestions(
      ALL_CITIES.filter(c => c.toLowerCase().includes(lower) && !cities.includes(c)).slice(0, 6),
    );
  };

  const addCity = (city: string) => {
    const t = city.trim();
    if (!t || cities.includes(t)) return;
    setCities(prev => [...prev, t]);
    setInputVal('');
    setSuggestions([]);
    inputRef.current?.focus();
  };

  const removeCity = (city: string) => setCities(prev => prev.filter(c => c !== city));

  // Group filtered games by day
  const filtered = cities.length > 0 ? games.filter(g => matchesCity(g, cities)) : [];
  const grouped: { label: string; games: Game[] }[] = [];
  for (const g of filtered) {
    const lbl = dayLabel(g.startUtc);
    const existing = grouped.find(x => x.label === lbl);
    if (existing) existing.games.push(g);
    else grouped.push({ label: lbl, games: [g] });
  }

  return (
    <div className="upcoming-games">
      <h2 className="section-title">Upcoming Games</h2>

      {/* City selector */}
      <div className="ug-chips">
        {cities.map(city => (
          <span key={city} className="ug-chip">
            {city}
            <button className="ug-chip-remove" onClick={() => removeCity(city)}>×</button>
          </span>
        ))}
        <div className="ug-input-wrap">
          <input
            ref={inputRef}
            className="ug-input"
            placeholder="Add city…"
            value={inputVal}
            onChange={e => handleInput(e.target.value)}
            onKeyDown={e => {
              if (e.key === 'Enter' && inputVal.trim()) addCity(inputVal);
              if (e.key === 'Escape') { setInputVal(''); setSuggestions([]); }
            }}
            onBlur={() => setTimeout(() => setSuggestions([]), 150)}
          />
          {suggestions.length > 0 && (
            <div className="ug-suggestions">
              {suggestions.map(s => (
                <button key={s} className="ug-suggestion" onMouseDown={() => addCity(s)}>{s}</button>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Games list */}
      <div className="ug-list">
        {loading && <div className="ug-empty">Loading schedule…</div>}
        {!loading && error && <div className="ug-empty ug-error">Could not load schedule</div>}
        {!loading && !error && cities.length === 0 && (
          <div className="ug-empty">Add a city above to see upcoming games</div>
        )}
        {!loading && !error && cities.length > 0 && grouped.length === 0 && (
          <div className="ug-empty">No upcoming games found for selected cities</div>
        )}
        {!loading && !error && grouped.map(group => (
          <div key={group.label} className="ug-day">
            <div className="ug-day-label">{group.label}</div>
            {group.games.map(game => (
              <div key={game.id} className="ug-game">
                <span className={`ug-badge ug-badge-${game.sport.toLowerCase()}`}>{game.sport}</span>
                <span className="ug-matchup">
                  <span className="ug-team">{game.awayAbbr}</span>
                  <span className="ug-vs">@</span>
                  <span className="ug-team">{game.homeAbbr}</span>
                </span>
                <span className="ug-time">{game.timeLabel}</span>
              </div>
            ))}
          </div>
        ))}
      </div>
    </div>
  );
}
