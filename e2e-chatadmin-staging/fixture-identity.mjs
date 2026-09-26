const UUID=/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/u;

export function canonicalChatAdminFixtureId(value) {
  const id=typeof value==='string'?value.trim().toLowerCase():'';
  if(!UUID.test(id))throw Error('CHAT_ADMIN_MANUAL_FLOW_ERROR=fixture_identity');
  return id;
}
