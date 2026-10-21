'use client';

import { useCallback, useReducer } from 'react';

interface History<T> {
  past: T[];
  present: T;
  future: T[];
}

type Action<T> = { type: 'apply'; next: T } | { type: 'undo' } | { type: 'redo' } | { type: 'reset'; value: T };

const LIMIT = 100;

function reducer<T>(state: History<T>, action: Action<T>): History<T> {
  switch (action.type) {
    case 'apply':
      if (action.next === state.present) return state;
      return { past: [...state.past, state.present].slice(-LIMIT), present: action.next, future: [] };
    case 'undo': {
      const prev = state.past[state.past.length - 1];
      if (prev === undefined) return state;
      return { past: state.past.slice(0, -1), present: prev, future: [state.present, ...state.future] };
    }
    case 'redo': {
      const [next, ...rest] = state.future;
      if (next === undefined) return state;
      return { past: [...state.past, state.present], present: next, future: rest };
    }
    case 'reset':
      return { past: [], present: action.value, future: [] };
  }
}

/** Состояние с историей отмены и повтора. */
export function useHistoryState<T>(initial: T) {
  const [state, dispatch] = useReducer(reducer<T>, { past: [], present: initial, future: [] });
  const apply = useCallback((fn: (current: T) => T) => dispatch({ type: 'apply', next: fn(state.present) }), [state.present]);
  return {
    value: state.present,
    apply,
    undo: useCallback(() => dispatch({ type: 'undo' }), []),
    redo: useCallback(() => dispatch({ type: 'redo' }), []),
    reset: useCallback((value: T) => dispatch({ type: 'reset', value }), []),
    canUndo: state.past.length > 0,
    canRedo: state.future.length > 0,
  };
}
