import { describe, it, expect } from 'vitest';
import { parseCommand } from './commands.js';

describe('chat commands', () => {
  it('parses votes with the default and a configured prefix', () => {
    expect(parseCommand({ channel: 'A', userId: '1', user: 'viewer', text: '!g Paris' })).toMatchObject({ type: 'guess', userId: '1', text: 'Paris' });
    expect(parseCommand({ channel: 'A', userId: '1', user: 'viewer', text: '?guess Paris' }, {}, '?guess')).toMatchObject({ type: 'guess', text: 'Paris' });
    expect(parseCommand({ channel: 'A', userId: '1', user: 'viewer', text: 'hello chat' }).type).toBe('ignored');
    expect(parseCommand({ channel: 'B', userId: '1', user: 'viewer', text: '!tc score' }).type).toBe('ignored');
  });

  it('restricts start, skip and lock to moderators and broadcasters', () => {
    expect(parseCommand({ channel: 'A', userId: '1', user: 'viewer', text: '!tc start' }).type).toBe('denied');
    expect(parseCommand({ channel: 'A', userId: '2', user: 'mod', text: '!tc lock', badges: [{ set_id: 'moderator' }] }).type).toBe('lock');
    expect(parseCommand({ channel: 'B', userId: '3', user: 'owner', text: '!tc start', badges: [{ set_id: 'broadcaster' }] }).type).toBe('start');
  });

  it('compares the chatter id with the broadcaster id, never a display name with an id', () => {
    const ids = { A: '1001', B: '2002' };
    expect(parseCommand({ channel: 'A', userId: '1001', user: 'HostName', text: '!tc skip' }, ids).type).toBe('skip');
    expect(parseCommand({ channel: 'A', userId: '555', user: '1001', text: '!tc skip' }, ids).type).toBe('denied');
    expect(parseCommand({ channel: 'B', userId: '1001', user: 'HostName', text: '!tc skip' }, ids).type).toBe('denied');
  });
});
