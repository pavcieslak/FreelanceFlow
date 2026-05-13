interface PageShellProps {
  title: string;
  action?: React.ReactNode;
  children: React.ReactNode;
}

export default function PageShell({ title, action, children }: PageShellProps) {
  return (
    <div className="flex-1 flex flex-col min-h-0 overflow-y-auto">
      <div className="flex items-center justify-between px-4 md:px-6 py-4 border-b border-border shrink-0">
        <h1 className="text-xl font-semibold text-text-primary">{title}</h1>
        {action && <div>{action}</div>}
      </div>
      <div className="flex-1 px-4 md:px-6 py-4 pb-24 md:pb-4">{children}</div>
    </div>
  );
}
