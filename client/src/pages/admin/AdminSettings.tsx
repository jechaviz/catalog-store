import { useEffect, useMemo, useState } from 'react';
import {
  Bell,
  CheckCircle2,
  Globe,
  Image as ImageIcon,
  MessageSquare,
  Palette,
  Save,
  Settings,
  ShieldCheck,
} from 'lucide-react';
import { toast } from 'sonner';
import AdminLayout from '@/components/app/admin/AdminLayout';
import { Button } from '@/components/shared/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/shared/ui/card';
import { Input } from '@/components/shared/ui/input';
import { Textarea } from '@/components/shared/ui/textarea';
import { useBrand } from '@/contexts/BrandContext';
import { useStorefrontSettings } from '@/hooks/useStorefrontSettings';
import {
  normalizeSellerPhone,
  saveStorefrontSettings,
  type StorefrontSettings,
} from '@/lib/storefrontSettings';

type SettingsSection = 'general' | 'appearance' | 'communications' | 'notifications' | 'security';

const SECTION_BUTTONS: Array<{
  id: SettingsSection;
  label: string;
  icon: typeof Globe;
}> = [
  { id: 'general', label: 'General', icon: Globe },
  { id: 'appearance', label: 'Apariencia', icon: Palette },
  { id: 'communications', label: 'Comunicaciones', icon: MessageSquare },
  { id: 'notifications', label: 'Notificaciones', icon: Bell },
  { id: 'security', label: 'Seguridad', icon: ShieldCheck },
];

export default function AdminSettings() {
  const { brand } = useBrand();
  const settings = useStorefrontSettings(brand);
  const [loading, setLoading] = useState(false);
  const [activeSection, setActiveSection] = useState<SettingsSection>('general');
  const [formValues, setFormValues] = useState<StorefrontSettings>(settings);

  useEffect(() => {
    setFormValues(settings);
  }, [settings]);

  const isDirty = useMemo(() => {
    return JSON.stringify(formValues) !== JSON.stringify(settings);
  }, [formValues, settings]);

  const updateField = <Key extends keyof StorefrontSettings>(
    field: Key,
    value: StorefrontSettings[Key]
  ) => {
    setFormValues((currentValues) => ({
      ...currentValues,
      [field]: value,
    }));
  };

  const handleSave = () => {
    const siteName = formValues.siteName.trim();
    const slogan = formValues.slogan.trim();
    const logoImageUrl = formValues.logoImageUrl.trim();
    const heroImageUrl = formValues.heroImageUrl.trim();
    const heroEyebrow = formValues.heroEyebrow.trim();
    const heroDescription = formValues.heroDescription.trim();
    const sellerMessageTemplate = formValues.sellerMessageTemplate.trim();
    const sellerPhone = normalizeSellerPhone(formValues.sellerPhone);
    const connectiaPaymentLink = formValues.connectiaPaymentLink.trim();
    const paypalPaymentLink = formValues.paypalPaymentLink.trim();
    const paypalUsername = formValues.paypalUsername.trim().replace(/^@+/, '');
    const transferClabe = formValues.transferClabe.trim();
    const transferInstructions = formValues.transferInstructions.trim();

    if (!siteName || !slogan || !sellerMessageTemplate) {
      toast.error('Completa el nombre del sitio, el slogan y el mensaje base del vendedor.');
      return;
    }

    setLoading(true);
    window.setTimeout(() => {
      const savedSettings = saveStorefrontSettings(brand, {
        siteName,
        slogan,
        logoImageUrl,
        heroImageUrl,
        heroEyebrow,
        heroDescription,
        sellerPhone,
        sellerMessageTemplate,
        connectiaPaymentLink,
        paypalPaymentLink,
        paypalUsername,
        transferClabe,
        transferInstructions,
      });

      setFormValues(savedSettings);
      setLoading(false);
      toast.success('Configuracion guardada', {
        description: `Los cambios de ${brand === 'nikken' ? 'Nikken' : 'Natura'} quedaron guardados en este navegador.`,
      });
    }, 300);
  };

  const brandLabel = brand === 'nikken' ? 'Nikken' : 'Natura';
  const brandInitials = brandLabel
    .split(' ')
    .map((token) => token[0])
    .join('')
    .slice(0, 2)
    .toUpperCase();
  const previewDescription =
    brand === 'nikken'
      ? 'Vista orientativa para la experiencia de bienestar.'
      : 'Vista orientativa para la experiencia de catalogo y compra.';

  return (
    <AdminLayout>
      <div className="space-y-6 max-w-4xl">
        <div className="flex items-center justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold text-slate-900">Configuracion del sistema</h1>
            <p className="text-slate-500">
              Administra la identidad visual y los datos de contacto de {brandLabel}.
            </p>
          </div>
          <Button
            onClick={handleSave}
            disabled={loading || !isDirty}
            className="rounded-xl flex items-center gap-2"
          >
            <Save size={18} />
            {loading ? 'Guardando...' : isDirty ? 'Guardar cambios' : 'Sin cambios'}
          </Button>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <div className="space-y-2">
            {SECTION_BUTTONS.map((section) => {
              const Icon = section.icon;
              const isActive = activeSection === section.id;

              return (
                <button
                  key={section.id}
                  onClick={() => setActiveSection(section.id)}
                  className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl text-sm transition-colors ${
                    isActive
                      ? 'bg-primary/10 text-primary font-bold'
                      : 'hover:bg-slate-50 text-slate-500 font-medium'
                  }`}
                >
                  <Icon size={18} />
                  {section.label}
                </button>
              );
            })}
          </div>

          <div className="md:col-span-2 space-y-6">
            {(activeSection === 'general' || activeSection === 'appearance') && (
              <Card className="border-none shadow-sm h-fit">
                <CardHeader>
                  <CardTitle className="text-lg">Identidad de marca</CardTitle>
                  <CardDescription>
                    Define como se presenta tu tienda a los clientes.
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="space-y-2">
                    <label className="text-xs font-bold text-slate-700 uppercase tracking-wider">
                      Nombre del sitio
                    </label>
                    <Input
                      value={formValues.siteName}
                      onChange={(event) => updateField('siteName', event.target.value)}
                      className="rounded-xl border-slate-200"
                    />
                  </div>
                  <div className="space-y-2">
                    <label className="text-xs font-bold text-slate-700 uppercase tracking-wider">
                      Lema o slogan
                    </label>
                    <Input
                      value={formValues.slogan}
                      onChange={(event) => updateField('slogan', event.target.value)}
                      className="rounded-xl border-slate-200"
                    />
                  </div>
                  <div className="pt-4 border-t border-slate-100 mt-4">
                    <p className="text-sm font-bold text-slate-800 mb-4">Branding visual</p>
                    <div className="grid gap-4 md:grid-cols-2">
                      <div className="space-y-2">
                        <label className="text-xs font-bold text-slate-700 uppercase tracking-wider">
                          URL del logotipo
                        </label>
                        <Input
                          value={formValues.logoImageUrl}
                          onChange={(event) => updateField('logoImageUrl', event.target.value)}
                          className="rounded-xl border-slate-200"
                          placeholder="https://.../logo.png"
                        />
                      </div>
                      <div className="space-y-2">
                        <label className="text-xs font-bold text-slate-700 uppercase tracking-wider">
                          URL de portada
                        </label>
                        <Input
                          value={formValues.heroImageUrl}
                          onChange={(event) => updateField('heroImageUrl', event.target.value)}
                          className="rounded-xl border-slate-200"
                          placeholder="https://.../cover.jpg"
                        />
                      </div>
                      <div className="space-y-2">
                        <label className="text-xs font-bold text-slate-700 uppercase tracking-wider">
                          Texto de sello
                        </label>
                        <Input
                          value={formValues.heroEyebrow}
                          onChange={(event) => updateField('heroEyebrow', event.target.value)}
                          className="rounded-xl border-slate-200"
                          placeholder="Catalogo oficial"
                        />
                      </div>
                      <div className="space-y-2">
                        <label className="text-xs font-bold text-slate-700 uppercase tracking-wider">
                          Nota de confianza
                        </label>
                        <Input
                          value={formValues.heroDescription}
                          onChange={(event) => updateField('heroDescription', event.target.value)}
                          className="rounded-xl border-slate-200"
                          placeholder="Asesoria personalizada..."
                        />
                      </div>
                    </div>
                    <div className="mt-4 rounded-2xl border border-slate-200 bg-slate-50/80 p-4">
                      <div className="flex items-center gap-4">
                        <div className="flex h-16 w-16 items-center justify-center overflow-hidden rounded-2xl border border-slate-200 bg-white text-slate-400">
                          {formValues.logoImageUrl ? (
                            <img
                              src={formValues.logoImageUrl}
                              alt={`Logo de ${brandLabel}`}
                              className="h-full w-full object-contain"
                            />
                          ) : (
                            <ImageIcon size={22} />
                          )}
                        </div>
                        <div className="space-y-1 text-sm text-slate-500">
                          <p className="font-semibold text-slate-900">
                            {formValues.heroEyebrow}
                          </p>
                          <p>
                            {formValues.logoImageUrl
                              ? 'El logo se mostrara desde la URL indicada.'
                              : 'Si no cargas un logo, la tienda puede usar iniciales o imagotipo simple.'}
                          </p>
                          <p className="text-[11px] text-slate-400">
                            Esta configuracion queda separada por marca en este navegador.
                          </p>
                        </div>
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>
            )}

            {activeSection === 'communications' && (
              <Card className="border-none shadow-sm h-fit">
                <CardHeader>
                  <CardTitle className="text-lg">Configuracion de ventas</CardTitle>
                  <CardDescription>
                    Parametros para pedidos, contacto por WhatsApp y medios de pago.
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="space-y-2">
                    <label className="text-xs font-bold text-slate-700 uppercase tracking-wider">
                      WhatsApp del vendedor
                    </label>
                    <Input
                      value={formValues.sellerPhone}
                      onChange={(event) => updateField('sellerPhone', event.target.value)}
                      className="rounded-xl border-slate-200"
                    />
                    <p className="text-[10px] text-slate-400">
                      Usa formato internacional sin espacios. Guardamos un valor compatible con enlaces `wa.me`.
                    </p>
                  </div>
                  <div className="space-y-2">
                    <label className="text-xs font-bold text-slate-700 uppercase tracking-wider">
                      Mensaje predeterminado
                    </label>
                    <Textarea
                      value={formValues.sellerMessageTemplate}
                      onChange={(event) => updateField('sellerMessageTemplate', event.target.value)}
                      className="rounded-xl border-slate-200 min-h-[110px]"
                    />
                    <p className="text-[10px] text-slate-400">
                      Este texto base se puede reutilizar en compra rapida y solicitudes por WhatsApp.
                    </p>
                  </div>
                  <div className="pt-4 border-t border-slate-100">
                    <p className="text-sm font-bold text-slate-800 mb-4">Datos de pago</p>
                    <div className="space-y-4">
                      <div className="space-y-2">
                        <label className="text-xs font-bold text-slate-700 uppercase tracking-wider">
                          Link de Connectia
                        </label>
                        <Input
                          value={formValues.connectiaPaymentLink}
                          onChange={(event) => updateField('connectiaPaymentLink', event.target.value)}
                          className="rounded-xl border-slate-200"
                          placeholder="https://connectia.mx/..."
                        />
                      </div>
                      <div className="grid gap-4 md:grid-cols-2">
                        <div className="space-y-2">
                          <label className="text-xs font-bold text-slate-700 uppercase tracking-wider">
                            Usuario de PayPal
                          </label>
                          <Input
                            value={formValues.paypalUsername}
                            onChange={(event) => updateField('paypalUsername', event.target.value)}
                            className="rounded-xl border-slate-200"
                            placeholder="tuusuario"
                          />
                          <p className="text-[10px] text-slate-400">
                            Puedes escribirlo con o sin `@`.
                          </p>
                        </div>
                        <div className="space-y-2">
                          <label className="text-xs font-bold text-slate-700 uppercase tracking-wider">
                            Link de PayPal
                          </label>
                          <Input
                            value={formValues.paypalPaymentLink}
                            onChange={(event) => updateField('paypalPaymentLink', event.target.value)}
                            className="rounded-xl border-slate-200"
                            placeholder="https://paypal.me/tuusuario"
                          />
                        </div>
                      </div>
                      <div className="space-y-2">
                        <label className="text-xs font-bold text-slate-700 uppercase tracking-wider">
                          CLABE o referencia de transferencia
                        </label>
                        <Input
                          value={formValues.transferClabe}
                          onChange={(event) => updateField('transferClabe', event.target.value)}
                          className="rounded-xl border-slate-200"
                          placeholder="012345678901234567 (Banco)"
                        />
                      </div>
                      <div className="space-y-2">
                        <label className="text-xs font-bold text-slate-700 uppercase tracking-wider">
                          Instrucciones de transferencia
                        </label>
                        <Textarea
                          value={formValues.transferInstructions}
                          onChange={(event) => updateField('transferInstructions', event.target.value)}
                          className="rounded-xl border-slate-200 min-h-[96px]"
                        />
                        <p className="text-[10px] text-slate-400">
                          Aqui puedes indicar banco, titular o el flujo para enviar comprobante.
                        </p>
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>
            )}

            {activeSection === 'notifications' && (
              <Card className="border-none shadow-sm h-fit">
                <CardHeader>
                  <CardTitle className="text-lg">Notificaciones</CardTitle>
                  <CardDescription>
                    Estado actual de la tienda administrada desde el navegador.
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-4 text-sm text-slate-600">
                  <div className="rounded-2xl bg-amber-50 border border-amber-100 p-4">
                    La configuracion actual se guarda por marca en este navegador para no mezclar Natura y Nikken.
                  </div>
                  <div className="rounded-2xl bg-slate-50 p-4">
                    Siguiente paso sugerido: sincronizar estos cambios con backend para compartirlos entre dispositivos.
                  </div>
                </CardContent>
              </Card>
            )}

            {activeSection === 'security' && (
              <Card className="border-none shadow-sm h-fit">
                <CardHeader>
                  <CardTitle className="text-lg">Seguridad</CardTitle>
                  <CardDescription>Resumen operativo del entorno actual.</CardDescription>
                </CardHeader>
                <CardContent className="space-y-4 text-sm text-slate-600">
                  <div className="flex items-start gap-3 rounded-2xl bg-emerald-50 border border-emerald-100 p-4">
                    <CheckCircle2 className="w-5 h-5 text-emerald-600 mt-0.5 shrink-0" />
                    <p>
                      La sesion mock y la configuracion de la tienda se mantienen aisladas para reducir mezclas entre marcas.
                    </p>
                  </div>
                  <div className="rounded-2xl bg-slate-50 p-4">
                    Cuando conectemos autenticacion real, esta vista podra administrar permisos y cambios centralizados.
                  </div>
                </CardContent>
              </Card>
            )}

            <Card className="border-none shadow-sm h-fit">
              <CardHeader className="flex flex-row items-start justify-between gap-4">
                <div>
                  <CardTitle className="text-lg">Preview rapida</CardTitle>
                  <CardDescription>{previewDescription}</CardDescription>
                </div>
                <Settings className="w-5 h-5 text-primary" />
              </CardHeader>
              <CardContent>
                <div className="overflow-hidden rounded-[1.75rem] border border-primary/10 bg-white shadow-sm">
                  <div
                    className="relative px-6 py-7"
                    style={
                      formValues.heroImageUrl
                        ? {
                            backgroundImage: `linear-gradient(135deg, rgba(15,23,42,0.7), rgba(15,23,42,0.18)), url(${formValues.heroImageUrl})`,
                            backgroundPosition: 'center',
                            backgroundSize: 'cover',
                          }
                        : {
                            background:
                              'linear-gradient(135deg, rgba(14,165,233,0.15), rgba(34,197,94,0.08))',
                          }
                    }
                  >
                    <div className="flex items-start justify-between gap-4">
                      <div>
                        <p className="text-[11px] font-bold uppercase tracking-[0.3em] text-primary">
                          {brandLabel}
                        </p>
                        <h2 className="mt-3 text-2xl font-bold text-slate-900">
                          {formValues.siteName}
                        </h2>
                        <p className="mt-2 max-w-xl text-slate-600">{formValues.slogan}</p>
                      </div>
                      <div className="flex h-16 w-16 items-center justify-center overflow-hidden rounded-2xl border border-white/60 bg-white/90 text-sm font-bold text-slate-700 shadow-sm">
                        {formValues.logoImageUrl ? (
                          <img
                            src={formValues.logoImageUrl}
                            alt={`Logo de ${brandLabel}`}
                            className="h-full w-full object-contain"
                          />
                        ) : (
                          brandInitials
                        )}
                      </div>
                    </div>
                    <div className="mt-5 inline-flex rounded-full border border-white/60 bg-white/85 px-3 py-1 text-xs font-semibold text-slate-700">
                      {formValues.heroEyebrow}
                    </div>
                  </div>
                  <div className="p-6">
                    <div className="rounded-2xl bg-slate-50 p-4 text-sm text-slate-600">
                      WhatsApp activo:{' '}
                      <span className="font-semibold text-slate-900">
                        {normalizeSellerPhone(formValues.sellerPhone)}
                      </span>
                    </div>
                    <div className="mt-3 rounded-2xl border border-slate-100 bg-white p-4 text-sm text-slate-600">
                      {formValues.heroDescription}
                    </div>
                    <div className="mt-3 rounded-2xl bg-slate-50 p-4 text-sm text-slate-600 space-y-2">
                      <p>
                        Connectia:{' '}
                        <span className="font-semibold text-slate-900">
                          {formValues.connectiaPaymentLink || 'Sin configurar'}
                        </span>
                      </p>
                      <p>
                        PayPal:{' '}
                        <span className="font-semibold text-slate-900">
                          {formValues.paypalUsername
                            ? `@${formValues.paypalUsername}`
                            : formValues.paypalPaymentLink || 'Sin configurar'}
                        </span>
                      </p>
                      <p>
                        Transferencia:{' '}
                        <span className="font-semibold text-slate-900">
                          {formValues.transferClabe || 'Sin configurar'}
                        </span>
                      </p>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>
        </div>
      </div>
    </AdminLayout>
  );
}
