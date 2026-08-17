"use client";

import { useMemo, useState } from "react";
import { Check, Clock, Copy, CreditCard, MapPin, Plus, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  AccountKind,
  DeliveryProfileTag,
  PaymentProfileTag,
  ProfileTag,
  ProfileTagType,
  ScheduleProfileTag,
  TaxIdType,
  writeProfileTags,
} from "@/lib/profile-tags";

const dominicanBanks = [
  "Banco Popular Dominicano",
  "Banreservas",
  "BHD",
  "Scotiabank República Dominicana",
  "Banco Santa Cruz",
  "Banco Caribe",
  "Banco Promerica",
  "Banco Ademi",
  "Banco Vimenca",
  "Banco López de Haro",
  "Asociación Popular de Ahorros y Préstamos",
  "Asociación Cibao de Ahorros y Préstamos",
  "Asociación La Nacional de Ahorros y Préstamos",
  "Asociación Duarte de Ahorros y Préstamos",
  "Asociación Mocana de Ahorros y Préstamos",
];

const weekDays = [
  "Lunes",
  "Martes",
  "Miércoles",
  "Jueves",
  "Viernes",
  "Sábado",
  "Domingo",
];

const nonWorkingOptions = ["Días de fiestas", ...weekDays];
const accountKindOptions: AccountKind[] = ["Ahorros", "Corriente", "Empresarial"];

type Props = {
  userId: string;
  tags: ProfileTag[];
  editable?: boolean;
};

type Draft = {
  type: ProfileTagType | "";
  bankName: string;
  customBankName: string;
  beneficiaryName: string;
  accountKind: AccountKind | "";
  accountNumber: string;
  taxIdType: TaxIdType;
  taxId: string;
  pointName: string;
  address: string;
  notes: string;
  availableDays: string[];
  startsAt: string;
  endsAt: string;
  nonWorkingDays: string[];
};

const defaultDraft: Draft = {
  type: "",
  bankName: "",
  customBankName: "",
  beneficiaryName: "",
  accountKind: "",
  accountNumber: "",
  taxIdType: "cedula",
  taxId: "",
  pointName: "",
  address: "",
  notes: "",
  availableDays: ["Lunes", "Martes", "Miércoles", "Jueves", "Viernes"],
  startsAt: "09:00",
  endsAt: "18:00",
  nonWorkingDays: [],
};

function makeId() {
  return `tag_${Date.now()}_${Math.random().toString(16).slice(2)}`;
}

function tagIcon(type: ProfileTagType) {
  if (type === "payment") return <CreditCard className="h-4 w-4" />;
  if (type === "delivery") return <MapPin className="h-4 w-4" />;
  return <Clock className="h-4 w-4" />;
}

export default function ProfileTags({ userId, tags, editable = false }: Props) {
  const [openCreate, setOpenCreate] = useState(false);
  const [selectedTag, setSelectedTag] = useState<ProfileTag | null>(null);
  const [draft, setDraft] = useState<Draft>(defaultDraft);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  const visibleTags = useMemo(() => getVisibleProfileTags(tags), [tags]);

  const resetDraft = (type: ProfileTagType | "" = "") => {
    setDraft({ ...defaultDraft, type });
    setError("");
  };

  const handleSave = async () => {
    if (!userId || saving) return;
    const nextTag = buildTagFromDraft(draft);
    if (!nextTag) {
      setError("Completa la información requerida.");
      return;
    }

    setSaving(true);
    setError("");
    try {
      const sameTypeTags = tags.filter((tag) => tag.type === nextTag.type);
      const otherTags = tags.filter((tag) => tag.type !== nextTag.type);
      const nextTags = sameTypeTags.length
        ? [...sameTypeTags, nextTag, ...otherTags]
        : [nextTag, ...tags];
      await writeProfileTags(userId, nextTags);
      setOpenCreate(false);
      resetDraft();
    } catch {
      setError("No pudimos guardar el tag. Intenta de nuevo.");
    } finally {
      setSaving(false);
    }
  };

  if (!editable && visibleTags.length === 0) return null;

  return (
    <>
      <div className="mt-5 flex w-full flex-wrap items-center justify-center gap-3">
        {visibleTags.map((tag) => (
          <button
            key={tag.id}
            type="button"
            onClick={() => setSelectedTag(tag)}
            className="flex h-11 items-center gap-2 rounded-full border border-neutral-800 bg-neutral-950 px-4 text-sm font-semibold text-neutral-100 hover:border-orange-400 hover:text-white"
          >
            {tagIcon(tag.type)}
            <span>{tag.title}</span>
          </button>
        ))}
        {editable ? (
          <button
            type="button"
            onClick={() => {
              resetDraft();
              setOpenCreate(true);
            }}
            className={[
              "profile-add-tag-button flex h-11 items-center gap-2 rounded-full border px-4 text-sm font-semibold",
              visibleTags.length
                ? "border-neutral-800 bg-neutral-950 text-neutral-100 hover:border-orange-400 hover:text-white"
                : "border-neutral-800 bg-neutral-950 text-white hover:border-orange-400",
            ].join(" ")}
          >
            <Plus className="h-4 w-4" />
            {visibleTags.length ? "Agregar" : "Agregar tag"}
          </button>
        ) : null}
      </div>

      {openCreate ? (
        <ProfileTagCreateModal
          draft={draft}
          error={error}
          saving={saving}
          onDraftChange={setDraft}
          onClose={() => {
            setOpenCreate(false);
            resetDraft();
          }}
          onSave={handleSave}
        />
      ) : null}

      {selectedTag ? (
        <ProfileTagDetailsModal
          tag={selectedTag}
          sameTypeTags={tags.filter((tag) => tag.type === selectedTag.type)}
          allTags={tags}
          editable={editable}
          userId={userId}
          onClose={() => setSelectedTag(null)}
        />
      ) : null}
    </>
  );
}

function getVisibleProfileTags(tags: ProfileTag[]) {
  const orderedTypes: ProfileTagType[] = ["payment", "delivery", "schedule"];
  return orderedTypes
    .map((type) => tags.find((tag) => tag.type === type))
    .filter((tag): tag is ProfileTag => Boolean(tag));
}

function buildTagFromDraft(draft: Draft): ProfileTag | null {
  const createdAt = Date.now();

  if (draft.type === "payment") {
    const bankName = (draft.bankName === "__custom__" ? draft.customBankName : draft.bankName).trim();
    const beneficiaryName = draft.beneficiaryName.trim();
    const accountKind = draft.accountKind;
    const accountNumber = draft.accountNumber.trim();
    const taxId = formatTaxId(draft.taxId, draft.taxIdType);
    if (!bankName || !beneficiaryName || !accountKind || !accountNumber || !isValidTaxId(taxId, draft.taxIdType)) return null;

    return {
      id: makeId(),
      type: "payment",
      title: "Como pagar",
      bankName,
      beneficiaryName,
      accountKind,
      accountNumber,
      taxIdType: draft.taxIdType,
      taxId,
      createdAt,
    };
  }

  if (draft.type === "delivery") {
    if (!draft.pointName.trim() || !draft.address.trim()) return null;
    return {
      id: makeId(),
      type: "delivery",
      title: "Puntos de entrega",
      pointName: draft.pointName.trim(),
      address: draft.address.trim(),
      notes: draft.notes.trim(),
      createdAt,
    };
  }

  if (!draft.availableDays.length || !draft.startsAt || !draft.endsAt) return null;
  return {
    id: makeId(),
    type: "schedule",
    title: "Horarios",
    availableDays: draft.availableDays,
    startsAt: draft.startsAt,
    endsAt: draft.endsAt,
    nonWorkingDays: draft.nonWorkingDays,
    createdAt,
  };
}

function ProfileTagCreateModal({
  draft,
  error,
  saving,
  onDraftChange,
  onClose,
  onSave,
}: {
  draft: Draft;
  error: string;
  saving: boolean;
  onDraftChange: (draft: Draft) => void;
  onClose: () => void;
  onSave: () => void;
}) {
  const update = (patch: Partial<Draft>) => onDraftChange({ ...draft, ...patch });

  return (
    <div className="fixed inset-0 z-[3000] flex items-end justify-center bg-black/70 px-4 pb-4 pt-16 sm:items-center sm:pb-0">
      <div className="max-h-[88vh] w-full max-w-md overflow-y-auto rounded-3xl border border-neutral-800 bg-neutral-950 p-5 text-neutral-50 shadow-2xl">
        <div className="flex items-center justify-between">
          <div>
            <div className="text-base font-semibold">Agregar tag</div>
            <div className="mt-1 text-xs text-neutral-400">Comparte información útil para compradores.</div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="flex h-9 w-9 items-center justify-center rounded-full border border-neutral-800 text-neutral-300 hover:text-white"
            aria-label="Cerrar"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <SelectField
          className="mt-5"
          label="Seleccionar tipo de tag"
          value={draft.type}
          placeholder="Selecciona un tipo"
          options={[
            { value: "payment", label: "Como pagar" },
            { value: "delivery", label: "Puntos de entrega" },
            { value: "schedule", label: "Horarios" },
          ]}
          onChange={(value) => update({ ...defaultDraft, type: value as ProfileTagType })}
        />

        {draft.type === "payment" ? <PaymentFields draft={draft} update={update} /> : null}
        {draft.type === "delivery" ? <DeliveryFields draft={draft} update={update} /> : null}
        {draft.type === "schedule" ? <ScheduleFields draft={draft} update={update} /> : null}

        {error ? (
          <div className="mt-4 rounded-2xl border border-red-900/40 bg-red-950/30 px-4 py-3 text-sm text-red-200">
            {error}
          </div>
        ) : null}

        <Button
          type="button"
          onClick={onSave}
          disabled={saving}
          className="mt-5 h-12 w-full rounded-2xl bg-orange-400 px-4 text-sm font-semibold text-black hover:bg-orange-300 disabled:bg-neutral-700 disabled:text-neutral-300"
        >
          {saving ? "Guardando..." : "Guardar"}
        </Button>
      </div>
    </div>
  );
}

function PaymentFields({ draft, update }: { draft: Draft; update: (patch: Partial<Draft>) => void }) {
  return (
    <div className="mt-4 space-y-4">
      <SelectField
        label="Seleccionar banco"
        value={draft.bankName}
        placeholder="Selecciona un banco o asociación"
        options={[
          ...dominicanBanks.map((bank) => ({ value: bank, label: bank })),
          { value: "__custom__", label: "Agregar" },
        ]}
        onChange={(value) => update({ bankName: value })}
      />

      {draft.bankName === "__custom__" ? (
        <TextField
          label="Agregar banco o asociación"
          value={draft.customBankName}
          placeholder="Nombre del banco"
          onChange={(value) => update({ customBankName: value })}
        />
      ) : null}

      <TextField
        label="Nombre de beneficiario"
        value={draft.beneficiaryName}
        placeholder="Nombre completo"
        onChange={(value) => update({ beneficiaryName: value })}
      />

      <SelectField
        label="Tipo de cuenta"
        value={draft.accountKind}
        placeholder="Selecciona tipo de cuenta"
        options={accountKindOptions.map((kind) => ({ value: kind, label: kind }))}
        onChange={(value) => update({ accountKind: value as AccountKind })}
      />

      <TextField
        label="Número de cuenta"
        value={draft.accountNumber}
        placeholder="Ej. 0000000000"
        inputMode="numeric"
        onChange={(value) => update({ accountNumber: value.replace(/[^\d-]/g, "") })}
      />

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <SelectField
          label="Cédula o RNC"
          value={draft.taxIdType}
          placeholder="Selecciona"
          options={[
            { value: "cedula", label: "Cédula" },
            { value: "rnc", label: "RNC" },
          ]}
          onChange={(value) =>
            update({ taxIdType: value as TaxIdType, taxId: formatTaxId(draft.taxId, value as TaxIdType) })
          }
        />
        <TextField
          label={draft.taxIdType === "cedula" ? "Cédula" : "RNC"}
          value={draft.taxId}
          placeholder={draft.taxIdType === "cedula" ? "000-0000000-0" : "000-00000-0"}
          inputMode="numeric"
          onChange={(value) => update({ taxId: formatTaxId(value, draft.taxIdType) })}
        />
      </div>
    </div>
  );
}

function DeliveryFields({ draft, update }: { draft: Draft; update: (patch: Partial<Draft>) => void }) {
  return (
    <div className="mt-4 space-y-4">
      <TextField
        label="Nombre del punto"
        value={draft.pointName}
        placeholder="Ej. Ágora Mall, entrada principal"
        onChange={(value) => update({ pointName: value })}
      />
      <TextField
        label="Dirección"
        value={draft.address}
        placeholder="Calle, sector, ciudad"
        onChange={(value) => update({ address: value })}
      />
      <label className="flex flex-col gap-2">
        <span className="text-xs text-neutral-400">Notas</span>
        <textarea
          value={draft.notes}
          placeholder="Referencia, parqueo, condiciones de entrega"
          onChange={(event) => update({ notes: event.target.value })}
          className="min-h-24 rounded-2xl border border-neutral-800 bg-neutral-900 px-4 py-3 text-sm text-neutral-100 placeholder:text-neutral-500 focus:border-orange-400 focus:outline-none"
        />
      </label>
    </div>
  );
}

function ScheduleFields({ draft, update }: { draft: Draft; update: (patch: Partial<Draft>) => void }) {
  return (
    <div className="mt-4 space-y-4">
      <div>
        <div className="text-xs text-neutral-400">Días disponibles</div>
        <div className="mt-2 grid grid-cols-2 gap-2">
          {weekDays.map((day) => (
            <ToggleOption
              key={day}
              label={day}
              selected={draft.availableDays.includes(day)}
              onToggle={() => update({ availableDays: toggleValue(draft.availableDays, day) })}
            />
          ))}
        </div>
      </div>

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <TextField
          label="Desde"
          type="time"
          value={draft.startsAt}
          onChange={(value) => update({ startsAt: value })}
        />
        <TextField
          label="Hasta"
          type="time"
          value={draft.endsAt}
          onChange={(value) => update({ endsAt: value })}
        />
      </div>

      <div>
        <div className="text-xs text-neutral-400">Días no laborales</div>
        <div className="mt-2 grid grid-cols-2 gap-2">
          {nonWorkingOptions.map((day) => (
            <ToggleOption
              key={day}
              label={day}
              selected={draft.nonWorkingDays.includes(day)}
              onToggle={() => update({ nonWorkingDays: toggleValue(draft.nonWorkingDays, day) })}
            />
          ))}
        </div>
      </div>
    </div>
  );
}

function TextField({
  label,
  value,
  placeholder,
  inputMode,
  type = "text",
  onChange,
}: {
  label: string;
  value: string;
  placeholder?: string;
  inputMode?: "numeric";
  type?: string;
  onChange: (value: string) => void;
}) {
  return (
    <label className="flex flex-col gap-2">
      <span className="text-xs text-neutral-400">{label}</span>
      <Input
        type={type}
        value={value}
        inputMode={inputMode}
        placeholder={placeholder}
        onChange={(event) => onChange(event.target.value)}
        className="h-12 rounded-2xl border-neutral-800 bg-neutral-900 px-4 text-sm text-neutral-100 shadow-none placeholder:text-neutral-500 focus-visible:border-orange-400 focus-visible:ring-orange-400/20"
      />
    </label>
  );
}

function SelectField({
  label,
  value,
  placeholder,
  options,
  className = "",
  onChange,
}: {
  label: string;
  value: string;
  placeholder: string;
  options: Array<{ value: string; label: string }>;
  className?: string;
  onChange: (value: string) => void;
}) {
  return (
    <label className={`flex min-w-0 flex-col gap-2 ${className}`}>
      <span className="text-xs text-neutral-400">{label}</span>
      <Select value={value} onValueChange={onChange}>
        <SelectTrigger className="h-12 min-w-0 rounded-2xl border-neutral-800 bg-neutral-900 px-4 text-sm text-neutral-100 shadow-none focus-visible:border-orange-400 focus-visible:ring-orange-400/20 [&_[data-slot=select-value]]:truncate">
          <SelectValue placeholder={placeholder} />
        </SelectTrigger>
        <SelectContent className="z-[3100] max-h-72 border-neutral-800 bg-neutral-950 text-neutral-100">
          {options.map((option) => (
            <SelectItem key={option.value} value={option.value} className="focus:bg-neutral-900 focus:text-white">
              {option.label}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </label>
  );
}

function ToggleOption({ label, selected, onToggle }: { label: string; selected: boolean; onToggle: () => void }) {
  return (
    <button
      type="button"
      onClick={onToggle}
      className={[
        "flex h-11 items-center justify-between rounded-2xl border px-3 text-sm",
        selected
          ? "border-orange-400 bg-orange-400/10 text-orange-200"
          : "border-neutral-800 bg-neutral-900 text-neutral-300",
      ].join(" ")}
    >
      <span>{label}</span>
      <span className="flex h-4 w-4 items-center justify-center rounded-full border border-current">
        {selected ? <Check className="h-3 w-3" /> : null}
      </span>
    </button>
  );
}

function ProfileTagDetailsModal({
  tag,
  sameTypeTags,
  allTags,
  editable,
  userId,
  onClose,
}: {
  tag: ProfileTag;
  sameTypeTags: ProfileTag[];
  allTags: ProfileTag[];
  editable: boolean;
  userId: string;
  onClose: () => void;
}) {
  const [activeTagId, setActiveTagId] = useState(tag.id);
  const [editingPayment, setEditingPayment] = useState(false);
  const [editDraft, setEditDraft] = useState<Draft>(defaultDraft);
  const [savingEdit, setSavingEdit] = useState(false);
  const [editError, setEditError] = useState("");
  const activeTag = sameTypeTags.find((row) => row.id === activeTagId) || tag;
  const rows = getDetailRows(activeTag);
  const hasTagOptions = sameTypeTags.length > 1;
  const canEditPayment = editable && activeTag.type === "payment";

  const startPaymentEdit = () => {
    if (activeTag.type !== "payment") return;
    setEditDraft(getPaymentDraft(activeTag));
    setEditError("");
    setEditingPayment(true);
  };

  const savePaymentEdit = async () => {
    if (activeTag.type !== "payment" || !userId || savingEdit) return;
    const nextPayment = buildTagFromDraft(editDraft);
    if (!nextPayment || nextPayment.type !== "payment") {
      setEditError("Completa la información requerida.");
      return;
    }

    setSavingEdit(true);
    setEditError("");
    try {
      await writeProfileTags(
        userId,
        allTags.map((row) =>
          row.id === activeTag.id
            ? { ...nextPayment, id: activeTag.id, createdAt: activeTag.createdAt }
            : row
        )
      );
      setEditingPayment(false);
    } catch {
      setEditError("No pudimos actualizar el método de pago. Intenta de nuevo.");
    } finally {
      setSavingEdit(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[3000] flex items-end justify-center bg-black/70 px-4 pb-4 pt-16 sm:items-center sm:pb-0">
      <div className="w-full max-w-md rounded-3xl border border-neutral-800 bg-neutral-950 p-5 text-neutral-50 shadow-2xl">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2 text-base font-semibold">
            {tagIcon(activeTag.type)}
            <span>{editingPayment ? "Editar método de pago" : activeTag.title}</span>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="flex h-9 w-9 items-center justify-center rounded-full border border-neutral-800 text-neutral-300 hover:text-white"
            aria-label="Cerrar"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        {hasTagOptions ? (
          <div className="mt-5 flex gap-2 overflow-x-auto pb-1">
            {sameTypeTags.map((option) => (
              <button
                key={option.id}
                type="button"
                onClick={() => {
                  setActiveTagId(option.id);
                  setEditingPayment(false);
                  setEditError("");
                }}
                className={[
                  "h-9 shrink-0 rounded-full border px-4 text-sm font-semibold",
                  option.id === activeTag.id
                    ? "border-orange-400 bg-orange-400/10 text-orange-200"
                    : "border-neutral-800 bg-neutral-900 text-neutral-300 hover:border-neutral-600 hover:text-white",
                ].join(" ")}
              >
                {getTagOptionLabel(option)}
              </button>
            ))}
          </div>
        ) : null}

        {editingPayment ? (
          <div className="mt-4">
            <PaymentFields
              draft={editDraft}
              update={(patch) => setEditDraft((current) => ({ ...current, ...patch }))}
            />
            {editError ? (
              <div className="mt-4 rounded-2xl border border-red-900/40 bg-red-950/30 px-4 py-3 text-sm text-red-200">
                {editError}
              </div>
            ) : null}
            <div className="mt-5 grid grid-cols-2 gap-3">
              <Button
                type="button"
                variant="outline"
                onClick={() => {
                  setEditingPayment(false);
                  setEditError("");
                }}
                className="h-12 rounded-2xl border-neutral-800 bg-neutral-900 text-neutral-100 hover:bg-neutral-800 hover:text-white"
              >
                Cancelar
              </Button>
              <Button
                type="button"
                onClick={savePaymentEdit}
                disabled={savingEdit}
                className="h-12 rounded-2xl bg-orange-400 text-black hover:bg-orange-300 disabled:bg-neutral-700 disabled:text-neutral-300"
              >
                {savingEdit ? "Guardando..." : "Guardar"}
              </Button>
            </div>
          </div>
        ) : (
          <>
            <div className={hasTagOptions ? "mt-4 space-y-3" : "mt-5 space-y-3"}>
              {rows.map((row) => (
                <CopyRow key={row.label} label={row.label} value={row.value} />
              ))}
            </div>
            {canEditPayment ? (
              <Button
                type="button"
                variant="outline"
                onClick={startPaymentEdit}
                className="mt-5 h-12 w-full rounded-2xl border-neutral-800 bg-neutral-900 text-neutral-100 hover:bg-neutral-800 hover:text-white"
              >
                Editar método de pago
              </Button>
            ) : null}
          </>
        )}
      </div>
    </div>
  );
}

function getPaymentDraft(tag: PaymentProfileTag): Draft {
  const knownBank = dominicanBanks.includes(tag.bankName);

  return {
    ...defaultDraft,
    type: "payment",
    bankName: knownBank ? tag.bankName : "__custom__",
    customBankName: knownBank ? "" : tag.bankName,
    beneficiaryName: tag.beneficiaryName || "",
    accountKind: tag.accountKind || "Ahorros",
    accountNumber: tag.accountNumber || "",
    taxIdType: tag.taxIdType || "cedula",
    taxId: tag.taxId || "",
  };
}

function getTagOptionLabel(tag: ProfileTag) {
  if (tag.type === "payment") return tag.bankName;
  if (tag.type === "delivery") return tag.pointName;
  return tag.availableDays.length ? tag.availableDays.join(", ") : "Horario";
}

function getDetailRows(tag: ProfileTag) {
  if (tag.type === "payment") {
    const payment = tag as PaymentProfileTag;
    return [
      { label: "Banco", value: payment.bankName },
      ...(payment.beneficiaryName ? [{ label: "Nombre de beneficiario", value: payment.beneficiaryName }] : []),
      { label: "Tipo de cuenta", value: payment.accountKind || "Ahorros" },
      { label: "Número de cuenta", value: payment.accountNumber },
      { label: payment.taxIdType === "cedula" ? "Cédula" : "RNC", value: payment.taxId },
    ];
  }

  if (tag.type === "delivery") {
    const delivery = tag as DeliveryProfileTag;
    return [
      { label: "Punto", value: delivery.pointName },
      { label: "Dirección", value: delivery.address },
      ...(delivery.notes ? [{ label: "Notas", value: delivery.notes }] : []),
    ];
  }

  const schedule = tag as ScheduleProfileTag;
  return [
    { label: "Días", value: schedule.availableDays.join(", ") },
    { label: "Horario", value: `${schedule.startsAt} - ${schedule.endsAt}` },
    {
      label: "Días no laborales",
      value: schedule.nonWorkingDays.length ? schedule.nonWorkingDays.join(", ") : "No especificado",
    },
  ];
}

function CopyRow({ label, value }: { label: string; value: string }) {
  const [copied, setCopied] = useState(false);

  return (
    <div className="rounded-2xl border border-neutral-800 bg-neutral-900/50 px-4 py-3">
      <div className="text-xs text-neutral-500">{label}</div>
      <div className="mt-2 flex items-center gap-3">
        <div className="min-w-0 flex-1 break-words text-sm text-neutral-100">{value}</div>
        <button
          type="button"
          onClick={async () => {
            await navigator.clipboard?.writeText(value);
            setCopied(true);
            window.setTimeout(() => setCopied(false), 900);
          }}
          className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl border border-neutral-700 text-neutral-300 hover:border-orange-400 hover:text-white"
          aria-label={`Copiar ${label}`}
        >
          {copied ? <Check className="h-4 w-4 text-orange-300" /> : <Copy className="h-4 w-4" />}
        </button>
      </div>
    </div>
  );
}

function toggleValue(values: string[], value: string) {
  return values.includes(value) ? values.filter((item) => item !== value) : [...values, value];
}

function formatTaxId(value: string, type: TaxIdType) {
  const digits = value.replace(/\D/g, "").slice(0, type === "cedula" ? 11 : 9);
  if (type === "cedula") {
    return [digits.slice(0, 3), digits.slice(3, 10), digits.slice(10, 11)].filter(Boolean).join("-");
  }

  return [digits.slice(0, 3), digits.slice(3, 8), digits.slice(8, 9)].filter(Boolean).join("-");
}

function isValidTaxId(value: string, type: TaxIdType) {
  const digits = value.replace(/\D/g, "");
  return type === "cedula" ? digits.length === 11 : digits.length === 9;
}
