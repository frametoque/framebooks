import React from "react";

export function Table({ children, className = "" }: { children: React.ReactNode; className?: string }) {
  return (
    <div className={`bg-card backdrop-blur-xl border border-border rounded-3xl overflow-hidden ${className}`}>
      <div className="overflow-x-auto w-full">
        <table className="w-full text-left border-collapse">
          {children}
        </table>
      </div>
    </div>
  );
}

export function TableHeader({ children, className = "" }: { children: React.ReactNode; className?: string }) {
  return (
    <thead className={`${className}`}>
      <tr className="border-b border-border text-gray-400 text-sm">
        {children}
      </tr>
    </thead>
  );
}

export function TableBody({ children, className = "" }: { children: React.ReactNode; className?: string }) {
  return (
    <tbody className={`divide-y divide-white/5 ${className}`}>
      {children}
    </tbody>
  );
}

export function TableRow({ children, className = "", onClick }: { children: React.ReactNode; className?: string; onClick?: () => void }) {
  return (
    <tr 
      onClick={onClick}
      className={`hover:bg-card transition-colors group ${onClick ? 'cursor-pointer' : ''} ${className}`}
    >
      {children}
    </tr>
  );
}

export function TableHead({ children, className = "", style }: { children: React.ReactNode; className?: string; style?: React.CSSProperties }) {
  return (
    <th className={`p-4 font-medium ${className}`} style={style}>
      {children}
    </th>
  );
}

export function TableCell({ children, className = "", colSpan }: { children: React.ReactNode; className?: string; colSpan?: number }) {
  return (
    <td className={`p-4 ${className}`} colSpan={colSpan}>
      {children}
    </td>
  );
}
