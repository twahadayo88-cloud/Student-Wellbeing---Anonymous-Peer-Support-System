import React from 'react';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell } from 'recharts';
import { TrendingUp } from 'lucide-react';

const CustomTooltip = ({ active, payload }) => {
  if (active && payload && payload.length) {
    const item = payload[0].payload;
    return (
      <div className="glass-card-brand p-4 rounded-2xl shadow-2xl min-w-[200px] border border-white/10">
        <p className="text-sm font-bold text-white mb-2 pb-1 border-b border-white/10">
          {item.subject}
        </p>
        <div className="space-y-1.5 font-mono">
          <div className="flex justify-between items-center text-xs">
            <span className="text-surface-400 font-medium">Total Requests:</span>
            <span className="font-bold text-pink-400">{item.total_requests}</span>
          </div>
          <div className="flex justify-between items-center text-xs">
            <span className="text-surface-400 font-medium">Critical Urgency:</span>
            <span className={`font-bold ${Number(item.critical_count) > 0 ? 'text-red-400' : 'text-surface-500'}`}>
              {Number(item.critical_count)}
            </span>
          </div>
          <div className="flex justify-between items-center text-xs">
            <span className="text-surface-400 font-medium">Resolved:</span>
            <span className={`font-bold ${Number(item.resolved_count) > 0 ? 'text-emerald-400' : 'text-surface-500'}`}>
              {Number(item.resolved_count)}
            </span>
          </div>
          <div className="flex justify-between items-center text-xs">
            <span className="text-surface-400 font-medium">Unmatched 24h+:</span>
            <span className={`font-bold ${Number(item.unmatched_24h_count) > 0 ? 'text-amber-400' : 'text-surface-500'}`}>
              {Number(item.unmatched_24h_count || 0)}
            </span>
          </div>
        </div>
      </div>
    );
  }
  return null;
};

const FacultyTrends = ({ data }) => {
  const trendRows = Array.isArray(data) ? data : data?.trends || [];
  const unmatchedRequests = Array.isArray(data?.unmatched_requests) ? data.unmatched_requests : [];

  if (trendRows.length === 0 && unmatchedRequests.length === 0) {
    return (
      <div className="glass-card p-10 rounded-2xl text-center border border-white/5">
        <TrendingUp className="w-10 h-10 mx-auto mb-3 text-pink-500/60" />
        <h3 className="text-base font-bold text-white">No Trend Data Yet</h3>
        <p className="text-xs text-surface-400 mt-1">Department trends will populate as academic requests are submitted and matched.</p>
      </div>
    );
  }

  const criticalCount = trendRows.reduce((sum, item) => sum + Number(item.critical_count || 0), 0);
  const totalRequests = trendRows.reduce((sum, item) => sum + Number(item.total_requests || 0), 0);
  const resolvedCount = trendRows.reduce((sum, item) => sum + Number(item.resolved_count || 0), 0);

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        <div className="glass-card p-5 rounded-2xl border border-white/5">
          <div className="text-xs font-semibold uppercase tracking-wider text-surface-400 mb-1">Total Requests</div>
          <div className="text-2xl font-extrabold font-mono text-pink-400">{totalRequests}</div>
        </div>
        <div className="glass-card p-5 rounded-2xl border border-white/5">
          <div className="text-xs font-semibold uppercase tracking-wider text-surface-400 mb-1">Critical Urgency</div>
          <div className="text-2xl font-extrabold font-mono text-rose-400">{criticalCount}</div>
        </div>
        <div className="glass-card p-5 rounded-2xl border border-white/5">
          <div className="text-xs font-semibold uppercase tracking-wider text-surface-400 mb-1">Resolved</div>
          <div className="text-2xl font-extrabold font-mono text-emerald-400">{resolvedCount}</div>
        </div>
        <div className="glass-card p-5 rounded-2xl border border-white/5">
          <div className="text-xs font-semibold uppercase tracking-wider text-surface-400 mb-1">Unmatched 24h+</div>
          <div className="text-2xl font-extrabold font-mono text-amber-400">
            {unmatchedRequests.length}
          </div>
        </div>
      </div>

      <div className="glass-card-brand p-6 sm:p-8 rounded-3xl border border-white/10">
        <h3 className="text-lg font-bold text-white mb-6 flex items-center gap-2">
          <div className="p-2 rounded-xl bg-pink-500/10 border border-pink-500/20 text-pink-500">
            <TrendingUp className="w-4 h-4" />
          </div>
          Academic Volume Trends <span className="text-xs font-mono font-normal text-surface-400">(30 Day Horizon)</span>
        </h3>

        <div className="h-64 w-full">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={trendRows}>
              <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="rgba(255, 255, 255, 0.05)" />
              <XAxis 
                dataKey="subject" 
                axisLine={false} 
                tickLine={false} 
                tick={{ fontSize: 11, fill: '#9ca3af' }}
              />
              <YAxis 
                axisLine={false} 
                tickLine={false} 
                tick={{ fontSize: 11, fill: '#9ca3af' }}
              />
              <Tooltip 
                content={<CustomTooltip />}
                cursor={{ fill: 'rgba(236, 72, 153, 0.05)' }}
              />
              <Bar dataKey="total_requests" radius={[6, 6, 0, 0]} barSize={36}>
                {trendRows.map((entry, index) => (
                  <Cell key={`cell-${index}`} fill={Number(entry.critical_count) > 0 ? '#ef4444' : '#ec4899'} />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>

        <div className="mt-6 pt-6 border-t border-white/10">
          <h4 className="text-xs font-bold uppercase tracking-wider mb-4 text-surface-300">Detailed Subject Diagnostics</h4>
          <div className="space-y-3">
            {trendRows.map((item, idx) => (
              <div key={idx} className="flex flex-col sm:flex-row sm:items-center justify-between text-sm p-4 glass-card rounded-xl border border-white/5 gap-2">
                <span className="font-bold text-white font-mono">{item.subject}</span>
                <div className="flex flex-wrap items-center gap-4 text-xs font-mono">
                  <span className="text-surface-400">Avg Resolution: <strong className="text-white">{Math.round(item.avg_resolution_hours || 0)}h</strong></span>
                  <span className={Number(item.critical_count) > 0 ? 'text-red-400 font-bold' : 'text-surface-400'}>
                    Critical: {Number(item.critical_count)}
                  </span>
                  <span className={Number(item.unmatched_24h_count) > 0 ? 'text-amber-400 font-bold' : 'text-surface-400'}>
                    Unmatched 24h+: {Number(item.unmatched_24h_count || 0)}
                  </span>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {unmatchedRequests.length > 0 && (
        <section aria-label="Unmatched academic requests" className="glass-card border-l-4 border-l-amber-500 rounded-2xl p-6 border border-white/5">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h3 className="text-base font-bold text-white">Unmatched Requests</h3>
              <p className="text-xs text-surface-400">Students awaiting peer tutors for over 24 hours</p>
            </div>
            <span className="px-2.5 py-1 rounded-full bg-amber-500/10 border border-amber-500/20 text-xs font-mono font-bold text-amber-400">
              {unmatchedRequests.length} Pending
            </span>
          </div>
          <ul className="divide-y divide-white/5">
            {unmatchedRequests.map((request, index) => (
              <li key={`${request.subject}-${request.created_at}-${index}`} className="flex flex-wrap items-center justify-between gap-2 py-3 text-sm">
                <span className="font-mono font-bold text-white">{request.subject}</span>
                <span className="text-xs font-mono text-surface-400">
                  <span className="text-amber-400 font-semibold">{request.urgency} priority</span> · waiting {Number(request.hours_waiting)}h · {new Date(request.created_at).toLocaleDateString()}
                </span>
              </li>
            ))}
          </ul>
        </section>
      )}
    </div>
  );
};

export default FacultyTrends;
