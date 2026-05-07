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

export default async function LoginPage({ searchParams }: LoginPageProps) {
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
            <div className="grid size-16 place-items-center rounded-md bg-zinc-950 text-2xl font-semibold tracking-normal text-white">
              GSI
            </div>
            <div>
              <p className="text-xl font-semibold text-zinc-950">
                Soluções Inteligentes
              </p>
              <p className="mt-1 text-sm font-medium uppercase text-teal-700">
                Inventários
              </p>
            </div>
          </div>
          <h1 className="mt-8 max-w-xl text-3xl font-semibold sm:text-4xl">
            Controle de ativos por empresa com acesso segregado
          </h1>
          <p className="mt-4 max-w-xl text-base leading-7 text-zinc-600">
            Entre com uma conta criada pelo administrador global. Cada usuario
            acessa somente a empresa vinculada ao seu perfil.
          </p>
        </div>

        <div className="grid gap-4">
          <FeedbackMessage success={params.success} error={params.error} />
          <AuthForm
            title="Entrar"
            action={signIn}
            buttonLabel="Entrar"
            helper="Sem cadastro publico. Solicite o acesso ao administrador do sistema."
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

function AuthForm({ title, action, buttonLabel, helper }: AuthFormProps) {
  return (
    <form action={action} className="rounded-lg border border-zinc-200 bg-white p-5">
      <h2 className="text-lg font-semibold text-zinc-950">{title}</h2>
      <p className="mt-1 text-sm text-zinc-500">{helper}</p>

      <div className="mt-4 grid gap-3">
        <label className="grid gap-1.5 text-sm font-medium text-zinc-700">
          E-mail
          <input
            name="email"
            type="email"
            required
            className="h-11 rounded-md border border-zinc-300 px-3 text-sm font-normal text-zinc-900"
          />
        </label>
        <label className="grid gap-1.5 text-sm font-medium text-zinc-700">
          Senha
          <input
            name="password"
            type="password"
            required
            minLength={6}
            className="h-11 rounded-md border border-zinc-300 px-3 text-sm font-normal text-zinc-900"
          />
        </label>
        <SubmitButton
          label={buttonLabel}
          pendingLabel="Processando..."
          className="h-11 rounded-md bg-zinc-950 px-4 text-sm font-medium text-white transition-colors hover:bg-zinc-800"
        />
      </div>
    </form>
  );
}
