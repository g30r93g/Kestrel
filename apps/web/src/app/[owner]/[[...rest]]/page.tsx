import { resolveNav } from "@/lib/nav-tree";

export default async function DashboardPage({
  params,
}: {
  params: Promise<{ owner: string; rest?: string[] }>;
}) {
  const { owner, rest } = await params;
  const model = resolveNav(owner, rest ?? []);
  const here = model.header?.label ?? (model.context === "repo" ? (rest?.[0] ?? owner) : owner);

  return (
    <div className="rounded-lg border border-dashed p-8 text-sm text-muted-foreground">
      <div className="font-medium text-foreground">{here}</div>
      <div className="mt-1">
        Context: {model.context} · path: /{[owner, ...(rest ?? [])].join("/")}
      </div>
      <div className="mt-1">Content for this view lands in a later slice.</div>
    </div>
  );
}
