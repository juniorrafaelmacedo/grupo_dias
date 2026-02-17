import React from 'react';
import { 
  LayoutDashboard, 
  FileText, 
  Settings, 
  Plus, 
  Trash2, 
  Download,
  Search,
  CheckCircle,
  CreditCard,
  Building2,
  DollarSign,
  Upload,
  FileSpreadsheet,
  Users
} from 'lucide-react';

export const ICONS = {
  Dashboard: <LayoutDashboard size={20} />,
  Payables: <FileText size={20} />,
  Settings: <Settings size={20} />,
  Users: <Users size={20} />,
  Add: <Plus size={16} />,
  Delete: <Trash2 size={16} />,
  Download: <Download size={16} />,
  Search: <Search size={18} />,
  Check: <CheckCircle size={16} />,
  Card: <CreditCard size={20} />,
  Bank: <Building2 size={20} />,
  Money: <DollarSign size={20} />,
  Upload: <Upload size={16} />,
  Excel: <FileSpreadsheet size={16} />
};

export const PAYMENT_TYPES = [
  { value: '01', label: '01 - TED/DOC/Transferência' },
  { value: '02', label: '02 - Boleto Bancário' },
  { value: '03', label: '03 - Débito em Conta' },
  { value: '04', label: '04 - Tributo com Código de Barras' },
  { value: '06', label: '06 - PIX' },
];