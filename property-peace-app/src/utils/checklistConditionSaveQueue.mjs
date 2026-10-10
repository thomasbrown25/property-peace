// Keeps a checklist item's selected condition responsive while full-checklist saves run in order.
export function createConditionSaveQueue({ initialCondition, save, onSelectionChange, onError, onBusyChange = () => {} }) {
  let confirmed = initialCondition || null;
  let desired = confirmed;
  let running = null;

  const drain = async () => {
    onBusyChange(true);
    try {
      while (desired !== confirmed) {
        const target = desired;
        try {
          await save(target);
          confirmed = target;
        } catch (error) {
          onError(error);
          if (desired === target) {
            desired = confirmed;
            onSelectionChange(confirmed);
          }
        }
      }
    } finally {
      onBusyChange(false);
    }
  };

  const start = () => {
    if (!running) {
      running = drain().finally(() => {
        running = null;
        if (desired !== confirmed) start();
      });
    }
  };

  return {
    select(value) {
      desired = desired === value ? null : value;
      onSelectionChange(desired);
      start();
    },
    sync(value) {
      if (running) return;
      confirmed = value || null;
      desired = confirmed;
      onSelectionChange(desired);
    },
    getSelection: () => desired,
    whenIdle: () => running || Promise.resolve()
  };
}
