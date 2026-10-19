import { useMemo, useState } from 'react';
import { Check, Clock3, Inbox, Send, X } from 'lucide-react';

const STATUS_FILTERS = ['All', 'Pending', 'Accepted', 'Expired'];

const avatarUrl = (seed) =>
  `https://api.dicebear.com/7.x/notionists/svg?seed=${encodeURIComponent(seed || 'peer')}&backgroundColor=transparent`;

const statusClass = {
  pending: 'border-amber-500/30 bg-amber-500/10 text-amber-600 dark:text-amber-300',
  accepted: 'border-emerald-500/30 bg-emerald-500/10 text-emerald-600 dark:text-emerald-300',
  expired: 'border-slate-400/30 bg-slate-400/10 text-slate-500 dark:text-slate-300',
  declined: 'border-rose-500/30 bg-rose-500/10 text-rose-600 dark:text-rose-300',
};

export default function ChatRequestsCenter({ requests, onRespond, respondingRequestId }) {
  const [activeFilter, setActiveFilter] = useState('All');
  const allRequests = useMemo(() => [
    ...requests.incoming.map((request) => ({ ...request, direction: 'received' })),
    ...requests.sent.map((request) => ({ ...request, direction: 'sent' })),
  ].sort((a, b) => new Date(b.created_at || 0) - new Date(a.created_at || 0)), [requests]);

  const visibleRequests = allRequests.filter((request) => {
    const status = String(request.status || '').trim().toLowerCase();
    const filterStatus = activeFilter.toLowerCase();
    return activeFilter === 'All' || status === filterStatus;
  });

  return (
    <section aria-labelledby="chat-requests-heading">
      <div className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="mb-2 text-xs font-bold uppercase tracking-[0.2em] text-pink-500">Your connections</p>
          <h2 id="chat-requests-heading" className="text-2xl font-black text-slate-900 dark:text-white sm:text-3xl">
            Chat Requests Center
          </h2>
          <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
            Review requests you have sent and received.
          </p>
        </div>
        <div className="flex flex-wrap gap-2" role="group" aria-label="Filter chat requests by status">
          {STATUS_FILTERS.map((filter) => (
            <button
              key={filter}
              type="button"
              aria-pressed={activeFilter === filter}
              onClick={() => setActiveFilter(filter)}
              className={`rounded-full border px-4 py-2 text-xs font-bold transition-colors ${
                activeFilter === filter
                  ? 'border-pink-500 bg-gradient-to-r from-pink-500 to-amber-500 text-white'
                  : 'border-slate-200 text-slate-600 hover:border-pink-300 dark:border-white/10 dark:text-slate-300 dark:hover:border-pink-500/50'
              }`}
            >
              {filter}
            </button>
          ))}
        </div>
      </div>

      {visibleRequests.length === 0 ? (
        <div className="glass-card flex flex-col items-center px-6 py-16 text-center">
          <div className="mb-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-pink-500/10 text-pink-500">
            <Inbox size={26} />
          </div>
          <h3 className="font-bold text-slate-900 dark:text-white">
            {allRequests.length === 0 ? 'No chat requests yet' : `No ${activeFilter.toLowerCase()} requests`}
          </h3>
          <p className="mt-1 max-w-sm text-sm text-slate-500 dark:text-slate-400">
            Requests you send or receive will appear here.
          </p>
        </div>
      ) : (
        <div className="grid gap-4 xl:grid-cols-2">
          {visibleRequests.map((request) => {
            const requestId = request.id || request.request_id;
            const requestStatus = String(request.status || '').trim().toLowerCase();
            const peerId = request.direction === 'received'
              ? request.sender_anonymous_id
              : request.receiver_anonymous_id;
            const isResponding = respondingRequestId === requestId;

            return (
              <article key={`${request.direction}-${requestId}`} className="glass-card p-5 sm:p-6">
                <div className="flex items-start gap-4">
                  <div className="h-12 w-12 shrink-0 overflow-hidden rounded-full bg-gradient-to-br from-pink-500 to-amber-500">
                    <img
                      src={avatarUrl(peerId)}
                      alt={`${peerId || 'Peer'} avatar`}
                      className="h-full w-full object-cover"
                      onError={(event) => { event.currentTarget.style.display = 'none'; }}
                    />
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <h3 className="truncate font-mono text-sm font-bold text-slate-900 dark:text-white">
                        {peerId || 'Anonymous peer'}
                      </h3>
                      <span className={`rounded-full border px-2.5 py-1 text-[10px] font-bold uppercase tracking-wider ${statusClass[requestStatus] || statusClass.expired}`}>
                        {requestStatus || 'Unknown'}
                      </span>
                    </div>
                    <p className="mt-1 flex items-center gap-1.5 text-xs text-slate-500 dark:text-slate-400">
                      {request.direction === 'received' ? <Inbox size={13} /> : <Send size={13} />}
                      {request.direction === 'received' ? 'Received request' : 'Sent request'}
                      {request.created_at && (
                        <>
                          <span aria-hidden="true">·</span>
                          <Clock3 size={12} />
                          <time dateTime={request.created_at}>{new Date(request.created_at).toLocaleDateString()}</time>
                        </>
                      )}
                    </p>
                  </div>
                </div>

                <div className="mt-4 rounded-xl border border-slate-200/70 bg-slate-50/80 p-4 dark:border-white/5 dark:bg-white/[0.03]">
                  <p className="mb-1 text-[10px] font-bold uppercase tracking-widest text-slate-400">Subject context</p>
                  <p className="text-sm leading-relaxed text-slate-700 dark:text-slate-300">
                    {request.subject_context || 'No subject details provided.'}
                  </p>
                </div>

                {request.direction === 'received' && requestStatus === 'pending' && (
                  <div className="mt-4 flex gap-2">
                    <button
                      type="button"
                      onClick={() => onRespond(requestId, 'accepted')}
                      disabled={isResponding}
                      className="btn-primary flex-1 py-2 text-xs disabled:cursor-not-allowed disabled:opacity-60"
                    >
                      <Check size={14} />
                      {isResponding ? 'Updating...' : 'Accept'}
                    </button>
                    <button
                      type="button"
                      onClick={() => onRespond(requestId, 'declined')}
                      disabled={isResponding}
                      className="btn-secondary flex-1 py-2 text-xs disabled:cursor-not-allowed disabled:opacity-60"
                    >
                      <X size={14} />
                      Decline
                    </button>
                  </div>
                )}
              </article>
            );
          })}
        </div>
      )}
    </section>
  );
}
