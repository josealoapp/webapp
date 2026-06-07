export type PasswordStrength = "empty" | "weak" | "medium" | "strong";

export const passwordCriteriaLabels = {
  minLength: "8 caracteres",
  number: "Un número",
  uppercase: "Una letra mayúscula",
};

export function getPasswordCriteria(password: string) {
  return {
    minLength: password.length >= 8,
    number: /\d/.test(password),
    uppercase: /[A-Z]/.test(password),
  };
}

export function isPasswordValid(password: string) {
  const criteria = getPasswordCriteria(password);
  return criteria.minLength && criteria.number && criteria.uppercase;
}

export function getPasswordStrength(password: string): PasswordStrength {
  if (!password) return "empty";

  const passed = Object.values(getPasswordCriteria(password)).filter(Boolean).length;
  if (passed <= 1) return "weak";
  if (passed === 2) return "medium";
  return "strong";
}

export function getPasswordValidationMessage() {
  return "La contraseña debe tener al menos 8 caracteres, un número y una letra mayúscula.";
}
