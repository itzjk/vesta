export function clock(meta, t, log, db) {
  const ok = id => !!db.findingById[id], c = meta.comm;
  const heard = ok(c.one_way_finding) ? c.one_way_min * 60 : null, reply = ok(c.round_trip_finding) ? c.round_trip_min * 60 : null;
  const done = log.filter(e => e.t <= t), count = k => done.filter(e => e.basis === k).length;
  return { sent: 0, heard, reply, progress: heard == null ? null : Math.min(1, Math.max(0, t / heard)), to_reply: reply == null ? null : Math.max(0, reply - t),
           decided: { steps: done.length, experiment: count('experiment'), summary: count('summary'), operations: count('operations'),
                      no_source: done.filter(e => e.state === 'NO_SOURCE').length } };
}

export function mmss(seconds, bare = false) {
  const s = Math.round(Math.abs(seconds)), body = String(Math.floor(s / 60)).padStart(2, '0') + ':' + String(s % 60).padStart(2, '0');
  return bare ? body : (seconds < 0 ? 'T-' : 'T+') + body;
}
