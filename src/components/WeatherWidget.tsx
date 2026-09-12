/**
 * =============================================================================
 * File: src/components/WeatherWidget.tsx
 * Purpose: Part of the client/server application codebase.
 *
 * Notes:
 *  - This file was documented automatically on 2026-01-25.
 *  - Comments are meant to improve maintainability without changing behavior.
 * =============================================================================
 */

import { useEffect, useState } from "react";
import { Cloud, CloudRain, Sun, Wind } from "lucide-react";
import { Card } from "@/components/ui/card";

// -----------------------------------------------------------------------------
// SECTION: Local helpers / types
// -----------------------------------------------------------------------------


interface WeatherData {
  temp: number;
  condition: string;
  city: string;
}

export function WeatherWidget() {
  const [weather, setWeather] = useState<WeatherData | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchWeather = async (lat: number, lon: number) => {
      try {
        const response = await fetch(
          `https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lon}&current_weather=true&timezone=auto`
        );
        const data = await response.json();
        
        const temp = Math.round(data.current_weather.temperature);
        const weatherCode = data.current_weather.weathercode;
        
        let condition = "Ensolarado";
        if (weatherCode > 60) condition = "Chuvoso";
        else if (weatherCode > 40) condition = "Nublado";
        
        setWeather({
          temp,
          condition,
          city: "Localização"
        });
        setLoading(false);
      } catch (error) {
        console.error("Erro ao buscar clima:", error);
        setLoading(false);
      }
    };

    if (navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(
        (position) => {
          fetchWeather(position.coords.latitude, position.coords.longitude);
        },
        (error) => {
          console.error("Erro ao obter localização:", error);
          setLoading(false);
        }
      );
    } else {
      setLoading(false);
    }
  }, []);

  if (loading || !weather) return null;

  const getWeatherIcon = () => {
    if (weather.condition === "Chuvoso") return <CloudRain className="h-5 w-5 text-blue-400" />;
    if (weather.condition === "Nublado") return <Cloud className="h-5 w-5 text-gray-400" />;
    return <Sun className="h-5 w-5 text-yellow-400" />;
  };

  return (
    <Card className="p-1.5 bg-gradient-to-br from-primary/10 to-secondary/10 border-primary/20">
      <div className="flex items-center gap-1.5">
        <div className="animate-pulse">
          <div className="scale-75">
            {getWeatherIcon()}
          </div>
        </div>
        <div className="flex-1">
          <p className="text-sm font-bold">{weather.temp}°C</p>
          <p className="text-[9px] text-muted-foreground">{weather.condition}</p>
        </div>
      </div>
    </Card>
  );
}
