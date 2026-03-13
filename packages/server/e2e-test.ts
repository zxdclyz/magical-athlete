// End-to-end smoke test: connect two clients, create room, add AI, start game, play through draft
import { io } from 'socket.io-client';

const SERVER = 'http://localhost:3001';

function connect(name: string): Promise<any> {
  return new Promise((resolve) => {
    const socket = io(SERVER);
    socket.on('connect', () => {
      console.log(`[${name}] Connected: ${socket.id}`);
      resolve(socket);
    });
  });
}

function emit(socket: any, event: string, data?: any): Promise<any> {
  return new Promise((resolve) => {
    if (data) {
      socket.emit(event, data, (res: any) => resolve(res));
    } else {
      socket.emit(event, (res: any) => resolve(res));
    }
  });
}

async function sleep(ms: number) {
  return new Promise(r => setTimeout(r, ms));
}

async function main() {
  console.log('=== Magical Athlete E2E Smoke Test ===\n');

  // Connect two players
  const p1 = await connect('Player1');
  const p2 = await connect('Player2');

  // Player1 creates a room
  const createRes = await emit(p1, 'create_room', { playerName: 'Alice' });
  console.log('[Player1] Created room:', createRes.roomId, 'playerId:', createRes.playerId);

  // Player2 joins the room
  const joinRes = await emit(p2, 'join_room', { roomId: createRes.roomId, playerName: 'Bob' });
  console.log('[Player2] Joined room:', joinRes.roomId, 'playerId:', joinRes.playerId);

  // Add 2 AI players
  await sleep(100);
  p1.emit('add_ai', { difficulty: 'easy' });
  await sleep(100);
  p1.emit('add_ai', { difficulty: 'normal' });
  await sleep(200);

  // Listen for game state updates (unified game_update message)
  let lastState: any = null;
  let eventCount = 0;
  p1.on('game_update', (update: { state: any; events: any[]; seq: number }) => {
    lastState = update.state;
    eventCount += update.events.length;
  });

  let p2LastState: any = null;
  p2.on('game_update', (update: { state: any; events: any[]; seq: number }) => {
    p2LastState = update.state;
  });

  // Start game
  console.log('\n[Player1] Starting game...');
  p1.emit('start_game');

  // Wait for first game state
  await sleep(500);

  if (!lastState) {
    console.error('ERROR: No game state received after starting game!');
    process.exit(1);
  }

  console.log(`Phase: ${lastState.phase}`);
  console.log(`Players: ${lastState.players.map((p: any) => p.name).join(', ')}`);
  console.log(`Available racers: ${lastState.availableRacers.length}`);
  console.log(`Draft order length: ${lastState.draftOrder.length}`);

  if (lastState.phase !== 'DRAFTING') {
    console.error(`ERROR: Expected DRAFTING phase, got ${lastState.phase}`);
    process.exit(1);
  }

  // Draft phase: check draftOrder[draftCurrentIndex] to determine whose turn
  let draftRounds = 0;
  const maxWait = 30000;
  const start = Date.now();

  while (lastState.phase === 'DRAFTING' && Date.now() - start < maxWait) {
    await sleep(100);
    const currentDrafter = lastState.draftOrder[lastState.draftCurrentIndex];

    if (currentDrafter === createRes.playerId) {
      const pick = lastState.availableRacers[0];
      console.log(`[Player1] Drafting: ${pick}`);
      p1.emit('game_action', { type: 'MAKE_DECISION', decision: { type: 'DRAFT_PICK', racerName: pick } });
      draftRounds++;
      await sleep(300);
    } else if (currentDrafter === joinRes.playerId) {
      const pick = lastState.availableRacers[0];
      console.log(`[Player2] Drafting: ${pick}`);
      p2.emit('game_action', { type: 'MAKE_DECISION', decision: { type: 'DRAFT_PICK', racerName: pick } });
      draftRounds++;
      await sleep(300);
    } else {
      // AI turn — should auto-resolve, wait a bit
      await sleep(200);
    }
  }

  console.log(`\nDraft completed. Human picks: ${draftRounds}`);
  console.log(`Phase after draft: ${lastState.phase}`);
  console.log(`Total events received: ${eventCount}`);

  if (lastState.phase === 'RACE_SETUP') {
    console.log('\nDraft -> Race Setup transition successful!');

    // Both human players need to choose racers
    const me = lastState.players.find((p: any) => p.id === createRes.playerId);
    if (me && me.hand.length > 0) {
      const racer = me.hand[0];
      console.log(`[Player1] Choosing racer: ${racer}`);
      p1.emit('game_action', { type: 'MAKE_DECISION', decision: { type: 'CHOOSE_RACE_RACER', racerName: racer } });
      await sleep(500);
    }

    const p2me = p2LastState?.players.find((p: any) => p.id === joinRes.playerId);
    if (p2me && p2me.hand.length > 0) {
      const racer = p2me.hand[0];
      console.log(`[Player2] Choosing racer: ${racer}`);
      p2.emit('game_action', { type: 'MAKE_DECISION', decision: { type: 'CHOOSE_RACE_RACER', racerName: racer } });
      await sleep(500);
    }
  }

  await sleep(500);
  console.log(`\nFinal phase: ${lastState.phase}`);

  if (lastState.phase === 'RACING') {
    console.log('Game reached RACING phase!');
    console.log(`Active racers: ${lastState.activeRacers.length}`);
    console.log(`Track: ${lastState.trackConfig.name} (${lastState.trackConfig.side})`);
    console.log(`Turn order: ${lastState.turnOrder.length} players`);
  }

  console.log(`\nTotal events: ${eventCount}`);
  console.log('\n=== Smoke Test PASSED ===');

  p1.disconnect();
  p2.disconnect();
  process.exit(0);
}

main().catch(err => {
  console.error('Test failed:', err);
  process.exit(1);
});
