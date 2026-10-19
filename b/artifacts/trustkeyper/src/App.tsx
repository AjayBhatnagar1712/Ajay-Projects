import { useState } from "react";
import { Switch, Route, Router as WouterRouter, useLocation } from "wouter";
import { FeedbackButton, FeedbackModal } from "@/components/feedback";
import { SpeedInsights } from "@vercel/speed-insights/react";
import { QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { AppAuthEntryRedirect } from "@/components/AppAuthEntryRedirect";
import { MarketingHandoffGate } from "@/components/MarketingHandoffGate";
import SharedProperty from "@/pages/SharedProperty";
import Onboarding from "@/pages/Onboarding";
import Login from "@/pages/Login";
import LoginDirect from "@/pages/LoginDirect";
import BrokerDashboard from "@/pages/BrokerDashboard";
import BrokerProperties from "@/pages/BrokerProperties";
import BrokerTenants from "@/pages/BrokerTenants";
import BrokerTenantInvite from "@/pages/BrokerTenantInvite";
import TenantBrokerOnboarding from "@/pages/TenantBrokerOnboarding";
import TenantDocumentUpload from "@/pages/TenantDocumentUpload";
import TenantOnboardLegacyRedirect from "@/pages/TenantOnboardLegacyRedirect";
import LeaseAgreementReviewPage from "@/pages/LeaseAgreementReviewPage";
import TenantDashboard from "@/pages/TenantDashboard";
import TenantRentPayments from "@/pages/tenant/TenantRentPayments";
import TenantMaintenance from "@/pages/tenant/TenantMaintenance";
import TenantDocuments from "@/pages/tenant/TenantDocuments";
import TenantPaymentsRedirect from "@/pages/tenant/TenantPaymentsRedirect";
import TenantContact from "@/pages/tenant/TenantContact";
import TenantProfile from "@/pages/tenant/TenantProfile";
import TenantSettings from "@/pages/tenant/TenantSettings";
import TenantAgreementReview from "@/pages/tenant/TenantAgreementReview";
import TenantUploadSignedAgreement from "@/pages/tenant/TenantUploadSignedAgreement";
import BrokerDeals from "@/pages/BrokerDeals";
import BrokerCommission from "@/pages/BrokerCommission";
import BrokerDocuments from "@/pages/BrokerDocuments";
import AddTenant from "@/pages/AddTenant";
import BrokerPropertyAddRoute from "@/pages/BrokerPropertyAddRoute";
import PropertyDetails from "@/pages/PropertyDetails";
import GenerateAgreement from "@/pages/GenerateAgreement";
import AddProperty2 from "@/pages/AddProperty2";
import BrokerSettings from "@/pages/BrokerProfile";
import BrokerActivity from "@/pages/BrokerActivity";
import OwnerAddProperty from "@/pages/OwnerAddProperty";
import OwnerAddProperty2 from "@/pages/OwnerAddProperty2";
import OwnerDashboard from "@/pages/OwnerDashboard";
import OwnerProperties from "@/pages/OwnerProperties";
import OwnerPropertyDetails from "@/pages/OwnerPropertyDetails";
import OwnerTenants from "@/pages/OwnerTenants";
import OwnerTenantProfile from "@/pages/OwnerTenantProfile";
import OwnerTickets from "@/pages/OwnerTickets";
import OwnerAgreements from "@/pages/OwnerAgreements";
import OwnerUploadSignedAgreement from "@/pages/owner/OwnerUploadSignedAgreement";
import OwnerPaymentSetup from "@/pages/owner/OwnerPaymentSetup";
import OwnerFinances from "@/pages/OwnerFinances";
import OwnerProfile from "@/pages/OwnerProfile";
import AdminLogin from "@/pages/admin/AdminLogin";
import AdminDashboard from "@/pages/admin/AdminDashboard";
import AdminUsers from "@/pages/admin/AdminUsers";
import AdminProperties from "@/pages/admin/AdminProperties";
import AdminAgreements from "@/pages/admin/AdminAgreements";
import AdminAgreementDetail from "@/pages/admin/AdminAgreementDetail";
import AdminFeedback from "@/pages/admin/AdminFeedback";
import NotFound from "@/pages/not-found";
import Terms from "@/pages/Terms";
import Privacy from "@/pages/Privacy";
import { createAdminQueryClient } from "@/hooks/useAdminData";

const queryClient = createAdminQueryClient();

/**
 * Renders the floating feedback widget on authenticated user-facing routes.
 * @returns Feedback button and modal, or null on excluded routes.
 */
function FeedbackWidget() {
  const [location] = useLocation();
  const [open, setOpen] = useState(false);

  if (
    location === "/" ||
    location === "/login" ||
    location.startsWith("/admin") ||
    location.startsWith("/share/") ||
    location.startsWith("/review/") ||
    location.startsWith("/onboard/") ||
    location.startsWith("/upload/")
  ) {
    return null;
  }

  return (
    <>
      <FeedbackButton onClick={() => setOpen(true)} />
      <FeedbackModal open={open} onOpenChange={setOpen} />
    </>
  );
}

function Router() {
  return (
    <>
    <Switch>
      <Route path="/share/property/:id" component={SharedProperty} />
      <Route path="/review/:token" component={LeaseAgreementReviewPage} />
      <Route path="/tenant/onboard/:token" component={TenantOnboardLegacyRedirect} />
      <Route path="/onboard/tenant/:token" component={TenantBrokerOnboarding} />
      <Route path="/upload/documents/:token" component={TenantDocumentUpload} />
      <Route path="/tenant/dashboard" component={TenantDashboard} />
      <Route path="/tenant/rent" component={TenantRentPayments} />
      <Route path="/tenant/payments" component={TenantPaymentsRedirect} />
      <Route path="/tenant/maintenance" component={TenantMaintenance} />
      <Route path="/tenant/documents" component={TenantDocuments} />
      <Route path="/tenant/agreement" component={TenantAgreementReview} />
      <Route path="/tenant/agreement/upload-signed" component={TenantUploadSignedAgreement} />
      <Route path="/tenant/contact" component={TenantContact} />
      <Route path="/tenant/profile" component={TenantProfile} />
      <Route path="/tenant/settings" component={TenantSettings} />
      <Route path="/login">
        <AppAuthEntryRedirect mode="login">
          <Login />
        </AppAuthEntryRedirect>
      </Route>
      <Route path="/terms" component={Terms} />
      <Route path="/privacy" component={Privacy} />
      {/* Role-card login — not linked in UI; enable navigation when needed */}
      <Route path="/Logindirect" component={LoginDirect} />
      <Route path="/">
        <AppAuthEntryRedirect mode="signup">
          <Onboarding />
        </AppAuthEntryRedirect>
      </Route>
      <Route path="/owner/properties/add" component={OwnerAddProperty} />
      <Route path="/owner/properties/add2" component={OwnerAddProperty2} />
      <Route path="/owner/dashboard" component={OwnerDashboard} />
      <Route path="/owner/payments" component={OwnerPaymentSetup} />
      <Route path="/owner/properties" component={OwnerProperties} />
      <Route path="/owner/properties/:id" component={OwnerPropertyDetails} />
      <Route path="/owner/tenants" component={OwnerTenants} />
      <Route path="/owner/tenants/:id" component={OwnerTenantProfile} />
      <Route path="/owner/tickets" component={OwnerTickets} />
      <Route path="/owner/agreements" component={OwnerAgreements} />
      <Route path="/owner/agreements/generate" component={GenerateAgreement} />
      <Route path="/owner/agreements/:agreementId/upload-signed" component={OwnerUploadSignedAgreement} />
      <Route path="/owner/finances" component={OwnerFinances} />
      <Route path="/owner/profile" component={OwnerProfile} />
      <Route path="/broker/dashboard" component={BrokerDashboard} />
      <Route path="/broker/properties" component={BrokerProperties} />
      <Route path="/broker/properties/add" component={BrokerPropertyAddRoute} />
      <Route path="/broker/properties/add2" component={AddProperty2} />
      <Route path="/broker/properties/:id" component={PropertyDetails} />
      <Route path="/broker/agreements/generate" component={GenerateAgreement} />
      <Route path="/broker/tenants" component={BrokerTenants} />
      <Route path="/broker/tenants/invite" component={BrokerTenantInvite} />
      <Route path="/broker/tenants/add" component={AddTenant} />
      <Route path="/broker/deals" component={BrokerDeals} />
      <Route path="/broker/commission" component={BrokerCommission} />
      <Route path="/broker/documents" component={BrokerDocuments} />
      <Route path="/broker/settings" component={BrokerSettings} />
      <Route path="/broker/profile" component={BrokerSettings} />
      <Route path="/broker/activity" component={BrokerActivity} />
      <Route path="/admin/login" component={AdminLogin} />
      <Route path="/admin/dashboard" component={AdminDashboard} />
      <Route path="/admin/users" component={AdminUsers} />
      <Route path="/admin/properties" component={AdminProperties} />
      <Route path="/admin/agreements/:id" component={AdminAgreementDetail} />
      <Route path="/admin/agreements" component={AdminAgreements} />
      <Route path="/admin/feedback" component={AdminFeedback} />
      <Route component={NotFound} />
    </Switch>
    <FeedbackWidget />
    </>
  );
}

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
        <MarketingHandoffGate>
          <WouterRouter base={import.meta.env.BASE_URL.replace(/\/$/, "")}>
            <Router />
          </WouterRouter>
        </MarketingHandoffGate>
        <Toaster />
        <SpeedInsights />
      </TooltipProvider>
    </QueryClientProvider>
  );
}

export default App;
