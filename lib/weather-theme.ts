// Weather code → emoji/label + day/night gradient mapping.
// Codes follow the WMO scheme used by Open-Meteo.

export type WeatherTheme = {
  container: string;
  textPrimary: string;
  textSecondary: string;
  bottomBar: string;
};

const weatherThemes = {
  clearDay: {
    container: 'bg-gradient-to-br from-sky-300 via-blue-400 to-blue-500',
    textPrimary: 'text-white',
    textSecondary: 'text-white/80',
    bottomBar: 'bg-black/10',
  },
  clearNight: {
    container: 'bg-gradient-to-br from-indigo-950 via-slate-900 to-black',
    textPrimary: 'text-white',
    textSecondary: 'text-white/70',
    bottomBar: 'bg-white/10',
  },
  cloudyDay: {
    container: 'bg-gradient-to-br from-slate-400 via-slate-500 to-slate-600',
    textPrimary: 'text-white',
    textSecondary: 'text-white/80',
    bottomBar: 'bg-black/15',
  },
  cloudyNight: {
    container: 'bg-gradient-to-br from-slate-800 via-slate-900 to-black',
    textPrimary: 'text-white',
    textSecondary: 'text-white/70',
    bottomBar: 'bg-white/10',
  },
  rainDay: {
    container: 'bg-gradient-to-br from-slate-500 via-blue-600 to-slate-700',
    textPrimary: 'text-white',
    textSecondary: 'text-white/80',
    bottomBar: 'bg-black/20',
  },
  rainNight: {
    container: 'bg-gradient-to-br from-slate-800 via-slate-900 to-blue-950',
    textPrimary: 'text-white',
    textSecondary: 'text-white/70',
    bottomBar: 'bg-white/10',
  },
  snowDay: {
    container: 'bg-gradient-to-br from-sky-100 via-slate-200 to-slate-300',
    textPrimary: 'text-slate-800',
    textSecondary: 'text-slate-600',
    bottomBar: 'bg-white/40',
  },
  snowNight: {
    container: 'bg-gradient-to-br from-slate-800 via-indigo-950 to-slate-900',
    textPrimary: 'text-white',
    textSecondary: 'text-white/70',
    bottomBar: 'bg-white/10',
  },
} satisfies Record<string, WeatherTheme>;

export function getWeatherInfo(
  code: number,
  isNight: boolean = false,
): { emoji: string; label: string; theme: WeatherTheme } {
  let category: 'clear' | 'cloudy' | 'rain' | 'snow' = 'clear';
  if ([0, 1].includes(code)) category = 'clear';
  else if ([2, 3, 45, 48].includes(code)) category = 'cloudy';
  else if ([51, 53, 55, 61, 63, 65, 80, 81, 82, 95, 96, 99].includes(code)) category = 'rain';
  else if ([71, 73, 75, 77, 85, 86].includes(code)) category = 'snow';

  const themeKey = `${category}${isNight ? 'Night' : 'Day'}` as keyof typeof weatherThemes;
  const theme = weatherThemes[themeKey];

  const map: Record<number, { day: string; night: string; label: string }> = {
    0: { day: '☀️', night: '🌙', label: 'Clear sky' },
    1: { day: '🌤️', night: '🌙', label: 'Mainly clear' },
    2: { day: '⛅', night: '☁️', label: 'Partly cloudy' },
    3: { day: '☁️', night: '☁️', label: 'Overcast' },
    45: { day: '🌫️', night: '🌫️', label: 'Fog' },
    48: { day: '🌫️', night: '🌫️', label: 'Rime fog' },
    51: { day: '🌦️', night: '🌧️', label: 'Light drizzle' },
    53: { day: '🌦️', night: '🌧️', label: 'Drizzle' },
    55: { day: '🌧️', night: '🌧️', label: 'Heavy drizzle' },
    61: { day: '🌧️', night: '🌧️', label: 'Light rain' },
    63: { day: '🌧️', night: '🌧️', label: 'Rain' },
    65: { day: '🌧️', night: '🌧️', label: 'Heavy rain' },
    71: { day: '🌨️', night: '🌨️', label: 'Light snow' },
    73: { day: '🌨️', night: '🌨️', label: 'Snow' },
    75: { day: '❄️', night: '❄️', label: 'Heavy snow' },
    77: { day: '🌨️', night: '🌨️', label: 'Snow grains' },
    80: { day: '🌦️', night: '🌧️', label: 'Rain showers' },
    81: { day: '🌧️', night: '🌧️', label: 'Heavy showers' },
    82: { day: '⛈️', night: '⛈️', label: 'Violent showers' },
    85: { day: '🌨️', night: '🌨️', label: 'Snow showers' },
    86: { day: '❄️', night: '❄️', label: 'Heavy snow showers' },
    95: { day: '⛈️', night: '⛈️', label: 'Thunderstorm' },
    96: { day: '⛈️', night: '⛈️', label: 'Thunderstorm + hail' },
    99: { day: '⛈️', night: '⛈️', label: 'Thunderstorm + heavy hail' },
  };
  const info = map[code] ?? { day: '🌡️', night: '🌡️', label: 'Unknown' };
  return { emoji: isNight ? info.night : info.day, label: info.label, theme };
}
