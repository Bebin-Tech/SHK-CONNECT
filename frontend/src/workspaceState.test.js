import test from 'node:test';
import assert from 'node:assert/strict';
import { mergeMessages, mergeTimeline } from './workspaceState.js';

test('a live reply arriving before history remains visible after the snapshot', () => {
  const root = {id:1, content:'Root', replies:[]};
  const reply = {id:3, parent_id:1, content:'Arrived during HTTP request'};
  assert.deepEqual(mergeTimeline([root], [], [reply])[0].replies, [reply]);
});

test('reconnect snapshots and duplicate events do not duplicate or remove replies', () => {
  const reply = {id:3, parent_id:1, content:'Reply'};
  const current = [{id:1, content:'Root', replies:[reply]}];
  const merged = mergeMessages(current, [{id:1, content:'Root', replies:[]}]);
  assert.equal(mergeTimeline(merged, current, [reply, reply])[0].replies.length, 1);
});

test('older pages stay ordered while live messages arrive', () => {
  assert.deepEqual(mergeTimeline([{id:1},{id:2}], [{id:2},{id:4}], [{id:3}]).map(row => row.id), [1,2,3,4]);
});
