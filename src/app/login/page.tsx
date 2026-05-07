import Image from "next/image";
import { redirect } from "next/navigation";

import { signIn } from "@/app/actions";
import { FeedbackMessage } from "@/components/feedback-message";
import { SubmitButton } from "@/components/form-buttons";
import { getCurrentAccess } from "@/lib/supabase-server";

type LoginPageProps = {
  searchParams: Promise<{
    success?: string;
    error?: string;
  }>;
};

export default async function LoginPage({
  searchParams,
}: LoginPageProps) {
  const access = await getCurrentAccess();
  const params = await searchParams;

  if (access.user) {
    redirect(access.isGlobalAdmin ? "/admin/users" : "/dashboard");
  }

  return (
    <main className="min-h-screen bg-zinc-50 px-6 py-10 text-zinc-950">
      <section className="mx-auto grid min-h-[calc(100vh-5rem)] w-full max-w-5xl items-center gap-8 lg:grid-cols-[1.05fr_0.95fr]">
        <div className="flex flex-col justify-center">
          <div className="flex items-center gap-4">
            <div className="flex h-16 w-16 items-center justify-center overflow-hidden rounded-md bg-white shadow-sm">
              <Image
                src="/logo.png"
                alt="GSI Tecnologia"
                width={64}
                height={64}
                className="object-contain"
                priority
              />
            </div>

            <div>
              <p className="text-xl font-semibold text-zinc-950">
                Soluções Inteligentes
              </p>

              <p className="mt-1 text-sm font-medium uppercase tracking-wide text-blue-700">
                Inventários
              </p>
            </div>
          </div>

          <h1 className="mt-8 max-w-xl text-3xl font-semibold leading-tight sm:text-4xl">
            Solução empresarial para controle e administração de ativos de TI
          </h1>

          <p className="mt-4 max-w-xl text-base leading-7 text-zinc-600">
            Centralize a gestão dos ativos da sua organização em uma plataforma segura, com controle de acesso corporativo e gerenciamento inteligente.
          </p>
        </div>

        <div className="grid gap-4">
          <FeedbackMessage
            success={params.success}
            error={params.error}
          />

          <AuthForm
            title="Entrar"
            action={signIn}
            buttonLabel="Entrar"
            helper="Sem cadastro público. Solicite acesso ao administrador do sistema."
          />
        </div>
      </section>
    </main>
  );
}

type AuthFormProps = {
  title: string;
  action: (formData: FormData) => Promise<void>;
  buttonLabel: string;
  helper: string;
};

function AuthForm({
  title,
  action,
  buttonLabel,
  helper,
}: AuthFormProps) {
  return (
    <form
      action={action}
      className="rounded-xl border border-zinc-200 bg-white p-6 shadow-sm"
    >
      <h2 className="text-lg font-semibold text-zinc-950">
        {title}
      </h2>

      <p className="mt-1 text-sm leading-6 text-zinc-500">
        {helper}
      </p>

      <div className="mt-5 grid gap-4">
        <label className="grid gap-1.5 text-sm font-medium text-zinc-700">
          E-mail

          <input
            name="email"
            type="email"
            required
            placeholder="seuemail@empresa.com"
            className="h-11 rounded-md border border-zinc-300 px-3 text-sm font-normal text-zinc-900 outline-none transition focus:border-zinc-950"
          />
        </label>

        <label className="grid gap-1.5 text-sm font-medium text-zinc-700">
          Senha

          <input
            name="password"
            type="password"
            required
            minLength={6}
            placeholder="••••••••"
            className="h-11 rounded-md border border-zinc-300 px-3 text-sm font-normal text-zinc-900 outline-none transition focus:border-zinc-950"
          />
        </label>

        <SubmitButton
          label={buttonLabel}
          pendingLabel="Processando..."
          className="mt-2 h-11 rounded-md bg-zinc-950 px-4 text-sm font-medium text-white transition-colors hover:bg-zinc-800"
        />
      </div>
    </form>
  );
}