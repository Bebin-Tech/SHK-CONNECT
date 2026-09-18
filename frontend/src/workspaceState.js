// Merge HTTP snapshots with socket events without dropping replies received in flight.
export function mergeMessages(previous, incoming) {
  const rows = new Map(previous.map(message => [message.id, message]));
  for (const message of incoming) {
    const old = rows.get(message.id);
    rows.set(message.id, old ? { ...old, ...message, replies: mergeMessages(old.replies || [], message.replies || []) } : message);
  }
  return [...rows.values()].sort((a, b) => a.id - b.id);
}

export function mergeTimeline(history, current, events) {
  let roots = mergeMessages(history, current);
  for (const message of events) {
    if (message.parent_id) roots = roots.map(root => root.id === message.parent_id ? { ...root, replies: mergeMessages(root.replies || [], [message]) } : root);
    else roots = mergeMessages(roots, [message]);
  }
  return roots;
}
