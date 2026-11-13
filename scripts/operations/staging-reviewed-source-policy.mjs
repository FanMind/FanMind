// Owner-authorized, narrowly scoped PR acceptance before merging main.
export function isReviewedStagingSourceAllowed(env) {
  const exactSha = /^[a-f0-9]{40}$/u.test(env.GITHUB_SHA ?? '');
  if (!exactSha || env.GITHUB_REPOSITORY !== 'FanMind/FanMind') return false;
  if (env.STAGING_OPERATOR_SESSION_ENABLED === 'true' &&
      env.GITHUB_REF !== 'refs/heads/feat/1464-staging-agent-access') return false;
  if (env.GITHUB_REF === 'refs/heads/main') {
    return !env.REVIEWED_RELEASE_COMMIT || env.REVIEWED_RELEASE_COMMIT === env.GITHUB_SHA;
  }
  return ['refs/heads/fix/facebook-page-discovery-staging',
    'refs/heads/feat/1464-staging-agent-access'].includes(env.GITHUB_REF) &&
    env.GITHUB_EVENT_NAME === 'workflow_dispatch' &&
    env.REVIEWED_RELEASE_COMMIT === env.GITHUB_SHA &&
    env.BILLING_WRITE_FREEZE === 'preserve' &&
    !env.FANMIND_STAGING_RELEASE_RECOVERY_CONFIRM &&
    !env.FANMIND_STAGING_RELEASE_RECOVERY_PREVIOUS_COMMIT;
}
