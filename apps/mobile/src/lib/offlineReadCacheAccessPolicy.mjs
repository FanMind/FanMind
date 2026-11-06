function createOfflineReadCacheAccessGate() {
  let activeOwnerId = null;
  let writesEnabled = false;
  let activationSuspended = false;

  return {
    activate(userId) {
      if (!userId) {
        activeOwnerId = null;
        writesEnabled = false;
        return false;
      }
      if (
        activationSuspended ||
        (activeOwnerId !== null && activeOwnerId !== userId)
      ) {
        return false;
      }
      activeOwnerId = userId;
      writesEnabled = true;
      return true;
    },
    resume(userId) {
      if (!userId) return false;
      activationSuspended = false;
      activeOwnerId = userId;
      writesEnabled = true;
      return true;
    },
    suspend() {
      activationSuspended = true;
      activeOwnerId = null;
      writesEnabled = false;
    },
    canUse(userId) {
      return (
        !activationSuspended &&
        writesEnabled &&
        activeOwnerId !== null &&
        activeOwnerId === userId
      );
    },
  };
}

export { createOfflineReadCacheAccessGate };
