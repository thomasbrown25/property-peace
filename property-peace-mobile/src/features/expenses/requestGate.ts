export interface RequestGate {
  tryAcquire(): boolean;
  release(): void;
}

export function createRequestGate(): RequestGate {
  let acquired = false;
  return {
    tryAcquire: () => {
      if (acquired) return false;
      acquired = true;
      return true;
    },
    release: () => { acquired = false; },
  };
}
