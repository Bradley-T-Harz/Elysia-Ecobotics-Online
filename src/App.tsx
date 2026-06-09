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
import CommonsCircleOnboardingPage from "./pages/The-Commons-Circle/CommonsCircleOnboardingPage";
import StoryPage from "./pages/The-Story-of-Elysia";
import AboutPage from "./pages/About-Elysia-Ecobotics";
import MissionPage from "./pages/The-Elysia-Mission";

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
            <Route path="living-library" element={<LivingLibraryPage />} />
            <Route path="commune" element={<CommunePage />} />
            <Route path="work-with-elysia-ecobotics" element={<WorkWithPage />} />
            <Route path="commons-circle" element={<CommonsCirclePage />} />
            <Route path="commons-circle/onboarding" element={<CommonsCircleOnboardingPage />} />
            <Route path="story" element={<StoryPage />} />
            <Route path="about" element={<AboutPage />} />
            <Route path="mission" element={<MissionPage />} />
            <Route path="browse" element={<Navigate to="/marketplace/browse" replace />} />
            <Route path="addons/:id" element={<LegacyAddonAlias />} />
            <Route path="action-preview" element={<LegacySearchAlias target="/marketplace/action-preview" />} />
            <Route path="account" element={<Navigate to="/marketplace/account" replace />} />
            <Route path="submit" element={<Navigate to="/marketplace/submit" replace />} />
            <Route path="trust" element={<Navigate to="/marketplace/trust" replace />} />
            <Route path="manifest-api" element={<Navigate to="/marketplace/manifest-api" replace />} />
            <Route path="admin" element={<Navigate to="/marketplace/admin" replace />} />
            <Route path="*" element={<Navigate to="/" replace />} />
          </Route>
        </Routes>
      </BrowserRouter>
    </AuthProvider>
  );
}
