import { Redirect, useLocalSearchParams } from "expo-router";
import {
  createAgreementParams,
  parseCreateAgreementEditOrigin,
  parseCreateAgreementEntry,
} from "@/lib/agreements/createAgreementNav";

function routeId(value: string | string[] | undefined): string | undefined {
  return Array.isArray(value) ? value[0] : value;
}

/** Legacy Parties route — Owners is now step 2 of 5. */
export default function PartiesStepRedirect() {
  const params = useLocalSearchParams<{
    agreementId?: string | string[];
    entry?: string | string[];
    fromPreview?: string | string[];
    fromReview?: string | string[];
  }>();
  const agreementId = routeId(params.agreementId);
  const entry = parseCreateAgreementEntry(params.entry);
  const editOrigin = parseCreateAgreementEditOrigin(params);

  return (
    <Redirect
      href={{
        pathname: "/(create-agreement)/owners",
        params: createAgreementParams(entry, agreementId, editOrigin),
      }}
    />
  );
}
