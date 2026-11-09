// Owner-authorized, narrowly scoped PR acceptance before merging main.
export function isReviewedStagingSourceAllowed(env) {
  const exactSha = /^[a-f0-9]{40}$/u.test(env.GITHUB_SHA ?? '');
  if (!exactSha || env.GITHUB_REPOSITORY !== 'FanMind/FanMind') return false;
  if (env.GITHUB_REF === 'refs/heads/main') {
    return !env.REVIEWED_RELEASE_COMMIT || env.REVIEWED_RELEASE_COMMIT === env.GITHUB_SHA;
  }
  return env.GITHUB_REF === 'refs/heads/fix/facebook-page-discovery-staging' &&
    env.GITHUB_EVENT_NAME === 'workflow_dispatch' &&
    env.REVIEWED_RELEASE_COMMIT === env.GITHUB_SHA &&
    env.BILLING_WRITE_FREEZE === 'preserve' &&
    !env.FANMIND_STAGING_RELEASE_RECOVERY_CONFIRM &&
    !env.FANMIND_STAGING_RELEASE_RECOVERY_PREVIOUS_COMMIT;
}
