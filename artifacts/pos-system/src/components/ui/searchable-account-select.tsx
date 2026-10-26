import React, { useState, useMemo } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Search, User, Building2, Check, X, Plus, ChevronDown, Phone, Hash, ShieldCheck } from "lucide-react";

export interface AccountItem {
  id: string | number;
  name: string;
  code?: string;
  account_code?: string;
  phone?: string;
  customer_type?: string;
  affiliation_type?: string;
  office_name?: string;
  [key: string]: any;
}

interface SearchableAccountSelectProps {
  value?: string | number;
  onSelect: (account: AccountItem | null) => void;
  accounts: AccountItem[];
  placeholder?: string;
  title?: string;
  type?: "customer" | "supplier" | "account";
  label?: string;
  required?: boolean;
  disabled?: boolean;
  onQuickAdd?: () => void;
  quickAddLabel?: string;
  className?: string;
}

export function SearchableAccountSelect({
  value,
  onSelect,
  accounts = [],
  placeholder = "اضغط لاختيار الحساب من الدليل...",
  title = "اختيار الحساب من دليل الحسابات",
  type = "customer",
  label,
  required,
  disabled,
  onQuickAdd,
  quickAddLabel,
  className = ""
}: SearchableAccountSelectProps) {
  const [open, setOpen] = useState(false);
  const [searchTerm, setSearchTerm] = useState("");

  // Selected account lookup
  const selectedAccount = useMemo(() => {
    if (!value) return null;
    return accounts.find(
      a => String(a.id) === String(value) || (a.code && String(a.code) === String(value))
    ) || null;
  }, [value, accounts]);

  // Filter accounts by search term (name, code, phone, office name)
  const filteredAccounts = useMemo(() => {
    if (!searchTerm.trim()) return accounts;
    const term = searchTerm.trim().toLowerCase();
    return accounts.filter(a => {
      const nameMatch = a.name ? String(a.name).toLowerCase().includes(term) : false;
      const codeMatch = a.code ? String(a.code).toLowerCase().includes(term) : false;
      const accCodeMatch = a.account_code ? String(a.account_code).toLowerCase().includes(term) : false;
      const phoneMatch = a.phone ? String(a.phone).toLowerCase().includes(term) : false;
      const officeMatch = a.office_name ? String(a.office_name).toLowerCase().includes(term) : false;
      return nameMatch || codeMatch || accCodeMatch || phoneMatch || officeMatch;
    });
  }, [accounts, searchTerm]);

  const handleSelect = (acc: AccountItem) => {
    onSelect(acc);
    setOpen(false);
    setSearchTerm("");
  };

  const handleClear = (e: React.MouseEvent) => {
    e.stopPropagation();
    onSelect(null);
  };

  return (
    <div className={`space-y-1.5 ${className}`}>
      {label && (
        <div className="flex items-center justify-between">
          <label className="text-xs font-black text-slate-700">
            {label} {required && <span className="text-red-500">*</span>}
          </label>
          {onQuickAdd && (
            <button
              type="button"
              onClick={onQuickAdd}
              className="text-xs text-emerald-700 hover:text-emerald-900 font-bold flex items-center gap-1 hover:underline"
            >
              <Plus className="w-3.5 h-3.5" />
              {quickAddLabel || "+ إضافة جديد"}
            </button>
          )}
        </div>
      )}

      {/* Trigger Button */}
      <div
        onClick={() => !disabled && setOpen(true)}
        className={`flex items-center justify-between min-h-[44px] px-3.5 py-2 rounded-xl border transition-all cursor-pointer select-none ${
          disabled
            ? "bg-slate-100 border-slate-200 text-slate-400 cursor-not-allowed"
            : selectedAccount
            ? "bg-emerald-50/60 border-emerald-300 text-slate-900 hover:border-emerald-400 hover:bg-emerald-50"
            : "bg-slate-50/50 border-slate-300 text-slate-500 hover:border-blue-400 hover:bg-white"
        }`}
      >
        <div className="flex items-center gap-2.5 overflow-hidden text-ellipsis whitespace-nowrap">
          {type === "supplier" ? (
            <Building2 className={`w-4 h-4 shrink-0 ${selectedAccount ? "text-blue-600" : "text-slate-400"}`} />
          ) : (
            <User className={`w-4 h-4 shrink-0 ${selectedAccount ? "text-emerald-600" : "text-slate-400"}`} />
          )}

          {selectedAccount ? (
            <div className="flex items-center gap-2 overflow-hidden">
              <span className="font-bold text-sm text-slate-900 truncate">{selectedAccount.name}</span>

              {(selectedAccount.code || selectedAccount.account_code) && (
                <span className="text-[11px] font-mono bg-slate-200/80 text-slate-800 px-1.5 py-0.5 rounded font-bold shrink-0">
                  {selectedAccount.code || selectedAccount.account_code}
                </span>
              )}

              {selectedAccount.phone && (
                <span className="text-xs text-slate-500 hidden sm:inline-block shrink-0">
                  📞 {selectedAccount.phone}
                </span>
              )}

              {selectedAccount.affiliation_type === "agency" && (
                <span className="text-[10px] bg-purple-100 text-purple-800 border border-purple-200 px-1.5 py-0.5 rounded font-bold shrink-0">
                  🏬 مكتب: {selectedAccount.office_name || "وسيط"}
                </span>
              )}
            </div>
          ) : (
            <span className="text-sm text-slate-500 flex items-center gap-2">
              <Search className="w-3.5 h-3.5 text-slate-400" />
              {placeholder}
            </span>
          )}
        </div>

        <div className="flex items-center gap-1 shrink-0 mr-2">
          {selectedAccount && !disabled && (
            <button
              type="button"
              onClick={handleClear}
              className="p-1 hover:bg-slate-200 text-slate-400 hover:text-slate-700 rounded-full transition-colors"
              title="تفريغ الاختيار"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          )}
          <ChevronDown className="w-4 h-4 text-slate-400" />
        </div>
      </div>

      {/* Account Search Dialog */}
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-2xl max-h-[85vh] flex flex-col p-0 gap-0 overflow-hidden text-right rtl" dir="rtl">
          <DialogHeader className="p-4 bg-slate-900 text-white border-b border-slate-800 shrink-0">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2.5">
                <div className="w-9 h-9 rounded-xl bg-blue-600/20 border border-blue-500/30 flex items-center justify-center text-blue-400">
                  {type === "supplier" ? <Building2 className="w-5 h-5" /> : <User className="w-5 h-5" />}
                </div>
                <div>
                  <DialogTitle className="text-base font-black text-white">
                    {title}
                  </DialogTitle>
                  <DialogDescription className="text-xs text-slate-400">
                    استعراض الحسابات من دليل الحسابات مع إمكانية البحث الفوري بالاسم، الكود، أو الهاتف
                  </DialogDescription>
                </div>
              </div>
              {onQuickAdd && (
                <Button
                  type="button"
                  size="sm"
                  onClick={() => {
                    setOpen(false);
                    onQuickAdd();
                  }}
                  className="bg-emerald-600 hover:bg-emerald-500 text-white font-bold gap-1 text-xs"
                >
                  <Plus className="w-3.5 h-3.5" />
                  {quickAddLabel || "إضافة جديد"}
                </Button>
              )}
            </div>

            {/* Live Search Input */}
            <div className="relative mt-3">
              <Search className="w-4 h-4 absolute right-3 top-3 text-slate-400" />
              <Input
                autoFocus
                type="text"
                value={searchTerm}
                onChange={e => setSearchTerm(e.target.value)}
                placeholder="اكتب اسم الحساب، الكود، أو رقم الهاتف للبحث الفوري..."
                className="pr-9 pl-8 h-10 bg-slate-800 border-slate-700 text-white placeholder:text-slate-400 text-sm rounded-xl focus:ring-2 focus:ring-blue-500"
              />
              {searchTerm && (
                <button
                  type="button"
                  onClick={() => setSearchTerm("")}
                  className="absolute left-3 top-2.5 text-slate-400 hover:text-white p-0.5 rounded-full"
                >
                  <X className="w-4 h-4" />
                </button>
              )}
            </div>
          </DialogHeader>

          {/* Accounts List Container */}
          <div className="p-4 overflow-y-auto flex-1 space-y-2 bg-slate-50 min-h-[300px]">
            <div className="flex items-center justify-between text-xs text-slate-500 px-1 mb-1 font-bold">
              <span>نتائج البحث: ({filteredAccounts.length} من {accounts.length})</span>
              {searchTerm && <span>مطابقة لـ: "{searchTerm}"</span>}
            </div>

            {filteredAccounts.length === 0 ? (
              <div className="text-center py-12 px-4 space-y-3 bg-white rounded-2xl border border-dashed border-slate-300">
                <Search className="w-10 h-10 text-slate-300 mx-auto" />
                <p className="text-sm font-bold text-slate-600">لا توجد حسابات مطابقة للبحث</p>
                <p className="text-xs text-slate-400">تأكد من كتابة الاسم أو الحرف بشكل صحيح</p>
                {onQuickAdd && (
                  <Button
                    type="button"
                    onClick={() => {
                      setOpen(false);
                      onQuickAdd();
                    }}
                    className="bg-emerald-600 hover:bg-emerald-500 text-white font-bold gap-1 text-xs mt-2"
                  >
                    <Plus className="w-4 h-4" />
                    {quickAddLabel || "إضافة جديد الآن"}
                  </Button>
                )}
              </div>
            ) : (
              <div className="grid grid-cols-1 gap-2">
                {filteredAccounts.map((acc, idx) => {
                  const isSelected = String(acc.id) === String(value) || (acc.code && String(acc.code) === String(value));
                  const accCode = acc.code || acc.account_code;

                  return (
                    <div
                      key={`acc-${acc.id || idx}-${idx}`}
                      onClick={() => handleSelect(acc)}
                      className={`p-3 rounded-xl border transition-all cursor-pointer flex items-center justify-between gap-3 ${
                        isSelected
                          ? "bg-emerald-50 border-emerald-500 ring-2 ring-emerald-500/20 shadow-sm"
                          : "bg-white hover:bg-blue-50/60 border-slate-200 hover:border-blue-300"
                      }`}
                    >
                      <div className="flex items-center gap-3 overflow-hidden">
                        <div className={`w-9 h-9 rounded-lg flex items-center justify-center shrink-0 font-bold ${
                          isSelected
                            ? "bg-emerald-600 text-white"
                            : type === "supplier"
                            ? "bg-blue-100 text-blue-800"
                            : "bg-slate-100 text-slate-700"
                        }`}>
                          {type === "supplier" ? <Building2 className="w-4 h-4" /> : <User className="w-4 h-4" />}
                        </div>

                        <div className="space-y-0.5 overflow-hidden">
                          <div className="flex items-center gap-2 flex-wrap">
                            <span className="font-bold text-sm text-slate-900">{acc.name}</span>

                            {accCode && (
                              <span className="text-xs font-mono font-bold bg-slate-100 text-slate-700 px-2 py-0.5 rounded border border-slate-200">
                                {accCode}
                              </span>
                            )}

                            {acc.affiliation_type === "agency" && (
                              <span className="text-[10px] font-bold bg-purple-100 text-purple-900 border border-purple-200 px-2 py-0.5 rounded">
                                🏬 مكتب: {acc.office_name || "وسيط"}
                              </span>
                            )}

                            {acc.customer_type === "company" && (
                              <span className="text-[10px] font-bold bg-blue-100 text-blue-900 px-1.5 py-0.5 rounded">
                                شركة
                              </span>
                            )}
                          </div>

                          {acc.phone && (
                            <p className="text-xs text-slate-500 flex items-center gap-1 font-mono">
                              <Phone className="w-3 h-3 text-slate-400" />
                              {acc.phone}
                            </p>
                          )}
                        </div>
                      </div>

                      <div className="shrink-0">
                        {isSelected ? (
                          <span className="bg-emerald-600 text-white text-xs font-bold px-3 py-1.5 rounded-lg flex items-center gap-1 shadow-xs">
                            <Check className="w-3.5 h-3.5" />
                            محدد حالياً
                          </span>
                        ) : (
                          <Button
                            type="button"
                            variant="outline"
                            size="sm"
                            className="text-xs font-bold border-slate-300 hover:bg-blue-600 hover:text-white hover:border-blue-600 transition-colors"
                          >
                            اختيار
                          </Button>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
