import { describeWeather } from '../services/weather';

// Kickoff weather for a pick card. Renders nothing when there is no forecast
// yet (game more than a week away, or the forecast service was unavailable).
// Wind and heavy rain/snow are highlighted because they tend to push games
// toward the under.
export default function WeatherLine({ weather }) {
  const info = describeWeather(weather);
  if (!info) return null;
  return (
    <div className="flex justify-center mb-2.5">
      <span
        title={info.why || 'Forecast at kickoff'}
        className={`inline-flex items-center gap-1.5 text-[11px] font-medium px-2 py-0.5 rounded-full border ${
          info.alert
            ? 'text-amber-800 bg-amber-50 border-amber-200'
            : 'text-muted border-transparent'
        }`}
      >
        <span aria-hidden="true">{info.icon}</span>
        <span>{info.text}</span>
      </span>
    </div>
  );
}
