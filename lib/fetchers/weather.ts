// Open-Meteo forecast for Halifax. Free, no key required.

export interface WeatherData {
  temperature: number;
  apparentTemp: number;
  weatherCode: number;
  windSpeed: number;
  windDirection: number;
  humidity: number;
  pressure: number;
  isDay: boolean;
  uvIndex: number;        // current
  uvIndexMaxToday: number; // peak forecast for today
  daily: {
    date: string;
    weatherCode: number;
    maxTemp: number;
    minTemp: number;
    sunrise: string;
    sunset: string;
  }[];
}

export async function fetchWeather(): Promise<WeatherData | null> {
  try {
    const res = await fetch(
      'https://api.open-meteo.com/v1/forecast?latitude=44.65&longitude=-63.57' +
        '&current=temperature_2m,apparent_temperature,weather_code,wind_speed_10m,wind_direction_10m,relative_humidity_2m,is_day,uv_index,pressure_msl' +
        '&daily=weather_code,temperature_2m_max,temperature_2m_min,sunrise,sunset,uv_index_max' +
        '&timezone=America/Halifax&forecast_days=5',
      { next: { revalidate: 900 } },
    );
    const data = await res.json();
    return {
      temperature: data.current.temperature_2m,
      apparentTemp: data.current.apparent_temperature,
      weatherCode: data.current.weather_code,
      windSpeed: data.current.wind_speed_10m,
      windDirection: data.current.wind_direction_10m,
      humidity: data.current.relative_humidity_2m,
      pressure: data.current.pressure_msl,
      isDay: data.current.is_day === 1,
      uvIndex: data.current.uv_index ?? 0,
      uvIndexMaxToday: data.daily.uv_index_max?.[0] ?? 0,
      daily: data.daily.time.map((t: string, i: number) => ({
        date: t,
        weatherCode: data.daily.weather_code[i],
        maxTemp: data.daily.temperature_2m_max[i],
        minTemp: data.daily.temperature_2m_min[i],
        sunrise: data.daily.sunrise[i],
        sunset: data.daily.sunset[i],
      })),
    };
  } catch (e) {
    console.error('Failed to fetch weather:', e);
    return null;
  }
}
