"use client";

import { ChangeEvent, InputHTMLAttributes, useState } from "react";
import { Check, Eye, EyeOff, X } from "lucide-react";
import {
  getPasswordCriteria,
  getPasswordStrength,
  passwordCriteriaLabels,
  type PasswordStrength,
} from "@/lib/password-criteria";
import { Input } from "@/components/ui/input";

const strengthCopy: Record<PasswordStrength, { label: string; activeSegments: number; color: string }> = {
  empty: { label: "Débil", activeSegments: 0, color: "bg-neutral-800" },
  weak: { label: "Débil", activeSegments: 1, color: "bg-red-500" },
  medium: { label: "Media", activeSegments: 2, color: "bg-orange-400" },
  strong: { label: "Fuerte", activeSegments: 3, color: "bg-emerald-400" },
};

type PasswordStrengthInputProps = Omit<InputHTMLAttributes<HTMLInputElement>, "type" | "value" | "onChange"> & {
  value: string;
  onChange: (event: ChangeEvent<HTMLInputElement>) => void;
};

export function PasswordStrengthInput({ value, onChange, className, ...props }: PasswordStrengthInputProps) {
  const [showPassword, setShowPassword] = useState(false);
  const criteria = getPasswordCriteria(value);
  const strength = strengthCopy[getPasswordStrength(value)];

  return (
    <div className="space-y-3">
      <div className="relative">
        <Input
          {...props}
          type={showPassword ? "text" : "password"}
          value={value}
          onChange={onChange}
          className={["h-12 rounded-2xl border-neutral-800 bg-neutral-950 pr-12", className].filter(Boolean).join(" ")}
        />
        <button
          type="button"
          onClick={() => setShowPassword((current) => !current)}
          className="absolute right-3 top-1/2 flex h-8 w-8 -translate-y-1/2 items-center justify-center rounded-full text-neutral-400 hover:text-neutral-100"
          aria-label={showPassword ? "Ocultar contraseña" : "Mostrar contraseña"}
        >
          {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
        </button>
      </div>

      <PasswordStrengthMeter password={value} />

      <div className="space-y-2">
        <div className="text-sm font-medium text-neutral-200">
          Ingresa una contraseña. Debe contener:
        </div>
        <div className="space-y-1.5 text-sm text-neutral-400">
          <CriteriaRow met={criteria.minLength} label={passwordCriteriaLabels.minLength} />
          <CriteriaRow met={criteria.number} label={passwordCriteriaLabels.number} />
          <CriteriaRow met={criteria.uppercase} label={passwordCriteriaLabels.uppercase} />
        </div>
      </div>
    </div>
  );
}

export function PasswordStrengthMeter({ password }: { password: string }) {
  const strength = strengthCopy[getPasswordStrength(password)];

  return (
    <div aria-label={`Fortaleza: ${strength.label}`}>
      <div className="grid grid-cols-3 gap-2">
        {[0, 1, 2].map((index) => (
          <div
            key={index}
            className={[
              "h-1.5 rounded-full transition-colors",
              index < strength.activeSegments ? strength.color : "bg-neutral-800",
            ].join(" ")}
          />
        ))}
      </div>
    </div>
  );
}

function CriteriaRow({ met, label }: { met: boolean; label: string }) {
  return (
    <div className={met ? "flex items-center gap-2 text-emerald-300" : "flex items-center gap-2"}>
      {met ? <Check className="h-4 w-4" /> : <X className="h-4 w-4" />}
      <span>{label}</span>
    </div>
  );
}
