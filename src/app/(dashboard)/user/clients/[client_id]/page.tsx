"use client";
import { Loader } from "@/components/ui/Loader";


import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import { getClientById } from "../../actions/actions";
import { Building, Globe, Receipt, Loader2, Banknote } from "lucide-react";
import { MdArrowBack, MdMailOutline, MdPhone, MdLocationOn, MdInsertDriveFile, MdKeyboardArrowRight } from "react-icons/md";
import Link from "next/link";
import ClientAvatar from "@/components/ClientAvatar";

const formatLKR = (amount: number) => {
  const num = new Intl.NumberFormat('en-LK', {
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(amount || 0);
  return `${num} LKR`;
};

export default function ClientProfilePage() {
  const { client_id } = useParams();
  const [client, setClient] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function load() {
      if (!client_id) return;
      try {
        const data = await getClientById(client_id as string);
        setClient(data);
      } catch (err) {
        console.error("Failed to load client", err);
      } finally {
        setLoading(false);
      }
    }
    load();
  }, [client_id]);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64 text-brand-400">
        <Loader size="sm" />
      </div>
    );
  }

  if (!client) {
    return (
      <div className="p-8 text-center text-gray-400">
        <p className="mb-4">Client not found.</p>
        <Link href="/user/clients" className="text-brand-400 hover:text-brand-300">
          ← Back to Clients
        </Link>
      </div>
    );
  }

  const orders: any[] = client.orders ?? client.invoices ?? [];

  return (
    <div className="space-y-4">
      <Link href="/user/clients" className="inline-flex items-center gap-2 text-sm text-gray-400 hover:text-foreground transition-colors">
        <MdArrowBack className="w-4 h-4" />
        Back to Clients
      </Link>

      {/* Client Profile Banner */}
      <div className="bg-transparent border border-border rounded-3xl p-8 relative overflow-hidden">
        <div className="absolute top-0 right-0 w-64 h-64 bg-white/10 rounded-full blur-3xl -translate-y-1/2 translate-x-1/2 pointer-events-none"></div>

        <div className="flex flex-col md:flex-row gap-8 items-start md:items-center relative z-10">
          <ClientAvatar
            imageUrl={client.imageUrl}
            email={client.email}
            name={client.name}
            className="w-24 h-24 rounded-full object-cover border-4 border-border flex-shrink-0"
            fallbackClassName="w-24 h-24 rounded-full bg-gradient-to-br from-brand-600 to-brand-800 flex items-center justify-center text-foreground font-bold text-3xl border-4 border-border flex-shrink-0"
          />

          <div className="flex-1 space-y-2">
            <div className="flex items-center gap-3">
              <h1 className="text-3xl font-bold text-foreground">{client.name}</h1>
              {client.active ? (
                <span className="px-3 py-1 bg-green-500/20 text-green-400 text-xs font-semibold rounded-full border border-green-500/30">Active</span>
              ) : (
                <span className="px-3 py-1 bg-gray-500/20 text-gray-400 text-xs font-semibold rounded-full border border-gray-500/30">Inactive</span>
              )}
            </div>

            <div className="flex flex-wrap gap-x-6 gap-y-2 text-sm text-gray-400 mt-2">
              <div className="flex items-center gap-2">
                <MdMailOutline className="w-4 h-4 text-foreground" />
                <a href={`mailto:${client.email}`} className="hover:text-foreground transition-colors">{client.email}</a>
              </div>
              {client.phone && (
                <div className="flex items-center gap-2">
                  <MdPhone className="w-4 h-4 text-foreground" />
                  <a href={`tel:${client.phone}`} className="hover:text-foreground transition-colors">{client.phone}</a>
                </div>
              )}
              {client.company && (
                <div className="flex items-center gap-2">
                  <Building className="w-4 h-4 text-foreground" />
                  <span className="text-foreground">{client.company}</span>
                </div>
              )}
              {client.website && (
                <div className="flex items-center gap-2">
                  <Globe className="w-4 h-4 text-foreground" />
                  <a href={client.website.startsWith('http') ? client.website : `https://${client.website}`} target="_blank" rel="noreferrer" className="hover:text-foreground transition-colors">{client.website}</a>
                </div>
              )}
            </div>
            {client.address && (
              <div className="flex items-center gap-2 text-sm text-gray-400 mt-2">
                <MdLocationOn className="w-4 h-4 text-foreground flex-shrink-0" />
                <span>{client.address}</span>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Orders / Invoices Table */}
      <div className="bg-transparent border border-border rounded-3xl overflow-hidden">
        <div className="p-6 border-b border-border flex items-center gap-3">
          <div className="p-2 text-foreground flex shrink-0">
            <Receipt className="w-5 h-5 text-foreground" />
          </div>
          <h2 className="text-xl font-semibold">Order History</h2>
          <span className="ml-auto text-sm text-gray-400">{orders.length} record{orders.length !== 1 ? 's' : ''}</span>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="border-b border-border text-gray-400 text-sm">
                <th className="p-4 font-medium">ID</th>
                <th className="p-4 font-medium">Type</th>
                <th className="p-4 font-medium">Project / Service</th>
                <th className="p-4 font-medium">Amount</th>
                <th className="p-4 font-medium">Date</th>
                <th className="p-4 font-medium">Status</th>
                <th className="p-4 font-medium text-right">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-white/5">
              {orders.map((order: any) => (
                <tr key={order.id} className="hover:bg-card transition-colors">
                  <td className="p-4 font-medium text-foreground">
                    <div className="flex items-center gap-2">
                      {order.type === 'invoice' ? (
                        <MdInsertDriveFile className="w-4 h-4 text-foreground flex-shrink-0" />
                      ) : (
                        <Banknote className="w-4 h-4 text-green-400 flex-shrink-0" />
                      )}
                      <span className="text-sm">{order.id}</span>
                    </div>
                  </td>
                  <td className="p-4">
                    {order.type === 'invoice' ? (
                      <span className="px-2.5 py-1 text-[10px] uppercase font-bold rounded-full border text-brand-400 bg-brand-400/10 border-brand-400/20">
                        Invoice
                      </span>
                    ) : (
                      <span className="px-2.5 py-1 text-[10px] uppercase font-bold rounded-full border text-green-400 bg-green-400/10 border-green-400/20">
                        Income
                      </span>
                    )}
                  </td>
                  <td className="p-4 text-sm text-gray-300">{order.service}</td>
                  <td className="p-4 font-semibold text-foreground">{formatLKR(order.amount)}</td>
                  <td className="p-4 text-sm text-gray-300">{order.date}</td>
                  <td className="p-4">
                    {order.status === 'paid' && (
                      <span className="px-2.5 py-1 text-xs font-medium rounded-full bg-green-500/20 text-green-400 border border-green-500/30">Paid</span>
                    )}
                    {order.status === 'unpaid' && (
                      <span className="px-2.5 py-1 text-xs font-medium rounded-full bg-amber-500/20 text-amber-400 border border-amber-500/30">Pending</span>
                    )}
                    {order.status === 'overdue' && (
                      <span className="px-2.5 py-1 text-xs font-medium rounded-full bg-red-500/20 text-red-400 border border-red-500/30">Overdue</span>
                    )}
                  </td>
                  <td className="p-4 text-right">
                    {order.type === 'invoice' ? (
                      <Link
                        href={`/user/invoice/${order.id}`}
                        className="inline-flex items-center justify-center p-2 text-gray-400 hover:text-foreground hover:bg-black/10 dark:hover:bg-white/10 rounded-xl transition-colors"
                        title="View invoice"
                      >
                        <MdKeyboardArrowRight className="w-5 h-5" />
                      </Link>
                    ) : (
                      <Link
                        href="/user/income"
                        className="inline-flex items-center justify-center p-2 text-gray-400 hover:text-foreground hover:bg-black/10 dark:hover:bg-white/10 rounded-xl transition-colors"
                        title="View in incomes"
                      >
                        <MdKeyboardArrowRight className="w-5 h-5" />
                      </Link>
                    )}
                  </td>
                </tr>
              ))}
              {orders.length === 0 && (
                <tr>
                  <td colSpan={7} className="p-8 text-center text-gray-500">
                    No orders or invoices found for this client.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}