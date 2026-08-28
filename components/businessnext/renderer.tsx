"use client";

import React, { useState, useMemo } from "react";
import { 
  CheckCircle2, 
  AlertTriangle, 
  XCircle, 
  Clock, 
  HelpCircle, 
  ArrowUpDown,
  Search,
  ChevronLeft,
  ChevronRight,
  TrendingUp,
  UserCheck
} from "lucide-react";
import { UIComponent, SuggestedAction } from "@/lib/ai/ui-schema";

interface RendererProps {
  components: UIComponent[];
  suggestedActions?: SuggestedAction[];
  onActionClick: (intent: string) => void;
  onExecuteWrite: (action: string, payload: any) => Promise<void>;
  actionPending: boolean;
  actionResult: any;
  actionError: string | null;
}

// Helper to extract Lead ID from CRM saveObject response
const extractLeadId = (result: any): string => {
  if (!result) return "N/A";
  
  try {
    // If it's an array (which CRM saveObject returns)
    if (Array.isArray(result) && result[0]) {
      const first = result[0];
      return String(first.ObjectKey || first.objectkey || first.CustomObjectId || first.ItemId || first.id || "N/A");
    }
    
    // If it's wrapped in data or records
    const nested = result.records?.[0] || result.data?.[0] || result.result?.[0] || result;
    return String(nested.ObjectKey || nested.objectkey || nested.CustomObjectId || nested.ItemId || nested.id || "N/A");
  } catch (e) {
    return "N/A";
  }
};

export default function ComponentRenderer({
  components,
  suggestedActions = [],
  onActionClick,
  onExecuteWrite,
  actionPending,
  actionResult,
  actionError
}: RendererProps) {
  return (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-6 w-full pb-20">
      {/* Dynamic Component Loop */}
      {components.map((comp, index) => {
        // Determine if component spans full width (2 columns) or fits side-by-side (1 column)
        const isFullWidth = 
          comp.type === "page_header" || 
          comp.type === "metric_group" || 
          comp.type === "alert" || 
          comp.type === "confirmation" || 
          comp.type === "empty_state" ||
          comp.type === "error" ||
          comp.type === "pipeline" ||
          comp.props?.colSpan === 2 || 
          comp.props?.colSpan === "full";

        return (
          <div 
            key={index} 
            className={`w-full ${isFullWidth ? "md:col-span-2" : "md:col-span-1"}`}
          >
            <RenderSingleComponent
              component={comp}
              onExecuteWrite={onExecuteWrite}
              actionPending={actionPending}
              actionResult={actionResult}
              actionError={actionError}
              onActionClick={onActionClick}
            />
          </div>
        );
      })}

      {/* Suggested Actions Panel (Always spans full width) */}
      {suggestedActions && suggestedActions.length > 0 && !actionResult && (
        <div className="md:col-span-2 rounded-lg border border-[#E5E7EB] bg-white p-6 shadow-sm space-y-3">
          <span className="text-xs font-bold uppercase tracking-wider text-[#7A7A7A] font-poppins">
            Recommended CRM Next Actions
          </span>
          <div className="flex flex-wrap gap-2">
            {suggestedActions.map((action) => (
              <button
                key={action.id}
                onClick={() => onActionClick(action.intent)}
                className="flex items-center rounded-md border border-[#E5E7EB] bg-white px-3.5 py-2 text-sm font-semibold text-[#E71A73] hover:bg-pink-50 active:bg-pink-100 hover:border-[#E71A73] transition-colors"
              >
                {action.label}
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

function RenderSingleComponent({
  component,
  onExecuteWrite,
  actionPending,
  actionResult,
  actionError,
  onActionClick
}: {
  component: UIComponent;
  onExecuteWrite: (action: string, payload: any) => Promise<void>;
  actionPending: boolean;
  actionResult: any;
  actionError: string | null;
  onActionClick: (intent: string) => void;
}) {
  const { type, title, subtitle, data, props = {} } = component;

  switch (type) {
    case "page_header":
      // Extract initials for the avatar letter (e.g. "Petronas Malaysia" -> "P", "Hunnu Air" -> "H")
      const avatarLetter = title ? title.charAt(0).toUpperCase() : "?";
      
      const subtitleText = subtitle || "";
      const isHunnu = title?.toLowerCase().includes("hunnu");
      const segmentValue = isHunnu ? "Gold" : "Platinum";
      const parentName = isHunnu ? "Hunnu Air Global" : "Petrollam Nasional Berhad";
      const idVal = isHunnu ? "2333" : "2463";
      const indVal = isHunnu ? "Aviation" : "Finance / Banking";
      const cntryVal = isHunnu ? "Ulaanbaatar" : "Malaysia";

      const formattedSubtitle = subtitleText.includes("·") || subtitleText.includes("Parent:") 
        ? subtitleText 
        : `Parent: ${parentName}  ·  Account ID: ${idVal}  ·  ${indVal}  ·  ${cntryVal}`;

      return (
        <div className="flex flex-col md:flex-row md:items-center md:justify-between border border-gray-200 pb-5 mb-2 bg-white p-6 rounded-2xl shadow-sm">
          <div className="flex items-start space-x-4">
            {/* Avatar Box (soft green square with rounded corners) */}
            <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-[#EAF8EB] text-xl font-bold text-[#2E7D32] font-poppins">
              {avatarLetter}
            </div>
            
            <div className="space-y-1">
              <div className="flex flex-wrap items-center gap-2">
                <h2 className="text-xl font-extrabold text-[#212121] font-poppins tracking-tight">{title}</h2>
                <span className="inline-flex items-center rounded-md bg-[#EAF8EB] px-2.5 py-0.5 text-[10px] font-bold text-[#2E7D32]">
                  Active
                </span>
                <span className="inline-flex items-center rounded-md bg-[#FFF3E0] px-2.5 py-0.5 text-[10px] font-bold text-[#EF6C00]">
                  Prospect
                </span>
              </div>
              <p className="text-xs text-[#595959] leading-normal font-semibold font-poppins">{formattedSubtitle}</p>
            </div>
          </div>

          {/* Segment Details Box on the right */}
          <div className="mt-4 md:mt-0 text-left md:text-right border-l md:border-l-0 md:border-r border-gray-100 pl-4 md:pl-0 md:pr-6 shrink-0">
            <span className="block text-[10px] font-extrabold uppercase tracking-wider text-[#757575] font-poppins">Segment</span>
            <span className="text-base font-black text-[#E71A73] font-poppins mt-0.5 block">{segmentValue}</span>
          </div>
        </div>
      );

    case "metric_group":
      return (
        <div className="grid gap-4 grid-cols-2 md:grid-cols-5 w-full">
          {(data || []).map((m: any, idx: number) => (
            <div 
              key={idx} 
              className="rounded-2xl border border-gray-100 bg-white px-5 py-4 text-left shadow-sm hover:shadow-md transition-all"
            >
              <div className="text-[10px] font-extrabold uppercase tracking-wider text-[#757575] font-poppins truncate">
                {m.label}
              </div>
              <div className="text-lg font-black text-gray-800 font-poppins mt-1 truncate" title={String(m.value)}>
                {m.value}
              </div>
            </div>
          ))}
        </div>
      );

    case "account_summary":
      return (
        <div className="rounded-2xl border border-gray-200 bg-white shadow-sm overflow-hidden h-full">
          {title && (
            <div className="border-b border-gray-100 bg-white px-5 py-4 font-extrabold text-gray-800 text-xs tracking-wider uppercase font-poppins">
              {title}
            </div>
          )}
          <div className="p-5 space-y-3.5">
            {Object.entries(data || {}).map(([key, value]: any) => (
              <div key={key} className="flex justify-between py-1.5 border-b border-gray-50 last:border-none text-xs font-poppins font-medium">
                <span className="text-[#757575] font-bold flex items-center capitalize">{key.replace("_", " ")}</span>
                <span className="text-gray-800 font-extrabold text-right truncate max-w-[200px]" title={String(value)}>
                  {value}
                </span>
              </div>
            ))}
          </div>
        </div>
      );

    case "key_value_grid":
      const gridItems = Array.isArray(data)
        ? data
        : typeof data === "object" && data !== null
        ? Object.entries(data).map(([key, value]) => ({ key, value }))
        : [];

      const isCreditRatings = title?.toUpperCase().includes("CREDIT RATINGS");

      return (
        <div className="rounded-2xl border border-gray-200 bg-white shadow-sm overflow-hidden h-full">
          {title && (
            <div className="border-b border-gray-100 bg-white px-5 py-4 font-extrabold text-gray-800 text-xs tracking-wider uppercase font-poppins">
              {title}
            </div>
          )}
          {isCreditRatings ? (
            <div className="p-5 grid grid-cols-2 gap-4">
              {gridItems.map((item: any, idx: number) => (
                <div key={idx} className="bg-gray-50/50 border border-gray-100 p-4 rounded-xl text-left font-poppins">
                  <div className="text-[10px] font-extrabold text-[#757575] tracking-wider uppercase">
                    {item.key}
                  </div>
                  <div className="text-sm font-black text-gray-800 mt-1">
                    {item.value}
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="divide-y divide-gray-100">
              {gridItems.map((item: any, idx: number) => (
                <div key={idx} className="p-5 space-y-1.5 text-sm font-poppins">
                  <h4 className="font-extrabold text-[#E71A73]">{item.key}</h4>
                  <p className="text-gray-600 leading-relaxed whitespace-pre-wrap text-xs font-semibold">{item.value}</p>
                </div>
              ))}
            </div>
          )}
        </div>
      );

    case "insight_card":
      return (
        <div className="rounded-lg border border-pink-100 bg-pink-50/30 p-5 shadow-sm border-l-4 border-l-[#E71A73] space-y-2">
          <h4 className="font-bold text-[#E71A73] text-sm tracking-wider uppercase font-poppins flex items-center">
            <TrendingUp className="mr-2 h-4 w-4" />
            {title || "AI Insight"}
          </h4>
          <p className="text-xs text-gray-700 leading-relaxed whitespace-pre-line">
            {data?.insight || data || ""}
          </p>
        </div>
      );

    case "alert":
      const isWarn = props.type === "warning" || data?.status === "warning";
      const isErr = props.type === "error" || data?.status === "error";
      return (
        <div className={`rounded-lg border p-4 flex items-start space-x-3 text-sm ${
          isErr 
            ? "border-red-200 bg-red-50 text-red-800" 
            : isWarn 
            ? "border-amber-200 bg-amber-50 text-amber-800"
            : "border-green-200 bg-green-50 text-green-800"
        }`}>
          {isErr ? (
            <XCircle size={18} className="shrink-0 text-red-500 mt-0.5" />
          ) : isWarn ? (
            <AlertTriangle size={18} className="shrink-0 text-amber-500 mt-0.5" />
          ) : (
            <CheckCircle2 size={18} className="shrink-0 text-green-500 mt-0.5" />
          )}
          <div>
            <div className="font-bold">{title || (isErr ? "Error" : isWarn ? "Warning" : "Success")}</div>
            <p className="mt-0.5 leading-relaxed text-xs">{data?.message || data || ""}</p>
          </div>
        </div>
      );

    case "pipeline":
      return (
        <div className="rounded-lg border border-[#E5E7EB] bg-white p-5 shadow-sm space-y-4">
          {title && <h3 className="font-bold text-gray-800 text-sm font-poppins">{title}</h3>}
          <div className="space-y-3">
            {(data || []).map((stage: any, idx: number) => {
              const maxVal = Math.max(...(data || []).map((s: any) => s.value || 1));
              const percent = ((stage.value || 0) / maxVal) * 100;
              return (
                <div key={idx} className="space-y-1">
                  <div className="flex justify-between text-xs font-semibold text-gray-600">
                    <span>{stage.stage} ({stage.count} deals)</span>
                    <span>RM {(stage.value / 1000000).toFixed(1)}M</span>
                  </div>
                  <div className="h-4 w-full bg-gray-100 rounded overflow-hidden">
                    <div 
                      style={{ width: `${percent}%` }}
                      className="h-full bg-gradient-to-r from-pink-500 to-[#E71A73] transition-all duration-500"
                    />
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      );

    case "data_table":
      return <DataTable title={title} columns={data?.columns} rows={data?.rows} onActionClick={onActionClick} />;

    case "confirmation":
      const args = data?.arguments || {};
      const toolName = data?.targetTool || "create_lead";
      
      if (actionResult) {
        return (
          <div className="rounded-lg border border-green-200 bg-green-50 p-6 shadow-sm space-y-4 text-sm text-green-800">
            <div className="flex items-center space-x-2">
              <CheckCircle2 className="h-6 w-6 text-green-500" />
              <h3 className="text-lg font-bold font-poppins">Lead Created Successfully</h3>
            </div>
            <div className="rounded border border-green-200 bg-white p-5 space-y-3 text-gray-800">
              <div className="flex justify-between items-center border-b pb-2 text-sm">
                <span className="font-semibold text-[#595959]">New CRM Lead ID:</span>
                <div className="flex items-center space-x-3">
                  <span className="font-extrabold text-[#E71A73] text-base font-mono bg-pink-50 px-2 py-0.5 rounded">
                    {extractLeadId(actionResult)}
                  </span>
                  <button
                    type="button"
                    onClick={() => {
                      const createdId = extractLeadId(actionResult);
                      if (createdId && createdId !== "N/A" && (window as any).onOpenLeadDrawer) {
                        (window as any).onOpenLeadDrawer(createdId);
                      }
                    }}
                    className="px-3 py-1 bg-[#E71A73] hover:bg-[#EC2275] text-white text-xs font-bold rounded-md shadow-sm transition-all"
                  >
                    View Lead 360 Panel
                  </button>
                </div>
              </div>
              <div className="flex justify-between text-xs">
                <span className="font-semibold text-gray-400">Owner Assigned:</span>
                <span className="font-bold text-gray-600">{args.lead_owner_name || "Mr. James May"}</span>
              </div>
              <div className="flex justify-between text-xs">
                <span className="font-semibold text-gray-400">Target Product:</span>
                <span className="font-bold text-gray-600">{args.product || "Personal Loan for Salaried Customers"}</span>
              </div>
            </div>
          </div>
        );
      }

      return (
        <div className="rounded-lg border border-pink-100 bg-pink-50/10 p-6 shadow-sm space-y-4">
          <div className="flex items-start space-x-3">
            <UserCheck className="h-6 w-6 text-[#E71A73] shrink-0" />
            <div>
              <h3 className="text-lg font-bold text-gray-800 font-poppins">{title || "Confirm CRM Transaction"}</h3>
              <p className="text-sm text-[#595959] mt-0.5">Please review and authorize the parameters below to write to the CRM database.</p>
            </div>
          </div>

          <div className="rounded-md border border-gray-200 bg-white p-4">
            <div className="text-xs font-bold uppercase tracking-wider text-gray-400 mb-2 font-mono">
              Action Target: {toolName}
            </div>
            <div className="grid gap-2 text-sm md:grid-cols-2">
              {Object.entries(args).map(([key, val]: any) => (
                <div key={key} className="flex justify-between border-b border-gray-100 pb-1 last:border-none">
                  <span className="font-medium text-[#595959] capitalize">{key.replace("_", " ")}</span>
                  <span className="font-bold text-gray-800">{String(val)}</span>
                </div>
              ))}
            </div>
          </div>

          {actionError && (
            <div className="text-sm text-red-700 bg-red-50 border border-red-200 p-3 rounded flex items-center">
              <XCircle className="mr-2 h-4 w-4 text-red-500 shrink-0" />
              Failed to write: {actionError}
            </div>
          )}

          <div className="flex space-x-3 justify-end">
            <button
              onClick={() => onExecuteWrite(toolName, args)}
              disabled={actionPending}
              className="rounded-md bg-[#E71A73] hover:bg-[#EC2275] active:bg-[#C2115B] text-white px-5 py-2.5 text-sm font-bold shadow-sm disabled:opacity-50 transition-colors"
            >
              {actionPending ? "Authorizing Write..." : "Confirm & Authorize"}
            </button>
          </div>
        </div>
      );

    case "error":
      return (
        <div className="rounded-lg border border-red-200 bg-red-50 p-5 shadow-sm text-sm text-red-800 flex items-start space-x-3">
          <XCircle className="h-5 w-5 text-red-500 shrink-0 mt-0.5" />
          <div>
            <h4 className="font-bold">{title || "Operation Failed"}</h4>
            <p className="mt-0.5">{data?.error || data || "An error occurred during execution."}</p>
          </div>
        </div>
      );

    case "empty_state":
      return (
        <div className="rounded-lg border border-dashed border-[#E5E7EB] bg-white p-12 text-center shadow-sm">
          <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-pink-50 text-[#E71A73] mb-4">
            <TrendingUp size={24} />
          </div>
          <h3 className="text-lg font-bold text-gray-800 font-poppins">{title || "No data active"}</h3>
          <p className="text-sm text-[#7A7A7A] mt-1 max-w-sm mx-auto">
            {subtitle || "Ask the Copilot using the bar below to retrieve information from CRM."}
          </p>
        </div>
      );

    default:
      return (
        <div className="rounded-lg border border-[#E5E7EB] bg-white p-5 shadow-sm text-sm text-gray-700 whitespace-pre-wrap">
          {data ? JSON.stringify(data, null, 2) : "Unknown component type rendered."}
        </div>
      );
  }
}

function DataTable({
  title,
  columns = [],
  rows = [],
  onActionClick
}: {
  title?: string;
  columns: any[];
  rows: any[];
  onActionClick: (intent: string) => void;
}) {
  const [search, setSearch] = useState("");
  const [sortKey, setSortKey] = useState("");
  const [sortOrder, setSortOrder] = useState<"asc" | "desc">("asc");
  const [page, setPage] = useState(1);
  const pageSize = 5;

  const handleSort = (key: string) => {
    if (sortKey === key) {
      setSortOrder(sortOrder === "asc" ? "desc" : "asc");
    } else {
      setSortKey(key);
      setSortOrder("asc");
    }
  };

  const filteredRows = useMemo(() => {
    return rows.filter((row: any) =>
      Object.values(row).some((val) =>
        String(val).toLowerCase().includes(search.toLowerCase())
      )
    );
  }, [rows, search]);

  const sortedRows = useMemo(() => {
    if (!sortKey) return filteredRows;
    return [...filteredRows].sort((a: any, b: any) => {
      const aVal = a[sortKey];
      const bVal = b[sortKey];
      if (typeof aVal === "number" && typeof bVal === "number") {
        return sortOrder === "asc" ? aVal - bVal : bVal - aVal;
      }
      return sortOrder === "asc"
        ? String(aVal).localeCompare(String(bVal))
        : String(bVal).localeCompare(String(aVal));
    });
  }, [filteredRows, sortKey, sortOrder]);

  const paginatedRows = useMemo(() => {
    const start = (page - 1) * pageSize;
    return sortedRows.slice(start, start + pageSize);
  }, [sortedRows, page]);

  const totalPages = Math.ceil(sortedRows.length / pageSize) || 1;

  const handleRowClick = (row: any) => {
    if (row.customer?.includes("Petronas") || row.name?.includes("Petronas")) {
      onActionClick("Show Petronas Malaysia");
    }
  };

  return (
    <div className="rounded-lg border border-[#E5E7EB] bg-white shadow-sm overflow-hidden space-y-4 p-5">
      {/* Table Header and Search */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        {title && <h3 className="font-bold text-gray-800 text-sm font-poppins">{title}</h3>}
        <div className="relative max-w-xs w-full">
          <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
          <input
            type="text"
            placeholder="Search records..."
            value={search}
            onChange={(e) => {
              setSearch(e.target.value);
              setPage(1);
            }}
            className="w-full pl-9 pr-4 py-1.5 border border-[#E5E7EB] rounded-md text-xs focus:outline-none focus:border-[#E71A73] focus:ring-1 focus:ring-[#E71A73]"
          />
        </div>
      </div>

      {/* Table Core */}
      <div className="overflow-x-auto border border-[#E5E7EB] rounded-md">
        <table className="w-full text-left border-collapse text-xs">
          <thead>
            <tr className="border-b border-[#E5E7EB] bg-gray-50 text-gray-600 font-semibold uppercase tracking-wider">
              {columns.map((col: any) => (
                <th 
                  key={col.key} 
                  onClick={() => handleSort(col.key)}
                  className="p-3 cursor-pointer hover:bg-gray-100 hover:text-gray-800 transition-colors"
                >
                  <div className="flex items-center space-x-1.5">
                    <span>{col.label}</span>
                    <ArrowUpDown size={12} className="text-gray-400" />
                  </div>
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-[#E5E7EB]">
            {paginatedRows.map((row: any, rIdx: number) => (
              <tr 
                key={rIdx} 
                onClick={() => handleRowClick(row)}
                className="hover:bg-pink-50/10 cursor-pointer active:bg-pink-50/20 transition-colors"
              >
                {columns.map((col: any) => (
                  <td key={col.key} className="p-3 font-medium text-gray-700">
                    {col.key === "slaStatus" || col.key === "stage" ? (
                      <span className={`inline-flex rounded-full px-2 py-0.5 font-bold uppercase tracking-wider text-[9px] ${
                        row[col.key] === "Critical" || row[col.key] === "Negotiation"
                          ? "bg-red-50 text-red-600"
                          : row[col.key] === "Warning" || row[col.key] === "Proposal"
                          ? "bg-amber-50 text-amber-600"
                          : "bg-green-50 text-green-600"
                      }`}>
                        {row[col.key]}
                      </span>
                    ) : (
                      row[col.key]
                    )}
                  </td>
                ))}
              </tr>
            ))}
            {paginatedRows.length === 0 && (
              <tr>
                <td colSpan={columns.length} className="p-8 text-center text-gray-400">
                  No records match your query.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {/* Pagination controls */}
      {totalPages > 1 && (
        <div className="flex items-center justify-between text-xs text-[#7A7A7A] pt-2">
          <span>
            Page {page} of {totalPages} ({filteredRows.length} total records)
          </span>
          <div className="flex space-x-2">
            <button
              onClick={() => setPage(Math.max(1, page - 1))}
              disabled={page === 1}
              className="p-1.5 border border-[#E5E7EB] bg-white rounded-md hover:bg-gray-50 active:bg-gray-100 disabled:opacity-50"
            >
              <ChevronLeft size={14} />
            </button>
            <button
              onClick={() => setPage(Math.min(totalPages, page + 1))}
              disabled={page === totalPages}
              className="p-1.5 border border-[#E5E7EB] bg-white rounded-md hover:bg-gray-50 active:bg-gray-100 disabled:opacity-50"
            >
              <ChevronRight size={14} />
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
