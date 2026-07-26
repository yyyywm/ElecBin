import { useState, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { componentsApi } from '../api/components';
import { Upload, Image, Scan, CheckCircle2, AlertCircle, Loader2, ArrowLeft, Save } from 'lucide-react';

interface ParsedComponent {
  part_number: string;
  description: string;
  category: string;
  package: string;
  value: string;
  quantity: number;
  location: string;
  min_stock: number;
  notes: string;
}

declare global {
  interface Window {
    Tesseract: any;
  }
}

function loadTesseract(): Promise<any> {
  return new Promise((resolve, reject) => {
    if (window.Tesseract) return resolve(window.Tesseract);
    const script = document.createElement('script');
    script.src = 'https://cdn.jsdelivr.net/npm/tesseract.js@5/dist/tesseract.min.js';
    script.onload = () => {
      // Wait a bit for Tesseract to initialize
      setTimeout(() => {
        if (window.Tesseract) resolve(window.Tesseract);
        else reject(new Error('Tesseract failed to load'));
      }, 500);
    };
    script.onerror = () => reject(new Error('Failed to load Tesseract.js'));
    document.head.appendChild(script);
  });
}

function parseComponentText(text: string): Omit<ParsedComponent, 'location' | 'min_stock' | 'notes'>[] {
  const lines = text.split('\n').filter((l) => l.trim());
  const items: Omit<ParsedComponent, 'location' | 'min_stock' | 'notes'>[] = [];
  let currentItem: any = {};

  // Common patterns: part numbers, values, packages
  const partNumberPattern = /[A-Z]{2,}[\d-]+[A-Z\d]*/g;
  const valuePattern = /(\d+(?:\.\d+)?)\s*(?:pF|nF|uF|mF|F|Ω|kΩ|MΩ|Hz|kHz|MHz|V|A|mA|W|%)/gi;
  const qtyPattern = /(\d+)\s*(?:个|pcs|只|PCS)/g;
  const packagePattern = /(?:0[6-8]05|1[02]1[02]|SOT-\d+|SOP-\d+|QFN-\d+|LQFP-\d+|DIP-\d+)/gi;

  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed) continue;

    const partNumbers = trimmed.match(partNumberPattern);
    const values = [...trimmed.matchAll(valuePattern)];
    const qtyMatch = trimmed.match(qtyPattern);
    const pkgMatch = trimmed.match(packagePattern);

    if (partNumbers || values.length > 0) {
      currentItem = {
        part_number: partNumbers ? partNumbers[0] : `UNKNOWN-${Date.now()}`,
        description: trimmed,
        category: guessCategory(trimmed),
        package: pkgMatch ? pkgMatch[0] : '',
        value: values.length > 0 ? values[0][0] : '',
        quantity: qtyMatch ? parseInt(qtyMatch[0]) : 1,
      };
      items.push(currentItem);
    } else if (currentItem.part_number && !currentItem.description) {
      currentItem.description = trimmed;
    }
  }

  return items;
}

function guessCategory(text: string): string {
  const t = text.toUpperCase();
  if (t.includes('CAP') || t.includes('C') && (t.includes('NF') || t.includes('UF') || t.includes('PF'))) return 'Capacitor';
  if (t.includes('RES') || t.includes('R') && t.includes('Ω') || t.includes('KΩ')) return 'Resistor';
  if (t.includes('LED')) return 'LED';
  if (t.includes('SOT') || t.includes('QFN') || t.includes('LQFP') || t.includes('SOP')) return 'IC';
  if (t.includes('USB') || t.includes('CONN') || t.includes('HEADER')) return 'Connector';
  return 'Other';
}

export function ImageImportPage() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [image, setImage] = useState<string | null>(null);
  const [ocrText, setOcrText] = useState('');
  const [ocrLoading, setOcrLoading] = useState(false);
  const [parsedItems, setParsedItems] = useState<ParsedComponent[]>([]);
  const [importResult, setImportResult] = useState<{ success: number; failed: number } | null>(null);

  const importMutation = useMutation({
    mutationFn: (items: ParsedComponent[]) => componentsApi.importFromText(items),
    onSuccess: (data) => {
      setImportResult({ success: data.success, failed: data.failed });
      queryClient.invalidateQueries({ queryKey: ['components'] });
      queryClient.invalidateQueries({ queryKey: ['dashboard-stats'] });
    },
  });

  const handleImage = (file: File) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      setImage(e.target?.result as string);
      setOcrText('');
      setParsedItems([]);
      setImportResult(null);
    };
    reader.readAsDataURL(file);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    const file = e.dataTransfer.files[0];
    if (file && file.type.startsWith('image/')) handleImage(file);
  };

  const runOcr = async () => {
    if (!image) return;
    setOcrLoading(true);
    setOcrText('加载 OCR 引擎...');

    try {
      const Tesseract = await loadTesseract();
      setOcrText('正在识别文字...');

      const result = await Tesseract.recognize(image, 'chi_sim+eng', {
        logger: (m: any) => {
          if (m.status === 'recognizing text') {
            setOcrText(`识别中... ${Math.round(m.progress * 100)}%`);
          }
        },
      });

      const text = result.data.text;
      setOcrText(text);
      const items = parseComponentText(text);
      setParsedItems(
        items.map((item) => ({
          ...item,
          location: '',
          min_stock: Math.max(1, Math.floor(item.quantity * 0.2)),
          notes: '图片导入',
        }))
      );
    } catch (err: any) {
      setOcrText(`OCR 失败: ${err.message}`);
    } finally {
      setOcrLoading(false);
    }
  };

  const updateItem = (index: number, field: keyof ParsedComponent, value: string | number) => {
    setParsedItems((prev) => {
      const next = [...prev];
      next[index] = { ...next[index], [field]: value };
      return next;
    });
  };

  const handleImport = () => {
    const validItems = parsedItems.filter((i) => i.part_number && i.part_number !== '');
    if (validItems.length === 0) return;
    importMutation.mutate(validItems);
  };

  return (
    <div>
      <div className="flex items-center gap-4 mb-6">
        <button
          onClick={() => navigate('/components')}
          className="p-2 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded-lg transition-colors"
        >
          <ArrowLeft size={20} />
        </button>
        <div>
          <h1 className="text-2xl font-bold text-slate-800">图片导入库存</h1>
          <p className="text-sm text-slate-500 mt-1">上传元器件图片或淘宝订单截图，自动识别并导入库存</p>
        </div>
      </div>

      {/* Image Upload */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Left: Image */}
        <div>
          <div
            onDragOver={(e) => e.preventDefault()}
            onDrop={handleDrop}
            onClick={() => fileInputRef.current?.click()}
            className={`border-2 border-dashed rounded-xl p-6 text-center cursor-pointer transition-colors ${
              image ? 'border-green-300 bg-green-50' : 'border-slate-300 hover:border-slate-400 bg-white'
            }`}
          >
            <input
              ref={fileInputRef}
              type="file"
              accept="image/*"
              className="hidden"
              onChange={(e) => {
                const file = e.target.files?.[0];
                if (file) handleImage(file);
              }}
            />
            {image ? (
              <div>
                <img src={image} alt="Uploaded" className="max-h-80 mx-auto rounded-lg" />
                <p className="text-xs text-slate-400 mt-2">点击重新选择图片</p>
              </div>
            ) : (
              <div className="py-8">
                <Image size={40} className="mx-auto text-slate-300 mb-3" />
                <p className="text-sm font-medium text-slate-600">上传元器件图片或订单截图</p>
                <p className="text-xs text-slate-400 mt-1">支持 PNG、JPG、WebP 格式</p>
              </div>
            )}
          </div>

          {image && !ocrLoading && !ocrText && (
            <button
              onClick={runOcr}
              className="mt-4 w-full flex items-center justify-center gap-2 px-4 py-3 bg-blue-600 text-white text-sm font-medium rounded-lg hover:bg-blue-700 transition-colors"
            >
              <Scan size={18} />
              开始识别
            </button>
          )}

          {ocrLoading && (
            <div className="mt-4 flex items-center justify-center gap-2 p-3 bg-blue-50 rounded-lg text-sm text-blue-700">
              <Loader2 size={16} className="animate-spin" />
              {ocrText}
            </div>
          )}
        </div>

        {/* Right: OCR Result */}
        <div>
          {ocrText && !ocrLoading && (
            <div className="bg-white rounded-xl border border-slate-200 p-4">
              <h3 className="text-sm font-semibold text-slate-700 mb-2">识别文本</h3>
              <pre className="text-xs text-slate-600 bg-slate-50 rounded-lg p-3 max-h-40 overflow-auto whitespace-pre-wrap">
                {ocrText}
              </pre>
            </div>
          )}
        </div>
      </div>

      {/* Parsed Items */}
      {parsedItems.length > 0 && (
        <div className="mt-6">
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-lg font-semibold text-slate-800">
              识别到 {parsedItems.length} 个元器件
            </h2>
            {!importResult && (
              <button
                onClick={handleImport}
                disabled={importMutation.isPending}
                className="flex items-center gap-2 px-4 py-2 bg-green-600 text-white text-sm font-medium rounded-lg hover:bg-green-700 disabled:opacity-50 transition-colors"
              >
                <Save size={16} />
                {importMutation.isPending ? '导入中...' : '导入库存'}
              </button>
            )}
          </div>

          {importResult && (
            <div className={`mb-4 p-3 rounded-lg text-sm ${
              importResult.failed > 0 ? 'bg-yellow-50 text-yellow-800' : 'bg-green-50 text-green-800'
            }`}>
              <div className="flex items-center gap-2">
                <CheckCircle2 size={16} />
                导入完成：成功 {importResult.success} 个
                {importResult.failed > 0 && `，失败 ${importResult.failed} 个`}
              </div>
            </div>
          )}

          <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
            <table className="w-full">
              <thead>
                <tr className="bg-slate-50 border-b border-slate-200">
                  <th className="text-left px-3 py-2 text-xs font-medium text-slate-500 uppercase">型号</th>
                  <th className="text-left px-3 py-2 text-xs font-medium text-slate-500 uppercase">描述</th>
                  <th className="text-left px-3 py-2 text-xs font-medium text-slate-500 uppercase">分类</th>
                  <th className="text-left px-3 py-2 text-xs font-medium text-slate-500 uppercase">封装</th>
                  <th className="text-left px-3 py-2 text-xs font-medium text-slate-500 uppercase">参数</th>
                  <th className="text-right px-3 py-2 text-xs font-medium text-slate-500 uppercase">数量</th>
                </tr>
              </thead>
              <tbody>
                {parsedItems.map((item, index) => (
                  <tr key={index} className="border-b border-slate-100">
                    <td className="px-3 py-2">
                      <input
                        type="text"
                        value={item.part_number}
                        onChange={(e) => updateItem(index, 'part_number', e.target.value)}
                        className="w-full px-2 py-1 text-sm border border-slate-200 rounded focus:outline-none focus:ring-1 focus:ring-blue-500"
                      />
                    </td>
                    <td className="px-3 py-2">
                      <input
                        type="text"
                        value={item.description}
                        onChange={(e) => updateItem(index, 'description', e.target.value)}
                        className="w-full px-2 py-1 text-sm border border-slate-200 rounded focus:outline-none focus:ring-1 focus:ring-blue-500"
                      />
                    </td>
                    <td className="px-3 py-2">
                      <select
                        value={item.category}
                        onChange={(e) => updateItem(index, 'category', e.target.value)}
                        className="w-full px-2 py-1 text-sm border border-slate-200 rounded bg-white focus:outline-none focus:ring-1 focus:ring-blue-500"
                      >
                        {['Capacitor', 'Resistor', 'IC', 'LED', 'Connector', 'Inductor', 'Diode', 'Other'].map((c) => (
                          <option key={c} value={c}>{c}</option>
                        ))}
                      </select>
                    </td>
                    <td className="px-3 py-2">
                      <input
                        type="text"
                        value={item.package}
                        onChange={(e) => updateItem(index, 'package', e.target.value)}
                        className="w-full px-2 py-1 text-sm border border-slate-200 rounded focus:outline-none focus:ring-1 focus:ring-blue-500"
                      />
                    </td>
                    <td className="px-3 py-2">
                      <input
                        type="text"
                        value={item.value}
                        onChange={(e) => updateItem(index, 'value', e.target.value)}
                        className="w-full px-2 py-1 text-sm border border-slate-200 rounded focus:outline-none focus:ring-1 focus:ring-blue-500"
                      />
                    </td>
                    <td className="px-3 py-2">
                      <input
                        type="number"
                        value={item.quantity}
                        onChange={(e) => updateItem(index, 'quantity', parseInt(e.target.value) || 0)}
                        min={0}
                        className="w-20 px-2 py-1 text-sm text-right border border-slate-200 rounded focus:outline-none focus:ring-1 focus:ring-blue-500"
                      />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}