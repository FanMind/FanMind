# STAGING-EMAIL-REPOSITORY-1350-20261109

Owner instruction: finish Support on isolated Staging. Existing email acceptance
preflight still expected the repository name before its transfer. Bind it to
FanMind/FanMind and retain immutable repository ID 1259448985, exact main,
protected environment, separated credentials, fixed provider-owned test recipient,
DNS and sending-domain restrictions. Reject old/foreign repository names.

Source-only correction. No provider credential, domain, DNS, email delivery,
Production, database, role or acceptance attestation changed. Actual provider
login, dedicated Staging setup and positive delivery evidence remain required.
Validation: eight focused acceptance-policy tests pass, including current
repository metadata URLs, old/foreign names, wrong ID and indeterminate send.
