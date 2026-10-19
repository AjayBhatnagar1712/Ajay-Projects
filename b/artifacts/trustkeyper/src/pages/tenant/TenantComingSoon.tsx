import TenantLayout from "@/components/TenantLayout";

interface TenantComingSoonProps {
  title: string;
  description: string;
}

export function TenantComingSoon({ title, description }: TenantComingSoonProps) {
  return (
    <TenantLayout>
      <div className="max-w-2xl mx-auto rounded-2xl border border-dashed border-gray-200 bg-white p-8 sm:p-10 text-center">
        <h1 className="text-xl font-semibold text-gray-900 mb-2">{title}</h1>
        <p className="text-sm text-gray-500">{description}</p>
      </div>
    </TenantLayout>
  );
}
