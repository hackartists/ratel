import { AnalyzeQuotaSection } from "./components/analyze-quota-section";
import { EnterpriseGrantSection } from "./components/enterprise-grant-section";
import { ModerationSection } from "./components/moderation-section";
import { RewardSection } from "./components/reward-section";
import { TestAccountsSection } from "./components/test-accounts-section";
import { usePrefetchAdminMain } from "./hooks/use-admin-main";

// app/ratel/src/features/admin/views/main/mod.rs (`AdminMainPage`, `/admin`),
// rendered inside AdminLayout: analyze quota, reviewer test accounts, reward
// rules, enterprise membership grants and the moderation queue. The page
// suspends until every loader has answered, like the Rust `?` loaders.
export function Component() {
  usePrefetchAdminMain();

  return (
    <div className="admin-arena__container">
      <AnalyzeQuotaSection />
      <TestAccountsSection />
      <RewardSection />
      <EnterpriseGrantSection />
      <ModerationSection />
    </div>
  );
}
