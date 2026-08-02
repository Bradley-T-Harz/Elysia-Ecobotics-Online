import { lazy, Suspense } from "react";
import { BrowserRouter, Navigate, Route, Routes, useLocation, useParams } from "react-router-dom";
import SiteLayout from "./layouts/SiteLayout";
import { AuthProvider } from "./shared/auth/AuthProvider";
import { ParticipationProvider } from "./shared/participation/ParticipationProvider";

const MarketplaceProvider = lazy(() => import("./pages/The-Elysia-Marketplace/MarketplaceProvider"));
const OnlineMainPage = lazy(() => import("./pages/Elysia-Ecobotics-Online-MainPage"));
const ArchivePage = lazy(() => import("./pages/The-Elysia-Archive"));
const MarketplaceHomePage = lazy(() => import("./pages/The-Elysia-Marketplace/pages/HomePage"));
const BrowsePage = lazy(() => import("./pages/The-Elysia-Marketplace/pages/BrowsePage"));
const AddonDetailsPage = lazy(() => import("./pages/The-Elysia-Marketplace/pages/AddonDetailsPage"));
const ActionPreviewPage = lazy(() => import("./pages/The-Elysia-Marketplace/pages/ActionPreviewPage"));
const AccountPage = lazy(() => import("./pages/The-Elysia-Marketplace/pages/AccountPage"));
const SubmitPage = lazy(() => import("./pages/The-Elysia-Marketplace/pages/SubmitPage"));
const TrustPage = lazy(() => import("./pages/The-Elysia-Marketplace/pages/TrustPage"));
const ManifestApiPage = lazy(() => import("./pages/The-Elysia-Marketplace/pages/ManifestApiPage"));
const MarketplaceAdminPage = lazy(() => import("./pages/The-Elysia-Marketplace/pages/AdminPage"));
const ProductsPage = lazy(() => import("./pages/Elysia-Ecobotics-Products"));
const LabPage = lazy(() => import("./pages/The-Elysia-Ecobotics-Lab"));
const DeveloperForgePage = lazy(() => import("./pages/The-Developer-Forge"));
const LivingLibraryPage = lazy(() => import("./pages/The-Living-Library"));
const CommunePage = lazy(() => import("./pages/The-Elysia-Commune"));
const WorkWithPage = lazy(() => import("./pages/Work-With-Elysia-Ecobotics"));
const SupportPage = lazy(() => import("./pages/Support"));
const SupportThankYouPage = lazy(() => import("./pages/Support/SupportThankYouPage"));
const AccountForgotPasswordPage = lazy(() => import("./pages/Account/AccountForgotPasswordPage"));
const AccountRecoveryPage = lazy(() => import("./pages/Account/AccountRecoveryPage"));
const AccountDataExportPage = lazy(() => import("./pages/Account/AccountDataExportPage"));
const AccountDeletionPage = lazy(() => import("./pages/Account/AccountDeletionPage"));
const CommonsCirclePage = lazy(() => import("./pages/The-Commons-Circle"));
const ElysiaArtisanCollectivePage = lazy(() => import("./pages/Elysia-Artisan-Collective"));
const CommonsCircleAdminConsolePage = lazy(() => import("./pages/The-Commons-Circle/CommonsCircleAdminConsolePage"));
const AdminCommunicationsPage = lazy(() => import("./pages/The-Commons-Circle/AdminCommunicationsPage"));
const CommonsCircleSetupPage = lazy(() => import("./pages/The-Commons-Circle/CommonsCircleSetupPage"));
const SavedShelvesPage = lazy(() => import("./pages/The-Commons-Circle/SavedShelvesPage"));
const SignalConsolePage = lazy(() => import("./pages/The-Commons-Circle/SignalConsolePage"));
const InboxPage = lazy(() => import("./pages/The-Commons-Circle/InboxPage"));
const NotificationsPage = lazy(() => import("./pages/The-Commons-Circle/NotificationsPage"));
const RequestsReviewsPage = lazy(() => import("./pages/The-Commons-Circle/RequestsReviewsPage"));
const SupportBillingPage = lazy(() => import("./pages/The-Commons-Circle/SupportBillingPage"));
const PublicCommonsProfilePage = lazy(() => import("./pages/Public-Commons-Profile"));
const StoryPage = lazy(() => import("./pages/The-Story-of-Elysia"));
const AboutPage = lazy(() => import("./pages/About-Elysia-Ecobotics"));
const MissionPage = lazy(() => import("./pages/The-Elysia-Mission"));
const LegalPage = lazy(() => import("./pages/Legal"));
const LegalPolicyPage = lazy(() => import("./pages/Legal").then((module) => ({ default: module.LegalPolicyPage })));
const AdminHomePage = lazy(() => import("./pages/Admin").then((module) => ({ default: module.AdminHomePage })));
const AdminReviewPage = lazy(() => import("./pages/Admin").then((module) => ({ default: module.AdminReviewPage })));
const AdminRolesPage = lazy(() => import("./pages/Admin").then((module) => ({ default: module.AdminRolesPage })));
const AdminAuditPage = lazy(() => import("./pages/Admin").then((module) => ({ default: module.AdminAuditPage })));
const AdminReportsPage = lazy(() => import("./pages/Admin").then((module) => ({ default: module.AdminReportsPage })));
const AdminDevelopersPage = lazy(() => import("./pages/Admin").then((module) => ({ default: module.AdminDevelopersPage })));
const AdminAddonSubmissionsPage = lazy(() => import("./pages/Admin").then((module) => ({ default: module.AdminAddonSubmissionsPage })));
const AdminLibrarySourcesPage = lazy(() => import("./pages/Admin").then((module) => ({ default: module.AdminLibrarySourcesPage })));
const AdminWorkSubmissionsPage = lazy(() => import("./pages/Admin").then((module) => ({ default: module.AdminWorkSubmissionsPage })));
const EconomicOperationsPage = lazy(() => import("./pages/Admin/EconomicOperationsPage"));

function PageLoading() {
  return <main className="site-loading" aria-live="polite">Loading Elysia Ecobotics Online...</main>;
}

function LegacyAddonAlias() {
  const { id } = useParams();
  return <Navigate to={`/marketplace/addons/${id ?? ""}`} replace />;
}

function LegacySearchAlias({ target }: { target: string }) {
  const location = useLocation();
  return <Navigate to={`${target}${location.search}`} replace />;
}

export default function App() {
  return (
    <AuthProvider>
      <ParticipationProvider>
        <BrowserRouter>
          <Suspense fallback={<PageLoading />}>
            <Routes>
            <Route element={<SiteLayout />}>
            <Route index element={<OnlineMainPage />} />
            <Route path="archive" element={<ArchivePage />} />
            <Route path="marketplace" element={<MarketplaceProvider />}>
              <Route index element={<MarketplaceHomePage />} />
              <Route path="browse" element={<BrowsePage />} />
              <Route path="addons/:id" element={<AddonDetailsPage />} />
              <Route path="action-preview" element={<ActionPreviewPage />} />
              <Route path="account" element={<AccountPage />} />
              <Route path="submit" element={<SubmitPage />} />
              <Route path="trust" element={<TrustPage />} />
              <Route path="manifest-api" element={<ManifestApiPage />} />
              <Route path="admin" element={<MarketplaceAdminPage />} />
            </Route>
            <Route path="products" element={<ProductsPage />} />
            <Route path="lab" element={<LabPage />} />
            <Route path="developer-forge" element={<DeveloperForgePage />} />
            <Route path="developer-forge/profile" element={<DeveloperForgePage />} />
            <Route path="developer-forge/dashboard" element={<DeveloperForgePage />} />
            <Route path="developer-forge/drafts" element={<DeveloperForgePage />} />
            <Route path="developer-forge/drafts/new" element={<DeveloperForgePage />} />
            <Route path="developer-forge/drafts/:id" element={<DeveloperForgePage />} />
            <Route path="developer-forge/drafts/:id/manifest" element={<DeveloperForgePage />} />
            <Route path="developer-forge/drafts/:id/permissions" element={<DeveloperForgePage />} />
            <Route path="developer-forge/drafts/:id/package" element={<DeveloperForgePage />} />
            <Route path="developer-forge/drafts/:id/validate" element={<DeveloperForgePage />} />
            <Route path="developer-forge/drafts/:id/preview" element={<DeveloperForgePage />} />
            <Route path="developer-forge/drafts/:id/submit" element={<DeveloperForgePage />} />
            <Route path="developer-forge/submissions" element={<DeveloperForgePage />} />
            <Route path="developer-forge/submissions/:id" element={<DeveloperForgePage />} />
            <Route path="developer-forge/docs" element={<DeveloperForgePage />} />
            <Route path="developer-forge/docs/workbench" element={<DeveloperForgePage />} />
            <Route path="developer-forge/docs/manifest" element={<DeveloperForgePage />} />
            <Route path="developer-forge/docs/permissions" element={<DeveloperForgePage />} />
            <Route path="developer-forge/docs/security" element={<DeveloperForgePage />} />
            <Route path="developer-forge/docs/templates" element={<DeveloperForgePage />} />
            <Route path="developer-forge/docs/compatibility" element={<DeveloperForgePage />} />
            <Route path="living-library" element={<LivingLibraryPage />} />
            <Route path="commune" element={<CommunePage />} />
            <Route path="commune/rooms" element={<CommunePage />} />
            <Route path="commune/rooms/:roomSlug/new" element={<CommunePage />} />
            <Route path="commune/rooms/:roomSlug/posts" element={<CommunePage />} />
            <Route path="commune/rooms/:roomSlug" element={<CommunePage />} />
            <Route path="commune/posts/:postId" element={<CommunePage />} />
            <Route path="commune/new" element={<CommunePage />} />
            <Route path="commune/repository-showcase" element={<Navigate replace to="/commune/rooms/repository-showcase/new" />} />
            <Route path="commune/repository-showcase/new" element={<CommunePage />} />
            <Route path="commune/repository-showcase/sandbox-request" element={<CommunePage />} />
            <Route path="commune/elysia-iteration-showcase/sandbox-request" element={<CommunePage />} />
            <Route path="commune/troubleshooting" element={<CommunePage />} />
            <Route path="commune/troubleshooting-grove/review" element={<CommunePage />} />
            <Route path="commune/troubleshooting-grove/sandbox-request" element={<CommunePage />} />
            <Route path="commune/sandbox-review" element={<CommunePage />} />
            <Route path="commune/coding-cornucopia/review" element={<CommunePage />} />
            <Route path="commune/coding-cornucopia/sandbox-request" element={<CommunePage />} />
            <Route path="commune/code-sharing/review" element={<CommunePage />} />
            <Route path="commune/code-sharing/sandbox-request" element={<CommunePage />} />
            <Route path="commune/realtime" element={<CommunePage />} />
            <Route path="commune/moderation" element={<CommunePage />} />
            <Route path="commune/:roomSlug/new" element={<CommunePage />} />
            <Route path="commune/:roomSlug" element={<CommunePage />} />
            <Route path="work-with-elysia-ecobotics" element={<WorkWithPage />} />
            <Route path="support" element={<SupportPage />} />
            <Route path="support/thank-you" element={<SupportThankYouPage />} />
            <Route path="account/forgot-password" element={<AccountForgotPasswordPage />} />
            <Route path="account/recovery" element={<AccountRecoveryPage />} />
            <Route path="account/export" element={<AccountDataExportPage />} />
            <Route path="account/delete" element={<AccountDeletionPage />} />
            <Route path="commons-circle" element={<CommonsCirclePage />} />
            <Route path="commons-circle/admin-console" element={<CommonsCircleAdminConsolePage />} />
            <Route path="commons-circle/admin-communications" element={<AdminCommunicationsPage />} />
            <Route path="commons-circle/saved-shelves" element={<SavedShelvesPage />} />
            <Route path="commons-circle/inbox" element={<InboxPage />} />
            <Route path="commons-circle/notifications" element={<NotificationsPage />} />
            <Route path="commons-circle/requests-reviews" element={<RequestsReviewsPage />} />
            <Route path="commons-circle/signals" element={<SignalConsolePage />} />
            <Route path="commons-circle/support-billing" element={<SupportBillingPage />} />
            <Route path="commons-circle/onboarding" element={<Navigate to="/commons-circle/setup/profile" replace />} />
            <Route path="commons-circle/setup/:step" element={<CommonsCircleSetupPage />} />
            <Route path="commons-circle/:publicHandle" element={<PublicCommonsProfilePage />} />
            <Route path="commons/:publicHandle" element={<PublicCommonsProfilePage />} />
            <Route path="artisan-collective" element={<ElysiaArtisanCollectivePage />} />
            <Route path="story" element={<StoryPage />} />
            <Route path="about" element={<AboutPage />} />
            <Route path="mission" element={<MissionPage />} />
            <Route path="legal" element={<LegalPage />} />
            <Route path="legal/:slug" element={<LegalPolicyPage />} />
            <Route path="admin" element={<AdminHomePage />} />
            <Route path="admin/moderation" element={<AdminReportsPage />} />
            <Route path="admin/reports" element={<AdminReportsPage />} />
            <Route path="admin/addon-submissions" element={<AdminAddonSubmissionsPage />} />
            <Route path="admin/developers" element={<AdminDevelopersPage />} />
            <Route path="admin/library-sources" element={<AdminLibrarySourcesPage />} />
            <Route path="admin/work-submissions" element={<AdminWorkSubmissionsPage />} />
            <Route path="admin/review" element={<AdminReviewPage />} />
            <Route path="admin/review/work-with" element={<AdminReviewPage />} />
            <Route path="admin/review/stewardship" element={<AdminReviewPage />} />
            <Route path="admin/review/commune" element={<AdminReviewPage />} />
            <Route path="admin/review/living-library" element={<AdminReviewPage />} />
            <Route path="admin/review/marketplace" element={<AdminReviewPage />} />
            <Route path="admin/review/broken-links" element={<AdminReviewPage />} />
            <Route path="admin/roles" element={<AdminRolesPage />} />
            <Route path="admin/audit" element={<AdminAuditPage />} />
            <Route path="admin/economic-operations" element={<EconomicOperationsPage />} />
            <Route path="browse" element={<Navigate to="/marketplace/browse" replace />} />
            <Route path="addons/:id" element={<LegacyAddonAlias />} />
            <Route path="action-preview" element={<LegacySearchAlias target="/marketplace/action-preview" />} />
            <Route path="account" element={<Navigate to="/marketplace/account" replace />} />
            <Route path="submit" element={<Navigate to="/marketplace/submit" replace />} />
            <Route path="trust" element={<Navigate to="/marketplace/trust" replace />} />
            <Route path="manifest-api" element={<Navigate to="/marketplace/manifest-api" replace />} />
            <Route path="*" element={<Navigate to="/" replace />} />
            </Route>
            </Routes>
          </Suspense>
        </BrowserRouter>
      </ParticipationProvider>
    </AuthProvider>
  );
}
