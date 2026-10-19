import { Route, Switch } from "wouter";
import { MarketingAuthModalProvider } from "@/components/auth/MarketingAuthModalContext";
import { useMarketingScrollToTop } from "@/hooks/useMarketingScrollToTop";
import { BrokersPage } from "@/pages/BrokersPage";
import { HomePage } from "@/pages/HomePage";
import { ExistingAccountPage } from "@/pages/ExistingAccountPage";
import { MarketingSignupRolePage } from "@/pages/MarketingSignupRolePage";
import { MarketingOwnerSignupPage } from "@/pages/MarketingOwnerSignupPage";
import { MarketingBrokerSignupPage } from "@/pages/MarketingBrokerSignupPage";
import { TermsPage } from "@/pages/TermsPage";
import { AboutPage } from "@/pages/AboutPage";
import { ContactPage } from "@/pages/ContactPage";
import { FaqsPage } from "@/pages/FaqsPage";
import { PrivacyPage } from "@/pages/PrivacyPage";
import { DeleteAccountPage } from "@/pages/DeleteAccountPage";

function MarketingScrollToTop() {
  useMarketingScrollToTop();
  return null;
}

export default function App() {
  return (
    <MarketingAuthModalProvider>
      <MarketingScrollToTop />
      <Switch>
        <Route path="/" component={HomePage} />
        <Route path="/for-brokers" component={BrokersPage} />
        <Route path="/login/existing/mock">
          <ExistingAccountPage mock />
        </Route>
        <Route path="/login/existing">
          <ExistingAccountPage />
        </Route>
        <Route path="/signup/role/mock">
          <MarketingSignupRolePage mock />
        </Route>
        <Route path="/signup/role">
          <MarketingSignupRolePage />
        </Route>
        <Route path="/signup/owner/mock">
          <MarketingOwnerSignupPage mock />
        </Route>
        <Route path="/signup/owner">
          <MarketingOwnerSignupPage />
        </Route>
        <Route path="/signup/broker/mock">
          <MarketingBrokerSignupPage mock />
        </Route>
        <Route path="/signup/broker">
          <MarketingBrokerSignupPage />
        </Route>
        <Route path="/contact-us" component={ContactPage} />
        <Route path="/terms-and-conditions" component={TermsPage} />
        <Route path="/about-us" component={AboutPage} />
        <Route path="/faqs" component={FaqsPage} />
        <Route path="/privacy-policy" component={PrivacyPage} />
        <Route path="/delete-account" component={DeleteAccountPage} />
        <Route>
          <HomePage />
        </Route>
      </Switch>
    </MarketingAuthModalProvider>
  );
}
