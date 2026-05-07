"use client";

interface CityTabsProps {
  cities: Array<{ name: string; count: number }>;
  activeCity: string;
  onChange: (city: string) => void;
}

export default function CityTabs({ cities, activeCity, onChange }: CityTabsProps) {
  if (cities.length === 0) return null;

  return (
    <div className="flex gap-2 overflow-x-auto px-5 py-3 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
      {cities.map((city) => {
        const isActive = city.name === activeCity;
        return (
          <button
            key={city.name}
            type="button"
            onClick={() => onChange(city.name)}
            className="flex-shrink-0 rounded-full border px-3 py-1 text-xs font-bold whitespace-nowrap"
            style={
              isActive
                ? {
                    backgroundColor: "#E65100",
                    color: "white",
                    borderColor: "#E65100",
                  }
                : {
                    backgroundColor: "white",
                    color: "#6B7280",
                    borderColor: "#E5E7EB",
                  }
            }
          >
            {city.name} <span style={{ opacity: 0.8 }}>({city.count})</span>
          </button>
        );
      })}
    </div>
  );
}
