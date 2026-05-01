import React, { useState } from 'react';
import AdminLayout from '@/components/app/admin/AdminLayout';
import { useBrand } from '@/contexts/BrandContext';
import { 
  Settings, 
  Globe, 
  Palette, 
  MessageSquare, 
  Save, 
  Image as ImageIcon,
  Bell,
  ShieldCheck
} from 'lucide-react';
import { Button } from '@/components/shared/ui/button';
import { Input } from '@/components/shared/ui/input';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/shared/ui/card';
import { toast } from 'sonner';


export default function AdminSettings() {
  const { brand } = useBrand();
  const [loading, setLoading] = useState(false);


  const handleSave = () => {
    setLoading(true);
    setTimeout(() => {
      setLoading(false);
      toast("Configuración guardada", {
        description: "Los cambios para " + brand + " se han guardado correctamente.",
      });

    }, 1000);
  };

  return (
    <AdminLayout>
      <div className="space-y-6 max-w-4xl">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-slate-900">Configuración del Sistema</h1>
            <p className="text-slate-500">Administra la identidad visual y parámetros de {brand}.</p>
          </div>
          <Button onClick={handleSave} disabled={loading} className="rounded-xl flex items-center gap-2">
            <Save size={18} />
            {loading ? 'Guardando...' : 'Guardar Cambios'}
          </Button>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {/* Sidebar Nav (Mini) */}
          <div className="space-y-2">
            <button className="w-full flex items-center gap-3 px-4 py-3 rounded-xl bg-primary/10 text-primary font-bold text-sm">
              <Globe size={18} /> General
            </button>
            <button className="w-full flex items-center gap-3 px-4 py-3 rounded-xl hover:bg-slate-50 text-slate-500 font-medium text-sm transition-colors">
              <Palette size={18} /> Apariencia
            </button>
            <button className="w-full flex items-center gap-3 px-4 py-3 rounded-xl hover:bg-slate-50 text-slate-500 font-medium text-sm transition-colors">
              <MessageSquare size={18} /> Comunicaciones
            </button>
            <button className="w-full flex items-center gap-3 px-4 py-3 rounded-xl hover:bg-slate-50 text-slate-500 font-medium text-sm transition-colors">
              <Bell size={18} /> Notificaciones
            </button>
            <button className="w-full flex items-center gap-3 px-4 py-3 rounded-xl hover:bg-slate-50 text-slate-500 font-medium text-sm transition-colors">
              <ShieldCheck size={18} /> Seguridad
            </button>
          </div>

          {/* Form Area */}
          <div className="md:col-span-2 space-y-6">
            <Card className="border-none shadow-sm h-fit">
              <CardHeader>
                <CardTitle className="text-lg">Identidad de Marca</CardTitle>
                <CardDescription>Define cómo se presenta tu tienda a los clientes.</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid grid-cols-1 gap-4">
                  <div className="space-y-2">
                    <label className="text-xs font-bold text-slate-700 uppercase tracking-wider">Nombre del Sitio</label>
                    <Input defaultValue={brand === 'nikken' ? 'Nikken Wellness Store' : 'Natura Catálogo'} className="rounded-xl border-slate-200" />
                  </div>
                  <div className="space-y-2">
                    <label className="text-xs font-bold text-slate-700 uppercase tracking-wider">Lema / Slogan</label>
                    <Input defaultValue={brand === 'nikken' ? 'Descubre el bienestar con tecnología magnética' : 'Belleza que cuida de ti'} className="rounded-xl border-slate-200" />
                  </div>
                </div>
                <div className="pt-4 border-t border-slate-100 mt-4">
                   <p className="text-sm font-bold text-slate-800 mb-4">Logotipo Principal</p>
                   <div className="flex items-center gap-6">
                      <div className="w-20 h-20 rounded-2xl bg-slate-50 border-2 border-dashed border-slate-200 flex items-center justify-center text-slate-400 group hover:border-primary/50 cursor-pointer transition-colors">
                         <ImageIcon size={24} />
                      </div>
                      <div className="space-y-1">
                        <Button variant="outline" size="sm" className="rounded-lg h-8 text-xs">Subir nuevo logo</Button>
                        <p className="text-[10px] text-slate-400">Recomendado: SVG o PNG Transparente (512x512)</p>
                      </div>
                   </div>
                </div>
              </CardContent>
            </Card>

            <Card className="border-none shadow-sm h-fit">
              <CardHeader>
                <CardTitle className="text-lg">Configuración de Ventas</CardTitle>
                <CardDescription>Parámetros para pedidos y contacto por WhatsApp.</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-2">
                  <label className="text-xs font-bold text-slate-700 uppercase tracking-wider">WhatsApp del Vendedor</label>
                  <Input defaultValue="+525512345678" className="rounded-xl border-slate-200" />
                  <p className="text-[10px] text-slate-400">Este número recibirá los pedidos de forma directa.</p>
                </div>
                <div className="space-y-2">
                    <label className="text-xs font-bold text-slate-700 uppercase tracking-wider">Mensaje Predeterminado</label>
                    <Input defaultValue="Hola, me interesa realizar el siguiente pedido:" className="rounded-xl border-slate-200" />
                </div>
              </CardContent>
            </Card>
          </div>
        </div>
      </div>
    </AdminLayout>
  );
}
