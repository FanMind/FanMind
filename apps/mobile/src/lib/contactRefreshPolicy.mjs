function createContactLoadSequence(initialSearch = "") {
  let current = 0;
  let search = initialSearch;
  return {
    begin() {
      current += 1;
      return current;
    },
    invalidate() {
      current += 1;
    },
    isCurrent(sequence) {
      return Number.isInteger(sequence) && sequence === current;
    },
    updateSearch(nextSearch) {
      if (nextSearch === search) return false;
      search = nextSearch;
      current += 1;
      return true;
    },
  };
}

function resolveContactLoadTarget(current, refreshResult) {
  const source = refreshResult === undefined ? current : refreshResult;
  return {
    workspace: source.workspace,
    transportUnavailable: source.transportUnavailable,
  };
}

export {
  createContactLoadSequence,
  resolveContactLoadTarget,
};
