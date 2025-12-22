import Link from "next/link";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

export default function ForgotPasswordPage() {
  return (
    <div className="min-h-[100dvh] bg-neutral-950 px-4 py-10 text-neutral-100">
      <div className="mx-auto w-full max-w-md">
        <Card className="border-neutral-800 bg-neutral-950">
          <CardHeader>
            <CardTitle className="text-xl">Recuperar contraseña</CardTitle>
          </CardHeader>
          <CardContent className="text-sm text-neutral-400">
            Placeholder de Forgot password. <Link className="underline" href="/sign-in">Volver a Sign in</Link>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}