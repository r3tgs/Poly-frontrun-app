import { useState, useEffect, useRef } from 'react';
import hockeyIcon from './assets/PM Sport Hockey.svg';
import soccerIcon from './assets/PM Sport Soccer.svg';
import basketballIcon from './assets/PM Sport Basketball.svg';
import searchIcon from './assets/PM Search Icon.svg';
import closeIcon from './assets/PM Close Icon.svg';
import './V2UpcomingGames.css';

const SPORT_ICONS: Record<string, string> = {
  NHL: hockeyIcon,
  MLS: soccerIcon,
  NBA: basketballIcon,
};

const STORAGE_KEY = 'upcoming_games_cities';

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
  sport: 'NHL' | 'MLS' | 'NBA';
  startUtc: string;
  homeTeam: string;
  awayTeam: string;
  homeAbbr: string;
  awayAbbr: string;
  homeCity: string;
  awayCity: string;
  timeLabel: string;
}

async function fetchESPN(sportPath: string, sport: 'NHL' | 'MLS' | 'NBA'): Promise<Game[]> {
  const today = new Date();
  const end = new Date(today); end.setDate(end.getDate() + 21);
  const fmt = (d: Date) => `${d.getFullYear()}${String(d.getMonth() + 1).padStart(2, '0')}${String(d.getDate()).padStart(2, '0')}`;
  try {
    const resp = await fetch(`https://site.api.espn.com/apis/site/v2/sports/${sportPath}/scoreboard?dates=${fmt(today)}-${fmt(end)}&limit=200`);
    if (!resp.ok) return [];
    const data = await resp.json();
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
        sport,
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
  } catch { return []; }
}

function fmtTime(iso: string): string {
  try {
    return new Date(iso).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', timeZoneName: 'short' });
  } catch { return ''; }
}

function dayLabel(iso: string): { prefix: string; date: string } {
  const d = new Date(iso);
  const today = new Date();
  const tomorrow = new Date(today); tomorrow.setDate(tomorrow.getDate() + 1);
  const datePart = d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' }).toUpperCase();
  if (d.toDateString() === today.toDateString()) return { prefix: 'TODAY,', date: datePart };
  if (d.toDateString() === tomorrow.toDateString()) return { prefix: 'TOMORROW,', date: datePart };
  const weekday = d.toLocaleDateString('en-US', { weekday: 'long' }).toUpperCase();
  return { prefix: weekday + ',', date: datePart };
}

function matchesCity(game: Game, cities: string[]): boolean {
  return cities.some(city => game.homeCity.toLowerCase().includes(city.toLowerCase()));
}

export function V2UpcomingGames() {
  const [cities, setCities] = useState<string[]>(() => {
    try { return JSON.parse(localStorage.getItem(STORAGE_KEY) ?? '[]'); } catch { return []; }
  });
  const [games, setGames] = useState<Game[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const [inputVal, setInputVal] = useState('');
  const [suggestions, setSuggestions] = useState<string[]>([]);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    setLoading(true); setError(false);
    Promise.all([
      fetchESPN('hockey/nhl', 'NHL'),
      fetchESPN('soccer/usa.1', 'MLS'),
      fetchESPN('basketball/nba', 'NBA'),
    ]).then(([nhl, mls, nba]) => {
      const all = [...nhl, ...mls, ...nba].sort((a, b) => new Date(a.startUtc).getTime() - new Date(b.startUtc).getTime());
      setGames(all);
      setLoading(false);
    }).catch(() => { setError(true); setLoading(false); });
  }, []);

  useEffect(() => { localStorage.setItem(STORAGE_KEY, JSON.stringify(cities)); }, [cities]);

  const handleInput = (val: string) => {
    setInputVal(val);
    if (!val.trim()) { setSuggestions([]); return; }
    const lower = val.toLowerCase();
    setSuggestions(ALL_CITIES.filter(c => c.toLowerCase().includes(lower) && !cities.includes(c)).slice(0, 6));
  };

  const addCity = (city: string) => {
    const t = city.trim();
    if (!t || cities.includes(t)) return;
    setCities(prev => [...prev, t]);
    setInputVal(''); setSuggestions([]);
    inputRef.current?.focus();
  };

  const removeCity = (city: string) => setCities(prev => prev.filter(c => c !== city));

  const filtered = cities.length > 0 ? games.filter(g => matchesCity(g, cities)) : [];
  const grouped: { prefix: string; date: string; games: Game[] }[] = [];
  for (const g of filtered) {
    const lbl = dayLabel(g.startUtc);
    const existing = grouped.find(x => x.prefix === lbl.prefix && x.date === lbl.date);
    if (existing) existing.games.push(g);
    else grouped.push({ prefix: lbl.prefix, date: lbl.date, games: [g] });
  }

  return (
    <div className="v2-ug">
      <h2 className="v2-section-label">UPCOMING GAMES</h2>
      <div className="v2-ug-search">
        <img src={searchIcon} alt="" className="v2-ug-search-icon" />
        <div className="v2-ug-input-wrap">
          <input
            ref={inputRef}
            className="v2-ug-input"
            placeholder="Add city..."
            value={inputVal}
            onChange={e => handleInput(e.target.value)}
            onKeyDown={e => {
              if (e.key === 'Enter' && inputVal.trim()) addCity(inputVal);
              if (e.key === 'Escape') { setInputVal(''); setSuggestions([]); }
            }}
            onBlur={() => setTimeout(() => setSuggestions([]), 150)}
          />
          {suggestions.length > 0 && (
            <div className="v2-ug-suggest">
              {suggestions.map(s => (
                <button key={s} className="v2-ug-suggest-item" onMouseDown={() => addCity(s)}>{s}</button>
              ))}
            </div>
          )}
        </div>
        {cities.map(city => (
          <span key={city} className="v2-ug-chip">
            {city}
            <button className="v2-ug-chip-x" onClick={() => removeCity(city)}>
              <img src={closeIcon} alt="" className="v2-ug-chip-x-icon" />
            </button>
          </span>
        ))}
      </div>
      <div className="v2-ug-list">
        {loading && <div className="v2-ug-empty">Loading schedule...</div>}
        {!loading && error && <div className="v2-ug-empty v2-ug-error">Could not load schedule</div>}
        {!loading && !error && cities.length === 0 && <div className="v2-ug-empty">Add a city above to see upcoming games</div>}
        {!loading && !error && cities.length > 0 && grouped.length === 0 && <div className="v2-ug-empty">No upcoming games found for selected cities</div>}
        {!loading && !error && grouped.map(group => (
          <div key={group.prefix + group.date} className="v2-ug-day">
            <div className="v2-ug-day-label"><span className="v2-ug-day-prefix">{group.prefix}</span> <span className="v2-ug-day-date">{group.date}</span></div>
            {group.games.map(game => (
              <div key={game.id} className="v2-ug-game">
                <div className="v2-ug-game-top">
                  <img src={SPORT_ICONS[game.sport]} alt={game.sport} className="v2-ug-sport-icon" />
                  <span className={`v2-ug-league-badge v2-ug-league-${game.sport.toLowerCase()}`}>{game.sport}</span>
                  <span className="v2-ug-time">{game.timeLabel}</span>
                </div>
                <div className="v2-ug-game-bottom">
                  <span className="v2-ug-team">{game.awayCity} {game.awayTeam}</span>
                  <span className="v2-ug-vs">@</span>
                  <span className="v2-ug-team">{game.homeCity} {game.homeTeam}</span>
                </div>
              </div>
            ))}
          </div>
        ))}
      </div>
    </div>
  );
}
