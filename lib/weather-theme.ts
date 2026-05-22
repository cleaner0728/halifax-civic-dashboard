// Weather code → emoji/label + day/night gradient mapping.
// Codes follow the WMO scheme used by Open-Meteo.

export type WeatherTheme = {
  container: string;
  textPrimary: string;
  textSecondary: string;
  bottomBar: string;
};

// Each theme defines both a light- and dark-mode gradient so the card never
// sits too far from the page background. Day/Night variants still pick the
// hue (warm blue vs deep indigo etc.), but the LIGHTNESS adapts to UI mode.
const weatherThemes = {
  clearDay: {
    container:
      'bg-gradient-to-br from-sky-200 via-blue-300 to-blue-400 dark:from-sky-800 dark:via-blue-900 dark:to-slate-900',
    textPrimary: 'text-sky-950 dark:text-white',
    textSecondary: 'text-sky-900/80 dark:text-white/80',
    bottomBar: 'bg-black/10 dark:bg-white/5',
  },
  clearNight: {
    container:
      'bg-gradient-to-br from-indigo-400 via-slate-500 to-slate-600 dark:from-indigo-900 dark:via-slate-800 dark:to-slate-900',
    textPrimary: 'text-indigo-950 dark:text-white',
    textSecondary: 'text-indigo-900/80 dark:text-white/70',
    bottomBar: 'bg-black/10 dark:bg-white/5',
  },
  cloudyDay: {
    container:
      'bg-gradient-to-br from-slate-300 via-slate-400 to-slate-500 dark:from-slate-700 dark:via-slate-800 dark:to-slate-900',
    textPrimary: 'text-slate-900 dark:text-white',
    textSecondary: 'text-slate-800/80 dark:text-white/70',
    bottomBar: 'bg-black/10 dark:bg-white/5',
  },
  cloudyNight: {
    container:
      'bg-gradient-to-br from-slate-400 via-slate-500 to-slate-600 dark:from-slate-700 dark:via-slate-800 dark:to-slate-900',
    textPrimary: 'text-slate-900 dark:text-white',
    textSecondary: 'text-slate-800/80 dark:text-white/70',
    bottomBar: 'bg-black/10 dark:bg-white/5',
  },
  rainDay: {
    container:
      'bg-gradient-to-br from-slate-400 via-blue-500 to-slate-600 dark:from-slate-700 dark:via-blue-800 dark:to-slate-900',
    textPrimary: 'text-slate-900 dark:text-white',
    textSecondary: 'text-slate-800/80 dark:text-white/70',
    bottomBar: 'bg-black/15 dark:bg-white/5',
  },
  rainNight: {
    container:
      'bg-gradient-to-br from-slate-400 via-blue-500 to-slate-700 dark:from-slate-700 dark:via-slate-800 dark:to-blue-900',
    textPrimary: 'text-slate-900 dark:text-white',
    textSecondary: 'text-slate-800/80 dark:text-white/70',
    bottomBar: 'bg-black/15 dark:bg-white/5',
  },
  snowDay: {
    container:
      'bg-gradient-to-br from-sky-100 via-slate-200 to-slate-300 dark:from-sky-900 dark:via-slate-800 dark:to-slate-900',
    textPrimary: 'text-slate-800 dark:text-white',
    textSecondary: 'text-slate-600 dark:text-white/70',
    bottomBar: 'bg-white/40 dark:bg-white/5',
  },
  snowNight: {
    container:
      'bg-gradient-to-br from-slate-300 via-indigo-400 to-slate-500 dark:from-slate-700 dark:via-indigo-900 dark:to-slate-800',
    textPrimary: 'text-slate-900 dark:text-white',
    textSecondary: 'text-slate-800/80 dark:text-white/70',
    bottomBar: 'bg-black/10 dark:bg-white/5',
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
