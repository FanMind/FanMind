// Owner-authorized, narrowly scoped PR acceptance before merging main.
export function readOperatorSessionState(releaseEnvironment) {
  const values = releaseEnvironment.split(/\r?\n/u)
    .filter(line => /^\s*(?:export\s+)?FANMIND_STAGING_OPERATOR_SESSION_ENABLED\s*=/u.test(line));
  if (values.length === 0) return '';
  if (values.length !== 1) throw new Error('operator_session_state_invalid');
  const match = /^FANMIND_STAGING_OPERATOR_SESSION_ENABLED=(true|false)$/u.exec(values[0]);
  if (!match) throw new Error('operator_session_state_invalid');
  return match[1];
}

export function isReviewedStagingSourceAllowed(env) {
  const exactSha = /^[a-f0-9]{40}$/u.test(env.GITHUB_SHA ?? '');
  if (!exactSha || env.GITHUB_REPOSITORY !== 'FanMind/FanMind') return false;
  const enabled = env.STAGING_OPERATOR_SESSION_ENABLED === 'true';
  if (env.GITHUB_REF === 'refs/heads/main') {
    // Never turn off the approved continuation as a side effect of a Web deploy.
    if (!enabled && env.CURRENT_STAGING_OPERATOR_SESSION_ENABLED === 'true') return false;
    if (enabled) {
      return env.GITHUB_EVENT_NAME === 'workflow_dispatch' &&
        env.REVIEWED_RELEASE_COMMIT === env.GITHUB_SHA &&
        env.BILLING_WRITE_FREEZE === 'preserve' &&
        env.CURRENT_STAGING_OPERATOR_SESSION_ENABLED === 'true' &&
        env.OPERATOR_SESSION_PRESERVATION_CONFIRMATION === 'preserve-approved-operator-session' &&
        !env.FANMIND_STAGING_RELEASE_RECOVERY_CONFIRM &&
        !env.FANMIND_STAGING_RELEASE_RECOVERY_PREVIOUS_COMMIT;
    }
    return !env.REVIEWED_RELEASE_COMMIT || env.REVIEWED_RELEASE_COMMIT === env.GITHUB_SHA;
  }
  if (enabled && env.GITHUB_REF !== 'refs/heads/feat/1464-staging-agent-access') return false;
  return ['refs/heads/fix/facebook-page-discovery-staging',
    'refs/heads/feat/1464-staging-agent-access'].includes(env.GITHUB_REF) &&
    env.GITHUB_EVENT_NAME === 'workflow_dispatch' &&
    env.REVIEWED_RELEASE_COMMIT === env.GITHUB_SHA &&
    env.BILLING_WRITE_FREEZE === 'preserve' &&
    !env.FANMIND_STAGING_RELEASE_RECOVERY_CONFIRM &&
    !env.FANMIND_STAGING_RELEASE_RECOVERY_PREVIOUS_COMMIT;
}
