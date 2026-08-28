"use client";
import { useState, useEffect } from "react";
import { MdAdd, MdDelete, MdSave } from "react-icons/md";
import { getRoles, saveRole, deleteRole } from "../actions/roles";

const RESOURCES = [
  { key: 'invoices', label: 'Invoices' },
  { key: 'incomes', label: 'Incomes' },
  { key: 'expenses', label: 'Expenses' },
  { key: 'clients', label: 'Clients' },
  { key: 'accounts', label: 'Accounts' },
  { key: 'inventory', label: 'Inventory' }
];

const ACTIONS = [
  { key: 'read', label: 'Read' },
  { key: 'insert', label: 'Insert' },
  { key: 'update', label: 'Update' },
  { key: 'delete', label: 'Delete' }
];

const GLOBAL_PERMS = [
  { key: 'settings', action: 'manage', label: 'Manage Settings' },
  { key: 'team', action: 'manage', label: 'Manage Team' },
  { key: 'export', action: 'data', label: 'Export Data' }
];

export default function RolesConfigurator({ currentUserRole }: { currentUserRole: string | null }) {
  const [roles, setRoles] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [errorMsg, setErrorMsg] = useState("");
  const [successMsg, setSuccessMsg] = useState("");

  const [newRoleName, setNewRoleName] = useState("");
  const [isAdding, setIsAdding] = useState(false);

  useEffect(() => {
    fetchRoles();
  }, []);

  const fetchRoles = async () => {
    try {
      setLoading(true);
      const data = await getRoles();
      setRoles(data);
    } catch (e: any) {
      setErrorMsg(e.message || "Failed to load roles.");
    } finally {
      setLoading(false);
    }
  };

  const handleToggleResource = (roleIndex: number, resourceKey: string, actionKey: string) => {
    const newRoles = [...roles];
    const perms = { ...newRoles[roleIndex].granular_permissions };
    if (!perms[resourceKey]) perms[resourceKey] = { read: false, insert: false, update: false, delete: false };
    perms[resourceKey][actionKey] = !perms[resourceKey][actionKey];
    newRoles[roleIndex] = { ...newRoles[roleIndex], granular_permissions: perms };
    setRoles(newRoles);
  };

  const handleSave = async (roleObj: any) => {
    try {
      setErrorMsg("");
      setSuccessMsg("");
      await saveRole(roleObj);
      setSuccessMsg(`Role ${roleObj.role} saved successfully.`);
      await fetchRoles();
    } catch(e: any) {
      setErrorMsg(e.message || "Failed to save role.");
    }
  };

  const handleDelete = async (roleName: string) => {
    if (!confirm(`Are you sure you want to delete the custom override for ${roleName}?`)) return;
    try {
      setErrorMsg("");
      setSuccessMsg("");
      await deleteRole(roleName);
      setSuccessMsg(`Role ${roleName} deleted successfully.`);
      await fetchRoles();
    } catch(e: any) {
      setErrorMsg(e.message || "Failed to delete role.");
    }
  };

  const handleAddNew = async () => {
    if (!newRoleName.trim()) return;
    try {
      const defaultPerms = {};
      RESOURCES.forEach(r => defaultPerms[r.key as keyof typeof defaultPerms] = { read: false, insert: false, update: false, delete: false });
      GLOBAL_PERMS.forEach(g => defaultPerms[g.key as keyof typeof defaultPerms] = { [g.action]: false });

      await saveRole({
        role: newRoleName.trim(),
        granular_permissions: defaultPerms
      });
      setNewRoleName("");
      setIsAdding(false);
      await fetchRoles();
      setSuccessMsg("New role created.");
    } catch (e: any) {
      setErrorMsg(e.message || "Failed to create role.");
    }
  }

  if (loading) return <div className="text-gray-400">Loading roles...</div>;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-foreground tracking-tight">Team Roles Configurator</h2>
          <p className="text-gray-400 mt-1">Customize granular permissions for your team members.</p>
        </div>
        <button 
          onClick={() => setIsAdding(!isAdding)}
          className="flex items-center gap-2 px-4 py-2 bg-brand-500 hover:bg-brand-400 text-brand-900 rounded-xl transition-colors text-sm font-bold cursor-pointer"
        >
          <MdAdd className="w-5 h-5" />
          Create New Role
        </button>
      </div>

      {errorMsg && <div className="p-4 bg-red-500/10 border border-red-500/20 text-red-500 rounded-xl text-sm">{errorMsg}</div>}
      {successMsg && <div className="p-4 bg-green-500/10 border border-green-500/20 text-brand-500 rounded-xl text-sm">{successMsg}</div>}

      {isAdding && (
        <div className="p-6 bg-card border border-border rounded-2xl flex items-end gap-4">
          <div className="flex-1">
            <label className="block text-sm font-medium text-gray-300 mb-2">New Role Name</label>
            <input 
              type="text" 
              value={newRoleName}
              onChange={(e) => setNewRoleName(e.target.value)}
              placeholder="e.g. Accountant"
              className="w-full bg-card border border-border hover:border-black/20 dark:border-white/20 rounded-xl px-4 py-3 outline-none focus:border-brand-500 transition-colors text-foreground"
            />
          </div>
          <button onClick={handleAddNew} className="px-6 py-3 bg-brand-500 hover:bg-brand-400 text-brand-900 font-bold rounded-xl transition-colors cursor-pointer">
            Create
          </button>
        </div>
      )}

      <div className="grid grid-cols-1 gap-6">
        {roles.map((roleObj, i) => (
          <div key={i} className="bg-card border border-border rounded-2xl p-6">
            <div className="flex items-center justify-between mb-6 border-b border-border pb-4">
              <h3 className="text-xl font-bold text-foreground flex items-center gap-3">
                {roleObj.role}
                {roleObj.isCustom && <span className="px-2 py-0.5 rounded text-[10px] uppercase font-bold bg-brand-500/20 text-brand-500">Customized</span>}
              </h3>
              
              <div className="flex gap-2">
                {roleObj.role.toLowerCase() !== 'owner' && (
                  <button onClick={() => handleSave(roleObj)} className="p-2 hover:bg-black/10 dark:hover:bg-white/10 text-gray-400 hover:text-foreground rounded-lg transition-colors cursor-pointer" title="Save Changes">
                    <MdSave className="w-5 h-5" />
                  </button>
                )}
                {roleObj.role.toLowerCase() !== 'owner' && roleObj.isCustom && (
                  <button onClick={() => handleDelete(roleObj.role)} className="p-2 hover:bg-red-500/10 text-red-500 rounded-lg transition-colors cursor-pointer" title="Revert to Default / Delete">
                    <MdDelete className="w-5 h-5" />
                  </button>
                )}
              </div>
            </div>

            <div className="space-y-6">
              {/* Resources Permissions */}
              <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse">
                  <thead>
                    <tr>
                      <th className="pb-3 text-sm font-semibold text-gray-400 border-b border-border">Resource Area</th>
                      {ACTIONS.map(action => (
                        <th key={action.key} className="pb-3 text-sm font-semibold text-gray-400 border-b border-border text-center">{action.label}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border">
                    {RESOURCES.map(res => (
                      <tr key={res.key} className="hover:bg-black/5 dark:hover:bg-white/5 transition-colors">
                        <td className="py-4 text-sm font-medium text-foreground">{res.label}</td>
                        {ACTIONS.map(action => {
                          const perms = roleObj.granular_permissions || {};
                          const resPerms = perms[res.key] || {};
                          const isChecked = resPerms[action.key] === true;
                          const isOwner = roleObj.role.toLowerCase() === 'owner';

                          return (
                            <td key={action.key} className="py-4 text-center">
                              <label className="inline-flex items-center cursor-pointer group">
                                <div className="relative flex items-center">
                                  <input 
                                    type="checkbox" 
                                    className="sr-only"
                                    disabled={isOwner}
                                    checked={isChecked}
                                    onChange={() => handleToggleResource(i, res.key, action.key)}
                                  />
                                  <div className={`w-5 h-5 rounded border flex items-center justify-center transition-colors
                                    ${isChecked 
                                      ? 'bg-brand-500 border-brand-500 text-brand-900' 
                                      : 'border-gray-500 group-hover:border-foreground text-transparent'
                                    }
                                    ${isOwner ? 'opacity-50' : ''}
                                  `}>
                                    <svg className="w-3.5 h-3.5 fill-current" viewBox="0 0 20 20"><path d="M0 11l2-2 5 5L18 3l2 2L7 18z"/></svg>
                                  </div>
                                </div>
                              </label>
                            </td>
                          );
                        })}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              {/* Global Permissions */}
              <div className="pt-4 border-t border-border">
                <h4 className="text-sm font-semibold text-gray-400 mb-4">Global Actions</h4>
                <div className="flex flex-wrap gap-6">
                  {GLOBAL_PERMS.map(global => {
                    const perms = roleObj.granular_permissions || {};
                    const gPerms = perms[global.key] || {};
                    const isChecked = gPerms[global.action] === true;
                    const isOwner = roleObj.role.toLowerCase() === 'owner';

                    return (
                      <label key={global.key} className="flex items-center gap-3 cursor-pointer group">
                        <div className="relative flex items-center">
                          <input 
                            type="checkbox" 
                            className="sr-only"
                            disabled={isOwner}
                            checked={isChecked}
                            onChange={() => handleToggleResource(i, global.key, global.action)}
                          />
                          <div className={`w-5 h-5 rounded border flex items-center justify-center transition-colors
                            ${isChecked 
                              ? 'bg-brand-500 border-brand-500 text-brand-900' 
                              : 'border-gray-500 group-hover:border-foreground text-transparent'
                            }
                            ${isOwner ? 'opacity-50' : ''}
                          `}>
                            <svg className="w-3.5 h-3.5 fill-current" viewBox="0 0 20 20"><path d="M0 11l2-2 5 5L18 3l2 2L7 18z"/></svg>
                          </div>
                        </div>
                        <span className={`text-sm ${isOwner ? 'text-gray-500' : 'text-gray-300 group-hover:text-foreground transition-colors'}`}>{global.label}</span>
                      </label>
                    );
                  })}
                </div>
              </div>

            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
