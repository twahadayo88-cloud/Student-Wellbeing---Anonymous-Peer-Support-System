import React from 'react';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell } from 'recharts';
import { TrendingUp } from 'lucide-react';

const CustomTooltip = ({ active, payload }) => {
  if (active && payload && payload.length) {
    const item = payload[0].payload;
    return (
      <div className="bg-white dark:bg-gray-800 p-4 rounded-xl shadow-xl border border-gray-100 dark:border-gray-700 min-w-[200px]">
        <p className="text-sm font-extrabold text-gray-900 dark:text-white mb-2 pb-1 border-b border-gray-100 dark:border-gray-700">
          {item.subject}
        </p>
        <div className="space-y-1.5">
          <div className="flex justify-between items-center text-xs">
            <span className="text-gray-500 dark:text-gray-400 font-medium">Total Request:</span>
            <span className="font-bold text-indigo-600 dark:text-indigo-400">{item.total_requests}</span>
          </div>
          <div className="flex justify-between items-center text-xs">
            <span className="text-gray-500 dark:text-gray-400 font-medium">Critical Urgency:</span>
            <span className={`font-bold ${Number(item.critical_count) > 0 ? 'text-red-500' : 'text-gray-400 dark:text-gray-500'}`}>
              {Number(item.critical_count)}
            </span>
          </div>
          <div className="flex justify-between items-center text-xs">
            <span className="text-gray-500 dark:text-gray-400 font-medium">Resolved:</span>
            <span className={`font-bold ${Number(item.resolved_count) > 0 ? 'text-green-500' : 'text-gray-400 dark:text-gray-500'}`}>
              {Number(item.resolved_count)}
            </span>
          </div>
          <div className="flex justify-between items-center text-xs">
            <span className="text-gray-500 dark:text-gray-400 font-medium">Unmatched 24h+:</span>
            <span className={`font-bold ${Number(item.unmatched_24h_count) > 0 ? 'text-orange-500' : 'text-gray-400 dark:text-gray-500'}`}>
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
      <div className="bg-white dark:bg-gray-800 p-8 rounded-2xl shadow-sm border border-gray-100 dark:border-gray-700 text-center">
        <TrendingUp className="w-10 h-10 mx-auto mb-3 text-gray-300" />
        <h3 className="text-lg font-bold text-gray-900 dark:text-white">No trend data yet</h3>
        <p className="text-sm text-gray-500 mt-2">Department trends will appear after academic requests are recorded.</p>
      </div>
    );
  }

  const criticalCount = trendRows.reduce((sum, item) => sum + Number(item.critical_count || 0), 0);
  const totalRequests = trendRows.reduce((sum, item) => sum + Number(item.total_requests || 0), 0);
  const resolvedCount = trendRows.reduce((sum, item) => sum + Number(item.resolved_count || 0), 0);

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        <div className="bg-white dark:bg-gray-800 p-4 rounded-xl shadow-sm border border-gray-100 dark:border-gray-700">
          <div className="text-xs text-gray-500 mb-1">Total Requests</div>
          <div className="text-2xl font-bold text-indigo-600 dark:text-indigo-400">{totalRequests}</div>
        </div>
        <div className="bg-white dark:bg-gray-800 p-4 rounded-xl shadow-sm border border-gray-100 dark:border-gray-700">
          <div className="text-xs text-gray-500 mb-1">Critical Urgency</div>
          <div className="text-2xl font-bold text-red-500">{criticalCount}</div>
        </div>
        <div className="bg-white dark:bg-gray-800 p-4 rounded-xl shadow-sm border border-gray-100 dark:border-gray-700">
          <div className="text-xs text-gray-500 mb-1">Resolved</div>
          <div className="text-2xl font-bold text-green-500">{resolvedCount}</div>
        </div>
        <div className="bg-white dark:bg-gray-800 p-4 rounded-xl shadow-sm border border-gray-100 dark:border-gray-700">
          <div className="text-xs text-gray-500 mb-1">Unmatched 24h+</div>
          <div className="text-2xl font-bold text-orange-500">
            {unmatchedRequests.length}
          </div>
        </div>
      </div>

      <div className="bg-white dark:bg-gray-800 p-6 rounded-2xl shadow-sm border border-gray-100 dark:border-gray-700">
        <h3 className="text-lg font-bold text-gray-900 dark:text-white mb-6 flex items-center">
          <TrendingUp className="w-5 h-5 mr-2 text-indigo-500" />
          Academic Trends (Last 30 Days)
        </h3>

        <div className="h-64 w-full">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={trendRows}>
              <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="rgba(156, 163, 175, 0.15)" />
              <XAxis 
                dataKey="subject" 
                axisLine={false} 
                tickLine={false} 
                tick={{ fontSize: 12, fill: '#9ca3af' }}
              />
              <YAxis 
                axisLine={false} 
                tickLine={false} 
                tick={{ fontSize: 12, fill: '#9ca3af' }}
              />
              <Tooltip 
                content={<CustomTooltip />}
                cursor={{ fill: 'rgba(99, 102, 241, 0.06)' }}
              />
              <Bar dataKey="total_requests" radius={[4, 4, 0, 0]} barSize={40}>
                {trendRows.map((entry, index) => (
                  <Cell key={`cell-${index}`} fill={Number(entry.critical_count) > 0 ? '#ef4444' : '#6366f1'} />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>

        <div className="mt-6 pt-6 border-t border-gray-50 dark:border-gray-700">
          <h4 className="text-sm font-semibold mb-4 text-gray-700 dark:text-gray-300">Detailed Insights</h4>
          <div className="space-y-3">
            {trendRows.map((item, idx) => (
              <div key={idx} className="flex justify-between items-center text-sm p-3 bg-gray-50 dark:bg-gray-700/50 rounded-lg">
                <span className="font-medium text-gray-800 dark:text-gray-200">{item.subject}</span>
                <div className="flex space-x-4 text-xs">
                  <span className="text-gray-500">Avg Resolution: <span className="text-gray-800 dark:text-gray-200">{Math.round(item.avg_resolution_hours || 0)}h</span></span>
                  <span className={Number(item.critical_count) > 0 ? 'text-red-500 font-bold' : 'text-gray-500'}>
                    Critical: {Number(item.critical_count)}
                  </span>
                  <span className={Number(item.unmatched_24h_count) > 0 ? 'text-orange-500 font-bold' : 'text-gray-500'}>
                    Unmatched 24h+: {Number(item.unmatched_24h_count || 0)}
                  </span>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {unmatchedRequests.length > 0 && (
        <section aria-label="Unmatched academic requests" className="border-t-4 border-orange-400 bg-orange-50 dark:bg-orange-950/20 p-5">
          <div className="flex items-center justify-between mb-3">
            <h3 className="text-base font-bold text-gray-900 dark:text-white">Unmatched requests</h3>
            <span className="text-xs font-semibold text-orange-700 dark:text-orange-300">24h or more</span>
          </div>
          <ul className="divide-y divide-orange-200 dark:divide-orange-900/50">
            {unmatchedRequests.map((request, index) => (
              <li key={`${request.subject}-${request.created_at}-${index}`} className="flex flex-wrap items-center justify-between gap-2 py-3 text-sm">
                <span className="font-medium text-gray-800 dark:text-gray-200">{request.subject}</span>
                <span className="text-xs text-gray-600 dark:text-gray-400">
                  {request.urgency} priority | waiting {Number(request.hours_waiting)}h | {new Date(request.created_at).toLocaleDateString()}
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
