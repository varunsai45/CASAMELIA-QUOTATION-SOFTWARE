import QuoteEditor from "@/components/QuoteEditor";
export default async function EditQuotation({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  return <QuoteEditor id={Number(id)} />;
}
