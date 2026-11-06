import { renderSettingsAccountPage } from "../accountPages";

export default async function ProfileSettingsPage({
  searchParams,
}: {
  searchParams?: Promise<{ preferences_error?: string }>;
}) {
  return renderSettingsAccountPage("profile", await searchParams);
}
