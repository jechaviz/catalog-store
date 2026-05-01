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
import {
  normalizeSellerPhone,
  readStorefrontSettings,
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

type SettingsSyncMode = 'checking' | 'remote' | 'local';

interface SettingsSyncState {
  mode: SettingsSyncMode;
  message: string;
  updatedAt?: string;
}

interface RemoteSettingsResult {
  source: 'remote' | 'local';
  settings: StorefrontSettings;
  updatedAt?: string;
  reason?: string;
}

const REMOTE_SETTINGS_RESOURCE = 'storefront-settings';
const STORE_FRONT_SETTINGS_KEYS: Array<keyof StorefrontSettings> = [
  'siteName',
  'slogan',
  'logoImageUrl',
  'heroImageUrl',
  'heroEyebrow',
  'heroDescription',
  'sellerPhone',
  'sellerMessageTemplate',
  'connectiaPaymentLink',
  'paypalPaymentLink',
  'paypalUsername',
  'transferClabe',
  'transferInstructions',
];

function getRemoteSettingsEndpointCandidates() {
  const env = import.meta.env as Record<string, string | undefined>;

  return Array.from(
    new Set(
      [
        env.VITE_ADMIN_PERSISTENCE_URL,
        env.VITE_ADMIN_REMOTE_URL,
        env.VITE_ADMIN_SETTINGS_ENDPOINT,
        '/api/admin/persistence',
        '/api/admin/shared-state',
        '/api/admin/storefront-settings',
      ]
        .map((value) => (typeof value === 'string' ? value.trim() : ''))
        .filter(Boolean)
    )
  );
}

function buildRemotePersistenceUrl(rawEndpoint: string, brand: string, resource: string) {
  const resolvedUrl =
    rawEndpoint.startsWith('http://') || rawEndpoint.startsWith('https://')
      ? new URL(rawEndpoint)
      : new URL(rawEndpoint, window.location.origin);

  resolvedUrl.searchParams.set('brand', brand);
  resolvedUrl.searchParams.set('resource', resource);

  return resolvedUrl.toString();
}

function extractTimestamp(value: unknown) {
  if (!value || typeof value !== 'object') {
    return undefined;
  }

  const candidate = value as Record<string, unknown>;
  const timestampKeys = ['updatedAt', 'savedAt', 'syncedAt', 'timestamp'];

  for (const key of timestampKeys) {
    const rawValue = candidate[key];
    if (typeof rawValue === 'string' && rawValue.trim()) {
      return rawValue;
    }
  }

  return undefined;
}

function extractStorefrontSettingsPayload(value: unknown): Partial<StorefrontSettings> | null {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    return null;
  }

  const candidate = value as Record<string, unknown>;
  const hasDirectSettingsField = STORE_FRONT_SETTINGS_KEYS.some((key) => typeof candidate[key] === 'string');

  if (hasDirectSettingsField) {
    return candidate as Partial<StorefrontSettings>;
  }

  const envelopeKeys = ['settings', 'storefrontSettings', 'payload', 'data', 'value'];

  for (const key of envelopeKeys) {
    const nestedValue = candidate[key];
    if (nestedValue && typeof nestedValue === 'object' && !Array.isArray(nestedValue)) {
      const nestedCandidate = nestedValue as Record<string, unknown>;
      if (STORE_FRONT_SETTINGS_KEYS.some((settingsKey) => typeof nestedCandidate[settingsKey] === 'string')) {
        return nestedCandidate as Partial<StorefrontSettings>;
      }
    }
  }

  return null;
}

function createSettingsSyncState(
  mode: SettingsSyncMode,
  options?: { updatedAt?: string; reason?: string }
): SettingsSyncState {
  if (mode === 'checking') {
    return {
      mode,
      message: 'Consultando backend y copia local antes de mostrar la configuracion compartida.',
    };
  }

  if (mode === 'remote') {
    return {
      mode,
      message:
        'La configuracion compartida esta activa. Los nuevos cambios intentaran sincronizarse para otros dispositivos.',
      updatedAt: options?.updatedAt,
    };
  }

  return {
    mode,
    message:
      options?.reason ??
      'El backend no respondio ahora. Seguimos usando y guardando la copia local de este navegador.',
  };
}

function formatSyncTimestamp(updatedAt?: string) {
  if (!updatedAt) {
    return '';
  }

  const parsedDate = new Date(updatedAt);
  if (Number.isNaN(parsedDate.getTime())) {
    return '';
  }

  return new Intl.DateTimeFormat('es-MX', {
    dateStyle: 'medium',
    timeStyle: 'short',
  }).format(parsedDate);
}

async function fetchRemoteStorefrontSettings(
  brand: string,
  signal?: AbortSignal
): Promise<RemoteSettingsResult> {
  const localSettings = readStorefrontSettings(brand as 'natura' | 'nikken');
  const endpointCandidates = getRemoteSettingsEndpointCandidates();
  let lastFailureReason = '';

  for (const endpoint of endpointCandidates) {
    try {
      const response = await fetch(
        buildRemotePersistenceUrl(endpoint, brand, REMOTE_SETTINGS_RESOURCE),
        {
          method: 'GET',
          headers: {
            Accept: 'application/json',
          },
          credentials: 'include',
          signal,
        }
      );

      if (!response.ok) {
        lastFailureReason = `El backend devolvio ${response.status}.`;
        continue;
      }

      const payload = await response.json().catch(() => null);
      const remoteSettings = extractStorefrontSettingsPayload(payload);

      if (!remoteSettings) {
        lastFailureReason = 'El backend no devolvio una configuracion utilizable.';
        continue;
      }

      const nextSettings = saveStorefrontSettings(brand as 'natura' | 'nikken', remoteSettings);

      return {
        source: 'remote',
        settings: nextSettings,
        updatedAt: extractTimestamp(payload),
      };
    } catch (error) {
      if (error instanceof DOMException && error.name === 'AbortError') {
        throw error;
      }

      lastFailureReason =
        error instanceof Error && error.message
          ? error.message
          : 'No fue posible consultar la configuracion remota.';
    }
  }

  return {
    source: 'local',
    settings: localSettings,
    updatedAt: undefined,
    reason: lastFailureReason,
  };
}

async function persistRemoteStorefrontSettings(
  brand: string,
  settings: StorefrontSettings
): Promise<RemoteSettingsResult> {
  const localSettings = saveStorefrontSettings(brand as 'natura' | 'nikken', settings);
  const endpointCandidates = getRemoteSettingsEndpointCandidates();

  for (const endpoint of endpointCandidates) {
    for (const method of ['PUT', 'POST'] as const) {
      try {
        const response = await fetch(
          buildRemotePersistenceUrl(endpoint, brand, REMOTE_SETTINGS_RESOURCE),
          {
            method,
            headers: {
              Accept: 'application/json',
              'Content-Type': 'application/json',
            },
            credentials: 'include',
            body: JSON.stringify({
              brand,
              resource: REMOTE_SETTINGS_RESOURCE,
              payload: localSettings,
              settings: localSettings,
              data: localSettings,
              value: localSettings,
              updatedAt: new Date().toISOString(),
            }),
          }
        );

        if (!response.ok) {
          continue;
        }

        const payload = await response.json().catch(() => null);
        const remoteSettings = extractStorefrontSettingsPayload(payload);
        const nextSettings = remoteSettings
          ? saveStorefrontSettings(brand as 'natura' | 'nikken', remoteSettings)
          : localSettings;

        return {
          source: 'remote',
          settings: nextSettings,
          updatedAt: extractTimestamp(payload) ?? new Date().toISOString(),
        };
      } catch {
        // Intentamos el siguiente endpoint o metodo.
      }
    }
  }

  return {
    source: 'local',
    settings: localSettings,
    reason: 'El backend no respondio para compartir esta configuracion.',
  };
}

export default function AdminSettings() {
  const { brand } = useBrand();
  const brandLabel = brand === 'nikken' ? 'Nikken' : 'Natura';
  const [loading, setLoading] = useState(false);
  const [isHydrating, setIsHydrating] = useState(true);
  const [baselineSettings, setBaselineSettings] = useState<StorefrontSettings>(() =>
    readStorefrontSettings(brand)
  );
  const [activeSection, setActiveSection] = useState<SettingsSection>('general');
  const [formValues, setFormValues] = useState<StorefrontSettings>(() => readStorefrontSettings(brand));
  const [syncState, setSyncState] = useState<SettingsSyncState>(() =>
    createSettingsSyncState('checking')
  );

  useEffect(() => {
    const abortController = new AbortController();

    setIsHydrating(true);
    setLoading(false);
    setActiveSection('general');
    setSyncState(createSettingsSyncState('checking'));

    void (async () => {
      try {
        const result = await fetchRemoteStorefrontSettings(brand, abortController.signal);

        if (abortController.signal.aborted) {
          return;
        }

        setBaselineSettings(result.settings);
        setFormValues(result.settings);
        setSyncState(
          createSettingsSyncState(result.source === 'remote' ? 'remote' : 'local', {
            updatedAt: result.updatedAt,
            reason: result.reason,
          })
        );
      } catch (error) {
        if (abortController.signal.aborted) {
          return;
        }

        const localSettings = readStorefrontSettings(brand);
        setBaselineSettings(localSettings);
        setFormValues(localSettings);
        setSyncState(
          createSettingsSyncState('local', {
            reason:
              error instanceof Error && error.message
                ? error.message
                : 'No fue posible consultar la configuracion compartida.',
          })
        );
      } finally {
        if (!abortController.signal.aborted) {
          setIsHydrating(false);
        }
      }
    })();

    return () => {
      abortController.abort();
    };
  }, [brand]);

  const isDirty = useMemo(() => {
    return JSON.stringify(formValues) !== JSON.stringify(baselineSettings);
  }, [formValues, baselineSettings]);

  const updateField = <Key extends keyof StorefrontSettings>(
    field: Key,
    value: StorefrontSettings[Key]
  ) => {
    setFormValues((currentValues) => ({
      ...currentValues,
      [field]: value,
    }));
  };

  const handleSave = async () => {
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
    try {
      const result = await persistRemoteStorefrontSettings(brand, {
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

      setBaselineSettings(result.settings);
      setFormValues(result.settings);
      setSyncState(
        createSettingsSyncState(result.source === 'remote' ? 'remote' : 'local', {
          updatedAt: result.updatedAt,
          reason: result.reason,
        })
      );
      toast.success('Configuracion guardada', {
        description:
          result.source === 'remote'
            ? `Los cambios de ${brandLabel} quedaron sincronizados para compartirse cuando el backend esta disponible.`
            : `Guardamos los cambios de ${brandLabel} solo en este navegador porque el backend no respondio.`,
      });
    } finally {
      setLoading(false);
    }
  };

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

  if (isHydrating) {
    return (
      <AdminLayout>
        <div className="space-y-6 max-w-4xl">
          <Card className="border-none shadow-sm">
            <CardHeader>
              <CardTitle className="text-lg">Cargando configuracion de {brandLabel}</CardTitle>
              <CardDescription>
                Estamos consultando los cambios compartidos y la copia local antes de mostrar esta
                pantalla.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-5 text-sm text-slate-500">
                {syncState.message}
              </div>
            </CardContent>
          </Card>
        </div>
      </AdminLayout>
    );
  }

  return (
    <AdminLayout>
      <div className="space-y-6 max-w-4xl">
        <div className="flex items-center justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold text-slate-900">Configuracion del sistema</h1>
            <p className="text-slate-500">
              Administra la identidad visual y los datos de contacto de {brandLabel}. Cuando el
              backend esta disponible, esta vista intenta cargar y compartir cambios entre
              dispositivos.
            </p>
          </div>
          <Button
            onClick={() => void handleSave()}
            disabled={loading || !isDirty || isHydrating}
            className="rounded-xl flex items-center gap-2"
          >
            <Save size={18} />
            {loading ? 'Guardando...' : isDirty ? 'Guardar cambios' : 'Sin cambios'}
          </Button>
        </div>

        <Card className="border-none shadow-sm">
          <CardContent className="flex flex-col gap-2 p-4 text-sm text-slate-600 md:flex-row md:items-center md:justify-between">
            <div
              className={`rounded-2xl px-4 py-3 ${
                syncState.mode === 'remote'
                  ? 'bg-emerald-50 text-emerald-800'
                  : syncState.mode === 'local'
                    ? 'bg-amber-50 text-amber-900'
                    : 'bg-slate-50 text-slate-600'
              }`}
            >
              {syncState.message}
            </div>
            {syncState.updatedAt ? (
              <p className="text-xs text-slate-400">
                Ultima respuesta remota: {formatSyncTimestamp(syncState.updatedAt)}
              </p>
            ) : null}
          </CardContent>
        </Card>

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
                            Esta configuracion sigue separada por marca y ahora intenta sincronizarse
                            como cambio compartido cuando el backend responde.
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
                    Estado actual de la sincronizacion administrativa.
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-4 text-sm text-slate-600">
                  <div className="rounded-2xl bg-amber-50 border border-amber-100 p-4">
                    La copia local sigue separada por marca para no mezclar Natura y Nikken aunque el
                    backend no este disponible.
                  </div>
                  <div className="rounded-2xl bg-slate-50 p-4">
                    Esta pantalla ahora intenta leer y guardar cambios compartidos. Si el backend
                    falla, te avisaremos y conservaremos el fallback local de este navegador.
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
                      La sesion mock y la configuracion de la tienda se mantienen aisladas por marca,
                      incluso cuando intentamos sincronizar cambios compartidos.
                    </p>
                  </div>
                  <div className="rounded-2xl bg-slate-50 p-4">
                    Con backend disponible, esta vista ya intenta compartir configuraciones. La capa
                    de permisos reales sigue siendo un siguiente paso aparte.
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
