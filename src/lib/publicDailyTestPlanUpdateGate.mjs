let updateInProgress = false;

export async function runPublicDailyTestPlanUpdate(operation) {
  if (updateInProgress) {
    throw new Error("daily_beta_update_in_progress");
  }
  updateInProgress = true;
  try {
    return await operation();
  } finally {
    updateInProgress = false;
  }
}
