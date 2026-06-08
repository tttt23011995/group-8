import { useMemo } from 'react';
import { Radar } from 'react-chartjs-2';
import {
  Chart as ChartJS,
  RadialLinearScale,
  PointElement,
  LineElement,
  Filler,
  Tooltip,
  Legend,
} from 'chart.js';
import { getVendors, getVendorRatings } from '../lib/data';

ChartJS.register(RadialLinearScale, PointElement, LineElement, Filler, Tooltip, Legend);

function scoreColor(score: number): { text: string; bg: string; bar: string } {
  if (score >= 85) return { text: 'text-emerald-400', bg: 'bg-emerald-500', bar: 'bg-emerald-500/30' };
  if (score >= 70) return { text: 'text-yellow-400', bg: 'bg-yellow-500', bar: 'bg-yellow-500/30' };
  return { text: 'text-red-400', bg: 'bg-red-500', bar: 'bg-red-500/30' };
}

export default function Scorecard() {
  const vendors = useMemo(() => getVendors(), []);
  const ratings = useMemo(() => getVendorRatings(), []);

  const enriched = useMemo(
    () =>
      vendors.map((v) => {
        const r = ratings.find((rt) => rt.vendorId === v.id);
        return { ...v, rating: r || { quality: v.score, delivery: v.score, cost: v.score, responsiveness: v.score, overall: v.score } };
      }),
    [vendors, ratings]
  );

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-white">Vendor Scorecard</h1>
        <p className="text-slate-400 text-sm mt-1">Performance metrics across quality, delivery, cost, and responsiveness</p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {enriched.map((v) => {
          const r = v.rating;
          const metrics = [
            { label: 'Quality', value: r.quality },
            { label: 'Delivery', value: r.delivery },
            { label: 'Cost', value: r.cost },
            { label: 'Responsiveness', value: r.responsiveness },
          ];
          const c = scoreColor(v.score);

          const radarData = {
            labels: ['Quality', 'Delivery', 'Cost', 'Responsiveness'],
            datasets: [
              {
                label: v.name,
                data: [r.quality, r.delivery, r.cost, r.responsiveness],
                backgroundColor: 'rgba(59, 130, 246, 0.15)',
                borderColor: 'rgba(59, 130, 246, 0.8)',
                borderWidth: 2,
                pointBackgroundColor: 'rgba(59, 130, 246, 1)',
                pointRadius: 3,
              },
            ],
          };

          const radarOptions = {
            responsive: true,
            maintainAspectRatio: false,
            plugins: { legend: { display: false } },
            scales: {
              r: {
                beginAtZero: true,
                max: 100,
                ticks: { stepSize: 20, color: '#64748b', backdropColor: 'transparent' },
                grid: { color: 'rgba(30, 58, 95, 0.5)' },
                pointLabels: { color: '#94a3b8', font: { size: 11 } },
                angleLines: { color: 'rgba(30, 58, 95, 0.5)' },
              },
            },
          };

          return (
            <div
              key={v.id}
              className="relative z-1 bg-navy-800 border border-blue-900/40 rounded-xl p-6 transition-shadow duration-300 hover:shadow-lg hover:shadow-blue-900/20"
            >
              <div className="flex items-center justify-between mb-4">
                <div>
                  <h3 className="text-white font-semibold text-lg">{v.name}</h3>
                  <p className="text-xs text-blue-400 mt-0.5">{v.category}</p>
                </div>
                <div className="text-right">
                  <p className={`text-3xl font-bold ${c.text}`}>{v.score}</p>
                  <p className="text-xs text-slate-500">Overall Score</p>
                </div>
              </div>

              <div className="h-44 mb-4">
                {typeof ChartJS !== 'undefined' ? (
                  <Radar data={radarData} options={radarOptions} />
                ) : (
                  <div className="space-y-2">
                    {metrics.map((m) => (
                      <div key={m.label} className="flex items-center gap-2">
                        <span className="text-xs text-slate-400 w-28">{m.label}</span>
                        <div className="flex-1 h-2 bg-navy-700 rounded-full overflow-hidden">
                          <div className={`h-full ${c.bg} rounded-full`} style={{ width: `${m.value}%` }} />
                        </div>
                        <span className="text-xs text-slate-300 w-8">{m.value}</span>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              <div className="grid grid-cols-4 gap-2">
                {metrics.map((m) => {
                  const mc = scoreColor(m.value);
                  return (
                    <div key={m.label} className="text-center">
                      <div className={`w-full h-1.5 rounded-full ${mc.bar} mb-1.5`}>
                        <div
                          className={`h-full ${mc.bg} rounded-full transition-all duration-500`}
                          style={{ width: `${m.value}%` }}
                        />
                      </div>
                      <p className={`text-sm font-bold ${mc.text}`}>{m.value}</p>
                      <p className="text-[10px] text-slate-500">{m.label}</p>
                    </div>
                  );
                })}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
