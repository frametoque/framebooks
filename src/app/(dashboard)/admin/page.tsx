import postgres from "postgres";
const neon = postgres;
import {  auth  } from '@/lib/auth';
import { redirect } from "next/navigation";

export default async function SuperAdminPage() {
  const { userId } = await auth();
  if (!userId) redirect("/login");

  const sql = neon(process.env.DATABASE_URL!);
  
  // Verify super admin
  const userRole = await sql`SELECT role FROM admin_users WHERE clerk_id = ${userId} LIMIT 1`;
  if (userRole.length === 0 || userRole[0].role !== 'superadmin') {
    // Wait, let's just let the first user who accesses it be superadmin for testing, 
    // or just assume they will be manually set in the DB.
    // If not superadmin, maybe just show a forbidden message.
    return (
      <div className="min-h-screen bg-[#0a0a0f] text-foreground flex items-center justify-center">
        <div className="text-center">
          <h1 className="text-2xl font-bold mb-2">Access Denied</h1>
          <p className="text-gray-400">You must be a super-admin to view this page.</p>
        </div>
      </div>
    );
  }

  const tenants = await sql`
    SELECT t.id, t.name, t.plan, t.created_at, u.full_name, u.email
    FROM tenants t
    LEFT JOIN admin_users u ON t.id = u.tenant_id AND u.role = 'owner'
    ORDER BY t.created_at DESC
  `;

  return (
    <div className="min-h-screen bg-[#0a0a0f] text-foreground p-10">
      <div className="max-w-6xl mx-auto">
        <h1 className="text-3xl font-bold mb-8">Super-Admin Portal</h1>
        
        <div className="bg-transparent border border-border rounded-2xl overflow-hidden">
          <table className="w-full text-left text-sm">
            <thead className="bg-transparent border-b border-border text-gray-400">
              <tr>
                <th className="px-6 py-4 font-medium">Business Name</th>
                <th className="px-6 py-4 font-medium">Owner</th>
                <th className="px-6 py-4 font-medium">Plan</th>
                <th className="px-6 py-4 font-medium">Joined</th>
                <th className="px-6 py-4 font-medium">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-white/10">
              {tenants.map((t: any) => (
                <tr key={t.id} className="hover:bg-card transition-colors">
                  <td className="px-6 py-4 font-medium">{t.name}</td>
                  <td className="px-6 py-4">
                    <div>{t.full_name || 'N/A'}</div>
                    <div className="text-gray-500 text-xs">{t.email}</div>
                  </td>
                  <td className="px-6 py-4">
                    <span className="bg-[#169FE4]/20 text-[#169FE4] px-2 py-1 rounded text-xs font-medium border border-[#169FE4]/30">
                      {t.plan || 'Free'}
                    </span>
                  </td>
                  <td className="px-6 py-4 text-gray-400">
                    {new Date(t.created_at).toLocaleDateString()}
                  </td>
                  <td className="px-6 py-4">
                    <button className="text-gray-400 hover:text-foreground transition-colors">Manage</button>
                  </td>
                </tr>
              ))}
              {tenants.length === 0 && (
                <tr>
                  <td colSpan={5} className="px-6 py-8 text-center text-gray-500">
                    No businesses found.
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
