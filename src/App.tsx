import { BrowserRouter, Navigate, Route, Routes, useLocation, useParams } from "react-router-dom";
import SiteLayout from "./layouts/SiteLayout";
import { AuthProvider } from "./shared/auth/AuthProvider";
import MarketplaceProvider from "./pages/The-Elysia-Marketplace/MarketplaceProvider";
import OnlineMainPage from "./pages/Elysia-Ecobotics-Online-MainPage";
import ArchivePage from "./pages/The-Elysia-Archive";
import MarketplaceHomePage from "./pages/The-Elysia-Marketplace/pages/HomePage";
import BrowsePage from "./pages/The-Elysia-Marketplace/pages/BrowsePage";
import AddonDetailsPage from "./pages/The-Elysia-Marketplace/pages/AddonDetailsPage";
import ActionPreviewPage from "./pages/The-Elysia-Marketplace/pages/ActionPreviewPage";
import AccountPage from "./pages/The-Elysia-Marketplace/pages/AccountPage";
import SubmitPage from "./pages/The-Elysia-Marketplace/pages/SubmitPage";
import TrustPage from "./pages/The-Elysia-Marketplace/pages/TrustPage";
import ManifestApiPage from "./pages/The-Elysia-Marketplace/pages/ManifestApiPage";
import AdminPage from "./pages/The-Elysia-Marketplace/pages/AdminPage";
import ProductsPage from "./pages/Elysia-Ecobotics-Products";
import LabPage from "./pages/The-Elysia-Ecobotics-Lab";
import DeveloperForgePage from "./pages/The-Developer-Forge";
import LivingLibraryPage from "./pages/The-Living-Library";
import CommunePage from "./pages/The-Elysia-Commune";
import WorkWithPage from "./pages/Work-With-Elysia-Ecobotics";
import CommonsCirclePage from "./pages/The-Commons-Circle";
import CommonsCircleSetupPage from "./pages/The-Commons-Circle/CommonsCircleSetupPage";
import SavedShelvesPage from "./pages/The-Commons-Circle/SavedShelvesPage";
import PublicCommonsProfilePage from "./pages/Public-Commons-Profile";
import StoryPage from "./pages/The-Story-of-Elysia";
import AboutPage from "./pages/About-Elysia-Ecobotics";
import MissionPage from "./pages/The-Elysia-Mission";
import LegalPage, { LegalPolicyPage } from "./pages/Legal";
import { AdminAuditPage, AdminHomePage, AdminReviewPage, AdminRolesPage } from "./pages/Admin";

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
      <BrowserRouter>
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
              <Route path="admin" element={<AdminPage />} />
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
            <Route path="developer-forge/docs/manifest" element={<DeveloperForgePage />} />
            <Route path="developer-forge/docs/permissions" element={<DeveloperForgePage />} />
            <Route path="developer-forge/docs/security" element={<DeveloperForgePage />} />
            <Route path="developer-forge/docs/templates" element={<DeveloperForgePage />} />
            <Route path="developer-forge/docs/compatibility" element={<DeveloperForgePage />} />
            <Route path="living-library" element={<LivingLibraryPage />} />
            <Route path="commune" element={<CommunePage />} />
            <Route path="commune/rooms/:roomSlug" element={<CommunePage />} />
            <Route path="commune/posts/:postId" element={<CommunePage />} />
            <Route path="commune/new" element={<CommunePage />} />
            <Route path="commune/repository-showcase" element={<CommunePage />} />
            <Route path="commune/troubleshooting" element={<CommunePage />} />
            <Route path="commune/sandbox-review" element={<CommunePage />} />
            <Route path="commune/moderation" element={<CommunePage />} />
            <Route path="work-with-elysia-ecobotics" element={<WorkWithPage />} />
            <Route path="commons-circle" element={<CommonsCirclePage />} />
            <Route path="commons-circle/saved-shelves" element={<SavedShelvesPage />} />
            <Route path="commons-circle/onboarding" element={<Navigate to="/commons-circle/setup/profile" replace />} />
            <Route path="commons-circle/setup/:step" element={<CommonsCircleSetupPage />} />
            <Route path="commons/@:username" element={<PublicCommonsProfilePage />} />
            <Route path="story" element={<StoryPage />} />
            <Route path="about" element={<AboutPage />} />
            <Route path="mission" element={<MissionPage />} />
            <Route path="legal" element={<LegalPage />} />
            <Route path="legal/:slug" element={<LegalPolicyPage />} />
            <Route path="admin" element={<AdminHomePage />} />
            <Route path="admin/review" element={<AdminReviewPage />} />
            <Route path="admin/review/work-with" element={<AdminReviewPage />} />
            <Route path="admin/review/stewardship" element={<AdminReviewPage />} />
            <Route path="admin/review/commune" element={<AdminReviewPage />} />
            <Route path="admin/review/living-library" element={<AdminReviewPage />} />
            <Route path="admin/review/marketplace" element={<AdminReviewPage />} />
            <Route path="admin/review/broken-links" element={<AdminReviewPage />} />
            <Route path="admin/roles" element={<AdminRolesPage />} />
            <Route path="admin/audit" element={<AdminAuditPage />} />
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
      </BrowserRouter>
    </AuthProvider>
  );
}
