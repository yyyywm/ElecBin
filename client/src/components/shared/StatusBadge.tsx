interface StatusBadgeProps {
  status: string | null;
}

const statusConfig: Record<string, { label: string; className: string }> = {
  found: { label: '充足', className: 'bg-green-100 text-green-800' },
  insufficient: { label: '不足', className: 'bg-yellow-100 text-yellow-800' },
  missing: { label: '缺少', className: 'bg-red-100 text-red-800' },
  imported: { label: '已导入', className: 'bg-blue-100 text-blue-800' },
  compared: { label: '已比对', className: 'bg-purple-100 text-purple-800' },
  consumed: { label: '已消耗', className: 'bg-green-100 text-green-800' },
};

export function StatusBadge({ status }: StatusBadgeProps) {
  if (!status) return null;

  const config = statusConfig[status] || {
    label: status,
    className: 'bg-gray-100 text-gray-800',
  };

  return (
    <span
      className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${config.className}`}
    >
      {config.label}
    </span>
  );
}