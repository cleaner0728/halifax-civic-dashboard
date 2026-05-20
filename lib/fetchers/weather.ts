// Open-Meteo forecast for Halifax. Free, no key required.

export interface WeatherData {
  temperature: number;
  apparentTemp: number;
  weatherCode: number;
  windSpeed: number;
  humidity: number;
  isDay: boolean;
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
      'https://api.open-meteo.com/v1/forecast?latitude=44.65&longitude=-63.57&current=temperature_2m,apparent_temperature,weather_code,wind_speed_10m,relative_humidity_2m,is_day&daily=weather_code,temperature_2m_max,temperature_2m_min,sunrise,sunset&timezone=America/Halifax&forecast_days=5',
      { next: { revalidate: 900 } },
    );
    const data = await res.json();
    return {
      temperature: data.current.temperature_2m,
      apparentTemp: data.current.apparent_temperature,
      weatherCode: data.current.weather_code,
      windSpeed: data.current.wind_speed_10m,
      humidity: data.current.relative_humidity_2m,
      isDay: data.current.is_day === 1,
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
