export default function ProductSectionPlaceholder({
  params,
}: {
  params: { slug: string };
}) {
  return (
    <div className="min-w-0 rounded-[14px] border border-slate-100 bg-white p-8 shadow-[0_2px_12px_rgba(15,23,42,0.06)] sm:p-10">
      <p className="text-sm leading-relaxed text-slate-600">
        This area will connect to catalog and orders next.{" "}
        <span className="sr-only">Section: {params.slug.replace(/-/g, " ")}.</span>
      </p>
    </div>
  );
}
