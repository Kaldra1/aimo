import { describe, expect, it } from 'vitest';
import {
  createState,
  parse,
  parseTape,
  run,
  step,
  type PostEvent,
  type PostPosition,
  type PostState,
} from './post';
import { INSTANT, MachineRunner, type Scheduler } from './runner';

/** Ручний планувальник: таймери спрацьовують лише за викликом flush(). */
function manualScheduler() {
  const queue: Array<{ id: number; callback: () => void; delay: number }> = [];
  let nextId = 1;
  const scheduler: Scheduler = {
    set(callback, delay) {
      const id = nextId++;
      queue.push({ id, callback, delay });
      return id;
    },
    clear(handle) {
      const index = queue.findIndex((t) => t.id === handle);
      if (index >= 0) queue.splice(index, 1);
    },
  };
  return {
    scheduler,
    pending: () => queue.length,
    lastDelay: () => queue[queue.length - 1]?.delay,
    flush(times = 1) {
      for (let i = 0; i < times && queue.length > 0; i++) queue.shift()!.callback();
    },
  };
}

function initial(source: string, input = '[0]'): PostState {
  const program = parse(source);
  const tape = parseTape(input);
  if (!program.ok || !tape.ok) throw new Error('bad fixture');
  return createState(program.value, tape.value);
}

const machine = { step, run };
type Runner = MachineRunner<PostState, PostPosition, PostEvent>;

function runner(
  source: string,
  options: { limit?: number; speed?: number; logCapacity?: number } = {},
) {
  const timers = manualScheduler();
  const instance: Runner = new MachineRunner(machine, initial(source), {
    limit: options.limit ?? 10_000,
    speed: options.speed ?? 10,
    ...(options.logCapacity ? { logCapacity: options.logCapacity } : {}),
    chunkSize: 100,
    scheduler: timers.scheduler,
  });
  return { instance, timers };
}

const LOOP = '1. → 1';
const THREE_STEPS = '1. → 2\n2. → 3\n3. !';

describe('MachineRunner', () => {
  it('«Крок» виконує рівно один крок і пише його в журнал', () => {
    const { instance } = runner(THREE_STEPS);
    instance.stepOnce();
    const snapshot = instance.getSnapshot();
    expect(snapshot.state?.steps).toBe(1);
    expect(snapshot.log.map((e) => e.command.number)).toEqual([1]);
  });

  it('«Пуск» виконує кроки з інтервалом 1000 / швидкість мс до зупинки', () => {
    const { instance, timers } = runner(THREE_STEPS, { speed: 4 });
    instance.play();
    expect(instance.getSnapshot().playing).toBe(true);
    expect(timers.lastDelay()).toBe(250);
    timers.flush(3);
    const snapshot = instance.getSnapshot();
    expect(snapshot.state?.status).toBe('halted');
    expect(snapshot.playing).toBe(false);
    expect(timers.pending()).toBe(0);
  });

  it('«Пауза» зупиняє таймер, «Крок» під час виконання ставить на паузу', () => {
    const { instance, timers } = runner(LOOP);
    instance.play();
    timers.flush(2);
    instance.pause();
    expect(instance.getSnapshot().playing).toBe(false);
    expect(timers.pending()).toBe(0);
    instance.play();
    instance.stepOnce();
    expect(instance.getSnapshot().playing).toBe(false);
    expect(instance.getSnapshot().state?.steps).toBe(3);
  });

  it('ліміт кроків зупиняє виконання, а підвищення ліміту дозволяє продовжити', () => {
    const { instance, timers } = runner(LOOP, { limit: 3 });
    instance.play();
    timers.flush(10);
    let snapshot = instance.getSnapshot();
    expect(snapshot.state?.steps).toBe(3);
    expect(snapshot.limitReached).toBe(true);
    expect(snapshot.playing).toBe(false);

    instance.stepOnce();
    expect(instance.getSnapshot().state?.steps).toBe(3);

    instance.setLimit(5);
    snapshot = instance.getSnapshot();
    expect(snapshot.limitReached).toBe(false);
    instance.stepOnce();
    expect(instance.getSnapshot().state?.steps).toBe(4);
  });

  it('«миттєво» виконує кроки пачками й не перевищує ліміт', () => {
    const { instance, timers } = runner(LOOP, { limit: 250, speed: INSTANT });
    instance.play();
    expect(timers.lastDelay()).toBe(0);
    timers.flush();
    expect(instance.getSnapshot().state?.steps).toBe(100);
    timers.flush(5);
    const snapshot = instance.getSnapshot();
    expect(snapshot.state?.steps).toBe(250);
    expect(snapshot.limitReached).toBe(true);
    expect(snapshot.playing).toBe(false);
  });

  it('журнал зберігає лише останні кроки, але рахує всі', () => {
    const { instance, timers } = runner(LOOP, { limit: 50, speed: INSTANT, logCapacity: 10 });
    instance.play();
    timers.flush();
    const snapshot = instance.getSnapshot();
    expect(snapshot.log).toHaveLength(10);
    expect(snapshot.logged).toBe(50);
    expect(snapshot.log[0]!.step).toBe(41);
  });

  it('«Скинути» повертає початковий стан і очищає журнал', () => {
    const { instance, timers } = runner(LOOP);
    instance.play();
    timers.flush(4);
    instance.reset(initial(LOOP));
    const snapshot = instance.getSnapshot();
    expect(snapshot.state?.steps).toBe(0);
    expect(snapshot.log).toEqual([]);
    expect(snapshot.playing).toBe(false);
    expect(timers.pending()).toBe(0);
  });

  it('без програми (помилки) нічого не запускається', () => {
    const { instance, timers } = runner(LOOP);
    instance.reset(null);
    instance.play();
    instance.stepOnce();
    expect(instance.getSnapshot().playing).toBe(false);
    expect(timers.pending()).toBe(0);
  });

  it('повідомляє підписників про зміни', () => {
    const { instance } = runner(THREE_STEPS);
    let calls = 0;
    const unsubscribe = instance.subscribe(() => calls++);
    instance.stepOnce();
    unsubscribe();
    instance.stepOnce();
    expect(calls).toBe(1);
  });
});
