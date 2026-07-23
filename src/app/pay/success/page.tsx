import { CheckCircle2, XCircle } from "lucide-react";

export default async function PaySuccessPage({
  searchParams,
}: {
  searchParams: Promise<{ canceled?: string }>;
}) {
  const { canceled: canceledParam } = await searchParams;
  const canceled = canceledParam === "1";

  return (
    <div className="min-h-screen flex items-center justify-center bg-background px-4">
      <div className="w-full max-w-sm text-center bg-surface border border-border rounded-lg p-8">
        {canceled ? (
          <>
            <XCircle size={48} className="mx-auto text-text-muted mb-4" />
            <h1 className="text-xl font-semibold text-text-primary mb-2">
              Payment canceled
            </h1>
            <p className="text-text-muted text-sm">
              No charge was made. You can close this window and try again from
              the invoice email.
            </p>
          </>
        ) : (
          <>
            <CheckCircle2 size={48} className="mx-auto text-accent mb-4" />
            <h1 className="text-xl font-semibold text-text-primary mb-2">
              Payment received
            </h1>
            <p className="text-text-muted text-sm">
              Thank you! Your payment has been processed and the invoice will be
              marked as paid. You can close this window.
            </p>
          </>
        )}
      </div>
    </div>
  );
}
