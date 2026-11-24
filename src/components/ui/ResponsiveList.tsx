/*
  ResponsiveList — one component, two layouts:
  • md and up (tablets, desktops): a proper <table> with column headers.
  • below md (phones): a stacked list, one row/card per record, drawn by
    your `renderRow` function (usually a <ListRow>).

  Both versions get the same `rows`, so the data and logic stay in one place.
  The one that doesn't fit the screen is hidden with CSS (display:none), which
  also hides it from screen readers, so nothing is announced twice.

  It has no "use client", so it works from Server Components and Client
  Components alike. (Keep element ids out of cells, because each row is
  rendered twice.)

  Usage:
    <ResponsiveList
      caption="Employees"
      rows={employees}
      getKey={(e) => e.id}
      columns={[
        { key: "name", header: "Name", cell: (e) => e.name },
        { key: "salary", header: "Salary", align: "right", cell: (e) => formatMoney(e.salary) },
      ]}
      renderRow={(e) => <ListRow title={e.name} subtitle={e.role} />}
      empty={<EmptyState title="No employees yet" />}
    />
*/
export type Column<T> = {
  key: string;
  header: React.ReactNode;
  cell: (row: T, index: number) => React.ReactNode;
  align?: "left" | "right" | "center";
  className?: string; // applied to every <td> in this column
  headerClassName?: string;
  srOnlyHeader?: boolean; // e.g. an "Actions" column with no visible title
};

const ALIGN = { left: "text-left", right: "text-right", center: "text-center" } as const;

export default function ResponsiveList<T>({
  rows,
  columns,
  getKey,
  renderRow,
  caption,
  empty,
  rowClassName,
  listClassName = "",
  tableClassName = "",
  inset = false,
}: {
  rows: T[];
  columns: Column<T>[];
  getKey: (row: T) => string;
  renderRow: (row: T, index: number) => React.ReactNode;
  caption: string; // read by screen readers to name the table
  empty?: React.ReactNode;
  rowClassName?: (row: T) => string;
  listClassName?: string;
  tableClassName?: string;
  // true when the table sits inside a bordered card: keeps side padding on
  // the first/last columns so text doesn't touch the card's edge.
  inset?: boolean;
}) {
  const edge = inset ? "" : "first:pl-0 last:pr-0";
  if (rows.length === 0) return <>{empty ?? null}</>;

  return (
    <>
      {/* Phones: stacked rows */}
      <ul aria-label={caption} className={`divide-y divide-border md:hidden ${listClassName}`}>
        {rows.map((row, i) => (
          <li key={getKey(row)} className="min-w-0">
            {renderRow(row, i)}
          </li>
        ))}
      </ul>

      {/* Tablets & desktops: a real table. The wrapper only scrolls if a
          very wide table meets a narrow tablet; the page itself never does. */}
      <div className={`hidden min-w-0 overflow-x-auto md:block ${tableClassName}`}>
        <table className="w-full border-collapse text-body-md">
          <caption className="sr-only">{caption}</caption>
          <thead>
            <tr className="border-b border-border">
              {columns.map((c) => (
                <th
                  key={c.key}
                  scope="col"
                  className={`whitespace-nowrap px-4 py-3 text-eyebrow uppercase text-ink-muted ${edge} ${ALIGN[c.align ?? "left"]} ${
                    c.headerClassName ?? ""
                  }`}
                >
                  {c.srOnlyHeader ? <span className="sr-only">{c.header}</span> : c.header}
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {rows.map((row, i) => (
              <tr key={getKey(row)} className={`transition-colors hover:bg-surface-2 ${rowClassName?.(row) ?? ""}`}>
                {columns.map((c) => (
                  <td key={c.key} className={`px-4 py-3 align-middle ${edge} ${ALIGN[c.align ?? "left"]} ${c.className ?? ""}`}>
                    {c.cell(row, i)}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </>
  );
}
